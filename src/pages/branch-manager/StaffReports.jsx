/**
 * Staff Reports Page - Branch Manager
 * Comprehensive reporting for staff management with print functionality
 */

import { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { 
  FileText, 
  Download, 
  Upload, 
  Users, 
  Calendar, 
  ArrowLeftRight,
  RefreshCw,
  Printer,
  XCircle
} from 'lucide-react';
import { getUsersByBranch, getUserById } from '../../services/userService';
import { getBranchById } from '../../services/branchService';
import { getActiveLendingForBranch, getActiveLendingFromBranch, getLendingRequests } from '../../services/stylistLendingService';
import { getActiveSchedulesByEmployee, getSchedulesByBranch } from '../../services/scheduleService';
import { useAuth } from '../../context/AuthContext';
import { USER_ROLES, ROLE_LABELS } from '../../utils/constants';
import { formatDate, getFullName } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const StaffReports = () => {
  const { currentUser, userBranch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('employees');
  
  // Data states
  const [staff, setStaff] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [lendingData, setLendingData] = useState([]);
  const [branchName, setBranchName] = useState('');
  
  // Import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importErrors, setImportErrors] = useState([]);

  // Print refs
  const employeesPrintRef = useRef();
  const schedulesPrintRef = useRef();
  const lendingPrintRef = useRef();

  const handlePrintEmployees = useReactToPrint({
    content: () => employeesPrintRef.current,
    documentTitle: `Staff_Data_${formatDate(new Date(), 'yyyy-MM-dd')}`,
  });

  const handlePrintSchedules = useReactToPrint({
    content: () => schedulesPrintRef.current,
    documentTitle: `Schedule_Report_${formatDate(new Date(), 'yyyy-MM-dd')}`,
  });

  const handlePrintLending = useReactToPrint({
    content: () => lendingPrintRef.current,
    documentTitle: `Lending_Requests_${formatDate(new Date(), 'yyyy-MM-dd')}`,
  });

  useEffect(() => {
    if (userBranch) {
      fetchAllData();
    }
  }, [userBranch]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      const branch = await getBranchById(userBranch);
      setBranchName(branch?.branchName || branch?.name || 'Unknown Branch');
      
      const branchStaff = await getUsersByBranch(userBranch);
      const MANAGEABLE_ROLES = [
        USER_ROLES.RECEPTIONIST,
        USER_ROLES.STYLIST,
        USER_ROLES.INVENTORY_CONTROLLER
      ];
      
      const manageableStaff = branchStaff.filter(user => {
        const userRoles = user.roles || (user.role ? [user.role] : []);
        return userRoles.some(role => MANAGEABLE_ROLES.includes(role));
      });
      
      const staffWithSchedules = await Promise.all(
        manageableStaff.map(async (member) => {
          const memberId = member.id || member.uid;
          if (!memberId) return member;
          
          try {
            const today = new Date();
            const { activeConfig } = await getActiveSchedulesByEmployee(memberId, userBranch, today);
            
            const shifts = {};
            if (activeConfig && activeConfig.employeeShifts) {
              Object.entries(activeConfig.employeeShifts).forEach(([dayKey, shift]) => {
                if (shift && shift.start && shift.end) {
                  shifts[dayKey.toLowerCase()] = {
                    start: shift.start,
                    end: shift.end
                  };
                }
              });
            }
            
            return { ...member, shifts };
          } catch (error) {
            console.error(`Error loading schedules for ${memberId}:`, error);
            return { ...member, shifts: {} };
          }
        })
      );
      
      setStaff(staffWithSchedules);
      
      const branchSchedules = await getSchedulesByBranch(userBranch);
      setSchedules(branchSchedules || []);
      
      const [lendingsTo, lendingsFrom] = await Promise.all([
        getActiveLendingForBranch(userBranch, null),
        getActiveLendingFromBranch(userBranch, null)
      ]);
      
      const enrichedLendings = await Promise.all(
        [...lendingsTo, ...lendingsFrom].map(async (lending) => {
          try {
            const stylist = await getUserById(lending.stylistId);
            const fromBranch = await getBranchById(lending.fromBranchId);
            const toBranch = await getBranchById(lending.toBranchId);
            
            return {
              ...lending,
              stylistName: getFullName(stylist),
              stylistEmail: stylist?.email || '',
              fromBranchName: fromBranch?.branchName || fromBranch?.name || 'Unknown',
              toBranchName: toBranch?.branchName || toBranch?.name || 'Unknown',
              startDate: lending.startDate?.toDate ? lending.startDate.toDate() : new Date(lending.startDate),
              endDate: lending.endDate?.toDate ? lending.endDate.toDate() : new Date(lending.endDate),
              requestedAt: lending.requestedAt?.toDate ? lending.requestedAt.toDate() : (lending.requestedAt ? new Date(lending.requestedAt) : null)
            };
          } catch (error) {
            console.error('Error enriching lending data:', error);
            return null;
          }
        })
      );
      
      setLendingData(enrichedLendings.filter(l => l !== null));
    } catch (error) {
      console.error('Error fetching reports data:', error);
      toast.error('Failed to load reports data');
    } finally {
      setLoading(false);
    }
  };

  // CSV Export Functions
  const exportToCSV = (data, filename, headers) => {
    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }

    const csvHeaders = headers || Object.keys(data[0]);
    const csvRows = [
      csvHeaders.join(','),
      ...data.map(row => {
        return csvHeaders.map(header => {
          const value = row[header] || '';
          const stringValue = String(value).replace(/"/g, '""');
          return `"${stringValue}"`;
        }).join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `${filename}_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV file downloaded successfully');
  };

  const exportEmployees = () => {
    const exportData = staff.map(member => {
      const roles = member.roles || (member.role ? [member.role] : []);
      const shifts = member.shifts || {};
      const shiftDays = Object.keys(shifts).map(day => {
        const shift = shifts[day];
        return `${day.charAt(0).toUpperCase() + day.slice(1)}: ${shift.start}-${shift.end}`;
      }).join('; ');
      
      return {
        'Employee ID': member.id || member.uid || 'N/A',
        'First Name': member.firstName || '',
        'Middle Name': member.middleName || '',
        'Last Name': member.lastName || '',
        'Full Name': getFullName(member),
        'Email': member.email || '',
        'Phone': member.phone || '',
        'Roles': roles.join('; '),
        'Status': member.isActive ? 'Active' : 'Inactive',
        'Shifts': shiftDays || 'No shifts assigned',
        'Date Joined': member.createdAt ? formatDate(member.createdAt) : 'N/A',
        'Branch': branchName
      };
    });

    exportToCSV(exportData, 'Staff_Employees_Report', Object.keys(exportData[0] || {}));
  };

  const exportSchedules = () => {
    const exportData = schedules.map(schedule => {
      const employee = staff.find(s => (s.id || s.uid) === schedule.employeeId);
      
      return {
        'Schedule ID': schedule.id || 'N/A',
        'Employee ID': schedule.employeeId || 'N/A',
        'Employee Name': employee ? getFullName(employee) : 'Unknown',
        'Day of Week': schedule.dayOfWeek || 'N/A',
        'Start Time': schedule.startTime || 'N/A',
        'End Time': schedule.endTime || 'N/A',
        'Notes': schedule.notes || '',
        'Is Active': schedule.isActive ? 'Yes' : 'No',
        'Created At': schedule.createdAt ? formatDate(schedule.createdAt) : 'N/A',
        'Updated At': schedule.updatedAt ? formatDate(schedule.updatedAt) : 'N/A',
        'Branch': branchName
      };
    });

    exportToCSV(exportData, 'Staff_Schedules_Report', Object.keys(exportData[0] || {}));
  };

  const exportLending = () => {
    const exportData = lendingData.map(lending => {
      return {
        'Lending ID': lending.id || 'N/A',
        'Stylist ID': lending.stylistId || 'N/A',
        'Stylist Name': lending.stylistName || 'N/A',
        'Stylist Email': lending.stylistEmail || 'N/A',
        'From Branch': lending.fromBranchName || 'N/A',
        'To Branch': lending.toBranchName || 'N/A',
        'Start Date': lending.startDate ? formatDate(lending.startDate) : 'N/A',
        'End Date': lending.endDate ? formatDate(lending.endDate) : 'N/A',
        'Status': lending.status || 'N/A',
        'Type': lending.type || 'N/A',
        'Reason': lending.reason || '',
        'Requested At': lending.requestedAt ? formatDate(lending.requestedAt) : 'N/A',
        'Requested By': lending.requestedByName || 'N/A',
        'Approved By': lending.approvedByName || 'N/A',
        'Rejection Reason': lending.rejectionReason || ''
      };
    });

    exportToCSV(exportData, 'Staff_Lending_Report', Object.keys(exportData[0] || {}));
  };

  // CSV Import Functions
  const downloadSampleTemplate = (type) => {
    let sampleData = [];
    let filename = '';
    
    switch (type) {
      case 'employees':
        sampleData = [{
          'First Name': 'John',
          'Middle Name': 'M',
          'Last Name': 'Doe',
          'Email': 'john.doe@example.com',
          'Phone': '+1234567890',
          'Roles': 'stylist',
          'Status': 'Active'
        }];
        filename = 'Staff_Employees_Template';
        break;
      case 'schedules':
        sampleData = [{
          'Employee ID': 'employee_id_here',
          'Day of Week': 'Monday',
          'Start Time': '09:00',
          'End Time': '17:00',
          'Notes': 'Regular shift'
        }];
        filename = 'Staff_Schedules_Template';
        break;
      case 'lending':
        sampleData = [{
          'Stylist ID': 'stylist_id_here',
          'To Branch ID': 'branch_id_here',
          'Start Date': '2024-01-01',
          'End Date': '2024-01-07',
          'Reason': 'High demand period'
        }];
        filename = 'Staff_Lending_Template';
        break;
      default:
        return;
    }
    
    exportToCSV(sampleData, filename, Object.keys(sampleData[0] || {}));
    toast.success('Sample template downloaded');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }
    
    setImportFile(file);
    setImportErrors([]);
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row');
    }
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length === headers.length && values.some(v => v)) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        data.push(row);
      }
    }
    
    return { headers, data };
  };

  const handleImport = async () => {
    if (!importFile || !importType) {
      toast.error('Please select a file and import type');
      return;
    }
    
    try {
      setLoading(true);
      const text = await importFile.text();
      const { headers, data } = parseCSV(text);
      
      const errors = [];
      let successCount = 0;
      
      switch (importType) {
        case 'employees':
          const requiredEmployeeCols = ['First Name', 'Last Name', 'Email'];
          const missingCols = requiredEmployeeCols.filter(col => !headers.includes(col));
          if (missingCols.length > 0) {
            errors.push(`Missing required columns: ${missingCols.join(', ')}`);
            break;
          }
          
          for (const row of data) {
            try {
              if (!row['First Name'] || !row['Last Name'] || !row['Email']) {
                errors.push(`Row ${data.indexOf(row) + 2}: Missing required fields`);
                continue;
              }
              successCount++;
            } catch (error) {
              errors.push(`Row ${data.indexOf(row) + 2}: ${error.message}`);
            }
          }
          break;
          
        case 'schedules':
          const requiredScheduleCols = ['Employee ID', 'Day of Week', 'Start Time', 'End Time'];
          const missingScheduleCols = requiredScheduleCols.filter(col => !headers.includes(col));
          if (missingScheduleCols.length > 0) {
            errors.push(`Missing required columns: ${missingScheduleCols.join(', ')}`);
            break;
          }
          
          for (const row of data) {
            try {
              if (!row['Employee ID'] || !row['Day of Week'] || !row['Start Time'] || !row['End Time']) {
                errors.push(`Row ${data.indexOf(row) + 2}: Missing required fields`);
                continue;
              }
              successCount++;
            } catch (error) {
              errors.push(`Row ${data.indexOf(row) + 2}: ${error.message}`);
            }
          }
          break;
          
        case 'lending':
          const requiredLendingCols = ['Stylist ID', 'To Branch ID', 'Start Date', 'End Date'];
          const missingLendingCols = requiredLendingCols.filter(col => !headers.includes(col));
          if (missingLendingCols.length > 0) {
            errors.push(`Missing required columns: ${missingLendingCols.join(', ')}`);
            break;
          }
          
          for (const row of data) {
            try {
              if (!row['Stylist ID'] || !row['To Branch ID'] || !row['Start Date'] || !row['End Date']) {
                errors.push(`Row ${data.indexOf(row) + 2}: Missing required fields`);
                continue;
              }
              successCount++;
            } catch (error) {
              errors.push(`Row ${data.indexOf(row) + 2}: ${error.message}`);
            }
          }
          break;
      }
      
      setImportErrors(errors);
      
      if (errors.length === 0) {
        toast.success(`Successfully imported ${successCount} records`);
        setShowImportModal(false);
        setImportFile(null);
        setImportType(null);
        fetchAllData();
      } else {
        toast.error(`Import completed with ${errors.length} errors. ${successCount} records imported successfully.`);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error(`Import failed: ${error.message}`);
      setImportErrors([error.message]);
    } finally {
      setLoading(false);
    }
  };

  // Print Components
  const PrintEmployeesReport = () => (
    <div ref={employeesPrintRef} style={{ display: 'none' }}>
      <div className="p-6">
        <div className="text-center mb-4 border-b pb-3">
          <h1 className="text-2xl font-bold">Staff Data Report</h1>
          <p className="text-sm text-gray-600 mt-1">{branchName}</p>
          <p className="text-xs text-gray-500 mt-1">Generated on {formatDate(new Date(), 'MMM dd, yyyy hh:mm a')}</p>
        </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Name</th>
            <th className="border p-2 text-left">Email</th>
            <th className="border p-2 text-left">Roles</th>
            <th className="border p-2 text-left">Status</th>
            <th className="border p-2 text-left">Shifts</th>
            <th className="border p-2 text-left">Joined</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => {
            const roles = member.roles || (member.role ? [member.role] : []);
            const shifts = member.shifts || {};
            const shiftCount = Object.keys(shifts).length;
            
            return (
              <tr key={member.id || member.uid}>
                <td className="border p-2">{getFullName(member)}</td>
                <td className="border p-2">{member.email || 'N/A'}</td>
                <td className="border p-2">{roles.map(role => ROLE_LABELS[role] || role).join(', ')}</td>
                <td className="border p-2">{member.isActive ? 'Active' : 'Inactive'}</td>
                <td className="border p-2">{shiftCount > 0 ? `${shiftCount} days` : 'No shifts'}</td>
                <td className="border p-2">{member.createdAt ? formatDate(member.createdAt) : 'N/A'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
        <div className="mt-4 text-xs text-gray-500 text-center">
          Total Employees: {staff.length} | Active: {staff.filter(s => s.isActive).length}
        </div>
      </div>
    </div>
  );

  const PrintSchedulesReport = () => (
    <div ref={schedulesPrintRef} style={{ display: 'none' }}>
      <div className="p-6">
        <div className="text-center mb-4 border-b pb-3">
          <h1 className="text-2xl font-bold">Schedule Report</h1>
          <p className="text-sm text-gray-600 mt-1">{branchName}</p>
          <p className="text-xs text-gray-500 mt-1">Generated on {formatDate(new Date(), 'MMM dd, yyyy hh:mm a')}</p>
        </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Employee</th>
            <th className="border p-2 text-left">Day</th>
            <th className="border p-2 text-left">Start Time</th>
            <th className="border p-2 text-left">End Time</th>
            <th className="border p-2 text-left">Status</th>
            <th className="border p-2 text-left">Updated</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map((schedule) => {
            const employee = staff.find(s => (s.id || s.uid) === schedule.employeeId);
            
            return (
              <tr key={schedule.id}>
                <td className="border p-2">{employee ? getFullName(employee) : 'Unknown'}</td>
                <td className="border p-2">{schedule.dayOfWeek || 'N/A'}</td>
                <td className="border p-2">{schedule.startTime || 'N/A'}</td>
                <td className="border p-2">{schedule.endTime || 'N/A'}</td>
                <td className="border p-2">{schedule.isActive !== false ? 'Active' : 'Inactive'}</td>
                <td className="border p-2">{schedule.updatedAt ? formatDate(schedule.updatedAt) : 'N/A'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
        <div className="mt-4 text-xs text-gray-500 text-center">
          Total Schedules: {schedules.length} | Active: {schedules.filter(s => s.isActive !== false).length}
        </div>
      </div>
    </div>
  );

  const PrintLendingReport = () => (
    <div ref={lendingPrintRef} style={{ display: 'none' }}>
      <div className="p-6">
        <div className="text-center mb-4 border-b pb-3">
          <h1 className="text-2xl font-bold">Lending Requests Report</h1>
          <p className="text-sm text-gray-600 mt-1">{branchName}</p>
          <p className="text-xs text-gray-500 mt-1">Generated on {formatDate(new Date(), 'MMM dd, yyyy hh:mm a')}</p>
        </div>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Stylist</th>
            <th className="border p-2 text-left">From Branch</th>
            <th className="border p-2 text-left">To Branch</th>
            <th className="border p-2 text-left">Start Date</th>
            <th className="border p-2 text-left">End Date</th>
            <th className="border p-2 text-left">Status</th>
            <th className="border p-2 text-left">Type</th>
          </tr>
        </thead>
        <tbody>
          {lendingData.map((lending) => (
            <tr key={lending.id}>
              <td className="border p-2">{lending.stylistName || 'Unknown'}</td>
              <td className="border p-2">{lending.fromBranchName || 'N/A'}</td>
              <td className="border p-2">{lending.toBranchName || 'N/A'}</td>
              <td className="border p-2">{lending.startDate ? formatDate(lending.startDate) : 'N/A'}</td>
              <td className="border p-2">{lending.endDate ? formatDate(lending.endDate) : 'N/A'}</td>
              <td className="border p-2">{lending.status || 'N/A'}</td>
              <td className="border p-2">{lending.type || 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
        <div className="mt-4 text-xs text-gray-500 text-center">
          Total Requests: {lendingData.length} | 
          Active: {lendingData.filter(l => l.status === 'active' || l.status === 'approved').length}
        </div>
      </div>
    </div>
  );

  if (loading && !staff.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      
      {/* Header - Compact */}
      <div className="flex items-center justify-between mb-3 no-print">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Staff Reports</h1>
          <p className="text-sm text-gray-600">{branchName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAllData}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
        </div>
      </div>

      {/* Report Type Tabs - Compact */}
      <div className="bg-white rounded border border-gray-200 mb-3 no-print">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setReportType('employees')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              reportType === 'employees'
                ? 'border-[#160B53] text-[#160B53]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Staff Data
            </div>
          </button>
          <button
            onClick={() => setReportType('schedules')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              reportType === 'schedules'
                ? 'border-[#160B53] text-[#160B53]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Schedule
            </div>
          </button>
          <button
            onClick={() => setReportType('lending')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              reportType === 'lending'
                ? 'border-[#160B53] text-[#160B53]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Requests
            </div>
          </button>
        </div>
      </div>

      {/* Report Content - Compact and Scrollable */}
      <div className="bg-white rounded border border-gray-200 flex-1 flex flex-col overflow-hidden no-print">
        {/* Employees Report */}
        {reportType === 'employees' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Employee List</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintEmployees}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Print Staff Data
                </button>
                <button
                  onClick={exportEmployees}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Roles</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Shifts</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {staff.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-3 py-8 text-center text-gray-500">
                        No employees found
                      </td>
                    </tr>
                  ) : (
                    staff.map((member) => {
                      const roles = member.roles || (member.role ? [member.role] : []);
                      const shifts = member.shifts || {};
                      const shiftCount = Object.keys(shifts).length;
                      
                      return (
                        <tr key={member.id || member.uid} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm font-medium text-gray-900">{getFullName(member)}</td>
                          <td className="px-3 py-2 text-sm text-gray-500">{member.email || 'N/A'}</td>
                          <td className="px-3 py-2 text-sm text-gray-500">{roles.map(role => ROLE_LABELS[role] || role).join(', ')}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                              member.isActive 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {member.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500">{shiftCount > 0 ? `${shiftCount} days` : 'No shifts'}</td>
                          <td className="px-3 py-2 text-sm text-gray-500">{member.createdAt ? formatDate(member.createdAt) : 'N/A'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Schedules Report */}
        {reportType === 'schedules' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Schedule Report</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintSchedules}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Print Schedule
                </button>
                <button
                  onClick={exportSchedules}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Start Time</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">End Time</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {schedules.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-3 py-8 text-center text-gray-500">
                        No schedules found
                      </td>
                    </tr>
                  ) : (
                    schedules.map((schedule) => {
                      const employee = staff.find(s => (s.id || s.uid) === schedule.employeeId);
                      
                      return (
                        <tr key={schedule.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm font-medium text-gray-900">{employee ? getFullName(employee) : 'Unknown'}</td>
                          <td className="px-3 py-2 text-sm text-gray-500">{schedule.dayOfWeek || 'N/A'}</td>
                          <td className="px-3 py-2 text-sm text-gray-500">{schedule.startTime || 'N/A'}</td>
                          <td className="px-3 py-2 text-sm text-gray-500">{schedule.endTime || 'N/A'}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                              schedule.isActive !== false
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {schedule.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500">{schedule.updatedAt ? formatDate(schedule.updatedAt) : 'N/A'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Lending Report */}
        {reportType === 'lending' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Lending Requests</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintLending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Print Requests
                </button>
                <button
                  onClick={exportLending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stylist</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">From Branch</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">To Branch</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lendingData.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-3 py-8 text-center text-gray-500">
                        No lending data found
                      </td>
                    </tr>
                  ) : (
                    lendingData.map((lending) => (
                      <tr key={lending.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">{lending.stylistName || 'Unknown'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{lending.fromBranchName || 'N/A'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{lending.toBranchName || 'N/A'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{lending.startDate ? formatDate(lending.startDate) : 'N/A'}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{lending.endDate ? formatDate(lending.endDate) : 'N/A'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                            lending.status === 'approved' || lending.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : lending.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {lending.status || 'N/A'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500">{lending.type || 'N/A'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Print Components - Always rendered but hidden */}
      <PrintEmployeesReport />
      <PrintSchedulesReport />
      <PrintLendingReport />

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Import CSV Data</h2>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportType(null);
                    setImportErrors([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Import Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => {
                      setImportType('employees');
                      setImportFile(null);
                    }}
                    className={`px-3 py-2 border-2 rounded-lg transition-colors text-sm ${
                      importType === 'employees'
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Users className="w-5 h-5 mx-auto mb-1" />
                    <div className="text-xs font-medium">Employees</div>
                  </button>
                  <button
                    onClick={() => {
                      setImportType('schedules');
                      setImportFile(null);
                    }}
                    className={`px-3 py-2 border-2 rounded-lg transition-colors text-sm ${
                      importType === 'schedules'
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Calendar className="w-5 h-5 mx-auto mb-1" />
                    <div className="text-xs font-medium">Schedules</div>
                  </button>
                  <button
                    onClick={() => {
                      setImportType('lending');
                      setImportFile(null);
                    }}
                    className={`px-3 py-2 border-2 rounded-lg transition-colors text-sm ${
                      importType === 'lending'
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <ArrowLeftRight className="w-5 h-5 mx-auto mb-1" />
                    <div className="text-xs font-medium">Lending</div>
                  </button>
                </div>
              </div>

              {importType && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Download Sample Template
                    </label>
                    <button
                      onClick={() => downloadSampleTemplate(importType)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download Template
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select CSV File
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                    {importFile && (
                      <p className="mt-1 text-xs text-gray-600">
                        Selected: {importFile.name}
                      </p>
                    )}
                  </div>

                  {importErrors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-4 h-4 text-red-600" />
                        <h3 className="text-sm font-semibold text-red-800">Import Errors</h3>
                      </div>
                      <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                        {importErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setShowImportModal(false);
                        setImportFile(null);
                        setImportType(null);
                        setImportErrors([]);
                      }}
                      className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={!importFile || loading}
                      className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Import
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffReports;
