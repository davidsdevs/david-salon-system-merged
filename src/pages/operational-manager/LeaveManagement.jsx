/**
 * Leave Management Page - Operational Manager
 * Approve/reject leave requests from branch managers
 */

import { useState, useEffect, useMemo } from 'react';
import { Calendar, CheckCircle, XCircle, Clock, User, Search, Filter, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getBranchManagerLeaveRequests, 
  approveLeaveRequest, 
  rejectLeaveRequest,
  LEAVE_TYPES 
} from '../../services/leaveManagementService';
import { getUserById } from '../../services/userService';
import { getBranchById } from '../../services/branchService';
import { formatDate, getFullName } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import RejectLeaveModal from '../../components/leave/RejectLeaveModal';
import toast from 'react-hot-toast';

const OperationalManagerLeaveManagement = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [userCache, setUserCache] = useState({});
  const [branchCache, setBranchCache] = useState({});
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processing, setProcessing] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const requests = await getBranchManagerLeaveRequests();
      setLeaveRequests(requests);

      // Fetch user and branch info
      const userIds = new Set();
      const branchIds = new Set();

      requests.forEach(req => {
        if (req.employeeId) userIds.add(req.employeeId);
        if (req.branchId) branchIds.add(req.branchId);
      });

      // Fetch users
      const userPromises = Array.from(userIds).map(async (id) => {
        if (!userCache[id]) {
          try {
            const user = await getUserById(id);
            return { id, user };
          } catch (error) {
            return { id, user: null };
          }
        }
        return null;
      });

      const userResults = await Promise.all(userPromises);
      const newUserCache = { ...userCache };
      userResults.forEach(result => {
        if (result && result.user) {
          newUserCache[result.id] = result.user;
        }
      });
      setUserCache(newUserCache);

      // Fetch branches
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
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = useMemo(() => {
    return leaveRequests.filter(request => {
      // Status filter - operational manager only sees pending requests by default
      if (statusFilter !== 'all' && request.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const employeeName = getEmployeeName(request.employeeId).toLowerCase();
        const branchName = getBranchName(request.branchId).toLowerCase();
        if (!employeeName.includes(searchLower) && !branchName.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }, [leaveRequests, searchTerm, statusFilter]);

  const getEmployeeName = (employeeId) => {
    const user = userCache[employeeId];
    return user ? getFullName(user) : 'Unknown';
  };

  const getBranchName = (branchId) => {
    const branch = branchCache[branchId];
    return branch ? (branch.branchName || branch.name) : 'Unknown Branch';
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

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return badges[status] || badges.pending;
  };

  const pendingRequests = filteredRequests.filter(r => r.status === 'pending');

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
          <h1 className="text-2xl font-bold text-gray-900">Branch Manager Leave Management</h1>
          <p className="text-gray-600">Review and approve leave requests from branch managers</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">{pendingRequests.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total</div>
          <div className="text-2xl font-bold text-gray-900">{filteredRequests.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or branch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Leave Requests List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Leave Requests</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredRequests.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No leave requests found
            </div>
          ) : (
            filteredRequests.map(request => {
              const typeInfo = getLeaveTypeInfo(request.type);
              const employeeName = getEmployeeName(request.employeeId);
              const branchName = getBranchName(request.branchId);
              const isPending = request.status === 'pending';

              return (
                <div key={request.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="w-5 h-5 text-gray-400" />
                        <span className="font-semibold">{employeeName}</span>
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{branchName}</span>
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
                    {isPending && (
                      <div className="flex gap-2 ml-4">
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
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Reject Modal */}
      <RejectLeaveModal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedRequest(null);
        }}
        onConfirm={handleRejectConfirm}
      />
    </div>
  );
};

export default OperationalManagerLeaveManagement;



















