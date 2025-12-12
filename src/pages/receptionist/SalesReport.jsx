/**
 * Sales Report Page - Receptionist
 * View sales data, revenue, and transaction reports
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  ShoppingCart, 
  Calendar, 
  Download, 
  Filter,
  Receipt,
  CreditCard,
  Banknote,
  Gift,
  FileText,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getBillsByBranch, getDailySalesSummary, BILL_STATUS } from '../../services/billingService';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';

const ReceptionistSalesReport = () => {
  const { userBranch, userData } = useAuth();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('month'); // today, week, month, custom
  const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState('all'); // all, paid, refunded, voided
  const [searchTerm, setSearchTerm] = useState('');
  const printRef = useRef();
  
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Sales_Report_${format(new Date(), 'yyyy-MM-dd')}`,
    pageStyle: '@page { size: A4; margin: 1cm; }',
  });

  useEffect(() => {
    if (userBranch) {
      fetchBills();
    }
  }, [userBranch, dateFilter, customStartDate, customEndDate]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      
      let startDate, endDate;
      const now = new Date();
      
      switch (dateFilter) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'week':
          startDate = startOfWeek(now, { weekStartsOn: 1 });
          endDate = endOfWeek(now, { weekStartsOn: 1 });
          break;
        case 'month':
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
        case 'custom':
          startDate = new Date(customStartDate);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
          break;
        default:
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
      }

      const billsData = await getBillsByBranch(userBranch, {
        startDate,
        endDate
      });

      setBills(billsData || []);
    } catch (error) {
      console.error('Error fetching bills:', error);
      toast.error('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  // Filter bills
  const filteredBills = useMemo(() => {
    let filtered = bills;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(bill => bill.status === statusFilter);
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(bill => 
        bill.clientName?.toLowerCase().includes(searchLower) ||
        bill.id?.toLowerCase().includes(searchLower) ||
        bill.stylistName?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [bills, statusFilter, searchTerm]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const paidBills = filteredBills.filter(b => b.status === BILL_STATUS.PAID);
    
    const totalRevenue = paidBills.reduce((sum, bill) => sum + (bill.total || 0), 0);
    const totalTransactions = paidBills.length;
    const totalDiscounts = paidBills.reduce((sum, bill) => sum + (bill.discount || 0), 0);
    const totalTax = paidBills.reduce((sum, bill) => sum + (bill.tax || 0), 0);
    const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Payment method breakdown
    const paymentBreakdown = {
      cash: 0,
      card: 0,
      voucher: 0,
      gift_card: 0
    };

    paidBills.forEach(bill => {
      const method = bill.paymentMethod || 'cash';
      if (paymentBreakdown[method] !== undefined) {
        paymentBreakdown[method] += bill.total || 0;
      }
    });

    // Service vs Product breakdown
    const serviceRevenue = paidBills
      .filter(b => b.salesType === 'service' || b.salesType === 'mixed')
      .reduce((sum, bill) => {
        const serviceItems = (bill.items || []).filter(item => item.type === 'service');
        return sum + serviceItems.reduce((s, item) => s + ((item.price || 0) * (item.quantity || 1)), 0);
      }, 0);

    const productRevenue = paidBills
      .filter(b => b.salesType === 'product' || b.salesType === 'mixed')
      .reduce((sum, bill) => {
        const productItems = (bill.items || []).filter(item => item.type === 'product');
        return sum + productItems.reduce((s, item) => s + ((item.price || 0) * (item.quantity || 1)), 0);
      }, 0);

    // Refunds
    const refundedBills = filteredBills.filter(b => b.status === BILL_STATUS.REFUNDED);
    const totalRefunds = refundedBills.reduce((sum, bill) => sum + (bill.refundAmount || bill.total || 0), 0);

    return {
      totalRevenue,
      totalTransactions,
      totalDiscounts,
      totalTax,
      avgTransactionValue,
      paymentBreakdown,
      serviceRevenue,
      productRevenue,
      totalRefunds,
      netRevenue: totalRevenue - totalRefunds
    };
  }, [filteredBills]);

  // Export to CSV
  const exportToCSV = () => {
    const paidBills = filteredBills.filter(b => b.status === BILL_STATUS.PAID);
    
    if (paidBills.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = [
      'Transaction ID',
      'Date',
      'Time',
      'Client Name',
      'Client Phone',
      'Stylist',
      'Items',
      'Subtotal',
      'Discount',
      'Tax',
      'Total',
      'Payment Method',
      'Status'
    ];

    const csvRows = [
      headers.join(','),
      ...paidBills.map(bill => {
        const date = bill.createdAt?.toDate 
          ? bill.createdAt.toDate() 
          : new Date(bill.createdAt);
        
        const items = (bill.items || []).map(item => 
          `${item.name} (${item.quantity || 1}x)`
        ).join('; ');

        return [
          bill.id || 'N/A',
          format(date, 'yyyy-MM-dd'),
          format(date, 'HH:mm'),
          `"${(bill.clientName || '').replace(/"/g, '""')}"`,
          bill.clientPhone || '',
          `"${(bill.stylistName || '').replace(/"/g, '""')}"`,
          `"${items.replace(/"/g, '""')}"`,
          bill.subtotal || 0,
          bill.discount || 0,
          bill.tax || 0,
          bill.total || 0,
          bill.paymentMethod || 'cash',
          bill.status || 'paid'
        ].join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sales_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
  };

  // Export to PDF using react-to-print
  const exportToPDF = () => {
    if (filteredBills.length === 0) {
      toast.error('No data to export');
      return;
    }
    handlePrint();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Report</h1>
          <p className="text-gray-600 mt-1">View sales data and transaction reports</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchBills}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={exportToCSV}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button
            onClick={exportToPDF}
            className="flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Date Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Range */}
          {dateFilter === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Status</option>
              <option value={BILL_STATUS.PAID}>Paid</option>
              <option value={BILL_STATUS.REFUNDED}>Refunded</option>
              <option value={BILL_STATUS.VOIDED}>Voided</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ₱{summaryStats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Net: ₱{summaryStats.netRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Transactions</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {summaryStats.totalTransactions}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Avg: ₱{summaryStats.avgTransactionValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Service Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ₱{summaryStats.serviceRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Product: ₱{summaryStats.productRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Discounts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ₱{summaryStats.totalDiscounts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Receipt className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Tax: ₱{summaryStats.totalTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>
      </div>

      {/* Payment Method Breakdown */}
      <Card className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Method Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="p-2 bg-green-100 rounded">
              <Banknote className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Cash</p>
              <p className="text-lg font-semibold text-gray-900">
                ₱{summaryStats.paymentBreakdown.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="p-2 bg-blue-100 rounded">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Card</p>
              <p className="text-lg font-semibold text-gray-900">
                ₱{summaryStats.paymentBreakdown.card.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="p-2 bg-purple-100 rounded">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Voucher</p>
              <p className="text-lg font-semibold text-gray-900">
                ₱{summaryStats.paymentBreakdown.voucher.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="p-2 bg-pink-100 rounded">
              <Gift className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Gift Card</p>
              <p className="text-lg font-semibold text-gray-900">
                ₱{summaryStats.paymentBreakdown.gift_card.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card className="overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Transactions</h2>
          <p className="text-sm text-gray-600 mt-1">
            Showing {filteredBills.length} transaction{filteredBills.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stylist
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subtotal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Discount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => {
                  const date = bill.createdAt?.toDate 
                    ? bill.createdAt.toDate() 
                    : new Date(bill.createdAt);
                  
                  return (
                    <tr key={bill.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {format(date, 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(date, 'HH:mm')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {bill.clientName || 'N/A'}
                        </div>
                        {bill.clientPhone && (
                          <div className="text-xs text-gray-500">
                            {bill.clientPhone}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs">
                          {(bill.items || []).slice(0, 2).map((item, idx) => (
                            <div key={idx} className="truncate">
                              {item.name} (x{item.quantity || 1})
                            </div>
                          ))}
                          {(bill.items || []).length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{(bill.items || []).length - 2} more
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {bill.stylistName || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₱{(bill.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₱{(bill.discount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ₱{(bill.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                          {bill.paymentMethod || 'cash'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          bill.status === BILL_STATUS.PAID
                            ? 'bg-green-100 text-green-800'
                            : bill.status === BILL_STATUS.REFUNDED
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {bill.status || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Hidden printable component for PDF export */}
      <div style={{ display: 'none' }}>
        <div ref={printRef} className="p-8 bg-white">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Sales Report</h1>
            {(() => {
              let dateRangeText = '';
              switch (dateFilter) {
                case 'today':
                  dateRangeText = `Date: ${format(new Date(), 'MMMM dd, yyyy')}`;
                  break;
                case 'week':
                  dateRangeText = `Week: ${format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM dd')} - ${format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM dd, yyyy')}`;
                  break;
                case 'month':
                  dateRangeText = `Month: ${format(new Date(), 'MMMM yyyy')}`;
                  break;
                case 'custom':
                  dateRangeText = `Date Range: ${format(new Date(customStartDate), 'MMM dd, yyyy')} - ${format(new Date(customEndDate), 'MMM dd, yyyy')}`;
                  break;
              }
              return (
                <>
                  <p className="text-gray-600">{dateRangeText}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Generated: {format(new Date(), 'MMMM dd, yyyy HH:mm')}
                  </p>
                </>
              );
            })()}
          </div>

          {/* Summary Statistics */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Summary Statistics</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="border p-3">
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-lg font-bold">₱{summaryStats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Net Revenue</p>
                <p className="text-lg font-bold">₱{summaryStats.netRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-lg font-bold">{summaryStats.totalTransactions}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Average Transaction</p>
                <p className="text-lg font-bold">₱{summaryStats.avgTransactionValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Service Revenue</p>
                <p className="text-lg font-bold">₱{summaryStats.serviceRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Product Revenue</p>
                <p className="text-lg font-bold">₱{summaryStats.productRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Total Discounts</p>
                <p className="text-lg font-bold">₱{summaryStats.totalDiscounts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Total Tax</p>
                <p className="text-lg font-bold">₱{summaryStats.totalTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Method Breakdown</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="border p-3">
                <p className="text-sm text-gray-600">Cash</p>
                <p className="text-lg font-bold">₱{summaryStats.paymentBreakdown.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Card</p>
                <p className="text-lg font-bold">₱{summaryStats.paymentBreakdown.card.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Voucher</p>
                <p className="text-lg font-bold">₱{summaryStats.paymentBreakdown.voucher.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="border p-3">
                <p className="text-sm text-gray-600">Gift Card</p>
                <p className="text-lg font-bold">₱{summaryStats.paymentBreakdown.gift_card.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Transaction Details</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-bold">Date</th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-bold">Time</th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-bold">Client</th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-bold">Stylist</th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-bold">Items</th>
                  <th className="border border-gray-300 px-4 py-2 text-right text-sm font-bold">Subtotal</th>
                  <th className="border border-gray-300 px-4 py-2 text-right text-sm font-bold">Discount</th>
                  <th className="border border-gray-300 px-4 py-2 text-right text-sm font-bold">Total</th>
                  <th className="border border-gray-300 px-4 py-2 text-center text-sm font-bold">Payment</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.filter(b => b.status === BILL_STATUS.PAID).map((bill) => {
                  const date = bill.createdAt?.toDate 
                    ? bill.createdAt.toDate() 
                    : new Date(bill.createdAt);
                  
                  return (
                    <tr key={bill.id}>
                      <td className="border border-gray-300 px-4 py-2 text-sm">{format(date, 'MMM dd, yyyy')}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">{format(date, 'HH:mm')}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">{bill.clientName || 'N/A'}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">{bill.stylistName || 'N/A'}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm">
                        {(bill.items || []).map(item => `${item.name} (x${item.quantity || 1})`).join(', ')}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-sm text-right">₱{(bill.subtotal || 0).toFixed(2)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm text-right">₱{(bill.discount || 0).toFixed(2)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm text-right font-bold">₱{(bill.total || 0).toFixed(2)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-sm text-center capitalize">{bill.paymentMethod || 'cash'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceptionistSalesReport;

