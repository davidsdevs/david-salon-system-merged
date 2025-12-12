/**
 * Schedule Service
 * Handles schedule-related operations for staff shifts
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import toast from 'react-hot-toast';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

/**
 * Get all schedules for a branch
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of schedules
 */
export const getSchedulesByBranch = async (branchId) => {
  try {
    const schedulesRef = collection(db, 'schedules');
    const q = query(schedulesRef, where('branchId', '==', branchId));
    const snapshot = await getDocs(q);
    
    const schedules = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      schedules.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      });
    });
    
    return schedules;
  } catch (error) {
    console.error('Error fetching schedules:', error);
    throw error;
  }
};

/**
 * Get schedules for a specific employee
 * @param {string} employeeId - Employee ID
 * @param {string} branchId - Branch ID (optional, for filtering)
 * @returns {Promise<Array>} Array of schedules
 */
export const getSchedulesByEmployee = async (employeeId, branchId = null) => {
  try {
    const schedulesRef = collection(db, 'schedules');
    let q = query(schedulesRef, where('employeeId', '==', employeeId));
    
    if (branchId) {
      q = query(schedulesRef, 
        where('employeeId', '==', employeeId),
        where('branchId', '==', branchId)
      );
    }
    
    const snapshot = await getDocs(q);
    const schedules = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      schedules.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      });
    });
    
    return schedules;
  } catch (error) {
    console.error('Error fetching employee schedules:', error);
    throw error;
  }
};

/**
 * Create a new schedule
 * @param {Object} scheduleData - Schedule data
 * @param {string} scheduleData.branchId - Branch ID
 * @param {string} scheduleData.employeeId - Employee ID
 * @param {string} scheduleData.dayOfWeek - Day of week (Monday, Tuesday, etc.)
 * @param {string} scheduleData.startTime - Start time (HH:mm format)
 * @param {string} scheduleData.endTime - End time (HH:mm format)
 * @param {string} scheduleData.notes - Optional notes
 * @returns {Promise<string>} Schedule document ID
 */
export const createSchedule = async (scheduleData) => {
  try {
    const { branchId, employeeId, dayOfWeek, startTime, endTime, notes = '' } = scheduleData;
    
    // Validate day of week
    if (!DAYS_OF_WEEK.includes(dayOfWeek)) {
      throw new Error('Invalid day of week');
    }
    
    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      throw new Error('Invalid time format. Use HH:mm format (e.g., 09:00)');
    }
    
    // Validate start time is before end time
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    if (endMinutes <= startMinutes) {
      throw new Error('End time must be after start time');
    }
    
    const schedulesRef = collection(db, 'schedules');
    const newSchedule = {
      branchId,
      employeeId,
      dayOfWeek,
      startTime,
      endTime,
      notes: notes || '',
      isActive: true, // Mark as active by default
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    const docRef = await addDoc(schedulesRef, newSchedule);
    toast.success('Schedule created successfully');
    return docRef.id;
  } catch (error) {
    console.error('Error creating schedule:', error);
    toast.error(error.message || 'Failed to create schedule');
    throw error;
  }
};

/**
 * Update a schedule
 * @param {string} scheduleId - Schedule document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export const updateSchedule = async (scheduleId, updates) => {
  try {
    const scheduleRef = doc(db, 'schedules', scheduleId);
    
    // Validate day of week if provided
    if (updates.dayOfWeek && !DAYS_OF_WEEK.includes(updates.dayOfWeek)) {
      throw new Error('Invalid day of week');
    }
    
    // Validate time format if provided
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (updates.startTime && !timeRegex.test(updates.startTime)) {
      throw new Error('Invalid start time format. Use HH:mm format');
    }
    if (updates.endTime && !timeRegex.test(updates.endTime)) {
      throw new Error('Invalid end time format. Use HH:mm format');
    }
    
    // Validate start time is before end time if both are provided
    if (updates.startTime && updates.endTime) {
      const [startHour, startMin] = updates.startTime.split(':').map(Number);
      const [endHour, endMin] = updates.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      if (endMinutes <= startMinutes) {
        throw new Error('End time must be after start time');
      }
    }
    
    await updateDoc(scheduleRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
    
    toast.success('Schedule updated successfully');
  } catch (error) {
    console.error('Error updating schedule:', error);
    toast.error(error.message || 'Failed to update schedule');
    throw error;
  }
};

/**
 * Delete a schedule
 * @param {string} scheduleId - Schedule document ID
 * @returns {Promise<void>}
 */
export const deleteSchedule = async (scheduleId) => {
  try {
    const scheduleRef = doc(db, 'schedules', scheduleId);
    await deleteDoc(scheduleRef);
    toast.success('Schedule deleted successfully');
  } catch (error) {
    console.error('Error deleting schedule:', error);
    toast.error('Failed to delete schedule');
    throw error;
  }
};

/**
 * Get schedule for a specific day and employee
 * @param {string} employeeId - Employee ID
 * @param {string} dayOfWeek - Day of week
 * @param {string} branchId - Branch ID (optional)
 * @returns {Promise<Object|null>} Schedule object or null
 */
export const getScheduleForDay = async (employeeId, dayOfWeek, branchId = null) => {
  try {
    const schedulesRef = collection(db, 'schedules');
    let q = query(
      schedulesRef,
      where('employeeId', '==', employeeId),
      where('dayOfWeek', '==', dayOfWeek)
    );
    
    if (branchId) {
      q = query(
        schedulesRef,
        where('employeeId', '==', employeeId),
        where('dayOfWeek', '==', dayOfWeek),
        where('branchId', '==', branchId)
      );
    }
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate()
    };
  } catch (error) {
    console.error('Error fetching schedule for day:', error);
    return null;
  }
};

/**
 * Convert day key (lowercase, e.g., 'monday') to dayOfWeek (capitalized, e.g., 'Monday')
 * @param {string} dayKey - Day key in lowercase
 * @returns {string} Day of week in capitalized format
 */
export const convertDayKeyToDayOfWeek = (dayKey) => {
  if (!dayKey) return null;
  return dayKey.charAt(0).toUpperCase() + dayKey.slice(1).toLowerCase();
};

/**
 * Get all schedule configurations for a branch (active and inactive)
 * Returns all configurations sorted by startDate, with employee shifts extracted
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of all schedule configurations
 */
export const getScheduleConfigurationsByBranch = async (branchId) => {
  try {
    const schedulesRef = collection(db, 'schedules');
    const q = query(
      schedulesRef,
      where('branchId', '==', branchId)
    );
    
    const snapshot = await getDocs(q);
    const configurations = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      
      // Check if this is a branch-wide configuration (has shifts object, no employeeId)
      if (data.shifts && typeof data.shifts === 'object' && !data.employeeId) {
        // Try to find startDate from document level, or extract from shifts
        let startDate = null;
        if (data.startDate) {
          startDate = data.startDate?.toDate ? data.startDate.toDate() : (data.startDate instanceof Date ? data.startDate : new Date(data.startDate));
        } else {
          // Try to find startDate from within shifts (some structures store it per day)
          const allStartDates = [];
          Object.values(data.shifts).forEach(employeeShifts => {
            if (employeeShifts && typeof employeeShifts === 'object') {
              Object.values(employeeShifts).forEach(dayShift => {
                if (dayShift && dayShift.startDate) {
                  const sd = dayShift.startDate?.toDate ? dayShift.startDate.toDate() : 
                            (dayShift.startDate instanceof Date ? dayShift.startDate : new Date(dayShift.startDate));
                  allStartDates.push(sd);
                }
              });
            }
          });
          // Use the earliest startDate found, or fall back to createdAt
          if (allStartDates.length > 0) {
            startDate = new Date(Math.min(...allStartDates.map(d => d.getTime())));
          } else {
            startDate = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt));
          }
        }
        
        const config = {
          id: doc.id,
          ...data,
          startDate: startDate,
          // Note: endDate is not used - schedules are determined by startDate only
          isActive: data.isActive !== false,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt)),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt))
        };
        
        configurations.push(config);
      }
    });
    
    // Sort by startDate descending (newest first)
    const sorted = configurations.sort((a, b) => {
      const aTime = a.startDate?.getTime() || 0;
      const bTime = b.startDate?.getTime() || 0;
      return bTime - aTime;
    });
    
    return sorted;
  } catch (error) {
    console.error('Error fetching schedule configurations:', error);
    throw error;
  }
};

/**
 * Get the schedule configuration that applies to a specific date
 * Returns the configuration with the most recent startDate that is <= the target date
 * @param {Array} configs - Array of schedule configurations
 * @param {Date} targetDate - Date to find the applicable schedule for
 * @returns {Object|null} The applicable schedule configuration or null
 */
const getScheduleForDate = (configs, targetDate) => {
  if (!targetDate || !configs || configs.length === 0) return null;
  
  // Normalize target date to start of day for comparison
  const targetDateObj = new Date(targetDate);
  targetDateObj.setHours(0, 0, 0, 0);
  const targetTime = targetDateObj.getTime();
  
  // Filter configs that have startDate <= targetDate, then find the most recent one
  // Note: We include both active and inactive configs - the isActive flag doesn't matter for date-based lookup
  const applicableConfigs = configs
    .filter(c => {
      if (!c.startDate) {
        return false;
      }
      const configStartDate = new Date(c.startDate);
      configStartDate.setHours(0, 0, 0, 0);
      const configStartTime = configStartDate.getTime();
      return configStartTime <= targetTime;
    })
    .sort((a, b) => {
      const aTime = new Date(a.startDate).getTime();
      const bTime = new Date(b.startDate).getTime();
      return bTime - aTime; // Most recent first
    });
  
  return applicableConfigs.length > 0 ? applicableConfigs[0] : null;
};

/**
 * Get all schedule configurations for a branch (for date-based lookup)
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of all schedule configurations
 */
export const getAllScheduleConfigurations = async (branchId) => {
  return await getScheduleConfigurationsByBranch(branchId);
};

/**
 * Get active schedule configuration for a branch and extract shifts for a specific employee
 * Also includes any date-specific shifts for the requested week
 * For a given date, finds the schedule with the most recent startDate <= that date
 * @param {string} employeeId - Employee ID (optional, for filtering)
 * @param {string} branchId - Branch ID
 * @param {Date} weekStart - Optional: Start of week to filter date-specific shifts
 * @returns {Promise<Object>} Object with activeConfig, inactiveConfigs, and dateSpecificShifts
 */
export const getActiveSchedulesByEmployee = async (employeeId, branchId, weekStart = null) => {
  try {
    // Get all configurations for the branch
    const allConfigs = await getScheduleConfigurationsByBranch(branchId);
    
    // Find the configuration that applies to today (or weekStart if provided)
    const targetDate = weekStart || new Date();
    const activeConfig = getScheduleForDate(allConfigs, targetDate);
    
    // Get all other configurations (for UI display/history)
    // These are configs that don't apply to the target date
    const inactiveConfigs = allConfigs.filter(c => c.id !== activeConfig?.id);
    
    // Extract employee's shifts from active config
    // Try to find shifts by employeeId, and also check if there's a match with different ID format
    let employeeShifts = {};
    if (activeConfig && activeConfig.shifts) {
      // First try direct match
      if (activeConfig.shifts[employeeId]) {
        employeeShifts = activeConfig.shifts[employeeId];
      } else {
        // Try to find a partial match (in case IDs are stored differently)
        const availableIds = Object.keys(activeConfig.shifts);
        const matchingId = availableIds.find(id => 
          id === employeeId || 
          id.includes(employeeId) || 
          employeeId.includes(id)
        );
        
        if (matchingId) {
          employeeShifts = activeConfig.shifts[matchingId];
        }
      }
    }
    
    // Get date-specific shifts (still stored individually for now)
    // Fetch all date-specific shifts for the branch, then filter in JavaScript to avoid index requirement
    const schedulesRef = collection(db, 'schedules');
    const dateSpecificQuery = query(
      schedulesRef,
      where('branchId', '==', branchId)
    );
    
    const dateSpecificSnapshot = await getDocs(dateSpecificQuery);
    const dateSpecificShifts = [];
    const weekEnd = weekStart ? new Date(weekStart) : null;
    if (weekEnd) {
      weekEnd.setDate(weekEnd.getDate() + 6);
    }
    
    // Filter in JavaScript instead of using Firestore query
    dateSpecificSnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Only process date-specific shifts (has date field and matches employeeId)
      if (data.date && data.employeeId === employeeId) {
        const scheduleDate = data.date?.toDate ? data.date.toDate() : (data.date instanceof Date ? data.date : new Date(data.date));
        
        if (scheduleDate) {
          // Filter by week if weekStart is provided
          if (weekStart) {
            const scheduleDateOnly = new Date(scheduleDate);
            scheduleDateOnly.setHours(0, 0, 0, 0);
            const weekStartOnly = new Date(weekStart);
            weekStartOnly.setHours(0, 0, 0, 0);
            const weekEndOnly = new Date(weekEnd);
            weekEndOnly.setHours(0, 0, 0, 0);
            
            if (scheduleDateOnly >= weekStartOnly && scheduleDateOnly <= weekEndOnly) {
              dateSpecificShifts.push({
                id: doc.id,
                ...data,
                date: scheduleDate,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
                updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
              });
            }
          } else {
            dateSpecificShifts.push({
              id: doc.id,
              ...data,
              date: scheduleDate,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
            });
          }
        }
      }
    });
    
    return {
      activeConfig: activeConfig ? {
        ...activeConfig,
        employeeShifts // Extract just this employee's shifts
      } : null,
      inactiveConfigs: inactiveConfigs.map(c => ({
        ...c,
        employeeShifts: c.shifts?.[employeeId] || {}
      })),
      dateSpecificShifts
    };
  } catch (error) {
    console.error('Error fetching active employee schedules:', error);
    throw error;
  }
};

/**
 * Get all schedule configurations (including history) for a specific employee and branch
 * Returns configurations sorted by startDate (newest first)
 * @param {string} employeeId - Employee ID
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of all schedule configurations (active and inactive) with employee's shifts extracted
 */
export const getScheduleHistoryByEmployee = async (employeeId, branchId) => {
  try {
    // Get all branch configurations
    const allConfigs = await getScheduleConfigurationsByBranch(branchId);
    
    // Extract employee's shifts from each configuration
    const employeeConfigs = allConfigs.map(config => ({
      id: config.id,
      branchId: config.branchId,
      startDate: config.startDate,
      endDate: config.endDate,
      isActive: config.isActive,
      notes: config.notes,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      shifts: config.shifts?.[employeeId] || {} // Extract just this employee's shifts
    }));
    
    // Get date-specific shifts
    // Fetch all date-specific shifts for the branch, then filter in JavaScript to avoid index requirement
    const schedulesRef = collection(db, 'schedules');
    const dateSpecificQuery = query(
      schedulesRef,
      where('branchId', '==', branchId)
    );
    
    const dateSpecificSnapshot = await getDocs(dateSpecificQuery);
    const dateSpecificShifts = [];
    
    // Filter in JavaScript instead of using Firestore query
    dateSpecificSnapshot.forEach((doc) => {
      const data = doc.data();
      // Only process date-specific shifts (has date field and matches employeeId)
      if (data.date && data.employeeId === employeeId) {
        const scheduleDate = data.date?.toDate ? data.date.toDate() : (data.date instanceof Date ? data.date : new Date(data.date));
        dateSpecificShifts.push({
          id: doc.id,
          ...data,
          date: scheduleDate,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
        });
      }
    });
    
    // Sort by startDate descending (newest first)
    return employeeConfigs.sort((a, b) => {
      const aTime = a.startDate?.getTime() || 0;
      const bTime = b.startDate?.getTime() || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error('Error fetching schedule history:', error);
    throw error;
  }
};

/**
 * Create or update a complete shift configuration for a branch
 * All shifts for ALL staff in the branch are stored in ONE document with a startDate
 * When creating a new configuration, the old one is marked inactive (preserves history)
 * @param {Object} scheduleData - Schedule data
 * @param {string} scheduleData.branchId - Branch ID
 * @param {Object} scheduleData.shifts - Object with employee shifts: { employeeId: { monday: {start, end}, ... }, ... }
 * @param {string} scheduleData.startDate - Start date for this configuration (YYYY-MM-DD format, defaults to today)
 * @param {string} scheduleData.notes - Optional notes
 * @returns {Promise<string>} New schedule document ID
 */
export const createOrUpdateScheduleConfiguration = async (scheduleData) => {
  try {
    const { branchId, shifts, startDate, notes = '' } = scheduleData;
    
    if (!shifts || typeof shifts !== 'object') {
      throw new Error('Shifts object is required');
    }
    
    // Validate all shifts have valid times
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    for (const [employeeId, employeeShifts] of Object.entries(shifts)) {
      if (!employeeShifts || typeof employeeShifts !== 'object') continue;
      
      for (const [dayKey, shift] of Object.entries(employeeShifts)) {
        if (shift && (shift.start || shift.end)) {
          if (!shift.start || !shift.end) {
            throw new Error(`Both start and end times required for ${employeeId} - ${dayKey}`);
          }
          if (!timeRegex.test(shift.start) || !timeRegex.test(shift.end)) {
            throw new Error(`Invalid time format for ${employeeId} - ${dayKey}. Use HH:mm format`);
          }
          
          const [startHour, startMin] = shift.start.split(':').map(Number);
          const [endHour, endMin] = shift.end.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          
          if (endMinutes <= startMinutes) {
            throw new Error(`End time must be after start time for ${employeeId} - ${dayKey}`);
          }
        }
      }
    }
    
    const schedulesRef = collection(db, 'schedules');
    
    // Find existing active schedule configuration for this branch
    const existingQuery = query(
      schedulesRef,
      where('branchId', '==', branchId),
      where('isActive', '==', true)
    );
    
    const existingSnapshot = await getDocs(existingQuery);
    
    // Mark existing active configuration as inactive (preserves history)
    // Note: We do NOT set endDate - schedules are determined by startDate only
    const updatePromises = [];
    existingSnapshot.forEach((doc) => {
      const data = doc.data();
      // Only mark as inactive if it's a full configuration (has shifts object with employee structure)
      if (data.shifts && typeof data.shifts === 'object' && !data.employeeId) {
        const scheduleRef = doc.ref;
        updatePromises.push(
          updateDoc(scheduleRef, {
            isActive: false,
            updatedAt: Timestamp.now()
          })
        );
      }
    });
    
    // Wait for all updates to complete
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
    
    // Parse start date (default to today if not provided)
    const startDateObj = startDate ? new Date(startDate) : new Date();
    startDateObj.setHours(0, 0, 0, 0);
    
    // Create new active schedule configuration for the entire branch
    // Note: No endDate - schedules are determined by startDate only
    const newSchedule = {
      branchId,
      shifts, // All employees' shifts: { employeeId1: { monday: {...}, ... }, employeeId2: {...}, ... }
      startDate: Timestamp.fromDate(startDateObj),
      isActive: true,
      notes: notes || '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    const docRef = await addDoc(schedulesRef, newSchedule);
    return docRef.id;
  } catch (error) {
    console.error('Error creating/updating schedule configuration:', error);
    toast.error(error.message || 'Failed to save schedule');
    throw error;
  }
};

/**
 * Create or update a schedule, preserving history
 * When updating, marks the old schedule as inactive and creates a new one
 * @param {Object} scheduleData - Schedule data
 * @param {string} scheduleData.branchId - Branch ID
 * @param {string} scheduleData.employeeId - Employee ID
 * @param {string} scheduleData.dayOfWeek - Day of week (Monday, Tuesday, etc.) - optional if date is provided
 * @param {string} scheduleData.date - Specific date (YYYY-MM-DD format) - optional, for date-specific shifts
 * @param {string} scheduleData.startTime - Start time (HH:mm format)
 * @param {string} scheduleData.endTime - End time (HH:mm format)
 * @param {string} scheduleData.notes - Optional notes
 * @returns {Promise<string>} New schedule document ID
 */
export const createOrUpdateScheduleWithHistory = async (scheduleData) => {
  try {
    const { branchId, employeeId, dayOfWeek, date, startTime, endTime, notes = '' } = scheduleData;
    
    // If date is provided, calculate dayOfWeek from it; otherwise use provided dayOfWeek
    let finalDayOfWeek = dayOfWeek;
    let scheduleDate = null;
    
    if (date) {
      // Parse the date and get day of week
      const dateObj = new Date(date);
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      finalDayOfWeek = days[dateObj.getDay()];
      scheduleDate = Timestamp.fromDate(dateObj);
    }
    
    // Validate day of week
    if (!finalDayOfWeek || !DAYS_OF_WEEK.includes(finalDayOfWeek)) {
      throw new Error('Invalid day of week');
    }
    
    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      throw new Error('Invalid time format. Use HH:mm format (e.g., 09:00)');
    }
    
    // Validate start time is before end time
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    if (endMinutes <= startMinutes) {
      throw new Error('End time must be after start time');
    }
    
    // For date-specific shifts, create individual documents
    if (date && scheduleDate) {
      const schedulesRef = collection(db, 'schedules');
      
      // Find existing active schedule for this specific date
      const existingQuery = query(
        schedulesRef,
        where('employeeId', '==', employeeId),
        where('date', '==', scheduleDate),
        where('branchId', '==', branchId)
      );
      
      const existingSnapshot = await getDocs(existingQuery);
      
      // Mark existing as inactive
      const updatePromises = [];
      existingSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isActive !== false) {
          const scheduleRef = doc.ref;
          updatePromises.push(
            updateDoc(scheduleRef, {
              isActive: false,
              deactivatedAt: Timestamp.now(),
              updatedAt: Timestamp.now()
            })
          );
        }
      });
      
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }
      
      // Create new date-specific shift
      const newSchedule = {
        branchId,
        employeeId,
        dayOfWeek: finalDayOfWeek,
        date: scheduleDate,
        startTime,
        endTime,
        notes: notes || '',
        isActive: true,
        isRecurring: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      const docRef = await addDoc(schedulesRef, newSchedule);
      return docRef.id;
    }
    
    // For recurring shifts, we need to get the current active branch configuration
    // and update the employee's shift in it, or create a new configuration
    const allConfigs = await getScheduleConfigurationsByBranch(branchId);
    const activeConfig = allConfigs.find(c => c.isActive);
    
    const dayKey = finalDayOfWeek.toLowerCase();
    
    if (activeConfig) {
      // Update existing branch configuration - update this employee's shift
      const updatedShifts = {
        ...activeConfig.shifts,
        [employeeId]: {
          ...(activeConfig.shifts[employeeId] || {}),
          [dayKey]: {
            start: startTime,
            end: endTime
          }
        }
      };
      
      await updateDoc(doc(db, 'schedules', activeConfig.id), {
        shifts: updatedShifts,
        updatedAt: Timestamp.now()
      });
      
      return activeConfig.id;
    } else {
      // Create new branch configuration with just this employee's shift
      const newShifts = {
        [employeeId]: {
          [dayKey]: {
            start: startTime,
            end: endTime
          }
        }
      };
      
      return await createOrUpdateScheduleConfiguration({
        branchId,
        shifts: newShifts,
        notes
      });
    }
  } catch (error) {
    console.error('Error creating/updating schedule with history:', error);
    toast.error(error.message || 'Failed to save schedule');
    throw error;
  }
};

/**
 * Mark a schedule as inactive (soft delete) to preserve history
 * @param {string} employeeId - Employee ID
 * @param {string} dayOfWeek - Day of week
 * @param {string} branchId - Branch ID
 * @returns {Promise<void>}
 */
export const deactivateSchedule = async (employeeId, dayOfWeek, branchId) => {
  try {
    const schedulesRef = collection(db, 'schedules');
    // Query without isActive filter for backward compatibility
    const q = query(
      schedulesRef,
      where('employeeId', '==', employeeId),
      where('dayOfWeek', '==', dayOfWeek),
      where('branchId', '==', branchId)
    );
    
    const snapshot = await getDocs(q);
    
    // Filter in code to find active schedules
    const activeSchedules = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Treat missing isActive as true (active) for backward compatibility
      const isActive = data.isActive !== false;
      if (isActive) {
        activeSchedules.push(doc);
      }
    });
    
    if (activeSchedules.length === 0) {
      throw new Error('No active schedule found to deactivate');
    }
    
    // Mark all active schedules for this day as inactive
    const updatePromises = [];
    activeSchedules.forEach((doc) => {
      const scheduleRef = doc.ref;
      updatePromises.push(
        updateDoc(scheduleRef, {
          isActive: false,
          deactivatedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        })
      );
    });
    
    await Promise.all(updatePromises);
  } catch (error) {
    console.error('Error deactivating schedule:', error);
    toast.error(error.message || 'Failed to remove schedule');
    throw error;
  }
};

export { DAYS_OF_WEEK };


