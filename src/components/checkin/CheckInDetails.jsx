import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import { X, Calendar, Clock, User, Phone, Mail, MapPin, Scissors, FileText, CheckCircle } from 'lucide-react';
import { formatDate, formatTime } from '../../utils/helpers';

const CheckInDetails = ({ checkIn, onClose, currentUserId }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (checkIn) {
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      setIsAnimating(false);
    }
  }, [checkIn]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => onClose(), 300);
  };

  if (!checkIn) return null;

  const getStatusBadge = (status) => {
    const statusColors = {
      'arrived': 'bg-blue-100 text-blue-800 border-blue-200',
      'in_service': 'bg-purple-100 text-purple-800 border-purple-200',
      'in-service': 'bg-purple-100 text-purple-800 border-purple-200',
      'in_progress': 'bg-purple-100 text-purple-800 border-purple-200',
      'completed': 'bg-green-100 text-green-800 border-green-200',
      'cancelled': 'bg-red-100 text-red-800 border-red-200'
    };

    const statusLabels = {
      'arrived': 'ARRIVED',
      'in_service': 'IN SERVICE',
      'in-service': 'IN SERVICE',
      'in_progress': 'IN PROGRESS',
      'completed': 'COMPLETED',
      'cancelled': 'CANCELLED'
    };

    const color = statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
    const label = statusLabels[status] || status?.replace('_', ' ').toUpperCase() || 'UNKNOWN';

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border-2 ${color}`}>
        {label}
      </span>
    );
  };

  // Get services from check-in
  const services = checkIn.services && Array.isArray(checkIn.services) && checkIn.services.length > 0
    ? checkIn.services
    : checkIn.serviceName
    ? [{
        serviceName: checkIn.serviceName,
        price: checkIn.servicePrice || 0,
        duration: checkIn.duration || 30,
        stylistId: checkIn.stylistId,
        stylistName: checkIn.stylistName || 'Not assigned'
      }]
    : [];

  const totalPrice = services.reduce((total, service) => total + (parseFloat(service.price) || 0), 0);
  const totalDuration = services.reduce((total, service) => total + (parseInt(service.duration) || 30), 0);

  return (
    <div 
      className={`fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 transition-opacity duration-200 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      <div 
        className={`bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[98vh] sm:max-h-[95vh] overflow-hidden flex flex-col transition-all duration-300 ease-out transform ${isAnimating ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-8 scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#160B53] to-[#2D1B69] px-4 sm:px-6 py-3 sm:py-4 text-white flex-shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg sm:text-2xl font-bold">Check-In Details</h2>
              <p className="text-blue-100 mt-1 text-sm sm:text-base">
                View check-in information
              </p>
            </div>
            <button 
              onClick={handleClose}
              className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-6">
            {/* Header with Client and Status */}
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{checkIn.clientName || 'Guest Client'}</h3>
              <p className="text-gray-600 mb-4">Check-In #{checkIn.id?.slice(-8) || 'N/A'}</p>
              <div className="flex justify-center">
                {getStatusBadge(checkIn.status)}
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Client & Check-In Info */}
              <div className="space-y-6">
                {/* Client Information */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center mb-4">
                    <User className="w-5 h-5 text-[#160B53] mr-2" />
                    <h4 className="text-lg font-semibold text-gray-900">Client Information</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="font-medium text-gray-700">Name:</span>
                      <span className="text-gray-900">{checkIn.clientName || 'N/A'}</span>
                    </div>
                    {checkIn.clientPhone && (
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="font-medium text-gray-700">Phone:</span>
                        <a href={`tel:${checkIn.clientPhone}`} className="text-primary-600 hover:underline">
                          {checkIn.clientPhone}
                        </a>
                      </div>
                    )}
                    {checkIn.clientEmail && (
                      <div className="flex justify-between items-center py-2">
                        <span className="font-medium text-gray-700">Email:</span>
                        <a href={`mailto:${checkIn.clientEmail}`} className="text-primary-600 hover:underline truncate max-w-xs">
                          {checkIn.clientEmail}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Check-In Details */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center mb-4">
                    <Clock className="w-5 h-5 text-[#160B53] mr-2" />
                    <h4 className="text-lg font-semibold text-gray-900">Check-In Details</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="font-medium text-gray-700">Arrived At:</span>
                      <span className="text-gray-900">
                        {checkIn.arrivedAt ? formatTime(checkIn.arrivedAt) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="font-medium text-gray-700">Date:</span>
                      <span className="text-gray-900">
                        {checkIn.arrivedAt ? formatDate(checkIn.arrivedAt) : 'N/A'}
                      </span>
                    </div>
                    {checkIn.branchName && (
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="font-medium text-gray-700">Branch:</span>
                        <span className="text-gray-900">{checkIn.branchName}</span>
                      </div>
                    )}
                    {checkIn.appointmentId && (
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="font-medium text-gray-700">Appointment ID:</span>
                        <span className="text-gray-900 font-mono text-sm">{checkIn.appointmentId.substring(0, 12)}...</span>
                      </div>
                    )}
                    {checkIn.notes && (
                      <div className="pt-2">
                        <span className="font-medium text-gray-700 block mb-1">Notes:</span>
                        <span className="text-gray-900 text-sm bg-gray-50 p-2 rounded block">{checkIn.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Services */}
              <div className="space-y-6">
                {/* Services */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center mb-4">
                    <Scissors className="w-5 h-5 text-[#160B53] mr-2" />
                    <h4 className="text-lg font-semibold text-gray-900">Services</h4>
                  </div>
                  <div className="space-y-4">
                    {services.length > 0 ? (
                      <>
                        {services.map((service, index) => {
                          const isMyService = currentUserId && service.stylistId === currentUserId;
                          return (
                            <div 
                              key={index} 
                              className={`rounded-lg p-4 border-2 ${
                                isMyService
                                  ? 'bg-primary-100 border-primary-400'
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h5 className="font-semibold text-gray-900">{service.serviceName || 'Unknown Service'}</h5>
                                    {isMyService && (
                                      <span className="px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full font-medium">
                                        Your Service
                                      </span>
                                    )}
                                  </div>
                                  {service.stylistName && (
                                    <div className="flex items-center text-sm text-gray-600">
                                      <User className="w-4 h-4 mr-1" />
                                      <span>Stylist: {service.stylistName}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="text-right ml-4">
                                  {service.price && (
                                    <p className={`font-bold text-lg ${
                                      isMyService ? 'text-primary-900' : 'text-gray-900'
                                    }`}>
                                      ₱{parseFloat(service.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                  )}
                                  {service.duration && (
                                    <p className="text-sm text-gray-600">{service.duration} min</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Total Summary */}
                        {services.length > 1 && (
                          <div className="bg-gradient-to-r from-[#160B53] to-[#2D1B69] rounded-lg p-4 text-white">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-lg">Total:</span>
                              <div className="text-right">
                                <div className="text-2xl font-bold">
                                  ₱{totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                {totalDuration > 0 && (
                                  <div className="text-sm opacity-90">
                                    {totalDuration} minutes total
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No services listed</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions - Fixed at bottom */}
        <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t flex-shrink-0">
          <div className="flex justify-end gap-3">
            <Button 
              variant="outline"
              onClick={handleClose}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckInDetails;

