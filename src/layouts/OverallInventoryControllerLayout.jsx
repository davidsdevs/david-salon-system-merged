import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  AlertTriangle, 
  Calendar,
  Building
} from 'lucide-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { ROUTES } from '../utils/constants';

const OverallInventoryControllerLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: ROUTES.OVERALL_INVENTORY_DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { section: 'Inventory Management' },
    { path: ROUTES.OVERALL_INVENTORY_OVERVIEW, label: 'Inventory Overview', icon: Package },
    { path: ROUTES.OVERALL_INVENTORY_PURCHASE_ORDERS, label: 'Purchase Orders', icon: ShoppingCart },
    { section: 'Monitoring & Alerts' },
    { path: ROUTES.OVERALL_INVENTORY_ALERTS, label: 'Stock Alerts', icon: AlertTriangle },
    { path: ROUTES.OVERALL_INVENTORY_EXPIRY, label: 'Expiry Tracker', icon: Calendar },
    { section: 'Analytics' },
    { path: ROUTES.OVERALL_INVENTORY_REPORTS, label: 'Reports', icon: BarChart3 },
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

export default OverallInventoryControllerLayout;
















