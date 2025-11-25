import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, CalendarDays } from 'lucide-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { ROUTES } from '../utils/constants';

const StylistLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: ROUTES.STYLIST_DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { section: 'My Work' },
    { path: ROUTES.STYLIST_APPOINTMENTS, label: 'Appointments', icon: Calendar },
    { path: ROUTES.STYLIST_SCHEDULE, label: 'Schedule', icon: Calendar },
    { path: '/stylist/leave-management', label: 'Leave Management', icon: CalendarDays },
    { path: ROUTES.STYLIST_CLIENTS, label: 'Clients', icon: Users },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(false)} menuItems={menuItems} />
      
      <div className="flex-1 flex flex-col lg:ml-64">
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
        
        <div className="flex-1 flex flex-col overflow-y-auto">
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default StylistLayout;
