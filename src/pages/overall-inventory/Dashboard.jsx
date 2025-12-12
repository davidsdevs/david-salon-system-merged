import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { 
  Package, 
  ShoppingCart, 
  AlertTriangle, 
  Calendar,
  Building,
  TrendingUp,
  Banknote,
  RefreshCw
} from 'lucide-react';
import { ROUTES } from '../../utils/constants';
import { inventoryService } from '../../services/inventoryService';
import { productService } from '../../services/productService';
import { getAllBranches } from '../../services/branchService';

const OverallInventoryControllerDashboard = () => {
  const { userData } = useAuth();
  const [stats, setStats] = useState({
    totalBranches: 0,
    totalProducts: 0,
    totalValue: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    expiringSoon: 0,
    pendingOrders: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      
      // Get all branches
      const branches = await getAllBranches();
      const activeBranches = branches.filter(b => b.isActive !== false);
      
      // Get all products
      const productsResult = await productService.getAllProducts();
      const totalProducts = productsResult.success ? productsResult.products.length : 0;

      // Get inventory stats across all branches
      let totalValue = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;
      let expiringSoonCount = 0;

      for (const branch of activeBranches) {
        try {
          // Get branch stocks
          const stocksResult = await inventoryService.getBranchStocks(branch.id);
          if (stocksResult.success && stocksResult.stocks) {
            stocksResult.stocks.forEach(stock => {
              const currentStock = stock.currentStock || 0;
              const minStock = stock.minStock || 0;
              const unitCost = stock.unitCost || 0;
              
              totalValue += currentStock * unitCost;
              
              if (currentStock === 0) {
                outOfStockCount++;
              } else if (currentStock <= minStock) {
                lowStockCount++;
              }
            });
          }

          // Get expiring batches (within 30 days)
          const expiringBatches = await inventoryService.getExpiringBatches(branch.id, 30);
          if (expiringBatches.success && expiringBatches.batches) {
            expiringSoonCount += expiringBatches.batches.length;
          }
        } catch (error) {
          console.warn(`Error loading stats for branch ${branch.name}:`, error);
        }
      }

      setStats({
        totalBranches: activeBranches.length,
        totalProducts,
        totalValue,
        lowStockItems: lowStockCount,
        outOfStockItems: outOfStockCount,
        expiringSoon: expiringSoonCount,
        pendingOrders: 0 // TODO: Get from purchase order service
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overall Inventory Controller Dashboard</h1>
          <p className="text-gray-600">Monitor inventory across all branches</p>
        </div>
        <button
          onClick={loadDashboardStats}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
        <Card className="p-6">
          <div className="flex items-center">
            <Building className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Branches</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : stats.totalBranches}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Products</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : stats.totalProducts}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center">
            <Banknote className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Inventory Value</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : `₱${stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : stats.lowStockItems}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        <Card className="p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Out of Stock</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : stats.outOfStockItems}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Expiring Soon</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : stats.expiringSoon}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center">
            <ShoppingCart className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Orders</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : stats.pendingOrders}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        <Link to={ROUTES.OVERALL_INVENTORY_OVERVIEW}>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">Inventory Overview</h3>
                  <p className="text-sm text-gray-600">View inventory across all branches</p>
                </div>
              </div>
            </div>
          </Card>
        </Link>

        <Link to={ROUTES.OVERALL_INVENTORY_ALERTS}>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">Stock Alerts</h3>
                  <p className="text-sm text-gray-600">Monitor low stock and alerts</p>
                </div>
              </div>
            </div>
          </Card>
        </Link>

        <Link to={ROUTES.OVERALL_INVENTORY_REPORTS}>
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-teal-600" />
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">Inventory Reports</h3>
                  <p className="text-sm text-gray-600">View detailed analytics</p>
                </div>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Info Card */}
      <Card className="p-6 bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> As an Overall Inventory Controller, you have access to view and monitor 
          inventory across all branches. You can track stock levels, alerts, and generate reports for 
          system-wide inventory management.
        </p>
      </Card>
    </div>
  );
};

export default OverallInventoryControllerDashboard;












