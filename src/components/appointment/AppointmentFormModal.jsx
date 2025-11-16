/**
 * Appointment Form Modal Component
 * For creating and editing appointments
 */

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertCircle } from 'lucide-react';
import { APPOINTMENT_STATUS, getAvailableTimeSlots } from '../../services/appointmentService';
import { formatTime } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';

const AppointmentFormModal = ({ 
  isOpen, 
  appointment, 
  branches = [],
  services = [],
  stylists = [],
  clients = [],
  onClose, 
  onSubmit,
  loading = false,
    isGuest = false,
  userBranch = null  // Auto-select branch for staff
}) => {
  const [formData, setFormData] = useState({
    clientId: '',
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    branchId: userBranch || '',  // Auto-fill if userBranch provided
    services: [],  // Array of { serviceId, stylistId, serviceName, duration, price }
    appointmentDate: '',
    timeSlot: null,
    duration: 0,  // Will be calculated from selected services
    status: APPOINTMENT_STATUS.PENDING,
    notes: ''
  });
  
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [unavailableMessage, setUnavailableMessage] = useState(null);
  const [isGuestMode, setIsGuestMode] = useState(isGuest || false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState('');
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showClientDropdown && !event.target.closest('.client-search-container')) {
        setShowClientDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showClientDropdown]);

  useEffect(() => {
    if (appointment) {
      const appointmentDate = new Date(appointment.appointmentDate);
      setFormData({
        clientId: appointment.clientId || '',
        clientName: appointment.clientName || '',
        clientPhone: appointment.clientPhone || '',
        clientEmail: appointment.clientEmail || '',
        branchId: appointment.branchId || '',
        services: appointment.services || (appointment.serviceId ? [{ serviceId: appointment.serviceId, stylistId: appointment.stylistId || '' }] : []),  // Support old single service format
        appointmentDate: appointmentDate.toISOString().split('T')[0],
        timeSlot: { time: appointmentDate, available: true },
        duration: appointment.duration || 0,
        status: appointment.status || APPOINTMENT_STATUS.PENDING,
        notes: appointment.notes || ''
      });
      // Set selected client name if editing an appointment with registered client
      if (appointment.clientId && clients) {
        const client = clients.find(c => c.id === appointment.clientId);
        if (client) {
          setSelectedClientName(`${client.firstName} ${client.lastName}`);
        }
      }
    } else {
      // Reset for new appointment
      setFormData({
        clientId: '',
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        branchId: userBranch || '',
        services: [],
        appointmentDate: '',
        timeSlot: null,
        duration: 0,
        status: APPOINTMENT_STATUS.PENDING,
        notes: ''
      });
      setAvailableSlots([]);
      setUnavailableMessage(null);
      setSelectedClientName('');
      setClientSearchTerm('');
    }
  }, [appointment, isOpen, userBranch, clients]);
  
  // Fetch available time slots when date, services, and branch are selected
  useEffect(() => {
    let isCancelled = false;
    
    const fetchSlots = async () => {
      if (formData.appointmentDate && formData.services.length > 0 && formData.branchId) {
        // Only fetch if we have services loaded
        if (services.length === 0) {
          return;
        }
        
        try {
          setLoadingSlots(true);
          // Calculate total duration from all selected services
          const totalDuration = formData.services.reduce((sum, serviceObj) => {
            const service = services.find(s => s.id === serviceObj.serviceId);
            return sum + (service?.duration || 0);
          }, 0);
          
          // Get all assigned stylists from services
          const assignedStylists = formData.services
            .map(svc => svc.stylistId)
            .filter(id => id); // Remove null/undefined
          
          // If no stylists assigned, check general availability
          if (assignedStylists.length === 0) {
            const result = await getAvailableTimeSlots(
              null,
              formData.branchId,
              formData.appointmentDate,
              totalDuration || 60
            );
            
            if (!isCancelled) {
              setAvailableSlots(result.slots || []);
              setUnavailableMessage(result.message || null);
            }
          } else {
            // Check availability for all assigned stylists
            // A slot is only available if ALL stylists are available
            const stylistResults = await Promise.all(
              assignedStylists.map(stylistId => 
                getAvailableTimeSlots(
                  stylistId,
                  formData.branchId,
                  formData.appointmentDate,
                  totalDuration || 60
                )
              )
            );
            
            // Get the first result for base slots and messages
            const baseResult = stylistResults[0];
            
            if (!isCancelled) {
              if (baseResult.message) {
                // If there's a message (holiday, closed, etc.), use it
                setAvailableSlots([]);
                setUnavailableMessage(baseResult.message);
              } else {
                // Merge availability - slot is only available if ALL stylists are available
                const mergedSlots = baseResult.slots.map(slot => {
                  const allAvailable = stylistResults.every(result => {
                    const matchingSlot = result.slots.find(s => 
                      s.time.getTime() === slot.time.getTime()
                    );
                    return matchingSlot && matchingSlot.available;
                  });
                  
                  return {
                    ...slot,
                    available: allAvailable
                  };
                });
                
                setAvailableSlots(mergedSlots);
                setUnavailableMessage(null);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching slots:', error);
          if (!isCancelled) {
            setAvailableSlots([]);
            setUnavailableMessage('Error loading time slots. Please try again.');
          }
        } finally {
          if (!isCancelled) {
            setLoadingSlots(false);
          }
        }
      } else {
        setAvailableSlots([]);
        setUnavailableMessage(null);
      }
    };
    
    fetchSlots();
    
    // Cleanup function to cancel if component updates
    return () => {
      isCancelled = true;
    };
  }, [formData.appointmentDate, formData.services, formData.branchId, services]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.timeSlot) {
      alert('Please select a time slot');
      return;
    }
    
    // Get appointment date/time from selected slot
    const appointmentDateTime = new Date(formData.timeSlot.time);
    
    // Validate 2-hour advance notice (only for registered clients, not guest clients)
    if (!appointment && !isGuestMode) {
      const now = new Date();
      const timeDiff = appointmentDateTime.getTime() - now.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff < 2) {
        alert('Appointments must be booked at least 2 hours in advance. Please select a later time.');
        return;
      }
    }
    
    // Get branch name from branches array
    const selectedBranch = branches && branches.filter(b => b && b.id).find(b => b.id === formData.branchId);
    
    // Enrich services with full details
    // Remove status field if it exists (redundant - appointment has status, not individual services)
    const enrichedServices = formData.services.map(serviceObj => {
      const service = services.find(s => s.id === serviceObj.serviceId);
      const stylist = stylists && stylists.find(s => s.id === serviceObj.stylistId);
      
      const enrichedService = {
        serviceId: serviceObj.serviceId,
        serviceName: service?.name || '',
        duration: service?.duration || 0,
        price: service?.price || 0,
        stylistId: serviceObj.stylistId || null,
        stylistName: stylist ? `${stylist.firstName} ${stylist.lastName}` : 'Any available'
      };
      // Explicitly remove status if it exists
      delete enrichedService.status;
      return enrichedService;
    });
    
    // Calculate totals
    const totalPrice = enrichedServices.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = enrichedServices.reduce((sum, s) => sum + s.duration, 0);
    
    // Remove timeSlot from submitData - it's just UI state, not needed in Firestore
    const { timeSlot, ...dataWithoutTimeSlot } = formData;
    
    const submitData = {
      ...dataWithoutTimeSlot,
      appointmentDate: appointmentDateTime,
      branchName: selectedBranch?.name || selectedBranch?.branchName,
      services: enrichedServices,  // Array of enriched service objects
      totalPrice,
      duration: totalDuration,
      isGuest: isGuestMode,
      // For guest clients, set clientId to null if not provided
      clientId: isGuestMode ? (formData.clientId || null) : formData.clientId
    };

    onSubmit(submitData);
  };

  // Calculate minimum date/time (2 hours from now for registered clients, today for guest clients)
  const getMinDateTime = () => {
    if (isGuestMode) {
      return new Date().toISOString().split('T')[0];
    }
    const minDate = new Date();
    minDate.setHours(minDate.getHours() + 2);
    return minDate.toISOString().split('T')[0];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[1600px] h-[95vh] overflow-hidden flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header with Dark Background */}
          <div className="bg-[#2D1B4E] px-8 py-5 relative flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="absolute top-4 right-4 p-1 text-white/80 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-white mb-1">
              {appointment ? 'Edit Appointment' : 'Book New Appointment'}
            </h2>
            <p className="text-white/70 text-sm">
              {appointment ? 'Update appointment details' : 'Schedule a new appointment for your client'}
            </p>
          </div>

          {/* Content - 3 Column Layout */}
          <div className="flex-1 overflow-hidden flex">
            {/* COLUMN 1: CLIENT INFORMATION */}
            <div className="w-80 overflow-y-auto bg-gray-50 border-r border-gray-200 p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b-2 border-[#2D1B4E]">
                  <div className="w-7 h-7 bg-[#2D1B4E] text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <h3 className="text-base font-bold text-gray-900">Client Info</h3>
                </div>
              
              {/* Guest Client Toggle */}
              {!appointment && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isGuestMode}
                      onChange={(e) => {
                        setIsGuestMode(e.target.checked);
                        if (e.target.checked) {
                          // Clear client selection when switching to guest mode
                          setFormData({ ...formData, clientId: '', clientName: '', clientPhone: '', clientEmail: '' });
                          setSelectedClientName('');
                          setClientSearchTerm('');
                        } else {
                          // Clear manual entry when switching to client search
                          setFormData({ ...formData, clientName: '', clientPhone: '', clientEmail: '' });
                        }
                      }}
                      className="mt-0.5 w-4 h-4 text-[#2D1B4E] border-gray-300 rounded focus:ring-[#2D1B4E]"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">Guest Client (Not Registered)</span>
                      <p className="text-xs text-gray-500 mt-0.5">Client is not in the system - enter details manually</p>
                    </div>
                  </label>
                </div>
              )}

            {/* Client Selection or Guest Client Info */}
            {isGuestMode ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter client name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.clientPhone}
                    onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="09XX XXX XXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="client@example.com"
                  />
                </div>
              </div>
            ) : (
              <div className="relative client-search-container">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Client *
                </label>
                <input
                  type="text"
                  required={!formData.clientId}
                  value={selectedClientName || clientSearchTerm}
                  onChange={(e) => {
                    setClientSearchTerm(e.target.value);
                    setSelectedClientName('');
                    setFormData({ 
                      ...formData, 
                      clientId: '', 
                      clientName: '', 
                      clientPhone: '', 
                      clientEmail: '' 
                    });
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  placeholder="Type to search client name, phone, or email..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoComplete="off"
                />
                
                {/* Filtered Client Dropdown */}
                {showClientDropdown && clients && clients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {clients
                      .filter(c => c && c.id)
                      .filter(client => {
                        const searchLower = clientSearchTerm.toLowerCase();
                        const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
                        const phone = (client.phoneNumber || '').toLowerCase();
                        const email = (client.email || '').toLowerCase();
                        return fullName.includes(searchLower) || phone.includes(searchLower) || email.includes(searchLower);
                      })
                      .map(client => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            setFormData({ 
                              ...formData, 
                              clientId: client.id,
                              clientName: `${client.firstName} ${client.lastName}`,
                              clientPhone: client.phoneNumber || '',
                              clientEmail: client.email || ''
                            });
                            setSelectedClientName(`${client.firstName} ${client.lastName}`);
                            setClientSearchTerm('');
                            setShowClientDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">
                            {client.firstName} {client.lastName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {client.phoneNumber || client.email}
                          </div>
                        </button>
                      ))}
                    {clients.filter(c => c && c.id).filter(client => {
                      const searchLower = clientSearchTerm.toLowerCase();
                      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
                      const phone = (client.phoneNumber || '').toLowerCase();
                      const email = (client.email || '').toLowerCase();
                      return fullName.includes(searchLower) || phone.includes(searchLower) || email.includes(searchLower);
                    }).length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">
                        No clients found. Try adjusting your search.
                      </div>
                    )}
                  </div>
                )}
                
                {/* Selected Client Display */}
                {formData.clientId && selectedClientName && (
                  <div className="mt-2 flex items-center justify-between bg-primary-50 border border-primary-200 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium text-primary-900">
                      ✓ Selected: {selectedClientName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ 
                          ...formData, 
                          clientId: '', 
                          clientName: '', 
                          clientPhone: '', 
                          clientEmail: '' 
                        });
                        setSelectedClientName('');
                        setClientSearchTerm('');
                      }}
                      className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                    >
                      Change
                    </button>
                  </div>
                )}
                
                <p className="text-xs text-gray-500 mt-1">
                  Can't find the client? Check the "Guest Client" option above to enter details manually.
                </p>
              </div>
            )}

            {/* Branch Selection - Only show if userBranch not provided */}
            {!userBranch && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch *
                </label>
                <select
                  required
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select branch</option>
                  {branches && branches.filter(b => b && b.id).map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name || branch.branchName}
                    </option>
                  ))}
                </select>
              </div>
            )}
              </div>
            </div>
            {/* END COLUMN 1 */}

            {/* COLUMN 2: SERVICES & STYLISTS */}
            <div className="flex-1 overflow-y-auto bg-gray-50 border-r border-gray-200 p-4">
              <div className="space-y-4">
                {/* SECTION 2: SERVICES */}
                <div>
                  <div className="flex items-center gap-2 pb-2 border-b-2 border-[#2D1B4E] mb-3">
                    <div className="w-7 h-7 bg-[#2D1B4E] text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                    <h3 className="text-base font-bold text-gray-900">Services</h3>
                  </div>

            {/* Service Selection - Multiple */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500">
                  Select services (multiple allowed)
                </p>
                {formData.services.length > 0 && (
                  <span className="text-sm font-medium text-[#2D1B4E]">
                    {formData.services.length} selected
                  </span>
                )}
              </div>
              
              {/* Service Search */}
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    value={serviceSearchTerm}
                    onChange={(e) => setServiceSearchTerm(e.target.value)}
                    placeholder="Search services..."
                    className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B4E] focus:border-[#2D1B4E] text-sm"
                  />
                  {serviceSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setServiceSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {/* Quick Filters */}
                {formData.services.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        showSelectedOnly
                          ? 'bg-[#2D1B4E] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {showSelectedOnly ? '✓ Selected Only' : 'Show Selected Only'}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2">
                {services && services.filter(s => s && s.id).length > 0 ? (
                  (() => {
                    const filteredServices = services
                      .filter(s => s && s.id)
                      .filter(service => {
                        // Search filter
                        const matchesSearch = serviceSearchTerm === '' || 
                          service.name.toLowerCase().includes(serviceSearchTerm.toLowerCase()) ||
                          (service.price && service.price.toString().includes(serviceSearchTerm)) ||
                          (service.duration && service.duration.toString().includes(serviceSearchTerm));
                        
                        // Selected only filter
                        const isSelected = formData.services.some(s => s.serviceId === service.id);
                        const matchesSelectedFilter = !showSelectedOnly || isSelected;
                        
                        return matchesSearch && matchesSelectedFilter;
                      });
                    
                    if (filteredServices.length === 0) {
                      return (
                        <p className="text-sm text-gray-500 text-center py-4">
                          {showSelectedOnly 
                            ? 'No selected services'
                            : serviceSearchTerm 
                              ? `No services found matching "${serviceSearchTerm}"`
                              : 'No services available'
                          }
                        </p>
                      );
                    }
                    
                    return (
                      <>
                        <div className="text-xs text-gray-500 mb-3">
                          Showing {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''}
                        </div>
                        <div className="grid grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
                          {filteredServices.map(service => {
                            const serviceObj = formData.services.find(s => s.serviceId === service.id);
                            const isSelected = !!serviceObj;
                            
                            return (
                              <div
                                key={service.id}
                                className={`bg-white rounded-lg border-2 p-3 transition-all cursor-pointer hover:shadow-md relative ${
                                  isSelected
                                    ? 'border-[#2D1B4E] shadow-sm'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                onClick={() => {
                                  const e = { target: { checked: !isSelected } };
                                  const newServices = e.target.checked
                                    ? [...formData.services, { serviceId: service.id, stylistId: '' }]
                                    : formData.services.filter(s => s.serviceId !== service.id);
                                  const newDuration = newServices.reduce((sum, serviceObj) => {
                                    const s = services.find(srv => srv.id === serviceObj.serviceId);
                                    return sum + (s?.duration || 0);
                                  }, 0);
                                  setFormData({ 
                                    ...formData, 
                                    services: newServices,
                                    duration: newDuration,
                                    timeSlot: null
                                  });
                                }}
                              >
                                {isSelected && (
                                  <div className="absolute top-3 right-3 w-6 h-6 bg-[#2D1B4E] rounded-full flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                                    </svg>
                                  </div>
                                )}
                                <h4 className="font-semibold text-gray-900 mb-1 pr-8">{service.name}</h4>
                                {service.description && (
                                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">{service.description}</p>
                                )}
                                <div className="flex items-center justify-between text-sm mt-3">
                                  <span className="text-gray-600">{service.duration} min</span>
                                  <span className="font-bold text-gray-900">₱{service.price}</span>
                                </div>
                                {service.isChemical && (
                                  <div className="mt-2">
                                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                                      CHEMICAL
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No services available</p>
                )}
              </div>
            </div>
                </div>
                {/* END SECTION 2 */}

                {/* SECTION 3: ASSIGN STYLISTS */}
                {formData.services.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-[#2D1B4E] mb-3">
                      <div className="w-7 h-7 bg-[#2D1B4E] text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                      <h3 className="text-base font-bold text-gray-900">Assign Stylists</h3>
                    </div>
            
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500">{formData.services.length} service{formData.services.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
                  {formData.services.map((serviceObj) => {
                    const service = services && services.find(s => s && s.id === serviceObj.serviceId);
                    if (!service) return null;
                    
                    return (
                      <div key={serviceObj.serviceId} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-sm text-gray-900">{service.name}</h4>
                            <p className="text-xs text-gray-600 mt-0.5">₱{service.price} • {service.duration} min</p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            Stylist (Optional)
                          </label>
                          <select
                            value={serviceObj.stylistId || ''}
                            onChange={(e) => {
                              const newServices = formData.services.map(s => 
                                s.serviceId === serviceObj.serviceId 
                                  ? { ...s, stylistId: e.target.value }
                                  : s
                              );
                              setFormData({ ...formData, services: newServices, timeSlot: null });
                            }}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B4E] focus:border-[#2D1B4E] bg-white"
                          >
                            <option value="">Any Available Stylist</option>
                            {stylists && stylists.filter(st => st && st.id).map(stylist => (
                              <option key={stylist.id} value={stylist.id}>
                                {stylist.firstName} {stylist.lastName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
                  </div>
                )}
              {/* END SECTION 3 */}

              </div>
            </div>
            {/* END COLUMN 2 */}

            {/* COLUMN 3: DATE & TIME SCHEDULING */}
            <div className="w-96 overflow-y-auto bg-white p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b-2 border-[#2D1B4E]">
                  <div className="w-7 h-7 bg-[#2D1B4E] text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                  <h3 className="text-base font-bold text-gray-900">Scheduling</h3>
                </div>

            {/* Date Selection */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={formData.appointmentDate}
                onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value, timeSlot: null })}
                min={getMinDateTime()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Appointments must be booked at least 2 hours in advance
              </p>
            </div>

            {/* Time Slot Selection */}
            {formData.appointmentDate && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-3">
                  Select available time slot
                </p>
                {loadingSlots ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <LoadingSpinner size="md" />
                    <p className="text-sm text-gray-500 mt-3">Loading available slots...</p>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                    <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-2" />
                    <p className="text-sm text-amber-900 font-medium">
                      {unavailableMessage || 'No available slots for this date'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {availableSlots.map((slot, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => slot.available && setFormData({ ...formData, timeSlot: slot })}
                        disabled={!slot.available}
                        className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap ${
                          formData.timeSlot?.time === slot.time
                            ? 'bg-[#2D1B4E] text-white border-[#2D1B4E]'
                            : slot.available
                            ? 'bg-white text-gray-700 border-gray-300 hover:border-[#2D1B4E] hover:text-[#2D1B4E]'
                            : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                        }`}
                      >
                        {formatTime(slot.time)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

              {/* Notes */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B4E] focus:border-[#2D1B4E] text-sm resize-none"
                  placeholder="Special requests..."
                />
              </div>

              {/* Summary Section */}
              {formData.services.length > 0 && (
                <div className="mt-4 bg-[#2D1B4E] rounded-lg p-3 text-white">
                  <h3 className="text-sm font-semibold mb-2">Summary</h3>
                  <div className="space-y-2 text-sm">
                    {formData.services.map((serviceObj, idx) => {
                      const service = services && services.find(s => s && s.id === serviceObj.serviceId);
                      const stylist = stylists && stylists.find(st => st && st.id === serviceObj.stylistId);
                      if (!service) return null;
                      
                      return (
                        <div key={idx} className="border-b border-white/20 pb-2 last:border-0 last:pb-0">
                          <div className="flex justify-between items-start">
                            <span className="text-xs">{service.serviceName}</span>
                            <span className="font-bold text-xs">₱{service.price}</span>
                          </div>
                          <div className="text-xs text-white/70">
                            {service.duration} min • {stylist ? `${stylist.firstName} ${stylist.lastName}` : 'Any stylist'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/30 flex justify-between items-center">
                    <div>
                      <div className="text-xs text-white/70">Duration</div>
                      <div className="font-bold text-sm">{formData.duration || 0} min</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/70">Total</div>
                      <div className="text-xl font-bold">
                        ₱{formData.services.reduce((sum, serviceObj) => {
                          const s = services && services.find(srv => srv && srv.id === serviceObj.serviceId);
                          return sum + (s?.price || 0);
                        }, 0)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-4 space-y-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-3 bg-[#2D1B4E] text-white rounded-lg hover:bg-[#3D2B5E] transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading && <LoadingSpinner size="sm" />}
                  {loading ? 'Saving...' : (appointment ? 'Update' : 'Book Appointment')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="w-full px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
              </div>
            </div>
            {/* END COLUMN 3 */}

          </div>
        </form>
      </div>
    </div>
  );
};

export default AppointmentFormModal;
