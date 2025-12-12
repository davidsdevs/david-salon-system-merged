// src/pages/04_BranchManager/Inventory.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';


import { inventoryService } from '../../services/inventoryService';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  Package,
  Search,
  Eye,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Banknote,
  BarChart3,
  CheckCircle,
  RefreshCw,
  Download,
  X,
  ShoppingCart,
  Plus,
  Clock,
  Building,
  FileText,
  ArrowRight,
  ArrowUpDown,
  Minus,
  Trash2,
  Loader2,
  XCircle,
  Truck,
  Activity,
  Zap,
  Target,
  PieChart,
  LineChart,
  TrendingUp as TrendingUpIcon,
  AlertCircle,
  Info,
  Filter,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { formatDate } from '../../utils/helpers';
import { transactionApiService } from '../../services/transactionApiService';
import { openaiService } from '../../services/openaiService';
import { getAllServices } from '../../services/serviceManagementService';
import { Sparkles, Loader2 as Loader2Icon, Scissors } from 'lucide-react';

// Debounce hook for search
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
    clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const Inventory = () => {
  const { userData } = useAuth();
  
  // Tab state
  const [activeTab, setActiveTab] = useState('products'); // 'products', 'reports', 'purchaseOrders', 'analytics', 'productSales'
  
  // ========== ANALYTICS TAB STATE ==========
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [lowSalesProducts, setLowSalesProducts] = useState([]);
  const [inventoryMovements, setInventoryMovements] = useState([]);
  const [selectedAnalyticsView, setSelectedAnalyticsView] = useState('overview'); // 'overview', 'anomalies', 'lowSales', 'trends'
  const [analyticsDateRange, setAnalyticsDateRange] = useState('30'); // days
  
  // ========== PRODUCTS TAB STATE ==========
  const [products, setProducts] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [services, setServices] = useState([]); // For service-product mapping
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  // Modal states
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // ========== REPORTS TAB STATE ==========
  const [loadingReports, setLoadingReports] = useState(true);
  const [errorReports, setErrorReports] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [inventoryStats, setInventoryStats] = useState(null);
  const [topSellingProducts, setTopSellingProducts] = useState([]);

  // ========== PURCHASE ORDERS TAB STATE ==========
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branchProductsForPO, setBranchProductsForPO] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [loadingPO, setLoadingPO] = useState(true);
  const [errorPO, setErrorPO] = useState(null);

  // ========== PRODUCT SALES TAB STATE ==========
  const [productSales, setProductSales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [salesDateRange, setSalesDateRange] = useState('30'); // days
  const [salesSearchTerm, setSalesSearchTerm] = useState('');
  const [salesSortBy, setSalesSortBy] = useState('revenue'); // 'revenue', 'quantity', 'name'
  const [salesSortOrder, setSalesSortOrder] = useState('desc'); // 'asc', 'desc'
  
  // AI Insights for Product Sales
  const [productSalesInsights, setProductSalesInsights] = useState(null);
  const [loadingProductAI, setLoadingProductAI] = useState(false);
  
  // Purchase Orders UI states
  const [searchTermPO, setSearchTermPO] = useState('');
  const [selectedStatusPO, setSelectedStatusPO] = useState('all');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Big data optimizations for products
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const debouncedProductSearch = useDebounce(productSearchTerm, 300);
  const [currentProductPage, setCurrentProductPage] = useState(1);
  const productsPerPage = 20;
  
  // Form states - Step 1: Select Supplier
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const [showProductSelection, setShowProductSelection] = useState(false);
  
  // Form states - Step 2: Select Products
  const [orderItems, setOrderItems] = useState([]);
  const [orderFormData, setOrderFormData] = useState({
    orderDate: new Date().toISOString().split('T')[0],
    expectedDelivery: '',
    notes: ''
  });

  // ========== LOAD PRODUCTS ==========
  const loadProducts = async () => {
    if (!userData?.branchId) {
    setError('Branch ID not found');
    setLoading(false);
    return;
    }

    try {
    setLoading(true);
    setError(null);

      // Get products available to this branch (where branchId is in branches array)
    const productsRef = collection(db, 'products');
    const productsSnapshot = await getDocs(productsRef);
      
    const branchProducts = [];
    productsSnapshot.forEach((doc) => {
      const productData = doc.data();
        
        // Check if the product is available to this branch
      const isAvailableToBranch = productData.branches && 
        Array.isArray(productData.branches) &&
        productData.branches.includes(userData.branchId);
        
      if (isAvailableToBranch) {
        branchProducts.push({
          id: doc.id,
          name: productData.name || 'Unknown',
          category: productData.category || '',
          brand: productData.brand || '',
          sku: productData.sku || productData.upc || '',
          unitCost: productData.unitCost || 0,
          otcPrice: productData.otcPrice || 0,
          salonUsePrice: productData.salonUsePrice || 0,
          description: productData.description || '',
          imageUrl: productData.imageUrl || '',
          suppliers: productData.suppliers || (productData.supplier ? [productData.supplier] : []), // Suppliers array
          supplier: productData.supplier || '', // Keep for backward compatibility
          status: productData.status || 'Active',
          variants: productData.variants || '',
          shelfLife: productData.shelfLife || '',
          ...productData
        });
      }
    });

      // Fetch stock information from stocks collection (includes batch_stocks)
      // Get all stocks for this branch - both regular stocks and batch_stocks
      // Fetch by branchId only, then filter by status client-side to avoid index requirement
      const stocksRef = collection(db, 'stocks');
      const stocksQuery = query(
        stocksRef,
        where('branchId', '==', userData.branchId)
      );
      const stocksSnapshot = await getDocs(stocksQuery);
      
      // Aggregate stock by product (sum all batch stocks for each product)
      // Filter by status client-side to avoid index requirement
      const stockMap = new Map();
      const productHasBatchStocks = new Set(); // Track which products have batch stocks
      
      // First pass: identify products that have batch stocks
      stocksSnapshot.forEach((doc) => {
        const stockData = doc.data();
        const productId = stockData.productId;
        const status = stockData.status || 'active';
        const stockType = stockData.stockType || 'regular';
        
        if (productId && status === 'active' && stockType === 'batch') {
          productHasBatchStocks.add(productId);
        }
      });
      
      // Second pass: aggregate stocks
      // If product has batch stocks, only count batch stocks
      // If product doesn't have batch stocks, count regular stocks
      const arganStockRecords = []; // Debug array
      const processedDocIds = new Set(); // Track processed documents to detect duplicates
      
      stocksSnapshot.forEach((doc) => {
        // Check for duplicate document processing
        if (processedDocIds.has(doc.id)) {
          console.error('⚠️ DUPLICATE DOCUMENT DETECTED:', doc.id);
          return;
        }
        processedDocIds.add(doc.id);
        const stockData = doc.data();
        const productId = stockData.productId;
        const status = stockData.status || 'active';
        const stockType = stockData.stockType || 'regular';
        
        // Only process active stocks
        if (productId && status === 'active') {
          // If product has batch stocks, only count batch stocks
          // If product doesn't have batch stocks, only count regular stocks
          const shouldCount = productHasBatchStocks.has(productId) 
            ? stockType === 'batch' 
            : stockType !== 'batch';
          
          if (!shouldCount) return;
          
          // IMPORTANT: Use realTimeStock, NOT beginningStock
          // realTimeStock is the current available stock after sales/deductions
          const realTimeStock = typeof stockData.realTimeStock === 'number' 
            ? stockData.realTimeStock 
            : Number(stockData.realTimeStock) || 0;
          const beginningStock = typeof stockData.beginningStock === 'number'
            ? stockData.beginningStock
            : Number(stockData.beginningStock) || 0;
          
          // CRITICAL: Log exactly what we're reading
          if (productId === 'mZorRF53mbG553ZUHDuU') {
            console.log('🔍 Reading stock record:', {
              stockId: doc.id,
              realTimeStock: stockData.realTimeStock,
              realTimeStockType: typeof stockData.realTimeStock,
              realTimeStockConverted: realTimeStock,
              beginningStock: stockData.beginningStock,
              beginningStockConverted: beginningStock,
              willUse: realTimeStock // This is what we're adding to total
            });
          }
          
          // Debug logging for ARGAN product
          if (productId === 'mZorRF53mbG553ZUHDuU') {
            arganStockRecords.push({
              stockId: doc.id,
              batchNumber: stockData.batchNumber || 'N/A',
              stockType,
              realTimeStock,
              beginningStock,
              shouldCount,
              hasBatchStocks: productHasBatchStocks.has(productId),
              rawData: {
                realTimeStock: stockData.realTimeStock,
                beginningStock: stockData.beginningStock,
                status: stockData.status
              }
            });
          }
          
          if (!stockMap.has(productId)) {
            stockMap.set(productId, {
              productId: productId,
              totalStock: 0,
              minStock: stockData.minStock || 0,
              maxStock: stockData.maxStock || 0,
              unitCost: stockData.unitCost || 0,
              location: stockData.location || null,
              expiryDate: stockData.expiryDate || null,
              lastUpdated: stockData.updatedAt || stockData.lastUpdated || null
            });
          }
          
          // Sum ONLY realTimeStock from all batches for this product
          const current = stockMap.get(productId);
          const beforeAdd = current.totalStock;
          current.totalStock += realTimeStock;
          
          // Debug: Log the addition
          if (productId === 'mZorRF53mbG553ZUHDuU') {
            console.log('➕ Adding to total:', {
              before: beforeAdd,
              adding: realTimeStock,
              after: current.totalStock
            });
          }
          
          // Use the most recent minStock, maxStock, unitCost if available
          if (stockData.minStock) current.minStock = stockData.minStock;
          if (stockData.maxStock) current.maxStock = stockData.maxStock;
          if (stockData.unitCost) current.unitCost = stockData.unitCost;
        }
      });
      
      // Debug: Log all ARGAN stock records and final total
      if (arganStockRecords.length > 0) {
        console.group('🔍 ARGAN Stock Aggregation Debug');
        console.log('Stock records found:', arganStockRecords.length);
        arganStockRecords.forEach((record, index) => {
          console.log(`Record ${index + 1}:`, record);
        });
        const finalTotal = stockMap.get('mZorRF53mbG553ZUHDuU')?.totalStock || 0;
        const sumOfRealTime = arganStockRecords.reduce((sum, r) => sum + r.realTimeStock, 0);
        console.log('Sum of realTimeStock values:', sumOfRealTime);
        console.log('Final aggregated totalStock:', finalTotal);
        console.groupEnd();
      }
      
      // Convert to array for backward compatibility
      const aggregatedStocks = Array.from(stockMap.values());
      setStocks(aggregatedStocks);

      // Merge products with aggregated stock data
    const mergedProducts = branchProducts.map(product => {
      const stock = stockMap.get(product.id);
      const totalStock = Number(stock?.totalStock) || 0;
      const minStock = Number(stock?.minStock) || 0;
      
      // Debug for ARGAN
      if (product.id === 'mZorRF53mbG553ZUHDuU') {
        console.log('🔍 Merging ARGAN product:', {
          productId: product.id,
          stockFromMap: stock,
          totalStock: totalStock,
          totalStockType: typeof totalStock,
          willSetCurrentStock: totalStock,
          productBeforeMerge: {
            name: product.name,
            currentStock: product.currentStock,
            unitCost: product.unitCost
          }
        });
      }
      
      // Calculate status based on stock levels
      let status = 'No Stock Data';
      if (stock) {
        if (totalStock > minStock) {
          status = 'In Stock';
        } else if (totalStock > 0) {
          status = 'Low Stock';
        } else {
          status = 'Out of Stock';
        }
      }
      
      // Debug for ARGAN
      if (product.id === 'mZorRF53mbG553ZUHDuU') {
        console.log('📊 Status calculation for ARGAN:', {
          totalStock,
          minStock,
          calculatedStatus: status,
          hasStock: !!stock
        });
      }
        
      // Create merged product - explicitly override any stock fields from product object
      const mergedProduct = {
        ...product,
        // CRITICAL: Override any stock-related fields from product object
        // Only use the aggregated totalStock from stocks collection
        currentStock: totalStock,
        stock: undefined, // Remove any stock field from product object
        stockCount: undefined, // Remove any stockCount field
        minStock: minStock,
        maxStock: stock?.maxStock || 0,
        unitCost: stock?.unitCost || product.unitCost || 0,
        status: String(status), // CRITICAL: Ensure status is always a string
        lastUpdated: stock?.lastUpdated || null,
        location: stock?.location || null,
        expiryDate: stock?.expiryDate || null
      };
      
      // Remove any stock-related fields that might be in the product object
      delete mergedProduct.stock;
      delete mergedProduct.stockCount;
      delete mergedProduct.totalStock;
      
      // CRITICAL: Ensure status is a string, not a number
      if (typeof mergedProduct.status !== 'string') {
        mergedProduct.status = String(mergedProduct.status || 'No Stock Data');
      }
      
      // Debug for ARGAN - verify final merged product
      if (product.id === 'mZorRF53mbG553ZUHDuU') {
        console.log('✅ Final merged ARGAN product:', {
          productId: mergedProduct.id,
          name: mergedProduct.name,
          currentStock: mergedProduct.currentStock,
          currentStockType: typeof mergedProduct.currentStock,
          unitCost: mergedProduct.unitCost,
          status: mergedProduct.status,
          statusType: typeof mergedProduct.status,
          originalProductStatus: product.status,
          originalProductStatusType: typeof product.status
        });
      }
      
      return mergedProduct;
    });

    setProducts(mergedProducts);
    } catch (err) {
    console.error('Error loading products:', err);
    setError(err.message || 'Failed to load products');
    } finally {
    setLoading(false);
    }
  };

  // Load product sales data
  const loadProductSales = async () => {
    if (!userData?.branchId) return;
    
    try {
    setLoadingSales(true);
      
      // Calculate date range
    const days = parseInt(salesDateRange) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
      
      // Load transactions for this branch
    const transactions = await transactionApiService.getBranchTransactions(
      userData.branchId,
      userData.roles?.[0] || 'Branch Manager',
      {
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        status: 'completed'
      }
    );
      
      // Aggregate product sales
    const salesMap = {};
      
    transactions.forEach(transaction => {
      if (transaction.products && Array.isArray(transaction.products)) {
        transaction.products.forEach(product => {
          const productId = product.productId || product.id;
          const productName = product.name || product.productName || 'Unknown Product';
          const quantity = product.quantity || 0;
          const price = product.price || product.unitPrice || 0;
          const revenue = quantity * price;
            
          if (!salesMap[productId]) {
            salesMap[productId] = {
              productId: productId,
              productName: productName,
              totalQuantity: 0,
              totalRevenue: 0,
              transactionCount: 0,
              averagePrice: 0
            };
          }
            
          salesMap[productId].totalQuantity += quantity;
          salesMap[productId].totalRevenue += revenue;
          salesMap[productId].transactionCount += 1;
        });
      }
    });
      
      // Convert to array and calculate averages
    const salesArray = Object.values(salesMap).map(sale => ({
      ...sale,
      averagePrice: sale.totalQuantity > 0 ? sale.totalRevenue / sale.totalQuantity : 0
    }));
      
    setProductSales(salesArray);
    } catch (err) {
    console.error('Error loading product sales:', err);
    setError(err.message || 'Failed to load product sales');
    } finally {
    setLoadingSales(false);
    }
  };

  // Load services for service-product mapping
  const loadServices = async () => {
    try {
      const servicesList = await getAllServices();
      setServices(servicesList);
    } catch (err) {
      console.error('Error loading services:', err);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    if (activeTab === 'products') {
    loadProducts();
    } else if (activeTab === 'purchaseOrders') {
    loadPurchaseOrdersData();
    } else if (activeTab === 'productSales') {
    loadProductSales();
    }
  }, [userData?.branchId, activeTab, salesDateRange]);

  // Load AI insights for product sales when data is available
  useEffect(() => {
    if (activeTab === 'productSales' && productSales.length > 0 && openaiService.isConfigured()) {
    loadProductSalesAIInsights();
    }
  }, [activeTab, productSales]);

  // Load AI insights for product sales
  const loadProductSalesAIInsights = async () => {
    if (!openaiService.isConfigured() || productSales.length === 0) return;
    
    try {
    setLoadingProductAI(true);
    const insights = await openaiService.generateProductSalesInsights(productSales);
    if (insights) {
      setProductSalesInsights(insights);
    }
    } catch (error) {
    console.error('Error loading product sales AI insights:', error);
    } finally {
    setLoadingProductAI(false);
    }
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
    const matchesSearch = 
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      
    const matchesStatus = selectedStatus === 'all' || 
      (selectedStatus === 'In Stock' && product.currentStock > (product.minStock || 0)) ||
      (selectedStatus === 'Low Stock' && product.currentStock > 0 && product.currentStock <= (product.minStock || 0)) ||
      (selectedStatus === 'Out of Stock' && product.currentStock === 0) ||
      (selectedStatus === 'No Stock Data' && !product.currentStock && product.currentStock !== 0);
      
    return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchTerm, selectedCategory, selectedStatus]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalValue = products.reduce((sum, product) => 
    sum + ((product.currentStock || 0) * (product.unitCost || 0)), 0
    );
    const inStockCount = products.filter(p => (p.currentStock || 0) > (p.minStock || 0)).length;
    const lowStockCount = products.filter(p => {
    const stock = p.currentStock || 0;
    const minStock = p.minStock || 0;
    return stock > 0 && stock <= minStock;
    }).length;
    const outOfStockCount = products.filter(p => (p.currentStock || 0) === 0).length;
    
    return { totalProducts, totalValue, inStockCount, lowStockCount, outOfStockCount };
  }, [products]);

  // Get unique categories
  const categories = useMemo(() => {
    return ['all', ...new Set(products.map(p => p.category).filter(Boolean))];
  }, [products]);

  const getStatusColor = (status) => {
    switch (status) {
    case 'In Stock': return 'text-green-600 bg-green-100';
    case 'Low Stock': return 'text-yellow-600 bg-yellow-100';
    case 'Out of Stock': return 'text-red-600 bg-red-100';
    case 'No Stock Data': return 'text-gray-600 bg-gray-100';
    default: return 'text-gray-600 bg-gray-100';
    }
  };

  // ========== REPORTS FUNCTIONS ==========
  const loadReports = async () => {
    if (!userData?.branchId) {
    setErrorReports('Branch ID not found');
    setLoadingReports(false);
    return;
    }

    try {
    setLoadingReports(true);
    setErrorReports(null);

      // Get date range for current month
    const now = new Date();
    const startDate = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
    const endDate = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd');

      // Load inventory sales
    const salesResult = await inventoryService.getInventorySales(
      userData.branchId,
      startDate,
      endDate
    );

    if (salesResult.success) {
      setSalesData(salesResult.salesData);
        
        // Calculate top selling products
      const sorted = [...salesResult.salesData].sort((a, b) => 
        (b.totalRevenue || 0) - (a.totalRevenue || 0)
      );
      setTopSellingProducts(sorted.slice(0, 10));
    }

      // Load inventory statistics
    const statsResult = await inventoryService.getInventoryStats(userData.branchId);
    if (statsResult.success) {
      setInventoryStats(statsResult.stats);
    }

    } catch (err) {
    console.error('Error loading reports:', err);
    setErrorReports(err.message);
    } finally {
    setLoadingReports(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') {
    loadReports();
    }
  }, [userData?.branchId, activeTab]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalRevenue = salesData.reduce((sum, item) => sum + (item.totalRevenue || 0), 0);
    const totalQuantitySold = salesData.reduce((sum, item) => sum + (item.quantitySold || 0), 0);
    const totalCost = salesData.reduce((sum, item) => {
    const cost = (item.quantitySold || 0) * (item.unitCost || 0);
    return sum + cost;
    }, 0);
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
    totalRevenue,
    totalQuantitySold,
    totalCost,
    totalProfit,
    profitMargin,
    totalProducts: salesData.length
    };
  }, [salesData]);

  // ========== PURCHASE ORDERS FUNCTIONS ==========
  const loadPurchaseOrdersData = async () => {
    if (!userData?.branchId) {
    setErrorPO('Branch ID not found');
    setLoadingPO(false);
    return;
    }

    try {
    setLoadingPO(true);
    setErrorPO(null);
    await loadSuppliers();
    await loadBranchProductsForPO();
    await loadPurchaseOrders();
    } catch (err) {
    console.error('Error loading purchase orders data:', err);
    setErrorPO(err.message);
    } finally {
    setLoadingPO(false);
    }
  };

  const loadSuppliers = async () => {
    try {
    const suppliersRef = collection(db, 'suppliers');
    const suppliersSnapshot = await getDocs(suppliersRef);
    const suppliersList = [];
    suppliersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.isActive !== false) {
        suppliersList.push({
          id: doc.id,
          name: data.name || 'Unknown Supplier',
          contactPerson: data.contactPerson || '',
          email: data.email || '',
          phone: data.phone || '',
          ...data
        });
      }
    });
    setSuppliers(suppliersList);
    } catch (err) {
    console.error('Error loading suppliers:', err);
    throw err;
    }
  };

  const loadBranchProductsForPO = async () => {
    try {
    if (!userData?.branchId) return;

      // Get all products from products collection
    const productsRef = collection(db, 'products');
    const productsSnapshot = await getDocs(productsRef);

    const branchProductsList = [];
    productsSnapshot.forEach((doc) => {
      const productData = doc.data();
      const isAvailableToBranch = productData.branches && 
        productData.branches.includes(userData.branchId);
      if (isAvailableToBranch) {
        branchProductsList.push({
          id: doc.id,
          name: productData.name,
          category: productData.category,
          brand: productData.brand,
          unitCost: productData.unitCost || 0,
          supplier: productData.supplier, // Supplier ID
          imageUrl: productData.imageUrl,
          description: productData.description,
          sku: productData.sku,
          ...productData
        });
      }
    });

    setBranchProductsForPO(branchProductsList);
    } catch (err) {
    console.error('Error loading branch products:', err);
    throw err;
    }
  };

  const loadPurchaseOrders = async () => {
    try {
    if (!userData?.branchId) return;

    const purchaseOrdersRef = collection(db, 'purchaseOrders');
    const q = query(
      purchaseOrdersRef,
      where('branchId', '==', userData.branchId)
    );
    const snapshot = await getDocs(q);

    const ordersList = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      ordersList.push({
        id: doc.id,
        ...data,
        orderDate: data.orderDate?.toDate ? data.orderDate.toDate() : new Date(data.orderDate),
        expectedDelivery: data.expectedDelivery?.toDate ? data.expectedDelivery.toDate() : new Date(data.expectedDelivery),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date()),
        approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate() : (data.approvedAt ? new Date(data.approvedAt) : null),
        rejectedAt: data.rejectedAt?.toDate ? data.rejectedAt.toDate() : (data.rejectedAt ? new Date(data.rejectedAt) : null),
        approvedByName: data.approvedByName || null,
        rejectedByName: data.rejectedByName || null,
        rejectionNote: data.rejectionNote || null
      });
    });

      // Sort by createdAt descending
    ordersList.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });

    setPurchaseOrders(ordersList);
    } catch (err) {
    console.error('Error loading purchase orders:', err);
    throw err;
    }
  };

  // When supplier is selected, filter products (suppliers is now an array)
  useEffect(() => {
    if (selectedSupplierId && branchProductsForPO.length > 0) {
    const filtered = branchProductsForPO.filter(product => {
        // Check if suppliers is an array and contains the selected supplier ID
      if (Array.isArray(product.suppliers)) {
        return product.suppliers.includes(selectedSupplierId);
      }
        // Fallback for old data structure (single supplier)
      return product.supplier === selectedSupplierId;
    });
    setSupplierProducts(filtered);
    } else {
    setSupplierProducts([]);
    }
  }, [selectedSupplierId, branchProductsForPO]);

  // Filter and paginate products for big data
  const filteredAndPaginatedProducts = useMemo(() => {
    if (!selectedSupplierId || supplierProducts.length === 0) return { products: [], total: 0, totalPages: 0, hasMore: false };
    
    let filtered = supplierProducts;
    if (debouncedProductSearch.trim()) {
    const searchLower = debouncedProductSearch.toLowerCase();
    filtered = supplierProducts.filter(product => 
      product.name?.toLowerCase().includes(searchLower) ||
      product.brand?.toLowerCase().includes(searchLower) ||
      product.category?.toLowerCase().includes(searchLower) ||
      product.sku?.toLowerCase().includes(searchLower)
    );
    }
    
    const startIndex = (currentProductPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    return {
    products: filtered.slice(startIndex, endIndex),
    total: filtered.length,
    totalPages: Math.ceil(filtered.length / productsPerPage),
    hasMore: endIndex < filtered.length
    };
  }, [supplierProducts, debouncedProductSearch, currentProductPage, selectedSupplierId]);

  // Handle supplier selection
  const handleSupplierSelect = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
    setSelectedSupplierId(supplierId);
    setSelectedSupplierName(supplier.name);
    setShowProductSelection(true);
    setOrderItems([]);
    }
  };

  // Add product to order
  const addProductToOrder = (product) => {
    const existingItem = orderItems.find(item => item.productId === product.id);
    if (existingItem) {
    setOrderItems(prev => prev.map(item =>
      item.productId === product.id
        ? { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * item.unitPrice }
        : item
    ));
    } else {
    setOrderItems(prev => [...prev, {
      productId: product.id || '',
      productName: product.name || '',
      quantity: 1,
      unitPrice: product.unitCost || 0,
      totalPrice: product.unitCost || 0,
      category: product.category || null,
      sku: product.sku || null
    }]);
    }
  };

  // Remove item from order
  const removeOrderItem = (productId) => {
    setOrderItems(prev => prev.filter(item => item.productId !== productId));
  };

  // Update item quantity
  const updateItemQuantity = (productId, quantity) => {
    const qty = parseInt(quantity) || 0;
    if (qty < 1) {
    removeOrderItem(productId);
    return;
    }
    setOrderItems(prev => prev.map(item =>
    item.productId === productId
      ? { 
          ...item, 
          quantity: qty, 
          totalPrice: qty * (item.unitPrice || 0),
          productId: item.productId || '',
          productName: item.productName || '',
          unitPrice: item.unitPrice || 0,
          category: item.category || null,
          sku: item.sku || null
        }
      : item
    ));
  };

  // Calculate total
  const orderTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [orderItems]);

  // Handle create order
  const handleCreateOrder = () => {
    setSelectedSupplierId('');
    setSelectedSupplierName('');
    setShowProductSelection(false);
    setOrderItems([]);
    setProductSearchTerm('');
    setCurrentProductPage(1);
    setOrderFormData({
    orderDate: new Date().toISOString().split('T')[0],
    expectedDelivery: '',
    notes: ''
    });
    setIsCreateModalOpen(true);
  };

  // Helper function to remove undefined values
  const removeUndefined = (obj) => {
    const cleaned = {};
    Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && !(obj[key] instanceof Date)) {
        cleaned[key] = removeUndefined(obj[key]);
      } else if (Array.isArray(obj[key])) {
        cleaned[key] = obj[key].map(item => 
          typeof item === 'object' && item !== null ? removeUndefined(item) : item
        );
      } else {
        cleaned[key] = obj[key];
      }
    }
    });
    return cleaned;
  };

  // Generate next incremental PO number based on existing purchase orders for this branch
  const generateNextPONumber = () => {
    if (!userData?.branchId) {
      throw new Error('Branch ID is required to generate PO number');
    }

    // Get first 3 characters of branch ID (uppercase)
    const branchPrefix = userData.branchId.substring(0, 3).toUpperCase();
    
    // Filter POs for this branch only (should already be filtered, but double-check)
    const branchPOs = purchaseOrders.filter(po => po.branchId === userData.branchId);
    
    if (!branchPOs || branchPOs.length === 0) {
      return `PO-${branchPrefix}-${String(1).padStart(2, '0')}`;
    }

    // Extract numeric parts from existing PO numbers with branch prefix
    // Handles formats like: PO-ABC-01, PO-ABC-1, PO-2024-0001 (legacy), etc.
    const poNumbers = branchPOs
      .map(po => {
        const orderId = po.orderId || '';
        // Match patterns: PO-XXX-NN or PO-XXX-N (branch prefix) or legacy formats
        const branchPrefixMatch = orderId.match(new RegExp(`PO-${branchPrefix}-(\\d+)`));
        if (branchPrefixMatch) {
          return parseInt(branchPrefixMatch[1], 10);
        }
        // Also handle legacy formats for migration
        const legacyMatch = orderId.match(/PO-(\d{4}-)?(\d+)/);
        if (legacyMatch) {
          return parseInt(legacyMatch[legacyMatch.length - 1], 10);
        }
        return 0;
      })
      .filter(num => !isNaN(num) && num > 0);

    // Find the maximum number for this branch
    const maxNumber = poNumbers.length > 0 ? Math.max(...poNumbers) : 0;
    
    // Increment and format with branch prefix
    const nextNumber = maxNumber + 1;
    return `PO-${branchPrefix}-${String(nextNumber).padStart(2, '0')}`;
  };

  // Handle submit order
  const handleSubmitOrder = async (e) => {
    if (e) e.preventDefault();
    
    if (!selectedSupplierId) {
    setErrorPO('Please select a supplier');
    return;
    }

    if (orderItems.length === 0) {
    setErrorPO('Please add at least one product to the order');
    return;
    }

    if (!orderFormData.orderDate) {
    setErrorPO('Please select an order date');
    return;
    }

    if (!orderFormData.expectedDelivery) {
    setErrorPO('Please select an expected delivery date');
    return;
    }

    try {
    setIsSubmitting(true);
    setErrorPO(null);

    if (!userData?.branchId) {
      throw new Error('Branch ID is missing. Please refresh the page.');
    }

    // Generate incremental order ID
    const orderId = generateNextPONumber();

    if (!userData?.uid && !userData?.id) {
      throw new Error('User ID is missing. Please refresh the page.');
    }

    const purchaseOrderData = {
      orderId: orderId || '',
      supplierId: selectedSupplierId || '',
      supplierName: selectedSupplierName || '',
      branchId: userData.branchId,
      orderDate: orderFormData.orderDate ? new Date(orderFormData.orderDate) : new Date(),
      expectedDelivery: orderFormData.expectedDelivery ? new Date(orderFormData.expectedDelivery) : null,
      status: 'Pending',
      totalAmount: Number(orderTotal) || 0,
      items: orderItems.map(item => {
        const validatedItem = {
          productId: String(item.productId || ''),
          productName: String(item.productName || ''),
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unitPrice) || 0,
          totalPrice: Number(item.totalPrice) || 0
        };
        if (item.category) validatedItem.category = String(item.category);
        if (item.sku) validatedItem.sku = String(item.sku);
        return validatedItem;
      }),
      notes: orderFormData.notes ? String(orderFormData.notes) : '',
      createdBy: userData.uid || userData.id,
      createdByName: (userData.firstName && userData.lastName 
        ? `${userData.firstName} ${userData.lastName}`.trim() 
        : (userData.email || 'Unknown')),
      createdByRole: userData.role || 'branchManager',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const cleanedData = removeUndefined(purchaseOrderData);
    const hasUndefined = JSON.stringify(cleanedData).includes('undefined');
    if (hasUndefined) {
      throw new Error('Invalid data: Some fields are undefined. Please check product information.');
    }

    await addDoc(collection(db, 'purchaseOrders'), cleanedData);
    await loadPurchaseOrders();
      
    setIsCreateModalOpen(false);
    setSelectedSupplierId('');
    setSelectedSupplierName('');
    setShowProductSelection(false);
    setOrderItems([]);
    setProductSearchTerm('');
    setCurrentProductPage(1);
    setOrderFormData({
      orderDate: new Date().toISOString().split('T')[0],
      expectedDelivery: '',
      notes: ''
    });
    setErrorPO(null);
    } catch (err) {
    console.error('Error creating purchase order:', err);
    let errorMessage = 'Failed to create purchase order.';
    if (err.message.includes('undefined')) {
      errorMessage = 'Error: Some required fields are missing. Please ensure all product information is complete.';
    } else if (err.message.includes('permission')) {
      errorMessage = 'Permission denied. Please check your access rights.';
    } else {
      errorMessage = err.message || 'Failed to create purchase order. Please try again.';
    }
    setErrorPO(errorMessage);
    } finally {
    setIsSubmitting(false);
    }
  };

  // Filter purchase orders
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter(order => {
    const matchesSearch = 
      order.orderId?.toLowerCase().includes(searchTermPO.toLowerCase()) ||
      order.supplierName?.toLowerCase().includes(searchTermPO.toLowerCase()) ||
      order.notes?.toLowerCase().includes(searchTermPO.toLowerCase());

    const matchesStatus = selectedStatusPO === 'all' || order.status === selectedStatusPO;
    const matchesSupplier = selectedSupplierFilter === 'all' || order.supplierId === selectedSupplierFilter;

    return matchesSearch && matchesStatus && matchesSupplier;
    });
  }, [purchaseOrders, searchTermPO, selectedStatusPO, selectedSupplierFilter]);

  // Purchase order statistics
  const orderStats = useMemo(() => {
    return {
    totalOrders: purchaseOrders.length,
    pendingOrders: purchaseOrders.filter(o => o.status === 'Pending').length,
    deliveredOrders: purchaseOrders.filter(o => o.status === 'Delivered').length,
    overdueOrders: purchaseOrders.filter(o => o.status === 'Overdue').length,
    totalValue: purchaseOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
    };
  }, [purchaseOrders]);

  // Get status color and icon
  const getStatusColorPO = (status) => {
    switch (status) {
    case 'Pending': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    case 'Received': return 'text-blue-600 bg-blue-100 border-blue-200';
    case 'Approved': return 'text-green-600 bg-green-100 border-green-200';
    case 'Rejected': return 'text-red-600 bg-red-100 border-red-200';
    case 'Shipped': return 'text-purple-600 bg-purple-100 border-purple-200';
    case 'Delivered': return 'text-green-600 bg-green-100 border-green-200';
    case 'Cancelled': return 'text-red-600 bg-red-100 border-red-200';
    case 'Overdue': return 'text-orange-600 bg-orange-100 border-orange-200';
    default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
    case 'Pending': return <Clock className="h-3 w-3" />;
    case 'Received': return <CheckCircle className="h-3 w-3" />;
    case 'Approved': return <CheckCircle className="h-3 w-3" />;
    case 'Rejected': return <XCircle className="h-3 w-3" />;
    case 'Shipped': return <Truck className="h-3 w-3" />;
    case 'Delivered': return <CheckCircle className="h-3 w-3" />;
    case 'Cancelled': return <XCircle className="h-3 w-3" />;
    case 'Overdue': return <AlertTriangle className="h-3 w-3" />;
    default: return <Clock className="h-3 w-3" />;
    }
  };

  // Handle receive order (from Inventory Controller)
  const handleReceiveOrder = async (orderId) => {
    try {
    const orderRef = doc(db, 'purchaseOrders', orderId);
    await updateDoc(orderRef, {
      status: 'Received',
      receivedBy: userData.uid || userData.id,
      receivedByName: (userData.firstName && userData.lastName 
        ? `${userData.firstName} ${userData.lastName}`.trim() 
        : (userData.email || 'Unknown')),
      receivedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await loadPurchaseOrders();
    } catch (err) {
    console.error('Error receiving order:', err);
    setErrorPO('Failed to receive order. Please try again.');
    }
  };

  // Check if order can be received (by Branch Manager)
  const canReceive = (order) => {
    return order.createdByRole === 'inventoryController' && order.status === 'Pending';
  };

  // ========== ANALYTICS FUNCTIONS ==========
  const loadAnalytics = async () => {
    if (!userData?.branchId) return;

    try {
    setLoadingAnalytics(true);

      // Load inventory movements for anomaly detection
    const movementsRef = collection(db, 'inventory_movements');
    const movementsQuery = query(
      movementsRef,
      where('branchId', '==', userData.branchId)
    );
    const movementsSnapshot = await getDocs(movementsQuery);
      
    const movements = [];
    movementsSnapshot.forEach((doc) => {
      const data = doc.data();
      movements.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || Date.now())
      });
    });

      // Sort by timestamp (newest first)
    movements.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    setInventoryMovements(movements);

      // Detect anomalies
    const detectedAnomalies = detectAnomalies(products, movements, stocks);
    setAnomalies(detectedAnomalies);

      // Find low sales products
    const lowSales = findLowSalesProducts(products, movements);
    setLowSalesProducts(lowSales);

      // Calculate analytics metrics
    const analytics = calculateAnalyticsMetrics(products, movements, stocks);
    setAnalyticsData(analytics);

    } catch (err) {
    console.error('Error loading analytics:', err);
    } finally {
    setLoadingAnalytics(false);
    }
  };

  // Detect inventory anomalies
  const detectAnomalies = (products, movements, stocks) => {
    const anomalies = [];
    const days = parseInt(analyticsDateRange) || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Filter recent movements
    const recentMovements = movements.filter(m => m.timestamp >= cutoffDate);

    // 1. Sudden stock drops (more than 50% in a day)
    products.forEach(product => {
    const productMovements = recentMovements.filter(m => m.productId === product.id);
    if (productMovements.length < 2) return;

      // Group by date
    const movementsByDate = {};
    productMovements.forEach(m => {
      const dateKey = format(m.timestamp, 'yyyy-MM-dd');
      if (!movementsByDate[dateKey]) {
        movementsByDate[dateKey] = { additions: 0, deductions: 0 };
      }
      if (m.type === 'addition') {
        movementsByDate[dateKey].additions += Math.abs(m.quantity || 0);
      } else {
        movementsByDate[dateKey].deductions += Math.abs(m.quantity || 0);
      }
    });

      // Check for sudden drops
    Object.keys(movementsByDate).forEach(date => {
      const dayMovements = movementsByDate[date];
      const stockBefore = product.currentStock + dayMovements.deductions - dayMovements.additions;
      const dropPercentage = stockBefore > 0 ? (dayMovements.deductions / stockBefore) * 100 : 0;
        
      if (dropPercentage > 50 && dayMovements.deductions > 5) {
        anomalies.push({
          type: 'sudden_stock_drop',
          severity: dropPercentage > 80 ? 'critical' : 'high',
          productId: product.id,
          productName: product.name,
          date: date,
          description: `Stock dropped by ${dropPercentage.toFixed(1)}% (${dayMovements.deductions} units) on ${date}`,
          currentStock: product.currentStock,
          previousStock: stockBefore
        });
      }
    });
    });

    // 2. Products with no movement but stock exists (potential dead stock)
    products.forEach(product => {
    const productMovements = recentMovements.filter(m => m.productId === product.id);
    if (productMovements.length === 0 && product.currentStock > 0) {
      anomalies.push({
        type: 'no_movement',
        severity: 'medium',
        productId: product.id,
        productName: product.name,
        description: `No inventory movement in the last ${days} days despite having ${product.currentStock} units in stock`,
        currentStock: product.currentStock,
        daysWithoutMovement: days
      });
    }
    });

    // 3. Price discrepancies (unit cost vs OTC price)
    products.forEach(product => {
    if (product.unitCost > 0 && product.otcPrice > 0) {
      const margin = ((product.otcPrice - product.unitCost) / product.unitCost) * 100;
      if (margin < 10) {
        anomalies.push({
          type: 'low_margin',
          severity: 'medium',
          productId: product.id,
          productName: product.name,
          description: `Very low profit margin: ${margin.toFixed(1)}% (Cost: ₱${product.unitCost}, Price: ₱${product.otcPrice})`,
          margin: margin,
          unitCost: product.unitCost,
          otcPrice: product.otcPrice
        });
      }
    }
    });

    // 4. Stock level anomalies (stock way above max or way below min)
    products.forEach(product => {
    if (product.maxStock && product.currentStock > product.maxStock * 1.5) {
      anomalies.push({
        type: 'overstocked',
        severity: 'medium',
        productId: product.id,
        productName: product.name,
        description: `Overstocked: ${product.currentStock} units (Max: ${product.maxStock})`,
        currentStock: product.currentStock,
        maxStock: product.maxStock
      });
    }
    if (product.minStock && product.currentStock < product.minStock * 0.5 && product.currentStock > 0) {
      anomalies.push({
        type: 'critically_low',
        severity: 'high',
        productId: product.id,
        productName: product.name,
        description: `Critically low stock: ${product.currentStock} units (Min: ${product.minStock})`,
        currentStock: product.currentStock,
        minStock: product.minStock
      });
    }
    });

    return anomalies.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
    });
  };

  // Find low sales products
  const findLowSalesProducts = (products, movements) => {
    const days = parseInt(analyticsDateRange) || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentMovements = movements.filter(m => 
    m.timestamp >= cutoffDate && 
    m.type === 'deduction' && 
    m.reason?.toLowerCase().includes('sale')
    );

    // Calculate sales per product
    const productSales = {};
    recentMovements.forEach(m => {
    if (!productSales[m.productId]) {
      productSales[m.productId] = {
        quantitySold: 0,
        revenue: 0,
        productName: products.find(p => p.id === m.productId)?.name || 'Unknown'
      };
    }
    productSales[m.productId].quantitySold += Math.abs(m.quantity || 0);
    productSales[m.productId].revenue += Math.abs(m.quantity || 0) * (m.unitPrice || 0);
    });

    // Find products with low or no sales
    const lowSales = products
    .map(product => {
      const sales = productSales[product.id] || { quantitySold: 0, revenue: 0, productName: product.name };
      const stockValue = (product.currentStock || 0) * (product.unitCost || 0);
      const turnoverRate = stockValue > 0 ? (sales.revenue / stockValue) * 100 : 0;
        
      return {
        ...product,
        quantitySold: sales.quantitySold,
        revenue: sales.revenue,
        stockValue: stockValue,
        turnoverRate: turnoverRate,
        daysWithoutSale: sales.quantitySold === 0 ? days : 0
      };
    })
    .filter(product => 
      product.quantitySold === 0 || 
      product.quantitySold < 5 || 
      (product.stockValue > 0 && product.turnoverRate < 10)
    )
    .sort((a, b) => {
        // Sort by: no sales first, then by low turnover
      if (a.quantitySold === 0 && b.quantitySold > 0) return -1;
      if (a.quantitySold > 0 && b.quantitySold === 0) return 1;
      return a.turnoverRate - b.turnoverRate;
    });

    return lowSales;
  };

  // Calculate analytics metrics
  const calculateAnalyticsMetrics = (products, movements, stocks) => {
    const days = parseInt(analyticsDateRange) || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentMovements = movements.filter(m => m.timestamp >= cutoffDate);

    // Total inventory value
    const totalInventoryValue = products.reduce((sum, p) => 
    sum + ((p.currentStock || 0) * (p.unitCost || 0)), 0
    );

    // Sales metrics
    const salesMovements = recentMovements.filter(m => 
    m.type === 'deduction' && m.reason?.toLowerCase().includes('sale')
    );
    const totalSalesRevenue = salesMovements.reduce((sum, m) => 
    sum + (Math.abs(m.quantity || 0) * (m.unitPrice || 0)), 0
    );
    const totalUnitsSold = salesMovements.reduce((sum, m) => 
    sum + Math.abs(m.quantity || 0), 0
    );

    // Inventory turnover
    const avgInventoryValue = totalInventoryValue / 2; // Simplified average
    const inventoryTurnover = avgInventoryValue > 0 ? (totalSalesRevenue / avgInventoryValue) : 0;

    // Profit margins
    const totalCost = salesMovements.reduce((sum, m) => 
    sum + (Math.abs(m.quantity || 0) * (m.unitCost || 0)), 0
    );
    const totalProfit = totalSalesRevenue - totalCost;
    const profitMargin = totalSalesRevenue > 0 ? (totalProfit / totalSalesRevenue) * 100 : 0;

    // Stock status distribution
    const inStock = products.filter(p => (p.currentStock || 0) > (p.minStock || 0)).length;
    const lowStock = products.filter(p => {
    const stock = p.currentStock || 0;
    const minStock = p.minStock || 0;
    return stock > 0 && stock <= minStock;
    }).length;
    const outOfStock = products.filter(p => (p.currentStock || 0) === 0).length;

    // Top performing products
    const productPerformance = {};
    salesMovements.forEach(m => {
    if (!productPerformance[m.productId]) {
      productPerformance[m.productId] = {
        productId: m.productId,
        productName: products.find(p => p.id === m.productId)?.name || 'Unknown',
        quantitySold: 0,
        revenue: 0
      };
    }
    productPerformance[m.productId].quantitySold += Math.abs(m.quantity || 0);
    productPerformance[m.productId].revenue += Math.abs(m.quantity || 0) * (m.unitPrice || 0);
    });

    const topProducts = Object.values(productPerformance)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

    return {
    totalInventoryValue,
    totalSalesRevenue,
    totalUnitsSold,
    inventoryTurnover,
    totalProfit,
    profitMargin,
    stockDistribution: { inStock, lowStock, outOfStock },
    topProducts,
    totalProducts: products.length,
    daysAnalyzed: days
    };
  };

  // Load analytics when tab is active
  useEffect(() => {
    if (activeTab === 'analytics' && products.length > 0) {
    loadAnalytics();
    }
  }, [userData?.branchId, activeTab, analyticsDateRange, products.length]);

  return (
    
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Tabs */}
      <Card className="p-0">
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('products')}
              className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'products'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <span>Products</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'reports'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                <span>Reports</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('purchaseOrders')}
              className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'purchaseOrders'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <span>Purchase Orders</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'analytics'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                <span>Business Analytics</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('productSales')}
              className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'productSales'
                  ? 'border-[#160B53] text-[#160B53]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <span>Product Sales</span>
              </div>
            </button>
          </div>
        </div>
      </Card>

      {/* PRODUCTS TAB */}
      {activeTab === 'products' && (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Products</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
            </div>
          </div>
        </Card>
          
        <Card className="p-6">
          <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Stock</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.inStockCount}</p>
            </div>
          </div>
        </Card>
          
        <Card className="p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Low Stock</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.lowStockCount}</p>
                </div>
              </div>
            </Card>
              
            <Card className="p-6">
              <div className="flex items-center">
                <TrendingDown className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.outOfStockCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <Banknote className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Value</p>
                  <p className="text-2xl font-bold text-gray-900">₱{stats.totalValue.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Controls */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
              
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
                  {categories.filter(c => c !== 'all').map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                  <option value="all">All Status</option>
                  <option value="In Stock">In Stock</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Out of Stock">Out of Stock</option>
                  <option value="No Stock Data">No Stock Data</option>
            </select>
          </div>

          <div className="flex gap-2">
                <Button variant="outline" onClick={loadProducts}>
                  <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </Card>

      {/* Products Table */}
      <Card className="p-6">
            {loading && products.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading products...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600">{error}</p>
              </div>
            ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Product</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Brand</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Stock</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Unit Cost</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">OTC Price</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 hidden lg:table-cell">Service Mapping</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Total Value</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="text-center py-8 text-gray-500">
                          No products found
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product) => {
                        // Debug: Log what we're about to display for ARGAN
                        if (product.id === 'mZorRF53mbG553ZUHDuU') {
                          console.log('🎨 Rendering ARGAN in table:', {
                            productId: product.id,
                            name: product.name,
                            currentStock: product.currentStock,
                            currentStockType: typeof product.currentStock,
                            allProductKeys: Object.keys(product).filter(k => k.includes('stock') || k.includes('Stock'))
                          });
                        }
                        return (
                <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div>
                              <p className="font-medium text-gray-900">{product.name || 'Unknown'}</p>
                              {product.sku && (
                                <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                              )}
                    </div>
                  </td>
                          <td className="py-4 px-4 text-gray-700">{product.category || '-'}</td>
                          <td className="py-4 px-4 text-gray-700">{product.brand || '-'}</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900">
                        {Number(product.currentStock) || 0}
                      </span>
                      {product.maxStock > 0 && (
                        <span className="text-sm text-gray-500 ml-1">/ {product.maxStock}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
                              {(() => {
                                const statusValue = product.status || 'Unknown';
                                // Debug for ARGAN
                                if (product.id === 'mZorRF53mbG553ZUHDuU') {
                                  console.log('🔴 STATUS VALUE BEING RENDERED:', {
                                    productId: product.id,
                                    status: product.status,
                                    statusType: typeof product.status,
                                    statusValue: statusValue,
                                    currentStock: product.currentStock,
                                    minStock: product.minStock
                                  });
                                }
                                return String(statusValue);
                              })()}
                    </span>
                  </td>
                          <td className="py-4 px-4 text-gray-700">₱{(product.unitCost || 0).toFixed(2)}</td>
                          <td className="py-4 px-4 text-gray-700">₱{(product.otcPrice || 0).toFixed(2)}</td>
                          <td className="py-4 px-4 hidden lg:table-cell">
                            {product.serviceProductMapping && Object.keys(product.serviceProductMapping).length > 0 ? (
                              <div className="space-y-1">
                                {Object.entries(product.serviceProductMapping).slice(0, 2).map(([serviceId, minimumCost]) => {
                                  const service = services.find(s => s.id === serviceId);
                                  return (
                                    <div key={serviceId} className="flex items-center gap-1 text-xs">
                                      <Scissors className="w-3 h-3 text-purple-500 flex-shrink-0" />
                                      <span className="text-gray-700 truncate">{service?.name || 'Unknown'}</span>
                                      <span className="text-purple-600 font-medium">₱{parseFloat(minimumCost || 0).toLocaleString()}</span>
                                    </div>
                                  );
                                })}
                                {Object.keys(product.serviceProductMapping).length > 2 && (
                                  <span className="text-xs text-gray-400">+{Object.keys(product.serviceProductMapping).length - 2} more</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">None</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-gray-700">
                            ₱{((product.currentStock || 0) * (product.unitCost || 0)).toLocaleString()}
                          </td>
                  <td className="py-4 px-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('View details clicked for product:', product);
                          setSelectedProduct(product);
                          setShowDetailsModal(true);
                        }}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                  </td>
                </tr>
                        );
                      })
                    )}
            </tbody>
          </table>
        </div>
            )}
      </Card>

          {/* Alerts */}
          {stats.lowStockCount > 0 && (
        <Card className="p-6 border-l-4 border-yellow-400 bg-yellow-50">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-yellow-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800">Low Stock Alert</h3>
              <p className="text-yellow-700">
                    {stats.lowStockCount} product{stats.lowStockCount > 1 ? 's' : ''} need{stats.lowStockCount === 1 ? 's' : ''} restocking
              </p>
            </div>
          </div>
        </Card>
      )}

          {stats.outOfStockCount > 0 && (
        <Card className="p-6 border-l-4 border-red-400 bg-red-50">
          <div className="flex items-center">
            <TrendingDown className="h-6 w-6 text-red-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-red-800">Out of Stock Alert</h3>
              <p className="text-red-700">
                    {stats.outOfStockCount} product{stats.outOfStockCount > 1 ? 's' : ''} out of stock
              </p>
            </div>
          </div>
        </Card>
      )}
        </>
      )}

      {/* REPORTS TAB */}
      {activeTab === 'reports' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inventory Reports</h1>
              <p className="text-gray-600">Sales analysis and inventory insights</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={loadReports}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {loadingReports && !salesData.length ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading reports...</span>
            </div>
          ) : (
            <>
              {/* Summary Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6">
                  <div className="flex items-center">
                    <Banknote className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-gray-900">₱{summaryStats.totalRevenue.toLocaleString()}</p>
                    </div>
                  </div>
                </Card>
                  
                <Card className="p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Profit</p>
                      <p className="text-2xl font-bold text-gray-900">₱{summaryStats.totalProfit.toLocaleString()}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center">
                    <Package className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Units Sold</p>
                      <p className="text-2xl font-bold text-gray-900">{summaryStats.totalQuantitySold}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center">
                    <BarChart3 className="h-8 w-8 text-orange-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Profit Margin</p>
                      <p className="text-2xl font-bold text-gray-900">{summaryStats.profitMargin.toFixed(1)}%</p>
                    </div>
                  </div>
                </Card>
    </div>

              {/* Inventory Statistics */}
              {inventoryStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="p-6">
                    <div className="flex items-center">
                      <Package className="h-8 w-8 text-blue-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Products</p>
                        <p className="text-2xl font-bold text-gray-900">{inventoryStats.totalProducts}</p>
                      </div>
                    </div>
                  </Card>
                    
                  <Card className="p-6">
                    <div className="flex items-center">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">In Stock</p>
                        <p className="text-2xl font-bold text-gray-900">{inventoryStats.inStockCount}</p>
                      </div>
                    </div>
                  </Card>
                    
                  <Card className="p-6">
                    <div className="flex items-center">
                      <AlertTriangle className="h-8 w-8 text-yellow-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Low Stock</p>
                        <p className="text-2xl font-bold text-gray-900">{inventoryStats.lowStockCount}</p>
                      </div>
                    </div>
                  </Card>
                    
                  <Card className="p-6">
                    <div className="flex items-center">
                      <Banknote className="h-8 w-8 text-purple-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Inventory Value</p>
                        <p className="text-2xl font-bold text-gray-900">₱{inventoryStats.totalValue.toLocaleString()}</p>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Top Selling Products */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Top Selling Products</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Product</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Quantity Sold</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Revenue</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Profit</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topSellingProducts.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-8 text-gray-500">
                            No sales data for this period
                          </td>
                        </tr>
                      ) : (
                        topSellingProducts.map((product, index) => {
                          const profit = (product.totalRevenue || 0) - ((product.quantitySold || 0) * (product.unitCost || 0));
                          const margin = (product.totalRevenue || 0) > 0 
                            ? (profit / product.totalRevenue) * 100 
                            : 0;
                          return (
                            <tr key={product.productId || index} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-4 px-4">
                                <p className="font-medium text-gray-900">{product.productName || 'Unknown'}</p>
                              </td>
                              <td className="py-4 px-4 text-gray-700">{product.quantitySold || 0}</td>
                              <td className="py-4 px-4 text-gray-700">₱{(product.totalRevenue || 0).toLocaleString()}</td>
                              <td className="py-4 px-4 text-gray-700">₱{profit.toLocaleString()}</td>
                              <td className="py-4 px-4 text-gray-700">{margin.toFixed(1)}%</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </>
      )}

      {/* PURCHASE ORDERS TAB */}
      {activeTab === 'purchaseOrders' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
              <p className="text-gray-600">View purchase orders from suppliers</p>
            </div>
          </div>

          {/* Error Display */}
          {errorPO && (
            <Card className="p-4 bg-red-50 border-red-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <p className="text-red-800">{errorPO}</p>
                <Button variant="ghost" size="sm" onClick={() => setErrorPO(null)} className="ml-auto">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="flex items-center">
                <ShoppingCart className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="text-xl font-bold text-gray-900">{orderStats.totalOrders}</p>
                </div>
              </div>
            </Card>
              
            <Card className="p-4">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-xl font-bold text-gray-900">{orderStats.pendingOrders}</p>
                </div>
              </div>
            </Card>
              
            <Card className="p-4">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Delivered</p>
                  <p className="text-xl font-bold text-gray-900">{orderStats.deliveredOrders}</p>
                </div>
              </div>
            </Card>
              
            <Card className="p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Overdue</p>
                  <p className="text-xl font-bold text-gray-900">{orderStats.overdueOrders}</p>
                </div>
              </div>
            </Card>
              
            <Card className="p-4">
              <div className="flex items-center">
                <Banknote className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Total Value</p>
                  <p className="text-xl font-bold text-gray-900">₱{orderStats.totalValue.toLocaleString()}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Search and Filters */}
          <Card className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by order ID, supplier, or notes..."
                  value={searchTermPO}
                  onChange={(e) => setSearchTermPO(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
              <div className="flex gap-3">
                <select
                  value={selectedStatusPO}
                  onChange={(e) => setSelectedStatusPO(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                >
                  <option value="all">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Received">Received</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Overdue">Overdue</option>
                </select>
                <select
                  value={selectedSupplierFilter}
                  onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                >
                  <option value="all">All Suppliers</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTermPO('');
                    setSelectedStatusPO('all');
                    setSelectedSupplierFilter('all');
                  }}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
          </Card>

          {/* Purchase Orders Table */}
          {loadingPO && purchaseOrders.length === 0 ? (
            <Card className="p-12">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#160B53]" />
                <span className="ml-2 text-gray-600">Loading purchase orders...</span>
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Supplier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Expected Delivery
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                          No purchase orders found
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{order.orderId || order.id}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{order.supplierName || 'Unknown'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {order.orderDate ? format(new Date(order.orderDate), 'MMM dd, yyyy') : 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {order.expectedDelivery ? format(new Date(order.expectedDelivery), 'MMM dd, yyyy') : 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColorPO(order.status)}`}>
                              {getStatusIcon(order.status)}
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">₱{(order.totalAmount || 0).toLocaleString()}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{order.createdByName || 'Unknown'}</div>
                            {order.createdByRole === 'inventoryController' && (
                              <div className="text-xs text-gray-500">Inventory Controller</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedOrder(order);
                                setIsDetailsModalOpen(true);
                              }}
                              className="flex items-center gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ANALYTICS TAB */}
      {activeTab === 'analytics' && (
        <>
          {/* Header with Date Range */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Business Analytics</h1>
              <p className="text-gray-600">Inventory insights, anomalies, and performance metrics</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={analyticsDateRange}
                onChange={(e) => setAnalyticsDateRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="60">Last 60 days</option>
                <option value="90">Last 90 days</option>
              </select>
              <Button variant="outline" onClick={loadAnalytics} disabled={loadingAnalytics}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingAnalytics ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card 
              className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-[#160B53]"
              onClick={() => setSelectedAnalyticsView('anomalies')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Inventory Anomalies</p>
                  <p className="text-2xl font-bold text-gray-900">{anomalies.length}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {anomalies.filter(a => a.severity === 'critical' || a.severity === 'high').length} critical
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </Card>

            <Card 
              className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-[#160B53]"
              onClick={() => setSelectedAnalyticsView('lowSales')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Low Sales Products</p>
                  <p className="text-2xl font-bold text-gray-900">{lowSalesProducts.length}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {lowSalesProducts.filter(p => p.quantitySold === 0).length} with no sales
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <TrendingDown className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </Card>

            <Card 
              className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-[#160B53]"
              onClick={() => setSelectedAnalyticsView('overview')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Inventory Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₱{analyticsData?.totalInventoryValue?.toLocaleString() || '0'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Total stock value</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Banknote className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </Card>

            <Card 
              className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-[#160B53]"
              onClick={() => setSelectedAnalyticsView('trends')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Sales Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₱{analyticsData?.totalSalesRevenue?.toLocaleString() || '0'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Last {analyticsDateRange} days</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <TrendingUpIcon className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </Card>
          </div>

          {/* Analytics Content */}
          {loadingAnalytics ? (
            <Card className="p-12">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#160B53]" />
                <span className="ml-2 text-gray-600">Loading analytics...</span>
              </div>
            </Card>
          ) : (
            <>
              {/* Overview View */}
              {selectedAnalyticsView === 'overview' && analyticsData && (
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Profit Margin</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {analyticsData.profitMargin?.toFixed(1) || '0'}%
                          </p>
                        </div>
                        <PieChart className="h-8 w-8 text-purple-600" />
                      </div>
                    </Card>

                    <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Inventory Turnover</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {analyticsData.inventoryTurnover?.toFixed(2) || '0'}x
                          </p>
                        </div>
                        <Target className="h-8 w-8 text-blue-600" />
                      </div>
                    </Card>

                    <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Profit</p>
                          <p className="text-2xl font-bold text-gray-900">
                            ₱{analyticsData.totalProfit?.toLocaleString() || '0'}
                          </p>
                        </div>
                        <Banknote className="h-8 w-8 text-green-600" />
                      </div>
                    </Card>

                    <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Units Sold</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {analyticsData.totalUnitsSold || '0'}
                          </p>
                        </div>
                        <Package className="h-8 w-8 text-orange-600" />
                      </div>
                    </Card>
                  </div>

                  {/* Stock Distribution */}
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Status Distribution</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">
                          {analyticsData.stockDistribution?.inStock || 0}
                        </p>
                        <p className="text-sm text-gray-600">In Stock</p>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <p className="text-2xl font-bold text-yellow-600">
                          {analyticsData.stockDistribution?.lowStock || 0}
                        </p>
                        <p className="text-sm text-gray-600">Low Stock</p>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <p className="text-2xl font-bold text-red-600">
                          {analyticsData.stockDistribution?.outOfStock || 0}
                        </p>
                        <p className="text-sm text-gray-600">Out of Stock</p>
                      </div>
                    </div>
                  </Card>

                  {/* Top Products */}
                  {analyticsData.topProducts && analyticsData.topProducts.length > 0 && (
                    <Card className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Products</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Product</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Units Sold</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Revenue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analyticsData.topProducts.map((product, index) => (
                              <tr key={product.productId} className="border-b border-gray-100">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                                    <span className="font-medium text-gray-900">{product.productName}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-gray-700">{product.quantitySold}</td>
                                <td className="py-3 px-4 font-semibold text-gray-900">
                                  ₱{product.revenue.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Anomalies View */}
              {selectedAnalyticsView === 'anomalies' && (
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Inventory Anomalies</h3>
                    <span className="text-sm text-gray-500">
                      {anomalies.length} anomaly{anomalies.length !== 1 ? 'ies' : ''} detected
                    </span>
                  </div>
                  {anomalies.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <p className="text-gray-600">No anomalies detected</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {anomalies.map((anomaly, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border-l-4 ${
                            anomaly.severity === 'critical'
                              ? 'bg-red-50 border-red-500'
                              : anomaly.severity === 'high'
                              ? 'bg-orange-50 border-orange-500'
                              : 'bg-yellow-50 border-yellow-500'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className={`h-5 w-5 ${
                                  anomaly.severity === 'critical' ? 'text-red-600' :
                                  anomaly.severity === 'high' ? 'text-orange-600' : 'text-yellow-600'
                                }`} />
                                <span className={`font-semibold ${
                                  anomaly.severity === 'critical' ? 'text-red-800' :
                                  anomaly.severity === 'high' ? 'text-orange-800' : 'text-yellow-800'
                                }`}>
                                  {anomaly.severity.toUpperCase()}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {anomaly.type.replace('_', ' ').toUpperCase()}
                                </span>
                              </div>
                              <p className="font-medium text-gray-900 mb-1">{anomaly.productName}</p>
                              <p className="text-sm text-gray-700">{anomaly.description}</p>
                              {anomaly.date && (
                                <p className="text-xs text-gray-500 mt-1">Date: {anomaly.date}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* Low Sales Products View */}
              {selectedAnalyticsView === 'lowSales' && (
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Low Sales Products</h3>
                    <span className="text-sm text-gray-500">
                      {lowSalesProducts.length} product{lowSalesProducts.length !== 1 ? 's' : ''} with low sales
                    </span>
                  </div>
                  {lowSalesProducts.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <p className="text-gray-600">All products are performing well</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Product</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Current Stock</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Units Sold</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Revenue</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Stock Value</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Turnover Rate</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lowSalesProducts.map((product) => (
                            <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 px-4">
                                <p className="font-medium text-gray-900">{product.name}</p>
                                <p className="text-xs text-gray-500">{product.category}</p>
                              </td>
                              <td className="py-3 px-4 text-gray-700">{product.currentStock || 0}</td>
                              <td className="py-3 px-4 text-gray-700">{product.quantitySold || 0}</td>
                              <td className="py-3 px-4 text-gray-700">₱{(product.revenue || 0).toLocaleString()}</td>
                              <td className="py-3 px-4 text-gray-700">₱{(product.stockValue || 0).toLocaleString()}</td>
                              <td className="py-3 px-4">
                                <span className={`font-medium ${
                                  product.turnoverRate < 5 ? 'text-red-600' :
                                  product.turnoverRate < 10 ? 'text-yellow-600' : 'text-gray-600'
                                }`}>
                                  {product.turnoverRate.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                {product.quantitySold === 0 ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    No Sales
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    Low Sales
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              )}

              {/* Trends View */}
              {selectedAnalyticsView === 'trends' && analyticsData && (
                <div className="space-y-6">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Performance</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                        <p className="text-2xl font-bold text-blue-600">
                          ₱{analyticsData.totalSalesRevenue?.toLocaleString() || '0'}
                        </p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-600">Total Profit</p>
                        <p className="text-2xl font-bold text-green-600">
                          ₱{analyticsData.totalProfit?.toLocaleString() || '0'}
                        </p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-600">Profit Margin</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {analyticsData.profitMargin?.toFixed(1) || '0'}%
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Efficiency</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <p className="text-sm font-medium text-gray-600">Inventory Turnover</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">
                          {analyticsData.inventoryTurnover?.toFixed(2) || '0'}x
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {analyticsData.inventoryTurnover > 1 ? 'Good' : analyticsData.inventoryTurnover > 0.5 ? 'Moderate' : 'Low'} turnover rate
                        </p>
                      </div>
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <p className="text-sm font-medium text-gray-600">Average Days to Sell</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">
                          {analyticsData.inventoryTurnover > 0 
                            ? (parseInt(analyticsDateRange) / analyticsData.inventoryTurnover).toFixed(0)
                            : 'N/A'
                          }
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Days</p>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* PRODUCT SALES TAB */}
      {activeTab === 'productSales' && (
        <>
          {/* Header with Date Range and Search */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Product Sales</h1>
              <p className="text-gray-600">Track sales performance of each product for business decisions</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={salesDateRange}
                onChange={(e) => setSalesDateRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="60">Last 60 days</option>
                <option value="90">Last 90 days</option>
                <option value="180">Last 6 months</option>
                <option value="365">Last year</option>
              </select>
              <Button
                variant="outline"
                onClick={loadProductSales}
                className="flex items-center gap-2"
                disabled={loadingSales}
              >
                <RefreshCw className={`h-4 w-4 ${loadingSales ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Search and Sort */}
          <Card className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search products by name..."
                  value={salesSearchTerm}
                  onChange={(e) => setSalesSearchTerm(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
              <div className="flex gap-3">
                <select
                  value={salesSortBy}
                  onChange={(e) => setSalesSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                >
                  <option value="revenue">Sort by Revenue</option>
                  <option value="quantity">Sort by Quantity</option>
                  <option value="name">Sort by Name</option>
                </select>
                <Button
                  variant="outline"
                  onClick={() => setSalesSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="flex items-center gap-2"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {salesSortOrder === 'asc' ? 'Ascending' : 'Descending'}
                </Button>
              </div>
            </div>
          </Card>

          {/* AI Insights for Product Sales */}
          {openaiService.isConfigured() && (
            <Card className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">AI-Powered Product Insights</h3>
                    <p className="text-sm text-gray-600">Actionable recommendations based on sales data</p>
                  </div>
                </div>
                {loadingProductAI && (
                  <Loader2Icon className="h-5 w-5 animate-spin text-purple-600" />
                )}
              </div>
                
              {productSalesInsights && !loadingProductAI ? (
                <div className="space-y-4">
                  {productSalesInsights.insights && productSalesInsights.insights.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Key Insights</h4>
                      <ul className="space-y-1">
                        {productSalesInsights.insights.map((insight, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-purple-600 mt-1">•</span>
                            <span>{typeof insight === 'string' ? insight : insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                    
                  {productSalesInsights.recommendations && productSalesInsights.recommendations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Inventory Recommendations</h4>
                      <ul className="space-y-1">
                        {productSalesInsights.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-blue-600 mt-1">→</span>
                            <span>{typeof rec === 'string' ? rec : rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                    
                  {productSalesInsights.opportunities && productSalesInsights.opportunities.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Promotion Opportunities</h4>
                      <ul className="space-y-1">
                        {productSalesInsights.opportunities.map((opp, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-green-600 mt-1">★</span>
                            <span>{typeof opp === 'string' ? opp : opp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : !loadingProductAI && productSales.length > 0 && (
                <Button
                  onClick={loadProductSalesAIInsights}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate AI Insights
                </Button>
              )}
            </Card>
          )}

          {/* Sales Statistics */}
          {productSales.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center">
                  <Package className="h-8 w-8 text-blue-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Products Sold</p>
                    <p className="text-xl font-bold text-gray-900">{productSales.length}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-xl font-bold text-gray-900">
                      ₱{productSales.reduce((sum, sale) => sum + sale.totalRevenue, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center">
                  <Target className="h-8 w-8 text-purple-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Total Units</p>
                    <p className="text-xl font-bold text-gray-900">
                      {productSales.reduce((sum, sale) => sum + sale.totalQuantity, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center">
                  <Banknote className="h-8 w-8 text-orange-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Avg Price</p>
                    <p className="text-xl font-bold text-gray-900">
                      ₱{productSales.length > 0 
                        ? (productSales.reduce((sum, sale) => sum + sale.averagePrice, 0) / productSales.length).toFixed(2)
                        : '0.00'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Product Sales Table */}
          {loadingSales ? (
            <Card className="p-12 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-[#160B53] mx-auto mb-4" />
              <p className="text-gray-600">Loading product sales data...</p>
            </Card>
          ) : productSales.length > 0 ? (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product Name
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity Sold
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transactions
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Average Price
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {productSales
                      .filter(sale => 
                        sale.productName.toLowerCase().includes(salesSearchTerm.toLowerCase())
                      )
                      .sort((a, b) => {
                        let aValue, bValue;
                        if (salesSortBy === 'revenue') {
                          aValue = a.totalRevenue;
                          bValue = b.totalRevenue;
                        } else if (salesSortBy === 'quantity') {
                          aValue = a.totalQuantity;
                          bValue = b.totalQuantity;
                        } else {
                          aValue = a.productName.toLowerCase();
                          bValue = b.productName.toLowerCase();
                        }
                          
                        if (salesSortOrder === 'asc') {
                          return aValue > bValue ? 1 : -1;
                        } else {
                          return aValue < bValue ? 1 : -1;
                        }
                      })
                      .map((sale) => (
                        <tr key={sale.productId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{sale.productName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="text-sm text-gray-900 font-semibold">{sale.totalQuantity.toLocaleString()}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="text-sm text-gray-600">{sale.transactionCount}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm text-gray-900">₱{sale.averagePrice.toFixed(2)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm font-bold text-green-600">₱{sale.totalRevenue.toLocaleString()}</div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  {productSales.length > 0 && (
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          Total
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-gray-900">
                          {productSales.reduce((sum, sale) => sum + sale.totalQuantity, 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-gray-900">
                          {productSales.reduce((sum, sale) => sum + sale.transactionCount, 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                          -
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-green-600">
                          ₱{productSales.reduce((sum, sale) => sum + sale.totalRevenue, 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center">
              <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Sales Data</h3>
              <p className="text-gray-600">
                No product sales found for the selected period. Sales data will appear here once products are sold.
              </p>
            </Card>
          )}
        </>
      )}

      {/* Product Details Modal */}
      {showDetailsModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col transform transition-all duration-300 scale-100 mx-4">
            <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Eye className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Product Details</h2>
                    <p className="text-white/80 text-sm mt-1">{selectedProduct.name}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedProduct(null);
                  }}
                  className="text-white hover:bg-white/20 rounded-full p-2"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
              
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">Product Name</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Brand</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.brand || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Category</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.category || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">SKU</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.sku || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Current Stock</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.currentStock || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Min Stock</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.minStock || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Max Stock</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.maxStock || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedProduct.status)}`}>
                    {selectedProduct.status || 'Unknown'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Unit Cost</p>
                  <p className="text-lg font-semibold text-gray-900">₱{(selectedProduct.unitCost || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">OTC Price</p>
                  <p className="text-lg font-semibold text-gray-900">₱{(selectedProduct.otcPrice || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Value</p>
                  <p className="text-lg font-semibold text-gray-900">
                    ₱{((selectedProduct.currentStock || 0) * (selectedProduct.unitCost || 0)).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Supplier</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedProduct.supplier || '-'}</p>
                </div>
                {selectedProduct.description && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-gray-500">Description</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedProduct.description}</p>
                  </div>
                )}
                {selectedProduct.location && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Location</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedProduct.location}</p>
                  </div>
                )}
                {selectedProduct.lastUpdated && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Last Updated</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatDate(selectedProduct.lastUpdated, 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                )}
                {/* Service Mapping */}
                {selectedProduct.serviceProductMapping && Object.keys(selectedProduct.serviceProductMapping).length > 0 && (
                  <div className="col-span-2 border-t pt-4 mt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-purple-500" />
                      Service-Product Mapping (Minimum Cost)
                    </p>
                    <div className="space-y-2">
                      {Object.entries(selectedProduct.serviceProductMapping).map(([serviceId, minimumCost]) => {
                        const service = services.find(s => s.id === serviceId);
                        return (
                          <div key={serviceId} className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Scissors className="w-4 h-4 text-purple-500" />
                              <span className="text-sm font-medium text-gray-900">{service?.name || 'Unknown Service'}</span>
                            </div>
                            <span className="text-sm font-semibold text-purple-600">₱{parseFloat(minimumCost || 0).toLocaleString()}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
              
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex justify-end">
              <Button
                onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedProduct(null);
                  }}
                  className="bg-[#160B53] text-white hover:bg-[#12094A]"
                >
                  Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* PURCHASE ORDERS MODALS */}
      {/* Order Details Modal */}
      {isDetailsModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Purchase Order Details</h2>
                    <p className="text-white/80 text-sm mt-1">{selectedOrder.orderId || selectedOrder.id}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    setSelectedOrder(null);
                  }}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Order Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedOrder.supplierName || 'Unknown Supplier'}</h3>
                    <p className="text-gray-600">Order Date: {selectedOrder.orderDate ? format(new Date(selectedOrder.orderDate), 'MMM dd, yyyy') : 'N/A'}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColorPO(selectedOrder.status)}`}>
                    {getStatusIcon(selectedOrder.status)}
                    {selectedOrder.status}
                  </span>
                </div>

                {/* Order Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Expected Delivery</label>
                      <p className="text-gray-900">
                        {selectedOrder.expectedDelivery ? format(new Date(selectedOrder.expectedDelivery), 'MMM dd, yyyy') : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Created By</label>
                      <p className="text-gray-900">{selectedOrder.createdByName || 'Unknown'}</p>
                    </div>
                    {selectedOrder.approvedByName && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Approved By</label>
                        <p className="text-gray-900 text-green-600 font-semibold">{selectedOrder.approvedByName}</p>
                        {selectedOrder.approvedAt && (
                          <p className="text-xs text-gray-500">
                            {format(new Date(selectedOrder.approvedAt), 'MMM dd, yyyy HH:mm')}
                          </p>
                        )}
                      </div>
                    )}
                    {selectedOrder.rejectedByName && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Rejected By</label>
                        <p className="text-gray-900 text-red-600 font-semibold">{selectedOrder.rejectedByName}</p>
                        {selectedOrder.rejectedAt && (
                          <p className="text-xs text-gray-500">
                            {format(new Date(selectedOrder.rejectedAt), 'MMM dd, yyyy HH:mm')}
                          </p>
                        )}
                        {selectedOrder.rejectionNote && (
                          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm font-medium text-red-800">Rejection Note:</p>
                            <p className="text-sm text-red-700 mt-1">{selectedOrder.rejectionNote}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Total Amount</label>
                      <p className="text-2xl font-bold text-[#160B53]">₱{(selectedOrder.totalAmount || 0).toLocaleString()}</p>
                    </div>
                    {selectedOrder.notes && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Notes</label>
                        <p className="text-gray-900">{selectedOrder.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedOrder.items && selectedOrder.items.length > 0 ? (
                          selectedOrder.items.map((item, index) => (
                            <tr key={index}>
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{item.productName}</div>
                                {item.sku && (
                                  <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-900">{item.quantity}</td>
                              <td className="px-4 py-3 text-gray-900">₱{(item.unitPrice || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-900">₱{(item.totalPrice || 0).toLocaleString()}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className="px-4 py-4 text-center text-gray-500">No items</td>
                          </tr>
                        )}
                      </tbody>
                      {selectedOrder.items && selectedOrder.items.length > 0 && (
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan="3" className="px-4 py-3 text-right font-semibold text-gray-900">Total:</td>
                            <td className="px-4 py-3 text-right font-bold text-[#160B53] text-lg">
                              ₱{(selectedOrder.totalAmount || 0).toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    setSelectedOrder(null);
                  }}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    
  );
};

export default Inventory;
