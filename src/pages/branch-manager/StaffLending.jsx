/**
 * Staff Lending Management Page
 * View and manage stylist lending requests
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowRight, ArrowLeft, CheckCircle, XCircle, Clock, Building2, User, Calendar, Plus, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { getLendingRequests, approveLendingRequest, rejectLendingRequest, cancelLendingRequest } from '../../services/stylistLendingService';
import { getBranchById } from '../../services/branchService';
import { getUserById } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import { formatDate, getFullName } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import LendStylistModal from '../../components/branch/LendStylistModal';
import ApproveLendingModal from '../../components/branch/ApproveLendingModal';
import toast from 'react-hot-toast';

const StaffLending = () => {
  const { currentUser, userBranch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [processing, setProcessing] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [branchCache, setBranchCache] = useState({});
  const [stylistCache, setStylistCache] = useState({});
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [requestToApprove, setRequestToApprove] = useState(null);
  
  // Big Data Optimizations
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'approved', 'rejected', 'active', 'completed', 'cancelled'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'incoming', 'outgoing'
  const [sortBy, setSortBy] = useState('requestedAt'); // 'requestedAt', 'startDate', 'status'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [visibleEndIndex, setVisibleEndIndex] = useState(10);

  useEffect(() => {
    if (userBranch) {
      fetchRequests();
    }
  }, [userBranch]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
      setVisibleStartIndex(0);
      setVisibleEndIndex(itemsPerPage);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, itemsPerPage]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const lendingRequests = await getLendingRequests(userBranch);
      setRequests(lendingRequests);
      
      // Fetch branch and stylist info
      const branchIds = new Set();
      const stylistIds = new Set();
      
      lendingRequests.forEach(req => {
        if (req.fromBranchId) branchIds.add(req.fromBranchId);
        if (req.toBranchId) branchIds.add(req.toBranchId);
        if (req.stylistId) stylistIds.add(req.stylistId);
      });

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

      // Fetch stylists
      const stylistPromises = Array.from(stylistIds).map(async (id) => {
        if (!stylistCache[id]) {
          try {
            const stylist = await getUserById(id);
            return { id, stylist };
          } catch (error) {
            return { id, stylist: null };
          }
        }
        return null;
      });
      
      const stylistResults = await Promise.all(stylistPromises);
      const newStylistCache = { ...stylistCache };
      stylistResults.forEach(result => {
        if (result && result.stylist) {
          newStylistCache[result.id] = result.stylist;
        }
      });
      setStylistCache(newStylistCache);
    } catch (error) {
      console.error('Error fetching lending requests:', error);
      toast.error('Failed to load lending requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (request) => {
    // Open approval modal instead of directly approving
    setRequestToApprove(request);
    setShowApproveModal(true);
  };
  
  const handleApproveComplete = async () => {
    await fetchRequests();
    setShowApproveModal(false);
    setRequestToApprove(null);
  };

  const handleReject = (request) => {
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!selectedRequest) return;
    
    try {
      setProcessing(selectedRequest.id);
      await rejectLendingRequest(selectedRequest.id, rejectionReason, currentUser);
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectionReason('');
      await fetchRequests();
    } catch (error) {
      // Error handled in service
    } finally {
      setProcessing(null);
    }
  };

  const handleCancel = async (request) => {
    if (!confirm('Are you sure you want to cancel this lending request?')) return;
    
    try {
      setProcessing(request.id);
      await cancelLendingRequest(request.id, currentUser);
      await fetchRequests();
    } catch (error) {
      // Error handled in service
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      active: 'bg-blue-100 text-blue-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    if (status === 'approved') return <CheckCircle className="w-4 h-4" />;
    if (status === 'rejected') return <XCircle className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  // Memoized filtered and sorted requests
  const filteredRequests = useMemo(() => {
    let filtered = [...requests];

    // Search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(req => {
        const stylist = stylistCache[req.stylistId];
        const stylistName = stylist ? getFullName(stylist).toLowerCase() : '';
        const stylistEmail = stylist?.email?.toLowerCase() || '';
        const branch = branchCache[req.fromBranchId] || branchCache[req.toBranchId];
        const branchName = branch?.branchName?.toLowerCase() || branch?.name?.toLowerCase() || '';
        const reason = req.reason?.toLowerCase() || '';
        const status = req.status?.toLowerCase() || '';
        
        return stylistName.includes(searchLower) ||
               stylistEmail.includes(searchLower) ||
               branchName.includes(searchLower) ||
               reason.includes(searchLower) ||
               status.includes(searchLower);
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(req => req.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(req => req.type === typeFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      if (sortBy === 'requestedAt') {
        aValue = a.requestedAt?.toDate ? a.requestedAt.toDate() : new Date(a.requestedAt || 0);
        bValue = b.requestedAt?.toDate ? b.requestedAt.toDate() : new Date(b.requestedAt || 0);
      } else if (sortBy === 'startDate') {
        aValue = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate || 0);
        bValue = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate || 0);
      } else {
        aValue = a[sortBy] || '';
        bValue = b[sortBy] || '';
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [requests, debouncedSearchTerm, statusFilter, typeFilter, sortBy, sortOrder, branchCache, stylistCache]);

  // Paginated requests
  const paginatedRequests = useMemo(() => {
    return filteredRequests.slice(visibleStartIndex, visibleEndIndex);
  }, [filteredRequests, visibleStartIndex, visibleEndIndex]);

  // Calculate pagination info
  const totalPages = useMemo(() => {
    return Math.ceil(filteredRequests.length / itemsPerPage);
  }, [filteredRequests.length, itemsPerPage]);

  const currentPageNumber = useMemo(() => {
    return Math.floor(visibleStartIndex / itemsPerPage) + 1;
  }, [visibleStartIndex, itemsPerPage]);

  // Load more items
  const loadMore = useCallback(() => {
    if (visibleEndIndex < filteredRequests.length) {
      setVisibleEndIndex(prev => Math.min(prev + itemsPerPage, filteredRequests.length));
    }
  }, [filteredRequests.length, itemsPerPage, visibleEndIndex]);

  // Navigate pages
  const goToPage = useCallback((page) => {
    const start = (page - 1) * itemsPerPage;
    setVisibleStartIndex(start);
    setVisibleEndIndex(Math.min(start + itemsPerPage, filteredRequests.length));
    setCurrentPage(page);
  }, [itemsPerPage, filteredRequests.length]);

  // Reset filters
  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
    setSortBy('requestedAt');
    setSortOrder('desc');
    setCurrentPage(1);
    setVisibleStartIndex(0);
    setVisibleEndIndex(itemsPerPage);
  }, [itemsPerPage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const incomingRequests = requests.filter(r => r.type === 'incoming');
  const outgoingRequests = requests.filter(r => r.type === 'outgoing');
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const myPendingRequests = pendingRequests.filter(r => r.type === 'outgoing'); // My pending requests

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Lending Requests</h1>
          <p className="text-gray-600 mt-1">
            Request help from other branches. Approve incoming requests from branches that need your stylists.
          </p>
        </div>
        <button
          onClick={() => setShowRequestModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Request Help From Another Branch
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by stylist, branch, reason, or status..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
                setVisibleStartIndex(0);
                setVisibleEndIndex(itemsPerPage);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
                setVisibleStartIndex(0);
                setVisibleEndIndex(itemsPerPage);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="incoming">Incoming</option>
              <option value="outgoing">Outgoing</option>
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="requestedAt">Sort by Date</option>
              <option value="startDate">Sort by Start Date</option>
              <option value="status">Sort by Status</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? 'Γåæ' : 'Γåô'}
            </button>
          </div>

          {/* Reset */}
          {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && (
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        {/* Results Count */}
        <div className="mt-3 text-sm text-gray-600">
          Showing <span className="font-medium">{visibleStartIndex + 1}</span> to{' '}
          <span className="font-medium">{Math.min(visibleEndIndex, filteredRequests.length)}</span> of{' '}
          <span className="font-medium">{filteredRequests.length}</span> requests
          {filteredRequests.length !== requests.length && (
            <span className="text-gray-400"> (filtered from {requests.length} total)</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Incoming Requests</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{incomingRequests.length}</p>
            </div>
            <ArrowRight className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Outgoing Requests</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{outgoingRequests.length}</p>
            </div>
            <ArrowLeft className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className={`rounded-lg p-4 border-2 ${myPendingRequests.length > 0 ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">My Pending Requests</p>
              <p className={`text-2xl font-bold mt-1 ${myPendingRequests.length > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
                {myPendingRequests.length}
              </p>
            </div>
            <Clock className={`w-8 h-8 ${myPendingRequests.length > 0 ? 'text-yellow-600' : 'text-gray-400'}`} />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {requests.filter(r => r.status === 'approved' || r.status === 'active').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Two Column Layout: Pending Request | Incoming Request */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Pending Request */}
        <div className="bg-white rounded-lg border-2 border-yellow-300 shadow-sm">
          <div className="bg-yellow-50 border-b-2 border-yellow-300 p-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              Pending Request
              <span className="ml-auto px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full text-xs font-medium">
                {myPendingRequests.length}
              </span>
            </h2>
            <p className="text-sm text-gray-600 mt-1">Your requests waiting for approval</p>
          </div>
          <div className="p-4 max-h-[800px] overflow-y-auto">
            {myPendingRequests.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">You have no pending requests</p>
                <p className="text-sm text-gray-400 mt-1">All your requests have been processed</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myPendingRequests.map((request) => {
                  const providingBranch = branchCache[request.fromBranchId]; // Branch that will provide help
                  const stylist = stylistCache[request.stylistId];
                  
                  return (
                    <div key={request.id} className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 bg-yellow-100 text-yellow-800">
                              <Clock className="w-3 h-3" />
                              Pending
                            </span>
                            {stylist && (
                              <div className="flex items-center gap-2 min-w-0">
                                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {getFullName(stylist)}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">{stylist?.email}</p>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2 mb-3">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Requesting From Branch</p>
                              <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                <Building2 className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{providingBranch?.branchName || providingBranch?.name || 'Unknown Branch'}</span>
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Start Date</p>
                                <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                                  <Calendar className="w-3 h-3 flex-shrink-0" />
                                  <span className="text-xs">{request.startDate ? formatDate(request.startDate, 'MMM dd, yyyy') : 'N/A'}</span>
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">End Date</p>
                                <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                                  <Calendar className="w-3 h-3 flex-shrink-0" />
                                  <span className="text-xs">{request.endDate ? formatDate(request.endDate, 'MMM dd, yyyy') : 'N/A'}</span>
                                </p>
                              </div>
                            </div>
                            {request.reason && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Reason</p>
                                <p className="text-sm text-gray-700 line-clamp-2">{request.reason}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex-shrink-0">
                          <button
                            onClick={() => handleCancel(request)}
                            disabled={processing === request.id}
                            className="flex items-center gap-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            title="Cancel Request"
                          >
                            <XCircle className="w-4 h-4" />
                            <span className="hidden sm:inline">Cancel</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Incoming Request */}
        <div className="bg-white rounded-lg border-2 border-blue-300 shadow-sm">
          <div className="bg-blue-50 border-b-2 border-blue-300 p-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-blue-600" />
              Incoming Request
              <span className="ml-auto px-2 py-1 bg-blue-200 text-blue-800 rounded-full text-xs font-medium">
                {incomingRequests.filter(r => r.status === 'pending').length}
              </span>
            </h2>
            <p className="text-sm text-gray-600 mt-1">Requests from branches needing your stylists</p>
          </div>
          <div className="p-4 max-h-[800px] overflow-y-auto">
            {(() => {
              const pendingIncoming = incomingRequests.filter(r => r.status === 'pending');
              return pendingIncoming.length === 0 ? (
                <div className="text-center py-12">
                  <ArrowRight className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No incoming requests</p>
                  <p className="text-sm text-gray-400 mt-1">No branches are requesting help at the moment</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingIncoming.map((request) => {
                    const requestingBranch = branchCache[request.toBranchId]; // Branch requesting help
                    const stylist = stylistCache[request.stylistId];
                    
                    return (
                      <div key={request.id} className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-3">
                              {stylist && (
                                <div className="flex items-center gap-2 min-w-0">
                                  <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                      {getFullName(stylist)}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">{stylist?.email}</p>
                                  </div>
                                </div>
                              )}
                              <span className={`ml-auto px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusBadge(request.status)}`}>
                                {getStatusIcon(request.status)}
                                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                              </span>
                            </div>
                            
                            <div className="space-y-2 mb-3">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Requesting Branch</p>
                                <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                  <Building2 className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{requestingBranch?.branchName || requestingBranch?.name || 'Unknown Branch'}</span>
                                </p>
                              </div>
                              {request.requestedByName && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Requested By</p>
                                  <p className="text-sm font-medium text-gray-900">{request.requestedByName}</p>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Start Date</p>
                                  <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                                    <Calendar className="w-3 h-3 flex-shrink-0" />
                                    <span className="text-xs">{request.startDate ? formatDate(request.startDate, 'MMM dd, yyyy') : 'N/A'}</span>
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">End Date</p>
                                  <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                                    <Calendar className="w-3 h-3 flex-shrink-0" />
                                    <span className="text-xs">{request.endDate ? formatDate(request.endDate, 'MMM dd, yyyy') : 'N/A'}</span>
                                  </p>
                                </div>
                              </div>
                              {request.reason && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Reason</p>
                                  <p className="text-sm text-gray-700 line-clamp-2">{request.reason}</p>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {request.status === 'pending' && (
                            <div className="flex flex-col gap-2 flex-shrink-0">
                              <button
                                onClick={() => handleApprove(request)}
                                disabled={processing === request.id}
                                className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                title="Review & Approve"
                              >
                                <CheckCircle className="w-4 h-4" />
                                <span className="hidden sm:inline">Approve</span>
                              </button>
                              <button
                                onClick={() => handleReject(request)}
                                disabled={processing === request.id}
                                className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                title="Reject"
                              >
                                <XCircle className="w-4 h-4" />
                                <span className="hidden sm:inline">Reject</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Outgoing Requests - Show all statuses except active/completed */}
      {(() => {
        // Filter outgoing requests, excluding active and completed (they're in a different section)
        const filteredOutgoing = filteredRequests.filter(r => 
          r.type === 'outgoing' && r.status !== 'active' && r.status !== 'completed'
        );
        return filteredOutgoing.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ArrowLeft className="w-5 h-5 text-purple-600" />
              Outgoing Requests (Your requests for help)
              <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                {filteredOutgoing.length}
              </span>
            </h2>
            <div className="space-y-4">
              {filteredOutgoing.slice(0, 50).map((request) => {
              const providingBranch = branchCache[request.fromBranchId]; // Branch that will provide help
              const stylist = stylistCache[request.stylistId];
              
              return (
                <div key={request.id} className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <User className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-semibold text-gray-900">
                            {stylist ? getFullName(stylist) : 'Unknown Stylist'}
                          </p>
                          <p className="text-sm text-gray-600">{stylist?.email}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusBadge(request.status)}`}>
                          {getStatusIcon(request.status)}
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Providing Branch (Will Send Stylist)</p>
                          <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            {providingBranch?.branchName || providingBranch?.name || 'Unknown Branch'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Requested At</p>
                          <p className="text-sm font-medium text-gray-900">
                            {request.requestedAt ? formatDate(request.requestedAt, 'MMM dd, yyyy HH:mm') : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Start Date</p>
                          <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {request.startDate ? formatDate(request.startDate, 'MMM dd, yyyy') : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-1">End Date</p>
                          <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {request.endDate ? formatDate(request.endDate, 'MMM dd, yyyy') : 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      {request.reason && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-500 mb-1">Reason</p>
                          <p className="text-sm text-gray-700">{request.reason}</p>
                        </div>
                      )}
                      
                      {request.status === 'approved' && request.approvedByName && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-500 mb-1">Approved By</p>
                          <p className="text-sm text-gray-700">{request.approvedByName}</p>
                        </div>
                      )}
                      
                      {request.status === 'rejected' && request.rejectionReason && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-500 mb-1">Rejection Reason</p>
                          <p className="text-sm text-red-700">{request.rejectionReason}</p>
                        </div>
                      )}
                    </div>
                    
                    {request.status === 'pending' && (
                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => handleCancel(request)}
                          disabled={processing === request.id}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
            {filteredOutgoing.length > 50 && (
              <div className="mt-4 text-center text-sm text-gray-500">
                Showing first 50 of {filteredOutgoing.length} outgoing requests. Use filters to narrow down results.
              </div>
            )}
          </div>
        );
      })()}

      {/* Accepted/Approved Requests Section */}
      {(() => {
        const approvedRequests = filteredRequests.filter(r => 
          r.status === 'approved' || r.status === 'active'
        );
        return approvedRequests.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Accepted/Approved Requests
              <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                {approvedRequests.length}
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Accepted Incoming Requests */}
              {(() => {
                const approvedIncoming = approvedRequests.filter(r => r.type === 'incoming');
                return approvedIncoming.length > 0 && (
                  <div>
                    <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-blue-600" />
                      Incoming Accepted ({approvedIncoming.length})
                    </h3>
                    <div className="space-y-3">
                      {approvedIncoming.slice(0, 10).map((request) => {
                        const requestingBranch = branchCache[request.toBranchId];
                        const stylist = stylistCache[request.stylistId];
                        
                        return (
                          <div key={request.id} className="bg-green-50 rounded-lg border border-green-200 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  {stylist && (
                                    <div className="flex items-center gap-2 min-w-0">
                                      <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                          {getFullName(stylist)}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  <span className={`ml-auto px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusBadge(request.status)}`}>
                                    {getStatusIcon(request.status)}
                                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-600">
                                    <Building2 className="w-3 h-3 inline mr-1" />
                                    {requestingBranch?.branchName || requestingBranch?.name || 'Unknown Branch'}
                                  </p>
                                  {request.approvedByName && (
                                    <p className="text-xs text-gray-600">
                                      Approved by: {request.approvedByName}
                                    </p>
                                  )}
                                  {request.approvedAt && (
                                    <p className="text-xs text-gray-500">
                                      {formatDate(request.approvedAt, 'MMM dd, yyyy HH:mm')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Accepted Outgoing Requests */}
              {(() => {
                const approvedOutgoing = approvedRequests.filter(r => r.type === 'outgoing');
                return approvedOutgoing.length > 0 && (
                  <div>
                    <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <ArrowLeft className="w-4 h-4 text-purple-600" />
                      Outgoing Accepted ({approvedOutgoing.length})
                    </h3>
                    <div className="space-y-3">
                      {approvedOutgoing.slice(0, 10).map((request) => {
                        const providingBranch = branchCache[request.fromBranchId];
                        const stylist = stylistCache[request.stylistId];
                        
                        return (
                          <div key={request.id} className="bg-green-50 rounded-lg border border-green-200 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  {stylist && (
                                    <div className="flex items-center gap-2 min-w-0">
                                      <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                          {getFullName(stylist)}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  <span className={`ml-auto px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusBadge(request.status)}`}>
                                    {getStatusIcon(request.status)}
                                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-600">
                                    <Building2 className="w-3 h-3 inline mr-1" />
                                    {providingBranch?.branchName || providingBranch?.name || 'Unknown Branch'}
                                  </p>
                                  {request.approvedByName && (
                                    <p className="text-xs text-gray-600">
                                      Approved by: {request.approvedByName}
                                    </p>
                                  )}
                                  {request.approvedAt && (
                                    <p className="text-xs text-gray-500">
                                      {formatDate(request.approvedAt, 'MMM dd, yyyy HH:mm')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
            {approvedRequests.length > 10 && (
              <p className="text-sm text-gray-500 text-center mt-2">
                Showing first 10 of {approvedRequests.length} accepted requests. Use filters to see more.
              </p>
            )}
          </div>
        );
      })()}

      {/* Rejected Requests Section */}
      {(() => {
        const rejectedRequests = filteredRequests.filter(r => r.status === 'rejected');
        return rejectedRequests.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Rejected Requests
              <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                {rejectedRequests.length}
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Rejected Incoming Requests */}
              {(() => {
                const rejectedIncoming = rejectedRequests.filter(r => r.type === 'incoming');
                return rejectedIncoming.length > 0 && (
                  <div>
                    <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-blue-600" />
                      Incoming Rejected ({rejectedIncoming.length})
                    </h3>
                    <div className="space-y-3">
                      {rejectedIncoming.slice(0, 10).map((request) => {
                        const requestingBranch = branchCache[request.toBranchId];
                        const stylist = stylistCache[request.stylistId];
                        
                        return (
                          <div key={request.id} className="bg-red-50 rounded-lg border border-red-200 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  {stylist && (
                                    <div className="flex items-center gap-2 min-w-0">
                                      <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                          {getFullName(stylist)}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  <span className={`ml-auto px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusBadge(request.status)}`}>
                                    {getStatusIcon(request.status)}
                                    Rejected
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-600">
                                    <Building2 className="w-3 h-3 inline mr-1" />
                                    {requestingBranch?.branchName || requestingBranch?.name || 'Unknown Branch'}
                                  </p>
                                  {request.rejectionReason && (
                                    <p className="text-xs text-red-700 mt-1">
                                      Reason: {request.rejectionReason}
                                    </p>
                                  )}
                                  {request.rejectedAt && (
                                    <p className="text-xs text-gray-500">
                                      {formatDate(request.rejectedAt, 'MMM dd, yyyy HH:mm')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Rejected Outgoing Requests */}
              {(() => {
                const rejectedOutgoing = rejectedRequests.filter(r => r.type === 'outgoing');
                return rejectedOutgoing.length > 0 && (
                  <div>
                    <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <ArrowLeft className="w-4 h-4 text-purple-600" />
                      Outgoing Rejected ({rejectedOutgoing.length})
                    </h3>
                    <div className="space-y-3">
                      {rejectedOutgoing.slice(0, 10).map((request) => {
                        const providingBranch = branchCache[request.fromBranchId];
                        const stylist = stylistCache[request.stylistId];
                        
                        return (
                          <div key={request.id} className="bg-red-50 rounded-lg border border-red-200 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  {stylist && (
                                    <div className="flex items-center gap-2 min-w-0">
                                      <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                          {getFullName(stylist)}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  <span className={`ml-auto px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusBadge(request.status)}`}>
                                    {getStatusIcon(request.status)}
                                    Rejected
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-600">
                                    <Building2 className="w-3 h-3 inline mr-1" />
                                    {providingBranch?.branchName || providingBranch?.name || 'Unknown Branch'}
                                  </p>
                                  {request.rejectionReason && (
                                    <p className="text-xs text-red-700 mt-1">
                                      Reason: {request.rejectionReason}
                                    </p>
                                  )}
                                  {request.rejectedAt && (
                                    <p className="text-xs text-gray-500">
                                      {formatDate(request.rejectedAt, 'MMM dd, yyyy HH:mm')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
            {rejectedRequests.length > 10 && (
              <p className="text-sm text-gray-500 text-center mt-2">
                Showing first 10 of {rejectedRequests.length} rejected requests. Use filters to see more.
              </p>
            )}
          </div>
        );
      })()}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Page {currentPageNumber} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPageNumber - 1)}
                disabled={currentPageNumber === 1}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              
              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPageNumber <= 3) {
                    pageNum = i + 1;
                  } else if (currentPageNumber >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPageNumber - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`px-3 py-2 border rounded-lg transition-colors ${
                        currentPageNumber === pageNum
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => goToPage(currentPageNumber + 1)}
                disabled={currentPageNumber === totalPages}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredRequests.length === 0 && requests.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Requests Found</h3>
          <p className="text-gray-500">Try adjusting your search or filters</p>
          <button
            onClick={resetFilters}
            className="mt-4 px-4 py-2 text-primary-600 hover:text-primary-700 font-medium"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Empty State - No requests at all */}
      {requests.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <ArrowRight className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Lending Requests</h3>
          <p className="text-gray-500">No stylist lending requests found.</p>
        </div>
      )}

      {/* Reject Modal */}
      <ConfirmModal
        isOpen={showRejectModal}
        onClose={() => {
          if (!processing) {
            setShowRejectModal(false);
            setSelectedRequest(null);
            setRejectionReason('');
          }
        }}
        onConfirm={confirmReject}
        title="Reject Lending Request"
        message={
          <div className="space-y-4">
            <p>Are you sure you want to reject this lending request?</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Rejection (Optional)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Provide a reason for rejection..."
              />
            </div>
          </div>
        }
        confirmText="Reject"
        cancelText="Cancel"
        type="danger"
        loading={processing === selectedRequest?.id}
      />

      {/* Request Help Modal */}
      <LendStylistModal
        isOpen={showRequestModal}
        stylist={null}
        requestingBranchId={userBranch}
        onClose={() => setShowRequestModal(false)}
        onSave={() => {
          fetchRequests();
          setShowRequestModal(false);
        }}
      />

      {/* Approve Lending Request Modal */}
      <ApproveLendingModal
        isOpen={showApproveModal}
        request={requestToApprove}
        onClose={() => {
          setShowApproveModal(false);
          setRequestToApprove(null);
        }}
        onSave={handleApproveComplete}
      />
    </div>
  );
};

export default StaffLending;

