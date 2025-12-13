/**
 * Client Booking Modal Component
 * Multi-step procedural booking with timeline
 */

import { useState } from 'react';
import { X, Calendar, Clock, MapPin, Scissors, User, ChevronRight, ChevronLeft, Check, Plus, Trash2 } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import { formatTime } from '../../utils/helpers';

const ClientBookingModal = ({
  isOpen,
  onClose,
  bookingData,
  setBookingData,
  branches,
  services,
  stylists,
  availableSlots,
  loadingSlots,
  unavailableMessage,
  booking,
  onSubmit
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;

  // Reset function when modal closes
  const handleClose = () => {
    setCurrentStep(1);
    setBookingData({
      branchId: '',
      services: [], // Array of { serviceId, stylistId }
      date: '',
      timeSlot: null,
      notes: ''
    });
    onClose();
  };

  if (!isOpen) return null;

  // Reset step when modal opens
  if (isOpen && currentStep === 0) {
    setCurrentStep(1);
  }

  const steps = [
    { number: 1, title: 'Branch', icon: MapPin },
    { number: 2, title: 'Service', icon: Scissors },
    { number: 3, title: 'Stylist', icon: User },
    { number: 4, title: 'Date', icon: Calendar },
    { number: 5, title: 'Time', icon: Clock },
    { number: 6, title: 'Review', icon: Check },
  ];

  const handleNext = () => {
    // Validate current step before proceeding
    if (currentStep === 1 && !bookingData.branchId) {
      return; // Cannot proceed without branch
    }
    if (currentStep === 2 && (!bookingData.services || bookingData.services.length === 0)) {
      return; // Cannot proceed without at least one service
    }
    if (currentStep === 4 && !bookingData.date) {
      return; // Cannot proceed without date
    }
    if (currentStep === 5 && !bookingData.timeSlot) {
      return; // Cannot proceed without time slot
    }
    
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (currentStep === totalSteps && bookingData.timeSlot) {
    onSubmit();
    }
  };

  const isStepComplete = (step) => {
    switch (step) {
      case 1: return !!bookingData.branchId;
      case 2: return bookingData.services && bookingData.services.length > 0;
      case 3: return true; // Stylist assignment is optional
      case 4: return !!bookingData.date;
      case 5: return !!bookingData.timeSlot;
      case 6: return !!bookingData.timeSlot;
      default: return false;
    }
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1: return !!bookingData.branchId;
      case 2: return bookingData.services && bookingData.services.length > 0;
      case 3: return true; // Stylist assignment is optional
      case 4: return !!bookingData.date;
      case 5: return !!bookingData.timeSlot;
      case 6: return !!bookingData.timeSlot;
      default: return false;
    }
  };

  // Add a new service to the booking
  const addService = () => {
    const newServices = [...(bookingData.services || []), { serviceId: '', stylistId: '' }];
    setBookingData({ ...bookingData, services: newServices });
  };

  // Remove a service from the booking
  const removeService = (index) => {
    const newServices = bookingData.services.filter((_, i) => i !== index);
    setBookingData({ ...bookingData, services: newServices });
  };

  // Update a service in the booking
  const updateService = (index, field, value) => {
    const newServices = [...bookingData.services];
    newServices[index] = { ...newServices[index], [field]: value };
    setBookingData({ ...bookingData, services: newServices, timeSlot: null }); // Reset time slot when service changes
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: // Branch Selection
  return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Select Branch</h3>
              <p className="text-sm text-gray-600">Choose the salon branch where you'd like to book your appointment</p>
          </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Branch <span className="text-red-500">*</span>
              </label>
              <select
                value={bookingData.branchId}
                onChange={(e) => {
                  setBookingData({ 
                    ...bookingData, 
                    branchId: e.target.value, 
                    services: [],
                    date: '', 
                    timeSlot: null 
                  });
                }}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] text-base transition-colors bg-white"
                required
              >
                <option value="">Choose a branch</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name || branch.branchName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 2: // Service Selection - Multiple
        return (
          <div className="space-y-6 pb-4">
              <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Select Services</h3>
              <p className="text-sm text-gray-600">Choose one or more services you'd like to book</p>
            </div>
            
            {/* Services List - Scrollable if needed */}
            <div className="space-y-4 max-h-80 overflow-y-auto pr-2" style={{ 
              scrollbarWidth: 'thin',
              WebkitOverflowScrolling: 'touch'
            }}>
              {(bookingData.services || []).map((serviceItem, index) => {
                const selectedService = services.find(s => s.id === serviceItem.serviceId);
                return (
                  <div key={index} className="border-2 border-gray-200 rounded-lg p-4 bg-white hover:border-[#160B53]/30 transition-colors flex-shrink-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Service {index + 1} <span className="text-red-500">*</span>
                </label>
                <select
                          value={serviceItem.serviceId}
                          onChange={(e) => updateService(index, 'serviceId', e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] text-base transition-colors bg-white"
                  required
                >
                  <option value="">Choose a service</option>
                          {services
                            .filter(s => !bookingData.services?.some((si, i) => i !== index && si.serviceId === s.id))
                            .map(service => (
                    <option key={service.id} value={service.id}>
                              {service.serviceName}{service.isChemical ? ' [CHEMICAL]' : ''} - ₱{service.price?.toLocaleString()}
                    </option>
                  ))}
                </select>
                        {selectedService?.isChemical && (
                          <div className="mt-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-lg">
                            <p className="text-xs text-amber-900 font-semibold">
                              ⚠️ Chemical Service: Arrive 10 minutes early
                            </p>
                          </div>
                        )}
                      </div>
                      {(bookingData.services || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeService(index)}
                          className="mt-8 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          title="Remove service"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Service Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={addService}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#160B53] hover:bg-[#160B53]/5 transition-colors flex items-center justify-center gap-2 text-gray-700 font-medium"
              >
                <Plus className="w-5 h-5" />
                Add Another Service
              </button>
            </div>

            {/* If no services, add first one */}
            {(!bookingData.services || bookingData.services.length === 0) && (
              <div className="text-center py-4">
                <button
                  type="button"
                  onClick={addService}
                  className="px-6 py-3 bg-gradient-to-r from-[#160B53] to-[#2D1B69] text-white rounded-lg hover:from-[#1a0f63] hover:to-[#35207a] transition-all font-semibold shadow-md"
                >
                  Add Your First Service
                </button>
              </div>
            )}
          </div>
        );

      case 3: // Stylist Selection - Assign to each service
        return (
          <div className="space-y-6 pb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Assign Stylists</h3>
              <p className="text-sm text-gray-600">Assign a preferred stylist to each service, or leave blank for any available stylist</p>
            </div>
            
            {/* Stylist Assignment for each service - Scrollable if needed */}
            <div className="space-y-4 max-h-80 overflow-y-auto pr-2" style={{ 
              scrollbarWidth: 'thin',
              WebkitOverflowScrolling: 'touch'
            }}>
              {(bookingData.services || []).map((serviceItem, index) => {
                const selectedService = services.find(s => s.id === serviceItem.serviceId);
                return (
                  <div key={index} className="border-2 border-gray-200 rounded-lg p-4 bg-white flex-shrink-0">
              <div>
                      <p className="text-sm font-semibold text-gray-900 mb-1">
                        Service {index + 1}: {selectedService?.serviceName || 'Not selected'}
                      </p>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Preferred Stylist <span className="text-gray-500 font-normal">(Optional)</span>
                </label>
                <select
                        value={serviceItem.stylistId || ''}
                        onChange={(e) => updateService(index, 'stylistId', e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] text-sm transition-colors bg-white"
                >
                  <option value="">Any available stylist</option>
                  {stylists.map(stylist => (
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

            {(!bookingData.services || bookingData.services.length === 0) && (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-sm text-gray-500">Please add services in the previous step</p>
              </div>
            )}
          </div>
        );

      case 4: // Date Selection
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Select Date</h3>
              <p className="text-sm text-gray-600">Choose your preferred appointment date</p>
            </div>
              <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={bookingData.date}
                  onChange={(e) => setBookingData({ ...bookingData, date: e.target.value, timeSlot: null })}
                  min={(() => {
                  const today = new Date();
                  const minDate = new Date(today);
                    minDate.setHours(minDate.getHours() + 2);
                  if (today.getHours() < 22) {
                    return today.toISOString().split('T')[0];
                  }
                  const tomorrow = new Date(today);
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  return tomorrow.toISOString().split('T')[0];
                  })()}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] text-base transition-colors bg-white"
                  required
                />
              <p className="text-xs text-gray-500 mt-3 bg-blue-50 border border-blue-200 rounded-lg p-2">
                ℹ️ Bookings must be made at least 2 hours in advance
              </p>
            </div>
              </div>
        );

      case 5: // Time Slot Selection
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Select Time Slot</h3>
              <p className="text-sm text-gray-600">Choose your preferred appointment time</p>
            </div>
              <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Time Slot <span className="text-red-500">*</span>
                </label>
                {loadingSlots ? (
                <div className="flex items-center justify-center py-16 bg-gray-50 rounded-lg border-2 border-gray-200">
                    <LoadingSpinner size="md" />
                  </div>
                ) : availableSlots.length === 0 ? (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-8 text-center shadow-sm">
                  <p className="text-base text-amber-900 font-semibold">
                      {unavailableMessage || 'No available slots for this date'}
                    </p>
                  <p className="text-sm text-amber-800 mt-2">Please try selecting a different date</p>
                  </div>
                ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    {availableSlots.map((slot, index) => {
                      const slotTime = slot.time instanceof Date ? slot.time : new Date(slot.time);
                      const now = new Date();
                    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
                    const isPast = slotTime.getTime() <= twoHoursFromNow.getTime();
                      const isDisabled = !slot.available || isPast;
                      
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => !isDisabled && setBookingData({ ...bookingData, timeSlot: slot })}
                          disabled={isDisabled}
                        className={`px-4 py-3 text-sm font-medium rounded-lg border-2 transition-all ${
                            bookingData.timeSlot?.time && 
                            (bookingData.timeSlot.time instanceof Date ? bookingData.timeSlot.time : new Date(bookingData.timeSlot.time)).getTime() === slotTime.getTime()
                            ? 'bg-gradient-to-br from-[#160B53] to-[#2D1B69] text-white border-[#160B53] shadow-lg scale-105'
                              : isDisabled
                              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-[#160B53] hover:shadow-md hover:bg-[#160B53]/5'
                          }`}
                        >
                          {formatTime(slot.time)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
          </div>
        );

      case 6: // Review & Notes
        return (
          <div className="space-y-6 pb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Review & Confirm</h3>
              <p className="text-sm text-gray-600">Review your booking details and add any special requests</p>
            </div>

            {/* Booking Summary - Enhanced - Scrollable if needed */}
            <div className="bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 rounded-xl p-5 space-y-4 shadow-sm max-h-80 overflow-y-auto pr-2" style={{ 
              scrollbarWidth: 'thin',
              WebkitOverflowScrolling: 'touch'
            }}>
              <h4 className="text-lg font-bold text-[#160B53] mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-[#160B53] to-[#2D1B69] rounded-full"></div>
                Booking Summary
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-[#160B53]/30 transition-colors">
                  <div className="p-2 bg-[#160B53]/10 rounded-lg">
                    <MapPin className="w-5 h-5 text-[#160B53]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Branch</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {branches.find(b => b.id === bookingData.branchId)?.name || branches.find(b => b.id === bookingData.branchId)?.branchName || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Services List */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Services</p>
                  {(bookingData.services || []).map((serviceItem, index) => {
                    const service = services.find(s => s.id === serviceItem.serviceId);
                    const stylist = stylists.find(s => s.id === serviceItem.stylistId);
                    return (
                      <div key={index} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-[#160B53]/30 transition-colors">
                        <div className="p-2 bg-[#160B53]/10 rounded-lg">
                          <Scissors className="w-5 h-5 text-[#160B53]" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {service?.serviceName || 'Not selected'}
                          </p>
                          {service?.price && (
                            <p className="text-sm text-[#160B53] font-bold mt-1">
                              ₱{service.price.toLocaleString()}
                            </p>
                          )}
                          {stylist && (
                            <div className="flex items-center gap-2 mt-2">
                              <User className="w-4 h-4 text-gray-500" />
                              <p className="text-xs text-gray-600">
                                Stylist: {stylist.firstName} {stylist.lastName}
                              </p>
                            </div>
                          )}
                          {!stylist && (
                            <p className="text-xs text-gray-500 mt-2 italic">Any available stylist</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-[#160B53]/30 transition-colors">
                  <div className="p-2 bg-[#160B53]/10 rounded-lg">
                    <Calendar className="w-5 h-5 text-[#160B53]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {bookingData.date ? new Date(bookingData.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-[#160B53]/30 transition-colors">
                  <div className="p-2 bg-[#160B53]/10 rounded-lg">
                    <Clock className="w-5 h-5 text-[#160B53]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Time</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {bookingData.timeSlot ? formatTime(bookingData.timeSlot.time) : 'N/A'}
                    </p>
                  </div>
                </div>

                {(() => {
                  const totalPrice = (bookingData.services || []).reduce((sum, serviceItem) => {
                    const service = services.find(s => s.id === serviceItem.serviceId);
                    return sum + (service?.price || 0);
                  }, 0);
                  
                  if (totalPrice > 0) {
                    return (
                      <div className="pt-4 mt-4 border-t-2 border-gray-300 flex justify-between items-center bg-gradient-to-r from-[#160B53]/5 to-[#2D1B69]/5 p-4 rounded-lg">
                        <span className="text-base font-bold text-gray-900">Estimated Total</span>
                        <span className="text-2xl font-bold text-[#160B53]">
                          ₱{totalPrice.toLocaleString()}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            {/* Notes */}
              <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Special Requests or Notes <span className="text-gray-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  value={bookingData.notes}
                  onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                rows={4}
                placeholder="Any special requests, allergies, or notes for the stylist..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] resize-none transition-colors"
              />
            </div>

            {/* Terms and Conditions - Enhanced */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5 shadow-sm">
              <h5 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                Terms and Conditions
              </h5>
              <div className="space-y-2 text-sm text-blue-800">
                <p>By booking this appointment, you agree to arrive on time.</p>
                {(bookingData.services || []).some(si => {
                  const service = services.find(s => s.id === si.serviceId);
                  return service?.isChemical;
                }) && (
                  <div className="bg-amber-100 border border-amber-300 rounded-lg p-3 mt-3">
                    <p className="font-semibold text-amber-900 flex items-center gap-2">
                      ⚠️ Chemical Service Notice
                    </p>
                    <p className="text-amber-800 mt-1">
                      Please arrive 10 minutes before your appointment time.
                    </p>
                  </div>
                )}
                <p className="mt-3 font-medium">
                  Appointments must be confirmed within 24 hours or they will be automatically cancelled.
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col" style={{ maxHeight: '95vh' }}>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-[#160B53] to-[#2D1B69] px-4 sm:px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-xl font-bold text-white">Book Appointment</h2>
              <p className="text-xs text-blue-100 mt-1">Step {currentStep} of {totalSteps}</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={booking}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Step Timeline - Enhanced */}
          <div className="bg-gradient-to-b from-gray-50 to-white border-b border-gray-200 px-4 sm:px-6 py-5 flex-shrink-0">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === step.number;
                const isComplete = isStepComplete(step.number);
                const isPast = currentStep > step.number;

                return (
                  <div key={step.number} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1 relative z-10">
                      <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all shadow-md ${
                        isActive
                          ? 'bg-gradient-to-br from-[#160B53] to-[#2D1B69] border-[#160B53] text-white scale-110'
                          : isComplete || isPast
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'bg-white border-gray-300 text-gray-400'
                      }`}>
                        {isComplete && !isActive ? (
                          <Check className="w-6 h-6" />
                        ) : (
                          <Icon className="w-6 h-6" />
                        )}
                      </div>
                      <span className={`text-xs mt-2 text-center font-medium ${
                        isActive 
                          ? 'font-semibold text-[#160B53]' 
                          : isComplete || isPast
                          ? 'text-green-600'
                          : 'text-gray-500'
                      }`}>
                        {step.title}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`flex-1 h-1 mx-2 rounded-full transition-all ${
                        isPast || isComplete 
                          ? 'bg-gradient-to-r from-green-500 to-green-400' 
                          : 'bg-gray-300'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto" style={{ 
            maxHeight: 'calc(95vh - 280px)',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin'
          }}>
            <div className="p-4 sm:p-6 min-h-full">
              {renderStepContent()}
            </div>
          </div>

          {/* Footer - Navigation Buttons - Enhanced */}
          <div className="bg-gradient-to-r from-gray-50 to-white border-t-2 border-gray-200 px-4 sm:px-6 py-4 flex justify-between items-center gap-3 flex-shrink-0 shadow-lg">
            <div className="flex gap-3">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={booking}
                  className="px-5 py-2.5 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={booking}
                className="px-5 py-2.5 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
              >
                Cancel
              </button>
              {currentStep < totalSteps ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceedToNext() || booking}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#160B53] to-[#2D1B69] text-white rounded-lg hover:from-[#1a0f63] hover:to-[#35207a] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold shadow-md hover:shadow-lg"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
            <button
              type="submit"
                  disabled={!bookingData.timeSlot || booking}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#160B53] to-[#2D1B69] text-white rounded-lg hover:from-[#1a0f63] hover:to-[#35207a] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold shadow-md hover:shadow-lg"
            >
              {booking && <LoadingSpinner size="sm" />}
              {booking ? 'Booking...' : 'Confirm Booking'}
            </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientBookingModal;
