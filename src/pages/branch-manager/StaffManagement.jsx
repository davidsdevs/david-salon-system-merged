/**
 * Staff Management Page - Branch Manager
 * Manage staff within their branch only
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Users as UsersIcon, Plus, Search, Edit, Power, Mail, Scissors, Calendar, ArrowRight, ArrowLeftRight, Printer, Download, Filter, X } from 'lucide-react';
import { getUsersByBranch, toggleUserStatus, resetUserPassword, getUserById } from '../../services/userService';
import { getBranchById } from '../../services/branchService';
import { getActiveLendingForBranch, getActiveLendingFromBranch, getActiveLending } from '../../services/stylistLendingService';
import { getActiveSchedulesByEmployee } from '../../services/scheduleService';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES, ROLE_LABELS } from '../../utils/constants';
import { formatDate, getFullName, getInitials } from '../../utils/helpers';
import BranchStaffFormModal from '../../components/branch/BranchStaffFormModal';
import StaffServicesCertificatesModal from '../../components/branch/StaffServicesCertificatesModal';
import StaffSchedule from './StaffSchedule';
import StaffLending from './StaffLending';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import RoleBadges from '../../components/ui/RoleBadges';
import toast from 'react-hot-toast';

const StaffManagement = () => {
  const { currentUser, userBranch } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [lendingFilter, setLendingFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showServicesCertificatesModal, setShowServicesCertificatesModal] = useState(false);
  const [selectedStaffForConfig, setSelectedStaffForConfig] = useState(null);
  const [branchName, setBranchName] = useState('');
  const [activeTab, setActiveTab] = useState('list');
  const [lentStaff, setLentStaff] = useState([]);
  const [lentOutStaff, setLentOutStaff] = useState({});
  const [branchCache, setBranchCache] = useState({});
  
  // Print ref
  const printRef = useRef();

  // Branch Manager can only manage these roles
  const MANAGEABLE_ROLES = [
    USER_ROLES.RECEPTIONIST,
    USER_ROLES.STYLIST,
    USER_ROLES.INVENTORY_CONTROLLER
  ];

  useEffect(() => {
    if (userBranch) {
      fetchBranchDetails();
      fetchStaff();
    }
  }, [userBranch]);

  // Fetch lending data after staff is loaded
  useEffect(() => {
    if (userBranch && staff.length > 0) {
      fetchLendingData();
    }
  }, [userBranch, staff.length]);

  // Fetch lending data - staff lent TO this branch and staff FROM this branch lent out
  const fetchLendingData = async () => {
    if (!userBranch) return;
    
    try {
      const today = new Date();
      
      // Get staff currently lent TO this branch (from other branches)
      // Pass null to get ALL approved/active requests regardless of date
      const activeLendingsTo = await getActiveLendingForBranch(userBranch, null);
      
      console.log('Fetched active lendings TO this branch:', {
        branchId: userBranch,
        count: activeLendingsTo.length,
        lendings: activeLendingsTo
      });
      
      // Fetch the actual staff data for lent staff
      const lentStaffData = await Promise.all(
        activeLendingsTo.map(async (lending) => {
          try {
            const staffMember = await getUserById(lending.stylistId);
            const fromBranch = await getBranchById(lending.fromBranchId);
            
            // Check if staff member has any manageable role
            const userRoles = staffMember.roles || (staffMember.role ? [staffMember.role] : []);
            const hasManageableRole = userRoles.some(role => MANAGEABLE_ROLES.includes(role));
            
            console.log('Fetched lent staff member:', {
              staffId: lending.stylistId,
              staffName: getFullName(staffMember),
              fromBranch: fromBranch?.branchName || fromBranch?.name,
              roles: userRoles,
              hasManageableRole
            });
            
            // Only include if they have a manageable role (same as regular staff)
            if (!hasManageableRole) {
              console.log('Skipping lent staff member - no manageable role:', getFullName(staffMember));
              return null;
            }
            
            return {
              ...staffMember,
              isLent: true,
              lentFromBranch: fromBranch?.branchName || fromBranch?.name || 'Unknown Branch',
              lentFromBranchId: lending.fromBranchId,
              lendingStartDate: lending.startDate,
              lendingEndDate: lending.endDate
            };
          } catch (error) {
            console.error('Error fetching lent staff:', error);
            return null;
          }
        })
      );
      
      const validLentStaff = lentStaffData.filter(s => s !== null);
      console.log('Setting lent staff:', validLentStaff.length, validLentStaff);
      setLentStaff(validLentStaff);
      
      // Get staff FROM this branch that are lent out
      // Pass null to get ALL approved/active requests regardless of date
      const activeLendingsFrom = await getActiveLendingFromBranch(userBranch, null);
      const lentOutMap = {};
      const branchIds = new Set();
      
      activeLendingsFrom.forEach(lending => {
        if (lending.stylistId) {
          branchIds.add(lending.toBranchId);
          const lendingInfo = {
            toBranchId: lending.toBranchId,
            startDate: lending.startDate,
            endDate: lending.endDate
          };
          
          // Store with stylistId (which is typically the Firebase Auth UID)
          lentOutMap[lending.stylistId] = lendingInfo;
          
          // Also try to find the staff member and store with their document ID if different
          // This ensures we can match regardless of which ID is used
          const staffMember = staff.find(s => {
            const sId = s.id || s.uid;
            const sUid = s.uid || s.id;
            return sId === lending.stylistId || sUid === lending.stylistId;
          });
          
          if (staffMember) {
            const docId = staffMember.id;
            const authUid = staffMember.uid;
            // Store with document ID if it exists and is different from stylistId
            if (docId && docId !== lending.stylistId) {
              lentOutMap[docId] = lendingInfo;
            }
            // Store with uid if it exists and is different from stylistId and docId
            if (authUid && authUid !== lending.stylistId && authUid !== docId) {
              lentOutMap[authUid] = lendingInfo;
            }
          }
        }
      });
      
      // Fetch branch names
      const branchPromises = Array.from(branchIds).map(async (id) => {
        if (!branchCache[id]) {
          try {
            const branch = await getBranchById(id);
            return { id, branch };
          } catch (error) {
            return { id, branch: null };
          }
        }
        return null;
      });
      
      const branchResults = await Promise.all(branchPromises);
      const newBranchCache = { ...branchCache };
      branchResults.forEach(result => {
        if (result && result.branch) {
          newBranchCache[result.id] = result.branch;
        }
      });
      setBranchCache(newBranchCache);
      
      // Update lentOutMap with branch names
      Object.keys(lentOutMap).forEach(staffId => {
        const branch = newBranchCache[lentOutMap[staffId].toBranchId];
        lentOutMap[staffId].toBranchName = branch?.branchName || branch?.name || 'Unknown Branch';
      });
      
      console.log('Lent out staff map:', lentOutMap);
      console.log('Active lendings from branch:', activeLendingsFrom);
      setLentOutStaff(lentOutMap);
    } catch (error) {
      console.error('Error fetching lending data:', error);
    }
  };

  const fetchBranchDetails = async () => {
    try {
      const branch = await getBranchById(userBranch);
      setBranchName(branch.branchName);
    } catch (error) {
      console.error('Error fetching branch details:', error);
    }
  };

  // Print handler
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Staff_Data_${new Date().toISOString().split('T')[0]}`,
    onPrintError: (error) => {
      console.error('Print error:', error);
      toast.error('Failed to print. Please try again.');
    },
  });

  // Enhanced filtering with all filters
  const filteredStaff = useMemo(() => {
    const allStaff = [...staff, ...lentStaff];
    let filtered = [...allStaff];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(member => {
        const fullName = getFullName(member).toLowerCase();
        const email = member.email?.toLowerCase() || '';
        const phone = member.phone?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        return fullName.includes(search) || email.includes(search) || phone.includes(search);
      });
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(member => {
        const memberRoles = member.roles || (member.role ? [member.role] : []);
        return memberRoles.includes(roleFilter);
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(member => {
        if (statusFilter === 'active') return member.isActive === true;
        if (statusFilter === 'inactive') return member.isActive === false;
        return true;
      });
    }

    // Shift filter
    if (shiftFilter !== 'all') {
      filtered = filtered.filter(member => {
        const hasShifts = member.shifts && Object.keys(member.shifts).length > 0;
        if (shiftFilter === 'with-shifts') return hasShifts;
        if (shiftFilter === 'no-shifts') return !hasShifts;
        return true;
      });
    }

    // Date range filter
    if (dateRangeFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(member => {
        if (!member.createdAt) return false;
        const createdDate = member.createdAt?.toDate ? member.createdAt.toDate() : new Date(member.createdAt);
        const diffTime = now - createdDate;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        
        switch (dateRangeFilter) {
          case 'today':
            return diffDays < 1;
          case 'week':
            return diffDays < 7;
          case 'month':
            return diffDays < 30;
          case 'year':
            return diffDays < 365;
          default:
            return true;
        }
      });
    }

    // Lending filter
    if (lendingFilter !== 'all') {
      filtered = filtered.filter(member => {
        const memberId = member.id || member.uid;
        const memberUid = member.uid || member.id;
        const isLentIn = member.isLent;
        // Check both id and uid in case they're stored differently
        const isLentOut = !!(lentOutStaff[memberId] || lentOutStaff[memberUid]);
        
        // Debug logging for lent-out filter
        if (lendingFilter === 'lent-out') {
          console.log('Checking member for lent-out:', {
            name: getFullName(member),
            memberId,
            memberUid,
            isLentOut,
            lentOutStaffKeys: Object.keys(lentOutStaff),
            matchById: !!lentOutStaff[memberId],
            matchByUid: !!lentOutStaff[memberUid]
          });
        }
        
        if (lendingFilter === 'lent-in') return isLentIn;
        if (lendingFilter === 'lent-out') return isLentOut;
        if (lendingFilter === 'not-lent') return !isLentIn && !isLentOut;
        return true;
      });
    }

    return filtered;
  }, [staff, lentStaff, searchTerm, roleFilter, statusFilter, shiftFilter, dateRangeFilter, lendingFilter, lentOutStaff]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const branchStaff = await getUsersByBranch(userBranch);
      // Filter to only show manageable roles
      const manageableStaff = branchStaff.filter(user => {
        // Check if user has any manageable role in their roles array
        const userRoles = user.roles || (user.role ? [user.role] : []);
        return userRoles.some(role => MANAGEABLE_ROLES.includes(role));
      });
      
      // Load shifts from schedules collection for each staff member
      const today = new Date();
      const staffWithSchedules = await Promise.all(
        manageableStaff.map(async (member) => {
          const memberId = member.id || member.uid;
          if (!memberId) return member;
          
          try {
            // Get active schedule configuration for today
            const { activeConfig } = await getActiveSchedulesByEmployee(memberId, userBranch, today);
            
            // Extract shifts from the active config
            const shifts = {};
            if (activeConfig && activeConfig.employeeShifts) {
              Object.entries(activeConfig.employeeShifts).forEach(([dayKey, shift]) => {
                if (shift && shift.start && shift.end) {
                  shifts[dayKey.toLowerCase()] = {
                    start: shift.start,
                    end: shift.end
                  };
                }
              });
            }
            
            return {
              ...member,
              shifts
            };
          } catch (error) {
            console.error(`Error loading schedules for ${memberId}:`, error);
            return { ...member, shifts: {} };
          }
        })
      );
      
      setStaff(staffWithSchedules);
    } catch (error) {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  // CSV Export
  const exportToCSV = () => {
    if (!filteredStaff || filteredStaff.length === 0) {
      toast.error('No data to export');
      return;
    }

    const exportData = filteredStaff.map(member => {
      const roles = member.roles || (member.role ? [member.role] : []);
      const shifts = member.shifts || {};
      const shiftDays = Object.keys(shifts).map(day => {
        const shift = shifts[day];
        return `${day.charAt(0).toUpperCase() + day.slice(1)}: ${shift.start}-${shift.end}`;
      }).join('; ');
      
      return {
        'Employee ID': member.id || member.uid || 'N/A',
        'First Name': member.firstName || '',
        'Middle Name': member.middleName || '',
        'Last Name': member.lastName || '',
        'Full Name': getFullName(member),
        'Email': member.email || '',
        'Phone': member.phone || '',
        'Roles': roles.map(r => ROLE_LABELS[r] || r).join('; '),
        'Status': member.isActive ? 'Active' : 'Inactive',
        'Shifts': shiftDays || 'No shifts assigned',
        'Date Joined': member.createdAt ? formatDate(member.createdAt) : 'N/A',
        'Branch': branchName,
        'Lent Status': member.isLent ? `Lent from ${member.lentFromBranch || 'Unknown'}` : (lentOutStaff[member.id || member.uid] ? `Lent to ${lentOutStaff[member.id || member.uid].toBranchName}` : 'Not lent')
      };
    });

    const csvHeaders = Object.keys(exportData[0] || {});
    const csvRows = [
      csvHeaders.join(','),
      ...exportData.map(row => {
        return csvHeaders.map(header => {
          const value = row[header] || '';
          const stringValue = String(value).replace(/"/g, '""');
          return `"${stringValue}"`;
        }).join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `Staff_Data_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV file downloaded successfully');
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      await toggleUserStatus(userId, !currentStatus, currentUser);
      await fetchStaff();
    } catch (error) {
      // Error handled in service
    }
  };

  const handleResetPassword = async (email) => {
    try {
      await resetUserPassword(email);
    } catch (error) {
      // Error handled in service
    }
  };

  const handleEditStaff = (member) => {
    setSelectedStaff(member);
    setShowStaffForm(true);
  };

  const handleStaffSaved = () => {
    setShowStaffForm(false);
    setSelectedStaff(null);
    fetchStaff();
  };

  const handleConfigureServices = (member) => {
    setSelectedStaffForConfig(member);
    setShowServicesCertificatesModal(true);
  };

  const handleViewServices = (member) => {
    // For lent staff, open in view-only mode with their original branch ID
    setSelectedStaffForConfig({ 
      ...member, 
      isLent: true,
      originalBranchId: member.lentFromBranchId || userBranch
    });
    setShowServicesCertificatesModal(true);
  };

  const handleServicesCertificatesSaved = () => {
    setShowServicesCertificatesModal(false);
    setSelectedStaffForConfig(null);
    fetchStaff();
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!userBranch) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <p className="text-yellow-800">
          You need to be assigned to a branch to manage staff.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-gray-600 mt-1">
            Manage staff members for branch: <span className="font-semibold">{branchName || 'Loading...'}</span>
          </p>
        </div>
        {activeTab === 'list' && (
          <button
            onClick={() => {
              setSelectedStaff(null);
              setShowStaffForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Staff
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'list'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <UsersIcon className="w-4 h-4" />
                Staff List
              </div>
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'schedule'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Schedule
              </div>
            </button>
            <button
              onClick={() => setActiveTab('lending')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors relative ${
                activeTab === 'lending'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4" />
                Lending
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'list' ? (
        <>
          {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Staff</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{staff.length}</p>
            </div>
            <UsersIcon className="w-8 h-8 text-primary-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Staff</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {staff.filter(s => s.isActive).length}
              </p>
            </div>
            <Power className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Receptionists</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {staff.filter(s => {
                  const roles = s.roles || (s.role ? [s.role] : []);
                  return roles.includes(USER_ROLES.RECEPTIONIST);
                }).length}
              </p>
            </div>
            <UsersIcon className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Stylists</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {staff.filter(s => {
                  const roles = s.roles || (s.role ? [s.role] : []);
                  return roles.includes(USER_ROLES.STYLIST);
                }).length}
              </p>
            </div>
            <UsersIcon className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                showFilters 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {(statusFilter !== 'all' || shiftFilter !== 'all' || dateRangeFilter !== 'all' || lendingFilter !== 'all') && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-white text-primary-600 rounded-full">
                  {[statusFilter, shiftFilter, dateRangeFilter, lendingFilter].filter(f => f !== 'all').length}
                </span>
              )}
            </button>
            {((statusFilter !== 'all' || shiftFilter !== 'all' || dateRangeFilter !== 'all' || lendingFilter !== 'all')) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setShiftFilter('all');
                  setDateRangeFilter('all');
                  setLendingFilter('all');
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!filteredStaff || filteredStaff.length === 0) {
                  toast.error('No staff data to print');
                  return;
                }
                if (!printRef.current) {
                  toast.error('Print content not ready. Please try again.');
                  return;
                }
                handlePrint();
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Staff Data
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Basic Search and Role Filter - Always Visible */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Roles</option>
            {MANAGEABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>

        {/* Advanced Filters - Collapsible */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-gray-200">
            {/* Status Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Shift Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Shifts</label>
              <select
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="with-shifts">With Shifts</option>
                <option value="no-shifts">No Shifts</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Joined Date</label>
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="year">Last Year</option>
              </select>
            </div>

            {/* Lending Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Lending Status</label>
              <select
                value={lendingFilter}
                onChange={(e) => setLendingFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="lent-in">Lent In</option>
                <option value="lent-out">Lent Out</option>
                <option value="not-lent">Not Lent</option>
              </select>
            </div>
          </div>
        )}

        {/* Results Count */}
        <div className="mt-3 text-sm text-gray-600">
          Showing <span className="font-medium">{filteredStaff.length}</span> of <span className="font-medium">{staff.length + lentStaff.length}</span> staff members
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Staff Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shifts
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    No staff members found
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => {
                  const memberId = member.id || member.uid;
                  const isLentToThisBranch = member.isLent; // Staff lent TO this branch
                  const isLentOut = lentOutStaff[memberId]; // Staff FROM this branch lent out
                  
                  return (
                  <tr key={memberId} className={`hover:bg-gray-50 ${isLentToThisBranch ? 'bg-blue-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {getInitials(member)}
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-gray-900">
                              {getFullName(member)}
                            </div>
                            {isLentToThisBranch && (
                              <span className="px-2 py-0.5 text-xs font-semibold text-white bg-blue-600 rounded-full">
                                (lent)
                              </span>
                            )}
                            {isLentOut && (
                              <span className="px-2 py-0.5 text-xs font-semibold text-purple-700 bg-purple-100 rounded-full flex items-center gap-1">
                                <ArrowRight className="w-3 h-3" />
                                Lent to {isLentOut.toBranchName}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{member.email}</div>
                          {isLentToThisBranch && member.lentFromBranch && (
                            <div className="text-xs text-blue-600 mt-1">
                              From: {member.lentFromBranch}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RoleBadges user={member} size="sm" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {member.shifts && Object.keys(member.shifts).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(member.shifts).map((dayKey) => {
                            const dayLabels = {
                              monday: 'M',
                              tuesday: 'T',
                              wednesday: 'W',
                              thursday: 'T',
                              friday: 'F',
                              saturday: 'S',
                              sunday: 'S'
                            };
                            const shift = member.shifts[dayKey];
                            return (
                              <span
                                key={dayKey}
                                className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded"
                                title={`${dayKey.charAt(0).toUpperCase() + dayKey.slice(1)}: ${shift.start} - ${shift.end}`}
                              >
                                {dayLabels[dayKey]}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No shifts</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        member.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(member.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {isLentToThisBranch ? (
                        // View-only actions for lent staff
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewServices(member)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Services & Certificates (Read-only)"
                          >
                            <Scissors className="w-5 h-5" />
                          </button>
                          <span className="text-xs text-gray-400 italic">View only</span>
                        </div>
                      ) : (
                        // Full actions for regular staff
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditStaff(member)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Edit Staff"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleConfigureServices(member)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Configure Services & Certificates"
                          >
                            <Scissors className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleResetPassword(member.email)}
                            className="text-orange-600 hover:text-orange-900"
                            title="Reset Password"
                          >
                            <Mail className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(member.id, member.isActive)}
                            className={member.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}
                            title={member.isActive ? 'Deactivate' : 'Activate'}
                          >
                            <Power className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : activeTab === 'schedule' ? (
        <StaffSchedule />
      ) : (
        <StaffLending />
      )}

      {/* Print View - Hidden */}
      <div ref={printRef} style={{ display: 'none' }}>
        <div className="p-6">
          <div className="text-center mb-4 border-b pb-3">
            <h1 className="text-2xl font-bold">Staff Data Report</h1>
            <p className="text-sm text-gray-600 mt-1">{branchName}</p>
            <p className="text-xs text-gray-500 mt-1">Generated on {formatDate(new Date(), 'MMM dd, yyyy hh:mm a')}</p>
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Name</th>
                <th className="border p-2 text-left">Email</th>
                <th className="border p-2 text-left">Roles</th>
                <th className="border p-2 text-left">Status</th>
                <th className="border p-2 text-left">Shifts</th>
                <th className="border p-2 text-left">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((member) => {
                const roles = member.roles || (member.role ? [member.role] : []);
                const shifts = member.shifts || {};
                const shiftCount = Object.keys(shifts).length;
                
                return (
                  <tr key={member.id || member.uid}>
                    <td className="border p-2">{getFullName(member)}</td>
                    <td className="border p-2">{member.email || 'N/A'}</td>
                    <td className="border p-2">{roles.map(role => ROLE_LABELS[role] || role).join(', ')}</td>
                    <td className="border p-2">{member.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="border p-2">{shiftCount > 0 ? `${shiftCount} days` : 'No shifts'}</td>
                    <td className="border p-2">{member.createdAt ? formatDate(member.createdAt) : 'N/A'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-4 text-xs text-gray-500 text-center">
            Total Staff: {filteredStaff.length} | Active: {filteredStaff.filter(s => s.isActive).length}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showStaffForm && (
        <BranchStaffFormModal
          staff={selectedStaff}
          branchId={userBranch}
          branchName={branchName}
          onClose={() => {
            setShowStaffForm(false);
            setSelectedStaff(null);
          }}
          onSave={handleStaffSaved}
        />
      )}

      {showServicesCertificatesModal && (
        <StaffServicesCertificatesModal
          isOpen={showServicesCertificatesModal}
          staff={selectedStaffForConfig}
          branchId={selectedStaffForConfig?.isLent ? (selectedStaffForConfig.originalBranchId || selectedStaffForConfig.lentFromBranchId) : userBranch}
          onClose={() => {
            setShowServicesCertificatesModal(false);
            setSelectedStaffForConfig(null);
          }}
          onSave={handleServicesCertificatesSaved}
          isReadOnly={selectedStaffForConfig?.isLent || false}
        />
      )}

    </div>
  );
};

export default StaffManagement;
