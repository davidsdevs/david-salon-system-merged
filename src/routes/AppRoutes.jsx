import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProtectedRoute from '../components/layout/ProtectedRoute';

// Layouts
import SystemAdminLayout from '../layouts/SystemAdminLayout';
import OperationalManagerLayout from '../layouts/OperationalManagerLayout';
import OverallInventoryControllerLayout from '../layouts/OverallInventoryControllerLayout';
import BranchManagerLayout from '../layouts/BranchManagerLayout';
import ReceptionistLayout from '../layouts/ReceptionistLayout';
import StylistLayout from '../layouts/StylistLayout';
import ClientLayout from '../layouts/ClientLayout';
import InventoryLayout from '../layouts/InventoryLayout';

// Pages
import Login from '../pages/Login';
import SystemAdminLogin from '../pages/system-admin/Login';
import BranchManagerLogin from '../pages/branch-manager/Login';
import ReceptionistLogin from '../pages/receptionist/Login';
import OperationalManagerLogin from '../pages/operational-manager/Login';
import OverallInventoryControllerLogin from '../pages/overall-inventory/Login';
import InventoryControllerLogin from '../pages/inventory/Login';
import StylistLogin from '../pages/stylist/Login';
import Register from '../pages/public/Register';
import ForgotPassword from '../pages/public/ForgotPassword';
import HomePage from '../pages/public/HomePage';
import AboutPage from '../pages/public/AboutPage';
import BranchPage from '../pages/public/BranchPage';
import BranchGalleryPage from '../pages/public/branch/BranchGalleryPage';
import BranchServicesPage from '../pages/public/branch/BranchServicesPage';
import BranchStylistsPage from '../pages/public/branch/BranchStylistsPage';
import BranchProductsPage from '../pages/public/branch/BranchProductsPage';
import ServiceDetailPage from '../pages/public/branch/ServiceDetailPage';
import StylistProfilePage from '../pages/public/branch/StylistProfilePage';
import SystemAdminDashboard from '../pages/system-admin/Dashboard';
import UsersManagement from '../pages/system-admin/Users';
import BranchesManagement from '../pages/system-admin/Branches';
import ServiceTemplates from '../pages/system-admin/ServiceTemplates';
import SystemAdminActivityLogs from '../pages/system-admin/ActivityLogs';
import Promotions from '../pages/system-admin/Promotions';
import Suppliers from '../pages/system-admin/Suppliers';
import ContentManagement from '../pages/system-admin/ContentManagement';
import HomepageContentManagement from '../pages/system-admin/HomepageContentManagement';
import MasterProducts from '../pages/system-admin/MasterProducts';
import SeedServices from '../pages/admin/SeedServices';
import OperationalManagerDashboard from '../pages/operational-manager/Dashboard';
import OperationalManagerUsersView from '../pages/operational-manager/UsersView';
import OperationalManagerBranches from '../pages/operational-manager/Branches';
import OperationalManagerActivityLogs from '../pages/operational-manager/ActivityLogs';
import OperationalManagerInventory from '../pages/operational-manager/Inventory';
import OperationalManagerPurchaseOrders from '../pages/operational-manager/PurchaseOrders';
import OverallInventoryControllerDashboard from '../pages/overall-inventory/Dashboard';
import OverallInventoryControllerInventory from '../pages/overall-inventory/Inventory';
import OperationalManagerDeposits from '../pages/operational-manager/Deposits';
import PriceHistoryAnalytics from '../pages/operational-manager/PriceHistoryAnalytics';
import OperationalManagerPromotions from '../pages/operational-manager/Promotions';
import CalendarCombined from '../pages/operational-manager/CalendarCombined';
import OperationalManagerLeaveManagement from '../pages/operational-manager/LeaveManagement';
import BranchManagerDashboard from '../pages/branch-manager/Dashboard';
import StaffManagement from '../pages/branch-manager/StaffManagement';
import Settings from '../pages/branch-manager/Settings';
import ServicesManagement from '../pages/branch-manager/ServicesManagement';
import BranchProducts from '../pages/branch-manager/BranchProducts';
import BranchPageContents from '../pages/branch-manager/BranchPageContents';
import CalendarManagement from '../pages/branch-manager/CalendarManagement';
import LeaveManagement from '../pages/branch-manager/LeaveManagement';
import BranchSettings from '../pages/branch-manager/BranchSettings';
import BranchManagerAppointments from '../pages/branch-manager/Appointments';
import BranchManagerBilling from '../pages/branch-manager/Billing';
import ClientAnalytics from '../pages/branch-manager/ClientAnalytics';
import BranchManagerDeposits from '../pages/branch-manager/Deposits';
import BranchManagerPromotions from '../pages/branch-manager/Promotions';
import BranchManagerStylistPortfolios from '../pages/branch-manager/StylistPortfolios';
import BranchManagerReports from '../pages/branch-manager/Reports';
import BranchManagerInventory from '../pages/branch-manager/Inventory';
import Commissions from '../pages/branch-manager/Commissions';
import ReceptionistDashboard from '../pages/receptionist/Dashboard';
import ReceptionistAppointments from '../pages/receptionist/Appointments';
import ReceptionistArrivals from '../pages/receptionist/Arrivals';
import ReceptionistBilling from '../pages/receptionist/Billing';
import ReceptionistClients from '../pages/receptionist/Clients';
import ReceptionistStaffSchedule from '../pages/receptionist/StaffSchedule';
import ReceptionistServices from '../pages/receptionist/Services';
import ReceptionistProducts from '../pages/receptionist/Products';
import StylistDashboard from '../pages/stylist/Dashboard';
import StylistAppointments from '../pages/stylist/Appointments';
import StylistCheckIns from '../pages/stylist/CheckIns';
import StylistServiceHistory from '../pages/stylist/ServiceHistory';
import StylistLeaveManagement from '../pages/stylist/LeaveManagement';
import StylistProfile from '../pages/stylist/Profile';
import ClientDashboard from '../pages/client/Dashboard';
import ClientAppointments from '../pages/client/Appointments';
import ClientProducts from '../pages/client/Products';
import ClientRewards from '../pages/client/Rewards';
import ClientProfile from '../pages/client/Profile';
import Profile from '../pages/common/Profile';
import InventoryDashboard from '../pages/inventory/Dashboard';
import InventoryProducts from '../pages/inventory/Products';
import InventoryStocks from '../pages/inventory/Stocks';
import InventoryStockTransfer from '../pages/inventory/StockTransfer';
import InventoryUpcGenerator from '../pages/inventory/UpcGenerator';
import InventoryPurchaseOrders from '../pages/inventory/PurchaseOrders';
import InventoryDeliveries from '../pages/inventory/Deliveries';
import InventorySuppliers from '../pages/inventory/Suppliers';
import InventoryStockAlerts from '../pages/inventory/StockAlerts';
import InventoryExpiryTracker from '../pages/inventory/ExpiryTracker';
import InventoryReports from '../pages/inventory/Reports';
import InventoryCostAnalysis from '../pages/inventory/CostAnalysis';
import InventoryAudit from '../pages/inventory/InventoryAudit';

// Constants
import { USER_ROLES, ROUTES } from '../utils/constants';

const AppRoutes = () => {
  const { currentUser, activeRole } = useAuth();

  // Get role-based home route
  const getRoleBasedRoute = () => {
    switch (activeRole) {
      case USER_ROLES.SYSTEM_ADMIN:
        return ROUTES.ADMIN_DASHBOARD;
      case USER_ROLES.OPERATIONAL_MANAGER:
        return ROUTES.OPERATIONAL_MANAGER_DASHBOARD;
      case USER_ROLES.OVERALL_INVENTORY_CONTROLLER:
        return ROUTES.OVERALL_INVENTORY_DASHBOARD;
      case USER_ROLES.BRANCH_MANAGER:
        return ROUTES.MANAGER_DASHBOARD;
      case USER_ROLES.RECEPTIONIST:
        return ROUTES.RECEPTIONIST_DASHBOARD;
      case USER_ROLES.INVENTORY_CONTROLLER:
        return ROUTES.INVENTORY_DASHBOARD;
      case USER_ROLES.STYLIST:
        return ROUTES.STYLIST_DASHBOARD;
      case USER_ROLES.CLIENT:
        return ROUTES.CLIENT_DASHBOARD;
      default:
        return ROUTES.LOGIN;
    }
  };

  return (
    <Routes>
      {/* Public landing pages - no auth required */}
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/branch/:slug" element={<BranchPage />} />
      <Route path="/branch/:slug/gallery" element={<BranchGalleryPage />} />
      <Route path="/branch/:slug/services" element={<BranchServicesPage />} />
      <Route path="/branch/:slug/services/:serviceId" element={<ServiceDetailPage />} />
      <Route path="/branch/:slug/stylists" element={<BranchStylistsPage />} />
      <Route path="/branch/:slug/stylists/:stylistId" element={<StylistProfilePage />} />
      <Route path="/branch/:slug/products" element={<BranchProductsPage />} />
      
      {/* Public admin utility routes - No auth required */}
      <Route path="/seed-services" element={<SeedServices />} />
      
      {/* Public auth routes - Role-specific login pages */}
      <Route 
        path="/system-admin/login" 
        element={currentUser ? <Navigate to={getRoleBasedRoute()} replace /> : <SystemAdminLogin />} 
      />
      <Route 
        path="/branch-manager/login" 
        element={currentUser ? <Navigate to={getRoleBasedRoute()} replace /> : <BranchManagerLogin />} 
      />
      <Route 
        path="/receptionist/login" 
        element={currentUser ? <Navigate to={getRoleBasedRoute()} replace /> : <ReceptionistLogin />} 
      />
      <Route 
        path="/operational-manager/login" 
        element={currentUser ? <Navigate to={getRoleBasedRoute()} replace /> : <OperationalManagerLogin />} 
      />
      <Route 
        path="/overall-inventory/login" 
        element={currentUser ? <Navigate to={getRoleBasedRoute()} replace /> : <OverallInventoryControllerLogin />} 
      />
      <Route 
        path="/inventory/login" 
        element={currentUser ? <Navigate to={getRoleBasedRoute()} replace /> : <InventoryControllerLogin />} 
      />
      <Route 
        path="/stylist/login" 
        element={currentUser ? <Navigate to={getRoleBasedRoute()} replace /> : <StylistLogin />} 
      />
      <Route 
        path={ROUTES.LOGIN} 
        element={currentUser ? <Navigate to={getRoleBasedRoute()} replace /> : <Login />} 
      />
      <Route 
        path="/register" 
        element={currentUser ? <Navigate to={getRoleBasedRoute()} replace /> : <Register />} 
      />
      <Route 
        path="/forgot-password" 
        element={currentUser ? <Navigate to={getRoleBasedRoute()} replace /> : <ForgotPassword />} 
      />

      {/* System Admin routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={[USER_ROLES.SYSTEM_ADMIN]}>
            <SystemAdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<SystemAdminDashboard />} />
        <Route path="users" element={<UsersManagement />} />
        <Route path="branches" element={<BranchesManagement />} />
        <Route path="service-templates" element={<ServiceTemplates />} />
        <Route path="activity-logs" element={<SystemAdminActivityLogs />} />
              <Route path="promotions" element={<Promotions />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="content-management" element={<ContentManagement />} />
              <Route path="homepage-content" element={<HomepageContentManagement />} />
              <Route path="master-products" element={<MasterProducts />} />
              <Route path="settings" element={<div className="p-6">Settings - Coming Soon</div>} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Operational Manager routes */}
      <Route
        path="/operational-manager"
        element={
          <ProtectedRoute allowedRoles={[USER_ROLES.OPERATIONAL_MANAGER]}>
            <OperationalManagerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OperationalManagerDashboard />} />
        <Route path="users" element={<OperationalManagerUsersView />} />
        <Route path="branches" element={<OperationalManagerBranches />} />
        <Route path="activity" element={<OperationalManagerActivityLogs />} />
        <Route path="inventory" element={<OperationalManagerInventory />} />
        <Route path="purchase-orders" element={<OperationalManagerPurchaseOrders />} />
        <Route path="deposits" element={<OperationalManagerDeposits />} />
        <Route path="price-history" element={<PriceHistoryAnalytics />} />
        <Route path="promotions" element={<OperationalManagerPromotions />} />
        <Route path="calendar" element={<CalendarCombined />} />
        <Route path="leave-management" element={<OperationalManagerLeaveManagement />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Overall Inventory Controller routes */}
      <Route
        path="/overall-inventory"
        element={
          <ProtectedRoute allowedRoles={[USER_ROLES.OVERALL_INVENTORY_CONTROLLER]}>
            <OverallInventoryControllerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OverallInventoryControllerDashboard />} />
        <Route path="inventory" element={<OverallInventoryControllerInventory />} />
        <Route path="purchase-orders" element={<OperationalManagerPurchaseOrders />} />
        <Route path="reports" element={<InventoryReports />} />
        <Route path="stock-alerts" element={<InventoryStockAlerts />} />
        <Route path="expiry-tracker" element={<InventoryExpiryTracker />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Branch Manager routes */}
      <Route
        path="/manager"
        element={
          <ProtectedRoute allowedRoles={[USER_ROLES.BRANCH_MANAGER]}>
            <BranchManagerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<BranchManagerDashboard />} />
        <Route path="staff" element={<StaffManagement />} />
        <Route path="calendar" element={<CalendarManagement />} />
        <Route path="leave-management" element={<LeaveManagement />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/services" element={<ServicesManagement />} />
        <Route path="settings/products" element={<BranchProducts />} />
        <Route path="settings/page-contents" element={<BranchPageContents />} />
        <Route path="settings/branch-settings" element={<BranchSettings />} />
              <Route path="appointments" element={<BranchManagerAppointments />} />
              <Route path="billing" element={<BranchManagerBilling />} />
              <Route path="client-analytics" element={<ClientAnalytics />} />
              <Route path="reports" element={<BranchManagerReports />} />
              <Route path="deposits" element={<BranchManagerDeposits />} />
              <Route path="promotions" element={<BranchManagerPromotions />} />
              <Route path="stylist-portfolios" element={<BranchManagerStylistPortfolios />} />
              <Route path="inventory" element={<BranchManagerInventory />} />
              <Route path="commissions" element={<Commissions />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Receptionist routes */}
      <Route
        path="/receptionist"
        element={
          <ProtectedRoute allowedRoles={[USER_ROLES.RECEPTIONIST]}>
            <ReceptionistLayout />
          </ProtectedRoute>
        }
      >
              <Route index element={<ReceptionistDashboard />} />
              <Route path="appointments" element={<ReceptionistAppointments />} />
              <Route path="arrivals" element={<ReceptionistArrivals />} />
              <Route path="clients" element={<ReceptionistClients />} />
              <Route path="billing" element={<ReceptionistBilling />} />
              <Route path="staff-schedule" element={<ReceptionistStaffSchedule />} />
              <Route path="services" element={<ReceptionistServices />} />
              <Route path="products" element={<ReceptionistProducts />} />
        <Route path="profile" element={<Profile />} />
      </Route>


      {/* Stylist routes */}
      <Route
        path="/stylist"
        element={
          <ProtectedRoute allowedRoles={[USER_ROLES.STYLIST]}>
            <StylistLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<StylistDashboard />} />
        <Route path="appointments" element={<StylistAppointments />} />
        <Route path="check-ins" element={<StylistCheckIns />} />
        <Route path="service-history" element={<StylistServiceHistory />} />
        <Route path="leave-management" element={<StylistLeaveManagement />} />
        <Route path="profile" element={<StylistProfile />} />
      </Route>

      {/* Client routes */}
      <Route
        path="/client"
        element={
          <ProtectedRoute allowedRoles={[USER_ROLES.CLIENT]}>
            <ClientLayout />
          </ProtectedRoute>
        }
      >
              <Route index element={<ClientDashboard />} />
              <Route path="appointments" element={<ClientAppointments />} />
              <Route path="products" element={<ClientProducts />} />
              <Route path="rewards" element={<ClientRewards />} />
              <Route path="profile" element={<ClientProfile />} />
              <Route path="settings" element={<Profile />} />
      </Route>

      {/* Inventory Controller routes */}
      <Route 
        path="/inventory"
        element={
          <ProtectedRoute allowedRoles={[USER_ROLES.INVENTORY_CONTROLLER]}>
            <InventoryLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<InventoryDashboard />} />
        <Route path="products" element={<InventoryProducts />} />
        <Route path="stocks" element={<InventoryStocks />} />
        <Route path="stock-transfer" element={<InventoryStockTransfer />} />
        <Route path="upc-generator" element={<InventoryUpcGenerator />} />
        <Route path="purchase-orders" element={<InventoryPurchaseOrders />} />
        <Route path="deliveries" element={<InventoryDeliveries />} />
        <Route path="suppliers" element={<InventorySuppliers />} />
        <Route path="stock-alerts" element={<InventoryStockAlerts />} />
        <Route path="expiry-tracker" element={<InventoryExpiryTracker />} />
        <Route path="reports" element={<InventoryReports />} />
        <Route path="cost-analysis" element={<InventoryCostAnalysis />} />
        <Route path="inventory-audit" element={<InventoryAudit />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Default redirect for unknown routes */}
      <Route 
        path="*" 
        element={<Navigate to={currentUser ? getRoleBasedRoute() : "/"} replace />} 
      />
    </Routes>
  );
};

export default AppRoutes;
