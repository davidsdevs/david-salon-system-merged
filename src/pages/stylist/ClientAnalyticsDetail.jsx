/**
 * Client Analytics Detail Page - Stylist
 * Detailed view of a specific client's analytics and service history
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Scissors, 
  Receipt,
  Clock,
  MapPin
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getClientById, getClientProfile } from '../../services/clientService';
import { formatDate, formatTime, formatCurrency, getFullName, getInitials } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const ClientAnalyticsDetail = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState(null);
  const [clientProfile, setClientProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalSpent: 0,
    totalCommission: 0,
    serviceCount: 0,
    transactionCount: 0,
    averageTransaction: 0,
    lastVisit: null,
    firstVisit: null,
    services: [],
    branches: []
  });

  useEffect(() => {
    if (clientId && currentUser?.uid) {
      fetchClientData();
    }
  }, [clientId, currentUser]);

  const fetchClientData = async () => {
    try {
      setLoading(true);
      
      // Fetch client data
      const clientData = await getClientById(clientId);
      const profileData = await getClientProfile(clientId);
      setClient(clientData);
      setClientProfile(profileData);

      // Fetch transactions for this client and stylist
      const transactionsRef = collection(db, 'transactions');
      let q;
      try {
        q = query(
          transactionsRef,
          where('clientId', '==', clientId),
          orderBy('createdAt', 'desc')
        );
      } catch (orderByError) {
        // Fallback without orderBy
        q = query(
          transactionsRef,
          where('clientId', '==', clientId)
        );
      }

      const snapshot = await getDocs(q);
      const transactionsData = [];
      const servicesSet = new Set();
      const branchesSet = new Set();
      let totalSpent = 0;
      let totalCommission = 0;
      let serviceCount = 0;
      let firstVisit = null;
      let lastVisit = null;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
        
        // Check if transaction has items for this stylist
        const stylistItems = [];
        if (data.items && Array.isArray(data.items)) {
          data.items.forEach((item) => {
            const itemStylistId = item.stylistId || data.stylistId;
            if (itemStylistId === currentUser.uid) {
              stylistItems.push(item);
              if ((item.type || 'service') === 'service') {
                serviceCount++;
                const serviceName = item.name || item.serviceName || 'Unknown Service';
                servicesSet.add(serviceName);
              }
            }
          });
        } else if (data.services && Array.isArray(data.services)) {
          data.services.forEach((service) => {
            const serviceStylistId = service.stylistId || data.stylistId;
            if (serviceStylistId === currentUser.uid) {
              stylistItems.push({
                ...service,
                type: 'service'
              });
              serviceCount++;
              const serviceName = service.serviceName || service.name || 'Unknown Service';
              servicesSet.add(serviceName);
            }
          });
        }

        if (stylistItems.length > 0) {
          if (data.branchId) branchesSet.add(data.branchId);
          if (data.branchName) branchesSet.add(data.branchName);

          const transactionTotal = stylistItems.reduce((sum, item) => {
            return sum + (item.price || item.adjustedPrice || 0) * (item.quantity || 1);
          }, 0);
          
          const transactionCommission = stylistItems.reduce((sum, item) => {
            if (item.commission !== undefined) {
              return sum + item.commission;
            }
            const itemType = item.type || 'service';
            const itemTotal = (item.price || item.adjustedPrice || 0) * (item.quantity || 1);
            const commissionRate = itemType === 'service' ? 0.6 : 0.1;
            return sum + (itemTotal * commissionRate);
          }, 0);

          totalSpent += transactionTotal;
          totalCommission += transactionCommission;

          if (!firstVisit || createdAt < firstVisit) {
            firstVisit = createdAt;
          }
          if (!lastVisit || createdAt > lastVisit) {
            lastVisit = createdAt;
          }

          transactionsData.push({
            id: doc.id,
            ...data,
            createdAt,
            stylistItems,
            transactionTotal,
            transactionCommission
          });
        }
      });

      // Sort by date if orderBy wasn't used
      transactionsData.sort((a, b) => {
        const timeA = a.createdAt?.getTime() || 0;
        const timeB = b.createdAt?.getTime() || 0;
        return timeB - timeA;
      });

      setTransactions(transactionsData);
      setAnalytics({
        totalSpent,
        totalCommission,
        serviceCount,
        transactionCount: transactionsData.length,
        averageTransaction: transactionsData.length > 0 ? totalSpent / transactionsData.length : 0,
        lastVisit,
        firstVisit,
        services: Array.from(servicesSet).sort(),
        branches: Array.from(branchesSet)
      });

    } catch (error) {
      console.error('Error fetching client data:', error);
      toast.error('Failed to load client analytics');
    } finally {
      setLoading(false);
    }
  };

  const calculateCommission = (transaction) => {
    return transaction.transactionCommission || 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!client && !clientProfile) {
    return (
      <div className="text-center py-12">
        <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Client not found</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          Go back
        </button>
      </div>
    );
  }

  const clientName = client?.firstName && client?.lastName 
    ? getFullName(client) 
    : client?.name || clientProfile?.name || 'Unknown Client';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Analytics</h1>
          <p className="text-gray-600">Detailed service history and analytics</p>
        </div>
      </div>

      {/* Client Info Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            {client?.photoURL || client?.imageURL || clientProfile?.photoURL ? (
              <img 
                src={client?.photoURL || client?.imageURL || clientProfile?.photoURL} 
                alt={clientName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-primary-600 font-bold text-2xl">
                {getInitials(client || clientProfile || { firstName: clientName })}
              </span>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{clientName}</h2>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              {(client?.phone || clientProfile?.phone) && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span>{client?.phone || clientProfile?.phone}</span>
                </div>
              )}
              {(client?.email || clientProfile?.email) && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{client?.email || clientProfile?.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.totalSpent)}</p>
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
              <p className="text-2xl font-bold text-green-600">{formatCurrency(analytics.totalCommission)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Services Rendered</p>
              <p className="text-2xl font-bold text-purple-600">{analytics.serviceCount}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Scissors className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Transactions</p>
              <p className="text-2xl font-bold text-indigo-600">{analytics.transactionCount}</p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-full">
              <Receipt className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500 mb-1">Average Transaction</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(analytics.averageTransaction)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500 mb-1">First Visit</p>
          <p className="text-xl font-bold text-gray-900">
            {analytics.firstVisit ? formatDate(analytics.firstVisit) : 'N/A'}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500 mb-1">Last Visit</p>
          <p className="text-xl font-bold text-gray-900">
            {analytics.lastVisit ? formatDate(analytics.lastVisit) : 'N/A'}
          </p>
        </div>
      </div>

      {/* Services & Branches */}
      {(analytics.services.length > 0 || analytics.branches.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analytics.services.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Scissors className="w-5 h-5 text-primary-600" />
                Services Provided
              </h3>
              <div className="flex flex-wrap gap-2">
                {analytics.services.map((service, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium"
                  >
                    {service}
                  </span>
                ))}
              </div>
            </div>
          )}
          {analytics.branches.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-600" />
                Branches Visited
              </h3>
              <div className="flex flex-wrap gap-2">
                {analytics.branches.map((branch, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
                  >
                    {branch}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transaction History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Transaction History ({transactions.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {transactions.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No transactions found</p>
            </div>
          ) : (
            transactions.map((transaction) => {
              const commission = calculateCommission(transaction);
              const stylistItems = transaction.stylistItems || [];
              
              return (
                <div key={transaction.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <Receipt className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">
                            Transaction #{transaction.receiptNumber || transaction.id.substring(0, 8)}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(transaction.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatTime(transaction.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {stylistItems.length > 0 && (
                        <div className="ml-13 mt-2">
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

                      <div className="flex items-center gap-4 pt-2 mt-2 border-t border-gray-200">
                        <div>
                          <p className="text-xs text-gray-500">Total Sale</p>
                          <p className="text-lg font-bold text-gray-900">{formatCurrency(transaction.transactionTotal || 0)}</p>
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
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientAnalyticsDetail;

