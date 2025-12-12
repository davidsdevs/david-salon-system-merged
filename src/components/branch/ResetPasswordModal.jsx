/**
 * Reset Password Modal Component
 * Allows resetting passwords per role with default formatted passwords
 */

import { useState } from 'react';
import { X, Key, Copy, Check } from 'lucide-react';
import { setRolePassword } from '../../services/rolePasswordService';
import { getUserRoles } from '../../utils/helpers';
import { ROLE_LABELS } from '../../utils/constants';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';

const ResetPasswordModal = ({ staff, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [resettingRole, setResettingRole] = useState(null);
  const [resetPasswords, setResetPasswords] = useState({});
  const [copiedRole, setCopiedRole] = useState(null);

  // Get all roles for this staff member
  const staffRoles = getUserRoles(staff);

  /**
   * Generate a default formatted password
   * Format: RoleName123! (e.g., Stylist123!, Receptionist123!)
   */
  const generateDefaultPassword = (role) => {
    const roleLabel = ROLE_LABELS[role] || role;
    // Remove spaces and special characters, capitalize first letter
    const rolePart = roleLabel.replace(/[^a-zA-Z0-9]/g, '').charAt(0).toUpperCase() + 
                     roleLabel.replace(/[^a-zA-Z0-9]/g, '').slice(1).toLowerCase();
    return `${rolePart}123!`;
  };

  const handleResetRolePassword = async (role) => {
    if (!staff?.id) {
      toast.error('Staff member not found');
      return;
    }

    setResettingRole(role);
    setLoading(true);

    try {
      const defaultPassword = generateDefaultPassword(role);
      
      // Reset password for this role
      await setRolePassword(staff.id, role, defaultPassword);
      
      // Store the password to display
      setResetPasswords(prev => ({
        ...prev,
        [role]: defaultPassword
      }));
      
      toast.success(`${ROLE_LABELS[role]} password reset successfully!`);
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error(`Failed to reset ${ROLE_LABELS[role]} password`);
    } finally {
      setResettingRole(null);
      setLoading(false);
    }
  };

  const handleResetAllPasswords = async () => {
    if (!staff?.id) {
      toast.error('Staff member not found');
      return;
    }

    setLoading(true);

    try {
      const newPasswords = {};
      
      // Reset password for each role
      for (const role of staffRoles) {
        const defaultPassword = generateDefaultPassword(role);
        await setRolePassword(staff.id, role, defaultPassword);
        newPasswords[role] = defaultPassword;
      }
      
      setResetPasswords(newPasswords);
      toast.success('All passwords reset successfully!');
    } catch (error) {
      console.error('Error resetting passwords:', error);
      toast.error('Failed to reset some passwords');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPassword = (role, password) => {
    navigator.clipboard.writeText(password);
    setCopiedRole(role);
    toast.success('Password copied to clipboard!');
    setTimeout(() => setCopiedRole(null), 2000);
  };

  const handleClose = () => {
    if (Object.keys(resetPasswords).length > 0 && onSuccess) {
      onSuccess();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Key className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Reset Password</h2>
              <p className="text-sm text-gray-500">
                {staff?.firstName} {staff?.lastName}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Passwords will be reset to default formatted passwords. 
              Each role will have its own password. Share these passwords securely with the staff member.
            </p>
          </div>

          {/* Reset All Button */}
          <div className="flex justify-end">
            <button
              onClick={handleResetAllPasswords}
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && !resettingRole && <LoadingSpinner size="sm" />}
              Reset All Passwords
            </button>
          </div>

          {/* Role Password List */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Role Passwords</h3>
            
            {staffRoles.length === 0 ? (
              <p className="text-sm text-gray-500">No roles assigned to this staff member.</p>
            ) : (
              staffRoles.map(role => {
                const password = resetPasswords[role];
                const isResetting = resettingRole === role;
                const isCopied = copiedRole === role;
                
                return (
                  <div
                    key={role}
                    className="border border-gray-200 rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {ROLE_LABELS[role]}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Default format: {generateDefaultPassword(role)}
                        </p>
                      </div>
                      {!password && (
                        <button
                          onClick={() => handleResetRolePassword(role)}
                          disabled={loading}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
                        >
                          {isResetting ? (
                            <>
                              <LoadingSpinner size="sm" />
                              Resetting...
                            </>
                          ) : (
                            <>
                              <Key className="w-4 h-4" />
                              Reset Password
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {password && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <label className="text-xs font-semibold text-green-800 block mb-1">
                              New Password:
                            </label>
                            <code className="text-sm font-mono bg-white px-3 py-2 rounded border border-green-300 text-green-900 block select-all">
                              {password}
                            </code>
                          </div>
                          <button
                            onClick={() => handleCopyPassword(role, password)}
                            className="p-2 bg-white border border-green-300 rounded-lg hover:bg-green-50 transition-colors flex-shrink-0"
                            title="Copy password"
                          >
                            {isCopied ? (
                              <Check className="w-5 h-5 text-green-600" />
                            ) : (
                              <Copy className="w-5 h-5 text-green-600" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-green-700 mt-2">
                          ✓ Password has been reset. Share this with the staff member.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {Object.keys(resetPasswords).length > 0 ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordModal;

