/**
 * Branch Calendar Service
 * Manages holidays and special dates for branches (top-level collection)
 * Updated: Changed from subcollection to top-level collection with branchId field
 */

import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { logActivity } from './activityService';
import toast from 'react-hot-toast';

/**
 * Get all calendar entries for a branch
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of calendar entries
 */
export const getBranchCalendar = async (branchId) => {
  try {
    const calendarRef = collection(db, 'calendar');
    // Fetch all entries for branch
    const q = query(
      calendarRef,
      where('branchId', '==', branchId)
    );
    const snapshot = await getDocs(q);
    
    // Filter active reminders and sort by date
    const entries = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() // Convert Firestore Timestamp to Date
      }))
      .filter(entry => entry.status === 'active' || !entry.status) // Include active reminders or entries without status
      .sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return a.date.getTime() - b.date.getTime();
      });
    
    return entries;
  } catch (error) {
    console.error('Error fetching branch calendar:', error);
    throw error;
  }
};

/**
 * Get upcoming reminders
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of upcoming calendar reminders
 */
export const getUpcomingReminders = async (branchId) => {
  try {
    const today = Timestamp.fromDate(new Date());
    const calendarRef = collection(db, 'calendar');
    const q = query(
      calendarRef,
      where('branchId', '==', branchId),
      where('date', '>=', today),
      orderBy('date', 'asc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate()
      }))
      .filter(entry => entry.status === 'active' || !entry.status);
  } catch (error) {
    console.error('Error fetching upcoming reminders:', error);
    throw error;
  }
};

/**
 * Add or update a calendar entry
 * @param {string} branchId - Branch ID
 * @param {Object} entryData - Calendar entry data
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<string>} Entry ID
 */
export const saveBranchCalendarEntry = async (branchId, entryData, currentUser) => {
  try {
    const entryId = entryData.id || doc(collection(db, 'calendar')).id;
    const entryRef = doc(db, 'calendar', entryId);
    
    // Check if this is an update to an existing approved entry
    let existingData = null;
    if (entryData.id) {
      const existingDoc = await getDoc(entryRef);
      if (existingDoc.exists()) {
        existingData = existingDoc.data();
      }
    }
    
    const data = {
      branchId, // Add branchId to the document
      date: Timestamp.fromDate(new Date(entryData.date)),
      title: entryData.title,
      description: entryData.description || '',
      type: entryData.type || 'reminder', // 'reminder' only
      allDay: true, // Reminders are always all-day
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    };
    
    if (!entryData.id) {
      // New reminder entry - no approval needed
      data.createdAt = Timestamp.now();
      data.createdBy = currentUser.uid;
      data.status = 'active'; // Reminders are active immediately
    } else {
      // Update existing reminder
      if (existingData) {
        data.status = existingData.status || 'active';
      }
    }
    
    await setDoc(entryRef, data, { merge: true });
    
    // Log activity
    await logActivity({
      action: entryData.id ? 'branch_calendar_updated' : 'branch_calendar_requested',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        branchId,
        entryId,
        title: entryData.title,
        date: entryData.date,
        type: entryData.type,
        status: data.status
      }
    });
    
    toast.success(`Reminder ${entryData.id ? 'updated' : 'added'} successfully!`);
    return entryId;
  } catch (error) {
    console.error('Error saving calendar entry:', error);
    toast.error('Failed to save calendar entry');
    throw error;
  }
};

/**
 * Get pending calendar entries (for approval)
 * @returns {Promise<Array>} Array of pending calendar entries
 */
export const getPendingCalendarEntries = async () => {
  try {
    const calendarRef = collection(db, 'calendar');
    const q = query(
      calendarRef,
      where('status', '==', 'pending'),
      orderBy('date', 'asc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching pending calendar entries:', error);
    throw error;
  }
};

/**
 * Approve or reject a calendar entry
 * @param {string} entryId - Entry ID
 * @param {string} action - 'approve' or 'reject'
 * @param {string} reason - Optional reason for rejection
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<void>}
 */
export const approveRejectCalendarEntry = async (entryId, action, reason, currentUser) => {
  try {
    const entryRef = doc(db, 'calendar', entryId);
    const entryDoc = await getDoc(entryRef);
    
    if (!entryDoc.exists()) {
      throw new Error('Calendar entry not found');
    }
    
    const data = {
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedAt: Timestamp.now(),
      reviewedBy: currentUser.uid,
      reviewedByName: currentUser.displayName || currentUser.email || 'Unknown',
      rejectionReason: action === 'reject' ? reason : null
    };
    
    await setDoc(entryRef, data, { merge: true });
    
    // Log activity
    await logActivity({
      action: action === 'approve' ? 'calendar_entry_approved' : 'calendar_entry_rejected',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        entryId,
        title: entryDoc.data().title,
        action,
        reason: action === 'reject' ? reason : null
      }
    });
    
    toast.success(`Calendar entry ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
  } catch (error) {
    console.error(`Error ${action}ing calendar entry:`, error);
    toast.error(`Failed to ${action} calendar entry`);
    throw error;
  }
};

/**
 * Delete a calendar entry
 * @param {string} branchId - Branch ID
 * @param {string} entryId - Entry ID
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<void>}
 */
export const deleteBranchCalendarEntry = async (branchId, entryId, currentUser) => {
  try {
    const entryRef = doc(db, 'calendar', entryId);
    await deleteDoc(entryRef);
    
    // Log activity
    await logActivity({
      action: 'branch_calendar_deleted',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        branchId,
        entryId
      }
    });
    
    toast.success('Calendar entry deleted successfully!');
  } catch (error) {
    console.error('Error deleting calendar entry:', error);
    toast.error('Failed to delete calendar entry');
    throw error;
  }
};

/**
 * Get calendar entry types
 * @returns {Array<Object>} Array of entry types
 */
export const getCalendarEntryTypes = () => {
  return [
    { value: 'reminder', label: 'Reminder', color: 'bg-blue-100 text-blue-700' }
  ];
};
