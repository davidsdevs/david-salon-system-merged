/**
 * Calendar Management Page
 * For Branch Managers to manage holidays and special dates
 */

import { useState, useEffect, useMemo } from 'react';
import { Plus, Calendar as CalendarIcon, Trash2, Edit, AlertCircle, ChevronLeft, ChevronRight, Flag, User, Clock, CalendarDays } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  saveBranchCalendarEntry, 
  deleteBranchCalendarEntry,
  getCalendarEntryTypes 
} from '../../services/branchCalendarService';
import { getScheduleConfigurationsByBranch } from '../../services/scheduleService';
import { getLeaveRequestsByBranch, LEAVE_TYPES } from '../../services/leaveManagementService';
import { getUsersByBranch, getUserById } from '../../services/userService';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import CalendarFormModal from '../../components/branch/CalendarFormModal';
import { formatDate, getFullName, formatTime12Hour } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { getPublicHolidays } from '../../services/holidaysApiService';

const CalendarManagement = () => {
  const { currentUser, userBranch } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const [holidayCache, setHolidayCache] = useState({});
  const [holidayYearsLoaded, setHolidayYearsLoaded] = useState({});
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [selectedDateForNewEntry, setSelectedDateForNewEntry] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItemType, setSelectedItemType] = useState(null); // 'leave', 'stylist', 'holiday', 'reminder'
  
  // Schedule data
  const [scheduleConfigs, setScheduleConfigs] = useState([]);
  const [dateSpecificShifts, setDateSpecificShifts] = useState([]); // Array of { employeeId, date, startTime, endTime }
  const [staffMembers, setStaffMembers] = useState([]); // Array of staff with id, firstName, lastName, etc.
  const [staffCache, setStaffCache] = useState({}); // { employeeId: { firstName, lastName, ... } }
  
  // Leave data
  const [leaveRequests, setLeaveRequests] = useState([]); // All leave requests for the branch
  const [leavesByDate, setLeavesByDate] = useState({}); // { dateKey: [{ employeeId, name, type, status, startDate, endDate }] }

  useEffect(() => {
    if (userBranch) {
      fetchCalendar();
      fetchScheduleData();
      fetchStaffMembers();
      fetchLeaveRequests();
    }
  }, [userBranch]);

  // Refresh schedule and leave data when month changes
  useEffect(() => {
    if (userBranch) {
      fetchScheduleData();
      fetchLeaveRequests();
    }
  }, [currentMonth, userBranch]);

  useEffect(() => {
    const year = currentMonth.getFullYear();
    if (!holidayYearsLoaded[year]) {
      fetchPhilippineHolidays(year);
    }
    // Preload next year's holidays when viewing December
    if (currentMonth.getMonth() === 11 && !holidayYearsLoaded[year + 1]) {
      fetchPhilippineHolidays(year + 1);
    }
  }, [currentMonth, holidayYearsLoaded]);

  // Helper function to format date as YYYY-MM-DD
  const formatDateKey = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  };

  // Helper function to categorize Philippine holidays
  const categorizePhilippineHoliday = (holiday) => {
    if (!holiday || !holiday.name) return { type: 'unknown', label: 'Holiday' };
    
    const name = holiday.name.toLowerCase();
    const localName = holiday.localName?.toLowerCase() || '';
    const combinedName = `${name} ${localName}`;
    
    // Regular Holidays (paid days off) - Based on Philippine Labor Code
    const regularHolidayKeywords = [
      'new year\'s day', 'new year day', 'maundy thursday', 'good friday',
      'araw ng kagitingan', 'labor day', 'independence day', 'national heroes day',
      'bonifacio day', 'rizal day', 'christmas day', 'december 25',
      'eid al fitr', 'eid\'l fitr', 'eidul fitr',
      'eid al adha', 'eid\'l adha', 'eidul adha'
    ];
    
    // Special Non-Working Holidays (no work, no pay)
    const specialNonWorkingKeywords = [
      'chinese new year', 'lunar new year',
      'black saturday', 'ninoy aquino day', 'ninoy aquino',
      'all saints\' day', 'all saints day', 'all saints\'',
      'all saints', 'feast of the immaculate conception',
      'immaculate conception', 'christmas eve', 'december 24',
      'last day of the year', 'new year\'s eve', 'new year eve',
      'december 31', 'black nazarene', 'feast of the black nazarene',
      'quiapo', 'immaculate', 'saints\' eve', 'all saints\' eve'
    ];
    
    // Special Working Holidays (regular workdays, no additional pay) - Check FIRST
    const specialWorkingKeywords = [
      'edsa people power revolution', 'edsa revolution anniversary',
      'people power revolution anniversary', 'edsa anniversary',
      'special working holiday', 'working holiday'
    ];
    
    // IMPORTANT: Check special working holidays FIRST (most specific)
    // This ensures EDSA People Power Revolution is correctly identified as special working
    if (specialWorkingKeywords.some(keyword => combinedName.includes(keyword))) {
      return { 
        type: 'special_working', 
        label: 'Special Working',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        iconColor: 'text-yellow-600'
      };
    }
    
    // Then check for special non-working holidays
    if (specialNonWorkingKeywords.some(keyword => combinedName.includes(keyword))) {
      return { 
        type: 'special_non_working', 
        label: 'Special Non-Working',
        color: 'bg-orange-100 text-orange-800 border-orange-300',
        iconColor: 'text-orange-600'
      };
    }
    
    // Finally check for regular holidays (most common)
    if (regularHolidayKeywords.some(keyword => combinedName.includes(keyword))) {
      return { 
        type: 'regular', 
        label: 'Regular Holiday',
        color: 'bg-red-100 text-red-800 border-red-300',
        iconColor: 'text-red-600'
      };
    }
    
    // Default: treat as regular holiday if not specified
    // Most Philippine holidays from the API are regular holidays
    return { 
      type: 'regular', 
      label: 'Regular Holiday',
      color: 'bg-red-100 text-red-800 border-red-300',
      iconColor: 'text-red-600'
    };
  };

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      // Fetch all reminders for this branch
      const calendarRef = collection(db, 'calendar');
      const branchQuery = query(
        calendarRef,
        where('branchId', '==', userBranch)
      );
      const branchSnapshot = await getDocs(branchQuery);
      const allEntries = branchSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate()
        }))
        .sort((a, b) => {
          if (!a.date || !b.date) return 0;
          return a.date.getTime() - b.date.getTime();
        });
      
      setEntries(allEntries);
    } catch (error) {
      console.error('Error fetching calendar:', error);
      toast.error('Failed to load calendar entries');
    } finally {
      setLoading(false);
    }
  };

  const fetchPhilippineHolidays = async (year) => {
    try {
      setHolidaysLoading(true);
      const holidays = await getPublicHolidays(year, 'PH');
      setHolidayCache(prev => ({
        ...prev,
        [year]: holidays
      }));
      setHolidayYearsLoaded(prev => ({
        ...prev,
        [year]: true
      }));
    } catch (error) {
      console.error('Error fetching Philippine holidays:', error);
      toast.error('Failed to load Philippine holidays');
    } finally {
      setHolidaysLoading(false);
    }
  };

  // Fetch schedule configurations and date-specific shifts
  const fetchScheduleData = async () => {
    if (!userBranch) return;
    
    try {
      // Get all schedule configurations for the branch
      const configs = await getScheduleConfigurationsByBranch(userBranch);
      console.log('Schedule configs fetched:', configs.length);
      console.log('Schedule configs data:', configs.map(c => ({
        id: c.id,
        startDate: c.startDate,
        isActive: c.isActive,
        employeeIds: c.shifts ? Object.keys(c.shifts) : []
      })));
      setScheduleConfigs(configs);

      // Get date-specific shifts
      const schedulesRef = collection(db, 'schedules');
      const branchQuery = query(
        schedulesRef,
        where('branchId', '==', userBranch)
      );
      const snapshot = await getDocs(branchQuery);
      
      const dateShifts = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Date-specific shifts have a date field and employeeId
        if (data.date && data.employeeId && data.isActive !== false) {
          const shiftDate = data.date?.toDate ? data.date.toDate() : 
                           (data.date instanceof Date ? data.date : new Date(data.date));
          dateShifts.push({
            employeeId: data.employeeId,
            date: shiftDate,
            startTime: data.startTime,
            endTime: data.endTime,
            dayOfWeek: data.dayOfWeek
          });
        }
      });
      
      console.log('Date-specific shifts:', dateShifts.length);
      setDateSpecificShifts(dateShifts);
    } catch (error) {
      console.error('Error fetching schedule data:', error);
      toast.error('Failed to load schedule data');
    }
  };

  // Fetch staff members for the branch
  const fetchStaffMembers = async () => {
    if (!userBranch) return;
    
    try {
      // First, get all branch users (including inactive ones) for schedule lookup
      // This ensures we can match employeeIds in schedules even if user isn't active or isn't a stylist
      const allUsersQuery = query(
        collection(db, 'users'),
        where('branchId', '==', userBranch)
      );
      const allUsersSnapshot = await getDocs(allUsersQuery);
      
      const allBranchUsers = [];
      allUsersSnapshot.forEach((doc) => {
        allBranchUsers.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Filter to stylists for display purposes
      const stylists = allBranchUsers.filter(s => 
        (s.roles && s.roles.includes('stylist')) || s.role === 'stylist'
      );
      
      console.log('All branch users found:', allBranchUsers.length);
      console.log('Stylists found:', stylists.map(s => ({ 
        id: s.id, 
        firstName: s.firstName,
        lastName: s.lastName,
        name: getFullName(s),
        isActive: s.isActive
      })));
      
      setStaffMembers(stylists);
      
      // Create staff cache from ALL branch users (not just stylists)
      // This ensures we can match employeeIds in schedules even if user isn't a stylist
      const cache = {};
      allBranchUsers.forEach(user => {
        // Document ID (which is the Firebase Auth UID)
        const docId = user.id;
        if (docId) {
          const userInfo = {
            id: docId,
            uid: docId, // Document ID is the UID
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            name: getFullName(user),
            ...user
          };
          
          // Map by document ID (primary key)
          cache[docId] = userInfo;
          
          // Also map by uid field if it exists and is different
          if (user.uid && user.uid !== docId) {
            cache[user.uid] = userInfo;
          }
        }
      });
      
      console.log('Staff cache created with IDs:', Object.keys(cache));
      console.log('Cache includes users:', Object.entries(cache).map(([id, info]) => ({
        id,
        name: info.name,
        role: info.role || info.roles?.[0]
      })));
      setStaffCache(cache);
    } catch (error) {
      console.error('Error fetching staff members:', error);
      toast.error('Failed to load staff members');
    }
  };

  // Fetch leave requests for the branch
  const fetchLeaveRequests = async () => {
    if (!userBranch) return;
    
    try {
      const leaves = await getLeaveRequestsByBranch(userBranch);
      setLeaveRequests(leaves);
      
      // Create a map of leaves by date - process asynchronously to fetch user names
      const leavesMap = {};
      
      await Promise.all(leaves.map(async (leave) => {
        // Only show approved or pending leaves (cancelled/rejected don't affect calendar)
        if (leave.status === 'approved' || leave.status === 'pending') {
          // Ensure dates are Date objects
          let startDate, endDate;
          
          if (leave.startDate instanceof Date) {
            startDate = new Date(leave.startDate);
          } else if (leave.startDate && typeof leave.startDate.toDate === 'function') {
            startDate = leave.startDate.toDate();
          } else if (leave.startDate) {
            startDate = new Date(leave.startDate);
          } else {
            return; // Skip invalid leave
          }
          
          if (leave.endDate instanceof Date) {
            endDate = new Date(leave.endDate);
          } else if (leave.endDate && typeof leave.endDate.toDate === 'function') {
            endDate = leave.endDate.toDate();
          } else if (leave.endDate) {
            endDate = new Date(leave.endDate);
          } else {
            return; // Skip invalid leave
          }
          
          // Normalize dates
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          
          // Get employee name
          const employeeId = leave.employeeId;
          let staffInfo = staffCache[employeeId];
          
          // If not in cache, try to fetch user directly
          if (!staffInfo && employeeId) {
            try {
              const user = await getUserById(employeeId);
              if (user) {
                staffInfo = {
                  id: user.id,
                  uid: user.id,
                  firstName: user.firstName || '',
                  lastName: user.lastName || '',
                  name: getFullName(user),
                  ...user
                };
                // Add to cache for future use
                setStaffCache(prev => ({
                  ...prev,
                  [employeeId]: staffInfo
                }));
              }
            } catch (error) {
              console.error(`Error fetching user ${employeeId} for leave:`, error);
            }
          }
          
          const employeeName = staffInfo 
            ? (staffInfo.name || getFullName(staffInfo))
            : `Staff (${employeeId ? employeeId.substring(0, 8) : 'Unknown'})`;
          
          console.log(`Processing leave for employeeId: ${employeeId}, name: ${employeeName}`);
          
          // Add leave to each date in the range
          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            const dateKey = formatDateKey(currentDate);
            
            if (!leavesMap[dateKey]) {
              leavesMap[dateKey] = [];
            }
            
            // Only add if not already in the array for this date
            const exists = leavesMap[dateKey].some(l => 
              l.employeeId === employeeId && 
              l.startDate.getTime() === startDate.getTime()
            );
            
            if (!exists) {
              leavesMap[dateKey].push({
                employeeId,
                name: employeeName,
                type: leave.type,
                status: leave.status,
                startDate,
                endDate,
                reason: leave.reason
              });
            }
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      }));
      
      console.log('Leaves map created:', Object.keys(leavesMap).length, 'dates with leaves');
      setLeavesByDate(leavesMap);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      // Don't show error toast - leaves are optional
    }
  };

  // Refetch leaves when staff cache is updated to rebuild with correct names
  useEffect(() => {
    if (userBranch && Object.keys(staffCache).length > 0 && leaveRequests.length > 0) {
      // Rebuild leaves map with updated staff names
      const rebuildLeavesMap = async () => {
        const leavesMap = {};
        
        await Promise.all(leaveRequests.map(async (leave) => {
          if (leave.status === 'approved' || leave.status === 'pending') {
            let startDate, endDate;
            
            if (leave.startDate instanceof Date) {
              startDate = new Date(leave.startDate);
            } else if (leave.startDate && typeof leave.startDate.toDate === 'function') {
              startDate = leave.startDate.toDate();
            } else if (leave.startDate) {
              startDate = new Date(leave.startDate);
            } else {
              return;
            }
            
            if (leave.endDate instanceof Date) {
              endDate = new Date(leave.endDate);
            } else if (leave.endDate && typeof leave.endDate.toDate === 'function') {
              endDate = leave.endDate.toDate();
            } else if (leave.endDate) {
              endDate = new Date(leave.endDate);
            } else {
              return;
            }
            
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            
            const employeeId = leave.employeeId;
            let staffInfo = staffCache[employeeId];
            
            // If not in cache, try to fetch user directly
            if (!staffInfo && employeeId) {
              try {
                const user = await getUserById(employeeId);
                if (user) {
                  staffInfo = {
                    id: user.id,
                    uid: user.id,
                    firstName: user.firstName || '',
                    lastName: user.lastName || '',
                    name: getFullName(user),
                    ...user
                  };
                  // Add to cache for future use
                  setStaffCache(prev => ({
                    ...prev,
                    [employeeId]: staffInfo
                  }));
                }
              } catch (error) {
                console.error(`Error fetching user ${employeeId}:`, error);
              }
            }
            
            const employeeName = staffInfo 
              ? (staffInfo.name || getFullName(staffInfo))
              : `Staff (${employeeId ? employeeId.substring(0, 8) : 'Unknown'})`;
            
            const currentDate = new Date(startDate);
            while (currentDate <= endDate) {
              const dateKey = formatDateKey(currentDate);
              
              if (!leavesMap[dateKey]) {
                leavesMap[dateKey] = [];
              }
              
              const exists = leavesMap[dateKey].some(l => 
                l.employeeId === employeeId && 
                l.startDate.getTime() === startDate.getTime()
              );
              
              if (!exists) {
                leavesMap[dateKey].push({
                  employeeId,
                  name: employeeName,
                  type: leave.type,
                  status: leave.status,
                  startDate,
                  endDate,
                  reason: leave.reason
                });
              }
              
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }
        }));
        
        setLeavesByDate(leavesMap);
      };
      
      rebuildLeavesMap();
    }
  }, [staffCache, userBranch, leaveRequests]);

  // Get the schedule configuration that applies to a specific date
  const getScheduleForDate = (configs, targetDate) => {
    if (!targetDate || !configs || configs.length === 0) return null;
    
    const targetDateObj = new Date(targetDate);
    targetDateObj.setHours(0, 0, 0, 0);
    const targetTime = targetDateObj.getTime();
    
    // Filter configs with startDate <= targetDate, get most recent one
    // Note: We consider both active and inactive configs - the most recent startDate <= targetDate applies
    const applicableConfigs = configs
      .filter(c => {
        if (!c.startDate) return false;
        const configStartDate = new Date(c.startDate);
        configStartDate.setHours(0, 0, 0, 0);
        const configTime = configStartDate.getTime();
        return configTime <= targetTime;
      })
      .sort((a, b) => {
        const aTime = new Date(a.startDate).getTime();
        const bTime = new Date(b.startDate).getTime();
        return bTime - aTime; // Most recent first
      });
    
    const result = applicableConfigs.length > 0 ? applicableConfigs[0] : null;
    
    // Debug logging for troubleshooting
    if (targetDateObj.getDate() <= 5) { // Only log for first few days of month to avoid spam
      console.log(`Date: ${targetDateObj.toISOString().split('T')[0]}, Applicable config:`, result ? {
        id: result.id,
        startDate: result.startDate?.toISOString().split('T')[0],
        isActive: result.isActive,
        employeeCount: result.shifts ? Object.keys(result.shifts).length : 0
      } : 'None');
    }
    
    return result;
  };

  // Get day name from date (Monday, Tuesday, etc.)
  const getDayName = (date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  // Get stylists scheduled for a specific date
  const getScheduledStylistsForDate = (date) => {
    if (!date) return [];
    
    const dateKey = formatDateKey(date);
    const dayName = getDayName(date);
    const dayKey = dayName.toLowerCase();
    
    // Get the schedule configuration that applies to this date
    const applicableConfig = getScheduleForDate(scheduleConfigs, date);
    
    const scheduledStylists = [];
    
    // Check recurring weekly shifts from configuration
    if (applicableConfig && applicableConfig.shifts) {
      Object.entries(applicableConfig.shifts).forEach(([employeeId, employeeShifts]) => {
        const shift = employeeShifts[dayKey];
        if (shift && shift.start && shift.end) {
          // Try to find staff info by employee ID (which should be the document ID/UID)
          let staffInfo = staffCache[employeeId];
          
          // If not found, try to find by searching all cache entries
          if (!staffInfo) {
            // Try finding by matching any ID field
            const matchingEntry = Object.entries(staffCache).find(([key, info]) => 
              info.id === employeeId || 
              info.uid === employeeId ||
              key === employeeId
            );
            if (matchingEntry) {
              staffInfo = matchingEntry[1];
            }
          }
          
          // Debug logging for first few days
          if (date.getDate() <= 3) {
            if (!staffInfo) {
              console.warn(`⚠️ No staff info found for employeeId: ${employeeId} on ${dateKey}`);
              console.log('Looking for employeeId:', employeeId);
              console.log('Available staff IDs in cache:', Object.keys(staffCache).slice(0, 10));
              console.log('Staff IDs in schedule config:', Object.keys(applicableConfig.shifts));
            } else {
              console.log(`✅ Found staff for employeeId: ${employeeId}`, staffInfo.name);
            }
          }
          
          if (staffInfo) {
            scheduledStylists.push({
              employeeId,
              name: staffInfo.name || getFullName(staffInfo),
              startTime: shift.start,
              endTime: shift.end,
              type: 'recurring'
            });
          } else {
            // If no staff info found, show with employee ID as fallback
            scheduledStylists.push({
              employeeId,
              name: `Staff (${employeeId.substring(0, 8)})`,
              startTime: shift.start,
              endTime: shift.end,
              type: 'recurring'
            });
          }
        }
      });
    } else if (date.getDate() <= 3) {
      console.log(`No applicable config for ${dateKey}, day: ${dayKey}`);
    }
    
    // Check date-specific shifts
    dateSpecificShifts.forEach(shift => {
      const shiftDateKey = formatDateKey(shift.date);
      if (shiftDateKey === dateKey) {
        const staffInfo = staffCache[shift.employeeId];
        
        if (staffInfo) {
          // Check if already added (from recurring), if so update with date-specific times
          const existingIndex = scheduledStylists.findIndex(s => s.employeeId === shift.employeeId);
          if (existingIndex >= 0) {
            // Replace with date-specific shift (takes precedence)
            scheduledStylists[existingIndex] = {
              employeeId: shift.employeeId,
              name: staffInfo.name || getFullName(staffInfo),
              startTime: shift.startTime,
              endTime: shift.endTime,
              type: 'specific'
            };
          } else {
            scheduledStylists.push({
              employeeId: shift.employeeId,
              name: staffInfo.name || getFullName(staffInfo),
              startTime: shift.startTime,
              endTime: shift.endTime,
              type: 'specific'
            });
          }
        } else {
          // If no staff info found, still show the shift
          const existingIndex = scheduledStylists.findIndex(s => s.employeeId === shift.employeeId);
          const displayName = `Staff (${shift.employeeId.substring(0, 8)})`;
          if (existingIndex >= 0) {
            scheduledStylists[existingIndex] = {
              employeeId: shift.employeeId,
              name: displayName,
              startTime: shift.startTime,
              endTime: shift.endTime,
              type: 'specific'
            };
          } else {
            scheduledStylists.push({
              employeeId: shift.employeeId,
              name: displayName,
              startTime: shift.startTime,
              endTime: shift.endTime,
              type: 'specific'
            });
          }
        }
      }
    });
    
    return scheduledStylists.sort((a, b) => {
      // Sort by start time
      const aTime = a.startTime || '23:59';
      const bTime = b.startTime || '23:59';
      return aTime.localeCompare(bTime);
    });
  };

  const generateCalendarDays = (month) => {
    const days = [];
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startDay = startOfMonth.getDay();
    const iterator = new Date(startOfMonth);
    iterator.setDate(iterator.getDate() - startDay);

    for (let i = 0; i < 42; i++) {
      days.push({
        date: new Date(iterator),
        inCurrentMonth: iterator.getMonth() === month.getMonth()
      });
      iterator.setDate(iterator.getDate() + 1);
    }

    return days;
  };

  const handleMonthChange = (direction) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  const handleDayClick = (date) => {
    const dateKey = formatDateKey(date);
    setSelectedEntry(null);
    setSelectedDateForNewEntry(dateKey);
    setShowModal(true);
  };

  const handleAddEntry = () => {
    const todayKey = formatDateKey(new Date());
    setSelectedEntry(null);
    setSelectedDateForNewEntry(todayKey);
    setShowModal(true);
  };

  const handleEditEntry = (entry) => {
    setSelectedEntry(entry);
    setSelectedDateForNewEntry('');
    setShowModal(true);
  };

  const handleDeleteEntry = (entry) => {
    setEntryToDelete(entry);
    setShowDeleteModal(true);
  };

  const handleShowDetails = (item, type) => {
    setSelectedItem(item);
    setSelectedItemType(type);
    setShowDetailModal(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    
    try {
      setDeleting(true);
      await deleteBranchCalendarEntry(userBranch, entryToDelete.id, currentUser);
      await fetchCalendar();
      setShowDeleteModal(false);
    } catch (error) {
      // Error handled in service
    } finally {
      setDeleting(false);
      setEntryToDelete(null);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      setSaving(true);
      const entryData = {
        ...formData,
        id: selectedEntry?.id
      };
      
      await saveBranchCalendarEntry(userBranch, entryData, currentUser);
      setShowModal(false);
      setSelectedDateForNewEntry('');
      await fetchCalendar();
    } catch (error) {
      // Error handled in service
    } finally {
      setSaving(false);
    }
  };

  // All hooks must be called before any early returns
  const entryTypes = getCalendarEntryTypes();
  const calendarDays = useMemo(() => generateCalendarDays(currentMonth), [currentMonth]);
  const entriesByDate = useMemo(() => {
    const map = {};
    entries.forEach(entry => {
      if (!entry.date) return;
      const key = formatDateKey(entry.date);
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(entry);
    });
    return map;
  }, [entries]);

  const holidaysByDate = useMemo(() => {
    const map = {};
    Object.values(holidayCache).forEach(yearHolidays => {
      yearHolidays?.forEach(holiday => {
        map[holiday.date] = holiday;
      });
    });
    return map;
  }, [holidayCache]);

  const currentMonthHolidays = useMemo(() => {
    const yearHolidays = holidayCache[currentMonth.getFullYear()] || [];
    return yearHolidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate.getMonth() === currentMonth.getMonth();
    });
  }, [holidayCache, currentMonth]);

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const upcomingEntries = useMemo(() => {
    return entries.filter(e => {
      const entryDate = new Date(e.date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate >= today && (e.status === 'active' || !e.status);
    });
  }, [entries, today]);

  const pastEntries = useMemo(() => {
    return entries.filter(e => {
      const entryDate = new Date(e.date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate < today && (e.status === 'active' || !e.status);
    });
  }, [entries, today]);

  // Memoize scheduled stylists by date for performance
  const scheduledStylistsByDate = useMemo(() => {
    if (!scheduleConfigs.length && !dateSpecificShifts.length) return {};
    
    const map = {};
    calendarDays.forEach(({ date, inCurrentMonth }) => {
      if (inCurrentMonth) {
        const dateKey = formatDateKey(date);
        map[dateKey] = getScheduledStylistsForDate(date);
      }
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarDays, scheduleConfigs, dateSpecificShifts, staffCache]);

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
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-600">View Philippine holidays and manage calendar reminders</p>
        </div>
        <button
          onClick={handleAddEntry}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Reminder
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Philippine Holidays</p>
          <p>Regular holidays (paid days off), special non-working holidays (no work, no pay), and special working holidays (regular workdays) are automatically displayed. Add reminders to track important dates.</p>
        </div>
      </div>

      {/* Calendar View */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Calendar View</h2>
            <p className="text-sm text-gray-500">
              Philippines public holidays are automatically highlighted. Click any day to add a branch entry.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleMonthChange('prev')}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="min-w-[160px] text-center font-semibold text-gray-900">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <button
              onClick={() => handleMonthChange('next')}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {holidaysLoading && (
            <div className="text-sm text-gray-500">Syncing Philippine holidays...</div>
          )}
          <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-gray-500 tracking-wider uppercase">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map(({ date, inCurrentMonth }, index) => {
              const dateKey = formatDateKey(date);
              const dayEntries = entriesByDate[dateKey] || [];
              const holiday = holidaysByDate[dateKey];
              const isToday = date.getTime() === today.getTime();
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const isDimmed = !inCurrentMonth;
              const canAddEntry = inCurrentMonth;
              const scheduledStylists = inCurrentMonth ? (scheduledStylistsByDate[dateKey] || []) : [];

              return (
                <div
                  key={`${dateKey}-${index}`}
                  className={`min-h-[180px] rounded-xl border p-2 flex flex-col gap-1 ${
                    isDimmed ? 'bg-gray-50 text-gray-400 border-gray-200' : 'bg-white border-gray-200'
                  } ${isWeekend && inCurrentMonth ? 'bg-slate-50' : ''} ${isToday ? 'ring-2 ring-primary-500' : ''}`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className={isDimmed ? 'text-gray-400' : 'text-gray-700'}>
                      {date.getDate()}
                    </span>
                    {holiday && (() => {
                      const holidayCategory = categorizePhilippineHoliday(holiday);
                      return (
                        <span className={`text-[10px] font-semibold ${holidayCategory.iconColor} flex items-center gap-1 truncate max-w-[90px]`} title={holidayCategory.label}>
                          <Flag className="w-3 h-3" />
                          {holiday.localName || holiday.name}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {/* Holiday Badge */}
                    {holiday && inCurrentMonth && (() => {
                      const holidayCategory = categorizePhilippineHoliday(holiday);
                      return (
                        <button
                          onClick={() => handleShowDetails(holiday, 'holiday')}
                          className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded border ${holidayCategory.color} truncate hover:opacity-80 cursor-pointer transition-opacity`}
                          title={`${holiday.localName || holiday.name} - ${holidayCategory.label}`}
                        >
                          <Flag className="w-2.5 h-2.5 inline mr-1" />
                          <span className="font-medium">{holiday.localName || holiday.name}</span>
                          <span className="text-[9px] ml-1">({holidayCategory.label})</span>
                        </button>
                      );
                    })()}
                    {/* Leaves */}
                    {(() => {
                      const dayLeaves = inCurrentMonth ? (leavesByDate[dateKey] || []) : [];
                      const maxLeaves = (scheduledStylists.length > 0 || dayEntries.length > 0) ? 1 : 2;
                      const displayLeaves = dayLeaves.slice(0, maxLeaves);
                      
                      return (
                        <>
                          {displayLeaves.map((leave, idx) => {
                            const leaveTypeInfo = LEAVE_TYPES.find(t => t.value === leave.type) || LEAVE_TYPES[0];
                            const isPending = leave.status === 'pending';
                            return (
                              <button
                                key={`leave-${leave.employeeId}-${leave.startDate?.getTime() || idx}`}
                                onClick={() => handleShowDetails(leave, 'leave')}
                                className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded border truncate hover:opacity-80 cursor-pointer transition-opacity ${
                                  isPending 
                                    ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    : 'bg-orange-50 text-orange-700 border-orange-200'
                                }`}
                                title={`${leave.name} - ${leaveTypeInfo.label} (${leave.status})`}
                              >
                                <CalendarDays className="w-2.5 h-2.5 inline mr-1" />
                                <span className="font-medium">{leave.name}</span>
                                <span className="text-[9px] ml-1">({leaveTypeInfo.label})</span>
                                {isPending && (
                                  <span className="text-[9px] ml-1 text-yellow-600">(Pending)</span>
                                )}
                              </button>
                            );
                          })}
                          {dayLeaves.length > maxLeaves && (
                            <p className="text-[10px] text-orange-600">
                              +{dayLeaves.length - maxLeaves} more leave{dayLeaves.length - maxLeaves !== 1 ? 's' : ''}
                            </p>
                          )}
                        </>
                      );
                    })()}
                    
                    {/* Scheduled Stylists */}
                    {(() => {
                      const dayLeavesCount = inCurrentMonth ? (leavesByDate[dateKey]?.length || 0) : 0;
                      const maxStylists = (dayLeavesCount > 0 || dayEntries.length > 0) ? 1 : 2;
                      const displayStylists = scheduledStylists.slice(0, maxStylists);
                      
                      return (
                        <>
                          {displayStylists.map((stylist, idx) => {
                            const timeDisplay = stylist.startTime && stylist.endTime 
                              ? `${formatTime12Hour(stylist.startTime)} - ${formatTime12Hour(stylist.endTime)}`
                              : '';
                            return (
                              <button
                                key={`stylist-${stylist.employeeId}-${idx}`}
                                onClick={() => handleShowDetails(stylist, 'stylist')}
                                className="w-full text-left text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 truncate hover:opacity-80 cursor-pointer transition-opacity"
                                title={`${stylist.name} ${timeDisplay ? `(${timeDisplay})` : ''}`}
                              >
                                <User className="w-2.5 h-2.5 inline mr-1" />
                                <span className="font-medium">{stylist.name}</span>
                                {timeDisplay && (
                                  <span className="text-[9px] ml-1">{timeDisplay}</span>
                                )}
                              </button>
                            );
                          })}
                          {scheduledStylists.length > maxStylists && (
                            <p className="text-[10px] text-purple-600">
                              +{scheduledStylists.length - maxStylists} more stylist{scheduledStylists.length - maxStylists !== 1 ? 's' : ''}
                            </p>
                          )}
                        </>
                      );
                    })()}
                    
                    {/* Reminders */}
                    {(() => {
                      const dayLeavesCount = inCurrentMonth ? (leavesByDate[dateKey]?.length || 0) : 0;
                      const maxReminders = (dayLeavesCount > 0 || scheduledStylists.length > 0) ? 1 : 3;
                      const displayReminders = dayEntries.slice(0, maxReminders);
                      
                      return (
                        <>
                          {displayReminders.map(entry => {
                            return (
                              <button
                                key={entry.id}
                                onClick={() => handleShowDetails(entry, 'reminder')}
                                className="w-full text-left text-[11px] px-2 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 truncate hover:opacity-80 transition-opacity"
                                title={entry.title}
                              >
                                {entry.title}
                              </button>
                            );
                          })}
                          {dayEntries.length > maxReminders && (
                            <p className="text-[11px] text-gray-500">
                              +{dayEntries.length - maxReminders} more reminder{dayEntries.length - maxReminders !== 1 ? 's' : ''}
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => handleDayClick(date)}
                    disabled={!canAddEntry}
                    className={`text-[11px] font-medium flex items-center gap-1 justify-start mt-auto ${
                      canAddEntry
                        ? 'text-primary-600 hover:text-primary-700'
                        : 'text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              Reminder
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-3 h-3 text-orange-600" />
              Leave
            </div>
            <div className="flex items-center gap-2">
              <User className="w-3 h-3 text-purple-600" />
              Scheduled Stylist
            </div>
            <div className="flex items-center gap-2">
              <Flag className="w-3 h-3 text-red-600" />
              Regular Holiday
            </div>
            <div className="flex items-center gap-2">
              <Flag className="w-3 h-3 text-orange-600" />
              Special Non-Working
            </div>
            <div className="flex items-center gap-2">
              <Flag className="w-3 h-3 text-yellow-600" />
              Special Working
            </div>
          </div>
          {currentMonthHolidays.length > 0 && (() => {
            const regularHolidays = currentMonthHolidays.filter(h => categorizePhilippineHoliday(h).type === 'regular');
            const specialNonWorking = currentMonthHolidays.filter(h => categorizePhilippineHoliday(h).type === 'special_non_working');
            const specialWorking = currentMonthHolidays.filter(h => categorizePhilippineHoliday(h).type === 'special_working');
            
            return (
              <div className="space-y-3">
                {regularHolidays.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
                    <p className="font-semibold mb-2 text-red-800">Regular Holidays (Paid Days Off):</p>
                    <div className="flex flex-wrap gap-2">
                      {regularHolidays.map(holiday => (
                        <span key={holiday.date} className="px-2 py-1 bg-white rounded border border-red-300 text-red-700">
                          {holiday.localName || holiday.name} - {formatDate(new Date(holiday.date), 'MMM dd')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {specialNonWorking.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs">
                    <p className="font-semibold mb-2 text-orange-800">Special Non-Working Holidays (No Work, No Pay):</p>
                    <div className="flex flex-wrap gap-2">
                      {specialNonWorking.map(holiday => (
                        <span key={holiday.date} className="px-2 py-1 bg-white rounded border border-orange-300 text-orange-700">
                          {holiday.localName || holiday.name} - {formatDate(new Date(holiday.date), 'MMM dd')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {specialWorking.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs">
                    <p className="font-semibold mb-2 text-yellow-800">Special Working Holidays (Regular Workdays):</p>
                    <div className="flex flex-wrap gap-2">
                      {specialWorking.map(holiday => (
                        <span key={holiday.date} className="px-2 py-1 bg-white rounded border border-yellow-300 text-yellow-700">
                          {holiday.localName || holiday.name} - {formatDate(new Date(holiday.date), 'MMM dd')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Upcoming Reminders */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Upcoming Dates</h2>
        </div>
        <div className="p-6">
          {upcomingEntries.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No upcoming dates scheduled</p>
          ) : (
            <div className="space-y-3">
              {upcomingEntries.map((entry) => {
                const typeInfo = entryTypes.find(t => t.value === entry.type);
                return (
                  <div key={entry.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="flex-shrink-0">
                        <CalendarIcon className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{entry.title}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo?.color}`}>
                            {typeInfo?.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{formatDate(entry.date, 'EEEE, MMMM dd, yyyy')}</p>
                        {entry.description && (
                          <p className="text-sm text-gray-500">{entry.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditEntry(entry)}
                        className="p-2 text-gray-600 hover:bg-white rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry)}
                        className="p-2 text-red-600 hover:bg-white rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Past Entries */}
      {pastEntries.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Past Dates</h2>
          </div>
          <div className="p-6">
            <div className="space-y-2">
              {pastEntries.slice(0, 5).map((entry) => {
                const typeInfo = entryTypes.find(t => t.value === entry.type);
                return (
                  <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg opacity-60">
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{entry.title}</p>
                        <p className="text-xs text-gray-500">{formatDate(entry.date, 'MMM dd, yyyy')}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo?.color}`}>
                        {typeInfo?.label}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteEntry(entry)}
                      className="p-2 text-red-600 hover:bg-white rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              {pastEntries.length > 5 && (
                <p className="text-sm text-gray-500 text-center pt-2">
                  +{pastEntries.length - 5} more past entries
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Entry Form Modal */}
      <CalendarFormModal
        isOpen={showModal}
        entry={selectedEntry}
        defaultDate={selectedEntry ? '' : selectedDateForNewEntry}
        onClose={() => {
          if (!saving) {
            setShowModal(false);
            setSelectedEntry(null);
            setSelectedDateForNewEntry('');
          }
        }}
        onSubmit={handleSubmit}
        loading={saving}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          if (!deleting) {
            setShowDeleteModal(false);
            setEntryToDelete(null);
          }
        }}
        onConfirm={confirmDelete}
        title="Delete Calendar Entry"
        message={`Are you sure you want to delete "${entryToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        loading={deleting}
      />

      {/* Calendar Item Detail Modal */}
      {showDetailModal && selectedItem && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setShowDetailModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {selectedItemType === 'leave' && <CalendarDays className="h-6 w-6" />}
                  {selectedItemType === 'stylist' && <User className="h-6 w-6" />}
                  {selectedItemType === 'holiday' && <Flag className="h-6 w-6" />}
                  {selectedItemType === 'reminder' && <CalendarIcon className="h-6 w-6" />}
                  <div>
                    <h2 className="text-2xl font-bold">
                      {selectedItemType === 'leave' && 'Leave Request Details'}
                      {selectedItemType === 'stylist' && 'Staff Schedule Details'}
                      {selectedItemType === 'holiday' && 'Holiday Details'}
                      {selectedItemType === 'reminder' && 'Reminder Details'}
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedItemType === 'leave' && selectedItem && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Employee</label>
                    <p className="text-base text-gray-900 font-medium">{selectedItem.name || 'Unknown'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Leave Type</label>
                      <p className="text-base text-gray-900">
                        {LEAVE_TYPES.find(t => t.value === selectedItem.type)?.label || selectedItem.type}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <p className={`text-base font-medium ${
                        selectedItem.status === 'approved' ? 'text-green-600' :
                        selectedItem.status === 'pending' ? 'text-yellow-600' :
                        selectedItem.status === 'rejected' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {selectedItem.status?.charAt(0).toUpperCase() + selectedItem.status?.slice(1) || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Start Date</label>
                      <p className="text-base text-gray-900">
                        {selectedItem.startDate ? formatDate(selectedItem.startDate, 'MMM dd, yyyy') : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">End Date</label>
                      <p className="text-base text-gray-900">
                        {selectedItem.endDate ? formatDate(selectedItem.endDate, 'MMM dd, yyyy') : 'N/A'}
                      </p>
                    </div>
                  </div>
                  {selectedItem.days && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Duration</label>
                      <p className="text-base text-gray-900">
                        {selectedItem.days} day{selectedItem.days !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                  {selectedItem.reason && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Reason</label>
                      <p className="text-base text-gray-900 whitespace-pre-wrap">{selectedItem.reason}</p>
                    </div>
                  )}
                  {selectedItem.requestedAt && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Requested At</label>
                      <p className="text-base text-gray-900">
                        {formatDate(selectedItem.requestedAt, 'MMM dd, yyyy hh:mm a')}
                      </p>
                    </div>
                  )}
                  {selectedItem.reviewedAt && selectedItem.reviewedByName && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Reviewed By</label>
                      <p className="text-base text-gray-900">
                        {selectedItem.reviewedByName} on {formatDate(selectedItem.reviewedAt, 'MMM dd, yyyy')}
                      </p>
                    </div>
                  )}
                  {selectedItem.rejectionReason && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Rejection Reason</label>
                      <p className="text-base text-red-600 whitespace-pre-wrap">{selectedItem.rejectionReason}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedItemType === 'stylist' && selectedItem && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Staff Member</label>
                    <p className="text-base text-gray-900 font-medium">{selectedItem.name || 'Unknown'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedItem.startTime && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Shift Start</label>
                        <p className="text-base text-gray-900">
                          {formatTime12Hour(selectedItem.startTime)}
                        </p>
                      </div>
                    )}
                    {selectedItem.endTime && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Shift End</label>
                        <p className="text-base text-gray-900">
                          {formatTime12Hour(selectedItem.endTime)}
                        </p>
                      </div>
                    )}
                  </div>
                  {selectedItem.startTime && selectedItem.endTime && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Total Hours</label>
                      <p className="text-base text-gray-900">
                        {(() => {
                          const start = selectedItem.startTime.split(':').map(Number);
                          const end = selectedItem.endTime.split(':').map(Number);
                          const startMinutes = start[0] * 60 + start[1];
                          const endMinutes = end[0] * 60 + end[1];
                          const diffMinutes = endMinutes - startMinutes;
                          const hours = Math.floor(diffMinutes / 60);
                          const minutes = diffMinutes % 60;
                          return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
                        })()}
                      </p>
                    </div>
                  )}
                  {selectedItem.type && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Schedule Type</label>
                      <p className="text-base text-gray-900 capitalize">
                        {selectedItem.type === 'specific' ? 'Date-Specific Shift' : 'Recurring Schedule'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {selectedItemType === 'holiday' && selectedItem && (() => {
                const holidayCategory = categorizePhilippineHoliday(selectedItem);
                return (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Holiday Name</label>
                      <p className="text-base text-gray-900 font-medium">
                        {selectedItem.localName || selectedItem.name}
                      </p>
                      {selectedItem.localName && selectedItem.name !== selectedItem.localName && (
                        <p className="text-sm text-gray-500 mt-1">{selectedItem.name}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Holiday Type</label>
                        <p className={`text-base font-medium ${holidayCategory.iconColor}`}>
                          {holidayCategory.label}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Date</label>
                        <p className="text-base text-gray-900">
                          {selectedItem.date ? formatDate(new Date(selectedItem.date), 'MMM dd, yyyy') : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className={`p-4 rounded-lg ${holidayCategory.color} border`}>
                      <p className="text-sm font-medium mb-1">Description:</p>
                      {holidayCategory.type === 'regular' && (
                        <p className="text-sm">This is a regular holiday. Employees are entitled to paid day off.</p>
                      )}
                      {holidayCategory.type === 'special_non_working' && (
                        <p className="text-sm">This is a special non-working holiday. "No work, no pay" unless employee is required to work.</p>
                      )}
                      {holidayCategory.type === 'special_working' && (
                        <p className="text-sm">This is a special working holiday. Treated as a regular workday with no additional pay mandated.</p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {selectedItemType === 'reminder' && selectedItem && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Title</label>
                    <p className="text-base text-gray-900 font-medium">{selectedItem.title || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Date</label>
                    <p className="text-base text-gray-900">
                      {selectedItem.date ? formatDate(selectedItem.date, 'MMM dd, yyyy') : 'N/A'}
                    </p>
                  </div>
                  {selectedItem.description && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Description</label>
                      <p className="text-base text-gray-900 whitespace-pre-wrap">{selectedItem.description}</p>
                    </div>
                  )}
                  <div className="pt-4 border-t">
                    <button
                      onClick={() => {
                        setShowDetailModal(false);
                        handleEditEntry(selectedItem);
                      }}
                      className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Reminder
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarManagement;
