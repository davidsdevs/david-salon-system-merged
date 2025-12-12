// src/pages/06_InventoryController/CostAnalysis.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import InventoryLayout from '../../layouts/InventoryLayout';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import { 
  Banknote,
  Search,
  Filter,
  Eye,
  Edit,
  Plus,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Calendar,
  Building,
  FileText,
  Bell,
  AlertCircle,
  TrendingDown,
  ShoppingCart,
  ArrowRight,
  Copy,
  Printer,
  Trash2,
  Clock3,
  CalendarDays,
  AlertCircle as AlertCircleIcon,
  Calculator,
  BarChart3,
  Users,
  CheckSquare,
  Square,
  TrendingUp,
  PieChart,
  LineChart,
  Activity,
  Target,
  Percent
} from 'lucide-react';
import { format } from 'date-fns';

const CostAnalysis = () => {
  const { userData } = useAuth();

  // Data states
  const [analysisData, setAnalysisData] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [sortBy, setSortBy] = useState('totalCost');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    category: 'all',
    period: 'monthly',
    costRange: { min: '', max: '' },
    marginRange: { min: '', max: '' }
  });

  // Mock analysis data
  const mockAnalysisData = [
    {
      id: 'analysis-001',
      productId: 'prod1',
      productName: 'Olaplex No.3 Hair Perfector',
      category: 'Hair Care',
      brand: 'Olaplex',
      unitCost: 900,
      sellingPrice: 1800,
      margin: 900,
      marginPercentage: 50,
      totalUnits: 45,
      totalCost: 40500,
      totalRevenue: 81000,
      totalProfit: 40500,
      branchId: 'branch1',
      branchName: 'Harbor Point Ayala',
      supplier: 'Olaplex Philippines',
      lastUpdated: new Date('2024-01-15'),
      performance: 'High',
      trend: 'up'
    },
    {
      id: 'analysis-002',
      productId: 'prod2',
      productName: 'L\'Oréal Hair Color',
      category: 'Hair Color',
      brand: 'L\'Oréal',
      unitCost: 500,
      sellingPrice: 800,
      margin: 300,
      marginPercentage: 37.5,
      totalUnits: 25,
      totalCost: 12500,
      totalRevenue: 20000,
      totalProfit: 7500,
      branchId: 'branch1',
      branchName: 'Harbor Point Ayala',
      supplier: 'L\'Oréal Philippines',
      lastUpdated: new Date('2024-01-14'),
      performance: 'Medium',
      trend: 'stable'
    },
    {
      id: 'analysis-003',
      productId: 'prod3',
      productName: 'Kerastase Shampoo',
      category: 'Hair Care',
      brand: 'Kerastase',
      unitCost: 800,
      sellingPrice: 1200,
      margin: 400,
      marginPercentage: 33.3,
      totalUnits: 30,
      totalCost: 24000,
      totalRevenue: 36000,
      totalProfit: 12000,
      branchId: 'branch2',
      branchName: 'SM Mall of Asia',
      supplier: 'Kerastase Philippines',
      lastUpdated: new Date('2024-01-13'),
      performance: 'Medium',
      trend: 'down'
    },
    {
      id: 'analysis-004',
      productId: 'prod4',
      productName: 'Wella Hair Color',
      category: 'Hair Color',
      brand: 'Wella',
      unitCost: 600,
      sellingPrice: 900,
      margin: 300,
      marginPercentage: 33.3,
      totalUnits: 15,
      totalCost: 9000,
      totalRevenue: 13500,
      totalProfit: 4500,
      branchId: 'branch3',
      branchName: 'Greenbelt 5',
      supplier: 'Wella Philippines',
      lastUpdated: new Date('2024-01-12'),
      performance: 'Low',
      trend: 'stable'
    }
  ];

  // Load analysis data
  const loadAnalysisData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // For now, use mock data
      setAnalysisData(mockAnalysisData);
      
    } catch (err) {
      console.error('Error loading analysis data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadAnalysisData();
  }, []);

  // Get unique categories
  const categories = [...new Set(analysisData.map(a => a.category))].filter(Boolean);

  // Filter and sort analysis data
  const filteredData = analysisData
    .filter(item => {
      const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = filters.category === 'all' || item.category === filters.category;
      
      const matchesCostRange = (!filters.costRange.min || item.unitCost >= parseFloat(filters.costRange.min)) &&
                              (!filters.costRange.max || item.unitCost <= parseFloat(filters.costRange.max));
      
      const matchesMarginRange = (!filters.marginRange.min || item.marginPercentage >= parseFloat(filters.marginRange.min)) &&
                                (!filters.marginRange.max || item.marginPercentage <= parseFloat(filters.marginRange.max));
      
      return matchesSearch && matchesCategory && matchesCostRange && matchesMarginRange;
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'lastUpdated') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // Handle item details
  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setIsDetailsModalOpen(true);
  };

  // Handle create analysis
  const handleCreateAnalysis = () => {
    setIsCreateModalOpen(true);
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle form submission logic here
    console.log('Form submitted');
    setIsCreateModalOpen(false);
  };

  // Get performance color
  const getPerformanceColor = (performance) => {
    switch (performance) {
      case 'High': return 'text-green-600 bg-green-100';
      case 'Medium': return 'text-yellow-600 bg-yellow-100';
      case 'Low': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get performance icon
  const getPerformanceIcon = (performance) => {
    switch (performance) {
      case 'High': return <TrendingUp className="h-4 w-4" />;
      case 'Medium': return <Activity className="h-4 w-4" />;
      case 'Low': return <TrendingDown className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  // Get trend icon
  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'stable': return <Activity className="h-4 w-4 text-gray-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  // Calculate summary statistics
  const summaryStats = {
    totalProducts: analysisData.length,
    totalCost: analysisData.reduce((sum, item) => sum + item.totalCost, 0),
    totalRevenue: analysisData.reduce((sum, item) => sum + item.totalRevenue, 0),
    totalProfit: analysisData.reduce((sum, item) => sum + item.totalProfit, 0),
    averageMargin: analysisData.reduce((sum, item) => sum + item.marginPercentage, 0) / analysisData.length || 0,
    highPerformers: analysisData.filter(item => item.performance === 'High').length,
    lowPerformers: analysisData.filter(item => item.performance === 'Low').length
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading cost analysis...</span>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Cost Analysis</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadAnalysisData} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Cost Analysis</h1>
            <p className="text-sm md:text-base text-gray-600">Analyze product costs, margins, and profitability</p>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <Button variant="outline" className="flex items-center gap-2 text-xs md:text-sm">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button variant="outline" className="flex items-center gap-2 text-xs md:text-sm">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button onClick={handleCreateAnalysis} className="flex items-center gap-2 text-xs md:text-sm">
              <Plus className="h-4 w-4" />
              New Analysis
            </Button>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
          <Card className="p-4">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Products</p>
                <p className="text-xl font-bold text-gray-900">{summaryStats.totalProducts}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <Banknote className="h-8 w-8 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Cost</p>
                <p className="text-xl font-bold text-gray-900">₱{summaryStats.totalCost.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-xl font-bold text-gray-900">₱{summaryStats.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Profit</p>
                <p className="text-xl font-bold text-gray-900">₱{summaryStats.totalProfit.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <Percent className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Avg Margin</p>
                <p className="text-xl font-bold text-gray-900">{summaryStats.averageMargin.toFixed(1)}%</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-indigo-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">High Performers</p>
                <p className="text-xl font-bold text-gray-900">{summaryStats.highPerformers}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search and Filters */}
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
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <select
                value={filters.period}
                onChange={(e) => setFilters(prev => ({ ...prev, period: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
              <Button
                variant="outline"
                onClick={() => setIsFilterModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                More Filters
              </Button>
              <Button
                variant="outline"
                onClick={() => setFilters({
                  category: 'all',
                  period: 'monthly',
                  costRange: { min: '', max: '' },
                  marginRange: { min: '', max: '' }
                })}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </Card>

        {/* Analysis Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Selling Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Margin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Performance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Profit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trend
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                        <div className="text-sm text-gray-500">{item.brand} • {item.category}</div>
                        <div className="text-xs text-gray-400">{item.branchName}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">₱{item.unitCost.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">₱{item.sellingPrice.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">₱{item.margin.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">{item.marginPercentage}%</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getPerformanceColor(item.performance)}`}>
                        {getPerformanceIcon(item.performance)}
                        {item.performance}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">₱{item.totalProfit.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">{item.totalUnits} units</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getTrendIcon(item.trend)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(item)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1"
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Empty State */}
        {filteredData.length === 0 && (
          <Card className="p-12 text-center">
            <Banknote className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Analysis Data Found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || Object.values(filters).some(f => f !== 'all' && f !== '')
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first cost analysis'
              }
            </p>
            <Button onClick={handleCreateAnalysis} className="flex items-center gap-2 mx-auto">
              <Plus className="h-4 w-4" />
              New Analysis
            </Button>
          </Card>
        )}

        {/* Item Details Modal */}
        {isDetailsModalOpen && selectedItem && (
          <Modal
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false);
              setSelectedItem(null);
            }}
            title="Cost Analysis Details"
            size="lg"
          >
            <div className="space-y-6">
              {/* Item Header */}
              <div className="flex gap-6">
                <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Package className="h-16 w-16 text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h2 className="text-xl font-bold text-gray-900">{selectedItem.productName}</h2>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getPerformanceColor(selectedItem.performance)}`}>
                      {getPerformanceIcon(selectedItem.performance)}
                      {selectedItem.performance}
                    </span>
                  </div>
                  <p className="text-lg text-gray-600 mb-2">{selectedItem.brand}</p>
                  <p className="text-sm text-gray-500">{selectedItem.category}</p>
                </div>
              </div>

              {/* Cost Analysis */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Cost Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Unit Cost</label>
                    <p className="text-2xl font-bold text-red-600">₱{selectedItem.unitCost.toLocaleString()}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Selling Price</label>
                    <p className="text-2xl font-bold text-green-600">₱{selectedItem.sellingPrice.toLocaleString()}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Margin (Amount)</label>
                    <p className="text-xl font-semibold text-gray-900">₱{selectedItem.margin.toLocaleString()}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Margin (Percentage)</label>
                    <p className="text-xl font-semibold text-gray-900">{selectedItem.marginPercentage}%</p>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Financial Summary</h3>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Units</label>
                    <p className="text-lg font-semibold text-gray-900">{selectedItem.totalUnits}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Cost</label>
                    <p className="text-lg font-semibold text-red-600">₱{selectedItem.totalCost.toLocaleString()}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Revenue</label>
                    <p className="text-lg font-semibold text-green-600">₱{selectedItem.totalRevenue.toLocaleString()}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Profit</label>
                    <p className="text-2xl font-bold text-purple-600">₱{selectedItem.totalProfit.toLocaleString()}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Additional Info</h3>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Branch</label>
                    <p className="text-gray-900">{selectedItem.branchName}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Supplier</label>
                    <p className="text-gray-900">{selectedItem.supplier}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Last Updated</label>
                    <p className="text-gray-900">{format(new Date(selectedItem.lastUpdated), 'MMM dd, yyyy')}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Trend</label>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(selectedItem.trend)}
                      <span className="text-gray-900 capitalize">{selectedItem.trend}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profitability Chart Placeholder */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Profitability Trend</h3>
                <div className="h-32 bg-white rounded border flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <BarChart3 className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Chart visualization would go here</p>
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Create Analysis Modal */}
        {isCreateModalOpen && (
          <Modal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            title="Create Cost Analysis"
            size="md"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product *</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required>
                  <option value="">Select Product</option>
                  {/* Product options would be populated here */}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit Cost *</label>
                  <Input
                    type="number"
                    placeholder="Enter unit cost"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Selling Price *</label>
                  <Input
                    type="number"
                    placeholder="Enter selling price"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Total Units</label>
                <Input
                  type="number"
                  placeholder="Enter total units"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Analysis Period</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Create Analysis
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Advanced Filters Modal */}
        {isFilterModalOpen && (
          <Modal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            title="Advanced Filters"
            size="md"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cost Range</label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    placeholder="Min Cost"
                    value={filters.costRange.min}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      costRange: { ...prev.costRange, min: e.target.value }
                    }))}
                  />
                  <Input
                    type="number"
                    placeholder="Max Cost"
                    value={filters.costRange.max}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      costRange: { ...prev.costRange, max: e.target.value }
                    }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Margin Range (%)</label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    placeholder="Min Margin %"
                    value={filters.marginRange.min}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      marginRange: { ...prev.marginRange, min: e.target.value }
                    }))}
                  />
                  <Input
                    type="number"
                    placeholder="Max Margin %"
                    value={filters.marginRange.max}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      marginRange: { ...prev.marginRange, max: e.target.value }
                    }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setFilters({
                  category: 'all',
                  period: 'monthly',
                  costRange: { min: '', max: '' },
                  marginRange: { min: '', max: '' }
                })}>
                  Reset
                </Button>
                <Button onClick={() => setIsFilterModalOpen(false)}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
};

export default CostAnalysis;
