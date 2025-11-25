/**
 * Commissions Page - Branch Manager
 * View and track stylist commissions from product sales
 */

import { useState, useEffect, useMemo } from 'react';
import { DollarSign, Calendar, User, Search, Download, TrendingUp, Filter, Receipt } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

const Commissions = () => {
  const { userBranch } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStylist, setSelectedStylist] = useState('all');
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });

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
      const billsRef = collection(db, 'bills');
      const billsQuery = query(
        billsRef,
        where('branchId', '==', userBranch),
        where('status', '==', 'paid')
      );
      
      const billsSnapshot = await getDocs(billsQuery);
      const transactionsData = [];
      
      billsSnapshot.forEach((doc) => {
        const billData = doc.data();
        const items = billData.items || [];
        
        // Extract product items with commissions
        items.forEach((item) => {
          if (item.type === 'product' && item.commissionerId && item.commissionPoints > 0) {
            transactionsData.push({
              id: `${doc.id}-${item.id}`,
              billId: doc.id,
              transactionDate: billData.createdAt,
              productName: item.name || 'Unknown Product',
              productId: item.id,
              quantity: item.quantity || 1,
              unitCost: item.unitCost || 0,
              commissionPercentage: item.commissionPercentage || 0,
              commissionerId: item.commissionerId,
              commissionerName: item.commissionerName || 'Unknown',
              commissionPoints: item.commissionPoints || 0,
              clientName: billData.clientName || 'Walk-in',
              receiptNumber: billData.receiptNumber || 'N/A',
              totalAmount: item.price || 0
            });
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
      const usersRef = collection(db, 'users');
      const usersQuery = query(
        usersRef,
        where('branchId', '==', userBranch),
        where('roles', 'array-contains', 'stylist')
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      const stylistsData = [];
      
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        stylistsData.push({
          id: doc.id,
          name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email || 'Unknown',
          email: userData.email || ''
        });
      });
      
      setStylists(stylistsData);
    } catch (error) {
      console.error('Error fetching stylists:', error);
    }
  };

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

  const handleExportCSV = () => {
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
            <DollarSign className="h-6 w-6 text-purple-600" />
            Commissions
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track stylist commissions from product sales</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
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
            <DollarSign className="h-10 w-10 text-purple-200" />
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

      {/* Commission Summary by Stylist */}
      {commissionSummary.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Commission Summary by Stylist</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stylist</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sales</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Commission</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {commissionSummary.map((summary) => (
                  <tr key={summary.stylistId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">{summary.stylistName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {summary.transactionCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      ₱{summary.totalSales.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-purple-600">
                      ₱{summary.totalCommission.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-2" />
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
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">{transaction.commissionerName}</span>
                        </div>
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
    </div>
  );
};

export default Commissions;

