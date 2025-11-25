import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Building2, BarChart3, TrendingUp, Activity, Users, Package, ShoppingCart, Wallet, Banknote, Calendar, Tag } from 'lucide-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { ROUTES } from '../utils/constants';

const OperationalManagerLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: ROUTES.OPERATIONAL_MANAGER_DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { section: 'Management' },
    { path: ROUTES.OPERATIONAL_MANAGER_USERS, label: 'Users', icon: Users },
    { path: ROUTES.OPERATIONAL_MANAGER_BRANCHES, label: 'Branches', icon: Building2 },
    { section: 'Operations' },
    { path: '/operational-manager/inventory', label: 'Inventory', icon: Package },
    { path: '/operational-manager/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
    { path: '/operational-manager/deposits', label: 'Deposits', icon: Wallet },
    { path: ROUTES.OPERATIONAL_MANAGER_CALENDAR, label: 'Calendar', icon: Calendar },
    { path: '/operational-manager/leave-management', label: 'Leave Management', icon: Calendar },
    { section: 'Analytics' },
    { path: ROUTES.OPERATIONAL_MANAGER_PRICE_HISTORY, label: 'Price History Analytics', icon: Banknote },
    { section: 'Marketing' },
    { path: '/operational-manager/promotions', label: 'System-Wide Promotions', icon: Tag },
    { section: 'System' },
    { path: ROUTES.OPERATIONAL_MANAGER_ACTIVITY, label: 'Activity Logs', icon: Activity },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(false)} menuItems={menuItems} />
      
      <div className="flex-1 flex flex-col md:ml-64">
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
        
        <div className="flex-1 flex flex-col overflow-y-auto">
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default OperationalManagerLayout;
