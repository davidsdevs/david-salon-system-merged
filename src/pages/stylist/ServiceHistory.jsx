/**
 * Service History Page - Stylist
 * View transaction history with commissions
 */

import { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, DollarSign, User, Search, Filter, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { formatDate, formatTime, formatCurrency } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const StylistServiceHistory = () => {
  const { currentUser, userBranch } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalCommission: 0,
    transactionCount: 0
  });

  useEffect(() => {
    if (currentUser?.uid) {
      fetchTransactions();
    }
  }, [currentUser, dateFilter]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const transactionsRef = collection(db, 'transactions');
      
      // Build date filter
      let dateQuery = null;
      if (dateFilter === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateQuery = {
          start: Timestamp.fromDate(today),
          end: Timestamp.fromDate(tomorrow)
        };
      } else if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);
        dateQuery = {
          start: Timestamp.fromDate(weekAgo),
          end: Timestamp.now()
        };
      } else if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        monthAgo.setHours(0, 0, 0, 0);
        dateQuery = {
          start: Timestamp.fromDate(monthAgo),
          end: Timestamp.now()
        };
      }

      // Query transactions by stylist
      let snapshot;
      try {
        let q;
        if (dateQuery) {
          q = query(
            transactionsRef,
            where('stylistId', '==', currentUser.uid),
            where('createdAt', '>=', dateQuery.start),
            where('createdAt', '<', dateQuery.end),
            orderBy('createdAt', 'desc')
          );
        } else {
          q = query(
            transactionsRef,
            where('stylistId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
          );
        }
        snapshot = await getDocs(q);
      } catch (orderByError) {
        // If orderBy fails (missing index), fetch without orderBy and sort in memory
        console.warn('OrderBy failed, fetching without orderBy:', orderByError.message);
        let q;
        if (dateQuery) {
          q = query(
            transactionsRef,
            where('stylistId', '==', currentUser.uid),
            where('createdAt', '>=', dateQuery.start),
            where('createdAt', '<', dateQuery.end)
          );
        } else {
          q = query(
            transactionsRef,
            where('stylistId', '==', currentUser.uid)
          );
        }
        snapshot = await getDocs(q);
      }
      const transactionsData = [];
      
      // Process transactions - filter by stylist in items array
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
        
        // Check if transaction has items for this stylist
        let hasStylistItems = false;
        const stylistItems = [];
        
        // New schema: items[] array
        if (data.items && Array.isArray(data.items)) {
          data.items.forEach((item, index) => {
            const itemStylistId = item.stylistId || data.stylistId;
            if (itemStylistId === currentUser.uid) {
              hasStylistItems = true;
              stylistItems.push({
                ...item,
                itemIndex: index
              });
            }
          });
        }
        // Backward compatibility: services[] array
        else if (data.services && Array.isArray(data.services)) {
          data.services.forEach((service) => {
            const serviceStylistId = service.stylistId || data.stylistId;
            if (serviceStylistId === currentUser.uid) {
              hasStylistItems = true;
              stylistItems.push({
                ...service,
                type: 'service'
              });
            }
          });
        }
        // Fallback: check transaction-level stylistId
        else if (data.stylistId === currentUser.uid) {
          hasStylistItems = true;
        }
        
        if (hasStylistItems) {
          transactionsData.push({
            id: doc.id,
            ...data,
            createdAt,
            stylistItems // Store filtered items for this stylist
          });
        }
      });
      
      // Sort by date if orderBy wasn't used (fallback)
      transactionsData.sort((a, b) => {
        const timeA = a.createdAt?.getTime() || 0;
        const timeB = b.createdAt?.getTime() || 0;
        return timeB - timeA; // Descending (newest first)
      });

      setTransactions(transactionsData);

      // Calculate summary
      const totalSales = transactionsData.reduce((sum, t) => {
        // Sum only items assigned to this stylist
        if (t.stylistItems && t.stylistItems.length > 0) {
          return sum + t.stylistItems.reduce((itemSum, item) => {
            return itemSum + (item.price || item.adjustedPrice || 0) * (item.quantity || 1);
          }, 0);
        }
        return sum + (t.total || 0);
      }, 0);
      
      const totalCommission = transactionsData.reduce((sum, t) => {
        // Calculate commission from stylist items
        if (t.stylistItems && t.stylistItems.length > 0) {
          return sum + t.stylistItems.reduce((itemSum, item) => {
            // Use commission if available, otherwise calculate (60% for services, 10% for products)
            if (item.commission !== undefined) {
              return itemSum + item.commission;
            }
            const itemType = item.type || 'service';
            const itemTotal = (item.price || item.adjustedPrice || 0) * (item.quantity || 1);
            const commissionRate = itemType === 'service' ? 0.6 : 0.1;
            return itemSum + (itemTotal * commissionRate);
          }, 0);
        }
        return sum;
      }, 0);

      setSummary({
        totalSales,
        totalCommission,
        transactionCount: transactionsData.length
      });

    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load service history');
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(transaction =>
        transaction.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.transactionId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.receiptNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const timeA = a.createdAt?.getTime() || 0;
      const timeB = b.createdAt?.getTime() || 0;
      const amountA = a.total || 0;
      const amountB = b.total || 0;

      switch (sortBy) {
        case 'date-desc':
          return timeB - timeA;
        case 'date-asc':
          return timeA - timeB;
        case 'amount-desc':
          return amountB - amountA;
        case 'amount-asc':
          return amountA - amountB;
        default:
          return timeB - timeA;
      }
    });

    return filtered;
  }, [transactions, searchTerm, sortBy]);

  const calculateCommission = (transaction) => {
    // Use stylistItems if available (pre-filtered)
    if (transaction.stylistItems && transaction.stylistItems.length > 0) {
      return transaction.stylistItems.reduce((sum, item) => {
        if (item.commission !== undefined) {
          return sum + item.commission;
        }
        const itemType = item.type || 'service';
        const itemTotal = (item.price || item.adjustedPrice || 0) * (item.quantity || 1);
        const commissionRate = itemType === 'service' ? 0.6 : 0.1;
        return sum + (itemTotal * commissionRate);
      }, 0);
    }
    
    // Fallback: calculate from items array
    const serviceItems = (transaction.items || []).filter(item => 
      item.type === 'service' && (item.stylistId === currentUser.uid || transaction.stylistId === currentUser.uid)
    );
    return serviceItems.reduce((sum, item) => {
      if (item.commission !== undefined) {
        return sum + item.commission;
      }
      const itemTotal = (item.price || 0) * (item.quantity || 1);
      return sum + (itemTotal * 0.6); // 60% for services
    }, 0);
  };
  
  const getStylistItems = (transaction) => {
    // Return pre-filtered items if available
    if (transaction.stylistItems && transaction.stylistItems.length > 0) {
      return transaction.stylistItems;
    }
    
    // Fallback: filter items
    if (transaction.items && Array.isArray(transaction.items)) {
      return transaction.items.filter(item => 
        item.stylistId === currentUser.uid || transaction.stylistId === currentUser.uid
      );
    }
    
    return [];
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Service History</h1>
        <p className="text-gray-600">View your completed services and commissions</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalSales)}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Commission</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalCommission)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Transactions</p>
              <p className="text-2xl font-bold text-purple-600">{summary.transactionCount}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by client name or transaction ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="date-desc">Date: Newest First</option>
            <option value="date-asc">Date: Oldest First</option>
            <option value="amount-desc">Amount: Highest First</option>
            <option value="amount-asc">Amount: Lowest First</option>
          </select>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Transactions ({filteredTransactions.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {filteredTransactions.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No transactions found</p>
              <p className="text-sm text-gray-400 mt-1">
                {searchTerm || dateFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No completed services yet'}
              </p>
            </div>
          ) : (
            filteredTransactions.map((transaction) => {
              const commission = calculateCommission(transaction);
              const stylistItems = getStylistItems(transaction);
              const serviceItems = stylistItems.filter(item => (item.type || 'service') === 'service');
              
              return (
                <div key={transaction.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{transaction.clientName || 'Guest Client'}</h3>
                          <p className="text-sm text-gray-500">
                            Transaction #{transaction.receiptNumber || transaction.id.substring(0, 8)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="ml-13 space-y-2">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(transaction.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatTime(transaction.createdAt)}
                          </span>
                        </div>
                        
                        {stylistItems.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm font-medium text-gray-700 mb-1">Services & Products:</p>
                            <div className="space-y-1">
                              {stylistItems.map((item, idx) => {
                                const itemType = item.type || 'service';
                                const itemName = item.name || item.serviceName || item.productName || 'Item';
                                const itemPrice = item.price || item.adjustedPrice || 0;
                                const itemQuantity = item.quantity || 1;
                                const itemTotal = itemPrice * itemQuantity;
                                
                                return (
                                  <div key={idx} className="text-sm text-gray-600 flex items-center justify-between">
                                    <span>
                                      {itemName}
                                      {itemQuantity > 1 && ` (x${itemQuantity})`}
                                      {itemType === 'product' && <span className="ml-2 text-xs text-gray-400">[Product]</span>}
                                    </span>
                                    <span className="font-medium">{formatCurrency(itemTotal)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-4 pt-2 border-t border-gray-200">
                          <div>
                            <p className="text-xs text-gray-500">Total Sale</p>
                            <p className="text-lg font-bold text-gray-900">{formatCurrency(transaction.total || 0)}</p>
                          </div>
                          {commission > 0 && (
                            <div>
                              <p className="text-xs text-gray-500">Commission</p>
                              <p className="text-lg font-bold text-green-600">{formatCurrency(commission)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default StylistServiceHistory;

