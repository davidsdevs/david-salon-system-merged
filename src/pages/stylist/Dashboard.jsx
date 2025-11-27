/**
 * Stylist Dashboard
 * Shows today's appointments, stats, and upcoming schedule
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getAppointmentsByStylist,
  getStylistTodayStats,
  APPOINTMENT_STATUS 
} from '../../services/appointmentService';
import { formatDate, formatTime, getFullName } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { ROUTES } from '../../utils/constants';

const StylistDashboard = () => {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [nextAppointment, setNextAppointment] = useState(null);

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
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate(ROUTES.STYLIST_APPOINTMENTS)}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:border-primary-300 hover:shadow transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Calendar className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">View Appointments</p>
              <p className="text-sm text-gray-500">Manage your schedule</p>
            </div>
          </div>
        </button>
        
        <button
          onClick={() => navigate('/stylist/leave-management')}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:border-primary-300 hover:shadow transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Leave Requests</p>
              <p className="text-sm text-gray-500">Request time off</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default StylistDashboard;
