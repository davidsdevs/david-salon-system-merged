/**
 * Check-Ins Page - Stylist
 * View client arrivals assigned to this stylist
 */

import { useState, useEffect, useMemo } from 'react';
import { Clock, User, Phone, Mail, Search, Filter, Calendar, MapPin, Scissors, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, getDoc, doc, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { formatDate, formatTime } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import CheckInDetails from '../../components/checkin/CheckInDetails';
import toast from 'react-hot-toast';

const StylistCheckIns = () => {
  const { currentUser, userBranch } = useAuth();
  const [checkIns, setCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('time-asc');
  const [selectedCheckIn, setSelectedCheckIn] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid || !userBranch) {
      setLoading(false);
      return;
    }

    let unsubscribe = null;

    const setupListener = () => {
      unsubscribe = setupRealtimeListener();
    };

    fetchCheckIns();
    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser?.uid, userBranch]);

  const fetchCheckIns = async () => {
    try {
      setLoading(true);
      const checkInsRef = collection(db, 'check-in');
      
      // Get today's check-ins for this branch
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let snapshot;
      try {
        const q = query(
          checkInsRef,
          where('branchId', '==', userBranch),
          where('arrivedAt', '>=', Timestamp.fromDate(today)),
          where('arrivedAt', '<', Timestamp.fromDate(tomorrow)),
          orderBy('arrivedAt', 'asc')
        );
        snapshot = await getDocs(q);
      } catch (orderByError) {
        // If orderBy fails (missing index), fetch without orderBy
        console.warn('OrderBy failed, fetching without orderBy:', orderByError.message);
        const q = query(
          checkInsRef,
          where('branchId', '==', userBranch),
          where('arrivedAt', '>=', Timestamp.fromDate(today)),
          where('arrivedAt', '<', Timestamp.fromDate(tomorrow))
        );
        snapshot = await getDocs(q);
      }
      const checkInsData = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        // Check if this check-in belongs to the current stylist
        let isStylistCheckIn = false;
        
        // Check stylistId field directly
        if (data.stylistId === currentUser.uid) {
          isStylistCheckIn = true;
        }
        
        // Check services array for stylistId
        if (data.services && Array.isArray(data.services)) {
          const hasStylist = data.services.some(service => service.stylistId === currentUser.uid);
          if (hasStylist) {
            isStylistCheckIn = true;
          }
        }
        
        // If still not found, check appointment
        if (!isStylistCheckIn && data.appointmentId) {
          isStylistCheckIn = await checkAppointmentStylist(data.appointmentId);
        }

        // Filter by status - only show arrived and in_service
        const checkInStatus = (data.status || '').toLowerCase();
        const allowedStatuses = ['arrived', 'in_service', 'in-service', 'in_progress', 'completed'];
        
        if (isStylistCheckIn && allowedStatuses.includes(checkInStatus)) {
          checkInsData.push({
            id: docSnap.id,
            ...data,
            arrivedAt: data.arrivedAt?.toDate?.() || new Date(data.arrivedAt)
          });
        }
      }

      // Sort by arrival time if orderBy wasn't used
      checkInsData.sort((a, b) => {
        const timeA = a.arrivedAt?.getTime() || 0;
        const timeB = b.arrivedAt?.getTime() || 0;
        return timeA - timeB;
      });

      setCheckIns(checkInsData);
    } catch (error) {
      console.error('Error fetching check-ins:', error);
      toast.error('Failed to load check-ins');
    } finally {
      setLoading(false);
    }
  };

  const checkAppointmentStylist = async (appointmentId) => {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      const appointmentSnap = await getDoc(appointmentRef);
      
      if (appointmentSnap.exists()) {
        const appointmentData = appointmentSnap.data();
        // Check if stylist is assigned in appointment
        return appointmentData.stylistId === currentUser.uid ||
               (appointmentData.services && appointmentData.services.some(s => s.stylistId === currentUser.uid));
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const setupRealtimeListener = () => {
    if (!currentUser?.uid || !userBranch) return;

    const checkInsRef = collection(db, 'check-in');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let q;
    try {
      q = query(
        checkInsRef,
        where('branchId', '==', userBranch),
        where('arrivedAt', '>=', Timestamp.fromDate(today)),
        where('arrivedAt', '<', Timestamp.fromDate(tomorrow)),
        orderBy('arrivedAt', 'asc')
      );
    } catch (orderByError) {
      // If orderBy fails (missing index), query without orderBy
      console.warn('OrderBy failed in real-time listener, using without orderBy:', orderByError.message);
      q = query(
        checkInsRef,
        where('branchId', '==', userBranch),
        where('arrivedAt', '>=', Timestamp.fromDate(today)),
        where('arrivedAt', '<', Timestamp.fromDate(tomorrow))
      );
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const checkInsData = [];
      const appointmentChecks = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        // Check if this check-in belongs to the current stylist
        let isStylistCheckIn = false;
        
        // Check stylistId field directly
        if (data.stylistId === currentUser.uid) {
          isStylistCheckIn = true;
        }
        
        // Check services array for stylistId
        if (data.services && Array.isArray(data.services)) {
          const hasStylist = data.services.some(service => service.stylistId === currentUser.uid);
          if (hasStylist) {
            isStylistCheckIn = true;
          }
        }
        
        // If still not found, check appointment
        if (!isStylistCheckIn && data.appointmentId) {
          appointmentChecks.push({ docSnap, data });
        } else if (isStylistCheckIn) {
          // Filter by status - only show arrived and in_service
          const checkInStatus = (data.status || '').toLowerCase();
          const allowedStatuses = ['arrived', 'in_service', 'in-service', 'in_progress', 'completed'];
          
          if (allowedStatuses.includes(checkInStatus)) {
            checkInsData.push({
              id: docSnap.id,
              ...data,
              arrivedAt: data.arrivedAt?.toDate?.() || new Date(data.arrivedAt)
            });
          }
        }
      }

      // Check appointments asynchronously
      for (const { docSnap, data } of appointmentChecks) {
        const isAssigned = await checkAppointmentStylist(data.appointmentId);
        if (isAssigned) {
          const checkInStatus = (data.status || '').toLowerCase();
          const allowedStatuses = ['arrived', 'in_service', 'in-service', 'in_progress', 'completed'];
          
          if (allowedStatuses.includes(checkInStatus)) {
            checkInsData.push({
              id: docSnap.id,
              ...data,
              arrivedAt: data.arrivedAt?.toDate?.() || new Date(data.arrivedAt)
            });
          }
        }
      }

      // Sort by arrival time if orderBy wasn't used
      checkInsData.sort((a, b) => {
        const timeA = a.arrivedAt?.getTime() || 0;
        const timeB = b.arrivedAt?.getTime() || 0;
        return timeA - timeB;
      });

      setCheckIns(checkInsData);
      setLoading(false);
    }, (error) => {
      console.error('Error in real-time listener:', error);
      setLoading(false);
    });

    return unsubscribe;
  };

  const filteredCheckIns = useMemo(() => {
    let filtered = [...checkIns];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(checkIn =>
        checkIn.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checkIn.clientPhone?.includes(searchTerm) ||
        checkIn.clientEmail?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(checkIn => checkIn.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const timeA = a.arrivedAt?.getTime() || 0;
      const timeB = b.arrivedAt?.getTime() || 0;

      switch (sortBy) {
        case 'time-asc':
          return timeA - timeB;
        case 'time-desc':
          return timeB - timeA;
        case 'client-asc':
          return (a.clientName || '').localeCompare(b.clientName || '');
        case 'client-desc':
          return (b.clientName || '').localeCompare(a.clientName || '');
        default:
          return timeA - timeB;
      }
    });

    return filtered;
  }, [checkIns, searchTerm, statusFilter, sortBy]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'arrived':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in_service':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    return status?.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'Unknown';
  };

  const getClientType = (checkIn) => {
    // Check if walk-in
    if (checkIn.isWalkIn === true) {
      return { label: 'Walk-in', color: 'bg-green-100 text-green-700 border-green-200' };
    }
    
    // Check if guest (no clientId)
    if (!checkIn.clientId) {
      return { label: 'Guest', color: 'bg-gray-100 text-gray-700 border-gray-200' };
    }
    
    // Check service clientType (X-New, R-Regular, TR-Transfer, etc.)
    if (checkIn.services && Array.isArray(checkIn.services) && checkIn.services.length > 0) {
      // Get clientType from first service (usually all services have same clientType)
      const clientType = checkIn.services[0]?.clientType;
      if (clientType) {
        if (clientType === 'X' || clientType === 'X-New' || clientType.startsWith('X')) {
          return { label: 'X-New', color: 'bg-blue-100 text-blue-700 border-blue-200' };
        }
        if (clientType === 'R' || clientType === 'R-Regular' || clientType.startsWith('R')) {
          return { label: 'R-Regular', color: 'bg-purple-100 text-purple-700 border-purple-200' };
        }
        if (clientType === 'TR' || clientType.startsWith('TR')) {
          return { label: 'TR-Transfer', color: 'bg-orange-100 text-orange-700 border-orange-200' };
        }
        // Return the clientType as-is if it doesn't match known patterns
        return { label: clientType, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
      }
    }
    
    // Check check-in level clientType
    if (checkIn.clientType) {
      const clientType = checkIn.clientType;
      if (clientType === 'X' || clientType === 'X-New' || clientType.startsWith('X')) {
        return { label: 'X-New', color: 'bg-blue-100 text-blue-700 border-blue-200' };
      }
      if (clientType === 'R' || clientType === 'R-Regular' || clientType.startsWith('R')) {
        return { label: 'R-Regular', color: 'bg-purple-100 text-purple-700 border-purple-200' };
      }
      if (clientType === 'TR' || clientType.startsWith('TR')) {
        return { label: 'TR-Transfer', color: 'bg-orange-100 text-orange-700 border-orange-200' };
      }
      return { label: clientType, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
    }
    
    // Default: Registered client
    return { label: 'Registered', color: 'bg-primary-100 text-primary-700 border-primary-200' };
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
        <h1 className="text-2xl font-bold text-gray-900">Client Check-Ins</h1>
        <p className="text-gray-600">View clients who have arrived for their appointments</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by client name, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Status</option>
            <option value="arrived">Arrived</option>
            <option value="in_service">In Service</option>
            <option value="completed">Completed</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="time-asc">Time: Earliest First</option>
            <option value="time-desc">Time: Latest First</option>
            <option value="client-asc">Client: A-Z</option>
            <option value="client-desc">Client: Z-A</option>
          </select>
        </div>
      </div>

      {/* Check-Ins List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Today's Check-Ins ({filteredCheckIns.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {filteredCheckIns.length === 0 ? (
            <div className="p-12 text-center">
              <User className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No check-ins found</p>
              <p className="text-sm text-gray-400 mt-1">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No clients have checked in yet today'}
              </p>
            </div>
          ) : (
            filteredCheckIns.map((checkIn) => (
              <div key={checkIn.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{checkIn.clientName || 'Guest Client'}</h3>
                          {(() => {
                            const clientType = getClientType(checkIn);
                            return (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${clientType.color}`}>
                                {clientType.label}
                              </span>
                            );
                          })()}
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(checkIn.status)}`}>
                            {getStatusLabel(checkIn.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-13 space-y-3">
                      {/* Services - Must See */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Scissors className="w-4 h-4 text-primary-600" />
                          <span className="text-sm font-semibold text-gray-900">Services</span>
                        </div>
                        {checkIn.services && Array.isArray(checkIn.services) && checkIn.services.length > 0 ? (
                          <div className="space-y-2">
                            {checkIn.services.map((service, index) => {
                              const isMyService = service.stylistId === currentUser.uid;
                              return (
                                <div 
                                  key={index} 
                                  className={`rounded-lg p-3 border-2 ${
                                    isMyService 
                                      ? 'bg-primary-100 border-primary-400' 
                                      : 'bg-gray-50 border-gray-200'
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <div className={`font-semibold text-sm ${
                                          isMyService ? 'text-primary-900' : 'text-gray-900'
                                        }`}>
                                          {service.serviceName || 'Unknown Service'}
                                        </div>
                                        {isMyService && (
                                          <span className="px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full font-medium">
                                            Your Service
                                          </span>
                                        )}
                                      </div>
                                      {service.price && (
                                        <div className={`text-xs mt-1 ${
                                          isMyService ? 'text-primary-700' : 'text-gray-600'
                                        }`}>
                                          ₱{parseFloat(service.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                    </div>
                                    {service.stylistName && service.stylistId !== currentUser.uid && (
                                      <div className="text-xs text-gray-500 ml-2">
                                        {service.stylistName}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : checkIn.serviceName ? (
                          <div className="bg-primary-100 border-2 border-primary-400 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-primary-900 text-sm">
                                {checkIn.serviceName}
                              </div>
                              <span className="px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full font-medium">
                                Your Service
                              </span>
                            </div>
                            {checkIn.servicePrice && (
                              <div className="text-xs text-primary-700 mt-1">
                                ₱{parseFloat(checkIn.servicePrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">No services listed</div>
                        )}
                      </div>

                      <div className="space-y-2 pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>Arrived: {formatTime(checkIn.arrivedAt)}</span>
                          <span className="text-gray-400">•</span>
                          <span>{formatDate(checkIn.arrivedAt)}</span>
                        </div>
                        
                        {checkIn.clientPhone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-4 h-4" />
                            <a href={`tel:${checkIn.clientPhone}`} className="text-primary-600 hover:underline">
                              {checkIn.clientPhone}
                            </a>
                          </div>
                        )}
                        
                        {checkIn.clientEmail && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4" />
                            <a href={`mailto:${checkIn.clientEmail}`} className="text-primary-600 hover:underline truncate">
                              {checkIn.clientEmail}
                            </a>
                          </div>
                        )}

                        {checkIn.appointmentId && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            <span>Appointment ID: {checkIn.appointmentId.substring(0, 8)}...</span>
                          </div>
                        )}

                        {checkIn.notes && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                            <strong>Notes:</strong> {checkIn.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCheckIn(checkIn);
                      setShowDetailsModal(true);
                    }}
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="View Full Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Check-In Details Modal */}
      {showDetailsModal && selectedCheckIn && (
        <CheckInDetails
          checkIn={selectedCheckIn}
          currentUserId={currentUser?.uid}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedCheckIn(null);
          }}
        />
      )}
    </div>
  );
};

export default StylistCheckIns;

