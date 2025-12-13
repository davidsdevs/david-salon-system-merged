// User roles
export const USER_ROLES = {
  SYSTEM_ADMIN: 'systemAdmin',
  OPERATIONAL_MANAGER: 'operationalManager',
  OVERALL_INVENTORY_CONTROLLER: 'overallInventoryController',
  BRANCH_MANAGER: 'branchManager',
  RECEPTIONIST: 'receptionist',
  INVENTORY_CONTROLLER: 'inventoryController',
  STYLIST: 'stylist',
  CLIENT: 'client',
};

// Role labels for display
export const ROLE_LABELS = {
  [USER_ROLES.SYSTEM_ADMIN]: 'System Administrator',
  [USER_ROLES.OPERATIONAL_MANAGER]: 'Operational Manager',
  [USER_ROLES.OVERALL_INVENTORY_CONTROLLER]: 'Overall Inventory Controller',
  [USER_ROLES.BRANCH_MANAGER]: 'Branch Manager',
  [USER_ROLES.RECEPTIONIST]: 'Receptionist',
  [USER_ROLES.INVENTORY_CONTROLLER]: 'Inventory Controller',
  [USER_ROLES.STYLIST]: 'Stylist',
  [USER_ROLES.CLIENT]: 'Client',
};

// Appointment statuses
export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_SERVICE: 'in_service',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
};


// Service categories (Based on David's Salon menu)
export const SERVICE_CATEGORIES = [
  'Haircut and Blowdry',
  'Hair Coloring',
  'Hair Treatment',
  'Straightening and Perming',
  'Hair and Make Up',
  'Nail Care',
  'Waxing and Threading',
  'Massage'
];

// Navigation paths
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  PROFILE: '/profile',
  
  // System Admin
  ADMIN_DASHBOARD: '/admin',
  ADMIN_USERS: '/admin/users',
  ADMIN_BRANCHES: '/admin/branches',
  ADMIN_SETTINGS: '/admin/settings',
  
  // Operational Manager
  OPERATIONAL_MANAGER_DASHBOARD: '/operational-manager',
  OPERATIONAL_MANAGER_BRANCHES: '/operational-manager/branches',
  OPERATIONAL_MANAGER_USERS: '/operational-manager/users',
  OPERATIONAL_MANAGER_ACTIVITY: '/operational-manager/activity',
  OPERATIONAL_MANAGER_PRICE_HISTORY: '/operational-manager/price-history',
  OPERATIONAL_MANAGER_PROMOTIONS: '/operational-manager/promotions',
  OPERATIONAL_MANAGER_CALENDAR: '/operational-manager/calendar',
  OPERATIONAL_MANAGER_CALENDAR_APPROVAL: '/operational-manager/calendar-approval',
  
  // Branch Manager
  MANAGER_DASHBOARD: '/manager',
  MANAGER_STAFF: '/manager/staff',
  MANAGER_APPOINTMENTS: '/manager/appointments',
  MANAGER_REPORTS: '/manager/reports',
  
  // Receptionist
  RECEPTIONIST_DASHBOARD: '/receptionist',
  RECEPTIONIST_APPOINTMENTS: '/receptionist/appointments',
  RECEPTIONIST_ARRIVALS: '/receptionist/arrivals',
  RECEPTIONIST_CLIENTS: '/receptionist/clients',
  RECEPTIONIST_BILLING: '/receptionist/billing',
  RECEPTIONIST_SALES_REPORT: '/receptionist/sales-report',
  RECEPTIONIST_STAFF_SCHEDULE: '/receptionist/staff-schedule',
  RECEPTIONIST_SERVICES: '/receptionist/services',
  RECEPTIONIST_PRODUCTS: '/receptionist/products',
  
  // Inventory Controller
  INVENTORY_DASHBOARD: '/inventory',
  INVENTORY_PRODUCTS: '/inventory/products',
  INVENTORY_STOCKS: '/inventory/stocks',
  INVENTORY_STOCK_TRANSFER: '/inventory/stock-transfer',
  INVENTORY_UPC_GENERATOR: '/inventory/upc-generator',
  INVENTORY_PURCHASE_ORDERS: '/inventory/purchase-orders',
  INVENTORY_DELIVERIES: '/inventory/deliveries',
  INVENTORY_SUPPLIERS: '/inventory/suppliers',
  INVENTORY_STOCK_ALERTS: '/inventory/stock-alerts',
  INVENTORY_EXPIRY_TRACKER: '/inventory/expiry-tracker',
  INVENTORY_REPORTS: '/inventory/reports',
  INVENTORY_COST_ANALYSIS: '/inventory/cost-analysis',
  INVENTORY_AUDIT: '/inventory/inventory-audit',
  
  // Overall Inventory Controller
  OVERALL_INVENTORY_DASHBOARD: '/overall-inventory',
  OVERALL_INVENTORY_OVERVIEW: '/overall-inventory/inventory',
  OVERALL_INVENTORY_PURCHASE_ORDERS: '/overall-inventory/purchase-orders',
  OVERALL_INVENTORY_REPORTS: '/overall-inventory/reports',
  OVERALL_INVENTORY_ALERTS: '/overall-inventory/stock-alerts',
  OVERALL_INVENTORY_EXPIRY: '/overall-inventory/expiry-tracker',
  
  // Stylist
  STYLIST_DASHBOARD: '/stylist',
  STYLIST_APPOINTMENTS: '/stylist/appointments',
  STYLIST_SCHEDULE: '/stylist/schedule',
  STYLIST_CLIENTS: '/stylist/clients',
  STYLIST_SERVICE_HISTORY: '/stylist/service-history',
  STYLIST_CLIENT_ANALYTICS: '/stylist/client-analytics/:clientId',
  
  // Client
  CLIENT_DASHBOARD: '/client',
  CLIENT_BOOK: '/client/book',
  CLIENT_HISTORY: '/client/history',
  CLIENT_PROFILE: '/client/profile',
};
