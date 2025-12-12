// src/pages/06_InventoryController/Reports.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import InventoryLayout from '../../layouts/InventoryLayout';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import {
  BarChart3,
  Search,
  Filter,
  Eye,
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
  Image as ImageIcon,
  TrendingUp,
  Banknote,
  Users,
  Truck,
  ArrowRightLeft,
  QrCode,
  PieChart,
  LineChart,
  Activity,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';

const Reports = () => {
  const { userData } = useAuth();
  
  // Data states
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    category: 'all',
    period: 'all',
    status: 'all',
    dateRange: { start: '', end: '' }
  });

  // Mock report data
  const mockReports = [
    {
      id: 'RPT-001',
      name: 'Monthly Inventory Summary',
      category: 'Inventory',
      description: 'Comprehensive overview of inventory levels, movements, and trends',
      status: 'Generated',
      period: 'January 2024',
      generatedAt: new Date('2024-01-31'),
      generatedBy: 'John Smith',
      fileSize: '2.3 MB',
      format: 'PDF',
      downloadCount: 15,
      lastAccessed: new Date('2024-02-01'),
      dataPoints: {
        totalProducts: 247,
        totalValue: 1250000,
        lowStockItems: 12,
        outOfStockItems: 3,
        totalMovements: 89
      }
    },
    {
      id: 'RPT-002',
      name: 'Stock Movement Analysis',
      category: 'Movement',
      description: 'Detailed analysis of stock movements and transfers between branches',
      status: 'Generated',
      period: 'January 2024',
      generatedAt: new Date('2024-01-30'),
      generatedBy: 'Maria Santos',
      fileSize: '1.8 MB',
      format: 'Excel',
      downloadCount: 8,
      lastAccessed: new Date('2024-01-31'),
      dataPoints: {
        totalTransfers: 23,
        totalValue: 45000,
        branchesInvolved: 3,
        averageTransferTime: 2.5
      }
    },
    {
      id: 'RPT-003',
      name: 'Supplier Performance Report',
      category: 'Supplier',
      description: 'Analysis of supplier performance, delivery times, and quality metrics',
      status: 'Generating',
      period: 'Q4 2023',
      generatedAt: new Date('2024-01-29'),
      generatedBy: 'Carlos Mendoza',
      fileSize: '0 MB',
      format: 'PDF',
      downloadCount: 0,
      lastAccessed: null,
      dataPoints: {
        totalSuppliers: 8,
        averageRating: 4.2,
        onTimeDelivery: 85,
        totalOrders: 45
      }
    },
    {
      id: 'RPT-004',
      name: 'Cost Analysis Report',
      category: 'Financial',
      description: 'Detailed cost analysis including unit costs, margins, and profitability',
      status: 'Generated',
      period: 'December 2023',
      generatedAt: new Date('2024-01-15'),
      generatedBy: 'Ana Garcia',
      fileSize: '3.1 MB',
      format: 'PDF',
      downloadCount: 22,
      lastAccessed: new Date('2024-01-20'),
      dataPoints: {
        totalCost: 850000,
        averageMargin: 35,
        topPerformingCategory: 'Hair Care',
        costSavings: 15000
      }
    },
    {
      id: 'RPT-005',
      name: 'Expiry Tracking Report',
      category: 'Expiry',
      description: 'Products approaching expiration and waste reduction analysis',
      status: 'Generated',
      period: 'January 2024',
      generatedAt: new Date('2024-01-28'),
      generatedBy: 'John Smith',
      fileSize: '1.2 MB',
      format: 'Excel',
      downloadCount: 5,
      lastAccessed: new Date('2024-01-29'),
      dataPoints: {
        expiringSoon: 8,
        expiredItems: 2,
        wasteValue: 5000,
        savingsPotential: 12000
      }
    }
  ];

  // Load reports
  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // For now, use mock data
      setReports(mockReports);
      
    } catch (err) {
      console.error('Error loading reports:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load reports on mount
  useEffect(() => {
    loadReports();
  }, []);

  // Get unique categories
  const categories = [...new Set(reports.map(r => r.category))].filter(Boolean);
  const periods = [...new Set(reports.map(r => r.period))].filter(Boolean);

  // Filter and sort reports
  const filteredReports = reports
    .filter(report => {
      const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           report.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = filters.category === 'all' || report.category === filters.category;
      const matchesPeriod = filters.period === 'all' || report.period === filters.period;
      const matchesStatus = filters.status === 'all' || report.status === filters.status;
      
      const matchesDateRange = (!filters.dateRange.start || new Date(report.generatedAt) >= new Date(filters.dateRange.start)) &&
                              (!filters.dateRange.end || new Date(report.generatedAt) <= new Date(filters.dateRange.end));
      
      return matchesSearch && matchesCategory && matchesPeriod && matchesStatus && matchesDateRange;
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'generatedAt' || sortBy === 'lastAccessed') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // Handle report details
  const handleViewDetails = (report) => {
    setSelectedReport(report);
    setIsDetailsModalOpen(true);
  };

  // Handle create report
  const handleCreateReport = () => {
    setIsCreateModalOpen(true);
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle report creation logic here
    console.log('Creating report');
    setIsCreateModalOpen(false);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Generated': return 'text-green-600 bg-green-100';
      case 'Generating': return 'text-blue-600 bg-blue-100';
      case 'Failed': return 'text-red-600 bg-red-100';
      case 'Scheduled': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Generated': return <CheckCircle className="h-4 w-4" />;
      case 'Generating': return <Clock className="h-4 w-4" />;
      case 'Failed': return <XCircle className="h-4 w-4" />;
      case 'Scheduled': return <Calendar className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Get category icon
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Inventory': return <Package className="h-5 w-5" />;
      case 'Movement': return <ArrowRightLeft className="h-5 w-5" />;
      case 'Supplier': return <Truck className="h-5 w-5" />;
      case 'Financial': return <Banknote className="h-5 w-5" />;
      case 'Expiry': return <Calendar className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  // Calculate report statistics
  const reportStats = {
    totalReports: reports.length,
    generatedReports: reports.filter(r => r.status === 'Generated').length,
    generatingReports: reports.filter(r => r.status === 'Generating').length,
    totalDownloads: reports.reduce((sum, r) => sum + r.downloadCount, 0),
    totalFileSize: reports.reduce((sum, r) => sum + parseFloat(r.fileSize), 0)
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading reports...</span>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Reports</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadReports} className="flex items-center gap-2">
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
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm md:text-base text-gray-600">Generate and manage inventory reports and analytics</p>
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
            <Button onClick={handleCreateReport} className="flex items-center gap-2 text-xs md:text-sm">
              <Plus className="h-4 w-4" />
              Generate Report
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          <Card className="p-4">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Reports</p>
                <p className="text-xl font-bold text-gray-900">{reportStats.totalReports}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Generated</p>
                <p className="text-xl font-bold text-gray-900">{reportStats.generatedReports}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Generating</p>
                <p className="text-xl font-bold text-gray-900">{reportStats.generatingReports}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <Download className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Downloads</p>
                <p className="text-xl font-bold text-gray-900">{reportStats.totalDownloads}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Size</p>
                <p className="text-xl font-bold text-gray-900">{reportStats.totalFileSize.toFixed(1)} MB</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                placeholder="Search by report name, description, or category..."
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
                <option value="all">All Periods</option>
                {periods.map(period => (
                  <option key={period} value={period}>{period}</option>
                ))}
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="Generated">Generated</option>
                <option value="Generating">Generating</option>
                <option value="Failed">Failed</option>
                <option value="Scheduled">Scheduled</option>
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
                  period: 'all',
                  status: 'all',
                  dateRange: { start: '', end: '' }
                })}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </Card>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report) => (
            <Card key={report.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {/* Report Header */}
              <div className="p-6 border-b">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      {getCategoryIcon(report.category)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{report.name}</h3>
                      <p className="text-sm text-gray-500">{report.category}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                    {getStatusIcon(report.status)}
                    {report.status}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 line-clamp-2">{report.description}</p>
              </div>

              {/* Report Info */}
              <div className="p-6">
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{report.period}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{report.generatedBy}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{report.format} • {report.fileSize}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Download className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{report.downloadCount} downloads</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(report)}
                    className="flex-1 flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                  {report.status === 'Generated' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredReports.length === 0 && (
          <Card className="p-12 text-center">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports Found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || Object.values(filters).some(f => f !== 'all' && f !== '')
                ? 'Try adjusting your search or filters'
                : 'Get started by generating your first report'
              }
            </p>
            <Button onClick={handleCreateReport} className="flex items-center gap-2 mx-auto">
              <Plus className="h-4 w-4" />
              Generate Report
            </Button>
          </Card>
        )}

        {/* Report Details Modal */}
        {isDetailsModalOpen && selectedReport && (
          <Modal
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false);
              setSelectedReport(null);
            }}
            title="Report Details"
            size="lg"
          >
            <div className="space-y-6">
              {/* Report Header */}
              <div className="flex gap-6">
                <div className="w-32 h-32 bg-blue-100 rounded-lg flex items-center justify-center">
                  {getCategoryIcon(selectedReport.category)}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h2 className="text-xl font-bold text-gray-900">{selectedReport.name}</h2>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedReport.status)}`}>
                      {getStatusIcon(selectedReport.status)}
                      {selectedReport.status}
                    </span>
                  </div>
                  <p className="text-lg text-gray-600 mb-2">{selectedReport.category}</p>
                  <p className="text-sm text-gray-500">{selectedReport.description}</p>
                </div>
              </div>

              {/* Report Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Period</label>
                    <p className="text-gray-900">{selectedReport.period}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Generated By</label>
                    <p className="text-gray-900">{selectedReport.generatedBy}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Generated At</label>
                    <p className="text-gray-900">{format(new Date(selectedReport.generatedAt), 'MMM dd, yyyy HH:mm')}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">File Format</label>
                    <p className="text-gray-900">{selectedReport.format}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">File Size</label>
                    <p className="text-gray-900">{selectedReport.fileSize}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Download Count</label>
                    <p className="text-gray-900">{selectedReport.downloadCount}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Last Accessed</label>
                    <p className="text-gray-900">
                      {selectedReport.lastAccessed 
                        ? format(new Date(selectedReport.lastAccessed), 'MMM dd, yyyy HH:mm')
                        : 'Never'
                      }
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Report ID</label>
                    <p className="text-gray-900 font-mono">{selectedReport.id}</p>
                  </div>
                </div>
              </div>

              {/* Data Points */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Key Metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(selectedReport.dataPoints).map(([key, value]) => (
                    <div key={key} className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-gray-900">{value}</div>
                      <div className="text-xs text-gray-500 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                {selectedReport.status === 'Generated' && (
                  <>
                    <Button className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Download Report
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Printer className="h-4 w-4" />
                      Print
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Copy className="h-4 w-4" />
                      Share
                    </Button>
                  </>
                )}
                {selectedReport.status === 'Generating' && (
                  <Button variant="outline" disabled className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Generating...
                  </Button>
                )}
              </div>
            </div>
          </Modal>
        )}

        {/* Create Report Modal */}
        {isCreateModalOpen && (
          <Modal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            title="Generate Report"
            size="md"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Report Type *</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required>
                  <option value="">Select Report Type</option>
                  <option value="inventory">Inventory Summary</option>
                  <option value="movement">Stock Movement</option>
                  <option value="supplier">Supplier Performance</option>
                  <option value="financial">Cost Analysis</option>
                  <option value="expiry">Expiry Tracking</option>
                  <option value="custom">Custom Report</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Period *</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required>
                  <option value="">Select Period</option>
                  <option value="last7days">Last 7 Days</option>
                  <option value="last30days">Last 30 Days</option>
                  <option value="last3months">Last 3 Months</option>
                  <option value="last6months">Last 6 Months</option>
                  <option value="lastyear">Last Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Format *</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required>
                  <option value="">Select Format</option>
                  <option value="PDF">PDF</option>
                  <option value="Excel">Excel</option>
                  <option value="CSV">CSV</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Include Charts</label>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="includeCharts"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="includeCharts" className="ml-2 block text-sm text-gray-900">
                    Include charts and graphs
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Notification</label>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="emailNotification"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="emailNotification" className="ml-2 block text-sm text-gray-900">
                    Send email when report is ready
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Generate Report
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="date"
                    placeholder="Start Date"
                    value={filters.dateRange.start}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      dateRange: { ...prev.dateRange, start: e.target.value }
                    }))}
                  />
                  <Input
                    type="date"
                    placeholder="End Date"
                    value={filters.dateRange.end}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      dateRange: { ...prev.dateRange, end: e.target.value }
                    }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">File Size</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="all">All Sizes</option>
                  <option value="small">Small (&lt; 1 MB)</option>
                  <option value="medium">Medium (1-5 MB)</option>
                  <option value="large">Large (&gt; 5 MB)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setFilters({
                  category: 'all',
                  period: 'all',
                  status: 'all',
                  dateRange: { start: '', end: '' }
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

export default Reports;
