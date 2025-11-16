                                                                        /**
 * Appointments Management Page - Receptionist
 * For managing appointments and bookings
 */

import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Calendar, Clock, CheckCircle, XCircle, Play, Check, User, Phone, Scissors, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getAppointmentsByBranch, 
  createAppointment, 
  updateAppointment,
  updateAppointmentStatus,
  cancelAppointment,
  getTodayAppointmentStats,
  getAppointmentStats,
  APPOINTMENT_STATUS 
} from '../../services/appointmentService';
import { getBranchServices } from '../../services/branchServicesService';
import { getUsersByRole } from '../../services/userService';
import { USER_ROLES } from '../../utils/constants';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import AppointmentFormModal from '../../components/appointment/AppointmentFormModal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import BillingModalPOS from '../../components/billing/BillingModalPOS';
import toast from 'react-hot-toast';

const ReceptionistAppointments = () => {
  const { currentUser, userBranch, userBranchData } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null); // Track which appointment is being processed
  const [highlightedAppointment, setHighlightedAppointment] = useState(null); // Track which appointment to highlight
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('pending'); // Status tabs
  const [dateFilter, setDateFilter] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [sortField, setSortField] = useState('appointmentDate');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showModal, setShowModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [appointmentToBill, setAppointmentToBill] = useState(null);
  const [targetStatus, setTargetStatus] = useState(null);
  const [processingBilling, setProcessingBilling] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [stats, setStats] = useState(null);
  
  // Data for form
  const [services, setServices] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [clients, setClients] = useState([]);

  const getDateRange = (filter) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    switch (filter) {
      case 'today':
        return { start: today, end: tomorrow };
      case 'tomorrow':
        return { start: tomorrow, end: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000) };
      case 'week':
        return { start: today, end: weekFromNow };
      case 'upcoming':
        return { start: today, end: null };
      case 'custom':
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }
        return { start: today, end: tomorrow };
      case 'all':
        return { start: null, end: null };
      default:
        return { start: today, end: tomorrow };
    }
  };

  const fetchStats = async () => {
    try {
      const { start, end } = getDateRange(dateFilter);
      let statsData;
      
      if (dateFilter === 'upcoming') {
        // For upcoming, use all appointments from today onwards
        const upcomingAppointments = appointments.filter(apt => {
          const aptDate = new Date(apt.appointmentDate);
          return aptDate >= start;
        });
        statsData = calculateStatsFromAppointments(upcomingAppointments);
      } else {
        // Use the existing getAppointmentStats function for date ranges
        if (dateFilter === 'today') {
          statsData = await getTodayAppointmentStats(userBranch);
        } else {
          statsData = await getAppointmentStats(userBranch, start, end);
        }
      }
      
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
      cancelled: appointmentList.filter(a => a.status === APPOINTMENT_STATUS.CANCELLED).length,
      inService: appointmentList.filter(a => a.status === APPOINTMENT_STATUS.IN_SERVICE).length
    };
  };

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const data = await getAppointmentsByBranch(userBranch);
      
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
            branchName: userBranchData?.name || userBranchData?.branchName || ''
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
          branchName: userBranchData?.name || userBranchData?.branchName || ''
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

  // Memoized appointments filtered by date/search (but not status) - for tab counts
  const filteredForCounts = useMemo(() => {
    let filtered = [...appointments];

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

    // Apply date filter
    const { start, end } = getDateRange(dateFilter);
    
    if (dateFilter !== 'all') {
      if (dateFilter === 'today') {
        filtered = filtered.filter(apt => {
          const aptDate = new Date(apt.appointmentDate);
          aptDate.setHours(0, 0, 0, 0);
          return aptDate.getTime() === start.getTime();
        });
      } else if (dateFilter === 'tomorrow') {
        const tomorrow = new Date(start);
        filtered = filtered.filter(apt => {
          const aptDate = new Date(apt.appointmentDate);
          aptDate.setHours(0, 0, 0, 0);
          return aptDate.getTime() === tomorrow.getTime();
        });
      } else if (dateFilter === 'week') {
        filtered = filtered.filter(apt => {
          const aptDate = new Date(apt.appointmentDate);
          return aptDate >= start && aptDate <= end;
        });
      } else if (dateFilter === 'upcoming') {
        filtered = filtered.filter(apt => new Date(apt.appointmentDate) >= start);
      } else if (dateFilter === 'custom' && start && end) {
        filtered = filtered.filter(apt => {
          const aptDate = new Date(apt.appointmentDate);
          return aptDate >= start && aptDate <= end;
        });
      }
    }

    return filtered;
  }, [appointments, searchTerm, dateFilter, customStartDate, customEndDate]);

  // Memoized counts for each status tab
  const statusCounts = useMemo(() => {
    return {
      pending: filteredForCounts.filter(a => a.status === APPOINTMENT_STATUS.PENDING).length,
      confirmed: filteredForCounts.filter(a => a.status === APPOINTMENT_STATUS.CONFIRMED).length,
      inService: filteredForCounts.filter(a => a.status === APPOINTMENT_STATUS.IN_SERVICE).length,
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
        'in-service': APPOINTMENT_STATUS.IN_SERVICE,
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
  }, [dateFilter, appointments]);

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

  const handleCreateAppointment = () => {
    setSelectedAppointment(null);
    setShowModal(true);
  };

  const handleSubmit = async (formData) => {
    try {
      setSaving(true);
      
      if (selectedAppointment) {
        // Update existing appointment
        await updateAppointment(selectedAppointment.id, formData, currentUser);
      } else {
        // Create new appointment
        // Ensure branchName is not undefined
        let branchName = formData.branchName || userBranchData?.name || userBranchData?.branchName;
        
        // If still undefined, fetch branch data
        if (!branchName && userBranch) {
          const { getBranchById } = await import('../../services/branchService');
          const branchData = await getBranchById(userBranch);
          branchName = branchData?.name || branchData?.branchName || 'Unknown Branch';
        }
        
        const appointmentData = {
          ...formData,
          branchId: formData.branchId || userBranch,
          branchName: branchName
        };
        await createAppointment(appointmentData, currentUser);
      }
      
      setShowModal(false);
      await fetchAppointments();
      await fetchStats();
    } catch (error) {
      console.error('Error saving appointment:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (appointment, newStatus) => {
    // Show billing modal when starting service (to add services/products and adjust prices)
    if (newStatus === APPOINTMENT_STATUS.IN_SERVICE) {
      setAppointmentToBill(appointment);
      setTargetStatus(newStatus);
      setShowBillingModal(true);
      return;
    }

    // For other status updates (including confirm), proceed directly
    await proceedWithStatusUpdate(appointment, newStatus);
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
        [APPOINTMENT_STATUS.IN_SERVICE]: 'in-service',
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
        [APPOINTMENT_STATUS.IN_SERVICE]: 'in-service',
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
        <button
          onClick={handleCreateAppointment}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Appointment
        </button>
      </div>

      {/* Search and Date Filter Bar */}
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
        <div className="flex gap-2">
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              if (e.target.value === 'custom') {
                setShowCustomDateRange(true);
              } else {
                setShowCustomDateRange(false);
                setCustomStartDate('');
                setCustomEndDate('');
              }
            }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent min-w-[150px]"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="week">This Week</option>
            <option value="upcoming">Upcoming</option>
            <option value="custom">Custom Range</option>
          </select>
          
          {showCustomDateRange && (
            <>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Start Date"
              />
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="End Date"
              />
              <button
                onClick={() => {
                  if (customStartDate && customEndDate) {
                    applyFilters();
                  }
                }}
                className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Apply
              </button>
            </>
          )}
        </div>
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
            onClick={() => setActiveTab('in-service')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'in-service'
                ? 'border-purple-500 text-purple-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              <span>In Service</span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">
                {statusCounts.inService}
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
                          <button
                            onClick={() => handleUpdateStatus(apt, APPOINTMENT_STATUS.IN_SERVICE)}
                            disabled={processingStatus === apt.id}
                            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {processingStatus === apt.id && <LoadingSpinner size="sm" />}
                            {processingStatus === apt.id ? 'Starting...' : 'Start'}
                          </button>
                        )}
                        
                        {apt.status === APPOINTMENT_STATUS.IN_SERVICE && (
                          <button
                            onClick={() => handleUpdateStatus(apt, APPOINTMENT_STATUS.COMPLETED)}
                            disabled={processingStatus === apt.id}
                            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {processingStatus === apt.id && <LoadingSpinner size="sm" />}
                            {processingStatus === apt.id ? 'Completing...' : 'Complete'}
                          </button>
                        )}
                        
                        {apt.status !== APPOINTMENT_STATUS.COMPLETED && apt.status !== APPOINTMENT_STATUS.CANCELLED && (
                          <button
                            onClick={() => handleCancelAppointment(apt)}
                            disabled={processingStatus === apt.id || deleting}
                            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Cancel
                          </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-white bg-opacity-20 rounded-full p-2">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Appointment Details</h2>
                    <p className="text-primary-100 text-sm">Complete appointment information</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowDetailsModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 transition-colors p-2 rounded-full"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Client Header Card */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-100 rounded-full p-3">
                      <User className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">{selectedAppointment.clientName}</h3>
                      <p className="text-gray-600 text-sm">Client Information</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      selectedAppointment.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      selectedAppointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      selectedAppointment.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      selectedAppointment.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        selectedAppointment.status === 'confirmed' ? 'bg-green-500' :
                        selectedAppointment.status === 'pending' ? 'bg-yellow-500' :
                        selectedAppointment.status === 'completed' ? 'bg-blue-500' :
                        selectedAppointment.status === 'cancelled' ? 'bg-red-500' :
                        'bg-gray-500'
                      }`}></div>
                      {selectedAppointment.status?.charAt(0).toUpperCase() + selectedAppointment.status?.slice(1)}
                    </div>
                    {selectedAppointment.id && (
                      <p className="text-gray-500 text-xs mt-1">ID: {selectedAppointment.id.slice(-8)}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Contact Information Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-green-100 rounded-full p-2">
                      <Phone className="w-5 h-5 text-green-600" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">Contact Details</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">Phone Number</span>
                      <span className="text-gray-900 font-medium">{selectedAppointment.clientPhone || 'Not provided'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-600 font-medium">Email Address</span>
                      <span className="text-gray-900 font-medium text-sm break-all">{selectedAppointment.clientEmail || 'Not provided'}</span>
                    </div>
                  </div>
                </div>

                {/* Appointment Schedule Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-purple-100 rounded-full p-2">
                      <Clock className="w-5 h-5 text-purple-600" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">Schedule</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">Date</span>
                      <span className="text-gray-900 font-semibold">
                        {new Date(selectedAppointment.appointmentDate).toLocaleDateString('en-US', { 
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short', 
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-600 font-medium">Time</span>
                      <span className="text-gray-900 font-semibold">
                        {new Date(selectedAppointment.appointmentDate).toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit', 
                          hour12: true 
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Services Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="bg-pink-100 rounded-full p-2">
                    <Scissors className="w-5 h-5 text-pink-600" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900">Services Booked</h4>
                </div>
                <div className="space-y-4">
                  {selectedAppointment.services && selectedAppointment.services.length > 0 ? (
                    selectedAppointment.services.map((service, index) => (
                      <div key={index} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h5 className="font-semibold text-gray-900 text-lg">{service.serviceName}</h5>
                            <p className="text-gray-600 text-sm">with {service.stylistName || 'Unassigned Stylist'}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary-600 text-xl">₱{service.price?.toFixed(0) || '0'}</p>
                            <p className="text-gray-500 text-sm">{service.duration || 30} minutes</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h5 className="font-semibold text-gray-900 text-lg">{selectedAppointment.serviceName}</h5>
                          <p className="text-gray-600 text-sm">with {selectedAppointment.stylistName || 'Unassigned Stylist'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary-600 text-xl">₱{selectedAppointment.price?.toFixed(0) || '0'}</p>
                          <p className="text-gray-500 text-sm">{selectedAppointment.duration || 30} minutes</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Card */}
              <div className="bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 rounded-xl p-6">
                <h4 className="text-lg font-semibold text-primary-900 mb-4">Appointment Summary</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center">
                    <p className="text-sm text-primary-600 font-medium uppercase tracking-wide mb-1">Total Amount</p>
                    <p className="text-3xl font-bold text-primary-700">
                      ₱{
                        selectedAppointment.services && selectedAppointment.services.length > 0
                          ? selectedAppointment.services.reduce((sum, s) => sum + (s.price || 0), 0).toFixed(0)
                          : (selectedAppointment.price?.toFixed(0) || '0')
                      }
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-primary-600 font-medium uppercase tracking-wide mb-1">Total Duration</p>
                    <p className="text-3xl font-bold text-primary-700">
                      {selectedAppointment.services && selectedAppointment.services.length > 0
                        ? selectedAppointment.services.reduce((sum, s) => sum + (s.duration || 30), 0)
                        : selectedAppointment.duration || 30
                      } <span className="text-lg">min</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedAppointment.notes && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="bg-blue-100 rounded-full p-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-blue-900">Special Notes</h4>
                  </div>
                  <p className="text-blue-800 bg-white rounded-lg p-3 border border-blue-200">{selectedAppointment.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors flex items-center space-x-2"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceptionistAppointments;
