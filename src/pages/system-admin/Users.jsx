/**
 * Users Management Page - System Admin
 * Module: M01 - User & Role Management
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Users as UsersIcon, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Power,
  Eye,
  Key,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X
} from 'lucide-react';
import { getAllUsers, toggleUserStatus } from '../../services/userService';
import { getAllBranches } from '../../services/branchService';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES, ROLE_LABELS } from '../../utils/constants';
import { formatDate, getFullName, getInitials, getUserRoles, generateDefaultPassword, generateDefaultPasswordForUser } from '../../utils/helpers';
import { setRolePassword } from '../../services/rolePasswordService';
import { sendPasswordResetEmail } from '../../services/emailService';
import UserFormModal from '../../components/users/UserFormModal';
import UserDetailsModal from '../../components/users/UserDetailsModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import RoleBadges from '../../components/ui/RoleBadges';
import toast from 'react-hot-toast';

const UsersManagement = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showUserForm, setShowUserForm] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetUserInfo, setResetUserInfo] = useState(null);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [passwordResetData, setPasswordResetData] = useState({
    user: null,
    rolePasswords: {},
    manualPasswords: {}
  });
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [pendingResetAction, setPendingResetAction] = useState(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Fetch users and branches
  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  // Apply filters
  useEffect(() => {
    applyFilters();
    setCurrentPage(1); // Reset to first page when filters change
  }, [users, searchTerm, roleFilter, statusFilter]);

  const fetchBranches = async () => {
    try {
      const fetchedBranches = await getAllBranches();
      setBranches(fetchedBranches);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const fetchedUsers = await getAllUsers();
      setUsers(fetchedUsers);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...users];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user => {
        const fullName = getFullName(user).toLowerCase();
        const email = user.email?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        return fullName.includes(search) || email.includes(search);
      });
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => {
        // Check if user has the role in their roles array
        const userRoles = user.roles || (user.role ? [user.role] : []);
        return userRoles.includes(roleFilter);
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => 
        user.isActive === (statusFilter === 'active')
      );
    }

    // Sort: Staff first, then clients
    filtered.sort((a, b) => {
      const aIsClient = (a.role === USER_ROLES.CLIENT) || (a.roles?.includes(USER_ROLES.CLIENT));
      const bIsClient = (b.role === USER_ROLES.CLIENT) || (b.roles?.includes(USER_ROLES.CLIENT));
      
      // Staff first (non-clients)
      if (aIsClient && !bIsClient) return 1;
      if (!aIsClient && bIsClient) return -1;
      
      // If both same type, sort by name
      return getFullName(a).localeCompare(getFullName(b));
    });

    setFilteredUsers(filtered);
  };

  // Pagination calculations (memoized for performance)
  const paginationData = useMemo(() => {
    const totalItems = filteredUsers.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
    
    return {
      totalItems,
      totalPages,
      startIndex,
      endIndex,
      paginatedUsers
    };
  }, [filteredUsers, currentPage, itemsPerPage]);

  const { totalItems, totalPages, startIndex, endIndex, paginatedUsers } = paginationData;

  const handleToggleStatus = async (userId, currentStatus) => {
    const user = users.find(u => u.id === userId);
    const action = currentStatus ? 'deactivate' : 'activate';
    const actionText = currentStatus ? 'deactivate' : 'activate';
    
    setConfirmAction(() => async () => {
      try {
        await toggleUserStatus(userId, !currentStatus, currentUser);
        await fetchUsers();
        toast.success(`User ${actionText}d successfully`);
      } catch (error) {
        // Error handled in service
      }
      setShowConfirmDialog(false);
      setConfirmAction(null);
    });
    
    setSelectedUser(user);
    setShowConfirmDialog(true);
  };

  const handleOpenResetPasswordModal = (user) => {
    if (!user?.id) {
      toast.error('User not found');
      return;
    }

    const userRoles = getUserRoles(user);

    if (userRoles.length === 0) {
      toast.error('User has no roles assigned');
      return;
    }

    // Initialize with auto-generated passwords
    const initialPasswords = {};
    userRoles.forEach(role => {
      initialPasswords[role] = generateDefaultPassword(role);
    });

    setPasswordResetData({
      user,
      rolePasswords: initialPasswords,
      manualPasswords: {}
    });
    setShowResetPasswordModal(true);
  };

  const handleResetRolePasswords = async (resetAll = false) => {
    const { user, rolePasswords, manualPasswords } = passwordResetData;

    if (!user?.id) {
      toast.error('User not found');
      return;
    }

    if (!user?.email) {
      toast.error('User email is required to send password reset notification');
      return;
    }

    const userRoles = getUserRoles(user);

    try {
      const finalPasswords = {};
      let primaryPassword = '';

      if (resetAll) {
        // Reset all with auto-generated passwords
        for (const role of userRoles) {
          const rolePassword = generateDefaultPassword(role);
          finalPasswords[role] = rolePassword;
          if (!primaryPassword) {
            primaryPassword = rolePassword;
          }
          await setRolePassword(user.id, role, rolePassword);
        }
      } else {
        // Reset with manual/selected passwords
        for (const role of userRoles) {
          const password = manualPasswords[role] || rolePasswords[role];
          if (!password || password.trim() === '') {
            toast.error(`Password required for ${ROLE_LABELS[role]}`);
            return;
          }

          // Validate password
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

          finalPasswords[role] = password;
          if (!primaryPassword) {
            primaryPassword = password;
          }
          await setRolePassword(user.id, role, password);
        }
      }

      // Close reset modal
      setShowResetPasswordModal(false);

      // Show password in big modal
      setResetPassword(primaryPassword);
      setResetUserInfo({
        name: getFullName(user),
        email: user.email,
        roles: userRoles,
        passwords: finalPasswords
      });
      setShowPasswordModal(true);

      // Send email with all role passwords
      console.log('🔑 [PASSWORD RESET] Preparing to send email...');
      console.log('🔑 [PASSWORD RESET] User email:', user.email);
      console.log('🔑 [PASSWORD RESET] Role passwords:', finalPasswords);
      
      const emailResult = await sendPasswordResetEmail({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        rolePasswords: finalPasswords
      });

      console.log('🔑 [PASSWORD RESET] Email result:', emailResult);

      if (emailResult.success) {
        console.log('✅ [PASSWORD RESET] Email sent successfully!');
        // Success message shown in modal
      } else {
        console.error('❌ [PASSWORD RESET] Email failed:', emailResult.error);
        // Password was reset but email failed
        if (emailResult.error?.includes('not configured')) {
          console.warn('⚠️ [PASSWORD RESET] Brevo API key not configured. Email not sent.');
        } else {
          console.error('❌ [PASSWORD RESET] Email sending error:', emailResult.error);
        }
      }
    } catch (error) {
      console.error('Error resetting role passwords:', error);
      toast.error('Failed to reset role passwords');
      setShowPasswordModal(false);
    }
  };

  const handleUpdateManualPassword = (role, password) => {
    setPasswordResetData(prev => ({
      ...prev,
      manualPasswords: {
        ...prev.manualPasswords,
        [role]: password
      }
    }));
  };

  const handleRegeneratePassword = (role) => {
    const newPassword = generateDefaultPassword(role);
    setPasswordResetData(prev => ({
      ...prev,
      rolePasswords: {
        ...prev.rolePasswords,
        [role]: newPassword
      },
      manualPasswords: {
        ...prev.manualPasswords,
        [role]: newPassword // Also update manual password
      }
    }));
    toast.success(`${ROLE_LABELS[role]} password regenerated`);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setShowUserForm(true);
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setShowUserDetails(true);
  };

  const handleUserSaved = () => {
    setShowUserForm(false);
    setSelectedUser(null);
    fetchUsers();
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
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage system users and their roles</p>
        </div>
        <button
          onClick={() => {
            setSelectedUser(null);
            setShowUserForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add User
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{users.length}</p>
            </div>
            <UsersIcon className="w-8 h-8 text-primary-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {users.filter(u => u.isActive).length}
              </p>
            </div>
            <Power className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inactive Users</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {users.filter(u => !u.isActive).length}
              </p>
            </div>
            <Power className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Staff Members</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {users.filter(u => u.role !== USER_ROLES.CLIENT).length}
              </p>
            </div>
            <UsersIcon className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Role Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none"
            >
              <option value="all">All Roles</option>
              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Branch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {user.photoURL ? (
                          <img 
                            src={user.photoURL} 
                            alt={getFullName(user)}
                            className="flex-shrink-0 w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {getInitials(user)}
                          </div>
                        )}
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {getFullName(user)}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RoleBadges user={user} size="sm" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.branchId ? (() => {
                        const branch = branches.find(b => b.id === user.branchId);
                        return branch ? (branch.name || branch.branchName) : user.branchId;
                      })() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewUser(user)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Edit User"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleOpenResetPasswordModal(user)}
                          className="text-purple-600 hover:text-purple-900"
                          title="Reset Role Passwords"
                        >
                          <Key className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(user.id, user.isActive)}
                          className={user.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}
                          title={user.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <Power className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalItems > 0 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200">
            <div className="flex flex-col space-y-3">
              {/* Top row: Items per page and page info */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Show</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                  <span className="text-xs text-gray-600">per page</span>
                </div>

                <div className="text-xs text-gray-600">
                  Showing <span className="font-semibold text-gray-900">{startIndex + 1}</span> to{' '}
                  <span className="font-semibold text-gray-900">{Math.min(endIndex, totalItems)}</span> of{' '}
                  <span className="font-semibold text-gray-900">{totalItems.toLocaleString()}</span> users
                  {totalItems > 1000 && (
                    <span className="ml-2 text-blue-600 font-medium">
                      (Large dataset - use filters to narrow results)
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom row: Navigation buttons */}
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 min-w-[60px] justify-center"
                  title="First page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 min-w-[60px] justify-center"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                
                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {totalPages > 0 && (
                    <>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-1 text-xs min-w-[32px] rounded border transition-colors ${
                              currentPage === pageNum 
                                ? 'bg-primary-600 text-white border-primary-600 font-semibold' 
                                : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      {totalPages > 5 && (
                        <span className="px-2 text-xs text-gray-500">
                          ... of {totalPages}
                        </span>
                      )}
                    </>
                  )}
                </div>
                
                {/* Page number input for large datasets */}
                {totalPages > 10 && (
                  <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300">
                    <span className="text-xs text-gray-600">Go to:</span>
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={currentPage}
                      onChange={(e) => {
                        const page = Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1));
                        setCurrentPage(page);
                      }}
                      className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-center"
                    />
                    <span className="text-xs text-gray-600">/ {totalPages}</span>
                  </div>
                )}
                
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 min-w-[60px] justify-center"
                  title="Next page"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 min-w-[60px] justify-center"
                  title="Last page"
                >
                  Last
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showUserForm && (
        <UserFormModal
          user={selectedUser}
          branches={branches}
          onClose={() => {
            setShowUserForm(false);
            setSelectedUser(null);
          }}
          onSave={handleUserSaved}
        />
      )}

      {showUserDetails && (
        <UserDetailsModal
          user={selectedUser}
          onClose={() => {
            setShowUserDetails(false);
            setSelectedUser(null);
          }}
          onEdit={() => {
            setShowUserDetails(false);
            setShowUserForm(true);
          }}
        />
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Are You Sure?
            </h3>
            <p className="text-gray-600 mb-6">
              {selectedUser.isActive 
                ? `Are you sure you want to deactivate ${getFullName(selectedUser)}? They will no longer be able to access the system.`
                : `Are you sure you want to activate ${getFullName(selectedUser)}? They will be able to access the system.`
              }
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setConfirmAction(null);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmAction) {
                    confirmAction();
                  }
                }}
                className={`px-4 py-2 rounded-lg text-white ${
                  selectedUser.isActive 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {selectedUser.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && passwordResetData.user && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                Reset Passwords for {getFullName(passwordResetData.user)}
              </h3>
              <button
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setPasswordResetData({ user: null, rolePasswords: {}, manualPasswords: {} });
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-sm text-gray-600">
                You can manually set passwords for each role or use auto-generated passwords. 
                Passwords must be at least 8 characters with a number and special character.
              </p>

              {getUserRoles(passwordResetData.user).map((role) => {
                const autoPassword = passwordResetData.rolePasswords[role] || generateDefaultPassword(role);
                const manualPassword = passwordResetData.manualPasswords[role];
                const displayPassword = manualPassword || autoPassword;

                return (
                  <div key={role} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-gray-900">
                        {ROLE_LABELS[role]} Password
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRegeneratePassword(role)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg text-primary-700 font-medium transition-colors"
                        title="Generate new password"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Regenerate
                      </button>
                    </div>
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={displayPassword}
                        onChange={(e) => handleUpdateManualPassword(role, e.target.value)}
                        className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                        placeholder={`Auto-generated: ${role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, '')}123!`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(displayPassword);
                          toast.success(`${ROLE_LABELS[role]} password copied!`);
                        }}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                        title="Copy password"
                      >
                        📋
                      </button>
                    </div>
                    
                    {manualPassword && manualPassword !== autoPassword && (
                      <p className="text-xs text-blue-600 mt-2">
                        ✓ Custom password set (different from auto-generated)
                      </p>
                    )}
                    {!manualPassword && (
                      <p className="text-xs text-gray-500 mt-2">
                        Auto-generated format: [Role]123[specialChar] (e.g., Stylist123!, Branchmanager123@)
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-semibold text-yellow-900 mb-2">
                ⚠️ Important:
              </p>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>Passwords will be sent to {passwordResetData.user.email}</li>
                <li>User should change password after first login</li>
                <li>All role passwords will be updated</li>
              </ul>
            </div>

            <div className="flex gap-2 justify-end flex-wrap">
              <button
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setPasswordResetData({ user: null, rolePasswords: {}, manualPasswords: {} });
                }}
                className="px-4 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setPendingResetAction(() => () => handleResetRolePasswords(true));
                  setShowResetConfirmModal(true);
                }}
                className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors whitespace-nowrap"
              >
                Reset All Auto-Generate
              </button>
              <button
                onClick={() => {
                  setPendingResetAction(() => () => handleResetRolePasswords(false));
                  setShowResetConfirmModal(true);
                }}
                className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors whitespace-nowrap"
              >
                Reset with Current Passwords
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Confirmation Modal */}
      {showResetConfirmModal && passwordResetData.user && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Confirm Password Reset
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to reset passwords for <strong>{getFullName(passwordResetData.user)}</strong>?
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-semibold text-yellow-900 mb-2">
                ⚠️ This action will:
              </p>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>Update all role passwords in the system</li>
                <li>Send the new passwords to {passwordResetData.user.email}</li>
                <li>Require the user to change password on first login</li>
              </ul>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowResetConfirmModal(false);
                  setPendingResetAction(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (pendingResetAction) {
                    pendingResetAction();
                  }
                  setShowResetConfirmModal(false);
                  setShowResetPasswordModal(false);
                  setPendingResetAction(null);
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold transition-colors"
              >
                Yes, Reset Passwords
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Display Modal - Big Display */}
      {showPasswordModal && resetUserInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Password Reset Successful!
              </h3>
              <p className="text-gray-600 mb-6">
                Password has been reset for <strong>{resetUserInfo.name}</strong>
              </p>
              
              {/* Role Passwords Display */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm font-semibold text-blue-900 mb-3">
                  Passwords for each role:
                </p>
                <div className="space-y-3">
                  {Object.entries(resetUserInfo.passwords).map(([role, password]) => (
                    <div key={role} className="bg-white border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700 capitalize">
                          {ROLE_LABELS[role] || role.replace(/_/g, ' ')}:
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-mono font-bold text-blue-600 select-all">
                            {password}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(password);
                              toast.success(`${ROLE_LABELS[role] || role} password copied!`);
                            }}
                            className="px-3 py-1 bg-blue-100 hover:bg-blue-200 rounded-lg text-sm font-medium text-blue-700 transition-colors"
                            title="Copy password"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm font-semibold text-yellow-900 mb-2">
                  ⚠️ Important:
                </p>
                <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                  <li>This password has been sent to {resetUserInfo.email}</li>
                  <li>User should change this password after first login</li>
                  <li>Do not share this password with anyone</li>
                </ul>
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setResetPassword('');
                    setResetUserInfo(null);
                  }}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagement;
