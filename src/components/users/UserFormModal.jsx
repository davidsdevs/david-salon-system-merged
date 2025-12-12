/**
 * User Form Modal Component
 * For creating and editing users
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { createUser, updateUser } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES, ROLE_LABELS } from '../../utils/constants';
import { getUserRoles, canHaveMultipleRoles } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';

const UserFormModal = ({ user, branches = [], onClose, onSave }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    roles: [USER_ROLES.CLIENT], // Changed to array
    branchId: '',
    rolePasswords: {} // Object to store password for each role: { role: password }
  });

  useEffect(() => {
    if (user) {
      // Get roles as array (handles both new and legacy format)
      const userRoles = getUserRoles(user);
      
      setFormData({
        firstName: user.firstName || '',
        middleName: user.middleName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        roles: userRoles.length > 0 ? userRoles : [USER_ROLES.CLIENT],
        branchId: user.branchId || '',
        rolePasswords: {} // Never pre-fill passwords
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle role checkbox changes
  const handleRoleToggle = (role) => {
    setFormData(prev => {
      const currentRoles = prev.roles || [];
      const rolePasswords = prev.rolePasswords || {};
      
      // Client role is exclusive (cannot have multiple roles)
      if (role === USER_ROLES.CLIENT) {
        const newRolePasswords = {};
        newRolePasswords[USER_ROLES.CLIENT] = rolePasswords[USER_ROLES.CLIENT] || '';
        return { ...prev, roles: [USER_ROLES.CLIENT], rolePasswords: newRolePasswords };
      }
      
      // If toggling on a non-client role, remove client role
      if (currentRoles.includes(USER_ROLES.CLIENT)) {
        const newRolePasswords = {};
        newRolePasswords[role] = rolePasswords[role] || '';
        return { ...prev, roles: [role], rolePasswords: newRolePasswords };
      }
      
      // Toggle the role
      if (currentRoles.includes(role)) {
        // Don't allow removing all roles
        if (currentRoles.length === 1) {
          toast.error('User must have at least one role');
          return prev;
        }
        // Remove role and its password
        const newRolePasswords = { ...rolePasswords };
        delete newRolePasswords[role];
        return { 
          ...prev, 
          roles: currentRoles.filter(r => r !== role),
          rolePasswords: newRolePasswords
        };
      } else {
        return { ...prev, roles: [...currentRoles, role] };
      }
    });
  };

  // Handle password change for a specific role
  const handleRolePasswordChange = (role, password) => {
    setFormData(prev => ({
      ...prev,
      rolePasswords: {
        ...prev.rolePasswords,
        [role]: password
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate passwords if provided
    if (!user) {
      for (const role of formData.roles) {
        const password = formData.rolePasswords?.[role];
        if (password && password.length > 0) {
          if (password.length < 8) {
            toast.error(`${ROLE_LABELS[role]} password must be at least 8 characters`);
            return;
          }
          if (!/\d/.test(password)) {
            toast.error(`${ROLE_LABELS[role]} password must contain at least one number`);
            return;
          }
          if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            toast.error(`${ROLE_LABELS[role]} password must contain at least one special character`);
            return;
          }
        }
      }
    }
    
    setLoading(true);

    try {
      if (user) {
        // Update existing user
        await updateUser(user.id, formData, currentUser);
      } else {
        // Create new user with rolePasswords
        const userData = {
          ...formData,
          rolePasswords: formData.rolePasswords || {}
        };
        await createUser(userData, currentUser);
      }
      onSave();
    } catch (error) {
      // Error handled in service
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {user ? 'Edit User' : 'Add New User'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Personal Information Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* First Name */}
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="John"
                />
              </div>

              {/* Middle Name */}
              <div>
                <label htmlFor="middleName" className="block text-sm font-medium text-gray-700 mb-2">
                  Middle Name <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  id="middleName"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Michael"
                />
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Doe"
                />
              </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={!!user} // Can't change email for existing users
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100"
                  placeholder="john@example.com"
                />
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="+63 912 345 6789"
                />
              </div>
            </div>
          </div>

          {/* Role & Access Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Role & Access
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Roles - Multiple Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role(s) * <span className="text-xs text-gray-500">(Client role is exclusive)</span>
                </label>
                <div className="space-y-2 p-4 border border-gray-300 rounded-lg bg-gray-50 max-h-64 overflow-y-auto">
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer hover:bg-white p-2 rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.roles?.includes(key) || false}
                        onChange={() => handleRoleToggle(key)}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700 flex-1">{label}</span>
                      {key === USER_ROLES.CLIENT && (
                        <span className="text-xs text-gray-500">(Single role only)</span>
                      )}
                    </label>
                  ))}
                </div>
                {formData.roles && formData.roles.length > 0 && (
                  <p className="text-xs text-green-600 mt-2 font-medium">
                    ✓ Selected: {formData.roles.map(r => ROLE_LABELS[r]).join(', ')}
                  </p>
                )}
              </div>

              {/* Branch Assignment */}
              <div>
                <label htmlFor="branchId" className="block text-sm font-medium text-gray-700 mb-2">
                  Branch Assignment
                </label>
                <select
                  id="branchId"
                  name="branchId"
                  value={formData.branchId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                >
                  <option value="">No Branch Assigned</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name || branch.branchName}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty for System Admin/Operational Manager. Required for Branch Manager, Receptionist, and Stylist.
                </p>
              </div>
            </div>
          </div>

          {/* Security Section (only for new users) */}
          {!user && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                Security - Temporary Passwords
              </h3>
              <p className="text-xs text-gray-600 mb-4">
                Set a temporary password for each role. Leave empty to use default password (DefaultPass123!)
              </p>
              <div className="space-y-3">
                {formData.roles.map(role => (
                  <div key={role}>
                    <label htmlFor={`password-${role}`} className="block text-sm font-medium text-gray-700 mb-2">
                      {ROLE_LABELS[role]} Password
                    </label>
                    <input
                      type="password"
                      id={`password-${role}`}
                      value={formData.rolePasswords?.[role] || ''}
                      onChange={(e) => handleRolePasswordChange(role, e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder={`Min 8 characters (default: DefaultPass123!)`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mx-6">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> {user ? 'User will be notified of profile updates via email.' : 'User will receive a verification email after account creation.'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
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
              {user ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserFormModal;
