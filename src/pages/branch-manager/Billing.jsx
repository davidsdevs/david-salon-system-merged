/**
 * Billing Management Page - Branch Manager
 * View all bills, void transactions, and view reports
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Banknote, Calendar, Receipt, Eye, RefreshCw, XCircle, Download, Printer, User, CheckCircle, FileSearch, AlertCircle, CheckCircle2, Upload, FileText, BarChart3, X, Filter, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getBillsByBranch,
  getDailySalesSummary,
  voidBill,
  getBillingLogs,
  BILL_STATUS,
  PAYMENT_METHODS,
  createBill
} from '../../services/billingService';
import { getBranchById } from '../../services/branchService';
import { getUsersByRole } from '../../services/userService';
import { USER_ROLES } from '../../utils/constants';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import ReceiptComponent from '../../components/billing/Receipt';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { exportToExcel } from '../../utils/excelExport';
import { formatDate, formatTime } from '../../utils/helpers';

const BranchManagerBilling = () => {
  const { currentUser, userBranch, userBranchData, userData } = useAuth();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [minAmountFilter, setMinAmountFilter] = useState('');
  const [maxAmountFilter, setMaxAmountFilter] = useState('');
  const [cashierFilter, setCashierFilter] = useState('all');
  const [receiptNumberFilter, setReceiptNumberFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortColumn, setSortColumn] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [dailySummary, setDailySummary] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [billLogs, setBillLogs] = useState([]);
  const [branchData, setBranchData] = useState(null);
  const [cashiers, setCashiers] = useState([]);
  
  // Modals
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [witnessEmail, setWitnessEmail] = useState('');
  const [witnessPassword, setWitnessPassword] = useState('');
  const [verifyingWitness, setVerifyingWitness] = useState(false);
  const [witnessVerified, setWitnessVerified] = useState(false);
  const [witnessInfo, setWitnessInfo] = useState(null);
  
  // Receipt number checker - Advanced
  const [showReceiptChecker, setShowReceiptChecker] = useState(false);
  const [receiptSearchNumber, setReceiptSearchNumber] = useState('');
  const [receiptCheckResults, setReceiptCheckResults] = useState([]);
  const [checkingReceipt, setCheckingReceipt] = useState(false);
  
  // Advanced batch checking
  const [checkMode, setCheckMode] = useState('single'); // 'single', 'batch', 'file'
  const [batchReceiptNumbers, setBatchReceiptNumbers] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [batchResults, setBatchResults] = useState(null); // { found: [], notFound: [], duplicates: [] }
  const [checkStats, setCheckStats] = useState(null);

  // Receipt printing
  const receiptRef = useRef();
  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  });

  useEffect(() => {
    if (userBranch) {
      fetchData();
      fetchBranchData();
      fetchCashiers();
    }
  }, [userBranch]);

  // Fetch cashiers for filter
  const fetchCashiers = async () => {
    try {
      const receptionists = await getUsersByRole(USER_ROLES.RECEPTIONIST);
      const branchManagers = await getUsersByRole(USER_ROLES.BRANCH_MANAGER);
      const allCashiers = [...receptionists, ...branchManagers]
        .filter(user => user.isActive && (user.branchId === userBranch || !user.branchId))
        .map(user => ({
          id: user.id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
        }));
      setCashiers(allCashiers);
    } catch (error) {
      console.error('Error fetching cashiers:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const billsData = await getBillsByBranch(userBranch);
      setBills(billsData);

      const summary = await getDailySalesSummary(userBranch);
      setDailySummary(summary);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranchData = async () => {
    try {
      const data = await getBranchById(userBranch);
      setBranchData(data);
    } catch (error) {
      console.error('Error fetching branch data:', error);
    }
  };

  // Filter bills
  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      // Search filter
    if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          bill.clientName?.toLowerCase().includes(searchLower) ||
        bill.clientPhone?.includes(searchTerm) ||
          bill.id?.includes(searchTerm) ||
          bill.receiptNumber?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && bill.status !== statusFilter) {
        return false;
      }

      // Payment method filter
      if (paymentMethodFilter !== 'all' && bill.paymentMethod !== paymentMethodFilter) {
        return false;
      }

      // Receipt number filter
      if (receiptNumberFilter) {
        if (!bill.receiptNumber || !bill.receiptNumber.toLowerCase().includes(receiptNumberFilter.toLowerCase())) {
          return false;
        }
      }

      // Cashier filter
      if (cashierFilter !== 'all' && bill.createdBy !== cashierFilter) {
        return false;
      }

      // Date range filters
      if (startDateFilter) {
        const billDate = bill.createdAt ? new Date(bill.createdAt) : new Date();
        const filterDate = new Date(startDateFilter);
        filterDate.setHours(0, 0, 0, 0);
        if (billDate < filterDate) return false;
      }

      if (endDateFilter) {
        const billDate = bill.createdAt ? new Date(bill.createdAt) : new Date();
        const filterDate = new Date(endDateFilter);
        filterDate.setHours(23, 59, 59, 999);
        if (billDate > filterDate) return false;
      }

      // Amount filters
      const billTotal = bill.total || 0;
      if (minAmountFilter && billTotal < parseFloat(minAmountFilter)) {
        return false;
      }

      if (maxAmountFilter && billTotal > parseFloat(maxAmountFilter)) {
        return false;
      }

      return true;
    });
  }, [bills, searchTerm, statusFilter, paymentMethodFilter, startDateFilter, endDateFilter, minAmountFilter, maxAmountFilter, cashierFilter, receiptNumberFilter]);

  // Sort bills
  const sortedBills = useMemo(() => {
    const sorted = [...filteredBills];
    
    sorted.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortColumn) {
        case 'clientName':
          aValue = a.clientName || '';
          bValue = b.clientName || '';
          break;
        case 'createdAt':
          aValue = a.createdAt ? new Date(a.createdAt) : new Date(0);
          bValue = b.createdAt ? new Date(b.createdAt) : new Date(0);
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'total':
          aValue = a.total || 0;
          bValue = b.total || 0;
          break;
        case 'paymentMethod':
          aValue = a.paymentMethod || '';
          bValue = b.paymentMethod || '';
          break;
        case 'receiptNumber':
          aValue = a.receiptNumber || '';
          bValue = b.receiptNumber || '';
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [filteredBills, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedBills.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBills = sortedBills.slice(startIndex, endIndex);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPaymentMethodFilter('all');
    setStartDateFilter('');
    setEndDateFilter('');
    setMinAmountFilter('');
    setMaxAmountFilter('');
    setCashierFilter('all');
    setReceiptNumberFilter('');
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    if (!sortedBills.length) {
      toast.error('No bills to export');
      return;
    }

    try {
      const branchName = branchData?.name || branchData?.branchName || userBranchData?.name || userBranchData?.branchName || 'Branch';
      const sanitizedBranchName = branchName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const dateStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
      
      // Build filter suffix for filename
      const filterParts = [];
      if (statusFilter !== 'all') filterParts.push(`status-${statusFilter}`);
      if (paymentMethodFilter !== 'all') filterParts.push(`payment-${paymentMethodFilter}`);
      if (startDateFilter) filterParts.push(`from-${startDateFilter}`);
      if (endDateFilter) filterParts.push(`to-${endDateFilter}`);
      const filterSuffix = filterParts.length > 0 ? `_${filterParts.join('_')}` : '';
      
      // Generate formatted filename
      const filename = `bills_${sanitizedBranchName}_${dateStr}_${timeStr}${filterSuffix}.csv`;
      
      // CSV Headers
      const headers = [
        'Bill ID',
        'Receipt #',
        'Date',
        'Time',
        'Client Name',
        'Client Phone',
        'Client Email',
        'Payment Method',
        'Subtotal (₱)',
        'Discount (₱)',
        'Tax (₱)',
        'Total Amount (₱)',
        'Items Count',
        'Status',
        'Cashier',
        'Notes'
      ];
      
      // Format bills data
      const csvRows = [headers.join(',')];
      
      sortedBills.forEach(bill => {
        const billDate = bill.createdAt ? new Date(bill.createdAt) : new Date();
        const dateStr = formatDate(billDate, 'MMM dd, yyyy');
        const timeStr = formatTime(billDate);
        const itemsCount = bill.items ? bill.items.length : 0;
        
        // Escape values that contain commas
        const escapeCSV = (value) => {
          if (value === null || value === undefined) return '';
          const str = String(value);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        
        const row = [
          escapeCSV(bill.id || ''),
          escapeCSV(bill.receiptNumber || 'N/A'),
          escapeCSV(dateStr),
          escapeCSV(timeStr),
          escapeCSV(bill.clientName || 'Walk-in'),
          escapeCSV(bill.clientPhone || ''),
          escapeCSV(bill.client?.email || ''),
          escapeCSV(getPaymentMethodLabel(bill.paymentMethod)),
          escapeCSV((bill.subtotal || 0).toFixed(2)),
          escapeCSV((bill.discount || 0).toFixed(2)),
          escapeCSV((bill.tax || 0).toFixed(2)),
          escapeCSV((bill.total || 0).toFixed(2)),
          escapeCSV(itemsCount),
          escapeCSV(bill.status || 'pending'),
          escapeCSV(bill.createdByName || 'Unknown'),
          escapeCSV(bill.notes || '')
        ];
        
        csvRows.push(row.join(','));
      });
      
      // Create CSV content
      const csvContent = csvRows.join('\n');
      
      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Exported ${sortedBills.length} bills to CSV`);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV file');
    }
  };

  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          toast.error('CSV file must have at least a header row and one data row');
          return;
        }

        // Parse headers
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        // Find column indices
        const fieldMap = {};
        headers.forEach((header, index) => {
          const headerLower = header.toLowerCase();
          if (headerLower.includes('receipt') && headerLower.includes('#')) fieldMap.receiptNumber = index;
          if (headerLower.includes('date')) fieldMap.date = index;
          if (headerLower.includes('time')) fieldMap.time = index;
          if (headerLower.includes('client') && headerLower.includes('name')) fieldMap.clientName = index;
          if (headerLower.includes('client') && headerLower.includes('phone')) fieldMap.clientPhone = index;
          if (headerLower.includes('client') && headerLower.includes('email')) fieldMap.clientEmail = index;
          if (headerLower.includes('payment') && headerLower.includes('method')) fieldMap.paymentMethod = index;
          if (headerLower.includes('subtotal')) fieldMap.subtotal = index;
          if (headerLower.includes('discount')) fieldMap.discount = index;
          if (headerLower.includes('tax')) fieldMap.tax = index;
          if (headerLower.includes('total') && !headerLower.includes('sub')) fieldMap.total = index;
          if (headerLower.includes('status')) fieldMap.status = index;
          if (headerLower.includes('notes')) fieldMap.notes = index;
        });

        // Validate required fields
        if (fieldMap.clientName === undefined || fieldMap.total === undefined) {
          toast.error('CSV must contain Client Name and Total Amount columns');
          return;
        }

        // Parse data rows
        const importData = [];
        let successCount = 0;
        let errorCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
          const cleanValues = values.map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

          try {
            const clientName = cleanValues[fieldMap.clientName]?.trim();
            const totalStr = cleanValues[fieldMap.total]?.replace(/[₱,]/g, '').trim();
            const total = parseFloat(totalStr) || 0;

            if (!clientName || total <= 0) {
              errorCount++;
              continue;
            }

            // Parse payment method
            let paymentMethod = PAYMENT_METHODS.CASH;
            if (fieldMap.paymentMethod !== undefined) {
              const pmStr = cleanValues[fieldMap.paymentMethod]?.toLowerCase().trim();
              if (pmStr.includes('card')) paymentMethod = PAYMENT_METHODS.CARD;
              else if (pmStr.includes('voucher')) paymentMethod = PAYMENT_METHODS.VOUCHER;
              else if (pmStr.includes('gift')) paymentMethod = PAYMENT_METHODS.GIFT_CARD;
            }

            const billData = {
              clientName,
              clientPhone: cleanValues[fieldMap.clientPhone] || '',
              receiptNumber: cleanValues[fieldMap.receiptNumber] || null,
              subtotal: parseFloat(cleanValues[fieldMap.subtotal]?.replace(/[₱,]/g, '') || total),
              discount: parseFloat(cleanValues[fieldMap.discount]?.replace(/[₱,]/g, '') || 0),
              tax: parseFloat(cleanValues[fieldMap.tax]?.replace(/[₱,]/g, '') || 0),
              total,
              paymentMethod,
              notes: cleanValues[fieldMap.notes] || '',
              branchId: userBranch,
              branchName: userBranchData?.name || '',
              items: [{ type: 'service', name: 'Imported Item', price: total, quantity: 1 }]
              // Note: createBill will set createdAt automatically to Timestamp.now()
            };

            importData.push(billData);
            successCount++;
          } catch (error) {
            console.error(`Error parsing row ${i + 1}:`, error);
            errorCount++;
          }
        }

        if (importData.length === 0) {
          toast.error('No valid data rows found in CSV');
          return;
        }

        // Confirm import
        const confirmed = window.confirm(
          `Found ${successCount} valid rows and ${errorCount} errors. Import ${successCount} bills?`
        );

        if (!confirmed) return;

        // Import bills
        setProcessing(true);
        let imported = 0;
        for (const billData of importData) {
          try {
            await createBill(billData, currentUser);
            imported++;
          } catch (error) {
            console.error('Error importing bill:', error);
          }
        }

        setProcessing(false);
        toast.success(`Successfully imported ${imported} of ${importData.length} bills`);
        await fetchData();
      } catch (error) {
        console.error('Error importing CSV:', error);
        toast.error('Failed to import CSV file: ' + (error.message || 'Unknown error'));
      }
    };
    input.click();
  };

  const handlePrintReport = () => {
    try {
      // Try multiple sources for branch name
      const branchName = branchData?.name || 
                        branchData?.branchName || 
                        sortedBills[0]?.branchName ||
                        userBranchData?.name || 
                        userBranchData?.branchName || 
                        'Branch';
      const generatedAt = new Date().toLocaleString();
      
      // Build filter description
      const activeFilters = [];
      if (searchTerm) activeFilters.push(`Search: ${searchTerm}`);
      if (statusFilter !== 'all') activeFilters.push(`Status: ${statusFilter}`);
      if (paymentMethodFilter !== 'all') activeFilters.push(`Payment: ${getPaymentMethodLabel(paymentMethodFilter)}`);
      if (cashierFilter !== 'all') {
        const cashier = cashiers.find(c => c.id === cashierFilter);
        if (cashier) activeFilters.push(`Cashier: ${cashier.name}`);
      }
      if (startDateFilter) activeFilters.push(`From: ${startDateFilter}`);
      if (endDateFilter) activeFilters.push(`To: ${endDateFilter}`);
      if (minAmountFilter || maxAmountFilter) {
        activeFilters.push(`Amount: ₱${minAmountFilter || '0'} - ${maxAmountFilter ? `₱${maxAmountFilter}` : 'Unlimited'}`);
      }
      if (receiptNumberFilter) activeFilters.push(`Receipt: ${receiptNumberFilter}`);
      
      // Calculate summary
      const totalBills = sortedBills.length;
      const paidBills = sortedBills.filter(b => b.status === BILL_STATUS.PAID).length;
      const voidedBills = sortedBills.filter(b => b.status === BILL_STATUS.VOIDED).length;
      const refundedBills = sortedBills.filter(b => b.status === BILL_STATUS.REFUNDED).length;
      const totalRevenue = sortedBills.reduce((sum, bill) => sum + (bill.total || 0), 0);
      const totalDiscounts = sortedBills.reduce((sum, bill) => sum + (bill.discount || 0), 0);
      const totalTax = sortedBills.reduce((sum, bill) => sum + (bill.tax || 0), 0);
      
      // Payment method breakdown
      const paymentBreakdown = {};
      sortedBills.forEach(bill => {
        const method = bill.paymentMethod || 'unknown';
        paymentBreakdown[method] = (paymentBreakdown[method] || 0) + (bill.total || 0);
      });
      
      // Generate HTML report
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Billing Report - ${branchName}</title>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @media print {
              @page { size: A4; margin: 1cm; }
              body { font-family: 'Poppins', sans-serif; }
              .header { margin-bottom: 20px; }
              .summary { page-break-inside: avoid; }
              .table { page-break-inside: avoid; }
            }
            body { font-family: 'Poppins', sans-serif; margin: 0; padding: 20px; color: #333; }
            .header { border-bottom: 3px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
            .header h1 { font-size: 28px; font-weight: bold; margin: 0 0 5px 0; }
            .header h2 { font-size: 20px; font-weight: 600; margin: 0 0 10px 0; color: #666; }
            .header p { margin: 5px 0; font-size: 12px; color: #666; }
            .filters { background: #f5f5f5; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
            .filters p { margin: 5px 0; font-size: 12px; }
            .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
            .summary-card { background: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid #007bff; }
            .summary-card h3 { margin: 0 0 5px 0; font-size: 12px; color: #666; text-transform: uppercase; }
            .summary-card p { margin: 0; font-size: 24px; font-weight: bold; color: #333; }
            .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .table th, .table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; font-size: 11px; }
            .table th { background: #f5f5f5; font-weight: 600; text-transform: uppercase; }
            .table tr:hover { background: #f9f9f9; }
            .footer { margin-top: 30px; padding-top: 15px; border-top: 2px solid #333; text-align: center; font-size: 12px; color: #666; }
            .text-right { text-align: right; }
            .badge { padding: 3px 8px; border-radius: 3px; font-size: 10px; font-weight: 600; }
            .badge-paid { background: #d4edda; color: #155724; }
            .badge-voided { background: #f8d7da; color: #721c24; }
            .badge-refunded { background: #fff3cd; color: #856404; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Billing Report</h1>
            <h2>${branchName}</h2>
            <p>Generated: ${generatedAt}</p>
          </div>
          
          ${activeFilters.length > 0 ? `
          <div class="filters">
            <p><strong>Active Filters:</strong> ${activeFilters.join(' | ')}</p>
          </div>
          ` : ''}
          
          <div class="summary">
            <div class="summary-card">
              <h3>Total Bills</h3>
              <p>${totalBills}</p>
            </div>
            <div class="summary-card">
              <h3>Total Revenue</h3>
              <p>₱${totalRevenue.toFixed(2)}</p>
            </div>
            <div class="summary-card">
              <h3>Total Discounts</h3>
              <p>₱${totalDiscounts.toFixed(2)}</p>
            </div>
            <div class="summary-card">
              <h3>Paid</h3>
              <p>${paidBills}</p>
            </div>
            <div class="summary-card">
              <h3>Voided</h3>
              <p>${voidedBills}</p>
            </div>
            <div class="summary-card">
              <h3>Refunded</h3>
              <p>${refundedBills}</p>
            </div>
          </div>
          
          <div class="summary">
            <div class="summary-card">
              <h3>Cash Payments</h3>
              <p>₱${(paymentBreakdown.cash || 0).toFixed(2)}</p>
            </div>
            <div class="summary-card">
              <h3>Card Payments</h3>
              <p>₱${(paymentBreakdown.card || 0).toFixed(2)}</p>
            </div>
            <div class="summary-card">
              <h3>Other Payments</h3>
              <p>₱${((paymentBreakdown.voucher || 0) + (paymentBreakdown.gift_card || 0)).toFixed(2)}</p>
            </div>
          </div>
          
          <table class="table">
            <thead>
              <tr>
                <th>Bill ID</th>
                <th>Receipt #</th>
                <th>Date</th>
                <th>Client</th>
                <th>Payment Method</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Cashier</th>
              </tr>
            </thead>
            <tbody>
              ${sortedBills.map(bill => {
                const billDate = bill.createdAt ? new Date(bill.createdAt) : new Date();
                const dateStr = formatDate(billDate, 'MMM dd, yyyy');
                const statusClass = bill.status === BILL_STATUS.PAID ? 'badge-paid' : 
                                   bill.status === BILL_STATUS.VOIDED ? 'badge-voided' : 'badge-refunded';
                return `
                  <tr>
                    <td>#${bill.id.slice(-8)}</td>
                    <td>${bill.receiptNumber || 'N/A'}</td>
                    <td>${dateStr}</td>
                    <td>${bill.clientName || 'Walk-in'}</td>
                    <td>${getPaymentMethodLabel(bill.paymentMethod)}</td>
                    <td class="text-right">₱${(bill.total || 0).toFixed(2)}</td>
                    <td><span class="badge ${statusClass}">${bill.status}</span></td>
                    <td>${bill.createdByName || 'Unknown'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            <p>Total Records: ${sortedBills.length} | Generated on ${generatedAt}</p>
          </div>
        </body>
        </html>
      `);
      
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error) {
      console.error('Error generating print report:', error);
      toast.error('Failed to generate print report');
    }
  };

  const handleViewDetails = async (bill) => {
    setSelectedBill(bill);
    setShowDetailsModal(true);
    
    // Fetch logs for this bill
    const logs = await getBillingLogs(bill.id);
    setBillLogs(logs);
  };

  const handleVoidClick = (bill) => {
    setSelectedBill(bill);
    setVoidReason('');
    setWitnessEmail('');
    setWitnessPassword('');
    setWitnessVerified(false);
    setWitnessInfo(null);
    setShowVoidModal(true);
  };

  // Verify witness before voiding
  const verifyWitness = async () => {
    if (!witnessEmail.trim()) {
      toast.error('Please enter witness email');
      return;
    }
    if (!witnessPassword.trim()) {
      toast.error('Please enter witness password');
      return;
    }

    try {
      setVerifyingWitness(true);
      
      // Import services
      const { getUserByEmail } = await import('../../services/userService');
      const { verifyRolePassword } = await import('../../services/rolePasswordService');
      
      // Get witness user by email
      const witnessUser = await getUserByEmail(witnessEmail.trim());
      
      if (!witnessUser) {
        toast.error('Witness not found. Please check the email address.');
        return;
      }

      if (!witnessUser.isActive) {
        toast.error('Witness account is inactive');
        return;
      }

      // Verify witness password (check all their roles)
      const { getUserRoles } = await import('../../utils/helpers');
      const witnessRoles = getUserRoles(witnessUser);
      
      let passwordValid = false;
      for (const role of witnessRoles) {
        const isValid = await verifyRolePassword(witnessUser.id, role, witnessPassword);
        if (isValid) {
          passwordValid = true;
          break;
        }
      }

      if (!passwordValid) {
        toast.error('Invalid witness password');
        return;
      }

      // Witness verified
      setWitnessVerified(true);
      setWitnessInfo({
        id: witnessUser.id,
        email: witnessUser.email,
        name: `${witnessUser.firstName || ''} ${witnessUser.lastName || ''}`.trim() || witnessUser.email
      });
      toast.success('Witness verified successfully');
    } catch (error) {
      console.error('Error verifying witness:', error);
      toast.error('Failed to verify witness: ' + (error.message || 'Unknown error'));
    } finally {
      setVerifyingWitness(false);
    }
  };

  const confirmVoid = async () => {
    if (!voidReason.trim()) {
      toast.error('Please provide a reason for voiding the transaction');
      return;
    }

    if (!witnessVerified || !witnessInfo) {
      toast.error('Please verify witness before voiding');
      return;
    }

    try {
      setProcessing(true);
      // Combine currentUser (has uid) with userData (has firstName, lastName)
      const userForBilling = {
        ...currentUser,
        ...userData,
        uid: currentUser.uid
      };
      await voidBill(selectedBill.id, voidReason, userForBilling, witnessInfo);
      
      setShowVoidModal(false);
      setSelectedBill(null);
      setVoidReason('');
      setWitnessEmail('');
      setWitnessPassword('');
      setWitnessVerified(false);
      setWitnessInfo(null);
      await fetchData();
    } catch (error) {
      console.error('Error voiding bill:', error);
    } finally {
      setProcessing(false);
    }
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

  // Parse receipt numbers from various formats
  const parseReceiptNumbers = (input) => {
    if (!input || !input.trim()) return [];
    
    // Split by newlines, commas, tabs, or semicolons
    const numbers = input
      .split(/[\n\r,;\t]+/)
      .map(num => num.trim().toUpperCase())
      .filter(num => num.length > 0);
    
    return [...new Set(numbers)]; // Remove duplicates
  };

  // Check single receipt number
  const handleCheckReceipt = async () => {
    if (!receiptSearchNumber.trim()) {
      toast.error('Please enter a receipt number');
      return;
    }

    try {
      setCheckingReceipt(true);
      const searchNumber = receiptSearchNumber.trim().toUpperCase();
      
      // Search for bills with matching receipt number
      const matchingBills = bills.filter(bill => 
        bill.receiptNumber && bill.receiptNumber.toUpperCase() === searchNumber
      );

      setReceiptCheckResults(matchingBills);
      
      if (matchingBills.length === 0) {
        toast.error(`No transaction found with receipt number: ${searchNumber}`);
      } else {
        toast.success(`Found ${matchingBills.length} transaction(s) with receipt number: ${searchNumber}`);
      }
    } catch (error) {
      console.error('Error checking receipt:', error);
      toast.error('Failed to check receipt number');
    } finally {
      setCheckingReceipt(false);
    }
  };

  // Advanced batch checking
  const handleBatchCheck = async () => {
    const receiptNumbers = parseReceiptNumbers(batchReceiptNumbers);
    
    if (receiptNumbers.length === 0) {
      toast.error('Please enter at least one receipt number');
      return;
    }

    if (receiptNumbers.length > 1000) {
      toast.error('Maximum 1000 receipt numbers allowed at once');
      return;
    }

    try {
      setCheckingReceipt(true);
      
      const found = [];
      const notFound = [];
      const receiptMap = new Map(); // Track duplicates
      
      // Create a map of all bills by receipt number for quick lookup
      const billsByReceipt = new Map();
      bills.forEach(bill => {
        if (bill.receiptNumber) {
          const receiptNum = bill.receiptNumber.toUpperCase();
          if (!billsByReceipt.has(receiptNum)) {
            billsByReceipt.set(receiptNum, []);
          }
          billsByReceipt.get(receiptNum).push(bill);
        }
      });

      // Check each receipt number
      receiptNumbers.forEach(receiptNum => {
        const matchingBills = billsByReceipt.get(receiptNum) || [];
        
        if (matchingBills.length > 0) {
          matchingBills.forEach(bill => {
            found.push({
              receiptNumber: receiptNum,
              bill: bill,
              isDuplicate: receiptMap.has(receiptNum)
            });
            receiptMap.set(receiptNum, true);
          });
        } else {
          notFound.push(receiptNum);
        }
      });

      // Calculate statistics
      const stats = {
        totalChecked: receiptNumbers.length,
        found: found.length,
        notFound: notFound.length,
        uniqueFound: new Set(found.map(f => f.receiptNumber)).size,
        totalAmount: found.reduce((sum, f) => sum + (f.bill.total || 0), 0),
        duplicates: found.filter(f => f.isDuplicate).length
      };

      setBatchResults({ found, notFound, duplicates: [] });
      setCheckStats(stats);
      setReceiptCheckResults(found.map(f => f.bill));

      toast.success(
        `Checked ${stats.totalChecked} receipts: ${stats.uniqueFound} found, ${stats.notFound} not found`
      );
    } catch (error) {
      console.error('Error in batch check:', error);
      toast.error('Failed to check receipts');
    } finally {
      setCheckingReceipt(false);
    }
  };

  // Handle file upload for bulk checking
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['text/plain', 'text/csv', 'application/vnd.ms-excel', 'text/comma-separated-values'];
    const validExtensions = ['.txt', '.csv'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      toast.error('Please upload a .txt or .csv file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error('File size must be less than 5MB');
      return;
    }

    try {
      setCheckingReceipt(true);
      setUploadedFile(file);
      
      // Read file content
      const text = await file.text();
      
      // Parse receipt numbers
      const receiptNumbers = parseReceiptNumbers(text);
      
      if (receiptNumbers.length === 0) {
        toast.error('No receipt numbers found in file');
        setUploadedFile(null);
        return;
      }

      // Show preview
      setFilePreview({
        fileName: file.name,
        receiptCount: receiptNumbers.length,
        preview: receiptNumbers.slice(0, 10).join(', ') + (receiptNumbers.length > 10 ? '...' : '')
      });

      // Auto-check the uploaded receipts
      setBatchReceiptNumbers(receiptNumbers.join('\n'));
      
      toast.success(`Loaded ${receiptNumbers.length} receipt numbers from file`);
    } catch (error) {
      console.error('Error reading file:', error);
      toast.error('Failed to read file');
      setUploadedFile(null);
    } finally {
      setCheckingReceipt(false);
    }
  };

  // Export batch results to CSV
  const exportBatchResults = () => {
    if (!batchResults || !checkStats) return;

    const rows = [];
    
    // Header
    rows.push('Receipt Number,Status,Bill ID,Date,Client,Amount,Payment Method,Status');
    
    // Found receipts
    batchResults.found.forEach(({ receiptNumber, bill }) => {
      rows.push([
        receiptNumber,
        'Found',
        bill.id.slice(-8),
        bill.createdAt?.toLocaleDateString() || '',
        bill.clientName || '',
        bill.total?.toFixed(2) || '0.00',
        getPaymentMethodLabel(bill.paymentMethod),
        bill.status
      ].join(','));
    });
    
    // Not found receipts
    batchResults.notFound.forEach(receiptNum => {
      rows.push([
        receiptNum,
        'Not Found',
        '',
        '',
        '',
        '',
        '',
        ''
      ].join(','));
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `receipt_check_results_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Results exported successfully');
  };

  // Reset receipt checker
  const resetReceiptChecker = () => {
    setCheckMode('single');
    setReceiptSearchNumber('');
    setBatchReceiptNumbers('');
    setUploadedFile(null);
    setFilePreview(null);
    setReceiptCheckResults([]);
    setBatchResults(null);
    setCheckStats(null);
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
          <h1 className="text-2xl font-bold text-gray-900">Billing Management</h1>
          <p className="text-gray-600">View transactions, void transactions, and manage billing</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handleImportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
          <button
            onClick={() => {
              resetReceiptChecker();
              setShowReceiptChecker(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FileSearch className="w-5 h-5" />
            Advanced Receipt Checker
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {dailySummary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Net Revenue</p>
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
                <p className="text-sm text-gray-600">Gross Revenue</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">₱{dailySummary.totalRevenue?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Banknote className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Discounts</p>
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
                <RefreshCw className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">Filters</span>
            {(statusFilter !== 'all' || paymentMethodFilter !== 'all' || startDateFilter || endDateFilter || 
              minAmountFilter || maxAmountFilter || cashierFilter !== 'all' || receiptNumberFilter) && (
              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                Active
              </span>
            )}
          </div>
          {showFilters ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
        </button>
        
        {showFilters && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by client, phone, bill ID..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value={BILL_STATUS.PAID}>Paid</option>
                <option value={BILL_STATUS.VOIDED}>Voided</option>
                <option value={BILL_STATUS.REFUNDED}>Refunded</option>
              </select>

              <select
                value={paymentMethodFilter}
                onChange={(e) => {
                  setPaymentMethodFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Payment Methods</option>
                <option value={PAYMENT_METHODS.CASH}>Cash</option>
                <option value={PAYMENT_METHODS.CARD}>Card</option>
                <option value={PAYMENT_METHODS.VOUCHER}>Voucher</option>
                <option value={PAYMENT_METHODS.GIFT_CARD}>Gift Card</option>
              </select>

              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => {
                  setStartDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Start Date"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />

              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => {
                  setEndDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="End Date"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />

              <input
                type="number"
                value={minAmountFilter}
                onChange={(e) => {
                  setMinAmountFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Min Amount (₱)"
                min="0"
                step="0.01"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />

              <input
                type="number"
                value={maxAmountFilter}
                onChange={(e) => {
                  setMaxAmountFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Max Amount (₱)"
                min="0"
                step="0.01"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />

              <select
                value={cashierFilter}
                onChange={(e) => {
                  setCashierFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Cashiers</option>
                {cashiers.map(cashier => (
                  <option key={cashier.id} value={cashier.id}>{cashier.name}</option>
                ))}
              </select>

              <input
                type="text"
                value={receiptNumberFilter}
                onChange={(e) => {
                  setReceiptNumberFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Receipt Number"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent uppercase"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing {filteredBills.length} of {bills.length} bills
              </p>
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {sortedBills.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No bills found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className="flex items-center gap-1">
                        Bill ID
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className="flex items-center gap-1">
                        Date
                        {sortColumn === 'createdAt' && (
                          <span className="text-primary-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('clientName')}
                    >
                      <div className="flex items-center gap-1">
                        Client
                        {sortColumn === 'clientName' && (
                          <span className="text-primary-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('paymentMethod')}
                    >
                      <div className="flex items-center gap-1">
                        Payment
                        {sortColumn === 'paymentMethod' && (
                          <span className="text-primary-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('total')}
                    >
                      <div className="flex items-center gap-1">
                        Amount
                        {sortColumn === 'total' && (
                          <span className="text-primary-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('receiptNumber')}
                    >
                      <div className="flex items-center gap-1">
                        Receipt #
                        {sortColumn === 'receiptNumber' && (
                          <span className="text-primary-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Cashier</th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-1">
                        Status
                        {sortColumn === 'status' && (
                          <span className="text-primary-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedBills.map((bill) => (
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
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm text-gray-600">{getPaymentMethodLabel(bill.paymentMethod)}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-semibold text-gray-900">₱{bill.total?.toFixed(2)}</p>
                      {bill.discount > 0 && (
                        <p className="text-xs text-green-600">-₱{bill.discount?.toFixed(2)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {bill.receiptNumber ? (
                        <p className="text-sm font-mono font-medium text-blue-600">{bill.receiptNumber}</p>
                      ) : (
                        <p className="text-xs text-gray-400 italic">Not set</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm text-gray-600">{bill.createdByName}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(bill.status)}`}>
                        {bill.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewDetails(bill)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {bill.status === BILL_STATUS.PAID && (
                          <button
                            onClick={() => handleVoidClick(bill)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Void Transaction"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-700">per page</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages} ({sortedBills.length} total)
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Last
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bill Details Modal */}
      {showDetailsModal && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Bill Details</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                  >
                    <XCircle className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                {/* Receipt Preview */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div style={{ transform: 'scale(0.9)', transformOrigin: 'top left' }}>
                    <ReceiptComponent ref={receiptRef} bill={selectedBill} branch={branchData} />
                  </div>
                </div>

                {/* Logs and Details */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Transaction History</h3>
                    <div className="space-y-2">
                      {billLogs.length === 0 ? (
                        <p className="text-sm text-gray-500">No activity logs</p>
                      ) : (
                        billLogs.map((log) => (
                          <div key={log.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-gray-900 capitalize">{log.action}</span>
                              <span className="text-xs text-gray-500">
                                {log.timestamp?.toLocaleString()}
                              </span>
                            </div>
                            <p className="text-gray-600 text-xs">{log.details}</p>
                            <p className="text-gray-500 text-xs mt-1">By: {log.performedByName}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {selectedBill.status === BILL_STATUS.PAID && (
                    <div className="border-t border-gray-200 pt-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Actions</h3>
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            setShowDetailsModal(false);
                            handleVoidClick(selectedBill);
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          Void Transaction
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      <ConfirmModal
        isOpen={showVoidModal}
        onClose={() => {
          if (!processing && !verifyingWitness) {
            setShowVoidModal(false);
            setSelectedBill(null);
            setVoidReason('');
            setWitnessEmail('');
            setWitnessPassword('');
            setWitnessVerified(false);
            setWitnessInfo(null);
          }
        }}
        onConfirm={confirmVoid}
        title="Void Transaction"
        message={`Void bill #${selectedBill?.id?.slice(-8)}? This action cannot be undone.`}
        confirmText="Void Transaction"
        cancelText="Cancel"
        type="danger"
        loading={processing}
        disabled={!witnessVerified}
      >
        <div className="mt-4 space-y-4">
          {/* Witness Verification Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              Witness Verification (Required)
            </h3>
            
            {!witnessVerified ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Witness Email *
                  </label>
                  <input
                    type="email"
                    value={witnessEmail}
                    onChange={(e) => setWitnessEmail(e.target.value)}
                    disabled={verifyingWitness || processing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter witness email address"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Witness Password *
                  </label>
                  <input
                    type="password"
                    value={witnessPassword}
                    onChange={(e) => setWitnessPassword(e.target.value)}
                    disabled={verifyingWitness || processing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Enter witness password"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={verifyWitness}
                  disabled={verifyingWitness || !witnessEmail.trim() || !witnessPassword.trim() || processing}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {verifyingWitness ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Verifying...
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4" />
                      Verify Witness
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Witness Verified</p>
                      <p className="text-xs text-green-700">{witnessInfo?.name || witnessInfo?.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWitnessVerified(false);
                      setWitnessInfo(null);
                      setWitnessPassword('');
                    }}
                    className="text-xs text-gray-600 hover:text-gray-900 underline"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reason Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Voiding *
            </label>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={3}
              disabled={!witnessVerified || processing}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Enter reason for voiding this transaction..."
              required
            />
          </div>
        </div>
      </ConfirmModal>

      {/* Hidden receipt for printing */}
      <div className="hidden">
        <ReceiptComponent ref={receiptRef} bill={selectedBill || {}} branch={branchData} />
      </div>

      {/* Advanced Receipt Number Checker Modal */}
      {showReceiptChecker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileSearch className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Advanced Receipt Checker</h2>
                    <p className="text-sm text-gray-600">Check single or multiple receipt numbers simultaneously</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowReceiptChecker(false);
                    resetReceiptChecker();
                  }}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Mode Selection */}
              <div className="mb-6">
                <div className="flex gap-2 border-b border-gray-200">
                  <button
                    onClick={() => setCheckMode('single')}
                    className={`px-4 py-2 font-medium text-sm transition-colors ${
                      checkMode === 'single'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Single Check
                  </button>
                  <button
                    onClick={() => setCheckMode('batch')}
                    className={`px-4 py-2 font-medium text-sm transition-colors ${
                      checkMode === 'batch'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Batch Check
                  </button>
                  <button
                    onClick={() => setCheckMode('file')}
                    className={`px-4 py-2 font-medium text-sm transition-colors ${
                      checkMode === 'file'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    File Upload
                  </button>
                </div>
              </div>

              {/* Single Check Mode */}
              {checkMode === 'single' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter Receipt Number
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={receiptSearchNumber}
                      onChange={(e) => setReceiptSearchNumber(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCheckReceipt();
                        }
                      }}
                      placeholder="Enter receipt number to search"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    />
                    <button
                      onClick={handleCheckReceipt}
                      disabled={checkingReceipt || !receiptSearchNumber.trim()}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {checkingReceipt ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Checking...
                        </>
                      ) : (
                        <>
                          <FileSearch className="w-4 h-4" />
                          Check
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Batch Check Mode */}
              {checkMode === 'batch' && (
                <div className="mb-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enter Receipt Numbers (one per line, comma-separated, or tab-separated)
                    </label>
                    <textarea
                      value={batchReceiptNumbers}
                      onChange={(e) => setBatchReceiptNumbers(e.target.value)}
                      placeholder="Paste receipt numbers here...&#10;Example:&#10;REC001&#10;REC002&#10;REC003"
                      rows={8}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      You can paste multiple receipt numbers. Maximum 1000 at once.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleBatchCheck}
                      disabled={checkingReceipt || !batchReceiptNumbers.trim()}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {checkingReceipt ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Checking...
                        </>
                      ) : (
                        <>
                          <FileSearch className="w-4 h-4" />
                          Check All Receipts
                        </>
                      )}
                    </button>
                    {batchReceiptNumbers && (
                      <button
                        onClick={() => setBatchReceiptNumbers('')}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* File Upload Mode */}
              {checkMode === 'file' && (
                <div className="mb-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload File (.txt or .csv)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept=".txt,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="receipt-file-upload"
                      />
                      <label
                        htmlFor="receipt-file-upload"
                        className="cursor-pointer flex flex-col items-center gap-3"
                      >
                        <Upload className="w-10 h-10 text-gray-400" />
                        <div>
                          <span className="text-sm font-medium text-blue-600 hover:text-blue-700">
                            Click to upload
                          </span>
                          <span className="text-sm text-gray-500"> or drag and drop</span>
                        </div>
                        <p className="text-xs text-gray-500">TXT, CSV up to 5MB</p>
                      </label>
                    </div>
                  </div>
                  {filePreview && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <span className="font-medium text-gray-900">{filePreview.fileName}</span>
                        </div>
                        <button
                          onClick={() => {
                            setUploadedFile(null);
                            setFilePreview(null);
                            setBatchReceiptNumbers('');
                          }}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600">
                        {filePreview.receiptCount} receipt number(s) found
                      </p>
                      <p className="text-xs text-gray-500 mt-1 font-mono">
                        Preview: {filePreview.preview}
                      </p>
                      {batchReceiptNumbers && (
                        <button
                          onClick={handleBatchCheck}
                          disabled={checkingReceipt}
                          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                        >
                          {checkingReceipt ? 'Checking...' : 'Check All Receipts'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Statistics Summary */}
              {checkStats && (
                <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-xs text-gray-600 mb-1">Total Checked</p>
                    <p className="text-2xl font-bold text-blue-600">{checkStats.totalChecked}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-xs text-gray-600 mb-1">Found</p>
                    <p className="text-2xl font-bold text-green-600">{checkStats.found}</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-xs text-gray-600 mb-1">Not Found</p>
                    <p className="text-2xl font-bold text-red-600">{checkStats.notFound}</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                    <p className="text-2xl font-bold text-purple-600">₱{checkStats.totalAmount.toFixed(2)}</p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-xs text-gray-600 mb-1">Success Rate</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {((checkStats.found / checkStats.totalChecked) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}

              {/* Results - Found Transactions */}
              {batchResults && batchResults.found.length > 0 && (
                <div className="mb-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">Found Transactions ({batchResults.found.length})</span>
                    </div>
                    {checkStats && (
                      <button
                        onClick={exportBatchResults}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Export Results
                      </button>
                    )}
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Receipt #</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Bill ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Client</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {batchResults.found.map((result, idx) => (
                          <tr key={`${result.receiptNumber}-${idx}`} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="text-sm font-mono font-medium text-blue-600">{result.receiptNumber}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="text-sm font-medium text-gray-900">#{result.bill.id.slice(-8)}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="text-sm text-gray-900">{result.bill.createdAt?.toLocaleDateString()}</p>
                              <p className="text-xs text-gray-500">{result.bill.createdAt?.toLocaleTimeString()}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-gray-900">{result.bill.clientName}</p>
                              <p className="text-xs text-gray-500">{result.bill.clientPhone}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="text-sm font-semibold text-gray-900">₱{result.bill.total?.toFixed(2)}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(result.bill.status)}`}>
                                {result.bill.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <button
                                onClick={() => {
                                  handleViewDetails(result.bill);
                                  setShowReceiptChecker(false);
                                }}
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
                </div>
              )}

              {/* Results - Not Found Receipts */}
              {batchResults && batchResults.notFound.length > 0 && (
                <div className="mb-6 space-y-4">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">Not Found Receipts ({batchResults.notFound.length})</span>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {batchResults.notFound.map((receiptNum, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-red-200 rounded px-3 py-2 text-sm font-mono text-red-700"
                        >
                          {receiptNum}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Single Check Results */}
              {checkMode === 'single' && receiptCheckResults.length > 0 && (
                <div className="mb-6 space-y-4">
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">
                      Found {receiptCheckResults.length} transaction(s) with receipt number: <strong>{receiptSearchNumber.toUpperCase()}</strong>
                    </span>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Bill ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Client</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Payment</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Receipt #</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {receiptCheckResults.map((bill) => (
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
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="text-sm font-semibold text-gray-900">₱{bill.total?.toFixed(2)}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="text-sm text-gray-600">{getPaymentMethodLabel(bill.paymentMethod)}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(bill.status)}`}>
                                {bill.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="text-sm font-mono font-medium text-blue-600">{bill.receiptNumber}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <button
                                onClick={() => {
                                  handleViewDetails(bill);
                                  setShowReceiptChecker(false);
                                }}
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
                </div>
              )}

              {/* No Results */}
              {((checkMode === 'single' && receiptCheckResults.length === 0 && receiptSearchNumber && !checkingReceipt) ||
                (batchResults && batchResults.found.length === 0 && batchResults.notFound.length === 0)) && (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No transactions found</p>
                  <p className="text-sm text-gray-400 mt-1">Try checking different receipt numbers</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchManagerBilling;
