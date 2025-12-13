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

      {/* Appointments List - Using Check-Ins Layout */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            My Appointments ({filteredAppointments.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {filteredAppointments.length === 0 ? (
            <div className="p-12 text-center">
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
            <>
              {filteredAppointments.map((appointment) => {
                // Get services assigned to this stylist
                const myServices = appointment.services && appointment.services.length > 0
                  ? appointment.services.filter(svc => svc.stylistId === currentUser.uid)
                  : [];

                return (
                  <div key={appointment.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{appointment.clientName || 'Guest Client'}</h3>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(appointment.status)}`}>
                              {getStatusLabel(appointment.status)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="ml-13 space-y-3">
                          {/* Services - Must See */}
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Scissors className="w-4 h-4 text-primary-600" />
                              <span className="text-sm font-semibold text-gray-900">Services</span>
                            </div>
                            {myServices.length > 0 ? (
                              <div className="space-y-2">
                                {myServices.map((service, index) => (
                                  <div 
                                    key={index} 
                                    className="bg-primary-100 border-2 border-primary-400 rounded-lg p-3"
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <div className="font-semibold text-sm text-primary-900">
                                            {service.serviceName || 'Unknown Service'}
                                          </div>
                                          <span className="px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full font-medium">
                                            Your Service
                                          </span>
                                        </div>
                                        {service.price && (
                                          <div className="text-xs mt-1 text-primary-700">
                                            ₱{parseFloat(service.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </div>
                                        )}
                                        {service.duration && (
                                          <div className="text-xs mt-1 text-primary-700">
                                            {service.duration} minutes
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : appointment.serviceName ? (
                              <div className="bg-primary-100 border-2 border-primary-400 rounded-lg p-3">
                                <div className="flex items-center gap-2">
                                  <div className="font-semibold text-sm text-primary-900">
                                    {appointment.serviceName}
                                  </div>
                                  <span className="px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full font-medium">
                                    Your Service
                                  </span>
                                </div>
                                {appointment.servicePrice && (
                                  <div className="text-xs mt-1 text-primary-700">
                                    ₱{parseFloat(appointment.servicePrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500 italic">No services listed</div>
                            )}
                          </div>

                          <div className="space-y-2 pt-2 border-t border-gray-200">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="w-4 h-4" />
                              <span>{formatDate(appointment.appointmentDate)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="w-4 h-4" />
                              <span>{formatTime(appointment.appointmentDate)}</span>
                              {appointment.duration && (
                                <span className="text-gray-400">• {appointment.duration} mins</span>
                              )}
                            </div>
                            
                            {appointment.clientPhone && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone className="w-4 h-4" />
                                <a href={`tel:${appointment.clientPhone}`} className="text-primary-600 hover:underline">
                                  {appointment.clientPhone}
                                </a>
                              </div>
                            )}
                            
                            {appointment.clientEmail && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Mail className="w-4 h-4" />
                                <a href={`mailto:${appointment.clientEmail}`} className="text-primary-600 hover:underline truncate">
                                  {appointment.clientEmail}
                                </a>
                              </div>
                            )}

                            {appointment.notes && (
                              <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                                <strong>Notes:</strong> {appointment.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleViewDetails(appointment)}
                        disabled={loadingDetails}
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
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
                <div className="p-4 text-center border-t border-gray-200">
                  <button
                    onClick={() => fetchAppointments(true)}
                    disabled={loadingMore}
                    className="px-6 py-2 text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
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
