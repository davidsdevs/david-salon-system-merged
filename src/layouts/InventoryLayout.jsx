import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  TrendingUp, 
  ArrowRightLeft, 
  QrCode, 
  ShoppingCart, 
  PackageCheck, 
  Truck, 
  AlertTriangle, 
  BarChart3, 
  Banknote, 
  ClipboardList, 
  Calendar
} from 'lucide-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { ROUTES } from '../utils/constants';

const InventoryLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: ROUTES.INVENTORY_DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { section: 'Inventory Management' },
    { path: ROUTES.INVENTORY_PRODUCTS, label: 'Products', icon: Package },
    { path: ROUTES.INVENTORY_STOCKS, label: 'Stocks', icon: TrendingUp },
    { path: ROUTES.INVENTORY_STOCK_TRANSFER, label: 'Stock Transfer', icon: ArrowRightLeft },
    { path: ROUTES.INVENTORY_UPC_GENERATOR, label: 'UPC Generator', icon: QrCode },
    { section: 'Purchasing' },
    { path: ROUTES.INVENTORY_PURCHASE_ORDERS, label: 'Purchase Orders', icon: ShoppingCart },
    { path: ROUTES.INVENTORY_DELIVERIES, label: 'Deliveries', icon: PackageCheck },
    { path: ROUTES.INVENTORY_SUPPLIERS, label: 'Suppliers', icon: Truck },
    { section: 'Monitoring' },
    { path: ROUTES.INVENTORY_STOCK_ALERTS, label: 'Stock Alerts', icon: AlertTriangle },
    { path: ROUTES.INVENTORY_EXPIRY_TRACKER, label: 'Expiry Tracker', icon: Calendar },
    { section: 'Reports & Analysis' },
    { path: ROUTES.INVENTORY_REPORTS, label: 'Reports', icon: BarChart3 },
    { path: ROUTES.INVENTORY_COST_ANALYSIS, label: 'Cost Analysis', icon: Banknote },
    { path: ROUTES.INVENTORY_AUDIT, label: 'Inventory Audit', icon: ClipboardList },
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

export default InventoryLayout;

