import { Users, Building2, Calendar, TrendingUp } from 'lucide-react';
import { useEffect } from 'react';

const SystemAdminDashboard = () => {
  // Set page title with role prefix
  useEffect(() => {
    document.title = 'System Admin - Dashboard | DSMS';
    return () => {
      document.title = 'DSMS - David\'s Salon Management System';
    };
  }, []);

  const stats = [
    { label: 'Total Users', value: '234', icon: Users, color: 'bg-blue-500' },
    { label: 'Active Branches', value: '12', icon: Building2, color: 'bg-green-500' },
    { label: 'Appointments Today', value: '89', icon: Calendar, color: 'bg-purple-500' },
    { label: 'Revenue Growth', value: '+23%', icon: TrendingUp, color: 'bg-orange-500' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">System Admin Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 transition-colors text-left">
            <Users className="w-6 h-6 text-primary-600 mb-2" />
            <h3 className="font-medium text-gray-900">Create User</h3>
            <p className="text-sm text-gray-600">Add a new system user</p>
          </button>
          <button className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 transition-colors text-left">
            <Building2 className="w-6 h-6 text-primary-600 mb-2" />
            <h3 className="font-medium text-gray-900">Add Branch</h3>
            <p className="text-sm text-gray-600">Register new branch</p>
          </button>
          <button className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 transition-colors text-left">
            <Calendar className="w-6 h-6 text-primary-600 mb-2" />
            <h3 className="font-medium text-gray-900">View Reports</h3>
            <p className="text-sm text-gray-600">System analytics</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemAdminDashboard;
