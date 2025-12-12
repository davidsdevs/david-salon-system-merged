/**
 * Stylist Dashboard
 * Shows today's appointments, stats, and upcoming schedule
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, CheckCircle, AlertCircle, ChevronRight, Tag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getAppointmentsByStylist,
  getStylistTodayStats,
  APPOINTMENT_STATUS 
} from '../../services/appointmentService';
import { formatDate, formatTime, getFullName } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { ROUTES } from '../../utils/constants';
import { collection, query, where, getDocs, getDoc, doc, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';

const StylistDashboard = () => {
  const { currentUser, userData, userBranch } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [nextAppointment, setNextAppointment] = useState(null);
  const [clientTypeStats, setClientTypeStats] = useState({ X: 0, R: 0, TR: 0 });

  useEffect(() => {
    if (currentUser?.uid) {
      fetchDashboardData();
    }
  }, [currentUser]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch stats
      const statsData = await getStylistTodayStats(currentUser.uid);
      setStats(statsData);
      
      // Fetch appointments
      const appointments = await getAppointmentsByStylist(currentUser.uid);
      
      // Filter today's appointments
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayAppts = appointments.filter(apt => {
        const aptDate = new Date(apt.appointmentDate);
        return aptDate >= today && aptDate < tomorrow;
      }).sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));
      
      setTodayAppointments(todayAppts);
      
      // Find next upcoming appointment
      const upcoming = appointments
        .filter(apt => {
          const aptDate = new Date(apt.appointmentDate);
          return aptDate >= now && 
                 apt.status !== APPOINTMENT_STATUS.COMPLETED && 
                 apt.status !== APPOINTMENT_STATUS.CANCELLED;
        })
        .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));
      
      setNextAppointment(upcoming[0] || null);
      
      // Fetch today's check-ins for client type analytics
      await fetchClientTypeAnalytics();
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientTypeAnalytics = async () => {
    try {
      if (!currentUser?.uid || !userBranch) return;

      const checkInsRef = collection(db, 'check-in');
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
        const q = query(
          checkInsRef,
          where('branchId', '==', userBranch),
          where('arrivedAt', '>=', Timestamp.fromDate(today)),
          where('arrivedAt', '<', Timestamp.fromDate(tomorrow))
        );
        snapshot = await getDocs(q);
      }

      const counts = { X: 0, R: 0, TR: 0 };

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
          try {
            const appointmentRef = doc(db, 'appointments', data.appointmentId);
            const appointmentSnap = await getDoc(appointmentRef);
            if (appointmentSnap.exists()) {
              const appointmentData = appointmentSnap.data();
              isStylistCheckIn = appointmentData.stylistId === currentUser.uid ||
                                 (appointmentData.services && appointmentData.services.some(s => s.stylistId === currentUser.uid));
            }
          } catch (error) {
            // Skip if appointment fetch fails
          }
        }

        // Only count check-ins assigned to this stylist
        if (isStylistCheckIn) {
          // Check service clientType
          if (data.services && Array.isArray(data.services) && data.services.length > 0) {
            const clientType = data.services[0]?.clientType;
            if (clientType) {
              if (clientType === 'X' || clientType === 'X-New' || clientType.startsWith('X')) {
                counts.X++;
              } else if (clientType === 'R' || clientType === 'R-Regular' || clientType.startsWith('R')) {
                counts.R++;
              } else if (clientType === 'TR' || clientType.startsWith('TR')) {
                counts.TR++;
              }
            }
          } else if (data.clientType) {
            // Check check-in level clientType
            const clientType = data.clientType;
            if (clientType === 'X' || clientType === 'X-New' || clientType.startsWith('X')) {
              counts.X++;
            } else if (clientType === 'R' || clientType === 'R-Regular' || clientType.startsWith('R')) {
              counts.R++;
            } else if (clientType === 'TR' || clientType.startsWith('TR')) {
              counts.TR++;
            }
          }
        }
      }

      setClientTypeStats(counts);
    } catch (error) {
      console.error('Error fetching client type analytics:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case APPOINTMENT_STATUS.PENDING:
      case APPOINTMENT_STATUS.CONFIRMED:
        return 'bg-blue-100 text-blue-700';
      case APPOINTMENT_STATUS.IN_SERVICE:
        return 'bg-purple-100 text-purple-700';
      case APPOINTMENT_STATUS.COMPLETED:
        return 'bg-green-100 text-green-700';
      case APPOINTMENT_STATUS.CANCELLED:
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status) => {
    return status?.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'Unknown';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
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
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">
          {getGreeting()}, {userData?.firstName || 'Stylist'}!
        </h1>
        <p className="text-primary-100">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Today's Appointments</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.today || 0}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats?.pending || 0}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">In Service</p>
              <p className="text-2xl font-bold text-purple-600">{stats?.inService || 0}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <User className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats?.completed || 0}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Client Type Analytics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary-600" />
          Today's Client Types
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">X-New</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{clientTypeStats.X}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-full">
                <Tag className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">R-Regular</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">{clientTypeStats.R}</p>
              </div>
              <div className="p-2 bg-purple-100 rounded-full">
                <Tag className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">TR-Transfer</p>
                <p className="text-2xl font-bold text-orange-700 mt-1">{clientTypeStats.TR}</p>
              </div>
              <div className="p-2 bg-orange-100 rounded-full">
                <Tag className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Next Appointment Card */}
      {nextAppointment && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary-600" />
            Next Appointment
          </h2>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="font-medium text-gray-900 text-lg">
                {nextAppointment.clientName || 'Guest Client'}
              </p>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(nextAppointment.appointmentDate)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatTime(nextAppointment.appointmentDate)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {nextAppointment.services?.map((service, idx) => (
                  <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                    {service.serviceName}
                  </span>
                )) || (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                    {nextAppointment.serviceName || 'Service'}
                  </span>
                )}
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(nextAppointment.status)}`}>
              {getStatusLabel(nextAppointment.status)}
            </span>
          </div>
        </div>
      )}

      {/* Today's Schedule */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Today's Schedule</h2>
          <button
            onClick={() => navigate(ROUTES.STYLIST_APPOINTMENTS)}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
          >
            View All
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="divide-y divide-gray-100">
          {todayAppointments.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No appointments scheduled for today</p>
            </div>
          ) : (
            todayAppointments.slice(0, 5).map((appointment) => (
              <div key={appointment.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[60px]">
                      <p className="text-lg font-semibold text-gray-900">
                        {formatTime(appointment.appointmentDate)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {appointment.clientName || 'Guest Client'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {appointment.services?.map(s => s.serviceName).join(', ') || appointment.serviceName || 'Service'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                    {getStatusLabel(appointment.status)}
                  </span>
                </div>
              </div>
            ))
          )}
          {todayAppointments.length > 5 && (
            <div className="p-3 text-center">
              <button
                onClick={() => navigate(ROUTES.STYLIST_APPOINTMENTS)}
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                +{todayAppointments.length - 5} more appointments
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StylistDashboard;
