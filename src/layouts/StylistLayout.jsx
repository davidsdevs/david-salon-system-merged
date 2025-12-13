import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Calendar, CalendarDays, User, CheckCircle, History, Bell, Clock, Image } from 'lucide-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { ROUTES } from '../utils/constants';
import { useAuth } from '../context/AuthContext';
import { getUnreadNotificationCount } from '../services/notificationService';

const StylistLayout = () => {
  const { currentUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const menuItems = [
    { path: ROUTES.STYLIST_DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { section: 'My Work' },
    { path: ROUTES.STYLIST_APPOINTMENTS, label: 'My Appointments', icon: Calendar },
    { path: '/stylist/check-ins', label: 'Check-Ins', icon: CheckCircle },
    { path: '/stylist/service-history', label: 'Service History', icon: History },
    { path: '/stylist/leave-management', label: 'Leave Requests', icon: CalendarDays },
    { path: ROUTES.STYLIST_SCHEDULE, label: 'My Schedule', icon: Clock },
    { path: '/stylist/portfolio', label: 'Portfolio', icon: Image },
    { section: 'Account' },
    { path: '/stylist/profile', label: 'My Profile', icon: User },
  ];

  const bottomItems = [
    { 
      path: '/stylist/notifications', 
      label: 'Notifications', 
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : undefined
    },
  ];

  useEffect(() => {
    if (currentUser?.uid) {
      fetchUnreadCount();
      // Refresh unread count every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const fetchUnreadCount = async () => {
    try {
      if (currentUser?.uid) {
        const count = await getUnreadNotificationCount(currentUser.uid);
        setUnreadCount(count);
      }
    } catch (error) {
      console.error('Error fetching unread notification count:', error);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar 
        isOpen={sidebarOpen} 
        toggleSidebar={() => setSidebarOpen(false)} 
        menuItems={menuItems}
        bottomItems={bottomItems}
      />
      
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
