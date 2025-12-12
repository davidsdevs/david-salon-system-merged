/**
 * Service Assessment Modal
 * Captures client type and price adjustments before service starts
 */

import { useState, useEffect } from 'react';
import { X, Scissors, Banknote } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';

const ServiceAssessmentModal = ({
  isOpen,
  onClose,
  onSubmit,
  appointment,
  loading = false
}) => {
  const [services, setServices] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (appointment && isOpen) {
      // Initialize services from appointment
      const initialServices = appointment.services && appointment.services.length > 0
        ? appointment.services.map(svc => ({
            serviceId: svc.serviceId,
            serviceName: svc.serviceName,
            basePrice: svc.price || svc.basePrice || 0,
            price: svc.adjustedPrice || svc.price || svc.basePrice || 0,
            clientType: svc.clientType || 'R',
            adjustment: svc.adjustment || 0,
            adjustmentReason: svc.adjustmentReason || '',
            stylistId: svc.stylistId,
            stylistName: svc.stylistName
          }))
        : appointment.serviceName
        ? [{
            serviceId: appointment.serviceId || '',
            serviceName: appointment.serviceName,
            basePrice: appointment.servicePrice || appointment.basePrice || 0,
            price: appointment.adjustedPrice || appointment.servicePrice || appointment.basePrice || 0,
            clientType: appointment.clientType || 'R',
            adjustment: appointment.adjustment || 0,
            adjustmentReason: appointment.adjustmentReason || '',
            stylistId: appointment.stylistId,
            stylistName: appointment.stylistName
          }]
        : [];

      setServices(initialServices);
      setHasChanges(false);
    }
  }, [appointment, isOpen]);

  const updateService = (index, field, value) => {
    const updated = [...services];
    if (field === 'adjustment') {
      const adjustment = parseFloat(value) || 0;
      updated[index].adjustment = adjustment;
      updated[index].price = updated[index].basePrice + adjustment;
    } else if (field === 'clientType') {
      updated[index].clientType = value;
    } else {
      updated[index][field] = value;
    }
    setServices(updated);
    setHasChanges(true);
  };

  const handleSubmit = () => {
    if (!hasChanges && services.length > 0) {
      // No changes, just proceed with existing values
      onSubmit(services);
      return;
    }

    // Validate all services have client type
    const allHaveClientType = services.every(svc => svc.clientType);
    if (!allHaveClientType) {
      toast.error('Please set client type for all services');
      return;
    }

    onSubmit(services);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#2D1B4E] px-6 py-4 text-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Service Assessment</h2>
              <p className="text-sm text-white/80 mt-1">
                Set client type and price adjustments before service starts
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-1 text-white/80 hover:text-white transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Client Info */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-4">
            <div>
              <p className="font-semibold text-gray-900">{appointment?.clientName}</p>
              <p className="text-sm text-gray-600">{appointment?.clientPhone || '-'}</p>
            </div>
          </div>
        </div>

        {/* Services List */}
        <div className="flex-1 overflow-y-auto p-6">
          {services.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Scissors className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">No services found</p>
              <p className="text-sm mt-2">This appointment has no services to assess.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {services.map((service, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                {/* Service Header */}
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                  <Scissors className="h-4 w-4 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">{service.serviceName}</h3>
                  <div className="ml-auto text-right">
                    <p className="text-sm text-gray-500">Base Price</p>
                    <p className="font-bold text-gray-900">₱{service.basePrice}</p>
                  </div>
                </div>

                {/* Client Type */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Type *
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`clientType-${index}`}
                        value="X"
                        checked={service.clientType === 'X'}
                        onChange={(e) => updateService(index, 'clientType', e.target.value)}
                        className="text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">X-New</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`clientType-${index}`}
                        value="R"
                        checked={service.clientType === 'R'}
                        onChange={(e) => updateService(index, 'clientType', e.target.value)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">R-Regular</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`clientType-${index}`}
                        value="TR"
                        checked={service.clientType === 'TR'}
                        onChange={(e) => updateService(index, 'clientType', e.target.value)}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">TR-Transfer</span>
                    </label>
                  </div>
                </div>

                {/* Price Adjustment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price Adjustment (Optional)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Adjustment (₱)"
                        value={service.adjustment || ''}
                        onChange={(e) => updateService(index, 'adjustment', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Reason (e.g., Long hair)"
                        value={service.adjustmentReason}
                        onChange={(e) => updateService(index, 'adjustmentReason', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent"
                      />
                    </div>
                  </div>
                  {service.adjustment !== 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="text-gray-400">Base: ₱{service.basePrice}</span>
                      <span className="mx-2">+</span>
                      <span className={service.adjustment > 0 ? 'text-green-600' : 'text-red-600'}>
                        ₱{service.adjustment}
                      </span>
                      <span className="mx-2">=</span>
                      <span className="font-semibold text-green-600">₱{service.price}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || services.length === 0}
            className="px-4 py-2 text-sm bg-[#2D1B4E] text-white rounded-lg hover:bg-[#3d2a5f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Banknote className="w-4 h-4" />
                <span>Confirm & Proceed</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceAssessmentModal;

