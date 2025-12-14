/**
 * Leave Management Page - Branch Manager
 * Manage leave requests for stylists and request own leave
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, Plus, CheckCircle, XCircle, Clock, User, Search, Filter, UserPlus, Printer, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getLeaveRequestsByBranch, 
  saveLeaveRequest, 
  approveLeaveRequest, 
  rejectLeaveRequest,
  cancelLeaveRequest,
  LEAVE_TYPES 
} from '../../services/leaveManagementService';
import { getUsersByBranch, getUserById } from '../../services/userService';
import { getBranchById } from '../../services/branchService';
import { formatDate, getFullName } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import LeaveRequestModal from '../../components/leave/LeaveRequestModal';
import RejectLeaveModal from '../../components/leave/RejectLeaveModal';

const LeaveManagement = () => {
  const { currentUser, userBranch, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isForStaff, setIsForStaff] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [branchInfo, setBranchInfo] = useState(null);
  
  // Print ref
  const printRef = useRef();

  // Set page title with role prefix
  useEffect(() => {
    document.title = 'Branch Manager - Leave Management | DSMS';
    return () => {
      document.title = 'DSMS - David\'s Salon Management System';
    };
  }, []);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  useEffect(() => {
    if (userBranch) {
      fetchLeaveRequests();
      fetchStaffMembers();
      fetchBranchInfo();
    }
  }, [userBranch]);

  const fetchBranchInfo = async () => {
    try {
      const branch = await getBranchById(userBranch);
      setBranchInfo(branch);
    } catch (error) {
      console.error('Error fetching branch info:', error);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const requests = await getLeaveRequestsByBranch(userBranch);
      setLeaveRequests(requests);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      const staff = await getUsersByBranch(userBranch);
      // Get all staff (not just stylists) for filtering
      const allStaff = staff.filter(s => {
        const userRoles = s.roles || (s.role ? [s.role] : []);
        return userRoles.some(role => ['stylist', 'receptionist', 'inventory_controller'].includes(role));
      });
      setStaffMembers(allStaff);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const filteredRequests = useMemo(() => {
    return leaveRequests.filter(request => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const employeeName = getEmployeeName(request.employeeId).toLowerCase();
        if (!employeeName.includes(searchLower)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && request.status !== statusFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== 'all' && request.type !== typeFilter) {
        return false;
      }

      // Staff filter
      if (staffFilter !== 'all' && request.employeeId !== staffFilter) {
        return false;
      }

      // Branch manager can see:
      // 1. Stylist requests (requests that don't require operational approval - they approve these)
      // 2. Their own requests (regardless of status or requiresOperationalApproval) - including cancelled/pending/approved
      // 3. All requests in their branch (to see all leave activity for their branch)
      const isStylistRequest = !request.requiresOperationalApproval;
      const isOwnRequest = request.employeeId === currentUser.uid;
      const isInSameBranch = request.branchId === userBranch;
      
      // Show if: stylist request (for approval), own request (to see status), or in same branch (visibility)
      return isStylistRequest || isOwnRequest || isInSameBranch;
    });
  }, [leaveRequests, searchTerm, statusFilter, typeFilter, staffFilter, currentUser.uid, staffMembers]);

  // Pagination calculations
  const paginationData = useMemo(() => {
    const totalItems = filteredRequests.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedRequests = filteredRequests.slice(startIndex, endIndex);
    
    return {
      totalItems,
      totalPages,
      startIndex,
      endIndex,
      paginatedRequests
    };
  }, [filteredRequests, currentPage, itemsPerPage]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, staffFilter]);

  const getEmployeeName = (employeeId) => {
    if (employeeId === currentUser.uid) {
      return getFullName(userData) || currentUser.displayName || 'Me';
    }
    const staff = staffMembers.find(s => s.id === employeeId);
    return staff ? getFullName(staff) : 'Unknown';
  };

  const getLeaveTypeInfo = (type) => {
    return LEAVE_TYPES.find(t => t.value === type) || LEAVE_TYPES[0];
  };

  const handleApprove = async (request) => {
    try {
      setProcessing(request.id);
      await approveLeaveRequest(request.id, currentUser);
      await fetchLeaveRequests();
      setProcessing(null);
    } catch (error) {
      setProcessing(null);
    }
  };

  const handleReject = (request) => {
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async (reason) => {
    if (!selectedRequest) return;
    
    try {
      setProcessing(selectedRequest.id);
      await rejectLeaveRequest(selectedRequest.id, reason, currentUser);
      await fetchLeaveRequests();
      setShowRejectModal(false);
      setSelectedRequest(null);
      setProcessing(null);
    } catch (error) {
      setProcessing(null);
    }
  };

  const handleCancel = async (request) => {
    if (!confirm('Are you sure you want to cancel this leave request?')) return;
    
    try {
      setProcessing(request.id);
      await cancelLeaveRequest(request.id, currentUser);
      await fetchLeaveRequests();
      setProcessing(null);
    } catch (error) {
      setProcessing(null);
    }
  };

  const handleRequestLeave = (forStaff = false) => {
    setIsForStaff(forStaff);
    setSelectedRequest(null);
    setShowRequestModal(true);
  };

  const handleSubmitLeave = async (leaveData) => {
    try {
      // If requesting for staff, use their ID; otherwise use current user's ID
      const employeeId = isForStaff ? leaveData.employeeId : currentUser.uid;
      
      // Pass userData so the service can check if current user is branch manager
      await saveLeaveRequest({
        ...leaveData,
        employeeId,
        branchId: userBranch,
      }, currentUser, userData);
      
      await fetchLeaveRequests();
      setShowRequestModal(false);
      setIsForStaff(false);
    } catch (error) {
      console.error('Error submitting leave:', error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return badges[status] || badges.pending;
  };

  // Print handler
  const handlePrint = () => {
    if (!printRef.current) {
      toast.error('Print content not ready. Please try again.');
      return;
    }

    setTimeout(() => {
      if (!printRef.current) {
        toast.error('Print content not ready. Please try again.');
        return;
      }

      const printContentHTML = printRef.current.innerHTML;
      
      let styles = '';
      try {
        styles = Array.from(document.styleSheets)
          .map((sheet) => {
            try {
              return Array.from(sheet.cssRules || [])
                .map((rule) => rule.cssText)
                .join('\n');
            } catch (e) {
              return '';
            }
          })
          .join('\n');
      } catch (e) {
        console.warn('Could not extract all styles:', e);
      }

      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      if (!printWindow) {
        toast.error('Please allow pop-ups to print the leave report');
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Leave Report - ${new Date().toISOString().split('T')[0]}</title>
          <meta charset="utf-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
            ${styles}
            @media print {
              @page {
                size: A4;
                margin: 0.75in;
              }
              * {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: 'Poppins', sans-serif;
              margin: 0;
              padding: 20px;
              background: white;
              color: #000;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            th, td {
              border: 1px solid #000;
              padding: 10px 8px;
            }
            th {
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          ${printContentHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  setTimeout(function() {
                    window.close();
                  }, 100);
                };
                setTimeout(function() {
                  if (!window.closed) {
                    window.close();
                  }
                }, 30000);
              }, 500);
            };
          </script>
        </body>
        </html>
      `);
      
      printWindow.document.close();
    }, 100);
  };

  const pendingRequests = filteredRequests.filter(r => r.status === 'pending');
  const approvedRequests = filteredRequests.filter(r => r.status === 'approved');
  const rejectedRequests = filteredRequests.filter(r => r.status === 'rejected');
  const cancelledRequests = filteredRequests.filter(r => r.status === 'cancelled');

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
          <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
          <p className="text-gray-600">Manage leave requests for your branch</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Printer className="w-5 h-5" />
            Print Report
          </button>
          <button
            onClick={() => handleRequestLeave(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Add Leave for Staff
          </button>
          <button
            onClick={() => handleRequestLeave(false)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Request My Leave
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">Pending</div>
            <div className="bg-yellow-100 p-2 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-yellow-600">{pendingRequests.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">Approved</div>
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-green-600">{approvedRequests.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">Rejected</div>
            <div className="bg-red-100 p-2 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-red-600">{rejectedRequests.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">Cancelled</div>
            <div className="bg-gray-100 p-2 rounded-lg">
              <X className="w-5 h-5 text-gray-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-600">{cancelledRequests.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">Total</div>
            <div className="bg-blue-100 p-2 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{filteredRequests.length}</div>
        </div>
      </div>

      {/* Filters Section */}
      <Card>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              {(statusFilter !== 'all' || typeFilter !== 'all' || staffFilter !== 'all' || searchTerm) && (
                <span className="px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded-full font-medium">
                  {[statusFilter !== 'all' ? 'Status' : null, typeFilter !== 'all' ? 'Type' : null, staffFilter !== 'all' ? 'Staff' : null, searchTerm ? 'Search' : null].filter(Boolean).length} active
                </span>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              {showFilters ? 'Hide' : 'Show'} Filters
              <Filter className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showFilters && (
            <div className="space-y-4 border-t border-gray-200 pt-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by employee name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Filter Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Leave Type
                  </label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="all">All Types</option>
                    {LEAVE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                {/* Staff Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Staff Member
                  </label>
                  <select
                    value={staffFilter}
                    onChange={(e) => setStaffFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="all">All Staff</option>
                    <option value={currentUser.uid}>Me ({getFullName(userData) || currentUser.displayName || 'My Requests'})</option>
                    {staffMembers.map(staff => {
                      const staffId = staff.id || staff.uid;
                      return (
                        <option key={staffId} value={staffId}>
                          {getFullName(staff)}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Clear Filters Button */}
              {(statusFilter !== 'all' || typeFilter !== 'all' || staffFilter !== 'all' || searchTerm) && (
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                      setTypeFilter('all');
                      setStaffFilter('all');
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900 underline"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Leave Requests List */}
      <Card>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Leave Requests</h2>
            <div className="text-sm text-gray-600">
              Showing {paginationData.startIndex + 1} to {Math.min(paginationData.endIndex, paginationData.totalItems)} of {paginationData.totalItems} results
            </div>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {paginationData.paginatedRequests.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-900 mb-2">No leave requests found</p>
              <p className="text-sm text-gray-500">
                {filteredRequests.length === 0 
                  ? "Try adjusting your search or filter criteria"
                  : "No requests match your current filters"
                }
              </p>
            </div>
          ) : (
            paginationData.paginatedRequests.map(request => {
              const typeInfo = getLeaveTypeInfo(request.type);
              const employeeName = getEmployeeName(request.employeeId);
              const isOwnRequest = request.employeeId === currentUser.uid;
              const isPending = request.status === 'pending';
              
              // Branch manager can approve/reject pending requests from employees/stylists:
              // - Request must be pending
              // - Must not be the branch manager's own request (those require operational manager approval)
              // - Must not require operational approval (indicates it's from an employee/stylist, not another manager)
              // If requiresOperationalApproval is false, it means it's an employee/stylist request
              const canApprove = isPending && !isOwnRequest && !request.requiresOperationalApproval;
              
              // Branch manager can cancel:
              // - Their own pending requests
              // - Requests they submitted for others
              const canCancel = isPending && (isOwnRequest || request.submittedBy === currentUser.uid);

              return (
                <div key={request.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="w-5 h-5 text-gray-400" />
                        <span className="font-semibold">{employeeName}</span>
                        {isOwnRequest && (
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            My Request
                          </span>
                        )}
                        {request.requiresOperationalApproval && (
                          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                            Pending Operational Manager
                          </span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded border ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded border ${getStatusBadge(request.status)}`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </div>
                      <div className="ml-8 space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {formatDate(request.startDate)} - {formatDate(request.endDate)}
                            {' '}({request.days} day{request.days !== 1 ? 's' : ''})
                          </span>
                        </div>
                        {request.reason && (
                          <div className="mt-1">
                            <strong>Reason:</strong> {request.reason}
                          </div>
                        )}
                        {request.status === 'rejected' && request.rejectionReason && (
                          <div className="mt-1 text-red-600">
                            <strong>Rejection Reason:</strong> {request.rejectionReason}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-2">
                          Requested: {formatDate(request.requestedAt)}
                          {request.reviewedAt && (
                            <> • Reviewed: {formatDate(request.reviewedAt)} by {request.reviewedByName || 'N/A'}</>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {canApprove && (
                        <>
                          <button
                            onClick={() => handleApprove(request)}
                            disabled={processing === request.id}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(request)}
                            disabled={processing === request.id}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </>
                      )}
                      {canCancel && (
                        <button
                          onClick={() => handleCancel(request)}
                          disabled={processing === request.id}
                          className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        {paginationData.totalPages > 1 && (
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
                    className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#160B53] focus:border-[#160B53]"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-xs text-gray-600">per page</span>
                </div>

                <div className="text-xs text-gray-600">
                  Page <span className="font-medium">{currentPage}</span> of{' '}
                  <span className="font-medium">{paginationData.totalPages}</span>
                </div>
              </div>

              {/* Bottom row: Navigation buttons */}
              <div className="flex items-center justify-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs min-w-[40px]"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs min-w-[40px]"
                >
                  Prev
                </Button>
                
                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(3, paginationData.totalPages) }, (_, i) => {
                    let pageNum;
                    if (paginationData.totalPages <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage <= 2) {
                      pageNum = i + 1;
                    } else if (currentPage >= paginationData.totalPages - 1) {
                      pageNum = paginationData.totalPages - 2 + i;
                    } else {
                      pageNum = currentPage - 1 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "primary" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-2 py-1 text-xs min-w-[32px] ${
                          currentPage === pageNum 
                            ? 'bg-[#160B53] hover:bg-[#12094A] text-white' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === paginationData.totalPages}
                  className="px-2 py-1 text-xs min-w-[40px]"
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(paginationData.totalPages)}
                  disabled={currentPage === paginationData.totalPages}
                  className="px-2 py-1 text-xs min-w-[40px]"
                >
                  Last
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Modals */}
      <LeaveRequestModal
        isOpen={showRequestModal}
        onClose={() => {
          setShowRequestModal(false);
          setIsForStaff(false);
        }}
        onSubmit={handleSubmitLeave}
        staffMembers={isForStaff ? staffMembers : []}
        isForStaff={isForStaff}
        currentUserId={currentUser.uid}
      />

      <RejectLeaveModal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedRequest(null);
        }}
        onConfirm={handleRejectConfirm}
      />

      {/* Hidden Print Component */}
      <div ref={printRef} style={{ position: 'fixed', left: '-200%', top: 0, width: '8.5in', zIndex: -1 }}>
        <style>{`
          @media print {
            @page {
              size: A4;
              margin: 0.75in;
            }
            * {
              color: #000 !important;
              background: transparent !important;
            }
          }
        `}</style>
        <div className="print-content" style={{ 
          fontFamily: "'Poppins', sans-serif",
          color: '#000',
          background: '#fff',
          padding: '20px'
        }}>
          {/* Header */}
          <div style={{ 
            textAlign: 'center',
            marginBottom: '30px',
            borderBottom: '2px solid #000',
            paddingBottom: '15px'
          }}>
            <h1 style={{ 
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '10px',
              letterSpacing: '1px'
            }}>
              LEAVE MANAGEMENT REPORT
            </h1>
            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
              {branchInfo?.branchName || branchInfo?.name || 'Branch'}
            </div>
            <div style={{ 
              fontSize: '11px',
              marginTop: '12px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <div style={{ textAlign: 'left' }}>
                <div>Printed by: {currentUser ? getFullName(currentUser) : 'Manager'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>Printed: {new Date().toLocaleString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}</div>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div style={{ 
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '10px'
          }}>
            <div style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '5px' }}>{pendingRequests.length}</div>
              <div style={{ fontSize: '11px' }}>Pending</div>
            </div>
            <div style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '5px' }}>{approvedRequests.length}</div>
              <div style={{ fontSize: '11px' }}>Approved</div>
            </div>
            <div style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '5px' }}>{rejectedRequests.length}</div>
              <div style={{ fontSize: '11px' }}>Rejected</div>
            </div>
            <div style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '5px' }}>{cancelledRequests.length}</div>
              <div style={{ fontSize: '11px' }}>Cancelled</div>
            </div>
            <div style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '5px' }}>{filteredRequests.length}</div>
              <div style={{ fontSize: '11px' }}>Total</div>
            </div>
          </div>

          {/* Leave Requests Table */}
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #000',
            fontSize: '11px'
          }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'left', fontWeight: 'bold' }}>Employee</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>Type</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>Start Date</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>End Date</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>Days</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>Status</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'left', fontWeight: 'bold' }}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ border: '1px solid #000', padding: '20px', textAlign: 'center' }}>
                    No leave requests found
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request, idx) => {
                  const typeInfo = getLeaveTypeInfo(request.type);
                  const employeeName = getEmployeeName(request.employeeId);
                  const isOwnRequest = request.employeeId === currentUser.uid;
                  
                  // Status colors
                  let statusBg = '#fef3c7';
                  let statusText = '#854d0e';
                  if (request.status === 'approved') {
                    statusBg = '#d1fae5';
                    statusText = '#065f46';
                  } else if (request.status === 'rejected') {
                    statusBg = '#fee2e2';
                    statusText = '#991b1b';
                  } else if (request.status === 'cancelled') {
                    statusBg = '#f3f4f6';
                    statusText = '#374151';
                  }

                  return (
                    <tr key={request.id} style={{ pageBreakInside: 'avoid' }}>
                      <td style={{ border: '1px solid #000', padding: '10px 8px' }}>
                        {employeeName}
                        {isOwnRequest && <span style={{ fontSize: '9px', color: '#666', display: 'block' }}>(My Request)</span>}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>{typeInfo.label}</td>
                      <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>{formatDate(request.startDate, 'MMM dd, yyyy')}</td>
                      <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>{formatDate(request.endDate, 'MMM dd, yyyy')}</td>
                      <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>{request.days || 'N/A'}</td>
                      <td style={{ 
                        border: '1px solid #000', 
                        padding: '10px 8px', 
                        textAlign: 'center',
                        backgroundColor: statusBg,
                        color: statusText,
                        fontWeight: '600'
                      }}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '10px 8px', fontSize: '10px' }}>
                        {request.reason || 'N/A'}
                        {request.status === 'rejected' && request.rejectionReason && (
                          <div style={{ marginTop: '5px', color: '#991b1b', fontSize: '9px' }}>
                            Rejection: {request.rejectionReason}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Footer */}
          <div className="mt-4 pt-2 border-t border-black text-center" style={{ fontSize: '11px', marginTop: '16px', paddingTop: '8px', borderTop: '1px solid #000' }}>
            <p>Total: {filteredRequests.length} | Pending: {pendingRequests.length} | Approved: {approvedRequests.length} | Rejected: {rejectedRequests.length} | Cancelled: {cancelledRequests.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveManagement;

