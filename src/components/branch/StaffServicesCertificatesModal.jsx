/**
 * Staff Services & Certificates Modal
 * Allows configuring services and certificates for staff members
 */

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Award, Scissors, Edit } from 'lucide-react';
import { getBranchServices } from '../../services/branchServicesService';
import { updateUser } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';

const StaffServicesCertificatesModal = ({ 
  isOpen, 
  staff, 
  branchId,
  onClose,
  onSave,
  isReadOnly = false
}) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branchServices, setBranchServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [showCertificateForm, setShowCertificateForm] = useState(false);
  const [editingCertificateIndex, setEditingCertificateIndex] = useState(null);
  const [certificateForm, setCertificateForm] = useState({
    name: '',
    issuer: '',
    date: ''
  });

  useEffect(() => {
    if (isOpen && branchId) {
      fetchBranchServices();
      loadStaffData();
    }
  }, [isOpen, branchId, staff]);

  const fetchBranchServices = async () => {
    try {
      setLoading(true);
      const services = await getBranchServices(branchId);
      setBranchServices(services);
    } catch (error) {
      console.error('Error fetching branch services:', error);
      toast.error('Failed to load branch services');
    } finally {
      setLoading(false);
    }
  };

  const loadStaffData = () => {
    if (staff) {
      // Load selected services
      const staffServiceIds = staff.service_id || [];
      setSelectedServices(staffServiceIds);
      
      // Load certificates
      const staffCertificates = staff.certificates || [];
      setCertificates(staffCertificates);
    } else {
      setSelectedServices([]);
      setCertificates([]);
    }
  };

  const handleServiceToggle = (serviceId) => {
    setSelectedServices(prev => {
      if (prev.includes(serviceId)) {
        return prev.filter(id => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  };

  const handleAddCertificate = () => {
    setCertificateForm({ name: '', issuer: '', date: '' });
    setEditingCertificateIndex(null);
    setShowCertificateForm(true);
  };

  const handleEditCertificate = (index) => {
    const cert = certificates[index];
    setCertificateForm({
      name: cert.name || '',
      issuer: cert.issuer || '',
      date: cert.date || ''
    });
    setEditingCertificateIndex(index);
    setShowCertificateForm(true);
  };

  const handleSaveCertificate = () => {
    if (!certificateForm.name || !certificateForm.issuer || !certificateForm.date) {
      toast.error('Please fill in all certificate fields');
      return;
    }

    if (editingCertificateIndex !== null) {
      // Update existing certificate
      const updated = [...certificates];
      updated[editingCertificateIndex] = { ...certificateForm };
      setCertificates(updated);
    } else {
      // Add new certificate
      setCertificates([...certificates, { ...certificateForm }]);
    }

    setShowCertificateForm(false);
    setCertificateForm({ name: '', issuer: '', date: '' });
    setEditingCertificateIndex(null);
  };

  const handleDeleteCertificate = (index) => {
    const updated = certificates.filter((_, i) => i !== index);
    setCertificates(updated);
  };

  const handleSave = async () => {
    if (!staff || !staff.id) {
      toast.error('Staff member not found');
      return;
    }

    try {
      setSaving(true);
      
      // Update user with services and certificates
      await updateUser(
        staff.id,
        {
          service_id: selectedServices,
          certificates: certificates
        },
        currentUser
      );

      toast.success('Staff services and certificates updated successfully!');
      onSave();
      onClose();
    } catch (error) {
      console.error('Error updating staff:', error);
      toast.error('Failed to update staff information');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isReadOnly ? 'View Services & Certificates' : 'Configure Services & Certificates'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {staff ? `${staff.firstName} ${staff.lastName}` : 'Staff Member'}
              {isReadOnly && <span className="ml-2 text-blue-600">(Read-only - Lent Staff)</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              {/* Services Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Scissors className="w-5 h-5 text-primary-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Available Services
                  </h3>
                  <span className="text-sm text-gray-500">
                    ({selectedServices.length} selected)
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  {isReadOnly 
                    ? 'Services this staff member can offer (from their original branch).' 
                    : 'Select the services this staff member can offer. Only services available at your branch are shown.'}
                </p>
                
                {branchServices.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-800 text-sm">
                      No services are currently available at this branch. Please configure branch services first.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {branchServices.map((service) => (
                      <label
                        key={service.id}
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg transition-colors ${
                          isReadOnly 
                            ? 'cursor-default' 
                            : 'cursor-pointer hover:border-gray-300'
                        } ${
                          selectedServices.includes(service.id)
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedServices.includes(service.id)}
                          onChange={() => handleServiceToggle(service.id)}
                          disabled={isReadOnly}
                          className={`w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 ${
                            isReadOnly ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{service.name}</p>
                          {service.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                              {service.description}
                            </p>
                          )}
                          <p className="text-xs text-primary-600 mt-1">
                            ₱{parseFloat(service.price || 0).toLocaleString()}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Certificates Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-primary-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Certificates
                    </h3>
                    <span className="text-sm text-gray-500">
                      ({certificates.length})
                    </span>
                  </div>
                  {!isReadOnly && (
                    <button
                      onClick={handleAddCertificate}
                      className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Add Certificate
                    </button>
                  )}
                </div>

                {/* Certificate Form */}
                {showCertificateForm && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-gray-900 mb-3">
                      {editingCertificateIndex !== null ? 'Edit Certificate' : 'Add Certificate'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Certificate Name *
                        </label>
                        <input
                          type="text"
                          value={certificateForm.name}
                          onChange={(e) => setCertificateForm({ ...certificateForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="e.g., Stylistathon"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Issuer *
                        </label>
                        <input
                          type="text"
                          value={certificateForm.issuer}
                          onChange={(e) => setCertificateForm({ ...certificateForm, issuer: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="e.g., SalonDevs"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Date *
                        </label>
                        <input
                          type="date"
                          value={certificateForm.date}
                          onChange={(e) => setCertificateForm({ ...certificateForm, date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={handleSaveCertificate}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
                      >
                        {editingCertificateIndex !== null ? 'Update' : 'Add'}
                      </button>
                      <button
                        onClick={() => {
                          setShowCertificateForm(false);
                          setCertificateForm({ name: '', issuer: '', date: '' });
                          setEditingCertificateIndex(null);
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Certificates List */}
                {certificates.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <Award className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No certificates added yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {certificates.map((cert, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{cert.name}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Issued by: {cert.issuer} ΓÇó Date: {cert.date}
                          </p>
                        </div>
                        {!isReadOnly && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditCertificate(index)}
                              className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
                              title="Edit Certificate"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCertificate(index)}
                              className="p-2 text-red-600 hover:text-red-700 transition-colors"
                              title="Delete Certificate"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={saving}
          >
            {isReadOnly ? 'Close' : 'Cancel'}
          </button>
          {!isReadOnly && (
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffServicesCertificatesModal;

