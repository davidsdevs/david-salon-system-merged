/**
 * Client Profile Page
 * Module: M06 - CRM
 * Allows clients to view their profile, loyalty points, service history, and referral code
 */

import { useState, useEffect, useRef } from 'react';
import { Star, Gift, History, Share2, Copy, Check, User, Mail, Phone, Calendar, Edit2, Camera, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getClientProfile, getServiceHistory } from '../../services/clientService';
import { getLoyaltyPoints, getLoyaltyHistory, getAllBranchLoyaltyPoints } from '../../services/loyaltyService';
import { getAllReferralCodes } from '../../services/referralService';
import { getBranchById } from '../../services/branchService';
import { updateUserProfile } from '../../services/userService';
import { uploadToCloudinary, validateImageFile } from '../../services/imageService';
import { formatDate, getFullName, getInitials } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const ClientProfile = () => {
  const { currentUser, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [branchLoyaltyPoints, setBranchLoyaltyPoints] = useState([]); // Array of { branchId, branchName, loyaltyPoints }
  const [serviceHistory, setServiceHistory] = useState([]);
  const [loyaltyHistory, setLoyaltyHistory] = useState([]);
  const [referralCodes, setReferralCodes] = useState([]); // Array of { branchId, branchName, referralCode }
  const [copiedCode, setCopiedCode] = useState(null); // Track which code was copied
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
    if (currentUser) {
      fetchProfile();
    }
  }, [currentUser]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      
      // Fetch CRM profile
      const clientProfile = await getClientProfile(currentUser.uid);
      setProfile(clientProfile);
      
      // Fetch loyalty points - branch-specific
      const allBranchPoints = await getAllBranchLoyaltyPoints(currentUser.uid);
      const totalPoints = allBranchPoints.reduce((sum, bp) => sum + (bp.loyaltyPoints || 0), 0);
      setLoyaltyPoints(totalPoints);
      
      // Fetch branch names for each branch points entry
      const branchPointsWithNames = await Promise.all(
        allBranchPoints.map(async (bp) => {
          try {
            const branch = await getBranchById(bp.branchId);
            return {
              ...bp,
              branchName: branch?.name || branch?.branchName || `Branch ${bp.branchId.slice(0, 8)}`
            };
          } catch (error) {
            console.error(`Error fetching branch ${bp.branchId}:`, error);
            return {
              ...bp,
              branchName: `Branch ${bp.branchId.slice(0, 8)}`
            };
          }
        })
      );
      setBranchLoyaltyPoints(branchPointsWithNames);
      
      // Fetch referral codes (branch-specific)
      const codes = await getAllReferralCodes(currentUser.uid);
      // Fetch branch names for each referral code
      const codesWithNames = await Promise.all(
        codes.map(async (codeData) => {
          try {
            const branch = await getBranchById(codeData.branchId);
            return {
              ...codeData,
              branchName: branch?.name || branch?.branchName || `Branch ${codeData.branchId.slice(0, 8)}`
            };
          } catch (error) {
            console.error(`Error fetching branch ${codeData.branchId}:`, error);
            return {
              ...codeData,
              branchName: `Branch ${codeData.branchId.slice(0, 8)}`
            };
          }
        })
      );
      setReferralCodes(codesWithNames);
      
      // Fetch service history
      const history = await getServiceHistory(currentUser.uid, 20);
      setServiceHistory(history);
      
      // Fetch loyalty history
      const loyalty = await getLoyaltyHistory(currentUser.uid, 20);
      setLoyaltyHistory(loyalty);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
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

  const handleCopyReferralCode = (code, branchName) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Referral code for ${branchName} copied!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Get membership level
  const membershipStat = userData?.membershipStat || userData?.membershipLevel || 'bronze';
  const membershipLevel = membershipStat.charAt(0).toUpperCase() + membershipStat.slice(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600 mt-1">View your loyalty points, service history, and more</p>
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

      {/* Profile Header Card */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
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
              <p className="text-primary-100 mt-1">{membershipLevel} Member</p>
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

        {/* Stats Row */}
        <div className="p-6 border-b border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Appointments</p>
                  <p className="text-2xl font-bold text-gray-900">{profile?.visitCount || 0}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Loyalty Points</p>
                  <p className="text-2xl font-bold text-gray-900">{loyaltyPoints}</p>
                </div>
                <div className="p-3 bg-primary-100 rounded-full">
                  <Star className="w-6 h-6 text-primary-600 fill-primary-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        {isEditing && (
          <form onSubmit={handleSubmit} className="p-6 space-y-6 border-b border-gray-100">
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
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="+63 912 345 6789"
                  />
                </div>
              </div>

              {/* Member Since */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Member Since
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={userData?.createdAt ? formatDate(userData.createdAt) : 'Recently'}
                    disabled
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
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
          </form>
        )}
      </div>

      {/* Loyalty Points Card */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Loyalty Points</h2>
              <div className="flex items-center gap-2">
                <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
                <span className="text-4xl font-bold text-[#2D1B4E]">{loyaltyPoints}</span>
                <span className="text-sm text-gray-500">(Total)</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                1 point = ₱1 discount. Points are branch-specific and can only be used at the branch where they were earned.
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Total Visits</div>
              <div className="text-2xl font-bold text-gray-900">{profile?.visitCount || 0}</div>
              <div className="text-sm text-gray-500 mt-2">Total Spent</div>
              <div className="text-lg font-semibold text-gray-900">
                ₱{profile?.totalSpent?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>
          
          {/* Branch-Specific Points Breakdown */}
          {branchLoyaltyPoints.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Points by Branch</h3>
              <div className="space-y-2">
                {branchLoyaltyPoints.map((bp) => (
                  <div key={bp.branchId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{bp.branchName}</div>
                      <div className="text-xs text-gray-500">Branch-specific points</div>
                    </div>
                    <div className="text-lg font-semibold text-[#2D1B4E]">
                      {bp.loyaltyPoints || 0} pts
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Referral Codes Card */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Referral Program</h2>
              <p className="text-sm text-gray-600">
                Share your referral code with friends and earn rewards when they sign up at the same branch!
                <br />
                <span className="text-xs text-gray-500">You can only refer people to branches you've visited.</span>
              </p>
            </div>
            <Gift className="h-16 w-16 text-[#2D1B4E] opacity-20" />
          </div>
          
          {referralCodes.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-500 mb-2">No referral codes available yet</p>
              <p className="text-xs text-gray-400">
                Visit a branch and make a purchase to generate your referral code for that branch.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {referralCodes.map((codeData) => (
                <div key={codeData.branchId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{codeData.branchName}</div>
                    <div className="text-xs text-gray-500 mt-1">Branch-specific referral code</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-2 bg-white border border-gray-300 rounded-lg font-mono text-sm font-semibold">
                      {codeData.referralCode}
                    </div>
                    <button
                      onClick={() => handleCopyReferralCode(codeData.referralCode, codeData.branchName)}
                      className="px-3 py-2 bg-[#2D1B4E] text-white rounded-lg hover:bg-[#3d2a5f] transition-colors flex items-center gap-2"
                    >
                      {copiedCode === codeData.referralCode ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Service History */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Service History</h2>
          </div>
          <div className="space-y-3">
            {serviceHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No service history yet</p>
            ) : (
              serviceHistory.map((entry) => (
                <div key={entry.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{entry.serviceName}</div>
                    <div className="text-sm text-gray-500">
                      {entry.date?.toLocaleDateString()} • {entry.branchName} • {entry.stylistName}
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    ₱{entry.price?.toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Loyalty Points History */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Loyalty Points History</h2>
          </div>
          <div className="space-y-3">
            {loyaltyHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No loyalty points history yet</p>
            ) : (
              loyaltyHistory.map((entry) => (
                <div key={entry.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{entry.description}</div>
                    <div className="text-sm text-gray-500">
                      {entry.createdAt?.toLocaleDateString()}
                    </div>
                  </div>
                  <div className={`text-lg font-semibold ${entry.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {entry.points > 0 ? '+' : ''}{entry.points} pts
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientProfile;

