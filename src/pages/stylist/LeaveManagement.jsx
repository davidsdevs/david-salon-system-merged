/**
 * Leave Management Page - Stylist
 * Request and view own leave requests
 */

import { useState, useEffect, useMemo } from 'react';
import { Calendar, Plus, Clock, User, Search, Filter, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getLeaveRequestsByEmployee, 
  saveLeaveRequest, 
  cancelLeaveRequest,
  LEAVE_TYPES 
} from '../../services/leaveManagementService';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import LeaveRequestModal from '../../components/leave/LeaveRequestModal';
import toast from 'react-hot-toast';

const StylistLeaveManagement = () => {
  const { currentUser, userBranch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [processing, setProcessing] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (currentUser?.uid) {
      fetchLeaveRequests();
    }
  }, [currentUser]);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const requests = await getLeaveRequestsByEmployee(currentUser.uid);
      setLeaveRequests(requests);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      // Service already shows toast, don't duplicate
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = useMemo(() => {
    return leaveRequests.filter(request => {
      // Search filter (not really needed for own requests, but included for consistency)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const typeLabel = LEAVE_TYPES.find(t => t.value === request.type)?.label || '';
        if (!typeLabel.toLowerCase().includes(searchLower) && 
            !request.reason?.toLowerCase().includes(searchLower)) {
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

      return true;
    });
  }, [leaveRequests, searchTerm, statusFilter, typeFilter]);

  const getLeaveTypeInfo = (type) => {
    return LEAVE_TYPES.find(t => t.value === type) || LEAVE_TYPES[0];
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

  const handleSubmitLeave = async (leaveData) => {
    try {
      await saveLeaveRequest({
        ...leaveData,
        employeeId: currentUser.uid,
        branchId: userBranch,
      }, currentUser);
      
      await fetchLeaveRequests();
      setShowRequestModal(false);
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

  const pendingRequests = filteredRequests.filter(r => r.status === 'pending');
  const approvedRequests = filteredRequests.filter(r => r.status === 'approved');
  const rejectedRequests = filteredRequests.filter(r => r.status === 'rejected');

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
          <h1 className="text-2xl font-bold text-gray-900">My Leave Requests</h1>
          <p className="text-gray-600">Request and manage your leave</p>
        </div>
        <button
          onClick={() => setShowRequestModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Request Leave
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">{pendingRequests.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Approved</div>
          <div className="text-2xl font-bold text-green-600">{approvedRequests.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Rejected</div>
          <div className="text-2xl font-bold text-red-600">{rejectedRequests.length}</div>
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
                placeholder="Search by type or reason..."
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
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Types</option>
            {LEAVE_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Leave Requests List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">My Leave Requests</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredRequests.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No leave requests found. Click "Request Leave" to create one.
            </div>
          ) : (
            filteredRequests.map(request => {
              const typeInfo = getLeaveTypeInfo(request.type);
              const isPending = request.status === 'pending';
              const canCancel = isPending;

              return (
                <div key={request.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="w-5 h-5 text-gray-400" />
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
                    {canCancel && (
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleCancel(request)}
                          disabled={processing === request.id}
                          className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancel
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

      {/* Request Modal */}
      <LeaveRequestModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        onSubmit={handleSubmitLeave}
        isForStaff={false}
        currentUserId={currentUser.uid}
      />
    </div>
  );
};

export default StylistLeaveManagement;







