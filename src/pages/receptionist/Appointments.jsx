                                                                        /**
 * Appointments Management Page - Receptionist
 * For managing appointments and bookings
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Search, Calendar, Clock, CheckCircle, XCircle, Check, User, Phone, Scissors, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Printer, Edit } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getAppointmentsByBranch, 
  createAppointment, 
  updateAppointment,
  updateAppointmentStatus,
  checkInAppointment,
  cancelAppointment,
  APPOINTMENT_STATUS 
} from '../../services/appointmentService';
import { getBranchServices } from '../../services/branchServicesService';
import { getUsersByRole } from '../../services/userService';
import { USER_ROLES } from '../../utils/constants';
import { getArrivalsByBranch, ARRIVAL_STATUS } from '../../services/arrivalsService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import AppointmentFormModal from '../../components/appointment/AppointmentFormModal';
import AppointmentDetails from '../../components/appointment/AppointmentDetails';
import ConfirmModal from '../../components/ui/ConfirmModal';
import BillingModalPOS from '../../components/billing/BillingModalPOS';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';

const ReceptionistAppointments = () => {
  const { currentUser, userBranch, userBranchData } = useAuth();
  const printRef = useRef();
  
  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });
  
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null); // Track which appointment is being processed
  const [highlightedAppointment, setHighlightedAppointment] = useState(null); // Track which appointment to highlight
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // Status tabs - default to 'all' to show all appointments
  const [sortField, setSortField] = useState('appointmentDate');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showFilterModal, setShowFilterModal] = useState(false);
  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [filters, setFilters] = useState({
    startDate: getTodayDate(),
    endDate: getTodayDate(),
    stylistId: 'all',
    serviceId: 'all',
    checkInStatus: 'all', // 'all', 'checkedIn', 'notCheckedIn'
    clientType: 'all', // 'all', 'registered', 'guest'
    status: 'all' // 'all', 'pending', 'confirmed', 'completed', 'cancelled', 'no-show'
  });
  const [showModal, setShowModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [appointmentToConfirm, setAppointmentToConfirm] = useState(null);
  const [appointmentToCheckIn, setAppointmentToCheckIn] = useState(null);
  const [appointmentToBill, setAppointmentToBill] = useState(null);
  const [targetStatus, setTargetStatus] = useState(null);
  const [processingBilling, setProcessingBilling] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [stats, setStats] = useState(null);
  const [showCreateConfirmModal, setShowCreateConfirmModal] = useState(false);
  const [pendingAppointmentData, setPendingAppointmentData] = useState(null);
  
  // Data for form
  const [services, setServices] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [clients, setClients] = useState([]);

  const fetchStats = async () => {
    try {
      // Calculate stats from all appointments (no date filter)
      const statsData = calculateStatsFromAppointments(appointments);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const calculateStatsFromAppointments = (appointmentList) => {
    return {
      total: appointmentList.length,
      pending: appointmentList.filter(a => a.status === APPOINTMENT_STATUS.PENDING).length,
      confirmed: appointmentList.filter(a => a.status === APPOINTMENT_STATUS.CONFIRMED).length,
      completed: appointmentList.filter(a => a.status === APPOINTMENT_STATUS.COMPLETED).length,
      cancelled: appointmentList.filter(a => a.status === APPOINTMENT_STATUS.CANCELLED).length
    };
  };

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const data = await getAppointmentsByBranch(userBranch);
      
      // Fetch arrivals to check which appointments are already checked in
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      let checkedInAppointmentIds = new Set();
      try {
        const arrivalsData = await getArrivalsByBranch(userBranch, today, tomorrow);
        // Get appointment IDs that are checked in and not completed/cancelled
        checkedInAppointmentIds = new Set(
          arrivalsData
            .filter(arr => 
              !arr.isWalkIn && 
              arr.appointmentId && 
              arr.status !== ARRIVAL_STATUS.COMPLETED && 
              arr.status !== ARRIVAL_STATUS.CANCELLED
            )
            .map(arr => arr.appointmentId)
        );
      } catch (error) {
        console.error('Error fetching arrivals:', error);
        // Continue even if arrivals fetch fails
      }
      
      // Fetch fresh data for enrichment
      const servicesData = await getBranchServices(userBranch);
      const stylistsData = await getUsersByRole(USER_ROLES.STYLIST);
      const branchStylists = stylistsData.filter(s => s.branchId === userBranch);
      const clientsData = await getUsersByRole(USER_ROLES.CLIENT);
      
      // Enrich with names from related data
      const enrichedData = await Promise.all(data.map(async (apt) => {
        // Get service name
        const service = servicesData.find(s => s.id === apt.serviceId);
        // Get stylist name
        const stylist = branchStylists.find(s => s.id === apt.stylistId);
        // Get client name
        const client = clientsData.find(c => c.id === apt.clientId);
        
        // Handle multi-service appointments
        if (apt.services && apt.services.length > 0) {
          const enrichedServices = apt.services.map(svc => {
            const serviceData = servicesData.find(s => s.id === svc.serviceId);
            const stylistData = branchStylists.find(st => st.id === svc.stylistId);
            return {
              ...svc,
              serviceName: svc.serviceName || serviceData?.name || 'Unknown Service',
              isChemical: serviceData?.isChemical || false,
              stylistName: stylistData ? `${stylistData.firstName} ${stylistData.lastName}` : 'Unassigned'
            };
          });
          
          return {
            ...apt,
            services: enrichedServices,
            clientName: client ? `${client.firstName} ${client.lastName}` : apt.clientName || 'Guest',
            clientPhone: client?.phoneNumber || apt.clientPhone || '',
            clientEmail: client?.email || apt.clientEmail || '',
            branchName: userBranchData?.name || userBranchData?.branchName || '',
            isCheckedIn: checkedInAppointmentIds.has(apt.id)
          };
        }
        
        // Handle single service appointments (backward compatibility)
        return {
          ...apt,
          serviceName: service?.name || apt.serviceName || 'Unknown Service',
          isChemical: service?.isChemical || false,
          stylistName: stylist ? `${stylist.firstName} ${stylist.lastName}` : apt.stylistName || 'Unassigned',
          clientName: client ? `${client.firstName} ${client.lastName}` : apt.clientName || 'Guest',
          clientPhone: client?.phoneNumber || apt.clientPhone || '',
          clientEmail: client?.email || apt.clientEmail || '',
          branchName: userBranchData?.name || userBranchData?.branchName || '',
          isCheckedIn: checkedInAppointmentIds.has(apt.id)
        };
      }));
      
      setAppointments(enrichedData);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFormData = async () => {
    try {
      // Fetch services
      const servicesData = await getBranchServices(userBranch);
      setServices(servicesData);

      // Fetch stylists
      const stylistsData = await getUsersByRole(USER_ROLES.STYLIST);
      setStylists(stylistsData.filter(s => s.branchId === userBranch && s.isActive));

      // Fetch clients
      const clientsData = await getUsersByRole(USER_ROLES.CLIENT);
      setClients(clientsData.filter(c => c.isActive));
    } catch (error) {
      console.error('Error fetching form data:', error);
    }
  };

  // Memoized appointments filtered by date/search/filters (but not status) - for tab counts
  const filteredForCounts = useMemo(() => {
    // Exclude walk-in records from the appointments view
    let filtered = appointments.filter(apt => !apt.isWalkIn);

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(apt => 
        apt.clientName?.toLowerCase().includes(term) ||
        apt.clientPhone?.toLowerCase().includes(term) ||
        apt.clientEmail?.toLowerCase().includes(term) ||
        apt.serviceName?.toLowerCase().includes(term) ||
        apt.stylistName?.toLowerCase().includes(term) ||
        (apt.services && apt.services.some(s => 
          s.serviceName?.toLowerCase().includes(term) ||
          s.stylistName?.toLowerCase().includes(term)
        ))
      );
    }

    // Apply date range filter (only if dates are provided)
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(apt => {
        const aptDate = new Date(apt.appointmentDate);
        aptDate.setHours(0, 0, 0, 0);
        return aptDate >= startDate;
      });
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(apt => {
        const aptDate = new Date(apt.appointmentDate);
        return aptDate <= endDate;
      });
    }

    // Apply stylist filter
    if (filters.stylistId !== 'all') {
      filtered = filtered.filter(apt => {
        if (apt.services && apt.services.length > 0) {
          return apt.services.some(s => s.stylistId === filters.stylistId);
        }
        return apt.stylistId === filters.stylistId;
      });
    }

    // Apply service filter
    if (filters.serviceId !== 'all') {
      filtered = filtered.filter(apt => {
        if (apt.services && apt.services.length > 0) {
          return apt.services.some(s => s.serviceId === filters.serviceId);
        }
        return apt.serviceId === filters.serviceId;
      });
    }

    // Apply check-in status filter
    if (filters.checkInStatus !== 'all') {
      if (filters.checkInStatus === 'checkedIn') {
        filtered = filtered.filter(apt => apt.isCheckedIn === true);
      } else if (filters.checkInStatus === 'notCheckedIn') {
        filtered = filtered.filter(apt => apt.isCheckedIn !== true);
      }
    }

    // Apply client type filter (guest vs registered)
    if (filters.clientType !== 'all') {
      if (filters.clientType === 'registered') {
        filtered = filtered.filter(apt => !apt.isGuest && apt.clientId);
      } else if (filters.clientType === 'guest') {
        filtered = filtered.filter(apt => apt.isGuest || !apt.clientId);
      }
    }

    // Apply status filter
    if (filters.status !== 'all') {
      const statusMap = {
        'pending': APPOINTMENT_STATUS.PENDING,
        'confirmed': APPOINTMENT_STATUS.CONFIRMED,
        'completed': APPOINTMENT_STATUS.COMPLETED,
        'cancelled': APPOINTMENT_STATUS.CANCELLED,
        'no-show': APPOINTMENT_STATUS.NO_SHOW
      };
      const statusToFilter = statusMap[filters.status];
      if (statusToFilter) {
        filtered = filtered.filter(apt => apt.status === statusToFilter);
      }
    }

    // Apply time range filter
    if (filters.startTime) {
      filtered = filtered.filter(apt => {
        const aptTime = new Date(apt.appointmentDate);
        const aptHour = aptTime.getHours();
        const aptMin = aptTime.getMinutes();
        const aptTimeMinutes = aptHour * 60 + aptMin;
        const [startHour, startMin] = filters.startTime.split(':').map(Number);
        const startTimeMinutes = startHour * 60 + startMin;
        return aptTimeMinutes >= startTimeMinutes;
      });
    }

    if (filters.endTime) {
      filtered = filtered.filter(apt => {
        const aptTime = new Date(apt.appointmentDate);
        const aptHour = aptTime.getHours();
        const aptMin = aptTime.getMinutes();
        const aptTimeMinutes = aptHour * 60 + aptMin;
        const [endHour, endMin] = filters.endTime.split(':').map(Number);
        const endTimeMinutes = endHour * 60 + endMin;
        return aptTimeMinutes <= endTimeMinutes;
      });
    }

    return filtered;
  }, [appointments, searchTerm, filters]);

  // Memoized counts for each status tab
  const statusCounts = useMemo(() => {
    return {
      pending: filteredForCounts.filter(a => a.status === APPOINTMENT_STATUS.PENDING).length,
      confirmed: filteredForCounts.filter(a => a.status === APPOINTMENT_STATUS.CONFIRMED).length,
      completed: filteredForCounts.filter(a => a.status === APPOINTMENT_STATUS.COMPLETED).length,
      cancelled: filteredForCounts.filter(a => a.status === APPOINTMENT_STATUS.CANCELLED).length,
      noShow: filteredForCounts.filter(a => a.status === APPOINTMENT_STATUS.NO_SHOW).length
    };
  }, [filteredForCounts]);

  const applyFilters = () => {
    let filtered = [...filteredForCounts];

    // Apply status filter (activeTab)
    if (activeTab !== 'all') {
      const statusMap = {
        'pending': APPOINTMENT_STATUS.PENDING,
        'confirmed': APPOINTMENT_STATUS.CONFIRMED,
        'completed': APPOINTMENT_STATUS.COMPLETED,
        'cancelled': APPOINTMENT_STATUS.CANCELLED,
        'no-show': APPOINTMENT_STATUS.NO_SHOW
      };
      
      const statusToFilter = statusMap[activeTab];
      if (statusToFilter) {
        filtered = filtered.filter(apt => apt.status === statusToFilter);
      }
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'appointmentDate':
          aValue = new Date(a.appointmentDate).getTime();
          bValue = new Date(b.appointmentDate).getTime();
          break;
        case 'clientName':
          aValue = a.clientName?.toLowerCase() || '';
          bValue = b.clientName?.toLowerCase() || '';
          break;
        case 'serviceName':
          aValue = a.serviceName?.toLowerCase() || a.services?.[0]?.serviceName?.toLowerCase() || '';
          bValue = b.serviceName?.toLowerCase() || b.services?.[0]?.serviceName?.toLowerCase() || '';
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredAppointments(filtered);
  };

  // useEffect hooks - must come after useMemo declarations
  useEffect(() => {
    if (userBranch) {
      fetchAppointments();
      fetchFormData();
      fetchStats();
    }
  }, [userBranch]);

  useEffect(() => {
    applyFilters();
    // applyFilters uses filteredForCounts, activeTab, sortField, sortDirection internally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredForCounts, activeTab, sortField, sortDirection]);

  useEffect(() => {
    fetchStats();
  }, [appointments]);

  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with ascending direction
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="w-4 h-4 text-primary-600" /> : 
      <ArrowDown className="w-4 h-4 text-primary-600" />;
  };

  const handleViewAppointment = (appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailsModal(true);
  };

  const handleEditAppointment = (appointment) => {
    setSelectedAppointment(appointment);
    setShowModal(true);
  };

  const handleRescheduleAppointment = (appointment) => {
    // Prevent reschedule if appointment is in service, completed or already paid
    const isPaid = appointment.paymentStatus === true || appointment.paid === true || (typeof appointment.paymentStatus === 'string' && appointment.paymentStatus.toLowerCase() === 'paid');
    if (appointment.status === APPOINTMENT_STATUS.IN_SERVICE || appointment.status === APPOINTMENT_STATUS.COMPLETED || isPaid) {
      toast.error('Rescheduling is not allowed for this appointment');
      return;
    }

    setSelectedAppointment(appointment);
    setShowModal(true);
  };

  const handleCreateAppointment = () => {
    setSelectedAppointment(null);
    setShowModal(true);
  };

  const handleSubmit = async (formData) => {
    if (selectedAppointment) {
      // Update existing appointment - no confirmation needed for updates
      try {
        setSaving(true);
        await updateAppointment(selectedAppointment.id, formData, currentUser);
        setShowModal(false);
        await fetchAppointments();
        await fetchStats();
      } catch (error) {
        console.error('Error saving appointment:', error);
      } finally {
        setSaving(false);
      }
    } else {
      // Create new appointment - show confirmation
      // Prepare appointment data for confirmation
      let branchName = formData.branchName || userBranchData?.name || userBranchData?.branchName;
      
      if (!branchName && userBranch) {
        try {
          const { getBranchById } = await import('../../services/branchService');
          const branchData = await getBranchById(userBranch);
          branchName = branchData?.name || branchData?.branchName || 'Unknown Branch';
        } catch (error) {
          console.error('Error fetching branch:', error);
        }
      }
      
      const appointmentData = {
        ...formData,
        branchId: formData.branchId || userBranch,
        branchName: branchName,
        status: APPOINTMENT_STATUS.CONFIRMED // Receptionist bookings are automatically confirmed
      };
      
      setPendingAppointmentData(appointmentData);
      setShowCreateConfirmModal(true);
    }
  };

  const confirmCreateAppointment = async () => {
    if (!pendingAppointmentData) return;
    
    try {
      setSaving(true);
      setShowCreateConfirmModal(false);
      await createAppointment(pendingAppointmentData, currentUser);
      setShowModal(false);
      setPendingAppointmentData(null);
      await fetchAppointments();
      await fetchStats();
    } catch (error) {
      console.error('Error saving appointment:', error);
      setPendingAppointmentData(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCheckIn = (appointment) => {
    setAppointmentToCheckIn(appointment);
    setShowCheckInModal(true);
  };

  const confirmCheckIn = async () => {
    if (!appointmentToCheckIn) return;
    
    try {
      setProcessingStatus(appointmentToCheckIn.id);
      await checkInAppointment(appointmentToCheckIn.id, currentUser);
      
      // Highlight the appointment that was checked in
      setHighlightedAppointment(appointmentToCheckIn.id);
      
      await fetchAppointments();
      await fetchStats();
      
      // Clear highlight after 5 seconds
      setTimeout(() => {
        setHighlightedAppointment(null);
      }, 5000);
      
      setShowCheckInModal(false);
      setAppointmentToCheckIn(null);
      toast.success(`${appointmentToCheckIn.clientName || 'Client'} checked in successfully`);
    } catch (error) {
      console.error('Error checking in appointment:', error);
      toast.error('Failed to check in appointment');
    } finally {
      setProcessingStatus(null);
    }
  };

  const handleUpdateStatus = (appointment, newStatus) => {
    if (newStatus === APPOINTMENT_STATUS.CONFIRMED) {
      setAppointmentToConfirm(appointment);
      setShowConfirmModal(true);
    } else {
      // For other status updates, proceed directly
      proceedWithStatusUpdate(appointment, newStatus);
    }
  };

  const confirmStatusUpdate = async () => {
    if (!appointmentToConfirm) return;
    
    await proceedWithStatusUpdate(appointmentToConfirm, APPOINTMENT_STATUS.CONFIRMED);
    setShowConfirmModal(false);
    setAppointmentToConfirm(null);
  };

  const handleBillingSubmit = async (billData) => {
    if (!appointmentToBill || !targetStatus) return;

    try {
      setProcessingBilling(true);
      setProcessingStatus(appointmentToBill.id);
      
      // Prepare updated services with adjustments and new services/products
      // Remove status field if it exists (redundant - appointment has status, not individual services)
      const updatedServices = billData.items
        .filter(item => item.type === 'service')
        .map(item => {
          const service = {
            serviceId: item.id,
            serviceName: item.name,
            price: item.basePrice,
            adjustedPrice: item.price,
            adjustment: item.adjustment || 0,
            adjustmentReason: item.adjustmentReason || '',
            stylistId: item.stylistId || '',
            stylistName: item.stylistName || '',
            clientType: item.clientType || 'R'
          };
          // Explicitly remove status if it exists
          delete service.status;
          return service;
        });
      
      // Store products in appointment for later billing
      const products = billData.items
        .filter(item => item.type === 'product')
        .map(item => ({
          productId: item.id,
          productName: item.name,
          price: item.basePrice,
          quantity: item.quantity || 1,
          total: item.price
        }));
      
      // Update appointment with services, products, and status
      // Store discount amount/rate and tax rate (not computed values)
      const appointmentUpdates = {
        status: targetStatus,
        services: updatedServices.length > 0 ? updatedServices : appointmentToBill.services,
        products: products.length > 0 ? products : undefined, // Store products for later billing
        discount: billData.discount || 0, // Discount amount or percentage value (not computed)
        discountType: billData.discountType || 'fixed',
        taxRate: billData.taxRate || 0 // Tax rate (not computed tax amount)
      };
      
      await updateAppointment(appointmentToBill.id, appointmentUpdates, currentUser);
      
      setShowBillingModal(false);
      setAppointmentToBill(null);
      setTargetStatus(null);
      
      // Highlight the appointment that was moved
      setHighlightedAppointment(appointmentToBill.id);
      
      // Switch to the appropriate tab based on new status
      const statusToTabMap = {
        [APPOINTMENT_STATUS.PENDING]: 'pending',
        [APPOINTMENT_STATUS.CONFIRMED]: 'confirmed',
        [APPOINTMENT_STATUS.COMPLETED]: 'completed',
        [APPOINTMENT_STATUS.CANCELLED]: 'cancelled',
        [APPOINTMENT_STATUS.NO_SHOW]: 'no-show'
      };
      
      const targetTab = statusToTabMap[targetStatus];
      if (targetTab) {
        setActiveTab(targetTab);
      }
      
      await fetchAppointments();
      await fetchStats();
      toast.success('Service started successfully! Items saved for billing.');
      
      // Clear highlight after 5 seconds
      setTimeout(() => {
        setHighlightedAppointment(null);
      }, 5000);
    } catch (error) {
      console.error('Error starting service:', error);
      toast.error('Failed to start service');
    } finally {
      setProcessingBilling(false);
      setProcessingStatus(null);
    }
  };

  const proceedWithStatusUpdate = async (appointment, newStatus) => {
    try {
      setProcessingStatus(appointment.id);
      await updateAppointmentStatus(appointment.id, newStatus, currentUser);
      
      // Highlight the appointment that was moved
      setHighlightedAppointment(appointment.id);
      
      // Switch to the appropriate tab based on new status
      const statusToTabMap = {
        [APPOINTMENT_STATUS.PENDING]: 'pending',
        [APPOINTMENT_STATUS.CONFIRMED]: 'confirmed',
        [APPOINTMENT_STATUS.COMPLETED]: 'completed',
        [APPOINTMENT_STATUS.CANCELLED]: 'cancelled',
        [APPOINTMENT_STATUS.NO_SHOW]: 'no-show'
      };
      
      const targetTab = statusToTabMap[newStatus];
      if (targetTab) {
        setActiveTab(targetTab);
      }
      
      await fetchAppointments();
      await fetchStats();
      
      // Clear highlight after 5 seconds
      setTimeout(() => {
        setHighlightedAppointment(null);
      }, 5000);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update appointment status');
    } finally {
      setProcessingStatus(null);
    }
  };

  const handleCancelAppointment = (appointment) => {
    setAppointmentToCancel(appointment);
    setCancellationReason('');
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
      try {
      setDeleting(true);
      await cancelAppointment(appointmentToCancel.id, cancellationReason, currentUser);
      
      // Highlight the appointment that was cancelled
      setHighlightedAppointment(appointmentToCancel.id);
      
      // Switch to cancelled tab to see where the appointment went
      setActiveTab('cancelled');
      
      setShowCancelModal(false);
      setAppointmentToCancel(null);
      setCancellationReason('');
      await fetchAppointments();
      await fetchStats();
      
      // Clear highlight after 5 seconds
      setTimeout(() => {
        setHighlightedAppointment(null);
      }, 5000);
    } catch (error) {
      console.error('Error cancelling appointment:', error);
    } finally {
      setDeleting(false);
    }
  };

  // Generate time slots for timeline view (8 AM to 8 PM, 30-minute intervals)
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 20) slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const formatTimeSlot = (timeSlot) => {
    const [hour, min] = timeSlot.split(':');
    const h = parseInt(hour);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayHour}:${min} ${period}`;
  };

  const getAppointmentsForTimeSlot = (timeSlot) => {
    return filteredAppointments.filter(apt => {
      const aptTime = new Date(apt.appointmentDate);
      const aptHour = aptTime.getHours().toString().padStart(2, '0');
      const aptMin = aptTime.getMinutes().toString().padStart(2, '0');
      const aptTimeStr = `${aptHour}:${aptMin}`;
      return aptTimeStr === timeSlot;
    });
  };

  // Get active filters info for printing
  const getActiveFiltersInfo = () => {
    const activeFilters = [];
    if (filters.startDate || filters.endDate) {
      const start = filters.startDate || 'N/A';
      const end = filters.endDate || 'N/A';
      activeFilters.push(`Date: ${start} to ${end}`);
    }
    if (filters.stylistId !== 'all') {
      const stylist = stylists.find(s => s.id === filters.stylistId);
      if (stylist) {
        activeFilters.push(`Stylist: ${stylist.firstName} ${stylist.lastName}`);
      }
    }
    if (filters.serviceId !== 'all') {
      const service = services.find(s => s.id === filters.serviceId);
      if (service) {
        activeFilters.push(`Service: ${service.name}`);
      }
    }
    if (filters.status !== 'all') {
      activeFilters.push(`Status: ${filters.status.charAt(0).toUpperCase() + filters.status.slice(1)}`);
    }
    if (filters.clientType !== 'all') {
      activeFilters.push(`Client Type: ${filters.clientType === 'registered' ? 'Registered' : 'Guest'}`);
    }
    if (filters.checkInStatus !== 'all') {
      activeFilters.push(`Check-in: ${filters.checkInStatus === 'checkedIn' ? 'Checked In' : 'Not Checked In'}`);
    }
    if (activeTab !== 'all') {
      activeFilters.push(`Tab: ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`);
    }
    return activeFilters;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-600">Manage bookings for registered and guest clients</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/receptionist/arrivals"
            className="flex items-center gap-2 px-4 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
          >
            <Check className="w-5 h-5" />
            Go to Check-ins
          </a>
          <button
            onClick={handleCreateAppointment}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Appointment
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by client name, phone, service..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => setShowFilterModal(true)}
          className={`px-4 py-2.5 border rounded-lg transition-colors flex items-center gap-2 ${
            (filters.startDate || filters.endDate || 
             filters.stylistId !== 'all' || filters.serviceId !== 'all' || filters.checkInStatus !== 'all' ||
             filters.clientType !== 'all' || filters.status !== 'all')
              ? 'bg-primary-50 border-primary-300 text-primary-700 hover:bg-primary-100'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-5 h-5" />
          Filters
          {((filters.startDate || filters.endDate || 
             filters.stylistId !== 'all' || filters.serviceId !== 'all' || filters.checkInStatus !== 'all' ||
             filters.clientType !== 'all' || filters.status !== 'all')) && (
            <span className="px-2 py-0.5 text-xs bg-primary-600 text-white rounded-full">
              Active
            </span>
          )}
        </button>
        <button
          onClick={handlePrint}
          disabled={filteredAppointments.length === 0}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Printer className="w-5 h-5" />
          Print
        </button>
      </div>

      {/* Status Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-1" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-yellow-500 text-yellow-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Pending</span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">
                {statusCounts.pending}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('confirmed')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'confirmed'
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Confirmed</span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                {statusCounts.confirmed}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'completed'
                ? 'border-green-500 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Completed</span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                {statusCounts.completed}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('cancelled')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'cancelled'
                ? 'border-red-500 text-red-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              <span>Cancelled</span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                {statusCounts.cancelled}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-gray-500 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>All</span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                {filteredForCounts.length}
              </span>
            </div>
          </button>
        </nav>
      </div>

      {/* Appointments List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No appointments found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or create a new appointment</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('appointmentDate')}
                >
                  <div className="flex items-center gap-2">
                    Date & Time
                    {getSortIcon('appointmentDate')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('clientName')}
                >
                  <div className="flex items-center gap-2">
                    Client
                    {getSortIcon('clientName')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('serviceName')}
                >
                  <div className="flex items-center gap-2">
                    Services
                    {getSortIcon('serviceName')}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredAppointments.map((apt) => {
                const aptDate = new Date(apt.appointmentDate);
                const timeStr = aptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                const dateStr = aptDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                
                return (
                  <tr 
                    key={apt.id} 
                    className={`hover:bg-gray-50 transition-all duration-300 ${
                      highlightedAppointment === apt.id 
                        ? 'bg-primary-50 border-l-4 border-l-primary-600 shadow-lg ring-2 ring-primary-200' 
                        : ''
                    }`}
                  >
                    <td 
                      className="px-6 py-3 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleViewAppointment(apt)}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{dateStr}</div>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {timeStr}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td 
                      className="px-6 py-3 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleViewAppointment(apt)}
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{apt.clientName}</div>
                          {apt.clientPhone && (
                            <div className="text-xs text-gray-500">{apt.clientPhone}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td 
                      className="px-6 py-3 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleViewAppointment(apt)}
                    >
                      <div className="flex items-start gap-2">
                        <Scissors className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          {apt.services && apt.services.length > 0 ? (
                            <>
                              <div className="text-xs font-medium text-gray-500 mb-1">
                                {apt.services.length} Service(s)
                              </div>
                              {apt.services.map((svc, idx) => (
                                <div key={idx} className="text-sm text-gray-900 mb-0.5">
                                  {svc.serviceName}
                                  <span className="text-gray-500 text-xs ml-2">{svc.stylistName}</span>
                                </div>
                              ))}
                            </>
                          ) : (
                            <>
                              <div className="text-xs font-medium text-gray-500 mb-1">1 Service(s)</div>
                              <div className="text-sm text-gray-900">
                                {apt.serviceName}
                                <span className="text-gray-500 text-xs ml-2">{apt.stylistName}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {apt.status === APPOINTMENT_STATUS.PENDING && (
                          <button
                            onClick={() => handleUpdateStatus(apt, APPOINTMENT_STATUS.CONFIRMED)}
                            disabled={processingStatus === apt.id}
                            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {processingStatus === apt.id && <LoadingSpinner size="sm" />}
                            {processingStatus === apt.id ? 'Confirming...' : 'Confirm'}
                          </button>
                        )}
                        
                        {apt.status === APPOINTMENT_STATUS.CONFIRMED && (
                          apt.isCheckedIn ? (
                            <span className="px-3 py-2 bg-green-100 text-green-700 text-sm font-medium rounded-lg flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              Checked In
                            </span>
                          ) : (
                            <span className="px-3 py-2 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg">
                              Ready for Check-in
                            </span>
                          )
                        )}
                        
                        {apt.status !== APPOINTMENT_STATUS.COMPLETED && apt.status !== APPOINTMENT_STATUS.CANCELLED && apt.status !== APPOINTMENT_STATUS.IN_SERVICE && !(apt.paymentStatus === true || apt.paid === true || (typeof apt.paymentStatus === 'string' && apt.paymentStatus.toLowerCase() === 'paid')) && (
                          <>
                            <button
                              onClick={() => handleRescheduleAppointment(apt)}
                              disabled={processingStatus === apt.id || saving}
                              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => handleCancelAppointment(apt)}
                              disabled={processingStatus === apt.id || deleting}
                              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Appointment Form Modal */}
      <AppointmentFormModal
        isOpen={showModal}
        appointment={selectedAppointment}
        branches={[userBranchData]}
        services={services}
        stylists={stylists}
        clients={clients}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
        loading={saving}
        isGuest={false}
        userBranch={userBranch}
      />

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={showCancelModal}
        onClose={() => {
          if (!deleting) {
            setShowCancelModal(false);
            setAppointmentToCancel(null);
          }
        }}
        onConfirm={confirmCancel}
        title="Cancel Appointment"
        message={`Are you sure you want to cancel this appointment for ${appointmentToCancel?.clientName}?`}
        confirmText="Cancel Appointment"
        cancelText="Keep Appointment"
        type="danger"
        loading={deleting}
      >
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cancellation Reason (Optional)
          </label>
          <textarea
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Enter reason for cancellation..."
          />
        </div>
      </ConfirmModal>

      {/* Confirm Appointment Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          if (processingStatus !== appointmentToConfirm?.id) {
            setShowConfirmModal(false);
            setAppointmentToConfirm(null);
          }
        }}
        onConfirm={confirmStatusUpdate}
        title="Confirm Appointment"
        message={`Are you sure you want to confirm this appointment for ${appointmentToConfirm?.clientName}?`}
        confirmText="Confirm Appointment"
        cancelText="Cancel"
        type="default"
        loading={processingStatus === appointmentToConfirm?.id}
      />

      {/* Check In Confirmation Modal */}
      <ConfirmModal
        isOpen={showCheckInModal}
        onClose={() => {
          if (processingStatus !== appointmentToCheckIn?.id) {
            setShowCheckInModal(false);
            setAppointmentToCheckIn(null);
          }
        }}
        onConfirm={confirmCheckIn}
        title="Check In Appointment"
        message={`Are you sure you want to check in ${appointmentToCheckIn?.clientName}?`}
        confirmText="Check In"
        cancelText="Cancel"
        type="default"
        loading={processingStatus === appointmentToCheckIn?.id}
      />

      {/* Confirm Create Appointment Modal */}
      <ConfirmModal
        isOpen={showCreateConfirmModal}
        onClose={() => {
          if (!saving) {
            setShowCreateConfirmModal(false);
            setPendingAppointmentData(null);
          }
        }}
        onConfirm={confirmCreateAppointment}
        title="Book Appointment"
        message={
          pendingAppointmentData
            ? `Are you sure you want to book an appointment for ${pendingAppointmentData.clientName || 'this client'}?`
            : 'Are you sure you want to book this appointment?'
        }
        confirmText="Book Appointment"
        cancelText="Cancel"
        type="default"
        loading={saving}
      />

      {/* Billing Modal POS - For starting service with billing */}
      {appointmentToBill && (
        <BillingModalPOS
          isOpen={showBillingModal}
          appointment={appointmentToBill}
          services={services}
          stylists={stylists}
          clients={clients}
          mode="start-service"
          onClose={() => {
            if (!processingBilling) {
              setShowBillingModal(false);
              setAppointmentToBill(null);
              setTargetStatus(null);
            }
          }}
          onSubmit={handleBillingSubmit}
          loading={processingBilling}
        />
      )}

      {/* Appointment Details Modal */}
      {showDetailsModal && selectedAppointment && (
        <AppointmentDetails
          appointment={selectedAppointment}
          onClose={() => setShowDetailsModal(false)}
          onEdit={(apt) => {
            setSelectedAppointment(apt);
            setShowDetailsModal(false);
            setShowModal(true);
          }}
        />
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Filter Appointments</h2>
              <button
                onClick={() => setShowFilterModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Range
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End Date</label>
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Status & Client Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no-show">No Show</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Type
                  </label>
                  <select
                    value={filters.clientType}
                    onChange={(e) => setFilters(prev => ({ ...prev, clientType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="all">All Clients</option>
                    <option value="registered">Registered Clients</option>
                    <option value="guest">Guest Clients</option>
                  </select>
                </div>
              </div>

              {/* Stylist & Service */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stylist
                  </label>
                  <select
                    value={filters.stylistId}
                    onChange={(e) => setFilters(prev => ({ ...prev, stylistId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="all">All Stylists</option>
                    {stylists.map(stylist => (
                      <option key={stylist.id} value={stylist.id}>
                        {stylist.firstName} {stylist.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service
                  </label>
                  <select
                    value={filters.serviceId}
                    onChange={(e) => setFilters(prev => ({ ...prev, serviceId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="all">All Services</option>
                    {services.map(service => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Check-in Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Check-in Status
                </label>
                <select
                  value={filters.checkInStatus}
                  onChange={(e) => setFilters(prev => ({ ...prev, checkInStatus: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All</option>
                  <option value="checkedIn">Checked In</option>
                  <option value="notCheckedIn">Not Checked In</option>
                </select>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setFilters({
                    startDate: getTodayDate(),
                    endDate: getTodayDate(),
                    stylistId: 'all',
                    serviceId: 'all',
                    checkInStatus: 'all',
                    clientType: 'all',
                    status: 'all'
                  });
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Reset Filters
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Component */}
      <div className="hidden">
        <div ref={printRef} className="print-content p-6" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10px' }}>
          {/* Header */}
          <div className="mb-3 pb-2 border-b border-black">
            <h1 className="text-base font-bold text-black mb-1" style={{ fontSize: '14px' }}>
              APPOINTMENT REPORT - {userBranchData?.name || userBranchData?.branchName || 'David Salon'}
            </h1>
            <div className="flex justify-between text-xs text-black" style={{ fontSize: '9px' }}>
              <span>
                Period: {
                  filters.startDate && filters.endDate
                    ? `${new Date(filters.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${new Date(filters.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : 'All Time'
                }
              </span>
              <span>
                Generated: {new Date().toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>

          {/* Summary Statistics */}
          {(() => {
            const stats = {
              total: filteredAppointments.length,
              pending: filteredAppointments.filter(a => a.status === APPOINTMENT_STATUS.PENDING).length,
              confirmed: filteredAppointments.filter(a => a.status === APPOINTMENT_STATUS.CONFIRMED).length,
              completed: filteredAppointments.filter(a => a.status === APPOINTMENT_STATUS.COMPLETED).length,
              cancelled: filteredAppointments.filter(a => a.status === APPOINTMENT_STATUS.CANCELLED).length,
              noShow: filteredAppointments.filter(a => a.status === APPOINTMENT_STATUS.NO_SHOW).length,
              checkedIn: filteredAppointments.filter(a => a.isCheckedIn).length,
              registered: filteredAppointments.filter(a => !a.isGuest && a.clientId).length,
              guest: filteredAppointments.filter(a => a.isGuest || !a.clientId).length,
            };
            
            // Calculate time distribution
            const timeSlots = { morning: 0, afternoon: 0, evening: 0 };
            filteredAppointments.forEach(apt => {
              const hour = new Date(apt.appointmentDate).getHours();
              if (hour >= 6 && hour < 12) timeSlots.morning++;
              else if (hour >= 12 && hour < 17) timeSlots.afternoon++;
              else if (hour >= 17 && hour < 22) timeSlots.evening++;
            });

            // Stylist distribution
            const stylistCounts = {};
            filteredAppointments.forEach(apt => {
              if (apt.services && apt.services.length > 0) {
                apt.services.forEach(svc => {
                  const stylistId = svc.stylistId || apt.stylistId;
                  const stylistName = svc.stylistName || apt.stylistName || 'Unassigned';
                  if (stylistId) {
                    stylistCounts[stylistId] = stylistCounts[stylistId] || { name: stylistName, count: 0 };
                    stylistCounts[stylistId].count++;
                  }
                });
              } else {
                const stylistId = apt.stylistId;
                const stylistName = apt.stylistName || 'Unassigned';
                if (stylistId) {
                  stylistCounts[stylistId] = stylistCounts[stylistId] || { name: stylistName, count: 0 };
                  stylistCounts[stylistId].count++;
                }
              }
            });

            // Service popularity
            const serviceCounts = {};
            filteredAppointments.forEach(apt => {
              if (apt.services && apt.services.length > 0) {
                apt.services.forEach(svc => {
                  const serviceName = svc.serviceName || 'Unknown';
                  serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1;
                });
              } else if (apt.serviceName) {
                serviceCounts[apt.serviceName] = (serviceCounts[apt.serviceName] || 0) + 1;
              }
            });

            const completionRate = stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0;
            const cancellationRate = stats.total > 0 ? ((stats.cancelled / stats.total) * 100).toFixed(1) : 0;
            const checkInRate = (stats.confirmed + stats.completed) > 0 ? ((stats.checkedIn / (stats.confirmed + stats.completed)) * 100).toFixed(1) : 0;

            return (
                <>
                  {/* Key Metrics */}
                  <div className="mb-3 grid grid-cols-4 gap-2">
                    <div className="border border-black p-2">
                      <div className="text-xs text-black mb-0.5" style={{ fontSize: '8px' }}>Total Appointments</div>
                      <div className="text-base font-bold text-black" style={{ fontSize: '14px' }}>{stats.total}</div>
                    </div>
                    <div className="border border-black p-2">
                      <div className="text-xs text-black mb-0.5" style={{ fontSize: '8px' }}>Completed</div>
                      <div className="text-base font-bold text-black" style={{ fontSize: '14px' }}>{stats.completed}</div>
                      <div className="text-xs text-black" style={{ fontSize: '8px' }}>({completionRate}%)</div>
                    </div>
                    <div className="border border-black p-2">
                      <div className="text-xs text-black mb-0.5" style={{ fontSize: '8px' }}>Confirmed</div>
                      <div className="text-base font-bold text-black" style={{ fontSize: '14px' }}>{stats.confirmed}</div>
                    </div>
                    <div className="border border-black p-2">
                      <div className="text-xs text-black mb-0.5" style={{ fontSize: '8px' }}>Cancelled</div>
                      <div className="text-base font-bold text-black" style={{ fontSize: '14px' }}>{stats.cancelled}</div>
                      <div className="text-xs text-black" style={{ fontSize: '8px' }}>({cancellationRate}%)</div>
                    </div>
                  </div>

                  {/* Detailed Breakdown */}
                  <div className="mb-3 grid grid-cols-3 gap-2">
                    <div className="border border-black p-2">
                      <h3 className="text-xs font-bold text-black mb-1 uppercase border-b border-black pb-0.5" style={{ fontSize: '9px' }}>Status</h3>
                      <table className="w-full text-xs" style={{ fontSize: '9px' }}>
                        <tbody>
                          <tr>
                            <td className="text-black">Pending:</td>
                            <td className="text-right font-semibold text-black">{stats.pending}</td>
                          </tr>
                          <tr>
                            <td className="text-black">Confirmed:</td>
                            <td className="text-right font-semibold text-black">{stats.confirmed}</td>
                          </tr>
                          <tr>
                            <td className="text-black">Completed:</td>
                            <td className="text-right font-semibold text-black">{stats.completed}</td>
                          </tr>
                          <tr>
                            <td className="text-black">Cancelled:</td>
                            <td className="text-right font-semibold text-black">{stats.cancelled}</td>
                          </tr>
                          {stats.noShow > 0 && (
                            <tr>
                              <td className="text-black">No Show:</td>
                              <td className="text-right font-semibold text-black">{stats.noShow}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="border border-black p-2">
                      <h3 className="text-xs font-bold text-black mb-1 uppercase border-b border-black pb-0.5" style={{ fontSize: '9px' }}>Clients</h3>
                      <table className="w-full text-xs" style={{ fontSize: '9px' }}>
                        <tbody>
                          <tr>
                            <td className="text-black">Registered:</td>
                            <td className="text-right font-semibold text-black">{stats.registered} ({stats.total > 0 ? ((stats.registered / stats.total) * 100).toFixed(1) : 0}%)</td>
                          </tr>
                          <tr>
                            <td className="text-black">Guest:</td>
                            <td className="text-right font-semibold text-black">{stats.guest} ({stats.total > 0 ? ((stats.guest / stats.total) * 100).toFixed(1) : 0}%)</td>
                          </tr>
                          <tr className="border-t border-black">
                            <td className="text-black">Checked In:</td>
                            <td className="text-right font-semibold text-black">{stats.checkedIn} ({checkInRate}%)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="border border-black p-2">
                      <h3 className="text-xs font-bold text-black mb-1 uppercase border-b border-black pb-0.5" style={{ fontSize: '9px' }}>Time Slot</h3>
                      <table className="w-full text-xs" style={{ fontSize: '9px' }}>
                        <tbody>
                          <tr>
                            <td className="text-black">Morning:</td>
                            <td className="text-right font-semibold text-black">{timeSlots.morning}</td>
                          </tr>
                          <tr>
                            <td className="text-black">Afternoon:</td>
                            <td className="text-right font-semibold text-black">{timeSlots.afternoon}</td>
                          </tr>
                          <tr>
                            <td className="text-black">Evening:</td>
                            <td className="text-right font-semibold text-black">{timeSlots.evening}</td>
                          </tr>
                          <tr className="border-t border-black">
                            <td className="text-black font-semibold">Peak:</td>
                            <td className="text-right font-bold text-black">
                              {timeSlots.morning >= timeSlots.afternoon && timeSlots.morning >= timeSlots.evening ? 'Morning' :
                               timeSlots.afternoon >= timeSlots.evening ? 'Afternoon' : 'Evening'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Top Performers - Side by Side */}
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    {Object.keys(stylistCounts).length > 0 && (
                      <div className="border border-black p-2">
                        <h3 className="text-xs font-bold text-black mb-1 uppercase border-b border-black pb-0.5" style={{ fontSize: '9px' }}>Top Stylists</h3>
                        <table className="w-full text-xs" style={{ fontSize: '9px' }}>
                          <tbody>
                            {Object.entries(stylistCounts)
                              .sort((a, b) => b[1].count - a[1].count)
                              .slice(0, 5)
                              .map(([id, data]) => (
                                <tr key={id}>
                                  <td className="text-black">{data.name}</td>
                                  <td className="text-right font-semibold text-black">{data.count}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {Object.keys(serviceCounts).length > 0 && (
                      <div className="border border-black p-2">
                        <h3 className="text-xs font-bold text-black mb-1 uppercase border-b border-black pb-0.5" style={{ fontSize: '9px' }}>Top Services</h3>
                        <table className="w-full text-xs" style={{ fontSize: '9px' }}>
                          <tbody>
                            {Object.entries(serviceCounts)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 5)
                              .map(([serviceName, count]) => (
                                <tr key={serviceName}>
                                  <td className="text-black">{serviceName.length > 25 ? serviceName.substring(0, 25) + '...' : serviceName}</td>
                                  <td className="text-right font-semibold text-black">{count}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Active Filters */}
                  {getActiveFiltersInfo().length > 0 && (
                    <div className="mb-2 p-1.5 border border-black text-xs" style={{ fontSize: '8px', backgroundColor: '#f5f5f5' }}>
                      <strong className="text-black">Filters:</strong> {getActiveFiltersInfo().join(' • ')}
                    </div>
                  )}
              </>
            );
          })()}

          <table className="w-full border-collapse text-xs" style={{ fontSize: '9px' }}>
            <thead>
              <tr className="bg-gray-200 border-b-2 border-black">
                <th className="px-2 py-1.5 text-left font-bold text-black" style={{ width: '30px' }}>#</th>
                <th className="px-2 py-1.5 text-left font-bold text-black" style={{ width: '130px' }}>Date & Time</th>
                <th className="px-2 py-1.5 text-left font-bold text-black" style={{ width: '170px' }}>Client</th>
                <th className="px-2 py-1.5 text-left font-bold text-black" style={{ width: '230px' }}>Services</th>
                <th className="px-2 py-1.5 text-left font-bold text-black" style={{ width: '140px' }}>Stylist</th>
                <th className="px-2 py-1.5 text-left font-bold text-black" style={{ width: '100px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map((apt, index) => {
                const aptDate = new Date(apt.appointmentDate);
                const dateStr = aptDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                });
                const timeStr = aptDate.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit', 
                  hour12: true 
                });

                let servicesList = '';
                if (apt.services && apt.services.length > 0) {
                  servicesList = apt.services.map(s => s.serviceName).join(', ');
                } else {
                  servicesList = apt.serviceName || 'N/A';
                }

                const stylistName = apt.stylistName || 'Unassigned';

                return (
                  <tr key={apt.id} className="border-b border-gray-400">
                    <td className="px-2 py-1.5 text-center text-black">{index + 1}</td>
                    <td className="px-2 py-1.5 text-black">
                      <div className="font-semibold">{dateStr}</div>
                      <div>{timeStr}</div>
                    </td>
                    <td className="px-2 py-1.5 text-black">
                      <div className="font-medium">{apt.clientName || 'Guest'}</div>
                      {apt.clientPhone && (
                        <div>{apt.clientPhone}</div>
                      )}
                      <span>({apt.isGuest ? 'Guest' : 'Registered'})</span>
                    </td>
                    <td className="px-2 py-1.5 text-black">
                      <div>{servicesList}</div>
                    </td>
                    <td className="px-2 py-1.5 text-black">
                      <div>{stylistName}</div>
                      {apt.isCheckedIn && (
                        <span className="font-semibold">✓ Checked In</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-black font-medium">
                      {apt.status || 'N/A'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 pt-3 border-t-2 border-black">
            <div className="flex justify-between items-center text-xs text-black">
              <div className="font-semibold">Report generated for business analysis</div>
              <div className="font-bold">Total: {filteredAppointments.length} appointment(s)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceptionistAppointments;
