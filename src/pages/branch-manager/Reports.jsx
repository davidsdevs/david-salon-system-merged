import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '../../context/AuthContext';

import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

import { transactionApiService } from '../../services/transactionApiService';
import { appointmentApiService } from '../../services/appointmentApiService';
import { inventoryService } from '../../services/inventoryService';
import { getClientsByBranch } from '../../services/clientService';
import { getUsersByBranch } from '../../services/userService';
import { getBranchById } from '../../services/branchService';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  Banknote,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  Activity,
  PieChart,
  LineChart,
  FileText,
  RefreshCw,
  Filter,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ShoppingCart,
  Scissors,
  Building2,
  ArrowUpDown,
  Upload,
  FileSpreadsheet,
  Receipt
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from 'date-fns';

const Reports = () => {
  const { userData } = useAuth();
  const printRef = useRef();
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Salon_Reports_${format(new Date(), 'yyyy-MM-dd')}`,
  });

  // Date range states
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [reportType, setReportType] = useState('overview'); // overview, revenue, transactions, appointments, inventory, staff
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [yearlyView, setYearlyView] = useState(false);

  // Data states
  const [transactions, setTransactions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [staffData, setStaffData] = useState([]);
  const [clientsData, setClientsData] = useState([]);
  const [branchInfo, setBranchInfo] = useState(null);

  // Load all data
  useEffect(() => {
    if (userData?.branchId) {
      loadAllData();
    }
  }, [userData?.branchId, dateRange]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load branch info
      if (userData?.branchId) {
        try {
          const branch = await getBranchById(
            userData.branchId,
            userData.roles?.[0] || 'branchManager',
            userData.uid
          );
          setBranchInfo(branch);
        } catch (err) {
          console.error('Error loading branch info:', err);
          // Continue without branch info - not critical
        }
      }

      // Load transactions - get ALL transactions, then filter by date client-side
      const startDate = new Date(dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);

      // Fetch all transactions without date filter (the API doesn't support date filtering well)
      let allTransactions = [];
      let page = 1;
      let hasMore = true;
      let totalFetched = 0;
      
      console.log('📊 Loading transactions for date range:', dateRange.start, 'to', dateRange.end);
      
      while (hasMore && page <= 50) { // Limit to 50 pages to avoid infinite loops
        const transactionsResult = await transactionApiService.getBranchTransactions(
          userData.branchId,
          userData.roles?.[0] || 'branchManager',
          {
            page,
            limit: 100,
            statusFilter: 'All' // Get all statuses, filter client-side
          }
        );
        
        if (transactionsResult.success && transactionsResult.transactions) {
          totalFetched += transactionsResult.transactions.length;
          
          // Filter by date range client-side
          const filtered = transactionsResult.transactions.filter(t => {
            if (!t.createdAt) return false;
            const transactionDate = t.createdAt?.toDate 
              ? t.createdAt.toDate() 
              : new Date(t.createdAt);
            return transactionDate >= startDate && transactionDate <= endDate;
          });
          
          allTransactions.push(...filtered);
          hasMore = transactionsResult.hasMore && transactionsResult.transactions.length > 0;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      console.log(`✅ Loaded ${allTransactions.length} transactions (from ${totalFetched} total fetched)`);
      console.log('📊 Transaction status breakdown:', {
        paid: allTransactions.filter(t => (t.status || '').toLowerCase() === 'paid').length,
        completed: allTransactions.filter(t => (t.status || '').toLowerCase() === 'completed').length,
        in_service: allTransactions.filter(t => (t.status || '').toLowerCase() === 'in_service').length,
        voided: allTransactions.filter(t => (t.status || '').toLowerCase() === 'voided').length,
        all: allTransactions.length
      });
      
      setTransactions(allTransactions);

      // Load appointments
      const appointmentsResult = await appointmentApiService.getAppointments(
        {
          branchId: userData.branchId,
          dateFrom: startDate,
          dateTo: endDate
        },
        'branchManager',
        userData.uid,
        10000
      );
      setAppointments(appointmentsResult.appointments || []);

      // Load inventory stats
      const inventoryResult = await inventoryService.getInventoryStats(userData.branchId);
      if (inventoryResult.success) {
        const salesResult = await inventoryService.getInventorySales(
          userData.branchId,
          dateRange.start,
          dateRange.end
        );
        if (salesResult.success) {
          setInventoryData(salesResult.salesData || []);
        }
      }

      // Load staff
      try {
        const staff = await getUsersByBranch(
          userData.branchId
        );
        setStaffData(staff || []);
      } catch (err) {
        console.error('Error loading staff:', err);
        // Continue without staff data - not critical
      }

      // Load clients (recent)
      try {
        const clients = await getClientsByBranch(
          userData.branchId
        );
        setClientsData(clients || []);
      } catch (err) {
        console.error('Error loading clients:', err);
        // Continue without clients data - not critical
      }

    } catch (err) {
      console.error('Error loading reports data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    // Filter completed transactions - check multiple status formats
    const completedTransactions = transactions.filter(t => {
      const status = (t.status || '').toLowerCase();
      return status === 'paid' || status === 'completed' || status === 'Paid' || status === 'Completed';
    });
    
    const totalRevenue = completedTransactions.reduce((sum, t) => 
      sum + (t.total || t.totalAmount || 0), 0
    );
    
    const serviceRevenue = completedTransactions
      .filter(t => t.transactionType === 'service' || t.type === 'service')
      .reduce((sum, t) => sum + (t.total || t.totalAmount || 0), 0);
    
    const productRevenue = completedTransactions
      .filter(t => t.transactionType === 'product' || t.type === 'product')
      .reduce((sum, t) => sum + (t.total || t.totalAmount || 0), 0);
    
    const totalTransactions = completedTransactions.length;
    const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    
    const completedAppointments = appointments.filter(a => 
      a.status === 'completed' || a.status === 'confirmed'
    );
    
    const cancelledAppointments = appointments.filter(a => 
      a.status === 'cancelled'
    );
    
    const totalProductsSold = completedTransactions.reduce((sum, t) => {
      if (t.products && Array.isArray(t.products)) {
        return sum + t.products.reduce((pSum, p) => pSum + (p.quantity || 0), 0);
      }
      return sum;
    }, 0);

    // Calculate yearly revenue breakdown (by month)
    const yearlyRevenue = {};
    completedTransactions.forEach(t => {
      if (!t.createdAt) return;
      const transactionDate = t.createdAt?.toDate 
        ? t.createdAt.toDate() 
        : new Date(t.createdAt);
      const monthKey = format(transactionDate, 'yyyy-MM');
      const year = format(transactionDate, 'yyyy');
      
      if (!yearlyRevenue[year]) {
        yearlyRevenue[year] = {
          total: 0,
          service: 0,
          product: 0,
          months: {}
        };
      }
      
      const revenue = t.total || t.totalAmount || 0;
      yearlyRevenue[year].total += revenue;
      
      const isService = ((t.transactionType || t.type || '').toLowerCase() === 'service');
      if (isService) {
        yearlyRevenue[year].service += revenue;
      } else {
        yearlyRevenue[year].product += revenue;
      }
      
      if (!yearlyRevenue[year].months[monthKey]) {
        yearlyRevenue[year].months[monthKey] = {
          total: 0,
          service: 0,
          product: 0,
          monthName: format(transactionDate, 'MMMM yyyy')
        };
      }
      
      yearlyRevenue[year].months[monthKey].total += revenue;
      if (isService) {
        yearlyRevenue[year].months[monthKey].service += revenue;
      } else {
        yearlyRevenue[year].months[monthKey].product += revenue;
      }
    });

    return {
      totalRevenue,
      serviceRevenue,
      productRevenue,
      totalTransactions,
      avgTransactionValue,
      totalAppointments: appointments.length,
      completedAppointments: completedAppointments.length,
      cancelledAppointments: cancelledAppointments.length,
      totalProductsSold,
      activeStaff: staffData.filter(s => s.isActive !== false).length,
      totalClients: clientsData.length,
      yearlyRevenue
    };
  }, [transactions, appointments, staffData, clientsData]);

  // Export to CSV
  const exportToCSV = (data, filename, headers) => {
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }

    const csvHeaders = headers || Object.keys(data[0]);
    const csvRows = [
      csvHeaders.join(','),
      ...data.map(row => {
        return csvHeaders.map(header => {
          const value = row[header] || '';
          // Escape quotes and wrap in quotes if contains comma
          const stringValue = String(value).replace(/"/g, '""');
          return `"${stringValue}"`;
        }).join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export transactions
  const exportTransactions = () => {
    const completedTransactions = transactions.filter(t => 
      t.status === 'paid' || t.status === 'completed'
    );
    
    const exportData = completedTransactions.map(t => {
      const clientInfo = t.clientInfo || {};
      const services = t.services || [];
      const products = t.products || [];
      
      return {
        'Transaction ID': t.id || 'N/A',
        'Date': t.createdAt ? format(t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt), 'yyyy-MM-dd HH:mm') : 'N/A',
        'Client Name': clientInfo.name || t.clientName || 'N/A',
        'Client Email': clientInfo.email || 'N/A',
        'Client Phone': clientInfo.phone || 'N/A',
        'Transaction Type': t.transactionType || t.type || 'N/A',
        'Services': services.map(s => s.serviceName || s.name || 'N/A').join('; '),
        'Products': products.map(p => `${p.name} (Qty: ${p.quantity})`).join('; '),
        'Subtotal': t.subtotal || 0,
        'Tax': t.tax || 0,
        'Discount': t.discount || 0,
        'Total': t.total || t.totalAmount || 0,
        'Payment Method': t.paymentMethod || 'N/A',
        'Status': t.status || 'N/A'
      };
    });

    exportToCSV(exportData, 'Transactions_Report', Object.keys(exportData[0] || {}));
  };

  // Export appointments
  const exportAppointments = () => {
    const exportData = appointments.map(a => {
      const services = a.serviceIds || [];
      const stylist = a.stylistId || 'Any Available';
      
      return {
        'Appointment ID': a.id || 'N/A',
        'Date': a.appointmentDate ? format(a.appointmentDate.toDate ? a.appointmentDate.toDate() : new Date(a.appointmentDate), 'yyyy-MM-dd') : 'N/A',
        'Time': a.appointmentTime || 'N/A',
        'Client ID': a.clientId || 'N/A',
        'Services': services.join('; '),
        'Stylist': stylist,
        'Status': a.status || 'N/A',
        'Notes': a.notes || ''
      };
    });

    exportToCSV(exportData, 'Appointments_Report', Object.keys(exportData[0] || {}));
  };

  // Export inventory
  const exportInventory = () => {
    const exportData = inventoryData.map(item => ({
      'Product Name': item.productName || 'N/A',
      'Quantity Sold': item.quantitySold || 0,
      'Unit Cost': item.unitCost || 0,
      'Total Cost': (item.quantitySold || 0) * (item.unitCost || 0),
      'Revenue': item.totalRevenue || 0,
      'Profit': (item.totalRevenue || 0) - ((item.quantitySold || 0) * (item.unitCost || 0)),
      'Profit Margin': item.totalRevenue > 0 
        ? (((item.totalRevenue || 0) - ((item.quantitySold || 0) * (item.unitCost || 0))) / item.totalRevenue * 100).toFixed(2) + '%'
        : '0%'
    }));

    exportToCSV(exportData, 'Inventory_Report', Object.keys(exportData[0] || {}));
  };

  // Quick date range presets
  const setDateRangePreset = (preset) => {
    const today = new Date();
    let start, end;

    switch (preset) {
      case 'today':
        start = format(today, 'yyyy-MM-dd');
        end = format(today, 'yyyy-MM-dd');
        break;
      case 'week':
        start = format(startOfWeek(today), 'yyyy-MM-dd');
        end = format(endOfWeek(today), 'yyyy-MM-dd');
        break;
      case 'month':
        start = format(startOfMonth(today), 'yyyy-MM-dd');
        end = format(endOfMonth(today), 'yyyy-MM-dd');
        break;
      case 'lastMonth':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        start = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
        end = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
        break;
      case 'last7days':
        start = format(subDays(today, 7), 'yyyy-MM-dd');
        end = format(today, 'yyyy-MM-dd');
        break;
      case 'last30days':
        start = format(subDays(today, 30), 'yyyy-MM-dd');
        end = format(today, 'yyyy-MM-dd');
        break;
      case 'year':
        start = format(new Date(today.getFullYear(), 0, 1), 'yyyy-MM-dd');
        end = format(new Date(today.getFullYear(), 11, 31), 'yyyy-MM-dd');
        break;
      default:
        return;
    }

    setDateRange({ start, end });
  };

  if (loading && !transactions.length) {
    return (
      
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-[#160B53]" />
        <span className="ml-2 text-gray-600">Loading reports...</span>
      </div>
      
    );
  }

  return (
    
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">Comprehensive salon operations reports and analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadAllData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print Report
          </Button>
          <Button variant="outline" onClick={() => {
            if (reportType === 'transactions') exportTransactions();
            else if (reportType === 'appointments') exportAppointments();
            else if (reportType === 'inventory') exportInventory();
            else {
                // Export overview
              exportTransactions();
            }
          }}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card className="p-6">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="text-sm font-medium text-gray-700">Date Range:</label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDateRangePreset('today')}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDateRangePreset('week')}
            >
              This Week
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDateRangePreset('month')}
            >
              This Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDateRangePreset('last7days')}
            >
              Last 7 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDateRangePreset('last30days')}
            >
              Last 30 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDateRangePreset('year')}
            >
              This Year
            </Button>
          </div>
          <Input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="w-40"
          />
          <span className="text-gray-500">to</span>
          <Input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="w-40"
          />
          <Button onClick={loadAllData} variant="outline">
            Apply
          </Button>
        </div>
      </Card>

      {/* Report Type Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'revenue', label: 'Revenue', icon: Banknote },
          { id: 'transactions', label: 'Transactions', icon: Receipt },
          { id: 'appointments', label: 'Appointments', icon: Calendar },
          { id: 'inventory', label: 'Inventory', icon: Package },
          { id: 'staff', label: 'Staff', icon: Users }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              reportType === tab.id
                ? 'border-[#160B53] text-[#160B53] font-semibold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Print Content */}
      <div ref={printRef} className="hidden">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              {branchInfo?.name || 'Salon'} - Operations Report
            </h1>
            <p className="text-gray-600 mt-2">
              {format(parseISO(dateRange.start), 'MMMM dd, yyyy')} - {format(parseISO(dateRange.end), 'MMMM dd, yyyy')}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Generated on {format(new Date(), 'MMMM dd, yyyy HH:mm')}
            </p>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="border p-4">
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold">₱{summaryStats.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="border p-4">
              <p className="text-sm text-gray-600">Transactions</p>
              <p className="text-2xl font-bold">{summaryStats.totalTransactions}</p>
            </div>
            <div className="border p-4">
              <p className="text-sm text-gray-600">Appointments</p>
              <p className="text-2xl font-bold">{summaryStats.totalAppointments}</p>
            </div>
            <div className="border p-4">
              <p className="text-sm text-gray-600">Products Sold</p>
              <p className="text-2xl font-bold">{summaryStats.totalProductsSold}</p>
            </div>
          </div>

          {/* Detailed sections would go here */}
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Transaction Summary</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">Date</th>
                  <th className="border border-gray-300 p-2 text-left">Client</th>
                  <th className="border border-gray-300 p-2 text-left">Type</th>
                  <th className="border border-gray-300 p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions
                  .filter(t => t.status === 'paid' || t.status === 'completed')
                  .slice(0, 50)
                  .map(t => (
                    <tr key={t.id}>
                      <td className="border border-gray-300 p-2">
                        {t.createdAt ? format(t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt), 'MMM dd, yyyy') : 'N/A'}
                      </td>
                      <td className="border border-gray-300 p-2">
                        {t.clientInfo?.name || t.clientName || 'N/A'}
                      </td>
                      <td className="border border-gray-300 p-2">
                        {t.transactionType || t.type || 'N/A'}
                      </td>
                      <td className="border border-gray-300 p-2 text-right">
                        ₱{(t.total || t.totalAmount || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Overview Report */}
      {reportType === 'overview' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    ₱{summaryStats.totalRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {summaryStats.avgTransactionValue > 0 && `Avg: ₱${summaryStats.avgTransactionValue.toFixed(2)}`}
                  </p>
                </div>
                <Banknote className="h-12 w-12 text-green-600" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Service Revenue</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    ₱{summaryStats.serviceRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {summaryStats.totalRevenue > 0 && 
                      `${((summaryStats.serviceRevenue / summaryStats.totalRevenue) * 100).toFixed(1)}% of total`
                    }
                  </p>
                </div>
                <Scissors className="h-12 w-12 text-blue-600" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Product Revenue</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    ₱{summaryStats.productRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {summaryStats.totalRevenue > 0 && 
                      `${((summaryStats.productRevenue / summaryStats.totalRevenue) * 100).toFixed(1)}% of total`
                    }
                  </p>
                </div>
                <Package className="h-12 w-12 text-purple-600" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {summaryStats.totalTransactions}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Completed transactions
                  </p>
                </div>
                <FileText className="h-12 w-12 text-orange-600" />
              </div>
            </Card>
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Appointments</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {summaryStats.totalAppointments}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {summaryStats.completedAppointments} completed, {summaryStats.cancelledAppointments} cancelled
                  </p>
                </div>
                <Calendar className="h-10 w-10 text-indigo-600" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Products Sold</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {summaryStats.totalProductsSold}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Units sold
                  </p>
                </div>
                <ShoppingCart className="h-10 w-10 text-pink-600" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Staff</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {summaryStats.activeStaff}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Total staff members
                  </p>
                </div>
                <Users className="h-10 w-10 text-teal-600" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Clients</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {summaryStats.totalClients}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Registered clients
                  </p>
                </div>
                <Users className="h-10 w-10 text-cyan-600" />
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Revenue Report */}
      {reportType === 'revenue' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Revenue Breakdown</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setYearlyView(!yearlyView)}
                className="flex items-center gap-2"
              >
                {yearlyView ? 'Show Period View' : 'Show Yearly View'}
              </Button>
            </div>
              
            {!yearlyView ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">
                    ₱{summaryStats.totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Service Revenue</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">
                    ₱{summaryStats.serviceRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">Product Revenue</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">
                    ₱{summaryStats.productRevenue.toLocaleString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.keys(summaryStats.yearlyRevenue || {}).sort().reverse().map(year => {
                  const yearData = summaryStats.yearlyRevenue[year];
                  const months = Object.keys(yearData.months).sort();
                    
                  return (
                    <div key={year} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900">{year}</h3>
                        <div className="flex gap-4">
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="text-xl font-bold text-gray-900">
                              ₱{yearData.total.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Service</p>
                            <p className="text-lg font-semibold text-blue-600">
                              ₱{yearData.service.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Product</p>
                            <p className="text-lg font-semibold text-purple-600">
                              ₱{yearData.product.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                        
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                        {months.map(monthKey => {
                          const monthData = yearData.months[monthKey];
                          return (
                            <div key={monthKey} className="border border-gray-200 rounded-lg p-4">
                              <p className="font-semibold text-gray-900 mb-2">{monthData.monthName}</p>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-sm text-gray-600">Total:</span>
                                  <span className="text-sm font-semibold text-gray-900">
                                    ₱{monthData.total.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-gray-600">Service:</span>
                                  <span className="text-sm font-semibold text-blue-600">
                                    ₱{monthData.service.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-gray-600">Product:</span>
                                  <span className="text-sm font-semibold text-purple-600">
                                    ₱{monthData.product.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                  
                {Object.keys(summaryStats.yearlyRevenue || {}).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No revenue data available for the selected period
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Transactions Report */}
      {reportType === 'transactions' && (
        <Card className="overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold">Transaction Details</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions
                  .filter(t => t.status === 'paid' || t.status === 'completed')
                  .slice(0, 100)
                  .map(transaction => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.createdAt 
                          ? format(transaction.createdAt.toDate ? transaction.createdAt.toDate() : new Date(transaction.createdAt), 'MMM dd, yyyy HH:mm')
                          : 'N/A'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {transaction.id || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.clientInfo?.name || transaction.clientName || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.transactionType || transaction.type || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ₱{(transaction.total || transaction.totalAmount || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          transaction.status === 'paid' || transaction.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {transaction.status || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Appointments Report */}
      {reportType === 'appointments' && (
        <Card className="overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold">Appointment Details</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Services
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {appointments.slice(0, 100).map(appointment => (
                  <tr key={appointment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {appointment.appointmentDate 
                        ? format(appointment.appointmentDate.toDate ? appointment.appointmentDate.toDate() : new Date(appointment.appointmentDate), 'MMM dd, yyyy')
                        : 'N/A'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {appointment.appointmentTime || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {appointment.clientId || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(appointment.serviceIds || []).join(', ') || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        appointment.status === 'completed' || appointment.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : appointment.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {appointment.status || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Inventory Report */}
      {reportType === 'inventory' && (
        <Card className="overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold">Inventory Sales Report</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity Sold
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Profit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Margin
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inventoryData.slice(0, 100).map((item, index) => {
                  const profit = (item.totalRevenue || 0) - ((item.quantitySold || 0) * (item.unitCost || 0));
                  const margin = (item.totalRevenue || 0) > 0 
                    ? (profit / item.totalRevenue) * 100 
                    : 0;
                  return (
                    <tr key={item.productId || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.productName || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.quantitySold || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₱{(item.totalRevenue || 0).toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                        profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ₱{profit.toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                        margin >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {margin.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Staff Report */}
      {reportType === 'staff' && (
        <Card className="overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold">Staff Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {staffData.map(staff => (
                  <tr key={staff.uid || staff.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {`${staff.firstName || ''} ${staff.lastName || ''}`.trim() || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {staff.roles?.[0] || staff.role || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {staff.email || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {staff.phone || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        staff.isActive !== false
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {staff.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {error && (
        <Card className="p-6 border-l-4 border-red-400 bg-red-50">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </Card>
      )}
    </div>
    
  );
};

export default Reports;

