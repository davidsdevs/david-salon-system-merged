// src/pages/overall-inventory/Inventory.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { SearchInput } from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import { getAllBranches } from '../../services/branchService';
import { inventoryService } from '../../services/inventoryService';
import { productService } from '../../services/productService';
import {
  Package,
  Eye,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Building,
  Banknote,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';

const OverallInventoryControllerInventory = () => {
  const { userData } = useAuth();

  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null); // null = showing branch cards, branchId = showing that branch's inventory
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [branchStats, setBranchStats] = useState({}); // Store stats for each branch

  // Load branches
  const loadBranches = async () => {
    try {
      const branchesData = await getAllBranches();
      setBranches(Array.isArray(branchesData) ? branchesData : []);
    } catch (err) {
      console.error('Error loading branches:', err);
      setBranches([]);
    }
  };

  // Load branch statistics for all branches
  const loadBranchStats = async () => {
    try {
      setLoading(true);
      const activeBranches = branches.filter(b => b.isActive !== false);
      const stats = {};

      for (const branch of activeBranches) {
        try {
          const stocksResult = await inventoryService.getBranchStocks(branch.id);
          if (stocksResult.success) {
            const stocks = stocksResult.stocks;
            const totalProducts = new Set(stocks.map(s => s.productId)).size;
            const totalValue = stocks.reduce((sum, stock) => {
              return sum + ((stock.currentStock || 0) * (stock.unitCost || 0));
            }, 0);
            const lowStock = stocks.filter(stock => {
              const current = stock.currentStock || 0;
              const min = stock.minStock || 0;
              return current <= min && current > 0;
            }).length;
            const outOfStock = stocks.filter(stock => (stock.currentStock || 0) === 0).length;

            stats[branch.id] = {
              totalProducts,
              totalValue,
              lowStock,
              outOfStock,
              totalItems: stocks.length
            };
          } else {
            stats[branch.id] = {
              totalProducts: 0,
              totalValue: 0,
              lowStock: 0,
              outOfStock: 0,
              totalItems: 0
            };
          }
        } catch (err) {
          console.warn(`Error loading stats for branch ${branch.name || branch.branchName}:`, err);
          stats[branch.id] = {
            totalProducts: 0,
            totalValue: 0,
            lowStock: 0,
            outOfStock: 0,
            totalItems: 0
          };
        }
      }

      setBranchStats(stats);
    } catch (err) {
      console.error('Error loading branch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load inventory for selected branch
  const loadInventory = async () => {
    if (!selectedBranch) return;

    try {
      setLoading(true);
      setError(null);

      // Load all products first
      const productsResult = await productService.getAllProducts();
      if (productsResult.success) {
        setProducts(productsResult.products);
      }

      // Load inventory for selected branch
      const allInventory = [];
      const stocksResult = await inventoryService.getBranchStocks(selectedBranch);
      if (stocksResult.success) {
        const branch = branches.find(b => b.id === selectedBranch);
        stocksResult.stocks.forEach(stock => {
          allInventory.push({
            ...stock,
            branchId: selectedBranch,
            branchName: branch?.name || branch?.branchName || 'Unknown Branch'
          });
        });
      }

      setInventory(allInventory);
    } catch (err) {
      console.error('Error loading inventory:', err);
      setError(err.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (branches.length > 0 && !selectedBranch) {
      loadBranchStats();
    }
  }, [branches.length, selectedBranch]);

  useEffect(() => {
    if (selectedBranch) {
      loadInventory();
    }
  }, [selectedBranch]);

  // Get unique categories
  const categories = useMemo(() => {
    return [...new Set(inventory.map(item => item.category).filter(Boolean))];
  }, [inventory]);

  // Filter inventory
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesSearch = 
        item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.branchName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [inventory, searchTerm, categoryFilter, statusFilter]);

  // Calculate statistics for current branch view
  const stats = useMemo(() => {
    if (!selectedBranch) {
      return {
        totalProducts: 0,
        totalValue: 0,
        lowStock: 0,
        outOfStock: 0,
        totalBranches: branches.filter(b => b.isActive !== false).length
      };
    }

    const totalProducts = new Set(inventory.map(item => item.productId)).size;
    const totalValue = inventory.reduce((sum, item) => {
      return sum + ((item.currentStock || 0) * (item.unitCost || 0));
    }, 0);
    const lowStock = inventory.filter(item => {
      const current = item.currentStock || 0;
      const min = item.minStock || 0;
      return current <= min && current > 0;
    }).length;
    const outOfStock = inventory.filter(item => (item.currentStock || 0) === 0).length;

    return {
      totalProducts,
      totalValue,
      lowStock,
      outOfStock,
      totalBranches: 1
    };
  }, [inventory, selectedBranch, branches.length]);

  // Handle view details
  const handleViewDetails = (item) => {
    const product = products.find(p => p.id === item.productId);
    setSelectedProduct({ ...item, product });
    setIsDetailsModalOpen(true);
  };

  // Get status color
  const getStatusColor = (item) => {
    const current = item.currentStock || 0;
    const min = item.minStock || 0;
    
    if (current === 0) return 'text-red-600 bg-red-100';
    if (current <= min) return 'text-orange-600 bg-orange-100';
    return 'text-green-600 bg-green-100';
  };

  // Get status text
  const getStatusText = (item) => {
    const current = item.currentStock || 0;
    const min = item.minStock || 0;
    
    if (current === 0) return 'Out of Stock';
    if (current <= min) return 'Low Stock';
    return 'In Stock';
  };

  // Handle branch card click
  const handleBranchClick = (branchId) => {
    setSelectedBranch(branchId);
    setSearchTerm('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  // Handle back to branches
  const handleBackToBranches = () => {
    setSelectedBranch(null);
    setInventory([]);
    setSearchTerm('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  if (loading && !selectedBranch && Object.keys(branchStats).length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading branches...</span>
      </div>
    );
  }

  // Show branch cards if no branch is selected
  if (!selectedBranch) {
    const activeBranches = branches.filter(b => b.isActive !== false);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory Overview</h1>
            <p className="text-gray-600">Select a branch to view its inventory</p>
          </div>
          <Button onClick={loadBranchStats} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Branch Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeBranches.map((branch) => {
            const stats = branchStats[branch.id] || {
              totalProducts: 0,
              totalValue: 0,
              lowStock: 0,
              outOfStock: 0,
              totalItems: 0
            };

            return (
              <Card
                key={branch.id}
                className="p-6 cursor-pointer hover:shadow-lg transition-all duration-200 border-2 border-gray-200 hover:border-blue-500"
                onClick={() => handleBranchClick(branch.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Building className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {branch.name || branch.branchName}
                      </h3>
                      <p className="text-sm text-gray-500">{branch.address || 'No address'}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-4 w-4 text-blue-600" />
                      <span className="text-xs text-gray-600">Products</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{stats.totalProducts}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Banknote className="h-4 w-4 text-green-600" />
                      <span className="text-xs text-gray-600">Total Value</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      ₱{stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <span className="text-xs text-gray-600">Low Stock</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{stats.lowStock}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-xs text-gray-600">Out of Stock</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{stats.outOfStock}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {activeBranches.length === 0 && (
          <Card className="p-12 text-center">
            <Building className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Branches</h3>
            <p className="text-gray-600">No active branches found in the system.</p>
          </Card>
        )}
      </div>
    );
  }

  // Show inventory view for selected branch
  const currentBranch = branches.find(b => b.id === selectedBranch);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={handleBackToBranches}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Branches
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {currentBranch?.name || currentBranch?.branchName || 'Branch'} Inventory
            </h1>
            <p className="text-gray-600">Viewing inventory for this branch</p>
          </div>
        </div>
        <Button onClick={loadInventory} className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Products</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalProducts}</p>
            </div>
          </div>
        </Card>
          
        <Card className="p-4">
          <div className="flex items-center">
            <Banknote className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-xl font-bold text-gray-900">₱{stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </Card>
          
        <Card className="p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Low Stock</p>
              <p className="text-xl font-bold text-gray-900">{stats.lowStock}</p>
            </div>
          </div>
        </Card>
          
        <Card className="p-4">
          <div className="flex items-center">
            <XCircle className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Out of Stock</p>
              <p className="text-xl font-bold text-gray-900">{stats.outOfStock}</p>
            </div>
          </div>
        </Card>
          
        <Card className="p-4">
          <div className="flex items-center">
            <Building className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Branches</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalBranches}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              placeholder="Search by product name, brand, or category..."
              value={searchTerm}
              onChange={setSearchTerm}
              className="w-full"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Inventory Table */}
      {filteredInventory.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Min Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventory.map((item) => (
                  <tr key={`${item.id}-${item.branchId}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                        <div className="text-xs text-gray-500">{item.brand}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.category || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.currentStock || 0}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.minStock || 0}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">₱{item.unitCost?.toFixed(2) || '0.00'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ₱{((item.currentStock || 0) * (item.unitCost || 0)).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item)}`}>
                        {getStatusText(item) === 'Out of Stock' && <XCircle className="h-3 w-3" />}
                        {getStatusText(item) === 'Low Stock' && <AlertTriangle className="h-3 w-3" />}
                        {getStatusText(item) === 'In Stock' && <CheckCircle className="h-3 w-3" />}
                        {getStatusText(item)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(item)}
                        className="flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Inventory Found</h3>
          <p className="text-gray-600">
            {searchTerm || categoryFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'No inventory data available'}
          </p>
        </Card>
      )}

      {/* Product Details Modal */}
      {isDetailsModalOpen && selectedProduct && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedProduct(null);
          }}
          title="Product Inventory Details"
          size="lg"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Product Name</label>
                <p className="text-gray-900 font-semibold">{selectedProduct.productName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Branch</label>
                <p className="text-gray-900">{selectedProduct.branchName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Brand</label>
                <p className="text-gray-900">{selectedProduct.brand || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Category</label>
                <p className="text-gray-900">{selectedProduct.category || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Current Stock</label>
                <p className="text-gray-900 font-semibold">{selectedProduct.currentStock || 0}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Min Stock</label>
                <p className="text-gray-900">{selectedProduct.minStock || 0}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Max Stock</label>
                <p className="text-gray-900">{selectedProduct.maxStock || 0}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Unit Cost</label>
                <p className="text-gray-900">₱{selectedProduct.unitCost?.toFixed(2) || '0.00'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Total Value</label>
                <p className="text-gray-900 font-semibold text-green-600">
                  ₱{((selectedProduct.currentStock || 0) * (selectedProduct.unitCost || 0)).toFixed(2)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedProduct)}`}>
                  {getStatusText(selectedProduct)}
                </span>
              </div>
              {selectedProduct.lastUpdated && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Updated</label>
                  <p className="text-gray-900">{format(new Date(selectedProduct.lastUpdated), 'MMM dd, yyyy HH:mm')}</p>
                </div>
              )}
              {selectedProduct.location && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Location</label>
                  <p className="text-gray-900">{selectedProduct.location}</p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default OverallInventoryControllerInventory;












