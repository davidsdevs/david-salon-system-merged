import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, Receipt, CheckCircle, Clock, Scissors, Package, BarChart3 } from 'lucide-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { ROUTES } from '../utils/constants';

const ReceptionistLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { path: ROUTES.RECEPTIONIST_DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { section: 'Operations' },
    { path: ROUTES.RECEPTIONIST_APPOINTMENTS, label: 'Appointments', icon: Calendar },
    { path: ROUTES.RECEPTIONIST_ARRIVALS, label: 'Arrivals & Check-ins', icon: CheckCircle },
    { path: ROUTES.RECEPTIONIST_CLIENTS, label: 'Clients', icon: Users },
    { path: ROUTES.RECEPTIONIST_BILLING, label: 'Billing', icon: Receipt },
    { path: ROUTES.RECEPTIONIST_SALES_REPORT, label: 'Sales Report', icon: BarChart3 },
    { path: ROUTES.RECEPTIONIST_STAFF_SCHEDULE, label: 'Staff Schedule', icon: Clock },
    { section: 'Catalog' },
    { path: ROUTES.RECEPTIONIST_SERVICES, label: 'Services', icon: Scissors },
    { path: ROUTES.RECEPTIONIST_PRODUCTS, label: 'Products', icon: Package },
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

export default ReceptionistLayout;
