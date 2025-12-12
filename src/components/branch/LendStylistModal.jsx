/**
 * Request Help Modal
 * Allows branch manager to request help (a stylist) from another branch
 */

import { useState, useEffect } from 'react';
import { X, Send, Calendar, Building2, User } from 'lucide-react';
import { getAllBranches } from '../../services/branchService';
import { getUsersByBranch } from '../../services/userService';
import { requestLendStylist } from '../../services/stylistLendingService';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES } from '../../utils/constants';
import { getFullName } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';

const LendStylistModal = ({
  isOpen,
  stylist,
  requestingBranchId, // Branch that needs help (current branch)
  onClose,
  onSave
}) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingStylists, setLoadingStylists] = useState(false);
  const [branches, setBranches] = useState([]);
  const [stylists, setStylists] = useState([]);
  const [formData, setFormData] = useState({
    fromBranchId: '', // Branch that will provide help
    stylistId: '', // Selected stylist or 'any' for any available
    startDate: '',
    endDate: '',
    reason: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchBranches();
      // Set default dates (today and 7 days from now)
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      
      setFormData({
        fromBranchId: '', // Branch to request help from
        stylistId: '', // No default - user must select
        startDate: today.toISOString().split('T')[0],
        endDate: nextWeek.toISOString().split('T')[0],
        reason: ''
      });
      setStylists([]);
    }
  }, [isOpen]);

  // Fetch stylists when branch is selected
  useEffect(() => {
    if (formData.fromBranchId) {
      fetchStylists(formData.fromBranchId);
    } else {
      setStylists([]);
      setFormData(prev => ({ ...prev, stylistId: '' }));
    }
  }, [formData.fromBranchId]);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      if (!requestingBranchId) {
        toast.error('Branch information not available');
        return;
      }
      const allBranches = await getAllBranches();
      // Filter out the current branch (requesting branch)
      const otherBranches = allBranches.filter(b => b.id !== requestingBranchId);
      setBranches(otherBranches);
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast.error('Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const fetchStylists = async (branchId) => {
    try {
      setLoadingStylists(true);
      const branchUsers = await getUsersByBranch(branchId);
      // Filter to only stylists
      const branchStylists = branchUsers.filter(user => {
        const userRoles = user.roles || (user.role ? [user.role] : []);
        return userRoles.includes(USER_ROLES.STYLIST) && user.isActive !== false;
      });
      setStylists(branchStylists);
      
      // Reset stylist selection if previously selected stylist is not in the new list
      if (formData.stylistId) {
        const stylistExists = branchStylists.some(s => (s.id || s.uid) === formData.stylistId);
        if (!stylistExists) {
          setFormData(prev => ({ ...prev, stylistId: '' }));
        }
      }
    } catch (error) {
      console.error('Error fetching stylists:', error);
      toast.error('Failed to load stylists');
      setStylists([]);
    } finally {
      setLoadingStylists(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!requestingBranchId) {
      toast.error('Branch information not available');
      return;
    }
    
    if (!formData.fromBranchId) {
      toast.error('Please select a branch to request help from');
      return;
    }

    if (!formData.stylistId) {
      toast.error('Please select a stylist to borrow');
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      toast.error('Please select start and end dates');
      return;
    }

    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);

    if (endDate < startDate) {
      toast.error('End date must be after start date');
      return;
    }

    if (startDate < new Date()) {
      toast.error('Start date cannot be in the past');
      return;
    }

    try {
      setSaving(true);
      // Request help: fromBranchId = branch providing help, toBranchId = requesting branch (current)
      // stylistId: selected stylist ID (required)
      await requestLendStylist(
        formData.stylistId, // Selected stylist ID (required)
        formData.fromBranchId, // Branch that will provide the stylist
        requestingBranchId, // Current branch that needs help
        formData.startDate,
        formData.endDate,
        formData.reason,
        currentUser
      );
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Error requesting stylist lending:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const selectedBranch = branches.find(b => b.id === formData.fromBranchId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Request Help From Another Branch
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Request a stylist from another branch to help at your branch
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={saving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              {/* Request Info */}
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>You are requesting help for your branch.</strong> Select a branch that can provide a stylist to help you.
                </p>
              </div>

              {/* Branch to Request Help From */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Building2 className="inline w-4 h-4 mr-1" />
                  Request Help From Branch *
                </label>
                <select
                  value={formData.fromBranchId}
                  onChange={(e) => setFormData({ ...formData, fromBranchId: e.target.value, stylistId: '' })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select a branch to request help from...</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.branchName || branch.name} - {branch.address || branch.city || ''}
                    </option>
                  ))}
                </select>
                {selectedBranch && (
                  <p className="text-sm text-gray-600 mt-2">
                    {selectedBranch.address && `${selectedBranch.address}, `}
                    {selectedBranch.city}
                  </p>
                )}
              </div>

              {/* Stylist Selection */}
              {formData.fromBranchId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="inline w-4 h-4 mr-1" />
                    Select Stylist *
                  </label>
                  {loadingStylists ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <LoadingSpinner size="sm" />
                      Loading stylists...
                    </div>
                  ) : stylists.length > 0 ? (
                    <select
                      value={formData.stylistId}
                      onChange={(e) => setFormData({ ...formData, stylistId: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">-- Select a stylist --</option>
                      {stylists.map(stylist => {
                        const stylistId = stylist.id || stylist.uid;
                        return (
                          <option key={stylistId} value={stylistId}>
                            {getFullName(stylist)} {stylist.email ? `(${stylist.email})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <div className="w-full px-4 py-2 border border-red-300 rounded-lg bg-red-50">
                      <p className="text-sm text-red-700">No stylists available in this branch</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Select the specific stylist you want to borrow from this branch.
                  </p>
                </div>
              )}

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="inline w-4 h-4 mr-1" />
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="inline w-4 h-4 mr-1" />
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                    min={formData.startDate || new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason (Optional)
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., Temporary coverage for peak season, special event support..."
                />
              </div>

              {/* Info Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This will send a request to the selected branch manager. 
                  They will receive your request and can approve to send one of their stylists to help at your branch.
                </p>
              </div>
            </>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {saving ? 'Sending Request...' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LendStylistModal;

