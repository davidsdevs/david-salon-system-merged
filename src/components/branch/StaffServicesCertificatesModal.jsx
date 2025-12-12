/**
 * Staff Services & Certificates Modal
 * Allows configuring services and certificates for staff members
 * Big Data Friendly: Includes category filtering, search, and pagination
 */

import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Award, Scissors, Edit, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
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
  
  // Big Data Optimizations: Search, Filter, Pagination
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentServicePage, setCurrentServicePage] = useState(1);
  const [servicesPerPage] = useState(20); // Show 20 services per page
  
  // Certificate search and pagination
  const [certificateSearchTerm, setCertificateSearchTerm] = useState('');
  const [debouncedCertSearchTerm, setDebouncedCertSearchTerm] = useState('');
  const [currentCertPage, setCurrentCertPage] = useState(1);
  const [certsPerPage] = useState(10);

  useEffect(() => {
    if (isOpen && branchId) {
      fetchBranchServices();
      loadStaffData();
      // Reset filters when modal opens
      setServiceSearchTerm('');
      setDebouncedSearchTerm('');
      setCategoryFilter('all');
      setCurrentServicePage(1);
      setCertificateSearchTerm('');
      setDebouncedCertSearchTerm('');
      setCurrentCertPage(1);
    }
  }, [isOpen, branchId, staff]);

  // Debounce service search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(serviceSearchTerm);
      setCurrentServicePage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [serviceSearchTerm]);

  // Debounce certificate search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCertSearchTerm(certificateSearchTerm);
      setCurrentCertPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [certificateSearchTerm]);

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

  // Get available categories from services
  const availableCategories = useMemo(() => {
    const categories = new Set();
    branchServices.forEach(service => {
      if (service.category) {
        categories.add(service.category);
      }
    });
    return ['all', ...Array.from(categories).sort()];
  }, [branchServices]);

  // Filter and paginate services
  const filteredAndPaginatedServices = useMemo(() => {
    let filtered = branchServices;

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(service => service.category === categoryFilter);
    }

    // Apply search filter
    if (debouncedSearchTerm.trim()) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(service => 
        service.name?.toLowerCase().includes(searchLower) ||
        service.description?.toLowerCase().includes(searchLower) ||
        service.category?.toLowerCase().includes(searchLower)
      );
    }

    // Pagination
    const startIndex = (currentServicePage - 1) * servicesPerPage;
    const endIndex = startIndex + servicesPerPage;
    const paginated = filtered.slice(startIndex, endIndex);

    return {
      services: paginated,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / servicesPerPage),
      hasMore: endIndex < filtered.length,
      hasPrevious: currentServicePage > 1
    };
  }, [branchServices, categoryFilter, debouncedSearchTerm, currentServicePage, servicesPerPage]);

  // Filter and paginate certificates
  const filteredAndPaginatedCertificates = useMemo(() => {
    let filtered = certificates;

    // Apply search filter
    if (debouncedCertSearchTerm.trim()) {
      const searchLower = debouncedCertSearchTerm.toLowerCase();
      filtered = filtered.filter(cert => 
        cert.name?.toLowerCase().includes(searchLower) ||
        cert.issuer?.toLowerCase().includes(searchLower) ||
        cert.date?.toLowerCase().includes(searchLower)
      );
    }

    // Pagination
    const startIndex = (currentCertPage - 1) * certsPerPage;
    const endIndex = startIndex + certsPerPage;
    const paginated = filtered.slice(startIndex, endIndex);

    return {
      certificates: paginated,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / certsPerPage),
      hasMore: endIndex < filtered.length,
      hasPrevious: currentCertPage > 1
    };
  }, [certificates, debouncedCertSearchTerm, currentCertPage, certsPerPage]);

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
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Scissors className="w-5 h-5 text-primary-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Available Services
                    </h3>
                    <span className="text-sm text-gray-500">
                      ({selectedServices.length} selected of {branchServices.length} total)
                    </span>
                  </div>
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
                  <>
                    {/* Search and Filter Controls */}
                    <div className="mb-4 space-y-3">
                      <div className="flex flex-col sm:flex-row gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search services by name, description, or category..."
                            value={serviceSearchTerm}
                            onChange={(e) => setServiceSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                          />
                        </div>
                        
                        {/* Category Filter */}
                        <div className="relative sm:w-64">
                          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <select
                            value={categoryFilter}
                            onChange={(e) => {
                              setCategoryFilter(e.target.value);
                              setCurrentServicePage(1);
                            }}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm appearance-none bg-white"
                          >
                            <option value="all">All Categories</option>
                            {availableCategories.filter(cat => cat !== 'all').map(category => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      {/* Results Count */}
                      <div className="text-xs text-gray-600">
                        Showing {filteredAndPaginatedServices.services.length} of {filteredAndPaginatedServices.total} services
                        {categoryFilter !== 'all' && ` in "${categoryFilter}"`}
                        {debouncedSearchTerm && ` matching "${debouncedSearchTerm}"`}
                      </div>
                    </div>

                    {/* Services Grid */}
                    {filteredAndPaginatedServices.services.length === 0 ? (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                        <Scissors className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">No services found matching your criteria</p>
                        {(categoryFilter !== 'all' || debouncedSearchTerm) && (
                          <button
                            onClick={() => {
                              setCategoryFilter('all');
                              setServiceSearchTerm('');
                            }}
                            className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {filteredAndPaginatedServices.services.map((service) => (
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
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 truncate">{service.name}</p>
                                    {service.category && (
                                      <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                        {service.category}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {service.description && (
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                    {service.description}
                                  </p>
                                )}
                                <p className="text-xs text-primary-600 mt-1 font-medium">
                                  ₱{parseFloat(service.price || 0).toLocaleString()}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>

                        {/* Pagination Controls */}
                        {filteredAndPaginatedServices.totalPages > 1 && (
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                            <div className="text-sm text-gray-600">
                              Page {currentServicePage} of {filteredAndPaginatedServices.totalPages}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setCurrentServicePage(prev => Math.max(1, prev - 1))}
                                disabled={!filteredAndPaginatedServices.hasPrevious || isReadOnly}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <ChevronLeft className="w-4 h-4" />
                                Previous
                              </button>
                              <button
                                onClick={() => setCurrentServicePage(prev => Math.min(filteredAndPaginatedServices.totalPages, prev + 1))}
                                disabled={!filteredAndPaginatedServices.hasMore || isReadOnly}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                Next
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
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

                {/* Certificate Search */}
                {certificates.length > 5 && (
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search certificates..."
                        value={certificateSearchTerm}
                        onChange={(e) => setCertificateSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                      />
                    </div>
                    {filteredAndPaginatedCertificates.total !== certificates.length && (
                      <div className="text-xs text-gray-600 mt-1">
                        Showing {filteredAndPaginatedCertificates.certificates.length} of {filteredAndPaginatedCertificates.total} certificates
                      </div>
                    )}
                  </div>
                )}

                {/* Certificates List */}
                {certificates.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <Award className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No certificates added yet</p>
                  </div>
                ) : filteredAndPaginatedCertificates.certificates.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <Award className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No certificates found matching your search</p>
                    {certificateSearchTerm && (
                      <button
                        onClick={() => setCertificateSearchTerm('')}
                        className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {filteredAndPaginatedCertificates.certificates.map((cert, displayIndex) => {
                        // Find the actual index in the original certificates array
                        const actualIndex = certificates.findIndex(c => 
                          c.name === cert.name && 
                          c.issuer === cert.issuer && 
                          c.date === cert.date
                        );
                        
                        return (
                          <div
                            key={`${cert.name}-${cert.issuer}-${cert.date}-${displayIndex}`}
                            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{cert.name}</p>
                              <p className="text-sm text-gray-600 mt-1">
                                Issued by: {cert.issuer} • Date: {cert.date}
                              </p>
                            </div>
                            {!isReadOnly && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEditCertificate(actualIndex)}
                                  className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
                                  title="Edit Certificate"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCertificate(actualIndex)}
                                  className="p-2 text-red-600 hover:text-red-700 transition-colors"
                                  title="Delete Certificate"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Certificate Pagination */}
                    {filteredAndPaginatedCertificates.totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                        <div className="text-sm text-gray-600">
                          Page {currentCertPage} of {filteredAndPaginatedCertificates.totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCurrentCertPage(prev => Math.max(1, prev - 1))}
                            disabled={!filteredAndPaginatedCertificates.hasPrevious || isReadOnly}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                          </button>
                          <button
                            onClick={() => setCurrentCertPage(prev => Math.min(filteredAndPaginatedCertificates.totalPages, prev + 1))}
                            disabled={!filteredAndPaginatedCertificates.hasMore || isReadOnly}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Next
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
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

