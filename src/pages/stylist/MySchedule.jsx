/**
 * My Schedule Page - Stylist
 * View of stylist's shifts and leave requests with date range and PNG export
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { getAllScheduleConfigurations } from '../../services/scheduleService';
import { getLeaveRequestsByEmployee } from '../../services/leaveManagementService';
import { getFullName, getInitials, formatTime12Hour } from '../../utils/helpers';
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

const MySchedule = () => {
  const { currentUser, userBranch, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allScheduleConfigs, setAllScheduleConfigs] = useState([]);
  const [dateSpecificShifts, setDateSpecificShifts] = useState({}); // { dateString: { start, end, date } }
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [myLeaveMap, setMyLeaveMap] = useState([]); // Array of leave periods
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(date.setDate(diff));
    monday.setDate(monday.getDate() + 6); // Sunday
    monday.setHours(23, 59, 59, 999);
    return monday.toISOString().split('T')[0];
  });
  const [exporting, setExporting] = useState(false);
  const scheduleRef = useRef(null);

  const dateRangeStart = useMemo(() => new Date(startDate), [startDate]);
  const dateRangeEnd = useMemo(() => new Date(endDate), [endDate]);

  useEffect(() => {
    if (currentUser && userBranch) {
      fetchScheduleData();
      fetchLeaveRequests();
    }
  }, [currentUser, userBranch, startDate, endDate]);

  const fetchScheduleData = async () => {
    try {
      setLoading(true);
      if (userBranch && currentUser?.uid) {
        // Get all schedule configurations for date-based lookup
        const configs = await getAllScheduleConfigurations(userBranch);
        setAllScheduleConfigs(configs);
        
        // Get date range boundaries
        const rangeStartDate = new Date(startDate);
        rangeStartDate.setHours(0, 0, 0, 0);
        const rangeEndDate = new Date(endDate);
        rangeEndDate.setHours(23, 59, 59, 999);
        
        // Fetch date-specific shifts directly from schedules collection
        // This ensures we get all shifts within the date range
        const schedulesRef = collection(db, 'schedules');
        
        // Query all schedules for this branch and employee
        const dateSpecificQuery = query(
          schedulesRef,
          where('branchId', '==', userBranch),
          where('employeeId', '==', currentUser.uid)
        );
        
        const dateSpecificSnapshot = await getDocs(dateSpecificQuery);
        const dateSpecificMap = {};
        
        dateSpecificSnapshot.forEach((doc) => {
          const data = doc.data();
          
          // Only process date-specific shifts (has date field)
          if (data.date) {
            let scheduleDate;
            if (data.date?.toDate) {
              scheduleDate = data.date.toDate();
            } else if (data.date instanceof Date) {
              scheduleDate = new Date(data.date);
            } else {
              scheduleDate = new Date(data.date);
            }
            
            // Normalize to start of day for comparison
            const scheduleDateOnly = new Date(scheduleDate);
            scheduleDateOnly.setHours(0, 0, 0, 0);
            
            // Only include shifts within the date range
            if (scheduleDateOnly >= rangeStartDate && scheduleDateOnly <= rangeEndDate) {
              const dateStr = scheduleDateOnly.toISOString().split('T')[0];
              
              // Date-specific shifts override recurring shifts
              if (data.startTime && data.endTime) {
                dateSpecificMap[dateStr] = {
                  start: data.startTime,
                  end: data.endTime,
                  date: scheduleDateOnly,
                  isDateSpecific: true
                };
              }
            }
          }
        });
        
        setDateSpecificShifts(dateSpecificMap);
      }
    } catch (error) {
      console.error('Error fetching schedule data:', error);
      toast.error('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      if (currentUser?.uid) {
        const result = await getLeaveRequestsByEmployee(currentUser.uid, 1000); // Get all for schedule view
        const leaves = result.requests || result; // Handle both new format and backward compatibility
        setLeaveRequests(Array.isArray(leaves) ? leaves : []);

        // Create leave map for quick lookup
        const leaveMap = [];
        const rangeStartDate = new Date(startDate);
        const rangeEndDate = new Date(endDate);
        rangeStartDate.setHours(0, 0, 0, 0);
        rangeEndDate.setHours(23, 59, 59, 999);
        
        // Debug: Log all leave requests
        console.log('All leave requests fetched:', leaves.length);
        leaves.forEach((leave, idx) => {
          console.log(`Leave ${idx + 1}:`, {
            id: leave.id,
            status: leave.status,
            type: leave.type,
            startDate: leave.startDate,
            endDate: leave.endDate,
            reason: leave.reason
          });
        });
        
        leaves.forEach(leave => {
          // Explicitly exclude rejected, cancelled, and pending leaves
          // Only show approved leaves on the schedule
          if (leave.status === 'rejected' || leave.status === 'cancelled' || leave.status === 'pending') {
            return; // Skip rejected/cancelled/pending leaves
          }
          
          // Only include approved leaves
          if (leave.status === 'approved') {
            let leaveStartDate, leaveEndDate;
            
            if (leave.startDate instanceof Date) {
              leaveStartDate = new Date(leave.startDate);
            } else if (leave.startDate && typeof leave.startDate.toDate === 'function') {
              leaveStartDate = leave.startDate.toDate();
            } else if (leave.startDate) {
              leaveStartDate = new Date(leave.startDate);
            } else {
              console.warn('Invalid leave startDate:', leave);
              return; // Skip invalid leave
            }
            
            if (leave.endDate instanceof Date) {
              leaveEndDate = new Date(leave.endDate);
            } else if (leave.endDate && typeof leave.endDate.toDate === 'function') {
              leaveEndDate = leave.endDate.toDate();
            } else if (leave.endDate) {
              leaveEndDate = new Date(leave.endDate);
            } else {
              console.warn('Invalid leave endDate:', leave);
              return; // Skip invalid leave
            }
            
            // Normalize dates to start of day
            leaveStartDate.setHours(0, 0, 0, 0);
            leaveEndDate.setHours(23, 59, 59, 999);
            
            // Validate that start date is before or equal to end date
            if (leaveStartDate > leaveEndDate) {
              console.warn('Leave has invalid date range (start > end):', leave);
              return; // Skip invalid date range
            }
            
            // Only include leaves that overlap with the date range
            if (leaveEndDate >= rangeStartDate && leaveStartDate <= rangeEndDate) {
              console.log('Adding leave to map:', {
                status: leave.status,
                type: leave.type,
                startDate: leaveStartDate.toISOString().split('T')[0],
                endDate: leaveEndDate.toISOString().split('T')[0],
                reason: leave.reason
              });
              leaveMap.push({
                startDate: leaveStartDate,
                endDate: leaveEndDate,
                status: leave.status,
                type: leave.type,
                reason: leave.reason
              });
            }
          }
        });
        
        console.log('Final leave map:', leaveMap.map(l => ({
          status: l.status,
          type: l.type,
          startDate: l.startDate.toISOString().split('T')[0],
          endDate: l.endDate.toISOString().split('T')[0]
        })));
        
        setMyLeaveMap(leaveMap);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      toast.error('Failed to load leave requests');
    }
  };

  const getDateRangeDates = () => {
    const dates = [];
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
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
    
    const targetDateObj = new Date(targetDate);
    targetDateObj.setHours(0, 0, 0, 0);
    const targetTime = targetDateObj.getTime();
    
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

  const getShiftForDay = (dayKey, date) => {
    if (!date || !currentUser?.uid) return null;

    // First check for date-specific shift (these override recurring shifts)
    if (dateSpecificShifts && date) {
      const dateStr = date.toISOString().split('T')[0];
      if (dateSpecificShifts[dateStr]) {
        return dateSpecificShifts[dateStr];
      }
    }

    // Then check for recurring shift from schedule configuration
    if (allScheduleConfigs.length > 0) {
      // Find the schedule configuration that applies to this specific date
      const configForDate = getScheduleForDate(allScheduleConfigs, date);
      
      if (configForDate && configForDate.shifts) {
        const employeeId = currentUser.uid;
        
        // Try to find shifts using the employee ID
        let employeeShifts = null;
        
        // Try direct match
        if (configForDate.shifts[employeeId]) {
          employeeShifts = configForDate.shifts[employeeId];
        } else {
          // Try partial matching
          const availableIds = Object.keys(configForDate.shifts);
          const matchingId = availableIds.find(id => 
            id === employeeId || 
            id.includes(employeeId) || 
            employeeId.includes(id)
          );
          
          if (matchingId) {
            employeeShifts = configForDate.shifts[matchingId];
          }
        }
        
        if (employeeShifts && employeeShifts[dayKey] && employeeShifts[dayKey].start && employeeShifts[dayKey].end) {
          return {
            start: employeeShifts[dayKey].start,
            end: employeeShifts[dayKey].end,
            isRecurring: true
          };
        }
      }
    }
    
    return null;
  };

  // Helper function to check if stylist is on leave on a specific date
  const isOnLeave = (date) => {
    if (!date || myLeaveMap.length === 0) return false;
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    const checkTime = checkDate.getTime();
    
    return myLeaveMap.some(leave => {
      if (!leave.startDate || !leave.endDate) return false;
      
      const startTime = leave.startDate.getTime();
      const endTime = leave.endDate.getTime();
      
      return checkTime >= startTime && checkTime <= endTime;
    });
  };

  // Helper function to get leave info for a specific date
  const getLeaveInfoForDate = (date) => {
    if (!date || myLeaveMap.length === 0) return null;
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    return myLeaveMap.find(leave => {
      if (!leave.startDate || !leave.endDate) return false;
      
      return checkDate >= leave.startDate && checkDate <= leave.endDate;
    }) || null;
  };

  const handleExportPNG = async () => {
    if (!scheduleRef.current) {
      toast.error('No schedule to export');
      return;
    }

    try {
      setExporting(true);
      toast.loading('Generating PNG...', { id: 'export' });

      // Wait a bit for any animations to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Capture the schedule as canvas
      const canvas = await html2canvas(scheduleRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: scheduleRef.current.scrollWidth,
        windowHeight: scheduleRef.current.scrollHeight,
      });

      // Convert canvas to PNG blob
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error('Failed to generate PNG', { id: 'export' });
          setExporting(false);
          return;
        }

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `My_Schedule_${startDate}_to_${endDate}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success('Schedule exported as PNG!', { id: 'export' });
        setExporting(false);
      }, 'image/png', 1.0);
    } catch (error) {
      console.error('Error exporting PNG:', error);
      toast.error('Failed to export schedule. Please try again.', { id: 'export' });
      setExporting(false);
    }
  };

  const dateRangeDates = useMemo(() => getDateRangeDates(), [startDate, endDate]);

  // Count shifts for stats
  const shiftsCount = useMemo(() => {
    return dateRangeDates.filter(date => {
      const dayKey = getDayKey(date);
      return getShiftForDay(dayKey, date) !== null;
    }).length;
  }, [dateRangeDates, allScheduleConfigs, currentUser, dateSpecificShifts]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
          <p className="text-gray-600 mt-1">View your shifts and availability</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPNG}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export as PNG'}
          </button>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
          </div>
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center gap-2">
              <label htmlFor="startDate" className="text-sm text-gray-600">From:</label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => {
                  const newStart = e.target.value;
                  if (newStart <= endDate) {
                    setStartDate(newStart);
                  } else {
                    toast.error('Start date must be before end date');
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="endDate" className="text-sm text-gray-600">To:</label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => {
                  const newEnd = e.target.value;
                  if (newEnd >= startDate) {
                    setEndDate(newEnd);
                  } else {
                    toast.error('End date must be after start date');
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="text-sm text-gray-500">
              {dateRangeDates.length} day{dateRangeDates.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Shifts in Range</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{shiftsCount}</p>
            </div>
            <Clock className="w-8 h-8 text-primary-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Leave Requests</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{leaveRequests.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Days on Leave</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {dateRangeDates.filter(date => isOnLeave(date)).length}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Schedule Table */}
      <div ref={scheduleRef} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* User Info Header */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
              {userData ? getInitials(userData) : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">
                {userData ? getFullName(userData) : currentUser?.displayName || 'You'}
              </div>
              <div className="text-xs text-gray-500">
                {currentUser?.email}
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Grid - Wraps to new lines */}
        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
            {dateRangeDates.map((date, index) => {
              const isToday = date.toDateString() === new Date().toDateString();
              const dayKey = getDayKey(date);
              const dayInfo = DAYS_OF_WEEK.find(d => d.key === dayKey);
              const shift = getShiftForDay(dayKey, date);
              const onLeave = isOnLeave(date);
              const leaveInfo = getLeaveInfoForDate(date);
              
              return (
                <div
                  key={index}
                  className={`border rounded-lg p-3 ${
                    isToday ? 'bg-primary-50 border-primary-200' : 'border-gray-200'
                  }`}
                >
                  {/* Date Header */}
                  <div className={`text-center mb-3 pb-2 border-b ${
                    isToday ? 'border-primary-200' : 'border-gray-200'
                  }`}>
                    <div className="text-xs font-semibold text-gray-500 uppercase">
                      {dayInfo?.short}
                    </div>
                    <div className={`text-sm font-medium mt-1 ${
                      isToday ? 'text-primary-700' : 'text-gray-900'
                    }`}>
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>

                  {/* Shift/Leave Info */}
                  <div className="text-center">
                    {onLeave ? (
                      <div className="space-y-1">
                        <div className="px-2 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-800">
                          ON LEAVE
                        </div>
                        {leaveInfo && (
                          <div className="text-xs text-red-600 mt-1">
                            {leaveInfo.type}
                          </div>
                        )}
                      </div>
                    ) : shift ? (
                      <div className="px-2 py-1.5 rounded-lg bg-primary-100 text-primary-800 text-xs font-medium">
                        <div className="flex flex-col items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span className="text-center leading-tight">
                            {formatTime12Hour(shift.start)} - {formatTime12Hour(shift.end)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">No shift</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MySchedule;
