/**
 * Appointments Page - Stylist
 * Mobile-ready view for stylists to view their assigned appointments
 * Status updates are managed by receptionists only
 */

import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, Mail, AlertCircle, Eye, Scissors } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getAppointmentsByStylist,
  getStylistTodayStats,
  getAppointmentById,
  APPOINTMENT_STATUS 
} from '../../services/appointmentService';
import { formatDate, formatTime } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import AppointmentDetails from '../../components/appointment/AppointmentDetails';

const StylistAppointments = () => {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('today');
  const [stats, setStats] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pageSize] = useState(20);

  useEffect(() => {
    if (currentUser) {
      fetchAppointments(false);
      fetchStats();
    }
  }, [currentUser]);

  // Refetch when filter changes
  useEffect(() => {
    if (currentUser && appointments.length > 0) {
      // Filter is applied client-side, no need to refetch
    }
  }, [filter]);

  const fetchStats = async () => {
    try {
      const statsData = await getStylistTodayStats(currentUser.uid);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchAppointments = async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setAppointments([]);
        setHasMore(true);
      }

      const data = await getAppointmentsByStylist(currentUser.uid);
      
      // For big data, limit initial load and implement pagination
      if (!loadMore) {
        // Initial load - show first page
        const initialData = data.slice(0, pageSize);
        setAppointments(initialData);
        setHasMore(data.length > pageSize);
      } else {
        // Load more - append next page
        const startIndex = appointments.length;
        const nextPage = data.slice(startIndex, startIndex + pageSize);
        setAppointments(prev => [...prev, ...nextPage]);
        setHasMore(startIndex + pageSize < data.length);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const getFilteredAppointments = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return appointments.filter(apt => {
      const aptDate = new Date(apt.appointmentDate);
      
      switch (filter) {
        case 'today':
          return aptDate >= today && aptDate < tomorrow;
        case 'upcoming':
          return aptDate >= now && apt.status !== APPOINTMENT_STATUS.COMPLETED && apt.status !== APPOINTMENT_STATUS.CANCELLED;
        case 'completed':
          return apt.status === APPOINTMENT_STATUS.COMPLETED;
        default:
          return true;
      }
    }).sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));
  };

  const filteredAppointments = getFilteredAppointments();

  const getStatusColor = (status) => {
    switch (status) {
      case APPOINTMENT_STATUS.PENDING:
      case APPOINTMENT_STATUS.CONFIRMED:
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case APPOINTMENT_STATUS.IN_SERVICE:
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case APPOINTMENT_STATUS.COMPLETED:
        return 'bg-green-100 text-green-700 border-green-200';
      case APPOINTMENT_STATUS.CANCELLED:
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    return status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const handleViewDetails = async (appointment) => {
    try {
      setLoadingDetails(true);
      // Fetch full appointment details including history
      const fullAppointment = await getAppointmentById(appointment.id);
      setSelectedAppointment(fullAppointment);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching appointment details:', error);
      // If fetching fails, use the appointment data we already have
      setSelectedAppointment(appointment);
      setShowDetailsModal(true);
    } finally {
      setLoadingDetails(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Appointments</h1>
        <p className="text-gray-600">Manage your daily schedule</p>
      </div>

      {/* Stats Cards - Mobile Optimized */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Today</p>
          <p className="text-2xl font-bold text-gray-900">{stats.today}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Pending</p>
          <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">In Service</p>
          <p className="text-2xl font-bold text-purple-600">{stats.inService}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Completed</p>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
        </div>
      </div>

      {/* Filter Tabs - Mobile Optimized */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('today')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'today'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'upcoming'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'completed'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Appointments List - Minimal Cards with Gaps */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          My Appointments ({filteredAppointments.length})
        </h2>
        {filteredAppointments.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-lg border border-gray-100">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No appointments found</p>
            <p className="text-sm text-gray-400 mt-1">
              {filter === 'today'
                ? 'No appointments scheduled for today'
                : filter === 'upcoming'
                ? 'No upcoming appointments'
                : filter === 'completed'
                ? 'No completed appointments'
                : 'No appointments found'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAppointments.map((appointment) => {
              // Get services assigned to this stylist
              const myServices = appointment.services && appointment.services.length > 0
                ? appointment.services.filter(svc => svc.stylistId === currentUser.uid)
                : [];

              return (
                <div 
                  key={appointment.id} 
                  onClick={() => handleViewDetails(appointment)}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm hover:border-primary-300 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {appointment.clientName || 'Guest Client'}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                          {getStatusLabel(appointment.status)}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        {myServices.length > 0 ? (
                          <div className="text-sm text-gray-700">
                            {myServices.map((service, index) => (
                              <div key={index} className="text-gray-900 font-medium">
                                {service.serviceName || 'Unknown Service'}
                              </div>
                            ))}
                          </div>
                        ) : appointment.serviceName ? (
                          <div className="text-sm text-gray-900 font-medium">
                            {appointment.serviceName}
                          </div>
                        ) : null}

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formatDate(appointment.appointmentDate)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatTime(appointment.appointmentDate)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetails(appointment);
                      }}
                      disabled={loadingDetails}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                      title="View Full Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Load More Button */}
            {hasMore && (
              <div className="pt-2 text-center">
                <button
                  onClick={() => fetchAppointments(true)}
                  disabled={loadingMore}
                  className="px-6 py-2 text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Appointment Details Modal */}
      {showDetailsModal && selectedAppointment && (
        <AppointmentDetails
          appointment={selectedAppointment}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedAppointment(null);
          }}
        />
      )}
    </div>
  );
};

export default StylistAppointments;
