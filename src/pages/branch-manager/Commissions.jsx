/**
 * Commissions Page - Branch Manager
 * View and track stylist commissions from product sales
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Banknote, Calendar, User, Search, Download, TrendingUp, Filter, Receipt, Printer } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import PDFPreviewModal from '../../components/ui/PDFPreviewModal';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { exportToExcel } from '../../utils/excelExport';

const Commissions = () => {
  const { userBranch } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStylist, setSelectedStylist] = useState('all');
  const [selectedStylistForSummary, setSelectedStylistForSummary] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    if (userBranch) {
      fetchTransactions();
      fetchStylists();
    }
  }, [userBranch]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      // Fetch all paid transactions for this branch
      // Note: The collection is 'transactions', not 'bills' (see billingService.js)
      const billsRef = collection(db, 'transactions');
      
      let billsSnapshot;
      try {
        // Try query with status filter and orderBy
        const billsQuery = query(
          billsRef,
          where('branchId', '==', userBranch),
          where('status', '==', 'paid'),
          orderBy('createdAt', 'desc')
        );
        billsSnapshot = await getDocs(billsQuery);
      } catch (queryError) {
        console.warn('Query error (might need index), trying alternative:', queryError);
        // Fallback: Query all transactions for branch and filter in memory
        try {
          const billsQuery = query(
            billsRef,
            where('branchId', '==', userBranch),
            orderBy('createdAt', 'desc')
          );
          billsSnapshot = await getDocs(billsQuery);
          // Filter for paid status in memory
          const paidDocs = [];
          billsSnapshot.forEach((doc) => {
            if (doc.data().status === 'paid') {
              paidDocs.push(doc);
            }
          });
          // Create a mock snapshot-like object
          billsSnapshot = {
            size: paidDocs.length,
            forEach: (callback) => paidDocs.forEach(callback),
            docs: paidDocs
          };
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          // Last resort: query without orderBy
          const billsQuery = query(
            billsRef,
            where('branchId', '==', userBranch)
          );
          billsSnapshot = await getDocs(billsQuery);
          // Filter for paid status in memory
          const paidDocs = [];
          billsSnapshot.forEach((doc) => {
            if (doc.data().status === 'paid') {
              paidDocs.push(doc);
            }
          });
          billsSnapshot = {
            size: paidDocs.length,
            forEach: (callback) => paidDocs.forEach(callback),
            docs: paidDocs
          };
        }
      }
      const transactionsData = [];
      
      billsSnapshot.forEach((doc) => {
        const billData = doc.data();
        const items = billData.items || [];
        
        // Extract product items with commissions
        items.forEach((item, itemIndex) => {
          
          if (item.type === 'product') {
            // Commission data is stored at the ITEM level, not in batches
            // Check if item has commission data
            const hasCommissionData = item.commissionerId && item.commissionPoints != null && item.commissionPoints > 0;
            
            if (hasCommissionData) {
              // Commission data is stored at item level
              // If item has batches, distribute commission proportionally across batches
              // Otherwise, create a single commission record
              const batches = item.batches || [];
              const totalItemQuantity = item.quantity || 1;
              const totalCommissionPoints = item.commissionPoints || 0;
              
              if (batches.length > 0) {
                // Calculate total quantity across all batches
                const totalBatchQuantity = batches.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
                const quantityToUse = totalBatchQuantity > 0 ? totalBatchQuantity : totalItemQuantity;
                
                // Create commission record for each batch
                batches.forEach((batch, batchIndex) => {
                  const batchQuantity = batch.quantity || 0;
                  
                  // Distribute commission proportionally based on batch quantity
                  const batchCommissionPoints = quantityToUse > 0 
                    ? (totalCommissionPoints * batchQuantity) / quantityToUse
                    : totalCommissionPoints / batches.length;
                  
                  const transaction = {
                    id: `${doc.id}-${item.id}-${batchIndex}`,
                    billId: doc.id,
                    transactionDate: billData.createdAt,
                    productName: item.name || 'Unknown Product',
                    productId: item.id,
                    batchId: batch.batchId || '',
                    batchNumber: batch.batchNumber || '',
                    quantity: batchQuantity,
                    unitCost: batch.unitCost || item.unitCost || 0,
                    commissionPercentage: item.commissionPercentage || 0,
                    commissionerId: item.commissionerId,
                    commissionerName: item.commissionerName || 'Unknown',
                    commissionPoints: Math.round(batchCommissionPoints * 100) / 100, // Round to 2 decimals
                    clientName: billData.clientName || 'Walk-in',
                    receiptNumber: billData.receiptNumber || 'N/A',
                    totalAmount: (batch.unitCost || item.unitCost || 0) * batchQuantity
                  };
                  
                  transactionsData.push(transaction);
                });
              } else {
                // No batches, use item-level data directly
                const transaction = {
                  id: `${doc.id}-${item.id}`,
                  billId: doc.id,
                  transactionDate: billData.createdAt,
                  productName: item.name || 'Unknown Product',
                  productId: item.id,
                  batchId: '',
                  batchNumber: '',
                  quantity: totalItemQuantity,
                  unitCost: item.unitCost || 0,
                  commissionPercentage: item.commissionPercentage || 0,
                  commissionerId: item.commissionerId,
                  commissionerName: item.commissionerName || 'Unknown',
                  commissionPoints: totalCommissionPoints,
                  clientName: billData.clientName || 'Walk-in',
                  receiptNumber: billData.receiptNumber || 'N/A',
                  totalAmount: item.price || 0
                };
                
                transactionsData.push(transaction);
              }
            }
          }
        });
      });
      
      setTransactions(transactionsData);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load commission data');
    } finally {
      setLoading(false);
    }
  };

  const fetchStylists = async () => {
    try {
      // Fetch stylists from users collection
      // Handle both legacy (role) and new (roles array) formats
      const usersRef = collection(db, 'users');
      
      // Query 1: Users with role == 'stylist' (legacy format)
      const legacyQuery = query(
        usersRef,
        where('branchId', '==', userBranch),
        where('role', '==', 'stylist')
      );
      
      // Query 2: Users with roles array containing 'stylist' (new format)
      const rolesQuery = query(
        usersRef,
        where('branchId', '==', userBranch),
        where('roles', 'array-contains', 'stylist')
      );
      
      // Execute both queries
      const [legacySnapshot, rolesSnapshot] = await Promise.all([
        getDocs(legacyQuery),
        getDocs(rolesQuery)
      ]);
      
      // Combine results and remove duplicates, filter for active users
      const stylistsMap = new Map();
      
      legacySnapshot.forEach((doc) => {
        const userData = doc.data();
        // Filter for active users (check both isActive and active fields)
        if (userData.isActive !== false && userData.active !== false) {
          stylistsMap.set(doc.id, {
            id: doc.id,
            name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email || 'Unknown',
            email: userData.email || ''
          });
        }
      });
      
      rolesSnapshot.forEach((doc) => {
        if (!stylistsMap.has(doc.id)) {
          const userData = doc.data();
          // Filter for active users (check both isActive and active fields)
          if (userData.isActive !== false && userData.active !== false) {
            stylistsMap.set(doc.id, {
              id: doc.id,
              name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email || 'Unknown',
              email: userData.email || ''
            });
          }
        }
      });
      
      setStylists(Array.from(stylistsMap.values()));
    } catch (error) {
      console.error('Error fetching stylists:', error);
      toast.error('Failed to load stylists');
    }
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.productName.toLowerCase().includes(searchLower) ||
        t.commissionerName.toLowerCase().includes(searchLower) ||
        t.clientName.toLowerCase().includes(searchLower) ||
        t.receiptNumber.toLowerCase().includes(searchLower)
      );
    }
    
    // Filter by stylist
    if (selectedStylist !== 'all') {
      filtered = filtered.filter(t => t.commissionerId === selectedStylist);
    }
    
    // Filter by date range
    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(t => {
        const transactionDate = t.transactionDate?.toDate ? t.transactionDate.toDate() : new Date(t.transactionDate);
        return transactionDate >= startDate;
      });
    }
    
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => {
        const transactionDate = t.transactionDate?.toDate ? t.transactionDate.toDate() : new Date(t.transactionDate);
        return transactionDate <= endDate;
      });
    }
    
    return filtered.sort((a, b) => {
      const dateA = a.transactionDate?.toDate ? a.transactionDate.toDate() : new Date(a.transactionDate);
      const dateB = b.transactionDate?.toDate ? b.transactionDate.toDate() : new Date(b.transactionDate);
      return dateB - dateA;
    });
  }, [transactions, searchTerm, selectedStylist, dateRange]);

  // Calculate commission summary by stylist
  const commissionSummary = useMemo(() => {
    const summary = {};
    
    filteredTransactions.forEach((transaction) => {
      const stylistId = transaction.commissionerId;
      if (!summary[stylistId]) {
        summary[stylistId] = {
          stylistId,
          stylistName: transaction.commissionerName,
          totalCommission: 0,
          transactionCount: 0,
          totalSales: 0
        };
      }
      
      summary[stylistId].totalCommission += transaction.commissionPoints;
      summary[stylistId].transactionCount += 1;
      summary[stylistId].totalSales += transaction.totalAmount;
    });
    
    return Object.values(summary).sort((a, b) => b.totalCommission - a.totalCommission);
  }, [filteredTransactions]);

  // Get summary for selected stylist
  const selectedStylistSummary = useMemo(() => {
    if (!selectedStylistForSummary) return null;
    return commissionSummary.find(s => s.stylistId === selectedStylistForSummary);
  }, [commissionSummary, selectedStylistForSummary]);

  const handleExportCSV = () => {
    // Legacy CSV export (keeping for backward compatibility)
    const headers = ['Date', 'Stylist', 'Product', 'Quantity', 'Unit Cost', 'Commission %', 'Commission Amount', 'Total Sale', 'Client', 'Receipt #'];
    const rows = filteredTransactions.map(t => {
      const date = t.transactionDate?.toDate ? formatDate(t.transactionDate.toDate(), 'MMM dd, yyyy HH:mm') : 'N/A';
      return [
        date,
        t.commissionerName,
        t.productName,
        t.quantity,
        `₱${t.unitCost.toFixed(2)}`,
        `${t.commissionPercentage}%`,
        `₱${t.commissionPoints.toFixed(2)}`,
        `₱${t.totalAmount.toFixed(2)}`,
        t.clientName,
        t.receiptNumber
      ];
    });
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `commissions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Commissions exported to CSV');
  };

  const handleExportExcel = () => {
    if (!filteredTransactions.length) {
      toast.error('No commission data to export');
      return;
    }

    try {
      const headers = [
        { key: 'transactionDate', label: 'Date' },
        { key: 'commissionerName', label: 'Stylist' },
        { key: 'productName', label: 'Product' },
        { key: 'batchNumber', label: 'Batch Number' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'unitCost', label: 'Unit Cost (₱)' },
        { key: 'commissionPercentage', label: 'Commission %' },
        { key: 'commissionPoints', label: 'Commission Amount (₱)' },
        { key: 'totalAmount', label: 'Total Sale (₱)' },
        { key: 'clientName', label: 'Client' },
        { key: 'receiptNumber', label: 'Receipt #' }
      ];

      // Prepare data with formatted dates
      const exportData = filteredTransactions.map(t => ({
        ...t,
        transactionDate: t.transactionDate?.toDate 
          ? formatDate(t.transactionDate.toDate(), 'MMM dd, yyyy HH:mm')
          : (t.transactionDate ? formatDate(new Date(t.transactionDate), 'MMM dd, yyyy HH:mm') : 'N/A'),
        unitCost: t.unitCost || 0,
        commissionPercentage: t.commissionPercentage || 0,
        commissionPoints: t.commissionPoints || 0,
        totalAmount: t.totalAmount || 0,
        quantity: t.quantity || 0
      }));

      exportToExcel(exportData, 'commissions', 'Commissions', headers);
      toast.success('Commissions exported to Excel successfully');
    } catch (error) {
      console.error('Error exporting commissions:', error);
      toast.error('Failed to export commissions');
    }
  };

  const handlePrint = () => {
    if (!printRef.current) {
      toast.error('Print content not ready. Please try again.');
      return;
    }
    
    // Wait for images to load before opening preview
    const images = printRef.current.querySelectorAll('img');
    if (images.length > 0) {
      Promise.all(
        Array.from(images).map((img) => {
          if (img.complete && img.naturalHeight !== 0) {
            return Promise.resolve();
          }
          return new Promise((resolve) => {
            if (img.src && !img.crossOrigin) {
              img.crossOrigin = 'anonymous';
            }
            const onLoad = () => {
              img.removeEventListener('load', onLoad);
              img.removeEventListener('error', onError);
              resolve();
            };
            const onError = () => {
              img.removeEventListener('load', onLoad);
              img.removeEventListener('error', onError);
              resolve(); // Continue even if image fails
            };
            img.addEventListener('load', onLoad);
            img.addEventListener('error', onError);
            setTimeout(() => {
              img.removeEventListener('load', onLoad);
              img.removeEventListener('error', onError);
              resolve();
            }, 3000);
          });
        })
      ).then(() => {
        // Additional wait to ensure rendering
        setTimeout(() => {
          setShowPDFPreview(true);
        }, 300);
      });
    } else {
      setShowPDFPreview(true);
    }
  };

  const totalCommission = filteredTransactions.reduce((sum, t) => sum + t.commissionPoints, 0);
  const totalSales = filteredTransactions.reduce((sum, t) => sum + t.totalAmount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Banknote className="h-6 w-6 text-purple-600" />
            Commissions
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track stylist commissions from product sales</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            title="Print PDF"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            title="Export to CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            title="Export to Excel"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Excel</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Commissions</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                ₱{totalCommission.toFixed(2)}
              </p>
            </div>
            <Banknote className="h-10 w-10 text-purple-200" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                ₱{totalSales.toFixed(2)}
              </p>
            </div>
            <TrendingUp className="h-10 w-10 text-green-200" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Transactions</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {filteredTransactions.length}
              </p>
            </div>
            <Receipt className="h-10 w-10 text-blue-200" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Product, stylist, client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stylist</label>
            <select
              value={selectedStylist}
              onChange={(e) => setSelectedStylist(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Stylists</option>
              {stylists.map(stylist => (
                <option key={stylist.id} value={stylist.id}>
                  {stylist.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Commission Summary by Stylist - Only shown when stylist is clicked */}
      {selectedStylistForSummary && selectedStylistSummary && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Commission Summary - {selectedStylistSummary.stylistName}
            </h2>
            <button
              onClick={() => setSelectedStylistForSummary(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Transactions</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {selectedStylistSummary.transactionCount}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Total Sales</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  ₱{selectedStylistSummary.totalSales.toFixed(2)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Total Commission</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  ₱{selectedStylistSummary.totalCommission.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Commission Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <Banknote className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No commission transactions found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stylist</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Cost</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Commission %</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sale</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt #</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.map((transaction) => {
                  const date = transaction.transactionDate?.toDate 
                    ? formatDate(transaction.transactionDate.toDate(), 'MMM dd, yyyy HH:mm')
                    : formatDate(transaction.transactionDate, 'MMM dd, yyyy HH:mm');
                  
                  return (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{date}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedStylistForSummary(transaction.commissionerId)}
                          className="flex items-center hover:text-purple-600 transition-colors"
                        >
                          <User className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900 hover:text-purple-600 font-medium cursor-pointer">
                            {transaction.commissionerName}
                          </span>
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.productName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{transaction.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">₱{transaction.unitCost.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{transaction.commissionPercentage}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-purple-600">
                        ₱{transaction.commissionPoints.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">₱{transaction.totalAmount.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.clientName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{transaction.receiptNumber}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Print View - Rendered off-screen for PDF generation */}
      <div ref={printRef} style={{ position: 'fixed', left: '-200%', top: 0, width: '8.5in', zIndex: -1 }}>
        <style>{`
          @media print {
            @page {
              margin: 1cm 1cm 1.5cm 1cm;
              size: letter;
            }
            * {
              color: #000 !important;
              background: transparent !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-break {
              page-break-after: always;
            }
            .print-avoid-break {
              page-break-inside: avoid;
            }
            table {
              font-size: 12px;
              border-collapse: collapse;
              line-height: 1.4;
            }
            th, td {
              padding: 8px 10px !important;
              border: 1px solid #000 !important;
              background: transparent !important;
              text-align: center !important;
              vertical-align: middle !important;
            }
            thead th {
              border-bottom: 2px solid #000 !important;
              font-weight: 600;
            }
            tbody tr {
              border-bottom: 1px solid #000 !important;
            }
          }
        `}</style>
        <div className="p-4" style={{ fontSize: '12px', padding: '16px', lineHeight: '1.5' }}>
          <div className="text-center mb-4 border-b border-black pb-3" style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #000' }}>
            <h1 className="font-bold" style={{ fontSize: '18px', marginBottom: '4px' }}>Commissions Report</h1>
            <p className="font-semibold" style={{ fontSize: '14px', marginBottom: '4px' }}>David's Salon Management System</p>
            <p style={{ fontSize: '12px' }}>Generated: {formatDate(new Date(), 'MMM dd, yyyy')}</p>
          </div>
          
          {/* Summary Stats */}
          <div className="mb-4 grid grid-cols-3 gap-3 print-avoid-break" style={{ fontSize: '12px', marginBottom: '16px', gap: '12px' }}>
            <div className="border border-black p-2 text-center" style={{ border: '1px solid #000', padding: '8px' }}>
              <div className="font-bold" style={{ fontSize: '16px', marginBottom: '4px' }}>₱{totalCommission.toFixed(2)}</div>
              <div style={{ fontSize: '11px' }}>Total Commissions</div>
            </div>
            <div className="border border-black p-2 text-center" style={{ border: '1px solid #000', padding: '8px' }}>
              <div className="font-bold" style={{ fontSize: '16px', marginBottom: '4px' }}>₱{totalSales.toFixed(2)}</div>
              <div style={{ fontSize: '11px' }}>Total Sales</div>
            </div>
            <div className="border border-black p-2 text-center" style={{ border: '1px solid #000', padding: '8px' }}>
              <div className="font-bold" style={{ fontSize: '16px', marginBottom: '4px' }}>{filteredTransactions.length}</div>
              <div style={{ fontSize: '11px' }}>Transactions</div>
            </div>
          </div>

          {/* Commission Summary by Stylist */}
          {commissionSummary.length > 0 && (
            <div className="mb-4 print-avoid-break" style={{ marginBottom: '16px' }}>
              <h2 className="font-bold mb-2" style={{ fontSize: '14px', marginBottom: '8px' }}>Commission Summary by Stylist</h2>
              <table className="w-full" style={{ fontSize: '12px', borderCollapse: 'collapse', width: '100%', lineHeight: '1.5' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #000' }}>
                    <th className="border border-black font-semibold" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>Stylist</th>
                    <th className="border border-black font-semibold" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>Transactions</th>
                    <th className="border border-black font-semibold" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>Total Sales</th>
                    <th className="border border-black font-semibold" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>Total Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionSummary.map((summary) => (
                    <tr key={summary.stylistId} style={{ pageBreakInside: 'avoid', borderBottom: '1px solid #000' }}>
                      <td className="border border-black font-medium" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle' }}>{summary.stylistName}</td>
                      <td className="border border-black" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle' }}>{summary.transactionCount}</td>
                      <td className="border border-black" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle' }}>₱{summary.totalSales.toFixed(2)}</td>
                      <td className="border border-black font-semibold" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>₱{summary.totalCommission.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Transactions Table */}
          <div className="print-avoid-break" style={{ pageBreakInside: 'avoid' }}>
            <h2 className="font-bold mb-2" style={{ fontSize: '14px', marginBottom: '8px' }}>Commission Transactions</h2>
            <table className="w-full" style={{ fontSize: '12px', borderCollapse: 'collapse', width: '100%', lineHeight: '1.5' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #000' }}>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>Date</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>Stylist</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>Product</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>Qty</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>Unit Cost</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>Comm %</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>Commission</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>Total Sale</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>Client</th>
                  <th className="border border-black font-semibold" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>Receipt #</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => {
                  const date = transaction.transactionDate?.toDate 
                    ? formatDate(transaction.transactionDate.toDate(), 'MMM dd, yyyy HH:mm')
                    : formatDate(transaction.transactionDate, 'MMM dd, yyyy HH:mm');
                  
                  return (
                    <tr key={transaction.id} style={{ pageBreakInside: 'avoid', borderBottom: '1px solid #000' }}>
                      <td className="border border-black" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle' }}>{date}</td>
                      <td className="border border-black" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle' }}>{transaction.commissionerName}</td>
                      <td className="border border-black" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle' }}>{transaction.productName}</td>
                      <td className="border border-black" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle' }}>{transaction.quantity}</td>
                      <td className="border border-black" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle' }}>₱{transaction.unitCost.toFixed(2)}</td>
                      <td className="border border-black" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle' }}>{transaction.commissionPercentage}%</td>
                      <td className="border border-black font-semibold" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600' }}>₱{transaction.commissionPoints.toFixed(2)}</td>
                      <td className="border border-black" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle' }}>₱{transaction.totalAmount.toFixed(2)}</td>
                      <td className="border border-black" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle' }}>{transaction.clientName}</td>
                      <td className="border border-black" style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '12px', textAlign: 'center', verticalAlign: 'middle' }}>{transaction.receiptNumber}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Footer */}
          <div className="mt-4 pt-2 border-t border-black text-center" style={{ fontSize: '11px', marginTop: '16px', paddingTop: '8px', borderTop: '1px solid #000' }}>
            <p>Total Commissions: ₱{totalCommission.toFixed(2)} | Total Sales: ₱{totalSales.toFixed(2)} | Transactions: {filteredTransactions.length}</p>
          </div>
        </div>
      </div>

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        isOpen={showPDFPreview}
        onClose={() => setShowPDFPreview(false)}
        contentRef={printRef}
        title="Commissions Report - PDF Preview"
        fileName={`Commissions_Report_${new Date().toISOString().split('T')[0]}`}
      />
    </div>
  );
};

export default Commissions;

