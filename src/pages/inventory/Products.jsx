// src/pages/inventory/Products.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import ImportModal from '../../components/ImportModal';
import { productService } from '../../services/productService';
import {
  Package,
  Filter,
  Eye,
  Plus,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Printer,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAllServices } from '../../services/serviceManagementService';
import { Scissors } from 'lucide-react';
import { exportToExcel } from '../../utils/excelExport';
import { toast } from 'react-hot-toast';

const Products = () => {
  const { userData } = useAuth();
  
  // Data states
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]); // For mapping supplier IDs to names
  const [services, setServices] = useState([]); // For mapping service IDs to names
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); // 5 products per row × 4 rows = 20 products per page
  
  // Filter states
  const [filters, setFilters] = useState({
    category: 'all',
    status: 'all',
    supplier: 'all',
    priceRange: { min: '', max: '' },
    commissionRange: { min: '', max: '' }
  });

  // Load suppliers
  const loadSuppliers = async () => {
    try {
      const suppliersRef = collection(db, 'suppliers');
      const snapshot = await getDocs(suppliersRef);
      const suppliersList = [];
      snapshot.forEach((doc) => {
        suppliersList.push({
          id: doc.id,
          name: doc.data().name || 'Unknown Supplier',
          ...doc.data()
        });
      });
      setSuppliers(suppliersList);
    } catch (err) {
      console.error('Error loading suppliers:', err);
    }
  };

  // Load products - only products available to this branch (we offer)
  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await productService.getAllProducts();
      if (result.success) {
        // Filter to only show products available to this branch
        const branchProducts = result.products.filter(product => {
          // Check if product is available to this branch
          if (product.branches && Array.isArray(product.branches)) {
            return product.branches.includes(userData?.branchId);
          }
          // If no branches specified, include it (backward compatibility)
          return true;
        });
        setProducts(branchProducts);
      } else {
        throw new Error(result.message || 'Failed to load products');
      }
    } catch (err) {
      console.error('Error loading products:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load services
  const loadServices = async () => {
    try {
      const servicesList = await getAllServices();
      setServices(servicesList);
    } catch (err) {
      console.error('Error loading services:', err);
    }
  };

  // Load products and suppliers on mount
  useEffect(() => {
    loadSuppliers();
    loadServices();
    loadProducts();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, sortBy, sortOrder]);

  // Get unique categories
  const categories = [...new Set(products.map(p => p.category))].filter(Boolean);
  
  // Get unique supplier IDs from products (for filter dropdown)
  // Get unique supplier IDs from products (handling both array and single supplier)
  const uniqueSupplierIds = [...new Set(products.flatMap(p => {
    if (Array.isArray(p.suppliers)) {
      return p.suppliers;
    }
    return p.supplier ? [p.supplier] : [];
  }))].filter(Boolean);

  // Filter and sort products
  const filteredProducts = products
    .filter(product => {
      const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = filters.category === 'all' || product.category === filters.category;
      const matchesStatus = filters.status === 'all' || product.status === filters.status;
      const matchesSupplier = filters.supplier === 'all' || (() => {
        // Check if suppliers is an array and contains the filter supplier ID
        if (Array.isArray(product.suppliers)) {
          return product.suppliers.includes(filters.supplier);
        }
        // Fallback for old data structure (single supplier)
        return product.supplier === filters.supplier;
      })();
      
      const matchesPriceRange = (!filters.priceRange.min || product.otcPrice >= parseFloat(filters.priceRange.min)) &&
                               (!filters.priceRange.max || product.otcPrice <= parseFloat(filters.priceRange.max));
      
      const matchesCommissionRange = (!filters.commissionRange.min || product.commissionPercentage >= parseFloat(filters.commissionRange.min)) &&
                                    (!filters.commissionRange.max || product.commissionPercentage <= parseFloat(filters.commissionRange.max));
      
      return matchesSearch && matchesCategory && matchesStatus && matchesSupplier && matchesPriceRange && matchesCommissionRange;
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Handle product details
  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    setIsDetailsModalOpen(true);
  };

  // Handle filter reset
  const resetFilters = () => {
    setFilters({
      category: 'all',
      status: 'all',
      supplier: 'all',
      priceRange: { min: '', max: '' },
      commissionRange: { min: '', max: '' }
    });
    setSearchTerm('');
  };

  // Print/Report function for branch manager viewing
  const handlePrintReport = () => {
    if (!filteredProducts.length) {
      toast.error('No products to print');
      return;
    }

    // Create a print-friendly HTML content
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Products Report - ${userData?.branchName || 'Branch'}</title>
          <style>
            @media print {
              @page { margin: 1cm; }
            }
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #160B53; margin-bottom: 10px; }
            .header-info { margin-bottom: 20px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: bold; }
            .status-active { color: green; }
            .status-inactive { color: red; }
            .footer { margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <h1>Products Report</h1>
          <div class="header-info">
            <p><strong>Branch:</strong> ${userData?.branchName || 'N/A'}</p>
            <p><strong>Generated:</strong> ${format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
            <p><strong>Total Products:</strong> ${filteredProducts.length}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Brand</th>
                <th>Category</th>
                <th>UPC</th>
                <th>OTC Price</th>
                <th>Unit Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredProducts.map(product => `
                <tr>
                  <td>${product.name || 'N/A'}</td>
                  <td>${product.brand || 'N/A'}</td>
                  <td>${product.category || 'N/A'}</td>
                  <td>${product.upc || 'N/A'}</td>
                  <td>₱${(product.otcPrice || 0).toLocaleString()}</td>
                  <td>₱${(product.unitCost || 0).toLocaleString()}</td>
                  <td class="status-${product.status?.toLowerCase() || 'active'}">${product.status || 'Active'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            <p>This report is for branch manager viewing purposes only.</p>
          </div>
        </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Export products to Excel
  const exportProducts = () => {
    if (!filteredProducts.length) {
      toast.error('No products to export');
      return;
    }

    try {
      const headers = [
        { key: 'name', label: 'Name' },
        { key: 'brand', label: 'Brand' },
        { key: 'category', label: 'Category' },
        { key: 'description', label: 'Description' },
        { key: 'upc', label: 'UPC' },
        { key: 'otcPrice', label: 'OTC Price (₱)' },
        { key: 'salonUsePrice', label: 'Salon Use Price (₱)' },
        { key: 'unitCost', label: 'Unit Cost (₱)' },
        { key: 'commissionPercentage', label: 'Commission Percentage (%)' },
        { key: 'status', label: 'Status' },
        { key: 'variants', label: 'Variants' },
        { key: 'shelfLife', label: 'Shelf Life' },
        { key: 'suppliers', label: 'Suppliers' }
      ];

      // Prepare data with formatted suppliers
      const exportData = filteredProducts.map(product => {
        const suppliers = Array.isArray(product.suppliers) 
          ? product.suppliers.join('; ')
          : (product.supplier || '');
        
        return {
          ...product,
          suppliers: suppliers,
          otcPrice: product.otcPrice || 0,
          salonUsePrice: product.salonUsePrice || 0,
          unitCost: product.unitCost || 0,
          commissionPercentage: product.commissionPercentage || 0
        };
      });

      exportToExcel(exportData, 'products_export', 'Products', headers);
      toast.success('Products exported to Excel successfully');
    } catch (error) {
      console.error('Error exporting products:', error);
      toast.error('Failed to export products');
    }
  };

  // Handle import
  const handleImport = async (data) => {
    try {
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const row of data) {
        try {
          // Map CSV columns to product data structure
          const productData = {
            name: row.Name || row.name || '',
            brand: row.Brand || row.brand || '',
            category: row.Category || row.category || '',
            description: row.Description || row.description || '',
            upc: row.UPC || row.upc || '',
            otcPrice: parseFloat(row['OTC Price'] || row.otcPrice || 0),
            salonUsePrice: parseFloat(row['Salon Use Price'] || row.salonUsePrice || 0),
            unitCost: parseFloat(row['Unit Cost'] || row.unitCost || 0),
            commissionPercentage: parseFloat(row['Commission Percentage'] || row.commissionPercentage || 0),
            status: row.Status || row.status || 'Active',
            variants: row.Variants || row.variants || '',
            shelfLife: row['Shelf Life'] || row.shelfLife || '',
            suppliers: row.Suppliers ? row.Suppliers.split(';').map(s => s.trim()).filter(Boolean) : []
          };

          // Validate required fields
          if (!productData.name) {
            throw new Error('Name is required');
          }

          // Create product
          const result = await productService.createProduct(productData);
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`Row ${data.indexOf(row) + 2}: ${result.message || 'Failed to create'}`);
          }
        } catch (err) {
          errorCount++;
          errors.push(`Row ${data.indexOf(row) + 2}: ${err.message}`);
        }
      }

      // Reload products
      await loadProducts();

      if (errorCount > 0) {
        return {
          success: false,
          error: `Imported ${successCount} products. ${errorCount} errors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more` : ''}`
        };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'text-green-600 bg-green-100';
      case 'Inactive': return 'text-red-600 bg-red-100';
      case 'Discontinued': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Active': return <CheckCircle className="h-4 w-4" />;
      case 'Inactive': return <XCircle className="h-4 w-4" />;
      case 'Discontinued': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading products...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Products</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadProducts} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm md:text-base text-gray-600">Manage your product inventory and details</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <Button 
            variant="outline" 
            className="flex items-center gap-2 text-xs md:text-sm"
            onClick={handlePrintReport}
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Report</span>
          </Button>
          <Button 
            variant="outline" 
            className="flex items-center gap-2 text-xs md:text-sm"
            onClick={() => setIsImportModalOpen(true)}
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button 
            variant="outline" 
            className="flex items-center gap-2 text-xs md:text-sm"
            onClick={exportProducts}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <SearchInput
              placeholder="Search products by name, brand, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex gap-2 md:gap-3 flex-wrap">
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
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Discontinued">Discontinued</option>
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
              onClick={resetFilters}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {/* Products Grid - 5 per row */}
      <Card className="p-4 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {paginatedProducts.map((product) => (
            <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              {/* Product Image */}
              <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover rounded-lg"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) {
                        e.target.nextSibling.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div className="w-full h-full flex items-center justify-center" style={{ display: product.imageUrl ? 'none' : 'flex' }}>
                  <Package className="h-12 w-12 text-gray-400" />
                </div>
              </div>

              {/* Product Info */}
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{product.name}</h3>
                <p className="text-xs text-gray-500">{product.brand || 'N/A'}</p>
                <p className="text-xs text-gray-400 line-clamp-1">{product.category || 'N/A'}</p>
                
                {/* Prices */}
                <div className="space-y-1 pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">OTC:</span>
                    <span className="text-sm font-semibold text-green-600">₱{product.otcPrice?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Salon:</span>
                    <span className="text-sm font-semibold text-blue-600">₱{product.salonUsePrice?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Cost:</span>
                    <span className="text-xs text-gray-700">₱{product.unitCost?.toLocaleString() || '0'}</span>
                  </div>
                </div>

                {/* Status */}
                <div className="pt-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
                    {getStatusIcon(product.status)}
                    {product.status}
                  </span>
                </div>

                {/* Actions */}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(product)}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View Details
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="text-sm text-gray-600">
              Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(endIndex, filteredProducts.length)}</span> of{' '}
              <span className="font-medium">{filteredProducts.length}</span> products
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-sm text-gray-600">
                Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Empty State */}
      {filteredProducts.length === 0 && (
        <Card className="p-12 text-center">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Products Found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || Object.values(filters).some(f => f !== 'all' && (typeof f === 'object' ? Object.values(f).some(v => v !== '') : f !== ''))
              ? 'Try adjusting your search or filters'
              : 'No products are available to this branch'
            }
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
          title="Product Details"
          size="lg"
        >
          <div className="space-y-6">
            {/* Product Header */}
            <div className="flex gap-6">
              <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                {selectedProduct.imageUrl ? (
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <Package className="h-16 w-16 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="text-xl font-bold text-gray-900">{selectedProduct.name}</h2>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedProduct.status)}`}>
                    {getStatusIcon(selectedProduct.status)}
                    {selectedProduct.status}
                  </span>
                </div>
                <p className="text-lg text-gray-600 mb-2">{selectedProduct.brand}</p>
                <p className="text-sm text-gray-500">UPC: {selectedProduct.upc || 'N/A'}</p>
              </div>
            </div>

            {/* Product Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="text-gray-900 mt-1">{selectedProduct.description}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Category</label>
                  <p className="text-gray-900 mt-1">{selectedProduct.category}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Supplier</label>
                  <p className="text-gray-900 mt-1">
                    {Array.isArray(selectedProduct.suppliers) 
                      ? selectedProduct.suppliers.join(', ')
                      : (selectedProduct.supplier || 'N/A')}
                  </p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Variants</label>
                  <p className="text-gray-900 mt-1">{selectedProduct.variants || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">OTC Price</label>
                  <p className="text-lg font-semibold text-green-600 mt-1">₱{selectedProduct.otcPrice?.toLocaleString() || '0'}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Service Product Mapping</label>
                  {(() => {
                    // Find all services that have this product in their productMappings
                    const mappedServices = services.filter(service => {
                      if (!service.productMappings || !Array.isArray(service.productMappings)) {
                        return false;
                      }
                      return service.productMappings.some(mapping => 
                        mapping.productId === selectedProduct.id
                      );
                    });

                    if (mappedServices.length > 0) {
                      return (
                        <div className="mt-2 space-y-1">
                          {mappedServices.map((service) => (
                            <div key={service.id} className="flex items-center gap-2">
                              <Scissors className="w-4 h-4 text-purple-500 flex-shrink-0" />
                              <span className="text-gray-900">{service.name || 'Unknown Service'}</span>
                            </div>
                          ))}
                        </div>
                      );
                    } else {
                      return (
                        <p className="text-gray-500 mt-1 text-sm">No services mapped</p>
                      );
                    }
                  })()}
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Unit Cost</label>
                  <p className="text-lg font-semibold text-gray-900 mt-1">₱{selectedProduct.unitCost?.toLocaleString() || '0'}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Commission</label>
                  <p className="text-lg font-semibold text-purple-600 mt-1">{selectedProduct.commissionPercentage || 0}%</p>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Shelf Life</label>
                <p className="text-gray-900 mt-1">{selectedProduct.shelfLife || 'N/A'}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Branches</label>
                <p className="text-gray-900 mt-1">{selectedProduct.branches?.length || 0} branch(es)</p>
              </div>
            </div>

            {/* Service Mapping Details */}
            {(() => {
              // Find all services that have this product in their productMappings
              const mappedServices = services.filter(service => {
                if (!service.productMappings || !Array.isArray(service.productMappings)) {
                  return false;
                }
                return service.productMappings.some(mapping => 
                  mapping.productId === selectedProduct.id
                );
              });

              if (mappedServices.length > 0) {
                return (
                  <div className="border-t pt-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-purple-500" />
                      Service-Product Mapping Details
                    </h3>
                    <div className="space-y-2">
                      {mappedServices.map((service) => {
                        const productMapping = service.productMappings.find(m => m.productId === selectedProduct.id);
                        return (
                          <div key={service.id} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Scissors className="w-4 h-4 text-purple-500" />
                              <span className="text-sm font-medium text-gray-900">{service.name || 'Unknown Service'}</span>
                            </div>
                            {productMapping?.instructions && Array.isArray(productMapping.instructions) && productMapping.instructions.length > 0 ? (
                              <div className="ml-6 space-y-1">
                                {productMapping.instructions.map((instruction, idx) => (
                                  <div key={idx} className="text-xs text-gray-600">
                                    {instruction.instruction}: {instruction.quantity} {instruction.unit} @ {instruction.percentage}%
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Timestamps */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500">
                <div>
                  <span className="font-medium">Created:</span> {format(new Date(selectedProduct.createdAt), 'MMM dd, yyyy HH:mm')}
                </div>
                <div>
                  <span className="font-medium">Updated:</span> {format(new Date(selectedProduct.updatedAt), 'MMM dd, yyyy HH:mm')}
                </div>
              </div>
            </div>
          </div>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Supplier</label>
              <select
                value={filters.supplier}
                onChange={(e) => setFilters(prev => ({ ...prev, supplier: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Suppliers</option>
                {suppliers.filter(s => uniqueSupplierIds.includes(s.id)).map(supplier => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  placeholder="Min Price"
                  value={filters.priceRange.min}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    priceRange: { ...prev.priceRange, min: e.target.value }
                  }))}
                />
                <Input
                  type="number"
                  placeholder="Max Price"
                  value={filters.priceRange.max}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    priceRange: { ...prev.priceRange, max: e.target.value }
                  }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Commission Range</label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  placeholder="Min %"
                  value={filters.commissionRange.min}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    commissionRange: { ...prev.commissionRange, min: e.target.value }
                  }))}
                />
                <Input
                  type="number"
                  placeholder="Max %"
                  value={filters.commissionRange.max}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    commissionRange: { ...prev.commissionRange, max: e.target.value }
                  }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetFilters}>
                Reset
              </Button>
              <Button onClick={() => setIsFilterModalOpen(false)} className="bg-[#160B53] hover:bg-[#12094A] text-white">
                Apply Filters
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImport}
        templateColumns={[
          'Name', 'Brand', 'Category', 'Description', 'UPC',
          'OTC Price', 'Salon Use Price', 'Unit Cost', 'Commission Percentage',
          'Status', 'Variants', 'Shelf Life', 'Suppliers'
        ]}
        templateName="products"
        sampleData={[
          {
            Name: 'Professional Shampoo',
            Brand: 'L\'Oreal',
            Category: 'Hair Care',
            Description: 'Professional salon shampoo',
            UPC: '123456789012',
            'OTC Price': '850',
            'Salon Use Price': '650',
            'Unit Cost': '450',
            'Commission Percentage': '15',
            Status: 'Active',
            Variants: '500ml',
            'Shelf Life': '24 months',
            Suppliers: 'Supplier1; Supplier2'
          }
        ]}
        validationRules={{
          Name: { required: true },
          Brand: { required: true },
          Category: { required: true },
          'OTC Price': { type: 'number' },
          'Salon Use Price': { type: 'number' },
          'Unit Cost': { type: 'number' }
        }}
        title="Import Products"
      />
    </div>
  );
};

export default Products;

