/**
 * Stylist Profile Page
 * View profile, stats, services, and manage account settings
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Building2, Scissors, DollarSign, Users, Calendar, Edit2, Camera, Upload, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../utils/constants';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getBranchById } from '../../services/branchService';
import { updateUserProfile } from '../../services/userService';
import { uploadToCloudinary, validateImageFile } from '../../services/imageService';
import { formatDate, getFullName, getInitials, formatCurrency } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const StylistProfile = () => {
  const { currentUser, userData, userBranch } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const [branchName, setBranchName] = useState('Loading...');
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [stats, setStats] = useState({
    totalClients: 0,
    totalEarnings: 0,
    totalAppointments: 0,
  });
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    phone: ''
  });

  useEffect(() => {
    if (userData) {
      setFormData({
        firstName: userData.firstName || '',
        middleName: userData.middleName || '',
        lastName: userData.lastName || '',
        phone: userData.phone || userData.phoneNumber || ''
      });
      setImagePreview(userData.photoURL || userData.imageURL || null);
    }
  }, [userData]);

  useEffect(() => {
    if (currentUser?.uid) {
      fetchBranchName();
      fetchServices();
      fetchStats();
    }
  }, [currentUser, userBranch]);

  const fetchBranchName = async () => {
    if (!userBranch) {
      setBranchName('Not assigned');
      return;
    }
    try {
      const branch = await getBranchById(userBranch);
      setBranchName(branch?.name || branch?.branchName || 'Unknown Branch');
    } catch (error) {
      console.error('Error fetching branch:', error);
      setBranchName('Error loading branch');
    }
  };

  const fetchServices = async () => {
    if (!currentUser?.uid) {
      setLoadingServices(false);
      return;
    }

    try {
      setLoadingServices(true);
      
      // Get stylist document to retrieve service IDs
      const stylistDoc = await getDoc(doc(db, 'users', currentUser.uid));
      
      if (!stylistDoc.exists()) {
        setServices([]);
        setLoadingServices(false);
        return;
      }

      const stylistData = stylistDoc.data();
      const serviceIds = stylistData.service_id || stylistData.serviceIds || [];
      
      if (serviceIds.length === 0) {
        setServices([]);
        setLoadingServices(false);
        return;
      }

      // Fetch service names from services collection
      const serviceNames = [];
      
      for (const serviceId of serviceIds) {
        try {
          const serviceDoc = await getDoc(doc(db, 'services', serviceId));
          if (serviceDoc.exists()) {
            const serviceData = serviceDoc.data();
            serviceNames.push(serviceData.name || serviceData.serviceName || 'Unknown Service');
          }
        } catch (error) {
          console.error('Error fetching service:', serviceId, error);
        }
      }

      setServices(serviceNames);
    } catch (error) {
      console.error('Error fetching stylist services:', error);
      setServices([]);
    } finally {
      setLoadingServices(false);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!currentUser?.uid) return;

    try {
      const transactionsRef = collection(db, 'transactions');
      const paidTransactionsQuery = query(transactionsRef, where('status', '==', 'paid'));

      const snapshot = await getDocs(paidTransactionsQuery);
      
      let totalEarnings = 0;
      const uniqueClients = new Set();
      let serviceCount = 0;

      snapshot.forEach((doc) => {
        const transData = doc.data();

        // Check if this transaction has services for this stylist
        let hasStylistService = false;

        // New schema: items[] array
        if (transData.items && Array.isArray(transData.items)) {
          transData.items.forEach((item) => {
            const itemStylistId = item.stylistId || transData.stylistId;
            if (itemStylistId === currentUser.uid) {
              hasStylistService = true;
              
              // Calculate commission
              const itemType = item.type || 'service';
              const itemTotal = (item.price || item.adjustedPrice || 0) * (item.quantity || 1);
              const commissionRate = itemType === 'service' ? 0.6 : 0.1;
              totalEarnings += itemTotal * commissionRate;
              
              if (itemType === 'service') {
                serviceCount++;
              }
            }
          });
        }
        // Legacy schema: services[] array
        else if (transData.services && Array.isArray(transData.services)) {
          transData.services.forEach((service) => {
            const serviceStylistId = service.stylistId || transData.stylistId;
            if (serviceStylistId === currentUser.uid) {
              hasStylistService = true;
              
              // Calculate commission (60% of service total)
              const serviceTotal = Number(service.adjustedPrice || service.price || 0);
              totalEarnings += serviceTotal * 0.6;
              serviceCount++;
            }
          });
        }

        // Count unique clients
        if (hasStylistService && transData.clientId) {
          uniqueClients.add(transData.clientId);
        }
      });

      setStats({
        totalClients: uniqueClients.size,
        totalEarnings: totalEarnings,
        totalAppointments: serviceCount,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateUserProfile(currentUser.uid, formData);
      setIsEditing(false);
      toast.success('Profile updated successfully!');
      // Reload page to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      // Error handled in service
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: userData?.firstName || '',
      middleName: userData?.middleName || '',
      lastName: userData?.lastName || '',
      phone: userData?.phone || userData?.phoneNumber || ''
    });
    setImagePreview(userData?.photoURL || userData?.imageURL || null);
    setIsEditing(false);
  };

  const handleImageClick = () => {
    if (isEditing) {
      fileInputRef.current?.click();
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateImageFile(file)) return;

    setUploadingImage(true);
    try {
      // Show preview immediately
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);

      // Upload to Cloudinary
      const imageUrl = await uploadToCloudinary(file, 'avatars');
      
      // Update Firestore
      await updateUserProfile(currentUser.uid, { photoURL: imageUrl });

      toast.success('Profile picture updated!');
    } catch (error) {
      console.error('Image upload error:', error);
      setImagePreview(userData?.photoURL || userData?.imageURL || null);
    } finally {
      setUploadingImage(false);
    }
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
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600 mt-1">View and manage your stylist profile</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Edit2 className="w-5 h-5" />
            Edit Profile
          </button>
        )}
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-8 rounded-t-xl">
          <div className="flex items-center gap-4">
            {/* Profile Picture */}
            <div className="relative">
              <div 
                className={`w-20 h-20 rounded-full overflow-hidden shadow-lg ${
                  isEditing ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
                }`}
                onClick={handleImageClick}
              >
                {imagePreview ? (
                  <img 
                    src={imagePreview} 
                    alt={getFullName(userData)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white flex items-center justify-center text-primary-600 font-bold text-3xl">
                    {getInitials(userData)}
                  </div>
                )}
              </div>
              {isEditing && (
                <div className="absolute bottom-0 right-0 bg-primary-500 rounded-full p-1.5 shadow-lg">
                  {uploadingImage ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Camera className="w-4 h-4 text-white" />
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
            <div className="text-white flex-1">
              <h2 className="text-2xl font-bold">{getFullName(userData)}</h2>
              <p className="text-primary-100 mt-1">Stylist</p>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleImageClick}
                  disabled={uploadingImage}
                  className="mt-2 flex items-center gap-2 text-sm text-primary-100 hover:text-white transition-colors disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {uploadingImage ? 'Uploading...' : 'Change Photo'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="p-6 border-b border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Clients</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalClients}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Earnings</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalEarnings)}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Services Rendered</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalAppointments}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* First Name */}
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  First Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100"
                    placeholder="John"
                  />
                </div>
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100"
                    placeholder="Doe"
                  />
                </div>
              </div>

              {/* Middle Name */}
              <div>
                <label htmlFor="middleName" className="block text-sm font-medium text-gray-700 mb-2">
                  Middle Name <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    id="middleName"
                    name="middleName"
                    value={formData.middleName}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100"
                    placeholder="Michael"
                  />
                </div>
              </div>

              {/* Email (Read Only) */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    id="email"
                    value={userData?.email || currentUser?.email}
                    disabled
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Email address cannot be changed</p>
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100"
                    placeholder="+63 912 345 6789"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Branch */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <Building2 className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Branch</p>
                  <p className="text-sm text-gray-900 mt-1">{branchName}</p>
                </div>
              </div>

              {/* Services */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <Scissors className="w-5 h-5 text-gray-400 mt-1" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">Services</p>
                  {loadingServices ? (
                    <p className="text-sm text-gray-500 mt-1">Loading...</p>
                  ) : services.length > 0 ? (
                    <p className="text-sm text-gray-900 mt-1">{services.join(', ')}</p>
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">No services assigned</p>
                  )}
                </div>
              </div>

              {/* Account Created */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Member Since</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {userData?.createdAt ? formatDate(userData.createdAt) : 'Recently'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <LoadingSpinner size="sm" />}
                Save Changes
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Security Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>Security Note:</strong> To change your password, please contact your branch manager or use the password reset option on the login page.
        </p>
      </div>
    </div>
  );
};

export default StylistProfile;

