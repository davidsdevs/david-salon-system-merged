/**
 * Service History Page - Stylist
 * View transaction history with commissions, filters, and client analytics
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, DollarSign, User, Search, Filter, TrendingUp, Scissors, BarChart3, Users, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { formatDate, formatTime, formatCurrency, getFullName, getInitials } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const StylistServiceHistory = () => {
  const navigate = useNavigate();
  const { currentUser, userBranch } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDateRange, setShowDateRange] = useState(false);
  const [serviceFilter, setServiceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalCommission: 0,
    transactionCount: 0,
    totalServices: 0,
    averageCommission: 0,
    uniqueClients: 0
  });
  const [availableServices, setAvailableServices] = useState([]);

  useEffect(() => {
    if (currentUser?.uid) {
      fetchTransactions();
    }
  }, [currentUser, dateFilter, startDate, endDate]);

  // Auto-apply date range when both dates are selected
  useEffect(() => {
    if (dateFilter === 'custom' && startDate && endDate) {
      const timer = setTimeout(() => {
        setShowDateRange(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [startDate, endDate, dateFilter]);

  useEffect(() => {
    if (transactions.length > 0) {
      extractServices();
    }
  }, [transactions]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const transactionsRef = collection(db, 'transactions');
      
      // Build date filter
      let dateQuery = null;
      if (dateFilter === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery = {
          start: Timestamp.fromDate(start),
          end: Timestamp.fromDate(end)
        };
      } else if (dateFilter === 'today') {
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

      // Query transactions - filter by date if needed, then filter by stylist items in memory
      // This ensures we don't miss transactions where items have different stylistIds
      let snapshot;
      try {
        let q;
        if (dateQuery) {
          q = query(
            transactionsRef,
            where('createdAt', '>=', dateQuery.start),
            where('createdAt', '<', dateQuery.end),
            orderBy('createdAt', 'desc')
          );
        } else {
          q = query(
            transactionsRef,
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
            where('createdAt', '>=', dateQuery.start),
            where('createdAt', '<', dateQuery.end)
          );
        } else {
          q = query(transactionsRef);
        }
        snapshot = await getDocs(q);
      }
      const transactionsData = [];
      const uniqueClientIds = new Set();
      
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
          if (data.clientId) {
            uniqueClientIds.add(data.clientId);
          }
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

      const totalServices = transactionsData.reduce((sum, t) => {
        if (t.stylistItems && t.stylistItems.length > 0) {
          return sum + t.stylistItems.filter(item => (item.type || 'service') === 'service').length;
        }
        return sum;
      }, 0);

      setSummary({
        totalSales,
        totalCommission,
        transactionCount: transactionsData.length,
        totalServices,
        averageCommission: transactionsData.length > 0 ? totalCommission / transactionsData.length : 0,
        uniqueClients: uniqueClientIds.size
      });

    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load service history');
    } finally {
      setLoading(false);
    }
  };

  const extractServices = () => {
    const servicesSet = new Set();
    transactions.forEach(transaction => {
      if (transaction.stylistItems && transaction.stylistItems.length > 0) {
        transaction.stylistItems.forEach(item => {
          if ((item.type || 'service') === 'service') {
            const serviceName = item.name || item.serviceName || 'Unknown Service';
            servicesSet.add(serviceName);
          }
        });
      }
    });
    setAvailableServices(Array.from(servicesSet).sort());
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

    // Apply service filter
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(transaction => {
        if (!transaction.stylistItems || transaction.stylistItems.length === 0) return false;
        return transaction.stylistItems.some(item => {
          const itemName = item.name || item.serviceName || 'Unknown Service';
          return itemName === serviceFilter && (item.type || 'service') === 'service';
        });
      });
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
  }, [transactions, searchTerm, serviceFilter, sortBy]);

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

      {/* Enhanced Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Services Rendered</p>
              <p className="text-2xl font-bold text-indigo-600">{summary.totalServices}</p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-full">
              <Scissors className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Commission</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(summary.averageCommission)}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <BarChart3 className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Unique Clients</p>
              <p className="text-2xl font-bold text-pink-600">{summary.uniqueClients}</p>
            </div>
            <div className="p-3 bg-pink-100 rounded-full">
              <Users className="w-6 h-6 text-pink-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by client name or transaction ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                if (e.target.value !== 'custom') {
                  setStartDate('');
                  setEndDate('');
                  setShowDateRange(false);
                } else {
                  setShowDateRange(true);
                }
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
            
            {showDateRange && dateFilter === 'custom' && (
              <div className="absolute top-full left-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50 min-w-[500px]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Select Date Range</h3>
                  <button
                    onClick={() => {
                      setShowDateRange(false);
                      setDateFilter('all');
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      max={endDate || undefined}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate || undefined}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
                {startDate && endDate && (
                  <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                    <button
                      onClick={() => {
                        setShowDateRange(false);
                      }}
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {dateFilter === 'custom' && startDate && endDate && !showDateRange && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-lg text-sm">
              <Calendar className="w-4 h-4 text-primary-600" />
              <span className="text-primary-700">
                {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
              </span>
              <button
                onClick={() => {
                  setDateFilter('all');
                  setStartDate('');
                  setEndDate('');
                }}
                className="ml-2 text-primary-600 hover:text-primary-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 min-w-[200px]"
          >
            <option value="all">All Services</option>
            {availableServices.map(service => (
              <option key={service} value={service}>{service}</option>
            ))}
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
                {searchTerm || dateFilter !== 'all' || serviceFilter !== 'all'
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
                <div 
                  key={transaction.id} 
                  className="p-4 hover:bg-gray-50 transition-all cursor-pointer border-l-4 border-transparent hover:border-primary-500 hover:shadow-sm"
                  onClick={() => {
                    if (transaction.clientId) {
                      navigate(`/stylist/client-analytics/${transaction.clientId}`);
                    }
                  }}
                >
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
                            {transaction.clientId && (
                              <span className="ml-2 text-xs text-primary-600 font-medium">→ Click to view client analytics</span>
                            )}
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
                            <p className="text-lg font-bold text-gray-900">
                              {formatCurrency(
                                stylistItems.reduce((sum, item) => {
                                  return sum + (item.price || item.adjustedPrice || 0) * (item.quantity || 1);
                                }, 0)
                              )}
                            </p>
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
