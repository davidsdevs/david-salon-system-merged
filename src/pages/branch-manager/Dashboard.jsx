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
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getBranchById, getBranchStats } from '../../services/branchService';
import { getUsersByBranch } from '../../services/userService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { formatDate, formatTime12Hour } from '../../utils/helpers';

const BranchManagerDashboard = () => {
  const { userBranch } = useAuth();
  const [branch, setBranch] = useState(null);
  const [stats, setStats] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

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
      
      // Fetch staff
      const staffData = await getUsersByBranch(userBranch);
      setStaff(staffData);
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

      {/* Recent Staff & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Staff */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Staff</h3>
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          
          {staff.length === 0 ? (
            <p className="text-gray-500 text-sm">No staff assigned yet.</p>
          ) : (
            <div className="space-y-3">
              {staff.slice(0, 5).map((member) => (
                <div key={member.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-700 font-semibold text-sm">
                      {member.firstName?.[0]}{member.lastName?.[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{member.email}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    member.isActive 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {member.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
              {staff.length > 5 && (
                <p className="text-sm text-gray-500 text-center pt-2">
                  +{staff.length - 5} more staff members
                </p>
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
