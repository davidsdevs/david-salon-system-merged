/**
 * Branch Settings Page
 * For Branch Managers to manage their branch details
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock, Save, ArrowLeft, Activity, Search, Filter, RefreshCw } from 'lucide-react';
import { getBranchById, updateBranch } from '../../services/branchService';
import { getActivityLogs } from '../../services/activityService';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const BranchSettings = () => {
  const { currentUser, userBranch } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branch, setBranch] = useState(null);
  const [formData, setFormData] = useState({
    address: '',
    contact: '',
    email: '',
    operatingHours: {
      monday: { open: '09:00', close: '18:00', isOpen: true },
      tuesday: { open: '09:00', close: '18:00', isOpen: true },
      wednesday: { open: '09:00', close: '18:00', isOpen: true },
      thursday: { open: '09:00', close: '18:00', isOpen: true },
      friday: { open: '09:00', close: '18:00', isOpen: true },
      saturday: { open: '09:00', close: '18:00', isOpen: true },
      sunday: { open: '09:00', close: '18:00', isOpen: false }
    }
  });

  // Activity logs state
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  useEffect(() => {
    if (userBranch) {
      fetchBranch();
      fetchActivityLogs();
    } else {
      setLoading(false);
    }
  }, [userBranch]);

  const fetchBranch = async () => {
    try {
      setLoading(true);
      const data = await getBranchById(userBranch);
      setBranch(data);
      setFormData({
        address: data.address || '',
        contact: data.contact || '',
        email: data.email || '',
        operatingHours: data.operatingHours || formData.operatingHours
      });
    } catch (error) {
      // Silently handle error, UI will show "No branch assigned" message
      setBranch(null);
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

  const handleHoursChange = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      operatingHours: {
        ...prev.operatingHours,
        [day]: {
          ...prev.operatingHours[day],
          [field]: value
        }
      }
    }));
  };

  const handleDayToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      operatingHours: {
        ...prev.operatingHours,
        [day]: {
          ...prev.operatingHours[day],
          isOpen: !prev.operatingHours[day].isOpen
        }
      }
    }));
  };

  const fetchActivityLogs = async () => {
    if (!userBranch) {
      console.warn('No branch assigned to user');
      setActivityLogs([]);
      return;
    }
    
    try {
      setLoadingLogs(true);
      console.log('Fetching activity logs for branch:', userBranch);
      
      const logs = await getActivityLogs({
        branchId: userBranch,
        limit: 200
      });
      
      console.log('Fetched activity logs:', logs.length);
      console.log('Sample log:', logs[0]);
      
      // Verify branchId matches
      if (logs.length > 0) {
        const sampleBranchId = logs[0]?.branchId;
        console.log('Sample log branchId:', sampleBranchId, 'Expected:', userBranch, 'Match:', sampleBranchId === userBranch);
      }
      
      setActivityLogs(logs);
      
      if (logs.length === 0) {
        console.log('No activity logs found for branch:', userBranch);
        // Try fetching all logs to see if there are any at all
        try {
          const allLogs = await getActivityLogs({ limit: 5 });
          console.log('Total logs in database (sample):', allLogs.length);
          if (allLogs.length > 0) {
            console.log('Sample log from all logs:', allLogs[0]);
            console.log('Sample log branchId:', allLogs[0]?.branchId);
          }
        } catch (err) {
          console.error('Error fetching sample logs:', err);
        }
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      
      // Check if it's an index error
      if (error.message?.includes('index') || error.code === 'failed-precondition') {
        toast.error('Firestore index required. Please check console for index creation link.');
      } else {
        toast.error('Failed to load activity logs: ' + error.message);
      }
      setActivityLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.address || !formData.contact) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      await updateBranch(userBranch, formData, currentUser);
      await fetchBranch();
      toast.success('Branch settings updated successfully');
    } catch (error) {
      console.error('Error updating branch:', error);
      toast.error('Failed to update branch settings');
    } finally {
      setSaving(false);
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Get action label
  const getActionLabel = (action) => {
    const actionLabels = {
      user_created: 'Created User',
      user_updated: 'Updated User',
      user_activated: 'Activated User',
      user_deactivated: 'Deactivated User',
      user_login: 'Logged In',
      user_logout: 'Logged Out',
      password_reset: 'Password Reset',
      profile_updated: 'Updated Profile',
      role_changed: 'Changed Role',
      branch_assigned: 'Assigned to Branch',
      service_created: 'Created Service',
      service_updated: 'Updated Service',
      service_toggled: 'Toggled Service',
      product_created: 'Created Product',
      product_updated: 'Updated Product',
      stock_adjusted: 'Adjusted Stock',
      stock_transferred: 'Transferred Stock',
      bill_created: 'Created Bill',
      appointment_created: 'Created Appointment',
      appointment_updated: 'Updated Appointment',
      appointment_cancelled: 'Cancelled Appointment'
    };
    return actionLabels[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Filter activity logs
  const filteredLogs = activityLogs.filter(log => {
    const matchesSearch = 
      !searchTerm ||
      log.performedByName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details?.entityName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    
    return matchesSearch && matchesAction;
  });

  // Get unique actions for filter
  const uniqueActions = ['all', ...new Set(activityLogs.map(log => log.action).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No branch assigned to your account</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/manager/settings')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branch Settings</h1>
          <p className="text-gray-600 mt-1">Manage your branch information and operating hours</p>
        </div>
      </div>

      {/* Branch Info Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Branch Information (Read-Only) */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Branch Information
            </h3>
            <div className="space-y-4">
              {/* Branch Name - Read Only */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={branch.name || branch.branchName}
                  readOnly
                  disabled
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed"
                />
              </div>

              {/* Status - Read Only */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <input
                  type="text"
                  value={branch.isActive === true ? 'Active' : 'Inactive'}
                  readOnly
                  disabled
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Contact Information
            </h3>
            <div className="space-y-4">
              {/* Address */}
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-2" />
                  Address *
                </label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  rows="2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Complete branch address"
                />
              </div>

              {/* Contact Number */}
              <div>
                <label htmlFor="contact" className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-2" />
                  Contact Number *
                </label>
                <input
                  type="tel"
                  id="contact"
                  name="contact"
                  value={formData.contact}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="+63 912 345 6789"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="branch@davidsalon.com"
                />
              </div>
            </div>
          </div>

          {/* Operating Hours Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              <Clock className="w-4 h-4 inline mr-2" />
              Operating Hours
            </h3>
            <div className="space-y-3">
              {days.map(day => (
                <div key={day} className="flex items-center gap-4">
                  <div className="w-28">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.operatingHours[day].isOpen}
                        onChange={() => handleDayToggle(day)}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {day}
                      </span>
                    </label>
                  </div>
                  
                  {formData.operatingHours[day].isOpen ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={formData.operatingHours[day].open}
                        onChange={(e) => handleHoursChange(day, 'open', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="time"
                        value={formData.operatingHours[day].close}
                        onChange={(e) => handleHoursChange(day, 'close', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500 italic">Closed</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Info Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Changes to operating hours will affect appointment availability.
              System Admin will be notified of any changes.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <LoadingSpinner size="sm" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Activity Logs Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Activity Logs</h2>
              <p className="text-sm text-gray-600 mt-1">
                View all activities performed in your branch
                {userBranch && (
                  <span className="text-xs text-gray-500 ml-2">(Branch ID: {userBranch})</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={fetchActivityLogs}
            disabled={loadingLogs || !userBranch}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loadingLogs ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {!userBranch && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> No branch is assigned to your account. Activity logs require a branch assignment.
            </p>
          </div>
        )}

        {userBranch && activityLogs.length === 0 && !loadingLogs && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Info:</strong> No activity logs found for your branch. This could mean:
            </p>
            <ul className="text-sm text-blue-700 mt-2 ml-4 list-disc">
              <li>No activities have been performed in your branch yet</li>
              <li>Older activity logs may not have branch information (logs created before branch tracking was implemented)</li>
              <li>New activities will automatically include branch information</li>
            </ul>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by user, action, or entity..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="sm:w-64">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              >
                {uniqueActions.map(action => (
                  <option key={action} value={action}>
                    {action === 'all' ? 'All Actions' : getActionLabel(action)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Activity Logs Table */}
        {loadingLogs ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 font-medium mb-2">No activity logs found</p>
            <p className="text-sm text-gray-400">
              {searchTerm || actionFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Activity logs will appear here as actions are performed in your branch'}
            </p>
            {!userBranch && (
              <p className="text-xs text-red-500 mt-2">Note: No branch assigned to your account</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {log.performedByName || 'Unknown User'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {getActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {log.details?.entityName && (
                        <div>
                          <span className="font-medium">{log.details.entityName}</span>
                          {log.details.module && (
                            <span className="text-gray-500 ml-2">({log.details.module})</span>
                          )}
                        </div>
                      )}
                      {log.targetUserName && (
                        <div className="text-xs text-gray-500 mt-1">
                          Target: {log.targetUserName}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredLogs.length > 0 && (
          <div className="mt-4 text-sm text-gray-500 text-center">
            Showing {filteredLogs.length} of {activityLogs.length} activity logs
          </div>
        )}
      </div>
    </div>
  );
};

export default BranchSettings;
