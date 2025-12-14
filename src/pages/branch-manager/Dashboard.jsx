import { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  Banknote, 
  Package, 
  TrendingUp, 
  Clock,
  MapPin,
  Phone,
  Mail,
  AlertCircle,
  User,
  Scissors
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getBranchById, getBranchStats } from '../../services/branchService';
import { getAppointmentsByDateRange } from '../../services/appointmentService';
import { getBranchServices } from '../../services/branchServicesService';
import { getUsersByRole } from '../../services/userService';
import { USER_ROLES } from '../../utils/constants';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { formatDate, formatTime12Hour, getFullName } from '../../utils/helpers';
import { Link } from 'react-router-dom';

const BranchManagerDashboard = () => {
  const { userBranch } = useAuth();
  const [branch, setBranch] = useState(null);
  const [stats, setStats] = useState(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Set page title with role prefix
  useEffect(() => {
    document.title = 'Branch Manager - Dashboard | DSMS';
    return () => {
      document.title = 'DSMS - David\'s Salon Management System';
    };
  }, []);

  useEffect(() => {
    if (userBranch) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [userBranch]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch branch details
      const branchData = await getBranchById(userBranch);
      setBranch(branchData);
      
      // Fetch branch statistics
      const statsData = await getBranchStats(userBranch);
      setStats(statsData);
      
      // Fetch today's upcoming appointments
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const appointments = await getAppointmentsByDateRange(userBranch, today, tomorrow);
      
      // Filter to only upcoming appointments (not completed/cancelled) and sort by time
      const upcoming = appointments
        .filter(apt => {
          const status = apt.status?.toLowerCase();
          return status !== 'completed' && status !== 'cancelled' && status !== 'no_show';
        })
        .sort((a, b) => {
          const timeA = a.appointmentDate?.getTime() || 0;
          const timeB = b.appointmentDate?.getTime() || 0;
          return timeA - timeB;
        })
        .slice(0, 5); // Show top 5 upcoming
      
      // Enrich appointments with service and stylist names
      const services = await getBranchServices(userBranch);
      const stylists = await getUsersByRole(USER_ROLES.STYLIST);
      const branchStylists = stylists.filter(s => s.branchId === userBranch);
      
      const enrichedAppointments = upcoming.map(apt => {
        const service = services.find(s => s.id === apt.serviceId || s.serviceId === apt.serviceId);
        const stylist = branchStylists.find(s => s.id === apt.stylistId);
        const clientName = apt.clientName || 
          (apt.client?.firstName && apt.client?.lastName 
            ? `${apt.client.firstName} ${apt.client.lastName}` 
            : apt.client?.name || 'Walk-in Client');
        
        return {
          ...apt,
          serviceName: service?.name || service?.serviceName || 'Unknown Service',
          stylistName: stylist ? getFullName(stylist) : 'Unassigned',
          clientName: clientName
        };
      });
      
      setUpcomingAppointments(enrichedAppointments);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!userBranch || !branch) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-yellow-900 mb-1">No Branch Assigned</h3>
            <p className="text-yellow-700">
              You are not currently assigned to any branch. Please contact your system administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Staff',
      value: stats?.staffCount || 0,
      icon: Users,
      color: 'bg-blue-500',
      trend: null
    },
    {
      title: 'Today\'s Appointments',
      value: stats?.appointmentCount || 0,
      icon: Calendar,
      color: 'bg-green-500',
      trend: null
    },
    {
      title: 'Monthly Revenue',
      value: `₱${(stats?.revenue || 0).toLocaleString()}`,
      icon: Banknote,
      color: 'bg-purple-500',
      trend: null,
      note: 'Coming soon'
    },
    {
      title: 'Inventory Items',
      value: stats?.inventoryItems || 0,
      icon: Package,
      color: 'bg-orange-500',
      trend: null,
      note: 'Coming soon'
    }
  ];

  const getTodaySchedule = () => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const schedule = branch.operatingHours?.[today];
    
    if (!schedule || !schedule.isOpen) {
      return 'Closed';
    }
    
    return `${formatTime12Hour(schedule.open)} - ${formatTime12Hour(schedule.close)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Branch Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening at your branch today.</p>
      </div>

      {/* Branch Info Card */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-4">{branch.name || branch.branchName}</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{branch.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span className="text-sm">{branch.contact}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span className="text-sm">{branch.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Today: {getTodaySchedule()}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              branch.isActive === true 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {branch.isActive === true ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              {stat.trend && (
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>{stat.trend}</span>
                </div>
              )}
            </div>
            <h3 className="text-gray-600 text-sm font-medium mb-1">{stat.title}</h3>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            {stat.note && (
              <p className="text-xs text-gray-500 mt-2 italic">{stat.note}</p>
            )}
          </div>
        ))}
      </div>

      {/* Today's Upcoming Appointments & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Upcoming Appointments */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Today's Upcoming</h3>
            <Link 
              to="/manager/appointments" 
              className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
            >
              View All
              <Calendar className="w-4 h-4" />
            </Link>
          </div>
          
          {upcomingAppointments.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No upcoming appointments today</p>
              <Link 
                to="/manager/appointments" 
                className="text-primary-600 hover:text-primary-700 text-sm font-medium mt-2 inline-block"
              >
                View all appointments
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.map((apt) => {
                let appointmentTime = 'TBD';
                if (apt.appointmentDate) {
                  const date = apt.appointmentDate instanceof Date 
                    ? apt.appointmentDate 
                    : apt.appointmentDate.toDate();
                  const hours = date.getHours().toString().padStart(2, '0');
                  const minutes = date.getMinutes().toString().padStart(2, '0');
                  appointmentTime = formatTime12Hour(`${hours}:${minutes}`);
                }
                const status = apt.status?.toLowerCase() || 'pending';
                const statusColors = {
                  confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
                  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                  in_service: 'bg-purple-100 text-purple-700 border-purple-200',
                  completed: 'bg-green-100 text-green-700 border-green-200',
                  cancelled: 'bg-red-100 text-red-700 border-red-200'
                };
                
                return (
                  <Link
                    key={apt.id}
                    to="/manager/appointments"
                    className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {apt.clientName}
                        </p>
                        <span className={`px-2 py-0.5 text-xs rounded-full border flex-shrink-0 ${
                          statusColors[status] || 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}>
                          {status === 'in_service' ? 'In Service' : status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                        <span className="font-medium">{appointmentTime}</span>
                        <span className="text-gray-400">•</span>
                        <span className="truncate">{apt.serviceName}</span>
                      </div>
                      {apt.stylistName && apt.stylistName !== 'Unassigned' && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <User className="w-3 h-3" />
                          <span className="truncate">{apt.stylistName}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
              {upcomingAppointments.length >= 5 && (
                <Link
                  to="/manager/appointments"
                  className="block text-center text-sm text-primary-600 hover:text-primary-700 font-medium pt-2 border-t border-gray-200"
                >
                  View all appointments →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 p-4 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors text-left">
              <Users className="w-5 h-5 text-primary-600" />
              <div>
                <p className="font-medium text-gray-900">Manage Staff</p>
                <p className="text-sm text-gray-600">Add or edit staff members</p>
              </div>
            </button>
            
            <button className="w-full flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-left">
              <Calendar className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-gray-900">View Appointments</p>
                <p className="text-sm text-gray-600">Check today's schedule</p>
              </div>
            </button>
            
            <button className="w-full flex items-center gap-3 p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-left">
              <Package className="w-5 h-5 text-purple-600" />
              <div>
                <p className="font-medium text-gray-900">Inventory</p>
                <p className="text-sm text-gray-600">Manage branch inventory</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Branch Performance (Placeholder) */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Branch Performance</h3>
        <div className="text-center py-12 text-gray-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-sm">Performance charts and analytics coming soon</p>
          <p className="text-xs mt-1">Will be available after Appointments and Billing modules are implemented</p>
        </div>
      </div>
    </div>
  );
};

export default BranchManagerDashboard;
