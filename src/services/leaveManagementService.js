/**
 * Leave Management Service
 * Handles all interactions with the leave_requests Firestore collection
 */

import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { logActivity } from './activityService';
import toast from 'react-hot-toast';

const LEAVE_COLLECTION = 'leave_requests';

/**
 * Leave Types
 */
export const LEAVE_TYPES = [
  { value: 'vacation', label: 'Vacation Leave', color: 'bg-blue-100 text-blue-700' },
  { value: 'sick', label: 'Sick Leave', color: 'bg-red-100 text-red-700' },
  { value: 'personal', label: 'Personal Leave', color: 'bg-purple-100 text-purple-700' },
  { value: 'emergency', label: 'Emergency Leave', color: 'bg-orange-100 text-orange-700' },
  { value: 'maternity', label: 'Maternity Leave', color: 'bg-pink-100 text-pink-700' },
  { value: 'paternity', label: 'Paternity Leave', color: 'bg-green-100 text-green-700' },
  { value: 'bereavement', label: 'Bereavement Leave', color: 'bg-gray-100 text-gray-700' },
  { value: 'undetermined', label: 'Undetermined Leave', color: 'bg-yellow-100 text-yellow-700' },
];

/**
 * Get all leave requests for a branch
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of leave requests
 */
export const getLeaveRequestsByBranch = async (branchId) => {
  try {
    // Try with orderBy first, fallback to without if index doesn't exist
    try {
      const q = query(
        collection(db, LEAVE_COLLECTION),
        where('branchId', '==', branchId),
        orderBy('startDate', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        requestedAt: doc.data().requestedAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate(),
        rejectedAt: doc.data().rejectedAt?.toDate(),
        cancelledAt: doc.data().cancelledAt?.toDate(),
      }));
    } catch (orderByError) {
      // If orderBy fails (index missing), fetch without it and sort in memory
      console.warn('OrderBy failed, fetching without orderBy:', orderByError);
      const q = query(
        collection(db, LEAVE_COLLECTION),
        where('branchId', '==', branchId)
      );
      const snapshot = await getDocs(q);
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        requestedAt: doc.data().requestedAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate(),
        rejectedAt: doc.data().rejectedAt?.toDate(),
        cancelledAt: doc.data().cancelledAt?.toDate(),
      }));
      
      // Sort by startDate descending
      return requests.sort((a, b) => {
        const aTime = a.startDate?.getTime() || 0;
        const bTime = b.startDate?.getTime() || 0;
        return bTime - aTime;
      });
    }
  } catch (error) {
    console.error('Error fetching leave requests by branch:', error);
    toast.error('Failed to load leave requests');
    throw error;
  }
};

/**
 * Get leave requests for a specific employee
 * @param {string} employeeId - Employee ID
 * @returns {Promise<Array>} Array of leave requests
 */
export const getLeaveRequestsByEmployee = async (employeeId) => {
  try {
    // Try with orderBy first, fallback to without if index doesn't exist
    try {
      const q = query(
        collection(db, LEAVE_COLLECTION),
        where('employeeId', '==', employeeId),
        orderBy('startDate', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        requestedAt: doc.data().requestedAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate(),
        rejectedAt: doc.data().rejectedAt?.toDate(),
        cancelledAt: doc.data().cancelledAt?.toDate(),
      }));
    } catch (orderByError) {
      // If orderBy fails (index missing), fetch without it and sort in memory
      console.warn('OrderBy failed for employee leave requests, fetching without orderBy:', orderByError.message);
      const q = query(
        collection(db, LEAVE_COLLECTION),
        where('employeeId', '==', employeeId)
      );
      const snapshot = await getDocs(q);
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        requestedAt: doc.data().requestedAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate(),
        rejectedAt: doc.data().rejectedAt?.toDate(),
        cancelledAt: doc.data().cancelledAt?.toDate(),
      }));
      
      // Sort by startDate descending in memory
      return requests.sort((a, b) => {
        const aTime = a.startDate?.getTime() || 0;
        const bTime = b.startDate?.getTime() || 0;
        return bTime - aTime;
      });
    }
  } catch (error) {
    console.error('Error fetching leave requests by employee:', error);
    toast.error('Failed to load employee leave requests');
    throw error;
  }
};

/**
 * Get all leave requests for branch managers (pending operational manager approval)
 * @returns {Promise<Array>} Array of leave requests
 */
export const getBranchManagerLeaveRequests = async () => {
  try {
    // Fetch all leave requests and filter in memory since Firestore queries might not have index
    const snapshot = await getDocs(collection(db, LEAVE_COLLECTION));
    const requests = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        requestedAt: doc.data().requestedAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate(),
        rejectedAt: doc.data().rejectedAt?.toDate(),
        cancelledAt: doc.data().cancelledAt?.toDate(),
      }))
      .filter(req => req.requiresOperationalApproval === true)
      .sort((a, b) => {
        const aTime = a.startDate?.getTime() || 0;
        const bTime = b.startDate?.getTime() || 0;
        return bTime - aTime;
      });
    return requests;
  } catch (error) {
    console.error('Error fetching branch manager leave requests:', error);
    toast.error('Failed to load branch manager leave requests');
    throw error;
  }
};

/**
 * Submit a new leave request or update an existing one
 * @param {Object} leaveData - Leave request data
 * @param {Object} currentUser - User submitting the request
 * @param {Object} currentUserData - Optional: Full user data with roles (for role checking)
 * @returns {Promise<string>} Leave request ID
 */
export const saveLeaveRequest = async (leaveData, currentUser, currentUserData = null) => {
  try {
    const requestId = leaveData.id || doc(collection(db, LEAVE_COLLECTION)).id;
    const requestRef = doc(db, LEAVE_COLLECTION, requestId);

    const start = leaveData.startDate instanceof Date ? leaveData.startDate : new Date(leaveData.startDate);
    const end = leaveData.endDate instanceof Date ? leaveData.endDate : new Date(leaveData.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    // Calculate number of days
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Get current user's data to check role
    const { getUserById } = await import('./userService');
    const requesterData = currentUserData || await getUserById(currentUser.uid);
    const isRequesterBranchManager = requesterData?.roles?.includes('branchManager') || 
                                      requesterData?.role === 'branchManager';
    
    // Check if this is a branch manager requesting leave for themselves (requires operational manager approval)
    const employeeData = await getUserById(leaveData.employeeId);
    const isEmployeeBranchManager = employeeData?.roles?.includes('branchManager') || 
                                    employeeData?.role === 'branchManager';
    const requiresOperationalApproval = isEmployeeBranchManager && leaveData.employeeId === currentUser.uid;

    // If branch manager is adding leave for staff (not themselves), auto-approve
    const isAddingForStaff = isRequesterBranchManager && leaveData.employeeId !== currentUser.uid;
    const autoApprove = isAddingForStaff && !leaveData.id; // Only auto-approve new requests, not updates

    // Determine status
    let status = leaveData.status || 'pending';
    if (autoApprove) {
      status = 'approved';
    }

    const data = {
      ...leaveData,
      employeeId: leaveData.employeeId,
      branchId: leaveData.branchId,
      startDate: Timestamp.fromDate(start),
      endDate: Timestamp.fromDate(end),
      type: leaveData.type,
      reason: leaveData.reason || '',
      days,
      status,
      requiresOperationalApproval: requiresOperationalApproval || false,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid,
    };

    if (!leaveData.id) {
      data.requestedAt = Timestamp.now();
      data.requestedBy = currentUser.uid;
      data.requestedByName = currentUser.displayName || currentUser.email || 'Unknown';
      
      // If auto-approved, set approval fields
      if (autoApprove) {
        data.approvedAt = Timestamp.now();
        data.approvedBy = currentUser.uid;
        data.approvedByName = currentUser.displayName || currentUser.email || 'Unknown';
      }
    }

    await setDoc(requestRef, data, { merge: true });

    await logActivity({
      action: autoApprove ? 'leave_request_approved' : (leaveData.id ? 'leave_request_updated' : 'leave_request_submitted'),
      performedBy: currentUser.uid,
      targetUser: leaveData.employeeId,
      details: {
        requestId,
        employeeId: leaveData.employeeId,
        branchId: leaveData.branchId,
        type: leaveData.type,
        status: data.status,
        startDate: leaveData.startDate,
        endDate: leaveData.endDate,
        autoApproved: autoApprove
      }
    });

    if (autoApprove) {
      toast.success('Leave request added and automatically approved!');
    } else {
      toast.success(`Leave request ${leaveData.id ? 'updated' : 'submitted'} successfully!`);
    }
    return requestId;
  } catch (error) {
    console.error('Error saving leave request:', error);
    toast.error('Failed to save leave request');
    throw error;
  }
};

/**
 * Approve a leave request
 * @param {string} requestId - Leave request ID
 * @param {Object} currentUser - User approving the request
 * @returns {Promise<void>}
 */
export const approveLeaveRequest = async (requestId, currentUser) => {
  try {
    const requestRef = doc(db, LEAVE_COLLECTION, requestId);
    await updateDoc(requestRef, {
      status: 'approved',
      approvedAt: Timestamp.now(),
      approvedBy: currentUser.uid,
      approvedByName: currentUser.displayName || currentUser.email || 'Unknown',
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid,
    });

    const requestDoc = await getDoc(requestRef);
    const requestData = requestDoc.data();

    await logActivity({
      action: 'leave_request_approved',
      performedBy: currentUser.uid,
      targetUser: requestData.employeeId,
      details: { requestId, status: 'approved' }
    });

    toast.success('Leave request approved!');
  } catch (error) {
    console.error('Error approving leave request:', error);
    toast.error('Failed to approve leave request');
    throw error;
  }
};

/**
 * Reject a leave request
 * @param {string} requestId - Leave request ID
 * @param {string} reason - Rejection reason
 * @param {Object} currentUser - User rejecting the request
 * @returns {Promise<void>}
 */
export const rejectLeaveRequest = async (requestId, reason, currentUser) => {
  try {
    const requestRef = doc(db, LEAVE_COLLECTION, requestId);
    await updateDoc(requestRef, {
      status: 'rejected',
      rejectedAt: Timestamp.now(),
      rejectedBy: currentUser.uid,
      rejectedByName: currentUser.displayName || currentUser.email || 'Unknown',
      rejectionReason: reason,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid,
    });

    const requestDoc = await getDoc(requestRef);
    const requestData = requestDoc.data();

    await logActivity({
      action: 'leave_request_rejected',
      performedBy: currentUser.uid,
      targetUser: requestData.employeeId,
      details: { requestId, status: 'rejected', reason }
    });

    toast.success('Leave request rejected!');
  } catch (error) {
    console.error('Error rejecting leave request:', error);
    toast.error('Failed to reject leave request');
    throw error;
  }
};

/**
 * Cancel a leave request
 * @param {string} requestId - Leave request ID
 * @param {Object} currentUser - User cancelling the request
 * @returns {Promise<void>}
 */
export const cancelLeaveRequest = async (requestId, currentUser) => {
  try {
    const requestRef = doc(db, LEAVE_COLLECTION, requestId);
    await updateDoc(requestRef, {
      status: 'cancelled',
      cancelledAt: Timestamp.now(),
      cancelledBy: currentUser.uid,
      cancelledByName: currentUser.displayName || currentUser.email || 'Unknown',
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid,
    });

    const requestDoc = await getDoc(requestRef);
    const requestData = requestDoc.data();

    await logActivity({
      action: 'leave_request_cancelled',
      performedBy: currentUser.uid,
      targetUser: requestData.employeeId,
      details: { requestId, status: 'cancelled' }
    });

    toast.success('Leave request cancelled!');
  } catch (error) {
    console.error('Error cancelling leave request:', error);
    toast.error('Failed to cancel leave request');
    throw error;
  }
};

/**
 * Delete a leave request
 * @param {string} requestId - Leave request ID
 * @param {Object} currentUser - User deleting the request
 * @returns {Promise<void>}
 */
export const deleteLeaveRequest = async (requestId, currentUser) => {
  try {
    const requestRef = doc(db, LEAVE_COLLECTION, requestId);
    await deleteDoc(requestRef);

    await logActivity({
      action: 'leave_request_deleted',
      performedBy: currentUser.uid,
      details: { requestId }
    });

    toast.success('Leave request deleted!');
  } catch (error) {
    console.error('Error deleting leave request:', error);
    toast.error('Failed to delete leave request');
    throw error;
  }
};

// Backward compatibility aliases
export const createLeaveRequest = saveLeaveRequest;
export const getLeaveRequests = getLeaveRequestsByBranch;
export const getEmployeeLeaveRequests = getLeaveRequestsByEmployee;
export const reviewLeaveRequest = async (leaveId, action, reason, currentUser) => {
  if (action === 'approve') {
    return approveLeaveRequest(leaveId, currentUser);
  } else {
    return rejectLeaveRequest(leaveId, reason, currentUser);
  }
};
export const getLeaveTypes = () => LEAVE_TYPES;
