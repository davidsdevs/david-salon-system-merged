/**
 * Notifications Page - Stylist
 * View and manage notifications
 */

import { useState, useEffect } from 'react';
import { Bell, CheckCircle, X, Calendar, Clock, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, getUnreadNotificationCount } from '../../services/notificationService';
import { getAppointmentById } from '../../services/appointmentService';
import { formatDate, formatTime } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import AppointmentDetails from '../../components/appointment/AppointmentDetails';
import toast from 'react-hot-toast';

const StylistNotifications = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (currentUser?.uid) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [currentUser]);

  useEffect(() => {
    // Refresh unread count when notifications change
    if (currentUser?.uid) {
      fetchUnreadCount();
    }
  }, [notifications, currentUser]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const allNotifications = await getNotifications(currentUser.uid, {
        limitCount: 100,
        orderByField: 'createdAt',
        orderDirection: 'desc'
      });
      setNotifications(allNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const count = await getUnreadNotificationCount(currentUser.uid);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
      fetchUnreadCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead(currentUser.uid);
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      fetchUnreadCount();
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all notifications as read');
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      // Mark as read if unread
      if (!notification.isRead) {
        await handleMarkAsRead(notification.id);
      }

      // If it's an appointment notification, fetch and show appointment details
      if (notification.appointmentId) {
        setLoadingDetails(true);
        try {
          const appointment = await getAppointmentById(notification.appointmentId);
          setSelectedAppointment(appointment);
          setShowDetailsModal(true);
        } catch (error) {
          console.error('Error fetching appointment details:', error);
          toast.error('Failed to load appointment details');
        } finally {
          setLoadingDetails(false);
        }
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'appointment_created':
      case 'appointment_confirmed':
      case 'appointment_rescheduled':
        return Calendar;
      case 'appointment_cancelled':
        return X;
      case 'appointment_completed':
        return CheckCircle;
      default:
        return Bell;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'appointment_created':
      case 'appointment_confirmed':
        return 'bg-blue-100 text-blue-700';
      case 'appointment_cancelled':
        return 'bg-red-100 text-red-700';
      case 'appointment_completed':
        return 'bg-green-100 text-green-700';
      case 'appointment_rescheduled':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'unread') return !notif.isRead;
    if (filter === 'read') return notif.isRead;
    return true;
  });

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600 mt-1">Stay updated with your appointments and updates</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => setFilter('read')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'read'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Read ({notifications.length - unreadCount})
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {filter === 'unread' ? 'Unread Notifications' : filter === 'read' ? 'Read Notifications' : 'All Notifications'} ({filteredNotifications.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No notifications found</p>
              <p className="text-sm text-gray-400 mt-1">
                {filter === 'unread'
                  ? 'You have no unread notifications'
                  : filter === 'read'
                  ? 'You have no read notifications'
                  : 'You have no notifications yet'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const Icon = getNotificationIcon(notification.type);
              const colorClass = getNotificationColor(notification.type);
              const isAppointmentNotification = notification.appointmentId && 
                notification.type?.includes('appointment');
              
              return (
                <div
                  key={notification.id}
                  onClick={() => isAppointmentNotification && handleNotificationClick(notification)}
                  className={`p-4 transition-colors ${
                    !notification.isRead ? 'bg-blue-50/50' : ''
                  } ${
                    isAppointmentNotification 
                      ? 'hover:bg-gray-100 cursor-pointer' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">
                            {notification.title}
                          </h3>
                          <p className="text-sm text-gray-600 mb-2">
                            {notification.message}
                          </p>
                          {notification.appointmentDate && (
                            <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                              {notification.appointmentDate && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>{formatDate(notification.appointmentDate)}</span>
                                </div>
                              )}
                              {notification.appointmentTime && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatTime(notification.appointmentTime)}</span>
                                </div>
                              )}
                              {notification.clientName && (
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  <span>{notification.clientName}</span>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="text-xs text-gray-400 mt-2">
                            {notification.createdAt ? formatDate(notification.createdAt) : 'Recently'}
                          </div>
                        </div>
                        {!notification.isRead && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(notification.id);
                            }}
                            className="text-xs text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                    {!notification.isRead && (
                      <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              );
            })
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

export default StylistNotifications;

