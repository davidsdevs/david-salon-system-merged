/**
 * Billing & POS Page - Receptionist
 * For processing payments and viewing billing history
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Banknote, Calendar, Filter, Receipt, Eye, AlertCircle, Printer, X, UserPlus, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getBillsByBranch,
  getDailySalesSummary,
  BILL_STATUS,
  PAYMENT_METHODS,
  createBill
} from '../../services/billingService';
import { 
  getAppointmentsByBranch, 
  APPOINTMENT_STATUS, 
  updateAppointmentStatus
} from '../../services/appointmentService';
import { getBranchById } from '../../services/branchService';
import { getBranchServices } from '../../services/branchServicesService';
import { getUsersByRole } from '../../services/userService';
import { USER_ROLES, ROUTES } from '../../utils/constants';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import BillingModalPOS from '../../components/billing/BillingModalPOS';
import ReceiptComponent from '../../components/billing/Receipt';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';

const ReceptionistBilling = () => {
  const navigate = useNavigate();
  const { currentUser, userBranch, userBranchData, userData } = useAuth();
  const [bills, setBills] = useState([]);
  const [completedAppointments, setCompletedAppointments] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [dailySummary, setDailySummary] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showBillDetails, setShowBillDetails] = useState(false);
  const [branchData, setBranchData] = useState(null);
  const [services, setServices] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [clients, setClients] = useState([]);
  const [showPendingList, setShowPendingList] = useState(false);
  const [isButtonMinimized, setIsButtonMinimized] = useState(false);
  const minimizeTimeoutRef = useRef(null);

  // Tax and service charge rates (can be configured)
  const TAX_RATE = 0; // 12% VAT - set to 0 if no tax
  const SERVICE_CHARGE_RATE = 0; // 5% service charge - set to 0 if no service charge

  // Receipt printing
  const receiptRef = useRef();
  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  });

  useEffect(() => {
    if (userBranch) {
      fetchData();
    }
  }, [userBranch]);

  useEffect(() => {
    applyFilters();
  }, [bills, searchTerm, statusFilter, dateFilter]);

  // Auto-minimize button after showing label initially
  useEffect(() => {
    if (completedAppointments.length > 0) {
      // Show full label initially
      setIsButtonMinimized(false);
      
      // Auto-minimize after 1.5 seconds
      if (minimizeTimeoutRef.current) {
        clearTimeout(minimizeTimeoutRef.current);
      }
      
      minimizeTimeoutRef.current = setTimeout(() => {
        setIsButtonMinimized(true);
      }, 1500);
      
      return () => {
        if (minimizeTimeoutRef.current) {
          clearTimeout(minimizeTimeoutRef.current);
        }
      };
    }
  }, [completedAppointments.length]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch bills
      const billsData = await getBillsByBranch(userBranch);
      setBills(billsData);

      // Fetch completed appointments that haven't been billed yet
      const allAppointments = await getAppointmentsByBranch(userBranch);
      const completed = allAppointments.filter(apt => 
        apt.status === APPOINTMENT_STATUS.COMPLETED &&
        !billsData.some(bill => bill.appointmentId === apt.id)
      );
      setCompletedAppointments(completed);

      // Fetch daily summary
      const summary = await getDailySalesSummary(userBranch);
      setDailySummary(summary);

      // Fetch branch data for receipts
      const branch = await getBranchById(userBranch);
      setBranchData(branch);

      // Fetch services, stylists, and clients for walk-in billing
      const servicesData = await getBranchServices(userBranch);
      setServices(servicesData);

      const stylistsData = await getUsersByRole(USER_ROLES.STYLIST);
      const branchStylists = stylistsData.filter(s => s.branchId === userBranch);
      setStylists(branchStylists);

      const clientsData = await getUsersByRole(USER_ROLES.CLIENT);
      setClients(clientsData.filter(c => c.isActive));
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...bills];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(bill =>
        bill.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill.clientPhone?.includes(searchTerm) ||
        bill.id?.includes(searchTerm)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(bill => bill.status === statusFilter);
    }

    // Date filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    if (dateFilter === 'today') {
      filtered = filtered.filter(bill => {
        const billDate = new Date(bill.createdAt);
        billDate.setHours(0, 0, 0, 0);
        return billDate.getTime() === today.getTime();
      });
    } else if (dateFilter === 'week') {
      filtered = filtered.filter(bill => {
        const billDate = new Date(bill.createdAt);
        return billDate >= today && billDate <= weekFromNow;
      });
    }

    setFilteredBills(filtered);
  };

  const handleProcessPayment = (appointment) => {
    setSelectedAppointment(appointment);
    setShowBillingModal(true);
  };

  const handleWalkInBilling = () => {
    // Redirect to arrivals queue where walk-ins are managed and checked in
    navigate(ROUTES.RECEPTIONIST_ARRIVALS);
  };

  const handleSubmitBill = async (billData) => {
    try {
      setProcessing(true);
      
      // Create the bill - combine currentUser (has uid) with userData (has firstName, lastName)
      const userForBilling = {
        ...currentUser,
        ...userData,
        uid: currentUser.uid // Ensure uid is from Firebase Auth
      };
      await createBill(billData, userForBilling);

      // Update appointment status to include billing info if needed
      // (Optional: You can add a billedAt field to appointments)

      setShowBillingModal(false);
      setSelectedAppointment(null);
      
      // Refresh data
      await fetchData();
      
      toast.success('Payment processed successfully!');
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Failed to process payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleViewBill = (bill) => {
    setSelectedBill(bill);
    setShowBillDetails(true);
  };

  const getStatusBadge = (status) => {
    const badges = {
      [BILL_STATUS.PAID]: 'bg-green-100 text-green-700',
      [BILL_STATUS.REFUNDED]: 'bg-red-100 text-red-700',
      [BILL_STATUS.VOIDED]: 'bg-gray-100 text-gray-700'
    };
    return badges[status] || 'bg-gray-100 text-gray-700';
  };

  const getPaymentMethodLabel = (method) => {
    const labels = {
      [PAYMENT_METHODS.CASH]: 'Cash',
      [PAYMENT_METHODS.CARD]: 'Card',
      [PAYMENT_METHODS.VOUCHER]: 'Voucher',
      [PAYMENT_METHODS.GIFT_CARD]: 'Gift Card'
    };
    return labels[method] || method;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & POS</h1>
          <p className="text-gray-600">View transactions and billing history</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleWalkInBilling}
            className="flex items-center gap-2 px-4 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Add Walk-in / Check-in
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Bell className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> To process a new payment, go to <a href="/receptionist/arrivals" className="font-medium underline hover:text-blue-900">Arrivals & Check-ins</a> page. 
            Complete the service flow: Check-in → Start Service → Check-out (Billing).
          </p>
        </div>
      </div>

      {/* Daily Summary Cards */}
      {dailySummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Revenue</p>
                <p className="text-2xl font-bold text-green-600 mt-1">₱{dailySummary.netRevenue?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Banknote className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Transactions</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{dailySummary.totalTransactions}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Receipt className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Discounts Given</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">₱{dailySummary.totalDiscounts?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Banknote className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Refunds</p>
                <p className="text-2xl font-bold text-red-600 mt-1">₱{dailySummary.totalRefunds?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <Banknote className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Filters */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by client, phone, bill ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value={BILL_STATUS.PAID}>Paid</option>
            <option value={BILL_STATUS.REFUNDED}>Refunded</option>
            <option value={BILL_STATUS.VOIDED}>Voided</option>
          </select>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
          </select>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {filteredBills.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No bills found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Bill ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Services</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Payment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900">#{bill.id.slice(-8)}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm text-gray-900">{bill.createdAt?.toLocaleDateString()}</p>
                      <p className="text-xs text-gray-500">{bill.createdAt?.toLocaleTimeString()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{bill.clientName}</p>
                      <p className="text-xs text-gray-500">{bill.clientPhone}</p>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const services = bill.items?.filter(item => item.type === 'service' || !item.type).length || 0;
                        const products = bill.items?.filter(item => item.type === 'product').length || 0;
                        const totalItems = bill.items?.length || 0;
                        
                        if (services > 0 && products > 0) {
                          return (
                            <p className="text-sm text-gray-600">
                              {services} service(s), {products} product(s)
                            </p>
                          );
                        } else if (products > 0) {
                          return (
                            <p className="text-sm text-gray-600">
                              {products} product(s)
                            </p>
                          );
                        } else {
                          return (
                            <p className="text-sm text-gray-600">
                              {totalItems} service(s)
                            </p>
                          );
                        }
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600">{getPaymentMethodLabel(bill.paymentMethod)}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-semibold text-gray-900">₱{bill.total?.toFixed(2)}</p>
                      {bill.discount > 0 && (
                        <p className="text-xs text-green-600">-₱{bill.discount?.toFixed(2)} discount</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(bill.status)}`}>
                        {bill.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleViewBill(bill)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Billing Modal - POS Style */}
      <BillingModalPOS
        isOpen={showBillingModal}
        appointment={selectedAppointment}
        onClose={() => {
          setShowBillingModal(false);
          setSelectedAppointment(null);
        }}
        onSubmit={handleSubmitBill}
        loading={processing}
        services={services}
        stylists={stylists}
        clients={clients}
        serviceChargeRate={SERVICE_CHARGE_RATE}
      />


      {/* Bill Details Modal with Receipt */}
      {showBillDetails && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Receipt</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  <button
                    onClick={() => setShowBillDetails(false)}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              
              {/* Receipt Display */}
              <div className="border border-gray-200 rounded-lg">
                <ReceiptComponent ref={receiptRef} bill={selectedBill} branch={branchData} />
              </div>

              <button
                onClick={() => setShowBillDetails(false)}
                className="w-full mt-6 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden receipt for printing */}
      <div className="hidden">
        <ReceiptComponent ref={receiptRef} bill={selectedBill || {}} branch={branchData} />
      </div>

      {/* Floating Pending Payments Button */}
      {completedAppointments.length > 0 && (
        <>
          <button
            onClick={() => {
              setShowPendingList(!showPendingList);
              // Toggle minimized state when clicked
              if (isButtonMinimized) {
                setIsButtonMinimized(false);
              }
            }}
            onMouseEnter={() => {
              // Clear any pending minimize
              if (minimizeTimeoutRef.current) {
                clearTimeout(minimizeTimeoutRef.current);
              }
              // Expand to show label on hover
              setIsButtonMinimized(false);
            }}
            onMouseLeave={() => {
              // Only minimize if dropdown is not open
              if (!showPendingList) {
                if (minimizeTimeoutRef.current) {
                  clearTimeout(minimizeTimeoutRef.current);
                }
                minimizeTimeoutRef.current = setTimeout(() => {
                  setIsButtonMinimized(true);
                }, 1000);
              }
            }}
            className="fixed bottom-6 right-6 z-40 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full shadow-md hover:shadow-lg flex items-center group overflow-visible"
              style={{
                animation: 'bounceIn 0.4s ease-out, pulse 2s infinite 0.4s',
                padding: isButtonMinimized ? '12px' : '12px 32px 12px 16px',
                transition: 'padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
          >
            <Bell className="w-5 h-5 flex-shrink-0" />
            <div 
              className="overflow-hidden whitespace-nowrap transition-all duration-500 ease-in-out"
              style={{
                width: isButtonMinimized ? '0px' : '140px',
                opacity: isButtonMinimized ? 0 : 1,
                marginLeft: isButtonMinimized ? '0px' : '8px',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <span className="text-sm font-medium inline-block">Pending Payments</span>
            </div>
            <span 
              className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 z-10 pointer-events-none"
              style={{
                animation: 'pulse 1.5s infinite'
              }}
            >
              {completedAppointments.length}
            </span>
          </button>
          
          {/* Add custom keyframes in style tag */}
          <style>{`
            @keyframes bounceIn {
              0% {
                opacity: 0;
                transform: translateY(50px) scale(0.8);
              }
              60% {
                opacity: 1;
                transform: translateY(-5px) scale(1.05);
              }
              100% {
                transform: translateY(0) scale(1);
              }
            }
            
            @keyframes pulse {
              0%, 100% {
                opacity: 1;
              }
              50% {
                opacity: 0.7;
              }
            }
            
            @keyframes fadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
            
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(15px) scale(0.98);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
            
            .animate-fade-in {
              animation: fadeIn 0.2s ease-out;
            }
            
            .animate-slide-up {
              animation: slideUp 0.25s ease-out;
            }
          `}</style>

          {/* Pending Payments Dropdown */}
          {showPendingList && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-30 bg-black bg-opacity-25 animate-fade-in"
                onClick={() => setShowPendingList(false)}
                style={{
                  animation: 'fadeIn 0.2s ease-out'
                }}
              />
              
              {/* Dropdown Panel */}
              <div 
                className="fixed bottom-24 right-6 z-40 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden animate-slide-up"
                style={{
                  animation: 'slideUp 0.3s ease-out'
                }}
              >
                {/* Header */}
                <div className="bg-yellow-500 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-white" />
                    <h3 className="font-semibold text-white">
                      Pending Payments ({completedAppointments.length})
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowPendingList(false)}
                    className="text-white hover:bg-yellow-600 rounded p-1 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* List */}
                <div className="max-h-96 overflow-y-auto">
                  {completedAppointments.map((apt) => (
                    <button
                      key={apt.id}
                      onClick={() => {
                        handleProcessPayment(apt);
                        setShowPendingList(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {apt.clientName}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-gray-500">
                              #{apt.id.slice(-6)}
                            </p>
                            {apt.services && apt.services.length > 0 && (
                              <>
                                <span className="text-gray-300">•</span>
                                <p className="text-xs text-gray-500">
                                  {apt.services.length} service(s)
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 ml-2" />
                      </div>
                    </button>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
                  <p className="text-xs text-gray-600 text-center">
                    Click to process payment
                  </p>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ReceptionistBilling;
