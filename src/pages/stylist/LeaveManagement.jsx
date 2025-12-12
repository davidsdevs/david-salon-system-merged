/**
 * Leave Management Page - Stylist
 * Request and view own leave requests
 */

import { useState, useEffect, useMemo } from 'react';
import { Calendar, Plus, Clock, User, Search, Filter, XCircle, Edit, X, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState(null);
  const [requestToEdit, setRequestToEdit] = useState(null);
  const [processing, setProcessing] = useState(null);
  
  // Pagination
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [pageSize] = useState(20);
  
  // Filters - Default: show only pending and approved
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending-approved'); // Default filter
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedRequests, setExpandedRequests] = useState(new Set());

  useEffect(() => {
    if (currentUser?.uid) {
      fetchLeaveRequests(true);
    }
  }, [currentUser, statusFilter, typeFilter]);

  const fetchLeaveRequests = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setLeaveRequests([]);
        setLastDoc(null);
        setHasMore(false);
      } else {
        setLoadingMore(true);
      }

      const result = await getLeaveRequestsByEmployee(
        currentUser.uid,
        pageSize,
        reset ? null : lastDoc
      );

      if (reset) {
        setLeaveRequests(result.requests);
      } else {
        setLeaveRequests(prev => [...prev, ...result.requests]);
      }

      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const filteredRequests = useMemo(() => {
    let filtered = [...leaveRequests];

    // Apply status filter - Default: pending and approved
    if (statusFilter === 'pending-approved') {
      filtered = filtered.filter(r => r.status === 'pending' || r.status === 'approved');
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(request => {
        const typeLabel = LEAVE_TYPES.find(t => t.value === request.type)?.label || '';
        return typeLabel.toLowerCase().includes(searchLower) || 
               request.reason?.toLowerCase().includes(searchLower);
      });
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(r => r.type === typeFilter);
    }

    // Sort: pending first, then approved, then by requestedAt (newest first)
    const statusOrder = { pending: 1, approved: 2, rejected: 3, cancelled: 4 };
    filtered.sort((a, b) => {
      const aOrder = statusOrder[a.status] || 99;
      const bOrder = statusOrder[b.status] || 99;
      
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      
      // Same status, sort by requestedAt (newest first)
      const aTime = a.requestedAt?.getTime() || 0;
      const bTime = b.requestedAt?.getTime() || 0;
      return bTime - aTime;
    });

    return filtered;
  }, [leaveRequests, searchTerm, statusFilter, typeFilter]);

  const getLeaveTypeInfo = (type) => {
    return LEAVE_TYPES.find(t => t.value === type) || LEAVE_TYPES[0];
  };

  const handleCancelClick = (request) => {
    // Cannot cancel approved ones
    if (request.status === 'approved') {
      toast.error('Cannot cancel approved leave requests');
      return;
    }
    setRequestToCancel(request);
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async () => {
    if (!requestToCancel) return;
    
    try {
      setProcessing(requestToCancel.id);
      await cancelLeaveRequest(requestToCancel.id, currentUser);
      await fetchLeaveRequests(true);
      setShowCancelModal(false);
      setRequestToCancel(null);
      setProcessing(null);
    } catch (error) {
      setProcessing(null);
    }
  };

  const handleEditClick = (request) => {
    // Only allow editing pending requests
    if (request.status !== 'pending') {
      toast.error('Only pending requests can be edited');
      return;
    }
    setRequestToEdit(request);
    setShowRequestModal(true);
  };

  const handleSubmitLeave = async (leaveData) => {
    try {
      await saveLeaveRequest({
        ...leaveData,
        employeeId: currentUser.uid,
        branchId: userBranch,
      }, currentUser);
      
      await fetchLeaveRequests(true);
      setShowRequestModal(false);
      setRequestToEdit(null);
    } catch (error) {
      console.error('Error submitting leave:', error);
    }
  };

  const toggleExpand = (requestId) => {
    setExpandedRequests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
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

  const stats = useMemo(() => {
    return {
      pending: leaveRequests.filter(r => r.status === 'pending').length,
      approved: leaveRequests.filter(r => r.status === 'approved').length,
      rejected: leaveRequests.filter(r => r.status === 'rejected').length,
      cancelled: leaveRequests.filter(r => r.status === 'cancelled').length,
      total: leaveRequests.length,
    };
  }, [leaveRequests]);

  if (loading && leaveRequests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Leave Requests</h1>
          <p className="text-gray-600 mt-1">Request and manage your leave</p>
        </div>
        <button
          onClick={() => {
            setRequestToEdit(null);
            setShowRequestModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Request Leave
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm text-gray-600">Pending</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm text-gray-600">Approved</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{stats.approved}</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm text-gray-600">Rejected</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{stats.rejected}</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm text-gray-600">Cancelled</div>
          <div className="text-2xl font-bold text-gray-600 mt-1">{stats.cancelled}</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm text-gray-600">Total</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
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
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="pending-approved">Pending & Approved (Default)</option>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            {LEAVE_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Leave Requests List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Leave Requests</h2>
          <p className="text-sm text-gray-600 mt-1">
            Showing {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No leave requests found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || statusFilter !== 'pending-approved' || typeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Click "Request Leave" to create your first leave request'}
              </p>
              {!searchTerm && statusFilter === 'pending-approved' && typeFilter === 'all' && (
                <button
                  onClick={() => {
                    setRequestToEdit(null);
                    setShowRequestModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Request Leave
                </button>
              )}
            </div>
          ) : (
            <>
              {filteredRequests.map(request => {
                const typeInfo = getLeaveTypeInfo(request.type);
                const isPending = request.status === 'pending';
                const isExpanded = expandedRequests.has(request.id);
                const canEdit = isPending;
                const canCancel = isPending || request.status === 'rejected' || request.status === 'cancelled';

                return (
                  <div key={request.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(request.status)}`}>
                            {request.status === 'pending' && <Clock className="w-3 h-3" />}
                            {request.status === 'approved' && <Calendar className="w-3 h-3" />}
                            {request.status === 'rejected' && <XCircle className="w-3 h-3" />}
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">
                              {formatDate(request.startDate)} - {formatDate(request.endDate)}
                            </span>
                            <span className="text-gray-500">
                              ({request.days} day{request.days !== 1 ? 's' : ''})
                            </span>
                          </div>
                          
                          {request.reason && (
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Reason:</span> {request.reason}
                            </div>
                          )}
                          
                          <div className="text-xs text-gray-500">
                            Requested: {formatDate(request.requestedAt)}
                            {request.approvedAt && (
                              <> • Approved: {formatDate(request.approvedAt)}</>
                            )}
                            {request.rejectedAt && (
                              <> • Rejected: {formatDate(request.rejectedAt)}</>
                            )}
                            {request.cancelledAt && (
                              <> • Cancelled: {formatDate(request.cancelledAt)}</>
                            )}
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                            {request.status === 'rejected' && request.rejectionReason && (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs font-semibold text-red-800 mb-1">Rejection Reason:</p>
                                    <p className="text-sm text-red-700">{request.rejectionReason}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                            {request.approvedByName && (
                              <div className="text-xs text-gray-600">
                                <span className="font-medium">Approved by:</span> {request.approvedByName}
                              </div>
                            )}
                            {request.rejectedByName && (
                              <div className="text-xs text-gray-600">
                                <span className="font-medium">Rejected by:</span> {request.rejectedByName}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-start gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleExpand(request.id)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleEditClick(request)}
                            disabled={processing === request.id}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Edit Request"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {canCancel && (
                          <button
                            onClick={() => handleCancelClick(request)}
                            disabled={processing === request.id}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Cancel Request"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Load More */}
              {hasMore && (
                <div className="p-4 text-center border-t border-gray-200">
                  <button
                    onClick={() => fetchLeaveRequests(false)}
                    disabled={loadingMore}
                    className="px-4 py-2 text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Request/Edit Modal */}
      <LeaveRequestModal
        isOpen={showRequestModal}
        onClose={() => {
          setShowRequestModal(false);
          setRequestToEdit(null);
        }}
        onSubmit={handleSubmitLeave}
        isForStaff={false}
        currentUserId={currentUser?.uid}
        editRequest={requestToEdit}
      />

      {/* Cancel Confirmation Modal */}
      {showCancelModal && requestToCancel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Cancel Leave Request</h2>
              </div>
              
              <p className="text-gray-700 mb-6">
                Are you sure you want to cancel this leave request?
              </p>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="text-sm text-gray-600 space-y-1">
                  <div>
                    <span className="font-medium">Dates:</span>{' '}
                    {formatDate(requestToCancel.startDate)} - {formatDate(requestToCancel.endDate)}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span>{' '}
                    {getLeaveTypeInfo(requestToCancel.type).label}
                  </div>
                  {requestToCancel.reason && (
                    <div>
                      <span className="font-medium">Reason:</span> {requestToCancel.reason}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setRequestToCancel(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  No, Keep It
                </button>
                <button
                  onClick={handleCancelConfirm}
                  disabled={processing === requestToCancel.id}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing === requestToCancel.id ? 'Cancelling...' : 'Yes, Cancel Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StylistLeaveManagement;
