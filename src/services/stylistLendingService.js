/**
 * Stylist Lending Service
 * Handles lending stylists between branches
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { logActivity } from './activityService';
import toast from 'react-hot-toast';

/**
 * Request help (a stylist) from another branch
 * @param {string} stylistId - Stylist user ID (optional, for tracking purposes)
 * @param {string} fromBranchId - Branch that will PROVIDE the stylist (source branch)
 * @param {string} toBranchId - Branch that NEEDS help (requesting branch, destination)
 * @param {string} startDate - Start date (ISO string)
 * @param {string} endDate - End date (ISO string)
 * @param {string} reason - Reason for requesting help (optional)
 * @param {Object} currentUser - User making the request
 * @returns {Promise<string>} Lending request ID
 */
export const requestLendStylist = async (
  stylistId,
  fromBranchId,
  toBranchId,
  startDate,
  endDate,
  reason,
  currentUser
) => {
  try {
    const lendingRef = collection(db, 'stylist_lending');
    
    const lendingData = {
      stylistId,
      fromBranchId,
      toBranchId,
      startDate: Timestamp.fromDate(new Date(startDate)),
      endDate: Timestamp.fromDate(new Date(endDate)),
      reason: reason || '',
      status: 'pending', // 'pending', 'approved', 'rejected', 'active', 'completed', 'cancelled'
      requestedBy: currentUser.uid,
      requestedByName: currentUser.displayName || currentUser.email || 'Unknown',
      requestedAt: Timestamp.now(),
      approvedBy: null,
      approvedAt: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await addDoc(lendingRef, lendingData);

    // Log activity at the requesting branch (toBranchId)
    await logActivity({
      action: 'stylist_lending_requested',
      performedBy: currentUser.uid,
      branchId: toBranchId, // Requesting branch
      details: {
        stylistId,
        fromBranchId, // Branch providing help
        toBranchId, // Branch requesting help
        startDate,
        endDate,
        requestId: docRef.id
      }
    });

    toast.success('Help request submitted! The branch will receive your request.');
    return docRef.id;
  } catch (error) {
    console.error('Error requesting stylist lending:', error);
    toast.error('Failed to submit lending request');
    throw error;
  }
};

/**
 * Get all lending requests for a branch (as source or destination)
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of lending requests
 */
export const getLendingRequests = async (branchId) => {
  try {
    const lendingRef = collection(db, 'stylist_lending');
    
    // Get requests where this branch is the source or destination
    const fromQuery = query(lendingRef, where('fromBranchId', '==', branchId));
    const toQuery = query(lendingRef, where('toBranchId', '==', branchId));
    
    const [fromSnapshot, toSnapshot] = await Promise.all([
      getDocs(fromQuery),
      getDocs(toQuery)
    ]);

    const requests = [];
    
    fromSnapshot.forEach(doc => {
      requests.push({
        id: doc.id,
        ...doc.data(),
        type: 'incoming', // This branch will provide help (fromBranchId = this branch)
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        requestedAt: doc.data().requestedAt?.toDate(),
        approvedAt: doc.data().approvedAt?.toDate(),
        rejectedAt: doc.data().rejectedAt?.toDate(),
        cancelledAt: doc.data().cancelledAt?.toDate()
      });
    });

    toSnapshot.forEach(doc => {
      // Avoid duplicates if somehow a request has same from and to
      if (!requests.find(r => r.id === doc.id)) {
        requests.push({
          id: doc.id,
          ...doc.data(),
          type: 'outgoing', // This branch requested help (toBranchId = this branch)
          startDate: doc.data().startDate?.toDate(),
          endDate: doc.data().endDate?.toDate(),
          requestedAt: doc.data().requestedAt?.toDate(),
          approvedAt: doc.data().approvedAt?.toDate(),
          rejectedAt: doc.data().rejectedAt?.toDate(),
          cancelledAt: doc.data().cancelledAt?.toDate()
        });
      }
    });

    // Sort by requested date (newest first)
    requests.sort((a, b) => {
      if (!a.requestedAt || !b.requestedAt) return 0;
      return b.requestedAt.getTime() - a.requestedAt.getTime();
    });

    return requests;
  } catch (error) {
    console.error('Error fetching lending requests:', error);
    throw error;
  }
};

/**
 * Approve a lending request
 * @param {string} requestId - Lending request ID
 * @param {Object} currentUser - User approving the request
 * @param {string} stylistId - Optional: Stylist ID to assign (if request was for "any available")
 * @returns {Promise<void>}
 */
export const approveLendingRequest = async (requestId, currentUser, stylistId = null) => {
  try {
    const requestRef = doc(db, 'stylist_lending', requestId);
    
    const updateData = {
      status: 'approved',
      approvedBy: currentUser.uid,
      approvedByName: currentUser.displayName || currentUser.email || 'Unknown',
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    // If stylistId is provided and request didn't have one, update it
    if (stylistId) {
      updateData.stylistId = stylistId;
    }
    
    await updateDoc(requestRef, updateData);

    // Log activity - get the request data first
    const requestDoc = await getDoc(requestRef);
    if (requestDoc.exists()) {
      const requestData = requestDoc.data();
      await logActivity({
        action: 'stylist_lending_approved',
        performedBy: currentUser.uid,
        branchId: requestData.fromBranchId, // Branch that approved (providing help)
        details: {
          requestId,
          stylistId: requestData.stylistId,
          fromBranchId: requestData.fromBranchId, // Providing branch
          toBranchId: requestData.toBranchId // Receiving help branch
        }
      });
    }

    toast.success('Lending request approved!');
  } catch (error) {
    console.error('Error approving lending request:', error);
    toast.error('Failed to approve lending request');
    throw error;
  }
};

/**
 * Reject a lending request
 * @param {string} requestId - Lending request ID
 * @param {string} reason - Rejection reason (optional)
 * @param {Object} currentUser - User rejecting the request
 * @returns {Promise<void>}
 */
export const rejectLendingRequest = async (requestId, reason, currentUser) => {
  try {
    const requestRef = doc(db, 'stylist_lending', requestId);
    
    await updateDoc(requestRef, {
      status: 'rejected',
      rejectionReason: reason || '',
      rejectedBy: currentUser.uid,
      rejectedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    toast.success('Lending request rejected');
  } catch (error) {
    console.error('Error rejecting lending request:', error);
    toast.error('Failed to reject lending request');
    throw error;
  }
};

/**
 * Cancel a lending request
 * @param {string} requestId - Lending request ID
 * @param {Object} currentUser - User cancelling the request
 * @returns {Promise<void>}
 */
export const cancelLendingRequest = async (requestId, currentUser) => {
  try {
    const requestRef = doc(db, 'stylist_lending', requestId);
    
    await updateDoc(requestRef, {
      status: 'cancelled',
      cancelledBy: currentUser.uid,
      cancelledAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    toast.success('Lending request cancelled');
  } catch (error) {
    console.error('Error cancelling lending request:', error);
    toast.error('Failed to cancel lending request');
    throw error;
  }
};

/**
 * Get active lending for a stylist
 * @param {string} stylistId - Stylist user ID
 * @param {Date} date - Date to check (defaults to today)
 * @returns {Promise<Object|null>} Active lending request or null
 */
export const getActiveLending = async (stylistId, date = new Date()) => {
  try {
    const lendingRef = collection(db, 'stylist_lending');
    
    // Query for approved and active statuses separately
    const approvedQuery = query(
      lendingRef,
      where('stylistId', '==', stylistId),
      where('status', '==', 'approved')
    );
    const activeQuery = query(
      lendingRef,
      where('stylistId', '==', stylistId),
      where('status', '==', 'active')
    );
    
    const [approvedSnapshot, activeSnapshot] = await Promise.all([
      getDocs(approvedQuery),
      getDocs(activeQuery)
    ]);
    
    const allDocs = [...approvedSnapshot.docs, ...activeSnapshot.docs];
    
    for (const doc of allDocs) {
      const data = doc.data();
      const startDate = data.startDate?.toDate();
      const endDate = data.endDate?.toDate();
      
      if (startDate && endDate) {
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        
        if (checkDate >= startDate && checkDate <= endDate) {
          return {
            id: doc.id,
            ...data,
            startDate,
            endDate
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting active lending:', error);
    return null;
  }
};

/**
 * Get all active lending requests for a branch (staff currently lent TO this branch)
 * @param {string} branchId - Branch ID (receiving branch)
 * @param {Date} date - Date to check (defaults to today). If null, returns all approved/active requests
 * @returns {Promise<Array>} Array of active lending requests with stylist info
 */
export const getActiveLendingForBranch = async (branchId, date = new Date()) => {
  try {
    const lendingRef = collection(db, 'stylist_lending');
    
    // Get all approved/active requests where this branch is the receiving branch
    const approvedQuery = query(
      lendingRef,
      where('toBranchId', '==', branchId),
      where('status', '==', 'approved')
    );
    const activeQuery = query(
      lendingRef,
      where('toBranchId', '==', branchId),
      where('status', '==', 'active')
    );
    
    const [approvedSnapshot, activeSnapshot] = await Promise.all([
      getDocs(approvedQuery),
      getDocs(activeQuery)
    ]);
    
    const allDocs = [...approvedSnapshot.docs, ...activeSnapshot.docs];
    const activeLendings = [];
    
    // If date is null, return all approved/active requests without date filtering
    const shouldFilterByDate = date !== null;
    const checkDate = shouldFilterByDate ? new Date(date) : null;
    if (checkDate) {
      checkDate.setHours(0, 0, 0, 0);
    }
    
    for (const doc of allDocs) {
      const data = doc.data();
      const startDate = data.startDate?.toDate();
      const endDate = data.endDate?.toDate();
      
      if (startDate && endDate) {
        const normalizedStartDate = new Date(startDate);
        normalizedStartDate.setHours(0, 0, 0, 0);
        const normalizedEndDate = new Date(endDate);
        normalizedEndDate.setHours(0, 0, 0, 0);
        
        // If date filtering is disabled, include all requests
        // Otherwise, check if the date falls within the lending period
        if (!shouldFilterByDate || (checkDate >= normalizedStartDate && checkDate <= normalizedEndDate)) {
          activeLendings.push({
            id: doc.id,
            ...data,
            startDate: normalizedStartDate,
            endDate: normalizedEndDate,
            stylistId: data.stylistId,
            fromBranchId: data.fromBranchId
          });
        }
      }
    }
    
    return activeLendings;
  } catch (error) {
    console.error('Error getting active lending for branch:', error);
    return [];
  }
};

/**
 * Get all active lending requests where staff FROM this branch are lent out
 * @param {string} branchId - Branch ID (source branch)
 * @param {Date} date - Date to check (defaults to today). If null, returns all approved/active requests
 * @returns {Promise<Array>} Array of active lending requests
 */
export const getActiveLendingFromBranch = async (branchId, date = new Date()) => {
  try {
    const lendingRef = collection(db, 'stylist_lending');
    
    // Get all approved/active requests where this branch is the source branch
    const approvedQuery = query(
      lendingRef,
      where('fromBranchId', '==', branchId),
      where('status', '==', 'approved')
    );
    const activeQuery = query(
      lendingRef,
      where('fromBranchId', '==', branchId),
      where('status', '==', 'active')
    );
    
    const [approvedSnapshot, activeSnapshot] = await Promise.all([
      getDocs(approvedQuery),
      getDocs(activeQuery)
    ]);
    
    const allDocs = [...approvedSnapshot.docs, ...activeSnapshot.docs];
    const activeLendings = [];
    
    // If date is null, return all approved/active requests without date filtering
    const shouldFilterByDate = date !== null;
    const checkDate = shouldFilterByDate ? new Date(date) : null;
    if (checkDate) {
      checkDate.setHours(0, 0, 0, 0);
    }
    
    for (const doc of allDocs) {
      const data = doc.data();
      const startDate = data.startDate?.toDate();
      const endDate = data.endDate?.toDate();
      
      if (startDate && endDate) {
        const normalizedStartDate = new Date(startDate);
        normalizedStartDate.setHours(0, 0, 0, 0);
        const normalizedEndDate = new Date(endDate);
        normalizedEndDate.setHours(0, 0, 0, 0);
        
        // If date filtering is disabled, include all requests
        // Otherwise, check if the date falls within the lending period
        if (!shouldFilterByDate || (checkDate >= normalizedStartDate && checkDate <= normalizedEndDate)) {
          activeLendings.push({
            id: doc.id,
            ...data,
            startDate: normalizedStartDate,
            endDate: normalizedEndDate,
            stylistId: data.stylistId,
            toBranchId: data.toBranchId
          });
        }
      }
    }
    
    return activeLendings;
  } catch (error) {
    console.error('Error getting active lending from branch:', error);
    return [];
  }
};

