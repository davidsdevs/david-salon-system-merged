/**
 * Staff Schedule Page - Branch Manager
 * Weekly view of staff shifts
 */

import { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, ArrowRight, Edit, Plus, X, History } from 'lucide-react';
import { getUsersByBranch, getUserById } from '../../services/userService';
import { getLendingRequests, getActiveLending, getActiveLendingFromBranch, getActiveLendingForBranch } from '../../services/stylistLendingService';
import { getLeaveRequestsByBranch } from '../../services/leaveManagementService';
import { getBranchById } from '../../services/branchService';
import { 
  getActiveSchedulesByEmployee,
  getAllScheduleConfigurations,
  createOrUpdateScheduleWithHistory,
  createOrUpdateScheduleConfiguration,
  getScheduleConfigurationsByBranch,
  deactivateSchedule,
  convertDayKeyToDayOfWeek,
  getScheduleHistoryByEmployee
} from '../../services/scheduleService';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES } from '../../utils/constants';
import { getFullName, getInitials, formatTime12Hour, formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' }
];

const StaffSchedule = () => {
  const { userBranch, currentUser } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lendingData, setLendingData] = useState({}); // { stylistId: { branchName, startDate, endDate } } - staff lent TO other branches
  const [lentOutData, setLentOutData] = useState({}); // { stylistId: { toBranchName, startDate, endDate } } - staff lent OUT FROM this branch
  const [lentToBranchStaff, setLentToBranchStaff] = useState([]); // Staff lent TO this branch (from other branches)
  const [allScheduleConfigs, setAllScheduleConfigs] = useState([]); // All schedule configurations for date-based lookup
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [shiftForm, setShiftForm] = useState({ start: '', end: '', date: '' });
  const [selectedStaffIds, setSelectedStaffIds] = useState([]); // Array of selected staff IDs
  const [selectedDays, setSelectedDays] = useState([]); // Array of selected day keys (legacy, not used anymore)
  const [staffTimes, setStaffTimes] = useState({}); // { staffId: { start: '', end: '' } }
  const [staffDays, setStaffDays] = useState({}); // { staffId: [dayKey1, dayKey2, ...] }
  const [saving, setSaving] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [shiftHistory, setShiftHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showBulkConfigModal, setShowBulkConfigModal] = useState(false);
  const [bulkShifts, setBulkShifts] = useState({}); // { employeeId: { monday: {start, end}, ... } }
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [showEditShiftModal, setShowEditShiftModal] = useState(false); // Simple modal for editing/adding single shift
  const [isEditMode, setIsEditMode] = useState(false); // Calendar edit mode
  const [editableShifts, setEditableShifts] = useState({}); // { staffId: { dayKey: {start, end}, ... } }
  const [configStartDate, setConfigStartDate] = useState(''); // Start date for the configuration
  const [isAddingShift, setIsAddingShift] = useState(false); // Track if we're adding (true) or editing (false) in modal
  const [branchHours, setBranchHours] = useState(null); // Branch operating hours
  const [leaveRequests, setLeaveRequests] = useState([]); // All leave requests for the branch
  const [staffLeaveMap, setStaffLeaveMap] = useState({}); // { staffId: [{ startDate, endDate, status, type }] }
  const [currentWeek, setCurrentWeek] = useState(() => {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(date.setDate(diff));
  });

  const MANAGEABLE_ROLES = [
    USER_ROLES.RECEPTIONIST,
    USER_ROLES.STYLIST,
    USER_ROLES.INVENTORY_CONTROLLER
  ];

  useEffect(() => {
    if (userBranch) {
      fetchBranchHours();
      fetchAllScheduleConfigs();
      fetchLeaveRequests();
      fetchStaff();
    }
  }, [userBranch, currentWeek]); // Reload when week changes

  useEffect(() => {
    if (userBranch && staff.length > 0) {
      fetchLendingData();
    }
  }, [currentWeek, userBranch, staff]);

  // Set default bulk start date to current week when modal opens
  useEffect(() => {
    if (showBulkConfigModal && !bulkStartDate) {
      const weekStart = new Date(currentWeek);
      weekStart.setHours(0, 0, 0, 0);
      setBulkStartDate(weekStart.toISOString().split('T')[0]);
    }
  }, [showBulkConfigModal, currentWeek, bulkStartDate]);

  const fetchBranchHours = async () => {
    try {
      if (userBranch) {
        const branch = await getBranchById(userBranch);
        setBranchHours(branch?.operatingHours || null);
      }
    } catch (error) {
      console.error('Error fetching branch hours:', error);
      toast.error('Failed to load branch operating hours');
    }
  };

  const fetchAllScheduleConfigs = async () => {
    try {
      if (userBranch) {
        const configs = await getAllScheduleConfigurations(userBranch);
        setAllScheduleConfigs(configs);
      }
    } catch (error) {
      console.error('Error fetching schedule configurations:', error);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      if (userBranch) {
        const leaves = await getLeaveRequestsByBranch(userBranch);
        setLeaveRequests(leaves);

        console.log('Fetched leave requests:', leaves.length, leaves);

        // Create a map of staff leaves for quick lookup
        const leaveMap = {};
        leaves.forEach(leave => {
          // Only include approved or pending leaves (cancelled/rejected don't affect schedules)
          if (leave.status === 'approved' || leave.status === 'pending') {
            const employeeId = leave.employeeId;
            if (!leaveMap[employeeId]) {
              leaveMap[employeeId] = [];
            }
            
            // Ensure dates are Date objects - handle Firestore Timestamps
            let startDate, endDate;
            
            if (leave.startDate instanceof Date) {
              startDate = new Date(leave.startDate);
            } else if (leave.startDate && typeof leave.startDate.toDate === 'function') {
              startDate = leave.startDate.toDate();
            } else if (leave.startDate) {
              startDate = new Date(leave.startDate);
            } else {
              console.warn('Invalid startDate for leave:', leave);
              return; // Skip this leave if dates are invalid
            }
            
            if (leave.endDate instanceof Date) {
              endDate = new Date(leave.endDate);
            } else if (leave.endDate && typeof leave.endDate.toDate === 'function') {
              endDate = leave.endDate.toDate();
            } else if (leave.endDate) {
              endDate = new Date(leave.endDate);
            } else {
              console.warn('Invalid endDate for leave:', leave);
              return; // Skip this leave if dates are invalid
            }
            
            // Normalize dates to start of day
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            
            leaveMap[employeeId].push({
              startDate,
              endDate,
              status: leave.status,
              type: leave.type,
              reason: leave.reason
            });
            
            console.log(`Added leave to map for employee ${employeeId}:`, {
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              type: leave.type,
              status: leave.status
            });
          }
        });
        
        console.log('Staff leave map created:', {
          employeeIds: Object.keys(leaveMap),
          leaveCounts: Object.keys(leaveMap).map(id => ({ id, count: leaveMap[id].length }))
        });
        setStaffLeaveMap(leaveMap);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      // Try fetching without orderBy if the index doesn't exist
      try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('../../config/firebase');
        const q = query(
          collection(db, 'leave_requests'),
          where('branchId', '==', userBranch)
        );
        const snapshot = await getDocs(q);
        const leaves = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          startDate: doc.data().startDate?.toDate(),
          endDate: doc.data().endDate?.toDate(),
          requestedAt: doc.data().requestedAt?.toDate(),
        }));
        
        setLeaveRequests(leaves);
        
        // Create leave map
        const leaveMap = {};
        leaves.forEach(leave => {
          if (leave.status === 'approved' || leave.status === 'pending') {
            const employeeId = leave.employeeId;
            if (!leaveMap[employeeId]) {
              leaveMap[employeeId] = [];
            }
            
            const startDate = leave.startDate instanceof Date 
              ? leave.startDate 
              : (leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate));
            const endDate = leave.endDate instanceof Date 
              ? leave.endDate 
              : (leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate));
            
            leaveMap[employeeId].push({
              startDate,
              endDate,
              status: leave.status,
              type: leave.type,
              reason: leave.reason
            });
          }
        });
        setStaffLeaveMap(leaveMap);
      } catch (fallbackError) {
        console.error('Error in fallback leave fetch:', fallbackError);
      }
    }
  };

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const branchStaff = await getUsersByBranch(userBranch);
      const manageableStaff = branchStaff.filter(user => {
        const userRoles = user.roles || (user.role ? [user.role] : []);
        return userRoles.some(role => MANAGEABLE_ROLES.includes(role));
      });
      
      // Get week start date for filtering date-specific shifts
      const weekStart = new Date(currentWeek);
      weekStart.setHours(0, 0, 0, 0);
      
      // Load schedules for each staff member and merge with staff data
      const staffWithSchedules = await Promise.all(
        manageableStaff.map(async (member) => {
          const memberId = member.id || member.uid;
          if (!memberId) return member;
          
          try {
            // Get active schedule configuration, inactive configs, and date-specific shifts
            // Try both member.id and member.uid in case they're stored differently
            const { activeConfig, inactiveConfigs, dateSpecificShifts: dateSpecificShiftsList } = await getActiveSchedulesByEmployee(memberId, userBranch, weekStart);
            
            // Debug: Log member info
            console.log(`Fetching schedule for member:`, {
              memberId,
              memberUid: member.uid,
              memberIdField: member.id,
              name: getFullName(member),
              activeConfigFound: !!activeConfig
            });
            
            // Note: We no longer pre-populate member.shifts here
            // The getShiftForDay function will find the correct schedule for each date
            // based on startDate. This prevents showing "Inactive" for future dates.
            const shifts = {};
            
            // Only add shifts from the config that applies to the current week start
            // This is just for backward compatibility/fallback
            if (activeConfig && activeConfig.employeeShifts) {
              Object.entries(activeConfig.employeeShifts).forEach(([dayKey, shift]) => {
                if (shift && shift.start && shift.end) {
                  // Normalize dayKey to lowercase to match getDayKey format
                  const normalizedDayKey = dayKey.toLowerCase();
                  shifts[normalizedDayKey] = {
                    start: shift.start,
                    end: shift.end,
                    isRecurring: true,
                    isActive: true,
                    configId: activeConfig.id,
                    startDate: activeConfig.startDate
                  };
                }
              });
            }
            
            // Debug: Log if shifts are found
            if (activeConfig && Object.keys(shifts).length === 0) {
              console.log(`No shifts found for employee ${memberId} in active config:`, {
                activeConfigId: activeConfig.id,
                hasShifts: !!activeConfig.shifts,
                employeeShifts: activeConfig.employeeShifts,
                allEmployeeIds: activeConfig.shifts ? Object.keys(activeConfig.shifts) : []
              });
            }
            
            // Convert date-specific shifts to dateSpecificShifts format
            const dateSpecificShifts = {}; // Store by date string for easy lookup
            dateSpecificShiftsList.forEach(schedule => {
              const dateStr = schedule.date.toISOString().split('T')[0];
              dateSpecificShifts[dateStr] = {
                start: schedule.startTime,
                end: schedule.endTime,
                date: schedule.date,
                isDateSpecific: true,
                scheduleId: schedule.id
              };
            });
            
            return { 
              ...member, 
              shifts, 
              dateSpecificShifts,
              activeConfigId: activeConfig?.id,
              configStartDate: activeConfig?.startDate
            };
          } catch (error) {
            console.error(`Error loading schedules for ${memberId}:`, error);
            return { ...member, shifts: {}, dateSpecificShifts: {} };
          }
        })
      );
      
      setStaff(staffWithSchedules);
      
      // Fetch staff lent TO this branch and add them to the staff list
      await fetchLentToBranchStaff();
    } catch (error) {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const fetchLentToBranchStaff = async () => {
    if (!userBranch) return;
    
    try {
      // Get all staff currently lent TO this branch (from other branches)
      // Pass null to get ALL approved/active requests regardless of date
      const activeLendingsTo = await getActiveLendingForBranch(userBranch, null);
      
      // Fetch the actual staff data for lent staff
      const lentStaffData = await Promise.all(
        activeLendingsTo.map(async (lending) => {
          try {
            const staffMember = await getUserById(lending.stylistId);
            const fromBranch = await getBranchById(lending.fromBranchId);
            
            // Get week start date for filtering date-specific shifts
            const weekStart = new Date(currentWeek);
            weekStart.setHours(0, 0, 0, 0);
            
            // Load schedules for the lent staff member from their original branch
            const memberId = staffMember.id || staffMember.uid;
            let shifts = {};
            let dateSpecificShifts = {};
            
            if (memberId) {
              try {
                const { activeConfig, inactiveConfigs, dateSpecificShifts: dateSpecificShiftsList } = 
                  await getActiveSchedulesByEmployee(memberId, lending.fromBranchId, weekStart);
                
                // Build shifts object from active config
                if (activeConfig && activeConfig.shifts && activeConfig.shifts[memberId]) {
                  shifts = activeConfig.shifts[memberId];
                }
                
                // Build date-specific shifts map
                if (dateSpecificShiftsList && dateSpecificShiftsList.length > 0) {
                  dateSpecificShiftsList.forEach(schedule => {
                    if (schedule.date) {
                      const dateStr = new Date(schedule.date).toISOString().split('T')[0];
                      dateSpecificShifts[dateStr] = {
                        start: schedule.startTime,
                        end: schedule.endTime,
                        date: schedule.date,
                        isDateSpecific: true,
                        scheduleId: schedule.id
                      };
                    }
                  });
                }
              } catch (error) {
                console.error(`Error loading schedules for lent staff ${memberId}:`, error);
              }
            }
            
            return {
              ...staffMember,
              isLent: true,
              lentFromBranch: fromBranch?.branchName || fromBranch?.name || 'Unknown Branch',
              lentFromBranchId: lending.fromBranchId,
              lendingStartDate: lending.startDate,
              lendingEndDate: lending.endDate,
              shifts,
              dateSpecificShifts
            };
          } catch (error) {
            console.error('Error fetching lent staff:', error);
            return null;
          }
        })
      );
      
      const validLentStaff = lentStaffData.filter(s => s !== null);
      setLentToBranchStaff(validLentStaff);
      
      // Add lent staff to the main staff list for display
      setStaff(prevStaff => {
        // Remove any previously added lent staff to avoid duplicates
        const regularStaff = prevStaff.filter(s => !s.isLent);
        return [...regularStaff, ...validLentStaff];
      });
    } catch (error) {
      console.error('Error fetching staff lent to branch:', error);
    }
  };

  const fetchLendingData = async () => {
    if (!staff.length || !userBranch) return;
    
    try {
      const dates = getWeekDates();
      const lendingMap = {}; // Staff lent TO other branches (for display)
      const lentOutMap = {}; // Staff lent OUT FROM this branch (for validation)
      
      // Fetch all active lending where staff FROM this branch are lent out
      // Pass null to get ALL approved/active requests regardless of date
      const activeLendingsFromBranch = await getActiveLendingFromBranch(userBranch, null);
      
      // Check each staff member for active lending during the week (staff lent TO other branches)
      for (const member of staff) {
        const memberId = member.id || member.uid;
        if (!memberId) continue;
        
        // Check today's date for active lending
        const today = new Date();
        const activeLending = await getActiveLending(memberId, today);
        if (activeLending) {
          // Get branch name
          const toBranch = await getBranchById(activeLending.toBranchId);
          lendingMap[memberId] = {
            branchName: toBranch?.branchName || toBranch?.name || 'Unknown Branch',
            startDate: activeLending.startDate,
            endDate: activeLending.endDate
          };
        }
      }
      
      // Wait for all branch name fetches to complete
      await Promise.all(
        activeLendingsFromBranch.map(lending => 
          lending.stylistId ? getBranchById(lending.toBranchId).then(toBranch => {
            lentOutMap[lending.stylistId] = {
              toBranchName: toBranch?.branchName || toBranch?.name || 'Unknown Branch',
              startDate: lending.startDate,
              endDate: lending.endDate,
              lendingId: lending.id
            };
          }).catch(() => {
            lentOutMap[lending.stylistId] = {
              toBranchName: 'Unknown Branch',
              startDate: lending.startDate,
              endDate: lending.endDate,
              lendingId: lending.id
            };
          }) : Promise.resolve()
        )
      );
      
      console.log('Fetched lending data:', {
        activeLendingsFromBranch: activeLendingsFromBranch.length,
        lentOutMapCount: Object.keys(lentOutMap).length,
        lentOutMap
      });
      
      setLendingData(lendingMap);
      setLentOutData(lentOutMap);
    } catch (error) {
      console.error('Error fetching lending data:', error);
    }
  };

  const getWeekDates = () => {
    const dates = [];
    const start = new Date(currentWeek);
    start.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getDayKey = (date) => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  };

  // Helper function to find the schedule configuration that applies to a specific date
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
        if (!c.startDate) return false;
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

  const getShiftForDay = (member, dayKey, date) => {
    // Check if staff member is lent out on this date
    const memberId = member.id || member.uid;
    if (memberId && lendingData[memberId] && date) {
      const lending = lendingData[memberId];
      const dateStr = date.toISOString().split('T')[0];
      const lendingStart = lending.startDate ? new Date(lending.startDate).toISOString().split('T')[0] : null;
      const lendingEnd = lending.endDate ? new Date(lending.endDate).toISOString().split('T')[0] : null;
      
      if (lendingStart && lendingEnd && dateStr >= lendingStart && dateStr <= lendingEnd) {
        return {
          isLending: true,
          lendingBranch: lending.branchName
        };
      }
    }
    
    // First check for date-specific shift (these override recurring shifts)
    if (member.dateSpecificShifts && date) {
      const dateStr = date.toISOString().split('T')[0];
      if (member.dateSpecificShifts[dateStr]) {
        return member.dateSpecificShifts[dateStr];
      }
    }
    
    // Find the schedule configuration that applies to this specific date
    // This is the primary method - it finds the config with the most recent startDate <= date
    // Note: We check ALL configs (both active and inactive) - the isActive flag doesn't matter for date-based lookup
    if (date && allScheduleConfigs.length > 0) {
      const configForDate = getScheduleForDate(allScheduleConfigs, date);
      if (configForDate && configForDate.shifts) {
        const memberId = member.id || member.uid;
        if (memberId && configForDate.shifts[memberId]) {
          const employeeShifts = configForDate.shifts[memberId];
          if (employeeShifts[dayKey] && employeeShifts[dayKey].start && employeeShifts[dayKey].end) {
            // Always mark as active when found via date-based lookup
            // The isActive flag on the config is just for marking "current" config, not for historical/future dates
            return {
              start: employeeShifts[dayKey].start,
              end: employeeShifts[dayKey].end,
              isRecurring: true,
              isActive: true, // Always true when found via date-based lookup
              configId: configForDate.id,
              startDate: configForDate.startDate
            };
          }
        }
      }
    }
    
    // Fall back to member.shifts (for backward compatibility or if configs not loaded yet)
    // But only if it doesn't have isActive: false (which would be from old inactive configs)
    if (member.shifts && member.shifts[dayKey]) {
      const fallbackShift = member.shifts[dayKey];
      // If the fallback shift is marked inactive, don't use it - return null instead
      // This prevents showing "Inactive" for future dates
      if (fallbackShift.isActive === false) {
        return null;
      }
      return fallbackShift;
    }
    
    return null;
  };

  // Helper function to check if a staff member is lent out on a specific date
  const isStaffLentOut = (memberId, date) => {
    if (!memberId || !date) return false;
    
    // Check if staff member has any lending data
    if (!lentOutData[memberId]) {
      return false;
    }
    
    const lending = lentOutData[memberId];
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    // Handle both Date objects and timestamps
    const startDate = lending.startDate instanceof Date 
      ? new Date(lending.startDate) 
      : new Date(lending.startDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = lending.endDate instanceof Date 
      ? new Date(lending.endDate) 
      : new Date(lending.endDate);
    endDate.setHours(23, 59, 59, 999);
    
    const isLentOut = checkDate >= startDate && checkDate <= endDate;
    
    if (isLentOut) {
      console.log('Staff is lent out:', {
        memberId,
        checkDate: checkDate.toISOString(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        lending
      });
    }
    
    return isLentOut;
  };

  // Helper function to check if a staff member is on leave on a specific date
  const isStaffOnLeave = (memberId, date) => {
    if (!memberId || !date) return false;
    
    const leaves = staffLeaveMap[memberId];
    if (!leaves || leaves.length === 0) {
      return false;
    }
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    const checkTime = checkDate.getTime();
    
    // Check if date falls within any approved or pending leave period
    const isOnLeave = leaves.some(leave => {
      if (!leave.startDate || !leave.endDate) return false;
      
      // Dates should already be normalized Date objects from fetchLeaveRequests
      const startDate = leave.startDate instanceof Date ? leave.startDate : new Date(leave.startDate);
      const endDate = leave.endDate instanceof Date ? leave.endDate : new Date(leave.endDate);
      
      const startTime = startDate.getTime();
      const endTime = endDate.getTime();
      
      const result = checkTime >= startTime && checkTime <= endTime;
      
      // Debug logging (only log when match found to avoid spam)
      if (result) {
        console.log(`✓ Staff ${memberId} is on leave on ${checkDate.toISOString().split('T')[0]}:`, {
          checkDate: checkDate.toISOString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          leaveType: leave.type,
          status: leave.status
        });
      }
      
      return result;
    });
    
    return isOnLeave;
  };

  // Helper function to get leave info for a specific date
  const getLeaveInfoForDate = (memberId, date) => {
    if (!memberId || !date) return null;
    
    const leaves = staffLeaveMap[memberId];
    if (!leaves || leaves.length === 0) {
      return null;
    }
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    // Find the leave that covers this date
    const leave = leaves.find(leave => {
      if (!leave.startDate || !leave.endDate) return false;
      
      // Ensure dates are Date objects
      const startDate = leave.startDate instanceof Date 
        ? new Date(leave.startDate) 
        : (leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate));
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = leave.endDate instanceof Date 
        ? new Date(leave.endDate) 
        : (leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate));
      endDate.setHours(23, 59, 59, 999);
      
      return checkDate >= startDate && checkDate <= endDate;
    });
    
    return leave || null;
  };

  // Helper function to check if a staff member is lent TO this branch and if date is outside lending period
  const isBorrowedStaffOutsideLendingPeriod = (member, date) => {
    if (!member || !date) return false;
    
    // Check if this is a borrowed staff member (lent TO this branch)
    if (!member.isLent || !member.lendingStartDate || !member.lendingEndDate) {
      return false;
    }
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    // Handle both Date objects and timestamps
    const startDate = member.lendingStartDate instanceof Date 
      ? new Date(member.lendingStartDate) 
      : new Date(member.lendingStartDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = member.lendingEndDate instanceof Date 
      ? new Date(member.lendingEndDate) 
      : new Date(member.lendingEndDate);
    endDate.setHours(23, 59, 59, 999);
    
    // Return true if date is OUTSIDE the lending period (before start or after end)
    const isOutside = checkDate < startDate || checkDate > endDate;
    
    return isOutside;
  };

  const handleEditShift = (member, dayKey, date) => {
    // Only allow editing if in edit mode
    if (!isEditMode) return;
    
    const memberId = member.id || member.uid;
    
    // Check if staff is lent out on this date (staff lent OUT FROM this branch)
    if (date && isStaffLentOut(memberId, date)) {
      const lending = lentOutData[memberId];
      toast.error(`Cannot edit shift: Staff member is lent out to ${lending.toBranchName} from ${formatDate(lending.startDate, 'MMM dd, yyyy')} to ${formatDate(lending.endDate, 'MMM dd, yyyy')}`);
      return;
    }
    
    // Check if borrowed staff (lent TO this branch) and date is outside lending period
    if (date && isBorrowedStaffOutsideLendingPeriod(member, date)) {
      toast.error(`Cannot edit shift: Staff member is only lent to this branch from ${formatDate(member.lendingStartDate, 'MMM dd, yyyy')} to ${formatDate(member.lendingEndDate, 'MMM dd, yyyy')}`);
      return;
    }
    
    const existingShift = editableShifts[memberId]?.[dayKey];
    
    setSelectedStaff(member);
    setSelectedDay(dayKey);
    setSelectedDate(date);
    setShiftForm({
      start: existingShift?.start || '',
      end: existingShift?.end || '',
      date: date ? date.toISOString().split('T')[0] : ''
    });
    setIsAddingShift(false);
    setShowEditShiftModal(true);
  };

  const handleAddShift = (member, dayKey, date) => {
    // Only allow adding if in edit mode
    if (!isEditMode) return;
    
    const memberId = member.id || member.uid;
    
    // Check if staff is on leave on this date
    if (date && isStaffOnLeave(memberId, date)) {
      const leave = getLeaveInfoForDate(memberId, date);
      toast.error(`Cannot add shift: Staff member is on leave from ${formatDate(leave.startDate, 'MMM dd, yyyy')} to ${formatDate(leave.endDate, 'MMM dd, yyyy')}`);
      return;
    }
    
    // Check if staff is lent out on this date (staff lent OUT FROM this branch)
    if (date && isStaffLentOut(memberId, date)) {
      const lending = lentOutData[memberId];
      toast.error(`Cannot add shift: Staff member is lent out to ${lending.toBranchName} from ${formatDate(lending.startDate, 'MMM dd, yyyy')} to ${formatDate(lending.endDate, 'MMM dd, yyyy')}`);
      return;
    }
    
    // Check if borrowed staff (lent TO this branch) and date is outside lending period
    if (date && isBorrowedStaffOutsideLendingPeriod(member, date)) {
      toast.error(`Cannot add shift: Staff member is only lent to this branch from ${formatDate(member.lendingStartDate, 'MMM dd, yyyy')} to ${formatDate(member.lendingEndDate, 'MMM dd, yyyy')}`);
      return;
    }
    
    setSelectedStaff(member);
    setSelectedDay(dayKey);
    setSelectedDate(date);
    setShiftForm({ 
      start: '', 
      end: '',
      date: date ? date.toISOString().split('T')[0] : ''
    });
    setIsAddingShift(true);
    setShowEditShiftModal(true);
  };

  const handleSaveShift = () => {
    // Save shift to editableShifts state (not to database yet)
    if (!selectedStaff || !selectedDay) {
      toast.error('Please select a staff member and day');
      return;
    }

    if (!shiftForm.start || !shiftForm.end) {
      toast.error('Please enter both start and end times');
      return;
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(shiftForm.start) || !timeRegex.test(shiftForm.end)) {
      toast.error('Invalid time format. Use HH:mm format (e.g., 09:00)');
      return;
    }

    // Validate start time is before end time
    const [startHour, startMin] = shiftForm.start.split(':').map(Number);
    const [endHour, endMin] = shiftForm.end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      toast.error('End time must be after start time');
      return;
    }

    const memberId = selectedStaff.id || selectedStaff.uid;
    
    // Check if staff is on leave on the date being edited
    if (selectedDate && isStaffOnLeave(memberId, selectedDate)) {
      const leave = getLeaveInfoForDate(memberId, selectedDate);
      toast.error(`Cannot save shift: Staff member is on leave from ${formatDate(leave.startDate, 'MMM dd, yyyy')} to ${formatDate(leave.endDate, 'MMM dd, yyyy')}`);
      return;
    }
    
    // Check if staff is lent out on the date being edited (staff lent OUT FROM this branch)
    // For recurring shifts, check if staff is lent out during the config start date period
    if (selectedDate && isStaffLentOut(memberId, selectedDate)) {
      const lending = lentOutData[memberId];
      toast.error(`Cannot save shift: Staff member is lent out to ${lending.toBranchName} from ${formatDate(lending.startDate, 'MMM dd, yyyy')} to ${formatDate(lending.endDate, 'MMM dd, yyyy')}`);
      return;
    }
    
    // Check if borrowed staff (lent TO this branch) and date is outside lending period
    if (selectedDate && isBorrowedStaffOutsideLendingPeriod(selectedStaff, selectedDate)) {
      toast.error(`Cannot save shift: Staff member is only lent to this branch from ${formatDate(selectedStaff.lendingStartDate, 'MMM dd, yyyy')} to ${formatDate(selectedStaff.lendingEndDate, 'MMM dd, yyyy')}`);
      return;
    }
    
    // For recurring shifts (no specific date), we need to check the actual date for that day of the week
    // Use the week dates to find the correct date for the selected day
    if (!selectedDate && configStartDate && selectedDay) {
      const weekDates = getWeekDates();
      const dayIndex = DAYS_OF_WEEK.findIndex(d => d.key === selectedDay);
      
      if (dayIndex !== -1 && weekDates[dayIndex]) {
        const actualDate = weekDates[dayIndex];
        
        // Check if staff is on leave
        if (isStaffOnLeave(memberId, actualDate)) {
          const leave = getLeaveInfoForDate(memberId, actualDate);
          toast.error(`Cannot save shift: Staff member is on leave from ${formatDate(leave.startDate, 'MMM dd, yyyy')} to ${formatDate(leave.endDate, 'MMM dd, yyyy')}`);
          return;
        }
        
        // Check if staff is lent out (lent OUT FROM this branch)
        if (isStaffLentOut(memberId, actualDate)) {
          const lending = lentOutData[memberId];
          toast.error(`Cannot save shift: Staff member is lent out to ${lending.toBranchName} from ${formatDate(lending.startDate, 'MMM dd, yyyy')} to ${formatDate(lending.endDate, 'MMM dd, yyyy')}`);
          return;
        }
        
        // Check if borrowed staff (lent TO this branch) and date is outside lending period
        if (isBorrowedStaffOutsideLendingPeriod(selectedStaff, actualDate)) {
          toast.error(`Cannot save shift: Staff member is only lent to this branch from ${formatDate(selectedStaff.lendingStartDate, 'MMM dd, yyyy')} to ${formatDate(selectedStaff.lendingEndDate, 'MMM dd, yyyy')}`);
          return;
        }
      }
    }
    
    // Save to editableShifts state
    setEditableShifts(prev => ({
      ...prev,
      [memberId]: {
        ...(prev[memberId] || {}),
        [selectedDay]: {
          start: shiftForm.start,
          end: shiftForm.end
        }
      }
    }));

    toast.success(isAddingShift ? 'Shift added to list' : 'Shift updated');
    setShowEditShiftModal(false);
    setSelectedStaff(null);
    setSelectedDay(null);
    setSelectedDate(null);
    setShiftForm({ start: '', end: '', date: '' });
    setIsAddingShift(false);
  };

  const handleSaveAllShifts = async () => {
    if (!userBranch || !configStartDate) {
      toast.error('Please set a start date for this configuration');
      return;
    }

    // Validate that shifts are not being added for days when staff are lent out
    // Only block if there are shifts configured for days when staff are lent out
    const weekDates = getWeekDates();
    const validationErrors = [];
    
    Object.entries(editableShifts).forEach(([memberId, employeeShifts]) => {
      const staffMember = staff.find(s => (s.id || s.uid) === memberId);
      const memberName = staffMember ? getFullName(staffMember) : 'Staff member';
      
      // Check each day that has a shift configured
      Object.keys(employeeShifts).forEach(dayKey => {
        const shift = employeeShifts[dayKey];
        // Only check if shift has both start and end times
        if (shift.start && shift.end) {
          // Find the date for this day of the week using weekDates
          const dayIndex = DAYS_OF_WEEK.findIndex(d => d.key === dayKey);
          if (dayIndex !== -1 && weekDates[dayIndex]) {
            const actualDate = weekDates[dayIndex];
            
            // Check if staff is on leave on this specific date
            if (isStaffOnLeave(memberId, actualDate)) {
              const leave = getLeaveInfoForDate(memberId, actualDate);
              const dayLabel = DAYS_OF_WEEK[dayIndex]?.label || dayKey;
              validationErrors.push(
                `${memberName} - ${dayLabel} (${formatDate(actualDate, 'MMM dd, yyyy')}): On leave from ${formatDate(leave.startDate, 'MMM dd, yyyy')} to ${formatDate(leave.endDate, 'MMM dd, yyyy')}`
              );
              return; // Skip this day - use return instead of continue in forEach
            }
            
            // Check if staff is lent out on this specific date (lent OUT FROM this branch)
            if (isStaffLentOut(memberId, actualDate)) {
              const lending = lentOutData[memberId];
              const dayLabel = DAYS_OF_WEEK[dayIndex]?.label || dayKey;
              validationErrors.push(
                `${memberName} - ${dayLabel} (${formatDate(actualDate, 'MMM dd, yyyy')}): Lent out to ${lending.toBranchName}`
              );
            }
            
            // Check if borrowed staff (lent TO this branch) and date is outside lending period
            if (staffMember && isBorrowedStaffOutsideLendingPeriod(staffMember, actualDate)) {
              const dayLabel = DAYS_OF_WEEK[dayIndex]?.label || dayKey;
              validationErrors.push(
                `${memberName} - ${dayLabel} (${formatDate(actualDate, 'MMM dd, yyyy')}): Only lent to this branch from ${formatDate(staffMember.lendingStartDate, 'MMM dd, yyyy')} to ${formatDate(staffMember.lendingEndDate, 'MMM dd, yyyy')}`
              );
            }
          }
        }
      });
    });
    
    if (validationErrors.length > 0) {
      toast.error(`Cannot save shifts for the following:\n${validationErrors.join('\n')}`, { duration: 6000 });
      return;
    }

    try {
      setSaving(true);
      
      // Validate all shifts against branch hours
      const validationErrors = [];
      Object.entries(editableShifts).forEach(([employeeId, employeeShifts]) => {
        const member = staff.find(s => (s.id || s.uid) === employeeId);
        const memberName = member ? getFullName(member) : 'Staff member';
        
        Object.entries(employeeShifts).forEach(([dayKey, shift]) => {
          if (shift.start && shift.end) {
            const validation = validateShiftAgainstBranchHours(dayKey, shift.start, shift.end);
            if (!validation.valid) {
              validationErrors.push(`${memberName} - ${DAYS_OF_WEEK.find(d => d.key === dayKey)?.label}: ${validation.message}`);
            }
          }
        });
      });

      if (validationErrors.length > 0) {
        toast.error(`Invalid shifts:\n${validationErrors.join('\n')}`, { duration: 5000 });
        setSaving(false);
        return;
      }
      
      // Prepare shifts data structure: { employeeId: { monday: {start, end}, ... }, ... }
      const shiftsData = {};
      
      Object.entries(editableShifts).forEach(([employeeId, employeeShifts]) => {
        const cleanedShifts = {};
        Object.entries(employeeShifts).forEach(([dayKey, shift]) => {
          // Only include shifts that have both start and end times
          if (shift.start && shift.end) {
            cleanedShifts[dayKey] = {
              start: shift.start,
              end: shift.end
            };
          }
        });
        
        // Only add employee if they have at least one shift
        if (Object.keys(cleanedShifts).length > 0) {
          shiftsData[employeeId] = cleanedShifts;
        }
      });

      if (Object.keys(shiftsData).length === 0) {
        toast.error('Please configure at least one shift for at least one staff member');
        setSaving(false);
        return;
      }

      // Save all shifts at once as ONE document
      await createOrUpdateScheduleConfiguration({
        branchId: userBranch,
        shifts: shiftsData,
        startDate: configStartDate,
        notes: 'Calendar-based configuration'
      });

      toast.success('All shifts saved successfully!');
      setIsEditMode(false);
      setEditableShifts({});
      setConfigStartDate('');
      
      // Reload staff schedules
      await fetchStaff();
    } catch (error) {
      console.error('Error saving shifts:', error);
      toast.error(error.message || 'Failed to save shifts');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (member, dayKey, date) => {
    const shift = getShiftForDay(member, dayKey, date);
    const isDateSpecific = shift?.isDateSpecific;
    const dateStr = date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    const dayLabel = DAYS_OF_WEEK.find(d => d.key === dayKey)?.label;
    
    if (!confirm(`Remove shift for ${isDateSpecific ? dateStr : dayLabel}?`)) {
      return;
    }

    if (!userBranch) {
      toast.error('Branch information not available');
      return;
    }

    try {
      const memberId = member.id || member.uid;
      
      if (isDateSpecific && date) {
        // For date-specific shifts, we need to deactivate by date
        // We'll need to update the deactivateSchedule function or create a new one
        // For now, let's use a workaround - find and deactivate the specific schedule
        const weekStart = new Date(currentWeek);
        weekStart.setHours(0, 0, 0, 0);
        const schedules = await getActiveSchedulesByEmployee(memberId, userBranch, weekStart);
        const scheduleToDelete = schedules.find(s => {
          if (s.date) {
            const sDate = s.date.toISOString().split('T')[0];
            const targetDate = date.toISOString().split('T')[0];
            return sDate === targetDate;
          }
          return false;
        });
        
        if (scheduleToDelete) {
          const { deleteSchedule } = await import('../../services/scheduleService');
          await deleteSchedule(scheduleToDelete.id);
        }
      } else {
        // Recurring shift
        const dayOfWeek = convertDayKeyToDayOfWeek(dayKey);
        if (!dayOfWeek) {
          throw new Error('Invalid day selected');
        }
        await deactivateSchedule(memberId, dayOfWeek, userBranch);
      }
      
      // Reload schedules
      const weekStart = new Date(currentWeek);
      weekStart.setHours(0, 0, 0, 0);
      const schedules = await getActiveSchedulesByEmployee(memberId, userBranch, weekStart);
      const shifts = {};
      const dateSpecificShifts = {};
      
      schedules.forEach(schedule => {
        if (schedule.date) {
          const dateStr = schedule.date.toISOString().split('T')[0];
          dateSpecificShifts[dateStr] = {
            start: schedule.startTime,
            end: schedule.endTime,
            date: schedule.date,
            isDateSpecific: true,
            scheduleId: schedule.id
          };
        } else {
          const dayKey = schedule.dayOfWeek?.toLowerCase();
          if (dayKey) {
            shifts[dayKey] = {
              start: schedule.startTime,
              end: schedule.endTime,
              isRecurring: true,
              scheduleId: schedule.id
            };
          }
        }
      });
      
      // Update local state
      setStaff(prev => prev.map(s => {
        const sId = s.id || s.uid;
        if (sId === memberId) {
          return { ...s, shifts, dateSpecificShifts };
        }
        return s;
      }));

      toast.success('Shift removed successfully');
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast.error(error.message || 'Failed to remove shift');
    }
  };

  const handleViewHistory = async (member) => {
    if (!userBranch) {
      toast.error('Branch information not available');
      return;
    }

    try {
      setLoadingHistory(true);
      setSelectedStaff(member);
      const memberId = member.id || member.uid;
      
      // Fetch shift history
      const history = await getScheduleHistoryByEmployee(memberId, userBranch);
      setShiftHistory(history);
      setShowHistoryModal(true);
    } catch (error) {
      console.error('Error loading shift history:', error);
      toast.error('Failed to load shift history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const validateShiftAgainstBranchHours = (dayKey, startTime, endTime) => {
    if (!branchHours) return { valid: true }; // If no branch hours, allow any time
    
    const dayHours = branchHours[dayKey];
    if (!dayHours || !dayHours.isOpen) {
      return { 
        valid: false, 
        message: `${DAYS_OF_WEEK.find(d => d.key === dayKey)?.label} is closed` 
      };
    }

    if (startTime >= endTime) {
      return { 
        valid: false, 
        message: 'End time must be after start time' 
      };
    }

    if (startTime < dayHours.open) {
      return { 
        valid: false, 
        message: `Start time must be after branch opening time (${dayHours.open})` 
      };
    }

    if (endTime > dayHours.close) {
      return { 
        valid: false, 
        message: `End time must be before branch closing time (${dayHours.close})` 
      };
    }

    return { valid: true };
  };

  const handleSaveBulkShiftsFromModal = async () => {
    if (!userBranch) {
      toast.error('Branch information not available');
      return;
    }

    if (selectedStaffIds.length === 0) {
      toast.error('Please select at least one stylist');
      return;
    }

    // Validate each selected staff has times and days set
    const invalidStaff = selectedStaffIds.filter(staffId => {
      const times = staffTimes[staffId];
      const days = staffDays[staffId] || [];
      return !times || !times.start || !times.end || days.length === 0;
    });

    if (invalidStaff.length > 0) {
      const member = staff.find(s => (s.id || s.uid) === invalidStaff[0]);
      toast.error(`Please set times and select at least one day for ${getFullName(member)}`);
      return;
    }

    // Validate time format and logic for each staff
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    for (const staffId of selectedStaffIds) {
      const times = staffTimes[staffId];
      if (!timeRegex.test(times.start) || !timeRegex.test(times.end)) {
        const member = staff.find(s => (s.id || s.uid) === staffId);
        toast.error(`Invalid time format for ${getFullName(member)}. Use HH:mm format (e.g., 09:00)`);
        return;
      }

      const [startHour, startMin] = times.start.split(':').map(Number);
      const [endHour, endMin] = times.end.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (endMinutes <= startMinutes) {
        const member = staff.find(s => (s.id || s.uid) === staffId);
        toast.error(`End time must be after start time for ${getFullName(member)}`);
        return;
      }
    }

    try {
      setSaving(true);
      
      // Get current active configuration to update it
      const allConfigs = await getScheduleConfigurationsByBranch(userBranch);
      const activeConfig = allConfigs.find(c => c.isActive);
      
      // Prepare shifts data structure
      const shiftsData = activeConfig?.shifts || {};
      
      // Add shifts for all selected staff with their individual days and times
      selectedStaffIds.forEach(employeeId => {
        if (!shiftsData[employeeId]) {
          shiftsData[employeeId] = {};
        }
        
        const times = staffTimes[employeeId];
        const days = staffDays[employeeId] || [];
        
        // Add shifts for each day this employee is scheduled
        days.forEach(dayKey => {
          shiftsData[employeeId][dayKey] = {
            start: times.start,
            end: times.end
          };
        });
      });

      if (activeConfig) {
        // Update existing configuration
        await updateDoc(doc(db, 'schedules', activeConfig.id), {
          shifts: shiftsData,
          updatedAt: Timestamp.now()
        });
      } else {
        // Create new configuration with start date = current week start
        const weekStart = new Date(currentWeek);
        weekStart.setHours(0, 0, 0, 0);
        await createOrUpdateScheduleConfiguration({
          branchId: userBranch,
          shifts: shiftsData,
          startDate: weekStart.toISOString().split('T')[0],
          notes: 'Bulk shift creation'
        });
      }

      const totalShifts = selectedStaffIds.reduce((sum, id) => {
        const days = staffDays[id] || [];
        return sum + days.length;
      }, 0);
      
      toast.success(`Successfully created ${totalShifts} shift(s)!`);
      setShowShiftModal(false);
      setSelectedStaffIds([]);
      setSelectedDays([]);
      setStaffTimes({});
      setStaffDays({});
      setShiftForm({ start: '', end: '', date: '' });
      
      // Reload staff schedules
      await fetchStaff();
    } catch (error) {
      console.error('Error saving bulk shifts:', error);
      toast.error(error.message || 'Failed to save shifts');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBulkShifts = async () => {
    if (!userBranch || !bulkStartDate) {
      toast.error('Please select a start date');
      return;
    }

    try {
      setSaving(true);
      
      // Prepare shifts data structure: { employeeId: { monday: {start, end}, ... }, ... }
      const shiftsData = {};
      
      Object.entries(bulkShifts).forEach(([employeeId, employeeShifts]) => {
        const cleanedShifts = {};
        Object.entries(employeeShifts).forEach(([dayKey, shift]) => {
          // Only include shifts that have both start and end times
          if (shift.start && shift.end) {
            cleanedShifts[dayKey] = {
              start: shift.start,
              end: shift.end
            };
          }
        });
        
        // Only add employee if they have at least one shift
        if (Object.keys(cleanedShifts).length > 0) {
          shiftsData[employeeId] = cleanedShifts;
        }
      });

      if (Object.keys(shiftsData).length === 0) {
        toast.error('Please configure at least one shift for at least one staff member');
        return;
      }

      // Save all shifts at once
      await createOrUpdateScheduleConfiguration({
        branchId: userBranch,
        shifts: shiftsData,
        startDate: bulkStartDate,
        notes: 'Bulk configuration - all staff shifts'
      });

      toast.success('All shifts configured successfully!');
      setShowBulkConfigModal(false);
      
      // Reload staff schedules
      await fetchStaff();
    } catch (error) {
      console.error('Error saving bulk shifts:', error);
      toast.error(error.message || 'Failed to save shifts');
    } finally {
      setSaving(false);
    }
  };


  const navigateWeek = (direction) => {
    setCurrentWeek(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
      return newDate;
    });
  };

  const goToToday = () => {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeek(new Date(date.setDate(diff)));
  };

  const weekDates = useMemo(() => getWeekDates(), [currentWeek]);
  const isCurrentWeek = useMemo(() => {
    const today = new Date();
    const weekStart = new Date(currentWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return today >= weekStart && today <= weekEnd;
  }, [currentWeek]);

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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Schedule</h1>
          <p className="text-gray-600 mt-1">Weekly view of staff shifts and availability</p>
        </div>
        <div className="flex items-center gap-2">
          {!isEditMode ? (
            <button
              onClick={() => {
                // Enter edit mode - initialize editable shifts with current shifts
                const initialEditableShifts = {};
                staff.forEach(member => {
                  const memberId = member.id || member.uid;
                  if (memberId) {
                    initialEditableShifts[memberId] = {};
                    DAYS_OF_WEEK.forEach(day => {
                      const existingShift = member.shifts?.[day.key];
                      if (existingShift) {
                        initialEditableShifts[memberId][day.key] = {
                          start: existingShift.start || '',
                          end: existingShift.end || ''
                        };
                      }
                    });
                  }
                });
                setEditableShifts(initialEditableShifts);
                
                // Set start date to the current week being viewed
                const weekStart = new Date(currentWeek);
                weekStart.setHours(0, 0, 0, 0);
                setConfigStartDate(weekStart.toISOString().split('T')[0]);
                
                setIsEditMode(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Shift
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={configStartDate}
                onChange={(e) => {
                  setConfigStartDate(e.target.value);
                  // Update currentWeek to match the start date
                  if (e.target.value) {
                    const date = new Date(e.target.value);
                    const day = date.getDay();
                    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                    setCurrentWeek(new Date(date.setDate(diff)));
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
              <button
                onClick={handleSaveAllShifts}
                disabled={saving || !configStartDate}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calendar className="w-4 h-4" />
                Save All Shifts
              </button>
              <button
                onClick={() => {
                  setIsEditMode(false);
                  setEditableShifts({});
                  setConfigStartDate('');
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          <button
            onClick={() => navigateWeek('prev')}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            title="Previous Week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToToday}
            className={`px-4 py-2 rounded-lg border transition-colors text-sm ${
              isCurrentWeek
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Today
          </button>
          <div className="min-w-[200px] text-center font-semibold text-gray-900">
            {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
            {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <button
            onClick={() => navigateWeek('next')}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            title="Next Week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Staff</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{staff.length}</p>
            </div>
            <Users className="w-8 h-8 text-primary-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Staff with Shifts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {staff.filter(s => s.shifts && Object.keys(s.shifts).length > 0).length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active This Week</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {staff.filter(s => {
                  if (!s.shifts) return false;
                  return weekDates.some(date => {
                    const dayKey = getDayKey(date);
                    return s.shifts[dayKey];
                  });
                }).length}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Schedule Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                  Staff Member
                </th>
                {weekDates.map((date, index) => {
                  const isToday = date.toDateString() === new Date().toDateString();
                  const dayKey = getDayKey(date);
                  const dayInfo = DAYS_OF_WEEK.find(d => d.key === dayKey);
                  
                  return (
                    <th
                      key={index}
                      className={`px-4 py-3 text-center text-xs font-medium uppercase tracking-wider min-w-[140px] ${
                        isToday ? 'bg-primary-50 text-primary-700' : 'text-gray-500'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-semibold">{dayInfo?.short}</span>
                        <span className="text-xs font-normal mt-1">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staff.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    No staff members found
                  </td>
                </tr>
              ) : (
                staff.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap sticky left-0 bg-white z-10">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {getInitials(member)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-gray-900">
                            {getFullName(member)}
                            {member.isLent && (
                              <span className="ml-2 text-xs font-normal text-blue-600">(lent)</span>
                            )}
                            {!member.isLent && lentOutData[member.id || member.uid] && (
                              <span className="ml-2 text-xs font-normal text-orange-600">(lent)</span>
                            )}
                            </div>
                            <button
                              onClick={() => handleViewHistory(member)}
                              className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                              title="View shift history"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-xs text-gray-500">
                            {member.email}
                          </div>
                          {member.isLent && member.lentFromBranch && (
                            <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                              <ArrowRight className="w-3 h-3" />
                              From: {member.lentFromBranch}
                            </div>
                          )}
                          {!member.isLent && lendingData[member.id || member.uid] && (
                            <div className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                              <ArrowRight className="w-3 h-3" />
                              Lent to {lendingData[member.id || member.uid].branchName}
                            </div>
                          )}
                          {!member.isLent && lentOutData[member.id || member.uid] && (
                            <div className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                              <ArrowRight className="w-3 h-3" />
                              Lent to {lentOutData[member.id || member.uid].toBranchName}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    {weekDates.map((date, index) => {
                      const dayKey = getDayKey(date);
                      const shift = getShiftForDay(member, dayKey, date);
                      const isToday = date.toDateString() === new Date().toDateString();
                      const isDateSpecific = shift?.isDateSpecific;
                      
                      return (
                        <td
                          key={index}
                          className={`px-4 py-4 text-center ${
                            isToday ? 'bg-primary-50' : ''
                          }`}
                        >
                          {isEditMode ? (
                            // Edit Mode - Show shifts from editableShifts or Add button
                            (() => {
                              const memberId = member.id || member.uid;
                              const editableShift = editableShifts[memberId]?.[dayKey];
                              
                              // Check if staff is on leave on this date
                              const onLeave = date && isStaffOnLeave(memberId, date);
                              const leaveInfo = date && onLeave ? getLeaveInfoForDate(memberId, date) : null;
                              
                              // Check if there's a lending day (can't edit)
                              if (shift?.isLending) {
                                return (
                                  <>
                                    <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                                      shift.isLentToBranch 
                                        ? 'bg-blue-100 text-blue-800' 
                                        : 'bg-purple-100 text-purple-800'
                                    }`}>
                                      LENDING
                                    </div>
                                    {shift.lendingBranch && (
                                      <div className={`text-xs font-medium ${
                                        shift.isLentToBranch 
                                          ? 'text-blue-600' 
                                          : 'text-purple-600'
                                      }`}>
                                        {shift.isLentToBranch ? 'From: ' : 'To: '}{shift.lendingBranch}
                                      </div>
                                    )}
                                  </>
                                );
                              }
                              
                              // Check if staff is on leave (show leave indicator, can't edit)
                              if (onLeave && leaveInfo) {
                                const leaveTypeLabels = {
                                  vacation: 'Vacation',
                                  sick: 'Sick',
                                  personal: 'Personal',
                                  emergency: 'Emergency',
                                  maternity: 'Maternity',
                                  paternity: 'Paternity',
                                  bereavement: 'Bereavement',
                                  undetermined: 'Undetermined'
                                };
                                return (
                                  <>
                                    <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-100 text-orange-800">
                                      ON LEAVE
                                    </div>
                                    <div className="text-xs text-orange-600 font-medium">
                                      {leaveTypeLabels[leaveInfo.type] || 'Leave'}
                                    </div>
                                    {leaveInfo.status === 'pending' && (
                                      <div className="text-xs text-yellow-600">
                                        (Pending)
                                      </div>
                                    )}
                                  </>
                                );
                              }
                              
                              // Check if staff is lent out on this date (lent OUT FROM this branch)
                              const isLentOut = date && isStaffLentOut(memberId, date);
                              
                              // Check if borrowed staff (lent TO this branch) and date is outside lending period
                              const isBorrowedOutsidePeriod = date && isBorrowedStaffOutsideLendingPeriod(member, date);
                              
                              // Combined check: cannot edit if on leave, lent out OR borrowed outside period
                              const cannotEdit = onLeave || isLentOut || isBorrowedOutsidePeriod;
                              
                              // Show editable shift if exists
                              if (editableShift && editableShift.start && editableShift.end) {
                                return (
                                  <div 
                                    className={`flex flex-col items-center gap-1 ${cannotEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                    onClick={() => !cannotEdit && handleEditShift(member, dayKey, date)}
                                    title={cannotEdit ? (onLeave ? `Cannot edit: Staff member is on leave from ${formatDate(leaveInfo.startDate, 'MMM dd, yyyy')} to ${formatDate(leaveInfo.endDate, 'MMM dd, yyyy')}` : isBorrowedOutsidePeriod ? `Cannot edit: Staff only lent to this branch from ${formatDate(member.lendingStartDate, 'MMM dd, yyyy')} to ${formatDate(member.lendingEndDate, 'MMM dd, yyyy')}` : 'Cannot edit: Staff member is lent out') : 'Click to edit'}
                                  >
                                    <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                                      cannotEdit 
                                        ? 'bg-gray-100 text-gray-500' 
                                        : 'bg-primary-100 text-primary-800 hover:bg-primary-200'
                                    }`}>
                                      {formatTime12Hour(editableShift.start)} - {formatTime12Hour(editableShift.end)}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {Math.round(
                                        ((new Date(`2000-01-01 ${editableShift.end}`) - new Date(`2000-01-01 ${editableShift.start}`)) / (1000 * 60 * 60)) * 10
                                      ) / 10}h
                                    </div>
                                    {cannotEdit ? (
                                      <div className="text-xs text-red-600 font-medium">
                                        {onLeave ? 'On Leave' : isBorrowedOutsidePeriod ? 'Outside lending period' : 'Lent out'}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-primary-600 font-medium">
                                        Click to edit
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              
                              // Show Add button (disabled if lent out or borrowed outside period)
                              return (
                                <button
                                  onClick={() => handleAddShift(member, dayKey, date)}
                                  disabled={cannotEdit}
                                  className={`w-full py-2 text-xs rounded transition-colors flex items-center justify-center gap-1 ${
                                    cannotEdit
                                      ? 'text-gray-300 cursor-not-allowed bg-gray-50'
                                      : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
                                  }`}
                                  title={cannotEdit ? (onLeave ? `Cannot add shift: Staff member is on leave from ${formatDate(leaveInfo.startDate, 'MMM dd, yyyy')} to ${formatDate(leaveInfo.endDate, 'MMM dd, yyyy')}` : isBorrowedOutsidePeriod ? `Cannot add shift: Staff only lent to this branch from ${formatDate(member.lendingStartDate, 'MMM dd, yyyy')} to ${formatDate(member.lendingEndDate, 'MMM dd, yyyy')}` : 'Cannot add shift: Staff member is lent out') : 'Add shift'}
                                >
                                  <Plus className="w-3 h-3" />
                                  Add
                                </button>
                              );
                            })()
                          ) : (
                            // View Mode - Display existing shifts
                            (() => {
                              const memberId = member.id || member.uid;
                              const onLeave = date && isStaffOnLeave(memberId, date);
                              const leaveInfo = date && onLeave ? getLeaveInfoForDate(memberId, date) : null;
                              
                              // Show leave indicator if staff is on leave
                              if (onLeave && leaveInfo) {
                                const leaveTypeLabels = {
                                  vacation: 'Vacation',
                                  sick: 'Sick',
                                  personal: 'Personal',
                                  emergency: 'Emergency',
                                  maternity: 'Maternity',
                                  paternity: 'Paternity',
                                  bereavement: 'Bereavement',
                                  undetermined: 'Undetermined'
                                };
                                return (
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-100 text-orange-800">
                                      ON LEAVE
                                    </div>
                                    <div className="text-xs text-orange-600 font-medium">
                                      {leaveTypeLabels[leaveInfo.type] || 'Leave'}
                                    </div>
                                    {leaveInfo.status === 'pending' && (
                                      <div className="text-xs text-yellow-600">
                                        (Pending)
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              
                              // Show shift if exists
                              return shift ? (
                                <div 
                                  className="flex flex-col items-center gap-1 group relative"
                                >
                                  {shift.isLending ? (
                                    <>
                                      <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                                        shift.isLentToBranch 
                                          ? 'bg-blue-100 text-blue-800' 
                                          : 'bg-purple-100 text-purple-800'
                                      }`}>
                                        LENDING
                                      </div>
                                      {shift.lendingBranch && (
                                        <div className={`text-xs font-medium ${
                                          shift.isLentToBranch 
                                            ? 'text-blue-600' 
                                            : 'text-purple-600'
                                        }`}>
                                          {shift.isLentToBranch ? 'From: ' : 'To: '}{shift.lendingBranch}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <div 
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                          isDateSpecific 
                                            ? 'bg-blue-100 text-blue-800' 
                                            : shift.isActive === false
                                            ? 'bg-gray-100 text-gray-500 line-through'
                                            : 'bg-primary-100 text-primary-800'
                                        }`}
                                      >
                                        {formatTime12Hour(shift.start)} - {formatTime12Hour(shift.end)}
                                      </div>
                                      {isDateSpecific && (
                                        <div className="text-xs text-blue-600 font-medium">
                                          One-Time
                                        </div>
                                      )}
                                      {shift.isRecurring && shift.isActive === false && (
                                        <div className="text-xs font-medium text-gray-500 line-through">
                                          Inactive
                                        </div>
                                      )}
                                      <div className="text-xs text-gray-500">
                                        {Math.round(
                                          ((new Date(`2000-01-01 ${shift.end}`) - new Date(`2000-01-01 ${shift.start}`)) / (1000 * 60 * 60)) * 10
                                        ) / 10}h
                                      </div>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-300">-</div>
                              );
                            })()
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Shift Modal - Full Page */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white w-full h-full max-w-full max-h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Add Shift</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Select stylists and days, then set the time. This will create recurring shifts for all selected combinations.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowShiftModal(false);
                  setSelectedStaff(null);
                  setSelectedDay(null);
                  setSelectedDate(null);
                  setShiftForm({ start: '', end: '', date: '' });
                  setSelectedStaffIds([]);
                  setSelectedDays([]);
                  setStaffTimes({});
                  setStaffDays({});
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={saving}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content - Full Height */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-6xl mx-auto">
                  {/* Stylists with Individual Days and Times */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Configure Each Stylist's Shifts
                    </h3>
                    <p className="text-sm text-gray-600 mb-6">
                      Select each stylist, choose their days, and set their times. Each stylist can have different days and times.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
                      {staff.length === 0 ? (
                        <p className="text-gray-500 text-sm col-span-2">No staff members found</p>
                      ) : (
                        staff.map((member) => {
                          const memberId = member.id || member.uid;
                          if (!memberId) return null;
                          const isSelected = selectedStaffIds.includes(memberId);
                          const times = staffTimes[memberId] || { start: '', end: '' };
                          const days = staffDays[memberId] || [];
                          
                          return (
                            <div
                              key={memberId}
                              className={`p-5 rounded-lg transition-colors ${
                                isSelected
                                  ? 'bg-primary-50 border-2 border-primary-500'
                                  : 'bg-white border-2 border-gray-200'
                              }`}
                            >
                              {/* Stylist Selection */}
                              <label className="flex items-center gap-3 cursor-pointer mb-4">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedStaffIds([...selectedStaffIds, memberId]);
                                      // Initialize times and days if not set
                                      if (!staffTimes[memberId]) {
                                        setStaffTimes(prev => ({
                                          ...prev,
                                          [memberId]: { start: '', end: '' }
                                        }));
                                      }
                                      if (!staffDays[memberId]) {
                                        setStaffDays(prev => ({
                                          ...prev,
                                          [memberId]: []
                                        }));
                                      }
                                    } else {
                                      setSelectedStaffIds(selectedStaffIds.filter(id => id !== memberId));
                                    }
                                  }}
                                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                />
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="flex-shrink-0 w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                                    {getInitials(member)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-base font-medium text-gray-900">
                                      {getFullName(member)}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">{member.email}</p>
                                  </div>
                                </div>
                              </label>
                              
                              {isSelected && (
                                <div className="mt-4 pt-4 border-t border-gray-300 space-y-4">
                                  {/* Days Selection for this Stylist */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                      Select Days for {getFullName(member)} <span className="text-red-500">*</span>
                                    </label>
                                    <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                                      {DAYS_OF_WEEK.map((day) => {
                                        const isDaySelected = days.includes(day.key);
                                        return (
                                          <label
                                            key={day.key}
                                            className={`flex flex-col items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                                              isDaySelected
                                                ? 'bg-primary-100 border-2 border-primary-500'
                                                : 'bg-white border-2 border-gray-200 hover:border-primary-300'
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isDaySelected}
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  setStaffDays(prev => ({
                                                    ...prev,
                                                    [memberId]: [...(prev[memberId] || []), day.key]
                                                  }));
                                                } else {
                                                  setStaffDays(prev => ({
                                                    ...prev,
                                                    [memberId]: (prev[memberId] || []).filter(d => d !== day.key)
                                                  }));
                                                }
                                              }}
                                              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                            />
                                            <div className="text-center">
                                              <p className="text-xs font-medium text-gray-900">{day.short}</p>
                                              <p className="text-xs text-gray-500">{day.label}</p>
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                    <div className="mt-2">
                                      <button
                                        onClick={() => {
                                          if (days.length === DAYS_OF_WEEK.length) {
                                            setStaffDays(prev => ({
                                              ...prev,
                                              [memberId]: []
                                            }));
                                          } else {
                                            setStaffDays(prev => ({
                                              ...prev,
                                              [memberId]: DAYS_OF_WEEK.map(d => d.key)
                                            }));
                                          }
                                        }}
                                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                      >
                                        {days.length === DAYS_OF_WEEK.length ? 'Deselect All Days' : 'Select All Days'}
                                      </button>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {days.length} of {DAYS_OF_WEEK.length} days selected
                                      </p>
                                    </div>
                                  </div>

                                  {/* Time Selection for this Stylist */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                                        value={times.start}
                                        onChange={(e) => {
                                          setStaffTimes(prev => ({
                                            ...prev,
                                            [memberId]: {
                                              ...prev[memberId],
                                              start: e.target.value
                                            }
                                          }));
                                        }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        required={isSelected}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                                        value={times.end}
                                        onChange={(e) => {
                                          setStaffTimes(prev => ({
                                            ...prev,
                                            [memberId]: {
                                              ...prev[memberId],
                                              end: e.target.value
                                            }
                                          }));
                                        }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        required={isSelected}
                  />
                </div>
              </div>
                                  {times.start && times.end && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                                      <p className="text-xs text-blue-800">
                    <strong>Duration:</strong>{' '}
                    {(() => {
                                          const [startHour, startMin] = times.start.split(':').map(Number);
                                          const [endHour, endMin] = times.end.split(':').map(Number);
                      const startMinutes = startHour * 60 + startMin;
                      const endMinutes = endHour * 60 + endMin;
                      const duration = (endMinutes - startMinutes) / 60;
                      return `${duration.toFixed(1)} hours`;
                    })()}
                  </p>
                </div>
              )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
            </div>

                {/* Summary */}
                {selectedStaffIds.length > 0 && (
                  <div className="mt-6 max-w-4xl mx-auto">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-800 mb-3">
                        <strong>Summary:</strong> Creating recurring shifts for{' '}
                        <strong>{selectedStaffIds.length}</strong> stylist{selectedStaffIds.length !== 1 ? 's' : ''}
                      </p>
                      <div className="mt-2 space-y-2">
                        {selectedStaffIds.map(staffId => {
                          const member = staff.find(s => (s.id || s.uid) === staffId);
                          const times = staffTimes[staffId] || { start: '', end: '' };
                          const days = staffDays[staffId] || [];
                          if (!times.start || !times.end || days.length === 0) return null;
                          const dayLabels = days.map(d => DAYS_OF_WEEK.find(day => day.key === d)?.short).join(', ');
                          return (
                            <div key={staffId} className="bg-white rounded p-2 border border-green-200">
                              <p className="text-xs text-green-800 font-medium">
                                ΓÇó {getFullName(member)}: {times.start} - {times.end} on {dayLabels} ({days.length} day{days.length !== 1 ? 's' : ''})
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      {selectedStaffIds.some(id => {
                        const times = staffTimes[id];
                        const days = staffDays[id] || [];
                        return times?.start && times?.end && days.length > 0;
                      }) && (
                        <p className="text-xs text-green-700 mt-3">
                          Total: <strong>{selectedStaffIds.reduce((sum, id) => {
                            const days = staffDays[id] || [];
                            return sum + days.length;
                          }, 0)}</strong> shift{selectedStaffIds.reduce((sum, id) => {
                            const days = staffDays[id] || [];
                            return sum + days.length;
                          }, 0) !== 1 ? 's' : ''} will be created
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
                <div className="text-sm text-gray-600">
                  <p>ΓÜá∩╕Å This will create recurring shifts that automatically appear every week.</p>
                </div>
                <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowShiftModal(false);
                  setSelectedStaff(null);
                  setSelectedDay(null);
                      setSelectedDate(null);
                      setShiftForm({ start: '', end: '', date: '' });
                      setSelectedStaffIds([]);
                      setSelectedDays([]);
                      setStaffTimes({});
                      setStaffDays({});
                    }}
                    className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveBulkShiftsFromModal}
                    disabled={saving || selectedStaffIds.length === 0 || selectedStaffIds.some(id => {
                      const times = staffTimes[id];
                      const days = staffDays[id] || [];
                      return !times || !times.start || !times.end || days.length === 0;
                    })}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {saving ? 'Saving...' : (() => {
                      const totalShifts = selectedStaffIds.reduce((sum, id) => {
                        const days = staffDays[id] || [];
                        return sum + days.length;
                      }, 0);
                      return `Save ${totalShifts} Shift${totalShifts !== 1 ? 's' : ''}`;
                    })()}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shift History Modal */}
      {showHistoryModal && selectedStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Shift History</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {getFullName(selectedStaff)} - All shift changes over time
                </p>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedStaff(null);
                  setShiftHistory([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={loadingHistory}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : shiftHistory.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No shift history found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {shiftHistory.map((config) => (
                    <div
                      key={config.id}
                      className={`border rounded-lg p-4 ${
                        config.isActive
                          ? 'border-green-200 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              config.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {config.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              Recurring Configuration
                            </span>
                          </div>
                          
                          <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-1">Start Date</p>
                            <p className="text-sm font-medium text-gray-900">
                              {config.startDate?.toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              }) || 'N/A'}
                            </p>
                            {config.endDate && (
                              <>
                                <p className="text-xs text-gray-500 mb-1 mt-2">End Date</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {config.endDate.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </p>
                              </>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                            {DAYS_OF_WEEK.map((day) => {
                              const dayKey = day.key;
                              const shift = config.shifts?.[dayKey];
                              return (
                                <div key={dayKey} className="border rounded p-2">
                                  <p className="text-xs font-medium text-gray-700 mb-1">{day.label}</p>
                                  {shift && shift.start && shift.end ? (
                                    <p className="text-sm text-gray-900">
                                      {formatTime12Hour(shift.start)} - {formatTime12Hour(shift.end)}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-gray-400">No shift</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-500">
                              Created: {config.createdAt?.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) || 'N/A'}
                            </p>
                          </div>
                          
                          {config.endDate && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="text-xs text-gray-500">
                                Ended: {config.endDate.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Configure All Shifts Modal */}
      {showBulkConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Configure All Staff Shifts</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Set recurring shifts for all staff members at once. This will create a new shift configuration.
                </p>
              </div>
              <button
                onClick={() => setShowBulkConfigModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={saving}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Start Date */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Configuration Start Date *
                </label>
                <input
                  type="date"
                  value={bulkStartDate}
                  onChange={(e) => setBulkStartDate(e.target.value)}
                  required
                  min={(() => {
                    const weekStart = new Date(currentWeek);
                    weekStart.setHours(0, 0, 0, 0);
                    return weekStart.toISOString().split('T')[0];
                  })()}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This date marks when this shift configuration starts. All shifts will be recurring until a new configuration is created.
                </p>
              </div>

              {/* Staff Shifts Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                        Staff Member
                      </th>
                      {DAYS_OF_WEEK.map(day => (
                        <th key={day.key} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 min-w-[140px]">
                          {day.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {staff.map((member) => {
                      const memberId = member.id || member.uid;
                      if (!memberId) return null;

                      return (
                        <tr key={memberId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-gray-200">
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                {getInitials(member)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {getFullName(member)}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{member.email}</p>
                              </div>
                            </div>
                          </td>
                          {DAYS_OF_WEEK.map(day => {
                            const shift = bulkShifts[memberId]?.[day.key] || { start: '', end: '' };
                            return (
                              <td key={day.key} className="px-3 py-3 border-r border-gray-100">
                                <div className="space-y-2">
                                  <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Start</label>
                                    <input
                                      type="time"
                                      value={shift.start}
                                      onChange={(e) => {
                                        setBulkShifts(prev => ({
                                          ...prev,
                                          [memberId]: {
                                            ...(prev[memberId] || {}),
                                            [day.key]: {
                                              ...shift,
                                              start: e.target.value
                                            }
                                          }
                                        }));
                                      }}
                                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500 mb-1 block">End</label>
                                    <input
                                      type="time"
                                      value={shift.end}
                                      onChange={(e) => {
                                        setBulkShifts(prev => ({
                                          ...prev,
                                          [memberId]: {
                                            ...(prev[memberId] || {}),
                                            [day.key]: {
                                              ...shift,
                                              end: e.target.value
                                            }
                                          }
                                        }));
                                      }}
                                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                                    />
                                  </div>
                                  {shift.start && shift.end && (
                                    <button
                                      onClick={() => {
                                        setBulkShifts(prev => ({
                                          ...prev,
                                          [memberId]: {
                                            ...(prev[memberId] || {}),
                                            [day.key]: { start: '', end: '' }
                                          }
                                        }));
                                      }}
                                      className="text-xs text-red-600 hover:text-red-800"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {staff.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No staff members found</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                <p>ΓÜá∩╕Å This will create a new shift configuration. The current active configuration will be marked as inactive.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkConfigModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                  onClick={handleSaveBulkShifts}
                  disabled={saving || !bulkStartDate}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save All Shifts'}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simple Edit/Add Shift Modal */}
      {showEditShiftModal && selectedStaff && selectedDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isAddingShift ? 'Add Shift' : 'Edit Shift'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedStaff && getFullName(selectedStaff)} - {DAYS_OF_WEEK.find(d => d.key === selectedDay)?.label}
                  {selectedDate && ` (${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEditShiftModal(false);
                  setSelectedStaff(null);
                  setSelectedDay(null);
                  setSelectedDate(null);
                  setShiftForm({ start: '', end: '', date: '' });
                  setIsAddingShift(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Time Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={shiftForm.start}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setShiftForm(prev => ({
                        ...prev,
                        start: newStart,
                        // Clear end time if it's before or equal to new start
                        end: prev.end && newStart >= prev.end ? '' : prev.end
                      }));
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={shiftForm.end}
                    onChange={(e) => setShiftForm(prev => ({ ...prev, end: e.target.value }))}
                    min={shiftForm.start || undefined}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                    disabled={!shiftForm.start}
                    required
                  />
                </div>
              </div>

              {/* Branch Hours Info */}
              {branchHours && branchHours[selectedDay] && branchHours[selectedDay].isOpen && (
                <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                  Branch hours: {formatTime12Hour(branchHours[selectedDay].open)} - {formatTime12Hour(branchHours[selectedDay].close)}
                </div>
              )}

              {/* Date-specific option */}
              {selectedDate && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="date-specific"
                    checked={!!shiftForm.date}
                    onChange={(e) => {
                      setShiftForm(prev => ({
                        ...prev,
                        date: e.target.checked ? selectedDate.toISOString().split('T')[0] : ''
                      }));
                    }}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="date-specific" className="text-sm text-gray-700">
                    Make this a one-time shift for this specific date
                  </label>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowEditShiftModal(false);
                  setSelectedStaff(null);
                  setSelectedDay(null);
                  setSelectedDate(null);
                  setShiftForm({ start: '', end: '', date: '' });
                  setIsAddingShift(false);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveShift}
                disabled={!shiftForm.start || !shiftForm.end}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingShift ? 'Add to List' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffSchedule;

