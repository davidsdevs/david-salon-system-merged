// src/pages/06_InventoryController/UpcGenerator.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import InventoryLayout from '../../layouts/InventoryLayout';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';
import html2canvas from 'html2canvas';
import { productService } from '../../services/productService';
import { inventoryService } from '../../services/inventoryService';
import {
  QrCode,
  Search,
  Filter,
  Eye,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Calendar,
  Building,
  Copy,
  Printer,
  Download,
  Home,
  TrendingUp,
  ArrowRightLeft,
  ShoppingCart,
  Truck,
  BarChart3,
  Banknote,
  ClipboardList,
  UserCog,
  PackageCheck,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';

const UpcGenerator = () => {
  const { userData, userBranch } = useAuth();
  const printRef = useRef();

  
  
  // Data states
  const [products, setProducts] = useState([]);
  const [generatedQRCodes, setGeneratedQRCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedBatches, setSelectedBatches] = useState([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [qrCodesToPrint, setQrCodesToPrint] = useState([]);
  const [currentBatches, setCurrentBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isMassPrintModalOpen, setIsMassPrintModalOpen] = useState(false);
  const [selectedBatchesForPrint, setSelectedBatchesForPrint] = useState([]);
  
  // Filter states
  const [filters, setFilters] = useState({
    category: 'all',
    status: 'all',
    hasQRCode: 'all',
    brand: 'all',
    hasBatches: 'all'
  });

  // Generate form states
  const [generateForm, setGenerateForm] = useState({
    productId: '',
    branchId: '',
    batchId: '',
    quantity: 1,
    size: 'medium'
  });

  // Print handler
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'QR Code Stickers'
  });

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load products
      const productsResult = await productService.getAllProducts();
      if (productsResult.success) {
        setProducts(productsResult.products || []);
      } else {
        throw new Error(productsResult.message || 'Failed to load products');
      }

      // Auto-set branch to user's branch (no need to load branches for selection)
      if (userBranch) {
        setGenerateForm(prev => ({ ...prev, branchId: userBranch }));
      }
      
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message || 'An error occurred while loading data');
    } finally {
      setLoading(false);
    }
  };

  // Load batches for a product in a branch
  // Get batches from 'stocks' collection where stockType === 'batch' OR has batchId/batchNumber
  // Show ALL batches so user can choose which one to print stickers for
  const loadBatches = async (productId, branchId) => {
    try {
      // Query stocks collection for batch-type stocks
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../config/firebase');
      
      const stocksRef = collection(db, 'stocks');
      
      // Query for stocks with this productId and branchId
      // Filter client-side for batch-related documents (stockType === 'batch' OR has batchId/batchNumber)
      const q = query(
        stocksRef,
        where('branchId', '==', branchId),
        where('productId', '==', productId)
      );
      
      const snapshot = await getDocs(q);
      const batches = [];
      
      console.log(`🔍 Loading batches for product ${productId} in branch ${branchId}`);
      console.log(`📦 Found ${snapshot.size} stock documents`);
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Check if this is a batch-type stock
        // A batch has: stockType === 'batch' OR has batchId OR has batchNumber
        const isBatch = data.stockType === 'batch' || 
                       data.batchId || 
                       (data.batchNumber && data.batchNumber.trim() !== '');
        
        if (isBatch) {
          console.log(`✅ Found batch: ${data.batchNumber || data.batchId}`, {
            id: doc.id,
            batchId: data.batchId,
            batchNumber: data.batchNumber,
            stockType: data.stockType,
            realTimeStock: data.realTimeStock,
            status: data.status
          });
          
          // Map stocks collection structure to batch format
          batches.push({
            id: doc.id,
            batchId: data.batchId || doc.id,
            batchNumber: data.batchNumber || `BATCH-${doc.id.slice(0, 8)}`,
            productId: data.productId,
            productName: data.productName || '',
            branchId: data.branchId,
            expirationDate: data.expirationDate?.toDate ? data.expirationDate.toDate() : 
                           data.expirationDate instanceof Date ? data.expirationDate :
                           data.expirationDate ? new Date(data.expirationDate) : null,
            remainingQuantity: data.realTimeStock || data.endStock || 0,
            quantity: data.beginningStock || data.realTimeStock || 0,
            unitCost: data.unitCost || 0,
            status: data.status || 'active',
            purchaseOrderId: data.purchaseOrderId || '',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : 
                      data.createdAt instanceof Date ? data.createdAt :
                      data.createdAt ? new Date(data.createdAt) : new Date(),
          });
        } else {
          console.log(`⏭️ Skipping non-batch stock:`, {
            id: doc.id,
            stockType: data.stockType,
            hasBatchId: !!data.batchId,
            hasBatchNumber: !!data.batchNumber
          });
        }
      });
      
      console.log(`📋 Total batches found: ${batches.length}`);
      
      // Sort by expiration date (oldest first) and then by batch number
      return batches.sort((a, b) => {
        // First sort by expiration date
        const dateA = a.expirationDate ? new Date(a.expirationDate).getTime() : Infinity;
        const dateB = b.expirationDate ? new Date(b.expirationDate).getTime() : Infinity;
        if (dateA !== dateB) return dateA - dateB;
        // Then by batch number
        return (a.batchNumber || '').localeCompare(b.batchNumber || '');
      });
    } catch (error) {
      console.error('Error loading batches from stocks collection:', error);
      // Fallback to product_batches if stocks query fails
      try {
        console.log('🔄 Falling back to product_batches collection...');
        const batchesResult = await inventoryService.getProductBatches(branchId, productId);
        if (batchesResult.success) {
          console.log(`✅ Found ${batchesResult.batches.length} batches from product_batches`);
          return batchesResult.batches.sort((a, b) => {
            const dateA = a.expirationDate ? new Date(a.expirationDate).getTime() : Infinity;
            const dateB = b.expirationDate ? new Date(b.expirationDate).getTime() : Infinity;
            if (dateA !== dateB) return dateA - dateB;
            return (a.batchNumber || '').localeCompare(b.batchNumber || '');
          });
        }
      } catch (fallbackError) {
        console.error('Fallback to product_batches also failed:', fallbackError);
      }
      return [];
    }
  };

  // Load current batches/products
  const loadCurrentBatches = async () => {
    if (!userBranch) return;
    
    try {
      setLoadingBatches(true);
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../config/firebase');
      
      const stocksRef = collection(db, 'stocks');
      const q = query(
        stocksRef,
        where('branchId', '==', userBranch),
        where('stockType', '==', 'batch')
      );
      
      const snapshot = await getDocs(q);
      const batches = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.batchNumber && (data.realTimeStock || 0) > 0) {
          batches.push({
            id: doc.id,
            batchNumber: data.batchNumber,
            productId: data.productId,
            productName: data.productName || 'Unknown',
            expirationDate: data.expirationDate?.toDate ? data.expirationDate.toDate() : 
                           data.expirationDate instanceof Date ? data.expirationDate :
                           data.expirationDate ? new Date(data.expirationDate) : null,
            remainingQuantity: data.realTimeStock || 0,
            status: data.status || 'active'
          });
        }
      });
      
      // Sort by expiration date
      batches.sort((a, b) => {
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        return new Date(a.expirationDate) - new Date(b.expirationDate);
      });
      
      setCurrentBatches(batches);
    } catch (error) {
      console.error('Error loading current batches:', error);
      setCurrentBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadData();
    loadCurrentBatches();
  }, [userBranch]);

  // Auto-set branch to user's branch
  useEffect(() => {
    if (userBranch && !generateForm.branchId) {
      setGenerateForm(prev => ({ ...prev, branchId: userBranch }));
    }
  }, [userBranch]);

  // Load batches when branch or product changes in generate form
  useEffect(() => {
    if (generateForm.productId && generateForm.branchId) {
      loadBatches(generateForm.productId, generateForm.branchId).then(batches => {
        setSelectedBatches(batches);
        if (batches.length > 0 && !generateForm.batchId) {
          setGenerateForm(prev => ({ ...prev, batchId: batches[0].id }));
        } else if (batches.length === 0) {
          setGenerateForm(prev => ({ ...prev, batchId: '' }));
        }
      }).catch(error => {
        console.error('Error loading batches:', error);
        setSelectedBatches([]);
      });
    } else {
      setSelectedBatches([]);
    }
  }, [generateForm.productId, generateForm.branchId]);

  // Get unique categories and brands
  const categories = [...new Set(products.map(p => p.category))].filter(Boolean);
  const brands = [...new Set(products.map(p => p.brand))].filter(Boolean);

  // Filter and sort products
  const filteredProducts = products
    .filter(product => {
      // Safe search - handle undefined/null values
      const searchLower = (searchTerm || '').toLowerCase();
      const productName = (product.name || '').toLowerCase();
      const productBrand = (product.brand || '').toLowerCase();
      const productUPC = (product.upc || '').toLowerCase();
      
      const matchesSearch = !searchTerm || 
                           productName.includes(searchLower) ||
                           productBrand.includes(searchLower) ||
                           productUPC.includes(searchLower);
      
      const matchesCategory = filters.category === 'all' || (product.category || '') === filters.category;
      const matchesStatus = filters.status === 'all' || (product.status || '') === filters.status;
      const matchesBrand = filters.brand === 'all' || (product.brand || '') === filters.brand;
      
      // Check if product has batches (for hasBatches filter)
      let matchesHasBatches = true;
      if (filters.hasBatches === 'yes') {
        const hasBatches = currentBatches.some(b => b.productId === product.id);
        matchesHasBatches = hasBatches;
      } else if (filters.hasBatches === 'no') {
        const hasBatches = currentBatches.some(b => b.productId === product.id);
        matchesHasBatches = !hasBatches;
      }
      
      return matchesSearch && matchesCategory && matchesStatus && matchesBrand && matchesHasBatches;
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

  // Handle product details
  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    setIsDetailsModalOpen(true);
  };

  // Handle generate QR code - open batch selection modal
  const handleGenerateQRCode = async (product) => {
    setSelectedProduct(product);
    setSelectedBatches([]);
    setGenerateForm({
      productId: product.id,
      branchId: userBranch || '',
      batchId: '',
      quantity: 1,
      size: 'medium'
    });
    setIsGenerateModalOpen(true);
  };

  // Handle batch selection and QR code generation
  const handleGenerateFromBatch = async (batch) => {
    try {
      setLoading(true);
      setError(null);

      if (!batch || !batch.batchNumber) {
        setError('Invalid batch selected');
        return;
      }

      // Use batch data from stocks collection
      const qrCodeString = JSON.stringify({
        productId: batch.productId,
        productName: batch.productName || selectedProduct?.name,
        price: selectedProduct?.otcPrice || 0,
        batchNumber: batch.batchNumber,
        batchId: batch.batchId || batch.id,
        expirationDate: batch.expirationDate ? new Date(batch.expirationDate).toISOString() : null,
        branchId: batch.branchId,
        timestamp: Date.now()
      });

      // Create QR code data (in-memory only, no database)
      const qrCode = {
        id: `qr-${Date.now()}`,
        qrCodeString: qrCodeString,
        batchNumber: batch.batchNumber,
        productName: batch.productName,
        productId: batch.productId,
        price: selectedProduct?.otcPrice || 0,
        expirationDate: batch.expirationDate ? new Date(batch.expirationDate) : null,
        branchId: batch.branchId,
        createdAt: new Date()
      };

      setGeneratedQRCodes(prev => [...prev, qrCode]);
      setQrCodesToPrint([qrCode]);
      setIsGenerateModalOpen(false);
      setIsPrintModalOpen(true);
      setError(null);
    } catch (err) {
      console.error('Error generating QR code:', err);
      setError(err.message || 'An error occurred while generating QR code');
    } finally {
      setLoading(false);
    }
  };

  // Save QR code sticker as PNG
  const handleSaveAsPNG = async (qrCode, index) => {
    try {
      const stickerElement = document.getElementById(`sticker-${index}`);
      if (!stickerElement) {
        setError('Sticker element not found');
        return;
      }

      // Use html2canvas to convert the sticker element to PNG
      const canvas = await html2canvas(stickerElement, {
        backgroundColor: '#ffffff',
        scale: 3, // Higher quality for better text rendering
        logging: false,
        useCORS: true,
        allowTaint: true,
        width: stickerElement.offsetWidth,
        height: stickerElement.offsetHeight,
        windowWidth: stickerElement.scrollWidth,
        windowHeight: stickerElement.scrollHeight
      });

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          setError('Failed to create PNG');
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${qrCode.productName.replace(/[^a-z0-9]/gi, '_')}_QR_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png', 1.0);
    } catch (err) {
      console.error('Error saving as PNG:', err);
      setError('Failed to save as PNG: ' + err.message);
    }
  };

  // Handle form submission - generate QR codes from selected batch
  const handleGenerateSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      
      if (!generateForm.productId || !generateForm.branchId || !generateForm.batchId) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      const batch = selectedBatches.find(b => b.id === generateForm.batchId);
      if (!batch) {
        setError('Please select a valid batch');
        setLoading(false);
        return;
      }

      if (!batch.batchNumber) {
        setError('Selected batch does not have a batch number');
        setLoading(false);
        return;
      }

      // Generate QR codes directly from batch data (no database storage - cache-based)
      const qrCodes = [];
      for (let i = 0; i < generateForm.quantity; i++) {
        // Use batch data from stocks collection
        const qrCodeString = JSON.stringify({
          productId: batch.productId,
          productName: batch.productName || selectedProduct?.name,
          price: selectedProduct?.otcPrice || 0,
          batchNumber: batch.batchNumber,
          batchId: batch.batchId || batch.id,
          expirationDate: batch.expirationDate ? new Date(batch.expirationDate).toISOString() : null,
          branchId: batch.branchId,
          timestamp: Date.now()
        });

        // Create QR code data (in-memory only, no database)
        const qrCode = {
          id: `qr-${Date.now()}-${i}`,
          qrCodeString: qrCodeString,
          batchNumber: batch.batchNumber, // From product_batches
          productName: batch.productName || selectedProduct?.name,
          productId: batch.productId,
          price: selectedProduct?.otcPrice || 0,
          expirationDate: batch.expirationDate ? new Date(batch.expirationDate) : null,
          branchId: batch.branchId,
          createdAt: new Date()
        };

        qrCodes.push(qrCode);
      }

      if (qrCodes.length > 0) {
        setGeneratedQRCodes(prev => [...prev, ...qrCodes]);
        setQrCodesToPrint(qrCodes);
        setIsGenerateModalOpen(false);
        setIsPrintModalOpen(true);
        setError(null);
      } else {
        setError('No QR codes were generated. Please try again.');
      }
      
    } catch (err) {
      console.error('Error generating QR codes:', err);
      setError(err.message || 'An error occurred while generating QR codes');
    } finally {
      setLoading(false);
    }
  };

  // Copy QR code string to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
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
      case 'Discontinued': return <Clock className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Calculate statistics
  const stats = {
    totalProducts: products.length,
    productsWithQRCode: generatedQRCodes.length > 0 ? new Set(generatedQRCodes.map(q => q.productId)).size : 0,
    totalGenerated: generatedQRCodes.length,
    recentGenerated: generatedQRCodes.filter(g => 
      new Date(g.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length
  };

  if (loading && products.length === 0) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading products...</span>
        </div>
      </>
    );
  }

  if (error && products.length === 0) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Products</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadData} className="flex items-center gap-2">
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
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">QR Code Generator</h1>
            <p className="text-sm md:text-base text-gray-600">Generate QR code stickers for product batches with expiration dates</p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">With QR Code</p>
                <p className="text-xl font-bold text-gray-900">{stats.productsWithQRCode}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <QrCode className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Generated</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalGenerated}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-xl font-bold text-gray-900">{stats.recentGenerated}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                <p className="font-medium">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setError(null)}>
                Dismiss
              </Button>
            </div>
          </Card>
        )}

        {/* Search and Filters */}
        <Card className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                placeholder="Search by product name, brand..."
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
                onClick={() => {
                  setFilters({
                    category: 'all',
                    status: 'all',
                    hasQRCode: 'all',
                    brand: 'all',
                    hasBatches: 'all'
                  });
                  setSearchTerm('');
                }}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </Card>

        {/* Products Table */}
        {filteredProducts.length > 0 ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Brand
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
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
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 h-12 w-12">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="h-12 w-12 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                <Package className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                            {product.upc && (
                              <div className="text-xs text-gray-500 font-mono mt-1">{product.upc}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{product.brand || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{product.category || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ₱{product.otcPrice?.toFixed(2) || '0.00'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
                          {getStatusIcon(product.status)}
                          {product.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(product)}
                            className="flex items-center gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleGenerateQRCode(product)}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <QrCode className="h-4 w-4" />
                            Generate Sticker
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="p-12 text-center">
            <QrCode className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Products Found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || Object.values(filters).some(f => f !== 'all')
                ? 'Try adjusting your search or filters'
                : 'No products available for QR code generation'
              }
            </p>
          </Card>
        )}

        {/* Current Batches/Products Display */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Current Batches/Products</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={loadCurrentBatches}
              disabled={loadingBatches}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loadingBatches ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          
          {loadingBatches ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading batches...</span>
            </div>
          ) : currentBatches.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">No active batches found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiration</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentBatches.map((batch) => {
                    const product = products.find(p => p.id === batch.productId);
                    const isExpired = batch.expirationDate && new Date(batch.expirationDate) < new Date();
                    const isExpiringSoon = batch.expirationDate && 
                      new Date(batch.expirationDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
                      new Date(batch.expirationDate) > new Date();
                    
                    return (
                      <tr key={batch.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{batch.productName}</div>
                          {product && (
                            <div className="text-xs text-gray-500">{product.brand || ''}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-900 font-mono">{batch.batchNumber}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-900">{batch.remainingQuantity} units</span>
                        </td>
                        <td className="px-4 py-3">
                          {batch.expirationDate ? (
                            <span className={`text-sm ${isExpired ? 'text-red-600 font-semibold' : isExpiringSoon ? 'text-orange-600 font-semibold' : 'text-gray-900'}`}>
                              {format(new Date(batch.expirationDate), 'MMM dd, yyyy')}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">No expiration</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            size="sm"
                            onClick={() => {
                              if (product) {
                                handleGenerateQRCode(product);
                                // Auto-select this batch
                                setTimeout(() => {
                                  setGenerateForm(prev => ({ ...prev, batchId: batch.id }));
                                }, 100);
                              }
                            }}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <QrCode className="h-4 w-4" />
                            Generate
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

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
                  <p className="text-sm text-gray-500">{selectedProduct.category}</p>
                </div>
              </div>

              {/* Product Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">Product ID</label>
                  <p className="text-gray-900">{selectedProduct.id}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Brand</label>
                  <p className="text-gray-900">{selectedProduct.brand}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Category</label>
                  <p className="text-gray-900">{selectedProduct.category}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <p className="text-gray-900">{selectedProduct.status}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Price</label>
                  <p className="text-gray-900">₱{selectedProduct.otcPrice?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Generate QR Code Modal */}
        {isGenerateModalOpen && selectedProduct && (
          <Modal
            isOpen={isGenerateModalOpen}
            onClose={() => {
              setIsGenerateModalOpen(false);
              setSelectedProduct(null);
              setSelectedBatches([]);
            }}
            title="Generate QR Code Sticker"
            size="md"
          >
            <form onSubmit={handleGenerateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product</label>
                <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedProduct.name}</p>
              </div>
              

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batch * 
                  {selectedBatches.length > 1 && (
                    <span className="ml-2 text-xs text-blue-600 font-normal">
                      ({selectedBatches.length} batches available - select one)
                    </span>
                  )}
                </label>
                {selectedBatches.length === 0 ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    No batches available for this product in the selected branch
                  </div>
                ) : selectedBatches.length === 1 ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-900">
                        {selectedBatches[0].batchNumber}
                        {selectedBatches[0].expirationDate && (
                          <span className="text-gray-600 ml-2">
                            - Exp: {format(new Date(selectedBatches[0].expirationDate), 'MMM dd, yyyy')}
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-gray-600">
                        Qty: {selectedBatches[0].remainingQuantity || 0}
                      </span>
                    </div>
                  </div>
                ) : (
                  <select
                    value={generateForm.batchId}
                    onChange={(e) => setGenerateForm(prev => ({ ...prev, batchId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a batch to print sticker for...</option>
                    {selectedBatches.map(batch => {
                      const isActive = batch.status === 'active' && (batch.remainingQuantity || 0) > 0;
                      const expirationDate = batch.expirationDate ? new Date(batch.expirationDate) : null;
                      const isExpired = expirationDate && expirationDate < new Date();
                      
                      return (
                        <option key={batch.id} value={batch.id}>
                          {batch.batchNumber} 
                          {expirationDate && ` - Exp: ${format(expirationDate, 'MMM dd, yyyy')}`}
                          {` - Qty: ${batch.remainingQuantity || 0}`}
                          {!isActive && ' (Inactive)'}
                          {isExpired && ' (Expired)'}
                        </option>
                      );
                    })}
                  </select>
                )}
                {selectedBatches.length > 1 && generateForm.batchId && (
                  <p className="mt-1 text-xs text-gray-500">
                    Selected batch: {selectedBatches.find(b => b.id === generateForm.batchId)?.batchNumber}
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={generateForm.quantity}
                    onChange={(e) => setGenerateForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Size</label>
                  <select
                    value={generateForm.size}
                    onChange={(e) => setGenerateForm(prev => ({ ...prev, size: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsGenerateModalOpen(false);
                    setSelectedProduct(null);
                    setSelectedBatches([]);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Generating...' : 'Generate QR Code'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Print QR Code Stickers Modal */}
        {isPrintModalOpen && qrCodesToPrint.length > 0 && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
              {/* Backdrop */}
              <div 
                className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
                onClick={() => {
                  setIsPrintModalOpen(false);
                  setQrCodesToPrint([]);
                }}
              />
              
              {/* Modal */}
              <div className="relative w-full max-w-6xl transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all">
                {/* Enhanced Header */}
                <div className="bg-gradient-to-r from-[#160B53] to-[#2D1B69] px-6 py-5 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <QrCode className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">QR Code Stickers</h3>
                        <p className="text-sm text-blue-100 mt-0.5">
                          {qrCodesToPrint.length} sticker{qrCodesToPrint.length > 1 ? 's' : ''} ready to print
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsPrintModalOpen(false);
                          setQrCodesToPrint([]);
                        }}
                        className="text-white border-white/30 hover:bg-white/20"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Action Bar */}
                  <div className="mb-6 flex items-center justify-between bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-gray-600" />
                        <span className="text-sm text-gray-700">
                          <span className="font-semibold">{qrCodesToPrint.length}</span> sticker{qrCodesToPrint.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      {qrCodesToPrint[0]?.productName && (
                        <>
                          <div className="h-4 w-px bg-gray-300" />
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Product:</span>
                            <span className="text-sm font-semibold text-gray-900">{qrCodesToPrint[0].productName}</span>
                          </div>
                        </>
                      )}
                    </div>
                    <Button 
                      onClick={handlePrint} 
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                      size="lg"
                    >
                      <Printer className="h-5 w-5" />
                      Print Stickers
                    </Button>
                  </div>

                  {/* Preview Info */}
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Preview your stickers below. Click "Print Stickers" when ready.
                    </p>
                  </div>

                  {/* Printable QR Code Stickers */}
                  <div ref={printRef} className="print-content">
                    {/* Grid layout optimized for cutting - 3x3 or 4x4 depending on quantity */}
                    <div className={`grid gap-2 p-4 bg-gray-50 rounded-lg ${
                      qrCodesToPrint.length <= 4 ? 'grid-cols-2' : 
                      qrCodesToPrint.length <= 9 ? 'grid-cols-3' : 
                      qrCodesToPrint.length <= 16 ? 'grid-cols-4' : 'grid-cols-5'
                    }`}
                    style={{
                      gridTemplateColumns: `repeat(${
                        qrCodesToPrint.length <= 4 ? 2 : 
                        qrCodesToPrint.length <= 9 ? 3 : 
                        qrCodesToPrint.length <= 16 ? 4 : 5
                      }, 1fr)`
                    }}>
                      {qrCodesToPrint.map((qrCode, index) => (
                        <div
                          key={index}
                          id={`sticker-${index}`}
                          className="bg-white border-2 border-dashed border-gray-400 p-3 rounded-lg flex flex-col items-center justify-center space-y-2 shadow-sm"
                          style={{ 
                            minHeight: '200px', 
                            maxHeight: '200px',
                            pageBreakInside: 'avoid',
                            position: 'relative'
                          }}
                        >
                          {/* Cutting guide lines */}
                          <div className="absolute inset-0 pointer-events-none" style={{
                            border: '1px dashed #ccc',
                            borderRadius: '4px'
                          }}></div>
                          {/* Logo */}
                          <div className="mb-2">
                            <img
                              src="/logo.jpg"
                              alt="David's Salon Logo"
                              className="h-12 object-contain"
                              onError={(e) => {
                                // Fallback: try .png if .jpg fails
                                if (e.target.src !== '/logo.png') {
                                  e.target.src = '/logo.png';
                                } else {
                                  // If both fail, hide the image and show text
                                  e.target.style.display = 'none';
                                  const parent = e.target.parentElement;
                                  if (parent && !parent.querySelector('.logo-fallback')) {
                                    const fallback = document.createElement('div');
                                    fallback.className = 'logo-fallback text-xs font-bold text-gray-700';
                                    fallback.textContent = "David's Salon";
                                    parent.appendChild(fallback);
                                  }
                                }
                              }}
                            />
                          </div>

                          {/* QR Code */}
                          <div className="bg-white p-2 rounded-lg border border-gray-200">
                            {qrCode.qrCodeString ? (
                              <QRCodeSVG
                                id={`qr-svg-${index}`}
                                value={qrCode.qrCodeString}
                                size={140}
                                level="H"
                                includeMargin={true}
                              />
                            ) : (
                              <div className="w-[140px] h-[140px] bg-gray-100 flex items-center justify-center rounded">
                                <QrCode className="h-16 w-16 text-gray-400" />
                              </div>
                            )}
                          </div>
                          
                          {/* Product Info */}
                          <div className="text-center w-full space-y-1.5 px-2">
                            <p className="text-xs font-bold text-gray-900 leading-tight break-words" 
                               style={{ 
                                 wordBreak: 'break-word',
                                 overflowWrap: 'break-word',
                                 maxHeight: '2.5em',
                                 display: '-webkit-box',
                                 WebkitLineClamp: 2,
                                 WebkitBoxOrient: 'vertical',
                                 overflow: 'hidden'
                               }}>
                              {qrCode.productName || 'Product Name'}
                            </p>
                            
                            {qrCode.batchNumber && qrCode.batchNumber !== 'N/A' && (
                              <div className="flex items-center justify-center gap-1">
                                <Package className="h-3 w-3 text-gray-500" />
                                <p className="text-xs text-gray-600">Batch: {qrCode.batchNumber}</p>
                              </div>
                            )}
                            
                            {qrCode.expirationDate ? (
                              <div className="flex items-center justify-center gap-1 bg-red-50 px-2 py-1 rounded">
                                <Calendar className="h-3 w-3 text-red-600" />
                                <p className="text-xs text-red-700 font-semibold">
                                  Exp: {format(new Date(qrCode.expirationDate), 'MMM dd, yyyy')}
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400 italic">No expiration date</p>
                            )}
                            
                            <div className="pt-1 border-t border-gray-200">
                              <p className="text-base font-bold text-blue-600">
                                ₱{qrCode.price?.toFixed(2) || '0.00'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Stickers are optimized for standard label printers (2x2 inches)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsPrintModalOpen(false);
                          setQrCodesToPrint([]);
                        }}
                      >
                        Close
                      </Button>
                      {qrCodesToPrint.length > 0 && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => handleSaveAsPNG(qrCodesToPrint[0], 0)}
                            className="flex items-center gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Save as PNG
                          </Button>
                          {qrCodesToPrint.length > 1 && (
                            <Button
                              variant="outline"
                              onClick={async () => {
                                for (let i = 0; i < qrCodesToPrint.length; i++) {
                                  await handleSaveAsPNG(qrCodesToPrint[i], i);
                                  // Small delay between downloads
                                  await new Promise(resolve => setTimeout(resolve, 500));
                                }
                              }}
                              className="flex items-center gap-2"
                            >
                              <Download className="h-4 w-4" />
                              Save All as PNG
                            </Button>
                          )}
                        </>
                      )}
                      <Button 
                        onClick={handlePrint} 
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                      >
                        <Printer className="h-4 w-4" />
                        Print Stickers
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Print Styles */}
                <style>{`
                  @media print {
                    body * {
                      visibility: hidden;
                    }
                    .print-content, .print-content * {
                      visibility: visible;
                    }
                    .print-content {
                      position: absolute;
                      left: 0;
                      top: 0;
                      width: 100%;
                      background: white;
                    }
                    .print-content .bg-gray-50 {
                      background: white !important;
                    }
                    @page {
                      margin: 0.5cm;
                      size: A4;
                    }
                    .print-content .grid {
                      gap: 0.3cm !important;
                    }
                    .print-content [id^="sticker-"] {
                      border: 2px dashed #999 !important;
                      margin: 0.1cm;
                    }
                  }
                `}</style>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Filters Modal */}
        {isFilterModalOpen && (
          <Modal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            title="Advanced Filters"
            size="md"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
                <select
                  value={filters.brand}
                  onChange={(e) => setFilters(prev => ({ ...prev, brand: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Brands</option>
                  {brands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Discontinued">Discontinued</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Has Batches</label>
                <select
                  value={filters.hasBatches}
                  onChange={(e) => setFilters(prev => ({ ...prev, hasBatches: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Products</option>
                  <option value="yes">Has Batches</option>
                  <option value="no">No Batches</option>
                </select>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters({
                      category: 'all',
                      status: 'all',
                      hasQRCode: 'all',
                      brand: 'all',
                      hasBatches: 'all'
                    });
                  }}
                >
                  Reset
                </Button>
                <Button onClick={() => setIsFilterModalOpen(false)}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Report Modal */}
        {isReportModalOpen && (
          <Modal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            title="QR Code Generator Report"
            size="lg"
          >
            <div className="space-y-4">
              <div className="flex justify-end gap-2 mb-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    const reportContent = `
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <title>QR Code Generator Report</title>
                          <style>
                            body { font-family: Arial, sans-serif; padding: 20px; }
                            h1 { color: #160B53; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                            th { background-color: #f2f2f2; }
                            .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 20px; }
                            .stat-card { background: #f9fafb; padding: 15px; border-radius: 8px; }
                          </style>
                        </head>
                        <body>
                          <h1>QR Code Generator Report</h1>
                          <p>Generated: ${new Date().toLocaleString()}</p>
                          <div class="stats">
                            <div class="stat-card">
                              <h3>Total Products</h3>
                              <p>${stats.totalProducts}</p>
                            </div>
                            <div class="stat-card">
                              <h3>With QR Code</h3>
                              <p>${stats.productsWithQRCode}</p>
                            </div>
                            <div class="stat-card">
                              <h3>Total Generated</h3>
                              <p>${stats.totalGenerated}</p>
                            </div>
                            <div class="stat-card">
                              <h3>This Week</h3>
                              <p>${stats.recentGenerated}</p>
                            </div>
                          </div>
                          <h2>Current Batches (${currentBatches.length})</h2>
                          <table>
                            <thead>
                              <tr>
                                <th>Product</th>
                                <th>Batch Number</th>
                                <th>Quantity</th>
                                <th>Expiration Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${currentBatches.map(batch => `
                                <tr>
                                  <td>${batch.productName}</td>
                                  <td>${batch.batchNumber}</td>
                                  <td>${batch.remainingQuantity}</td>
                                  <td>${batch.expirationDate ? format(new Date(batch.expirationDate), 'MMM dd, yyyy') : 'N/A'}</td>
                                </tr>
                              `).join('')}
                            </tbody>
                          </table>
                        </body>
                      </html>
                    `;
                    printWindow.document.write(reportContent);
                    printWindow.document.close();
                    printWindow.print();
                  }}
                  className="flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print Report
                </Button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="text-sm text-gray-600">Total Products</div>
                  <div className="text-2xl font-bold text-gray-900">{stats.totalProducts}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-gray-600">With QR Code</div>
                  <div className="text-2xl font-bold text-gray-900">{stats.productsWithQRCode}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-gray-600">Total Generated</div>
                  <div className="text-2xl font-bold text-gray-900">{stats.totalGenerated}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-gray-600">This Week</div>
                  <div className="text-2xl font-bold text-gray-900">{stats.recentGenerated}</div>
                </Card>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Current Batches ({currentBatches.length})</h3>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Product</th>
                        <th className="px-4 py-2 text-left">Batch</th>
                        <th className="px-4 py-2 text-left">Quantity</th>
                        <th className="px-4 py-2 text-left">Expiration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {currentBatches.map(batch => (
                        <tr key={batch.id}>
                          <td className="px-4 py-2">{batch.productName}</td>
                          <td className="px-4 py-2 font-mono">{batch.batchNumber}</td>
                          <td className="px-4 py-2">{batch.remainingQuantity}</td>
                          <td className="px-4 py-2">
                            {batch.expirationDate ? format(new Date(batch.expirationDate), 'MMM dd, yyyy') : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Mass Print Modal with Cutting Layout */}
        {isMassPrintModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => setIsMassPrintModalOpen(false)} />
              
              <div className="relative w-full max-w-6xl transform overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="bg-gradient-to-r from-[#160B53] to-[#2D1B69] px-6 py-5 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold">Mass Print - Cutting Layout</h3>
                      <p className="text-sm text-blue-100 mt-0.5">Select batches to print in grid layout</p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setIsMassPrintModalOpen(false)}
                      className="text-white border-white/30 hover:bg-white/20"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Select Batches to Print</h4>
                    <div className="max-h-64 overflow-y-auto border rounded-lg p-2">
                      {currentBatches.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No batches available</p>
                      ) : (
                        <div className="space-y-2">
                          {currentBatches.map(batch => {
                            const product = products.find(p => p.id === batch.productId);
                            const isSelected = selectedBatchesForPrint.some(b => 
                              b.productId === batch.productId && b.batchNumber === batch.batchNumber
                            );
                            
                            return (
                              <label key={batch.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      const qrCode = {
                                        id: `qr-${batch.id}-${Date.now()}`,
                                        qrCodeString: JSON.stringify({
                                          productId: batch.productId,
                                          productName: batch.productName,
                                          price: product?.otcPrice || 0,
                                          batchNumber: batch.batchNumber,
                                          batchId: batch.id,
                                          expirationDate: batch.expirationDate ? new Date(batch.expirationDate).toISOString() : null,
                                          branchId: userBranch,
                                          timestamp: Date.now()
                                        }),
                                        batchNumber: batch.batchNumber,
                                        productName: batch.productName,
                                        productId: batch.productId,
                                        price: product?.otcPrice || 0,
                                        expirationDate: batch.expirationDate ? new Date(batch.expirationDate) : null,
                                        branchId: userBranch,
                                        createdAt: new Date()
                                      };
                                      setSelectedBatchesForPrint(prev => [...prev, qrCode]);
                                    } else {
                                      setSelectedBatchesForPrint(prev => prev.filter(b => 
                                        !(b.productId === batch.productId && b.batchNumber === batch.batchNumber)
                                      ));
                                    }
                                  }}
                                  className="rounded"
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">{batch.productName}</div>
                                  <div className="text-xs text-gray-500">Batch: {batch.batchNumber} | Qty: {batch.remainingQuantity}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {selectedBatchesForPrint.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-700">
                          {selectedBatchesForPrint.length} batch(es) selected
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setSelectedBatchesForPrint([])}
                          >
                            Clear All
                          </Button>
                          <Button
                            onClick={() => {
                              setQrCodesToPrint(selectedBatchesForPrint);
                              setIsMassPrintModalOpen(false);
                              setIsPrintModalOpen(true);
                            }}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                          >
                            <Printer className="h-4 w-4" />
                            Print Selected ({selectedBatchesForPrint.length})
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default UpcGenerator;
