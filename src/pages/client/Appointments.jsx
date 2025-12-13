/**
 * Appointments Page - Client
 * Self-service booking, rescheduling, and cancellation
 */

import { useState, useEffect } from 'react';
  import { Plus, Calendar, Clock, MapPin, User, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getAppointmentsByClient,
  createAppointment,
  cancelAppointment,
  getAvailableTimeSlots,
  APPOINTMENT_STATUS 
} from '../../services/appointmentService';
import { getAllBranches } from '../../services/branchService';
import { getBranchServices, getServiceById } from '../../services/branchServicesService';
import { getUsersByRole } from '../../services/userService';
import { USER_ROLES } from '../../utils/constants';
import { formatDate, formatTime } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import AppointmentCard from '../../components/appointment/AppointmentCard';
import AppointmentDetails from '../../components/appointment/AppointmentDetails';
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
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDetailAppointment, setSelectedDetailAppointment] = useState(null);
  const [showBookingSummary, setShowBookingSummary] = useState(false);
  const [pendingAppointmentData, setPendingAppointmentData] = useState(null);
  
  const [bookingData, setBookingData] = useState({
    branchId: '',
    services: [], // Array of { serviceId, stylistId }
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
    // Fetch slots when date is selected and at least one service is selected
    if (bookingData.date && bookingData.services && bookingData.services.length > 0 && bookingData.branchId) {
      fetchAvailableSlots();
    }
  }, [bookingData.date, bookingData.services, bookingData.branchId]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const data = await getAppointmentsByClient(currentUser.uid);
      if (data && Array.isArray(data)) {
        setAppointments(data);
      } else {
        console.warn('No appointments data returned or invalid format');
        setAppointments([]);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast.error('Failed to load appointments. Please try again.');
      setAppointments([]);
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
      // Services are already filtered by branchPricing in getBranchServices
      // Only show active services that have pricing for this branch
      setServices(data.filter(s => s.isActive && s.price !== undefined && s.price !== null));
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load services');
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
      // Calculate total duration from all selected services
      const totalDuration = bookingData.services.reduce((sum, serviceItem) => {
        const service = services.find(s => s.id === serviceItem.serviceId);
        return sum + (service?.duration || 60);
      }, 0);
      
      // Use first service's stylist preference, or null if no preference
      const preferredStylistId = bookingData.services[0]?.stylistId || null;
      
      const result = await getAvailableTimeSlots(
        preferredStylistId,
        bookingData.branchId,
        bookingData.date,
        totalDuration || 60
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
      services: [],
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

  const handleSubmitBooking = () => {
    // Prepare appointment data and show summary modal instead of submitting directly
    if (!bookingData.branchId || !bookingData.services || bookingData.services.length === 0 || !bookingData.timeSlot) {
      toast.error('Please fill in all required fields');
      return;
    }

    const branch = branches.find(b => b.id === bookingData.branchId);
    
    // Validate all services and build services array
    const servicesArray = [];
    let totalPrice = 0;
    let totalDuration = 0;
    
    for (const serviceItem of bookingData.services) {
      const service = services.find(s => s.id === serviceItem.serviceId);
      
      if (!service) {
        toast.error('One or more selected services are not available for this branch. Please pick valid services.');
        return;
      }
      
      // Ensure price exists for this branch
      const branchPrice = service.price ?? (service.branchPricing ? service.branchPricing[bookingData.branchId] : undefined);
      if (branchPrice === undefined || branchPrice === null) {
        toast.error(`Service "${service.serviceName}" does not have a price for the chosen branch. Please contact the salon for more details.`);
        return;
      }
      
      const stylist = stylists.find(s => s.id === serviceItem.stylistId);
      
      servicesArray.push({
        serviceId: serviceItem.serviceId,
        serviceName: service?.serviceName || service?.name,
        stylistId: serviceItem.stylistId || null,
        stylistName: stylist ? `${stylist.firstName} ${stylist.lastName}` : 'Any available',
        duration: service?.duration || 60,
        price: branchPrice
      });
      
      totalPrice += branchPrice;
      totalDuration += (service?.duration || 60);
    }

    const appointmentData = {
      clientId: currentUser.uid,
      clientName: `${userData.firstName} ${userData.lastName}`,
      clientEmail: userData.email,
      clientPhone: userData.phoneNumber || '',
      branchId: bookingData.branchId,
      branchName: branch?.name || branch?.branchName,
      services: servicesArray,
      appointmentDate: bookingData.timeSlot.time,
      duration: totalDuration,
      // Price is ESTIMATED because final price may change depending on hair length/type
      totalPrice: totalPrice,
      status: APPOINTMENT_STATUS.PENDING,
      notes: bookingData.notes
    };

    setPendingAppointmentData(appointmentData);
    setShowBookingModal(false);
    setShowBookingSummary(true);
  };

  const handleConfirmBooking = async () => {
    if (!pendingAppointmentData) return;

    try {
      setBooking(true);
      // Re-validate all services availability and branch prices before creating
      let totalPrice = 0;
      const updatedServices = [];
      
      for (const serviceItem of pendingAppointmentData.services || []) {
        try {
          const latest = await getServiceById(serviceItem.serviceId);
          const branchPrice = latest.branchPricing?.[pendingAppointmentData.branchId] ?? latest.price;
          
          if (branchPrice === undefined || branchPrice === null) {
            toast.error(`Service "${serviceItem.serviceName}" is no longer available for the selected branch. Please choose another service.`);
            setShowBookingSummary(false);
            setPendingAppointmentData(null);
            setShowBookingModal(true);
            return;
          }
          
          updatedServices.push({
            ...serviceItem,
            price: branchPrice
          });
          
          totalPrice += branchPrice;
        } catch (err) {
          console.error('Error re-validating service before booking', err);
          toast.error(`Error validating service "${serviceItem.serviceName}". Please try again.`);
          setShowBookingSummary(false);
          setPendingAppointmentData(null);
          setShowBookingModal(true);
          return;
        }
      }

      // Update appointment data with validated prices
      const validatedAppointmentData = {
        ...pendingAppointmentData,
        services: updatedServices,
        totalPrice: totalPrice
      };

      await createAppointment(validatedAppointmentData, currentUser);
      setShowBookingSummary(false);
      setPendingAppointmentData(null);
      await fetchAppointments();
    } catch (error) {
      console.error('Error booking appointment:', error);
      toast.error('Failed to book appointment. Please try again.');
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
    
    let filtered = [];
    
    if (filter === 'upcoming') {
      filtered = appointments.filter(apt => 
        new Date(apt.appointmentDate) >= now && 
        apt.status !== APPOINTMENT_STATUS.COMPLETED &&
        apt.status !== APPOINTMENT_STATUS.CANCELLED
      );
    } else if (filter === 'past') {
      filtered = appointments.filter(apt => 
        new Date(apt.appointmentDate) < now ||
        apt.status === APPOINTMENT_STATUS.COMPLETED ||
        apt.status === APPOINTMENT_STATUS.CANCELLED
      );
    } else {
      filtered = appointments;
    }
    
    // Sort by latest first (by createdAt, then by appointmentDate)
    filtered.sort((a, b) => {
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (bCreated !== aCreated) {
        return bCreated - aCreated; // Latest first
      }
      // If same creation time, sort by appointment date
      const aDate = new Date(a.appointmentDate).getTime();
      const bDate = new Date(b.appointmentDate).getTime();
      return bDate - aDate; // Latest first
    });
    
    return filtered;
  };

  const upcomingAppointments = getFilteredAppointments('upcoming');
  const pastAppointments = getFilteredAppointments('past');
  const displayedUpcoming = showAllUpcoming ? upcomingAppointments : upcomingAppointments.slice(0, 3);

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
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Appointments</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <>
              {displayedUpcoming.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  onCancel={handleCancelAppointment}
                  onView={(apt) => { setSelectedDetailAppointment(apt); setShowDetailsModal(true); }}
                  showActions={true}
                />
              ))}
            </>
          )}
        </div>
        {upcomingAppointments.length > 3 && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowAllUpcoming(!showAllUpcoming)}
              className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 mx-auto"
            >
              {showAllUpcoming ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show More ({upcomingAppointments.length - 3} more)
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Past Appointments */}
      {pastAppointments.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Past Appointments</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastAppointments.slice(0, 6).map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                onView={(apt) => { setSelectedDetailAppointment(apt); setShowDetailsModal(true); }}
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
        onClose={() => {
          setShowBookingModal(false);
          // Reset booking data when modal closes
          setBookingData({
            branchId: '',
            services: [],
            date: '',
            timeSlot: null,
            notes: ''
          });
          setServices([]);
          setStylists([]);
          setAvailableSlots([]);
          setUnavailableMessage(null);
        }}
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

      {/* Booking Summary Confirmation Modal */}
      {showBookingSummary && pendingAppointmentData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 text-center">
              Confirm Appointment
            </h2>
            
            {/* Alert Message */}
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 text-center font-medium">
                Please wait for the Confirmation
              </p>
              <p className="text-xs text-blue-700 text-center mt-1">
                Your appointment will be reviewed and confirmed by our staff. You will receive a notification once confirmed.
              </p>
            </div>

            {/* Breakdown */}
            <div className="mb-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm text-gray-600">
                  <div>Branch</div>
                  <div className="font-medium text-gray-900">{pendingAppointmentData.branchName}</div>
                </div>
                {pendingAppointmentData.services?.map((s, i) => (
                  <div key={i} className="flex justify-between items-start gap-2 border-2 border-gray-200 p-4 rounded-lg bg-white hover:border-[#160B53]/30 transition-colors">
                    <div className="flex-grow text-sm">
                      <div className="font-semibold text-gray-900 mb-1">{s.serviceName}</div>
                      <div className="text-xs text-gray-600 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {s.stylistName || 'Any available stylist'}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-[#160B53]">₱{(s.price || 0).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Price (ESTIMATED) */}
            <div className="mb-6 text-center">
              <p className="text-sm text-gray-500 mb-1 flex items-center justify-center gap-2">
                Total Price
                <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">ESTIMATED</span>
              </p>
              <p className="text-lg font-semibold text-gray-900">
                ₱{pendingAppointmentData.totalPrice?.toLocaleString() || '0.00'}
              </p>
              <p className="text-xs text-gray-500 mt-2">Final price may change depending on hair length, type, or additional services.</p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBookingSummary(false);
                  setPendingAppointmentData(null);
                  setShowBookingModal(true);
                }}
                disabled={booking}
                className="flex-1 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBooking}
                disabled={booking}
                className="flex-1 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {booking && <LoadingSpinner size="sm" />}
                {booking ? 'Booking...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Appointment Details Modal (Client) */}
      {showDetailsModal && selectedDetailAppointment && (
        <AppointmentDetails
          appointment={selectedDetailAppointment}
          onClose={() => { setShowDetailsModal(false); setSelectedDetailAppointment(null); }}
        />
      )}
    </div>
  );
};

export default ClientAppointments;
