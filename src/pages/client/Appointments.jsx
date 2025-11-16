/**
 * Appointments Page - Client
 * Self-service booking, rescheduling, and cancellation
 */

import { useState, useEffect } from 'react';
  import { Plus, Calendar, Clock, MapPin, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getAppointmentsByClient,
  createAppointment,
  cancelAppointment,
  getAvailableTimeSlots,
  APPOINTMENT_STATUS 
} from '../../services/appointmentService';
import { getAllBranches } from '../../services/branchService';
import { getBranchServices } from '../../services/branchServicesService';
import { getUsersByRole } from '../../services/userService';
import { USER_ROLES } from '../../utils/constants';
import { formatDate, formatTime } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import AppointmentCard from '../../components/appointment/AppointmentCard';
import ConfirmModal from '../../components/ui/ConfirmModal';
import ClientBookingModal from '../../components/appointment/ClientBookingModal';
import toast from 'react-hot-toast';

const ClientAppointments = () => {
  const { currentUser, userData } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  
  // Booking form state
  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [unavailableMessage, setUnavailableMessage] = useState(null);
  const [booking, setBooking] = useState(false);
  
  const [bookingData, setBookingData] = useState({
    branchId: '',
    serviceId: '',
    stylistId: '',
    date: '',
    timeSlot: null,
    notes: ''
  });

  useEffect(() => {
    if (currentUser) {
      fetchAppointments();
      fetchBranches();
    }
  }, [currentUser]);

  useEffect(() => {
    if (bookingData.branchId) {
      fetchBranchServices(bookingData.branchId);
      fetchBranchStylists(bookingData.branchId);
    }
  }, [bookingData.branchId]);

  useEffect(() => {
    if (bookingData.date && bookingData.serviceId && bookingData.branchId) {
      fetchAvailableSlots();
    }
  }, [bookingData.date, bookingData.serviceId, bookingData.stylistId]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const data = await getAppointmentsByClient(currentUser.uid);
      setAppointments(data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const data = await getAllBranches();
      setBranches(data.filter(b => b.isActive === true));
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchBranchServices = async (branchId) => {
    try {
      const data = await getBranchServices(branchId);
      setServices(data.filter(s => s.enabled));
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const fetchBranchStylists = async (branchId) => {
    try {
      const data = await getUsersByRole(USER_ROLES.STYLIST);
      setStylists(data.filter(s => s.branchId === branchId && s.isActive));
    } catch (error) {
      console.error('Error fetching stylists:', error);
      // Clients don't have permission to query stylists
      // Set empty array - stylist selection will be optional
      setStylists([]);
    }
  };

  const fetchAvailableSlots = async () => {
    try {
      setLoadingSlots(true);
      const service = services.find(s => s.id === bookingData.serviceId);
      const result = await getAvailableTimeSlots(
        bookingData.stylistId || null,
        bookingData.branchId,
        bookingData.date,
        service?.duration || 60
      );
      setAvailableSlots(result.slots || []);
      setUnavailableMessage(result.message || null);
    } catch (error) {
      console.error('Error fetching slots:', error);
      setAvailableSlots([]);
      setUnavailableMessage('Error loading time slots. Please try again.');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleBookAppointment = () => {
    setBookingData({
      branchId: '',
      serviceId: '',
      stylistId: '',
      date: '',
      timeSlot: null,
      notes: ''
    });
    setServices([]);
    setStylists([]);
    setAvailableSlots([]);
    setUnavailableMessage(null);
    setShowBookingModal(true);
  };

  const handleSubmitBooking = async () => {
    try {
      if (!bookingData.branchId || !bookingData.serviceId || !bookingData.timeSlot) {
        toast.error('Please fill in all required fields');
        return;
      }

      // Validate 2-hour advance notice
      const appointmentTime = new Date(bookingData.timeSlot.time);
      const now = new Date();
      const timeDiff = appointmentTime.getTime() - now.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff < 2) {
        toast.error('Appointments must be booked at least 2 hours in advance. Please select a later time.');
        return;
      }

      setBooking(true);
      
      const branch = branches.find(b => b.id === bookingData.branchId);
      const service = services.find(s => s.id === bookingData.serviceId);
      const stylist = stylists.find(s => s.id === bookingData.stylistId);

      const appointmentData = {
        clientId: currentUser.uid,
        clientName: `${userData.firstName} ${userData.lastName}`,
        clientEmail: userData.email,
        clientPhone: userData.phoneNumber || '',
        branchId: bookingData.branchId,
        branchName: branch?.name || branch?.branchName,
        services: [{
          serviceId: bookingData.serviceId,
          serviceName: service?.serviceName,
          stylistId: bookingData.stylistId || null,
          stylistName: stylist ? `${stylist.firstName} ${stylist.lastName}` : 'Any available',
          duration: service?.duration || 60,
          price: service?.price || 0
          // Note: No status field - appointment has status, not individual services
        }],
        appointmentDate: bookingData.timeSlot.time,
        duration: service?.duration || 60,
        totalPrice: service?.price || 0,
        status: APPOINTMENT_STATUS.PENDING,
        notes: bookingData.notes
      };

      await createAppointment(appointmentData, currentUser);
      setShowBookingModal(false);
      await fetchAppointments();
      // Toast is already shown by createAppointment service
    } catch (error) {
      console.error('Error booking appointment:', error);
    } finally {
      setBooking(false);
    }
  };

  const handleCancelAppointment = (appointment) => {
    setAppointmentToCancel(appointment);
    setCancellationReason('');
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
    if (!appointmentToCancel) return;
    
    try {
      await cancelAppointment(appointmentToCancel.id, cancellationReason || 'Cancelled by client', currentUser);
      setShowCancelModal(false);
      setAppointmentToCancel(null);
      await fetchAppointments();
    } catch (error) {
      console.error('Error cancelling appointment:', error);
    }
  };

  const getFilteredAppointments = (filter) => {
    const now = new Date();
    
    if (filter === 'upcoming') {
      return appointments.filter(apt => 
        new Date(apt.appointmentDate) >= now && 
        apt.status !== APPOINTMENT_STATUS.COMPLETED &&
        apt.status !== APPOINTMENT_STATUS.CANCELLED
      );
    } else if (filter === 'past') {
      return appointments.filter(apt => 
        new Date(apt.appointmentDate) < now ||
        apt.status === APPOINTMENT_STATUS.COMPLETED ||
        apt.status === APPOINTMENT_STATUS.CANCELLED
      );
    }
    return appointments;
  };

  const upcomingAppointments = getFilteredAppointments('upcoming');
  const pastAppointments = getFilteredAppointments('past');

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
          <h1 className="text-2xl font-bold text-gray-900">My Appointments</h1>
          <p className="text-gray-600">Book and manage your salon appointments</p>
        </div>
        <button
          onClick={handleBookAppointment}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Book Appointment
        </button>
      </div>

      {/* Upcoming Appointments */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Appointments</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {upcomingAppointments.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No upcoming appointments</p>
              <button
                onClick={handleBookAppointment}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Book your first appointment
              </button>
            </div>
          ) : (
            upcomingAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                onCancel={handleCancelAppointment}
                showActions={true}
              />
            ))
          )}
        </div>
      </div>

      {/* Past Appointments */}
      {pastAppointments.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Past Appointments</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastAppointments.slice(0, 6).map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                showActions={false}
              />
            ))}
          </div>
          {pastAppointments.length > 6 && (
            <p className="text-sm text-gray-500 text-center mt-4">
              Showing 6 of {pastAppointments.length} past appointments
            </p>
          )}
        </div>
      )}

      {/* Booking Modal */}
      <ClientBookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        bookingData={bookingData}
        setBookingData={setBookingData}
        branches={branches}
        services={services}
        stylists={stylists}
        availableSlots={availableSlots}
        loadingSlots={loadingSlots}
        unavailableMessage={unavailableMessage}
        booking={booking}
        onSubmit={handleSubmitBooking}
      />

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setAppointmentToCancel(null);
        }}
        onConfirm={confirmCancel}
        title="Cancel Appointment"
        message={`Are you sure you want to cancel your appointment on ${appointmentToCancel ? formatDate(appointmentToCancel.appointmentDate) : ''}?`}
        confirmText="Yes, Cancel"
        cancelText="Keep Appointment"
        type="danger"
      >
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for Cancellation (Optional)
          </label>
          <textarea
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Let us know why you're cancelling..."
          />
        </div>
      </ConfirmModal>
    </div>
  );
};

export default ClientAppointments;
