// src/pages/06_InventoryController/Stocks.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import InventoryLayout from '../../layouts/InventoryLayout';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import { productService } from '../../services/productService';
import { logActivity as activityServiceLogActivity } from '../../services/activityService';
import { stockListenerService } from '../../services/stockListenerService';
import { weeklyStockRecorder } from '../../services/weeklyStockRecorder';
import { db, auth } from '../../config/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, limit, startAfter, getCountFromServer, updateDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { verifyRolePassword } from '../../services/rolePasswordService';
import { USER_ROLES } from '../../utils/constants';
import { 
  Package, 
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
  Calendar,
  Banknote,
  Tag,
  Building,
  Clock,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown,
  Package2,
  Activity,
  Home,
  ArrowRightLeft,
  QrCode,
  ShoppingCart,
  Truck,
  ClipboardList,
  UserCog,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  PackageCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel } from '../../utils/excelExport';
import { toast } from 'react-hot-toast';

const Stocks = () => {
  const { userData } = useAuth();

  // Note: menuItems are defined in InventoryLayout, not needed here
  
  // Data states
  const [stocks, setStocks] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]); // For delivery tracking
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25); // Items per page
  const [totalItems, setTotalItems] = useState(0);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('productName');
  const [sortOrder, setSortOrder] = useState('asc');
  
  // Virtual scrolling / visible items
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);
  const [visibleEndIndex, setVisibleEndIndex] = useState(50); // Show 50 items at a time
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null); // For viewing stock history
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingActivityLogs, setLoadingActivityLogs] = useState(false);
  const [historyDateFilter, setHistoryDateFilter] = useState('all'); // 'all', '7days', '30days', '90days', '1year', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isCreateStockModalOpen, setIsCreateStockModalOpen] = useState(false);
  const [isEditStockModalOpen, setIsEditStockModalOpen] = useState(false);
  
  // Stock deduction history states
  const [stockDeductions, setStockDeductions] = useState([]);
  const [loadingDeductions, setLoadingDeductions] = useState(false);
  const [showDeductionHistory, setShowDeductionHistory] = useState(false);
  const [deductionSearchTerm, setDeductionSearchTerm] = useState('');
  const [deductionDateFilter, setDeductionDateFilter] = useState('7days'); // 'all', '7days', '30days', '90days'
  
  // Stock adjustments history states
  const [stockAdjustments, setStockAdjustments] = useState([]);
  const [loadingAdjustments, setLoadingAdjustments] = useState(false);
  const [showAdjustmentsHistory, setShowAdjustmentsHistory] = useState(false);
  const [adjustmentDateFilter, setAdjustmentDateFilter] = useState('all'); // 'all', '7days', '30days', '90days', '1year'
  const [adjustmentSearchTerm, setAdjustmentSearchTerm] = useState('');
  
  // Edit stock form state
  const [editStockForm, setEditStockForm] = useState({
    weekOneStock: '',
    weekTwoStock: '',
    weekThreeStock: '',
    weekFourStock: ''
  });
  const [editStockErrors, setEditStockErrors] = useState({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  
  // Product selection states for big data
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Memoized filtered products for performance (big data friendly)
  const filteredProducts = useMemo(() => {
    if (!productSearchTerm) return products;
    const search = productSearchTerm.toLowerCase();
    return products.filter(product => 
      product.name?.toLowerCase().includes(search) ||
      product.brand?.toLowerCase().includes(search) ||
      product.category?.toLowerCase().includes(search) ||
      product.upc?.toLowerCase().includes(search)
    );
  }, [products, productSearchTerm]);
  
  // Limit displayed products for better performance (show first 50, rest via scrolling)
  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, 100); // Show first 100 products initially
  }, [filteredProducts]);
  
  const hasMoreProducts = filteredProducts.length > 100;
  
  // Create stock form states
  const [createStockForm, setCreateStockForm] = useState({
    productId: '',
    beginningStock: '',
    startPeriod: '',
    endPeriod: '',
    weekOneStock: '',
    weekTwoStock: '',
    weekThreeStock: '',
    weekFourStock: ''
  });
  const [createStockErrors, setCreateStockErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Force adjust states
  const [isForceAdjustModalOpen, setIsForceAdjustModalOpen] = useState(false);
  const [forceAdjustForm, setForceAdjustForm] = useState({
    productId: '',
    stockId: '',
    currentStock: '',
    newStock: '',
    adjustmentQuantity: '',
    reason: '',
    managerCode: '',
    notes: ''
  });
  const [forceAdjustErrors, setForceAdjustErrors] = useState({});
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    stockRange: { min: '', max: '' },
    lowStock: false,
    usageType: 'all' // 'all', 'otc', 'salon-use'
  });

  // Mock stock data - in real app, this would come from API
  const mockStocks = [
    {
      id: '1',
      productId: 'prod1',
      productName: 'Olaplex No.3 Hair Perfector',
      brand: 'Olaplex',
      category: 'Hair Care',
      upc: '123456789114',
      currentStock: 45,
      minStock: 10,
      maxStock: 100,
      unitCost: 900,
      totalValue: 40500,
      lastUpdated: new Date('2024-01-15'),
      status: 'In Stock',
      branchId: 'branch1',
      branchName: 'Harbor Point Ayala',
      location: 'Shelf A-1',
      supplier: 'Olaplex Philippines',
      lastRestocked: new Date('2024-01-10'),
      expiryDate: new Date('2025-12-31')
    },
    {
      id: '2',
      productId: 'prod2',
      productName: 'L\'Oréal Professional Hair Color',
      brand: 'L\'Oréal',
      category: 'Hair Color',
      upc: '123456789115',
      currentStock: 5,
      minStock: 15,
      maxStock: 50,
      unitCost: 1200,
      totalValue: 6000,
      lastUpdated: new Date('2024-01-14'),
      status: 'Low Stock',
      branchId: 'branch1',
      branchName: 'Harbor Point Ayala',
      location: 'Shelf B-2',
      supplier: 'L\'Oréal Philippines',
      lastRestocked: new Date('2024-01-05'),
      expiryDate: new Date('2025-06-30')
    },
    {
      id: '3',
      productId: 'prod3',
      productName: 'Kerastase Shampoo',
      brand: 'Kerastase',
      category: 'Hair Care',
      upc: '123456789116',
      currentStock: 0,
      minStock: 5,
      maxStock: 30,
      unitCost: 800,
      totalValue: 0,
      lastUpdated: new Date('2024-01-13'),
      status: 'Out of Stock',
      branchId: 'branch1',
      branchName: 'Harbor Point Ayala',
      location: 'Shelf C-1',
      supplier: 'Kerastase Philippines',
      lastRestocked: new Date('2024-01-01'),
      expiryDate: new Date('2025-03-15')
    }
  ];

  // Helper function to get branch name
  const getBranchName = async (branchId) => {
    if (!branchId) return 'Unknown Branch';
    try {
      const branchDoc = await getDoc(doc(db, 'branches', branchId));
      if (branchDoc.exists()) {
        return branchDoc.data().name || 'Unknown Branch';
      }
    } catch (error) {
      console.error('Error getting branch name:', error);
    }
    return 'Unknown Branch';
  };

  // Helper function to log activity
  const logActivity = async (action, entityType, entityId, entityName, changes, reason = '', notes = '') => {
    try {
      const branchName = await getBranchName(userData?.branchId);
      const userName = userData?.displayName || userData?.name || userData?.email || 'Unknown User';
      const userRole = userData?.roles?.[0] || userData?.role || 'unknown';

      await activityServiceLogActivity({
        action: `stock_${action}`,
        performedBy: userData?.uid || '',
        branchId: userData?.branchId || '',
        details: {
          module: 'stocks',
          action,
          entityType,
          entityId,
          entityName,
          branchName,
          userName,
          userRole,
          changes,
          reason,
          notes
        }
      });
    } catch (error) {
      console.error('Error logging activity:', error);
      // Don't throw - activity logging should not break the main flow
    }
  };

  // Load stocks and products
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load products
      const productsResult = await productService.getAllProducts();
      if (productsResult.success) {
        setProducts(productsResult.products);
      }
      
      // Load purchase orders to track deliveries
      if (userData?.branchId) {
        try {
          const poRef = collection(db, 'purchaseOrders');
          const poQuery = query(
            poRef, 
            where('branchId', '==', userData.branchId),
            where('status', '==', 'Delivered')
          );
          const poSnapshot = await getDocs(poQuery);
          const poData = poSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setPurchaseOrders(poData);
        } catch (poErr) {
          console.error('Error loading purchase orders:', poErr);
        }
      }
      
      // Load stocks from Firestore for the current branch with pagination
      if (!userData?.branchId) {
        setStocks([]);
        setTotalItems(0);
      } else {
        const stocksRef = collection(db, 'stocks');
        
        // Get total count (for display purposes)
        try {
          const countQuery = query(stocksRef, where('branchId', '==', userData.branchId));
          const countSnapshot = await getCountFromServer(countQuery);
          setTotalItems(countSnapshot.data().count);
        } catch (countErr) {
          console.error('Error getting count:', countErr);
        }
        
        // Load first page only (paginated) - include both regular stocks and batch_stocks
        // Fetch data first, then sort in JavaScript to avoid needing a Firestore index
        const q = query(
          stocksRef, 
          where('branchId', '==', userData.branchId),
          limit(itemsPerPage * 2) // Fetch more to account for sorting, then limit after sorting
        );
        
        const snapshot = await getDocs(q);
        let stocksData = snapshot.docs.map(doc => {
          const data = doc.data();
          return { 
            id: doc.id, 
            ...data,
            // Convert Firestore timestamps to dates
            startPeriod: data.startPeriod?.toDate ? data.startPeriod.toDate() : (data.startPeriod ? new Date(data.startPeriod) : null),
            endPeriod: data.endPeriod?.toDate ? data.endPeriod.toDate() : (data.endPeriod ? new Date(data.endPeriod) : null),
            expirationDate: data.expirationDate?.toDate ? data.expirationDate.toDate() : (data.expirationDate ? new Date(data.expirationDate) : null),
            receivedDate: data.receivedDate?.toDate ? data.receivedDate.toDate() : (data.receivedDate ? new Date(data.receivedDate) : null),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date())
          };
        });
        
        // Sort in JavaScript by createdAt descending (newest first), then by startPeriod
        stocksData = stocksData.sort((a, b) => {
          // First sort by createdAt (newest first)
          const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (createdB !== createdA) {
            return createdB - createdA; // Descending order
          }
          // If createdAt is same, sort by startPeriod
          const dateA = a.startPeriod ? new Date(a.startPeriod).getTime() : 0;
          const dateB = b.startPeriod ? new Date(b.startPeriod).getTime() : 0;
          return dateB - dateA; // Descending order
        });
        
        // Limit to itemsPerPage after sorting
        stocksData = stocksData.slice(0, itemsPerPage);
        
        // Update pagination state
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setLastVisible(lastDoc);
        setHasMore(snapshot.docs.length >= itemsPerPage);
        setCurrentPage(1);
        
        setStocks(stocksData);
      }
      
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load more stocks (pagination)
  const loadMoreStocks = async () => {
    if (!hasMore || loadingMore || !userData?.branchId || !lastVisible) return;
    
    try {
      setLoadingMore(true);
      const stocksRef = collection(db, 'stocks');
      const q = query(
        stocksRef,
        where('branchId', '==', userData.branchId),
        startAfter(lastVisible),
        limit(itemsPerPage)
      );
      
      const snapshot = await getDocs(q);
      const newStocks = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startPeriod: data.startPeriod?.toDate ? data.startPeriod.toDate() : (data.startPeriod ? new Date(data.startPeriod) : null),
          endPeriod: data.endPeriod?.toDate ? data.endPeriod.toDate() : (data.endPeriod ? new Date(data.endPeriod) : null),
          expirationDate: data.expirationDate?.toDate ? data.expirationDate.toDate() : (data.expirationDate ? new Date(data.expirationDate) : null),
          receivedDate: data.receivedDate?.toDate ? data.receivedDate.toDate() : (data.receivedDate ? new Date(data.receivedDate) : null),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date())
        };
      });
      
      // Sort and append
      const sortedNewStocks = newStocks.sort((a, b) => {
        const dateA = a.startPeriod ? new Date(a.startPeriod) : new Date(0);
        const dateB = b.startPeriod ? new Date(b.startPeriod) : new Date(0);
        return dateB - dateA;
      });
      
      setStocks(prev => [...prev, ...sortedNewStocks]);
      
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      setLastVisible(lastDoc);
      setHasMore(snapshot.docs.length === itemsPerPage);
      setCurrentPage(prev => prev + 1);
    } catch (err) {
      console.error('Error loading more stocks:', err);
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  // Reset and reload (for filters/search)
  const reloadStocks = async () => {
    setCurrentPage(1);
    setLastVisible(null);
    setHasMore(true);
    setStocks([]); // Clear existing stocks
    await loadData();
  };

  // Debounce search term for big data performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Start stock listener on mount
  useEffect(() => {
    if (userData?.branchId) {
      console.log('Starting stock listener for branch:', userData.branchId);
      
      const unsubscribe = stockListenerService.startListening(
        userData.branchId,
        (transactionId, transactionData) => {
          console.log('Stock updated from transaction:', transactionId);
          // Reload stocks to reflect changes
          reloadStocks();
        }
      );

      // Cleanup: stop listener on unmount
      return () => {
        if (unsubscribe) {
          stockListenerService.stopListening(userData.branchId);
        }
      };
    }
  }, [userData?.branchId]);

  // Reset visible range when filters change
  useEffect(() => {
    setVisibleStartIndex(0);
    setVisibleEndIndex(50);
  }, [debouncedSearchTerm, filters, sortBy, sortOrder]);

  // Calculate deliveries for a product in a given month
  const getDeliveriesForMonth = (productId, startDate, endDate) => {
    return purchaseOrders.reduce((total, po) => {
      if (!po.actualDelivery) return total;
      const deliveryDate = po.actualDelivery?.toDate ? po.actualDelivery.toDate() : new Date(po.actualDelivery);
      
      if (deliveryDate >= startDate && deliveryDate <= endDate && po.items) {
        const item = po.items.find(item => item.productId === productId);
        if (item) {
          return total + (item.quantity || 0);
        }
      }
      return total;
    }, 0);
  };

  // Calculate ending stock for a month (beginningStock of next month + deliveries)
  const calculateEndingStock = (productId, currentMonthStart, currentMonthEnd) => {
    // Find next month's beginning stock
    const nextMonthStart = new Date(currentMonthStart);
    nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);
    nextMonthStart.setDate(1);
    
    const nextMonthStock = stocks.find(s => 
      s.productId === productId &&
      s.startPeriod &&
      format(new Date(s.startPeriod), 'yyyy-MM-dd') === format(nextMonthStart, 'yyyy-MM-dd')
    );
    
    const nextMonthBeginningStock = nextMonthStock?.beginningStock || 0;
    
    // Get deliveries in current month
    const deliveries = getDeliveriesForMonth(productId, currentMonthStart, currentMonthEnd);
    
    return {
      endingStock: nextMonthBeginningStock,
      deliveries: deliveries,
      calculatedEndingStock: nextMonthBeginningStock + deliveries
    };
  };

  // Get stock history for a product
  const getStockHistoryForProduct = (productId) => {
    return stocks
      .filter(s => s.productId === productId)
      .sort((a, b) => {
        const dateA = a.startPeriod ? new Date(a.startPeriod) : new Date(0);
        const dateB = b.startPeriod ? new Date(b.startPeriod) : new Date(0);
        return dateB - dateA; // Descending (newest first)
      })
      .map(stock => {
        const startDate = stock.startPeriod ? new Date(stock.startPeriod) : null;
        const endDate = stock.endPeriod ? new Date(stock.endPeriod) : null;
        
        let endingStockInfo = null;
        if (startDate && endDate) {
          endingStockInfo = calculateEndingStock(stock.productId, startDate, endDate);
        }
        
        return {
          ...stock,
          endingStockInfo,
          monthLabel: startDate ? format(startDate, 'MMMM yyyy') : 'Unknown'
        };
      });
  };

  // Calculate stock status based on stock levels
  const calculateStockStatus = (stock) => {
    const currentStock = stock.realTimeStock || stock.weekFourStock || stock.beginningStock || stock.currentStock || 0;
    const minStock = stock.minStock || stock.product?.minStock || 0;
    
    if (currentStock > minStock) {
      return 'In Stock';
    } else if (currentStock > 0) {
      return 'Low Stock';
    } else {
      return 'Out of Stock';
    }
  };

  // Get all stocks (including all batches for each product)
  // For batch stocks, show all active batches. For regular stocks, show current month only.
  const getCurrentStocksByProduct = () => {
    const currentDate = new Date();
    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const stockList = [];
    const processedRegularStocks = new Set(); // Track regular stocks to avoid duplicates
    
    stocks.forEach(stock => {
      const isBatchStock = stock.stockType === 'batch' || stock.batchId || stock.batchNumber;
      
      if (isBatchStock) {
        // For batch stocks, show ALL batches (even if depleted, so you can see history)
        // Only filter out if realTimeStock is 0 AND it's an old batch (older than current month)
        const stockStart = stock.startPeriod ? new Date(stock.startPeriod) : null;
        const isCurrentMonth = stockStart && 
          stockStart.getMonth() === currentMonthStart.getMonth() &&
          stockStart.getFullYear() === currentMonthStart.getFullYear();
        
        const realTimeStock = stock.realTimeStock || 0;
        // Show batch if: has stock, or is current month, or was created recently
        if (realTimeStock > 0 || isCurrentMonth || (stockStart && stockStart >= currentMonthStart)) {
          // Always calculate status based on current stock levels to ensure it matches filter options
          const calculatedStatus = calculateStockStatus(stock);
          stockList.push({
            ...stock,
            status: calculatedStatus, // Ensure status matches filter options: 'In Stock', 'Low Stock', 'Out of Stock'
            product: products.find(p => p.id === stock.productId),
            stockHistory: getStockHistoryForProduct(stock.productId)
          });
        }
      } else {
        // For regular stocks (non-batch), show current month only (one per product)
        if (!stock.startPeriod) return;
        const stockStart = new Date(stock.startPeriod);
        const isCurrentMonth = 
          stockStart.getMonth() === currentMonthStart.getMonth() &&
          stockStart.getFullYear() === currentMonthStart.getFullYear();
        
        if (isCurrentMonth && !processedRegularStocks.has(stock.productId)) {
          processedRegularStocks.add(stock.productId);
          // Always calculate status based on current stock levels to ensure it matches filter options
          const calculatedStatus = calculateStockStatus(stock);
          stockList.push({
            ...stock,
            status: calculatedStatus, // Ensure status matches filter options: 'In Stock', 'Low Stock', 'Out of Stock'
            product: products.find(p => p.id === stock.productId),
            stockHistory: getStockHistoryForProduct(stock.productId)
          });
        }
      }
    });
    
    return stockList;
  };

  // Get current month stocks for display (only from loaded stocks)
  const currentMonthStocks = getCurrentStocksByProduct();

  // Get unique categories (from loaded data only - memoized for performance)
  const categories = useMemo(() => {
    return [...new Set(currentMonthStocks.map(s => s.category || s.product?.category))].filter(Boolean);
  }, [currentMonthStocks]);

  // Filter and sort current month stocks (memoized for big data performance)
  const filteredStocks = useMemo(() => {
    return currentMonthStocks
      .filter(stockData => {
        const stock = stockData;
        const product = stockData.product;
        
        // Use debounced search term for better performance
        const matchesSearch = 
          !debouncedSearchTerm ||
          (stock.productName || product?.name || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          (stock.brand || product?.brand || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          (stock.upc || product?.upc || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());
        
        const matchesStatus = filters.status === 'all' || stock.status === filters.status;
        const matchesCategory = filters.category === 'all' || 
          (stock.category || product?.category || '') === filters.category;
        
        // Usage type filter
        const stockUsageType = stock.usageType || 'otc'; // Default to 'otc' for backward compatibility
        const matchesUsageType = filters.usageType === 'all' || stockUsageType === filters.usageType;
        
        const currentStock = stock.realTimeStock || stock.weekFourStock || stock.beginningStock || 0;
        const matchesStockRange = (!filters.stockRange.min || currentStock >= parseFloat(filters.stockRange.min)) &&
                                 (!filters.stockRange.max || currentStock <= parseFloat(filters.stockRange.max));
        
        const minStock = stock.minStock || 0;
        const matchesLowStock = !filters.lowStock || currentStock <= minStock;
        
        return matchesSearch && matchesStatus && matchesCategory && matchesUsageType && matchesStockRange && matchesLowStock;
      })
      .sort((a, b) => {
        const aStock = a.productName || a.product?.name || '';
        const bStock = b.productName || b.product?.name || '';
        
        if (sortBy === 'productName') {
          return sortOrder === 'asc' 
            ? aStock.localeCompare(bStock)
            : bStock.localeCompare(aStock);
        }
        
        let aValue = a[sortBy] || a.product?.[sortBy];
        let bValue = b[sortBy] || b.product?.[sortBy];
        
        if (sortBy === 'startPeriod' || sortBy === 'endPeriod' || sortBy === 'lastUpdated') {
          aValue = aValue ? new Date(aValue) : new Date(0);
          bValue = bValue ? new Date(bValue) : new Date(0);
        }
        
        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
  }, [currentMonthStocks, debouncedSearchTerm, filters, sortBy, sortOrder]);

  // Visible stocks for virtual scrolling (big data optimization)
  const visibleStocks = useMemo(() => {
    return filteredStocks.slice(visibleStartIndex, visibleEndIndex);
  }, [filteredStocks, visibleStartIndex, visibleEndIndex]);

  // Calculate total pages for pagination
  const totalPages = useMemo(() => {
    return Math.ceil(filteredStocks.length / 50);
  }, [filteredStocks.length]);

  const currentPageNumber = useMemo(() => {
    return Math.floor(visibleStartIndex / 50) + 1;
  }, [visibleStartIndex]);

  // Load more visible items (virtual scroll)
  const loadMoreVisible = useCallback(() => {
    if (visibleEndIndex < filteredStocks.length) {
      setVisibleEndIndex(prev => Math.min(prev + 50, filteredStocks.length));
    }
  }, [filteredStocks.length, visibleEndIndex]);

  // Export stocks to Excel
  const handleExportStocks = () => {
    if (!filteredStocks.length) {
      toast.error('No stocks to export');
      return;
    }

    try {
      const headers = [
        { key: 'productName', label: 'Product Name' },
        { key: 'brand', label: 'Brand' },
        { key: 'category', label: 'Category' },
        { key: 'upc', label: 'UPC' },
        { key: 'batchNumber', label: 'Batch Number' },
        { key: 'beginningStock', label: 'Beginning Stock' },
        { key: 'realTimeStock', label: 'Current Stock' },
        { key: 'status', label: 'Status' },
        { key: 'expirationDate', label: 'Expiration Date' },
        { key: 'receivedDate', label: 'Received Date' },
        { key: 'startPeriod', label: 'Start Period' },
        { key: 'endPeriod', label: 'End Period' }
      ];

      // Prepare data with formatted dates and status
      const exportData = filteredStocks.map(stock => {
        const product = stock.product || {};
        const isBatchStock = stock.stockType === 'batch' || stock.batchId || stock.batchNumber;
        const currentStock = stock.realTimeStock || stock.weekFourStock || stock.beginningStock || 0;
        const status = calculateStockStatus(stock);

        return {
          productName: stock.productName || product.name || 'Unknown',
          brand: stock.brand || product.brand || '',
          category: stock.category || product.category || '',
          upc: stock.upc || product.upc || '',
          batchNumber: isBatchStock ? (stock.batchNumber || 'N/A') : 'N/A',
          beginningStock: stock.beginningStock || 0,
          realTimeStock: currentStock,
          status: status,
          expirationDate: stock.expirationDate 
            ? format(new Date(stock.expirationDate), 'MMM dd, yyyy')
            : 'N/A',
          receivedDate: stock.receivedDate
            ? format(new Date(stock.receivedDate), 'MMM dd, yyyy')
            : 'N/A',
          startPeriod: stock.startPeriod
            ? format(new Date(stock.startPeriod), 'MMM dd, yyyy')
            : 'N/A',
          endPeriod: stock.endPeriod
            ? format(new Date(stock.endPeriod), 'MMM dd, yyyy')
            : 'N/A'
        };
      });

      exportToExcel(exportData, 'stocks_export', 'Stocks', headers);
      toast.success('Stocks exported to Excel successfully');
    } catch (error) {
      console.error('Error exporting stocks:', error);
      toast.error('Failed to export stocks');
    }
  };

  // Handle stock details
  const handleViewDetails = (stock) => {
    setSelectedStock(stock);
    setIsDetailsModalOpen(true);
  };

  // Handle view stock history
  const handleViewHistory = (stock) => {
    setSelectedProductId(stock.productId);
    setIsHistoryModalOpen(true);
  };

  // Handle edit stock
  const handleEditStock = (stock) => {
    setEditStockForm({
      weekOneStock: stock.weekOneStock?.toString() || '',
      weekTwoStock: stock.weekTwoStock?.toString() || '',
      weekThreeStock: stock.weekThreeStock?.toString() || '',
      weekFourStock: stock.weekFourStock?.toString() || ''
    });
    setEditStockErrors({});
    setIsEditStockModalOpen(true);
  };

  // Handle force adjust stock
  const handleForceAdjustStock = (stock) => {
    setForceAdjustForm({
      productId: stock.productId,
      stockId: stock.id,
      currentStock: stock.realTimeStock || stock.weekFourStock || stock.beginningStock || 0,
      newStock: '',
      adjustmentQuantity: '',
      reason: '',
      managerCode: '',
      notes: ''
    });
    setForceAdjustErrors({});
    setIsForceAdjustModalOpen(true);
  };
  
  // Verify manager code by checking branch manager's role password
  const verifyManagerCode = async (code, branchId) => {
    try {
      if (!branchId || !code) {
        return false;
      }

      // Get branch manager for this branch
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('role', '==', USER_ROLES.BRANCH_MANAGER),
        where('branchId', '==', branchId),
        where('active', '==', true)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.error('No branch manager found for branch:', branchId);
        return false;
      }

      // Get the first branch manager (should be only one per branch)
      const managerDoc = snapshot.docs[0];
      const managerData = managerDoc.data();
      const managerId = managerDoc.id;
      
      if (!managerId) {
        console.error('Branch manager has no ID');
        return false;
      }

      // Verify using the branch manager's role password
      const isValid = await verifyRolePassword(managerId, USER_ROLES.BRANCH_MANAGER, code);
      
      if (isValid === null) {
        // No role password set - fallback to Firebase Auth for backward compatibility
        if (!managerData.email) {
          console.error('Branch manager has no email and no role password set');
          return false;
        }
        
        try {
          const userCredential = await signInWithEmailAndPassword(auth, managerData.email, code);
          if (userCredential.user) {
            await new Promise(resolve => setTimeout(resolve, 100));
            await signOut(auth);
            return true;
          }
          return false;
        } catch (authError) {
          console.error('Password verification failed:', authError);
          return false;
        }
      }
      
      return isValid;
    } catch (error) {
      console.error('Error verifying manager code:', error);
      return false;
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'In Stock': return 'text-green-600 bg-green-100';
      case 'Low Stock': return 'text-yellow-600 bg-yellow-100';
      case 'Out of Stock': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'In Stock': return <CheckCircle className="h-4 w-4" />;
      case 'Low Stock': return <AlertTriangle className="h-4 w-4" />;
      case 'Out of Stock': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Calculate stock statistics (memoized for performance)
  const stockStats = useMemo(() => {
    return {
      totalItems: totalItems, // Use total count from Firestore
      loadedItems: currentMonthStocks.length,
      inStock: currentMonthStocks.filter(s => s.status === 'In Stock').length,
      lowStock: currentMonthStocks.filter(s => s.status === 'Low Stock').length,
      outOfStock: currentMonthStocks.filter(s => s.status === 'Out of Stock').length,
      totalValue: currentMonthStocks.reduce((sum, s) => {
        const currentStock = s.realTimeStock || s.weekFourStock || s.beginningStock || 0;
        const unitCost = s.unitCost || 0;
        return sum + (currentStock * unitCost);
      }, 0),
      lowStockItems: currentMonthStocks.filter(s => {
        const currentStock = s.realTimeStock || s.weekFourStock || s.beginningStock || 0;
        return currentStock <= (s.minStock || 0);
      })
    };
  }, [currentMonthStocks, totalItems]);


  // Load activity logs for a product
  const loadActivityLogs = async (productId, stockId) => {
    if (!productId) return;
    
    try {
      setLoadingActivityLogs(true);
      const { getActivityLogs } = await import('../../services/activityService');
      
      let startDate = null;
      let endDate = null;
      
      if (historyDateFilter === 'custom') {
        if (customStartDate) startDate = new Date(customStartDate);
        if (customEndDate) {
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
        }
      } else if (historyDateFilter !== 'all') {
        const now = new Date();
        endDate = now;
        if (historyDateFilter === '7days') {
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (historyDateFilter === '30days') {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else if (historyDateFilter === '90days') {
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        } else if (historyDateFilter === '1year') {
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        }
      }
      
      const logs = await getActivityLogs({
        branchId: userData?.branchId,
        limit: 100
      });
      
      // Filter by product/stock and date
      let filteredLogs = logs.filter(log => {
        const details = log.details || {};
        if (details.entityId !== stockId && details.entityId !== productId) return false;
        if (startDate && log.timestamp && new Date(log.timestamp) < startDate) return false;
        if (endDate && log.timestamp && new Date(log.timestamp) > endDate) return false;
        return true;
      });
      
      setActivityLogs(filteredLogs);
    } catch (error) {
      console.error('Error loading activity logs:', error);
      setActivityLogs([]);
    } finally {
      setLoadingActivityLogs(false);
    }
  };

  // Load stock deduction history from transactions
  const loadStockDeductions = async () => {
    if (!userData?.branchId) return;
    
    try {
      setLoadingDeductions(true);
      
      // Calculate date range
      let startDate = null;
      const now = new Date();
      const endDate = now;
      
      if (deductionDateFilter === '7days') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (deductionDateFilter === '30days') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (deductionDateFilter === '90days') {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      }
      
      // Query transactions with products
      const transactionsRef = collection(db, 'transactions');
      let transactionsQuery = query(
        transactionsRef,
        where('branchId', '==', userData.branchId),
        where('status', '==', 'paid'),
        orderBy('createdAt', 'desc'),
        limit(500) // Limit to recent transactions
      );
      
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      const deductions = [];
      
      transactionsSnapshot.forEach((doc) => {
        const transactionData = doc.data();
        const transactionId = doc.id;
        
        // Check if transaction has products
        const salesType = transactionData.salesType || '';
        if (salesType !== 'product' && salesType !== 'mixed') return;
        
        // Filter date if needed
        if (startDate) {
          const createdAt = transactionData.createdAt?.toDate ? 
            transactionData.createdAt.toDate() : 
            new Date(transactionData.createdAt);
          if (createdAt < startDate) return;
        }
        
        // Extract product items
        const items = transactionData.items || [];
        const productItems = items.filter(item => item.type === 'product');
        
        productItems.forEach((item) => {
          deductions.push({
            id: `${transactionId}_${item.id}`,
            transactionId: transactionId,
            productId: item.id,
            productName: item.name,
            quantity: item.quantity || 1,
            price: item.price || 0,
            total: (item.price || 0) * (item.quantity || 1),
            clientName: transactionData.clientName || 'Walk-in',
            createdAt: transactionData.createdAt?.toDate ? 
              transactionData.createdAt.toDate() : 
              new Date(transactionData.createdAt),
            createdBy: transactionData.createdByName || transactionData.createdBy || 'Unknown',
            branchName: transactionData.branchName || '',
            paymentMethod: transactionData.paymentMethod || 'cash'
          });
        });
      });
      
      // Sort by date (newest first)
      deductions.sort((a, b) => b.createdAt - a.createdAt);
      
      setStockDeductions(deductions);
    } catch (error) {
      console.error('Error loading stock deductions:', error);
      setStockDeductions([]);
    } finally {
      setLoadingDeductions(false);
    }
  };

  // Load deductions when showing history or date filter changes
  useEffect(() => {
    if (showDeductionHistory) {
      loadStockDeductions();
    }
  }, [showDeductionHistory, deductionDateFilter, userData?.branchId]);

  // Load stock adjustments history (includes: Force Adjustments, Transactions, Stock Transfers)
  const loadStockAdjustments = async () => {
    if (!userData?.branchId) return;
    
    try {
      setLoadingAdjustments(true);
      const allAdjustments = [];
      const now = new Date();
      let startDate = new Date();
      
      // Calculate start date for filter
      if (adjustmentDateFilter !== 'all') {
        switch (adjustmentDateFilter) {
          case '7days':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30days':
            startDate.setDate(now.getDate() - 30);
            break;
          case '90days':
            startDate.setDate(now.getDate() - 90);
            break;
          case '1year':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
        }
      }
      const startTimestamp = adjustmentDateFilter !== 'all' ? Timestamp.fromDate(startDate) : null;

      // 1. Load Force Adjustments (from stockAdjustments collection)
      try {
        const adjustmentsRef = collection(db, 'stockAdjustments');
        let adjustmentsQuery = query(
          adjustmentsRef,
          where('branchId', '==', userData.branchId),
          orderBy('createdAt', 'desc')
        );
        if (startTimestamp) {
          adjustmentsQuery = query(adjustmentsQuery, where('createdAt', '>=', startTimestamp));
        }
        const adjustmentsSnapshot = await getDocs(adjustmentsQuery);
        adjustmentsSnapshot.forEach((doc) => {
          const data = doc.data();
          allAdjustments.push({
            id: doc.id,
            type: 'force_adjustment',
            adjustmentType: 'Force Adjustment',
            productId: data.productId,
            previousStock: data.previousStock,
            newStock: data.newStock,
            adjustmentQuantity: data.adjustmentQuantity,
            reason: data.reason,
            notes: data.notes,
            adjustedBy: data.adjustedBy,
            managerCode: data.managerCode,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : 
                       data.createdAt instanceof Date ? data.createdAt :
                       data.createdAt ? new Date(data.createdAt) : new Date(),
          });
        });
      } catch (error) {
        console.error('Error loading force adjustments:', error);
      }

      // 2. Load Transactions (from inventory_movements collection - stock_out type)
      try {
        const movementsRef = collection(db, 'inventory_movements');
        let movementsQuery = query(
          movementsRef,
          where('branchId', '==', userData.branchId),
          where('type', '==', 'stock_out'),
          orderBy('createdAt', 'desc')
        );
        if (startTimestamp) {
          movementsQuery = query(movementsQuery, where('createdAt', '>=', startTimestamp));
        }
        const movementsSnapshot = await getDocs(movementsQuery);
        movementsSnapshot.forEach((doc) => {
          const data = doc.data();
          allAdjustments.push({
            id: doc.id,
            type: 'transaction',
            adjustmentType: 'Transaction Sale',
            productId: data.productId,
            previousStock: null, // Transactions don't track previous stock
            newStock: null,
            adjustmentQuantity: -data.quantity, // Negative for deductions
            reason: data.reason || 'Transaction Sale',
            notes: data.notes || `Transaction: ${data.transactionId || 'N/A'}`,
            adjustedBy: data.createdBy,
            transactionId: data.transactionId,
            batchesUsed: data.batchDeductions,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : 
                       data.createdAt instanceof Date ? data.createdAt :
                       data.createdAt ? new Date(data.createdAt) : new Date(),
          });
        });
      } catch (error) {
        console.error('Error loading transactions:', error);
      }

      // 3. Load Stock Transfers (from stock_transfer collection)
      try {
        const transfersRef = collection(db, 'stock_transfer');
        // Get transfers where this branch is sender (outgoing) or receiver (incoming)
        const outgoingQuery = query(
          transfersRef,
          where('fromBranchId', '==', userData.branchId),
          orderBy('transferDate', 'desc')
        );
        const incomingQuery = query(
          transfersRef,
          where('toBranchId', '==', userData.branchId),
          orderBy('transferDate', 'desc')
        );
        
        const [outgoingSnapshot, incomingSnapshot] = await Promise.all([
          getDocs(outgoingQuery),
          getDocs(incomingQuery)
        ]);

        // Process outgoing transfers (deductions from this branch)
        outgoingSnapshot.forEach((doc) => {
          const data = doc.data();
          if (startTimestamp && data.transferDate?.toDate && data.transferDate.toDate() < startTimestamp.toDate()) {
            return; // Skip if before start date
          }
          data.items?.forEach((item) => {
            allAdjustments.push({
              id: `${doc.id}-${item.productId}`,
              type: 'transfer_out',
              adjustmentType: `Transfer Out → ${data.toBranchName || 'Other Branch'}`,
              productId: item.productId,
              previousStock: null,
              newStock: null,
              adjustmentQuantity: -item.quantity, // Negative for outgoing
              reason: 'Stock Transfer',
              notes: `Transfer ID: ${data.transferId || doc.id} | Batches: ${item.batches?.map(b => b.batchNumber).join(', ') || 'N/A'}`,
              adjustedBy: data.createdBy,
              transferId: data.transferId || doc.id,
              batchesUsed: item.batches,
              createdAt: data.transferDate?.toDate ? data.transferDate.toDate() : 
                         data.createdAt?.toDate ? data.createdAt.toDate() :
                         data.createdAt instanceof Date ? data.createdAt :
                         data.createdAt ? new Date(data.createdAt) : new Date(),
            });
          });
        });

        // Process incoming transfers (additions to this branch)
        incomingSnapshot.forEach((doc) => {
          const data = doc.data();
          if (startTimestamp && data.transferDate?.toDate && data.transferDate.toDate() < startTimestamp.toDate()) {
            return; // Skip if before start date
          }
          if (data.status === 'completed' || data.status === 'received') {
            data.items?.forEach((item) => {
              allAdjustments.push({
                id: `${doc.id}-${item.productId}-in`,
                type: 'transfer_in',
                adjustmentType: `Transfer In ← ${data.fromBranchName || 'Other Branch'}`,
                productId: item.productId,
                previousStock: null,
                newStock: null,
                adjustmentQuantity: item.quantity, // Positive for incoming
                reason: 'Stock Transfer Received',
                notes: `Transfer ID: ${data.transferId || doc.id} | Received: ${data.receivedAt ? format(data.receivedAt.toDate ? data.receivedAt.toDate() : new Date(data.receivedAt), 'MMM dd, yyyy') : 'N/A'}`,
                adjustedBy: data.receivedBy || data.createdBy,
                transferId: data.transferId || doc.id,
                batchesReceived: item.batches,
                createdAt: data.receivedAt?.toDate ? data.receivedAt.toDate() : 
                           data.transferDate?.toDate ? data.transferDate.toDate() :
                           data.createdAt?.toDate ? data.createdAt.toDate() :
                           data.createdAt instanceof Date ? data.createdAt :
                           data.createdAt ? new Date(data.createdAt) : new Date(),
              });
            });
          }
        });
      } catch (error) {
        console.error('Error loading stock transfers:', error);
      }

      // Sort all adjustments by date (newest first)
      allAdjustments.sort((a, b) => b.createdAt - a.createdAt);

      // Get product names for each adjustment
      const adjustmentsWithProducts = allAdjustments.map((adj) => {
        const product = products.find(p => p.id === adj.productId);
        return {
          ...adj,
          productName: product?.name || 'Unknown Product',
          productSku: product?.sku || product?.upc || 'N/A'
        };
      });

      // Filter by search term if provided
      const filtered = adjustmentSearchTerm
        ? adjustmentsWithProducts.filter(adj =>
            adj.productName.toLowerCase().includes(adjustmentSearchTerm.toLowerCase()) ||
            adj.adjustmentType?.toLowerCase().includes(adjustmentSearchTerm.toLowerCase()) ||
            adj.reason?.toLowerCase().includes(adjustmentSearchTerm.toLowerCase()) ||
            adj.notes?.toLowerCase().includes(adjustmentSearchTerm.toLowerCase())
          )
        : adjustmentsWithProducts;

      setStockAdjustments(filtered);
    } catch (error) {
      console.error('Error loading stock adjustments:', error);
      setStockAdjustments([]);
    } finally {
      setLoadingAdjustments(false);
    }
  };

  // Load adjustments when showing history or filters change
  useEffect(() => {
    if (showAdjustmentsHistory) {
      loadStockAdjustments();
    }
  }, [showAdjustmentsHistory, adjustmentDateFilter, userData?.branchId, products, adjustmentSearchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading stock data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Stock Data</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadData} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Stock Management</h1>
            <p className="text-gray-600">Track inventory levels and stock movements</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button 
              variant="outline"
              className="flex items-center gap-2"
              onClick={async () => {
                if (!userData?.branchId) {
                  alert('Branch ID not found');
                  return;
                }
                
                const now = new Date();
                const currentDate = now.getDate();
                let weekNumber;
                if (currentDate <= 7) {
                  weekNumber = 1;
                } else if (currentDate <= 14) {
                  weekNumber = 2;
                } else if (currentDate <= 21) {
                  weekNumber = 3;
                } else {
                  weekNumber = 4;
                }

                if (confirm(`Record Week ${weekNumber} stock for all products?`)) {
                  try {
                    const userName = userData?.displayName || userData?.name || userData?.email || 'System';
                    const result = await weeklyStockRecorder.recordWeeklyStock(
                      userData.branchId,
                      weekNumber,
                      userData?.uid,
                      userName
                    );
                    
                    if (result.success) {
                      alert(`Successfully recorded Week ${weekNumber} stock for ${result.recorded.length} products!`);
                      await reloadStocks();
                    } else {
                      alert(`Error: ${result.message}`);
                    }
                  } catch (error) {
                    console.error('Error recording weekly stock:', error);
                    alert('Failed to record weekly stock. Please try again.');
                  }
                }
              }}
            >
              <Calendar className="h-4 w-4" />
              Record Week Stock
            </Button>
            {/* Only allow system admins to create stock manually - all other stock must come from Purchase Orders */}
            {(userData?.role === 'systemAdmin' || userData?.role === 'operationalManager') && (
              <Button 
                className="flex items-center gap-2"
                onClick={() => setIsCreateStockModalOpen(true)}
                title="Manual stock creation is restricted. All new stock should come from Purchase Orders."
              >
                <Plus className="h-4 w-4" />
                Create Stock (Admin Only)
              </Button>
            )}
            <Button 
              variant="outline"
              className={`flex items-center gap-2 ${showDeductionHistory ? 'bg-blue-50 border-blue-300' : ''}`}
              onClick={() => {
                setShowDeductionHistory(!showDeductionHistory);
                if (!showDeductionHistory) {
                  loadStockDeductions();
                }
              }}
            >
              <Activity className="h-4 w-4" />
              {showDeductionHistory ? 'Hide' : 'Show'} Deduction History
            </Button>
            <Button 
              variant="outline"
              className={`flex items-center gap-2 ${showAdjustmentsHistory ? 'bg-orange-50 border-orange-300' : ''}`}
              onClick={() => {
                setShowAdjustmentsHistory(!showAdjustmentsHistory);
                if (!showAdjustmentsHistory) {
                  loadStockAdjustments();
                }
              }}
            >
              <AlertTriangle className="h-4 w-4" />
              {showAdjustmentsHistory ? 'Hide' : 'Show'} Adjustments History
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
          <Card className="p-4">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-xl font-bold text-gray-900">{stockStats.totalItems}</p>
                {stockStats.totalItems > stockStats.loadedItems && (
                  <p className="text-xs text-gray-500">({stockStats.loadedItems} loaded)</p>
                )}
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">In Stock</p>
                <p className="text-xl font-bold text-gray-900">{stockStats.inStock}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Low Stock</p>
                <p className="text-xl font-bold text-gray-900">{stockStats.lowStock}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <XCircle className="h-8 w-8 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                <p className="text-xl font-bold text-gray-900">{stockStats.outOfStock}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center">
              <Banknote className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-xl font-bold text-gray-900">₱{stockStats.totalValue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Stock Adjustments History */}
        {showAdjustmentsHistory && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Stock Adjustments History</h2>
                <p className="text-gray-600 text-sm mt-1">View all stock movements: Force Adjustments, Transactions (Sales), and Stock Transfers</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={adjustmentDateFilter}
                  onChange={(e) => setAdjustmentDateFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                >
                  <option value="all">All Time</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="90days">Last 90 Days</option>
                  <option value="1year">Last Year</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadStockAdjustments}
                  disabled={loadingAdjustments}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingAdjustments ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by product name, reason, or notes..."
                  value={adjustmentSearchTerm}
                  onChange={(e) => setAdjustmentSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
            </div>

            {/* Adjustments Table */}
            {loadingAdjustments ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-orange-600" />
                <span className="ml-2 text-gray-600">Loading adjustments history...</span>
              </div>
            ) : stockAdjustments.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No stock adjustments found for the selected period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Previous Stock
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        New Stock
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Adjustment
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Reason / Details
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Adjusted By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stockAdjustments.map((adjustment) => {
                      const typeColors = {
                        'force_adjustment': 'bg-orange-100 text-orange-800 border-orange-200',
                        'transaction': 'bg-blue-100 text-blue-800 border-blue-200',
                        'transfer_out': 'bg-purple-100 text-purple-800 border-purple-200',
                        'transfer_in': 'bg-green-100 text-green-800 border-green-200'
                      };
                      const typeIcons = {
                        'force_adjustment': <AlertTriangle className="h-3 w-3" />,
                        'transaction': <ShoppingCart className="h-3 w-3" />,
                        'transfer_out': <ArrowRight className="h-3 w-3" />,
                        'transfer_in': <ArrowRightLeft className="h-3 w-3" />
                      };
                      
                      return (
                        <tr key={adjustment.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {format(adjustment.createdAt, 'MMM dd, yyyy')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {format(adjustment.createdAt, 'hh:mm a')}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${typeColors[adjustment.type] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                              {typeIcons[adjustment.type]}
                              {adjustment.adjustmentType || 'Adjustment'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">
                              {adjustment.productName}
                            </div>
                            <div className="text-xs text-gray-500">
                              SKU: {adjustment.productSku}
                            </div>
                            {adjustment.batchesUsed && adjustment.batchesUsed.length > 0 && (
                              <div className="text-xs text-blue-600 mt-1">
                                Batches: {adjustment.batchesUsed.map(b => b.batchNumber || b.batchId).slice(0, 2).join(', ')}
                                {adjustment.batchesUsed.length > 2 && ` +${adjustment.batchesUsed.length - 2} more`}
                              </div>
                            )}
                            {adjustment.batchesReceived && adjustment.batchesReceived.length > 0 && (
                              <div className="text-xs text-green-600 mt-1">
                                Received Batches: {adjustment.batchesReceived.map(b => b.batchNumber || b.batchId).slice(0, 2).join(', ')}
                                {adjustment.batchesReceived.length > 2 && ` +${adjustment.batchesReceived.length - 2} more`}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm text-gray-900 font-medium">
                              {adjustment.previousStock !== null && adjustment.previousStock !== undefined ? adjustment.previousStock : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm text-gray-900 font-medium">
                              {adjustment.newStock !== null && adjustment.newStock !== undefined ? adjustment.newStock : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              (adjustment.adjustmentQuantity || 0) >= 0 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {(adjustment.adjustmentQuantity || 0) >= 0 ? '+' : ''}{adjustment.adjustmentQuantity || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900 max-w-xs" title={adjustment.reason || adjustment.notes}>
                              <div className="font-medium">{adjustment.reason || 'N/A'}</div>
                              {adjustment.notes && (
                                <div className="text-xs text-gray-600 mt-1 truncate">{adjustment.notes}</div>
                              )}
                              {adjustment.transferId && (
                                <div className="text-xs text-gray-500 mt-1">ID: {adjustment.transferId.slice(-8)}</div>
                              )}
                              {adjustment.transactionId && (
                                <div className="text-xs text-gray-500 mt-1">Txn: {adjustment.transactionId.slice(-8)}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-600">
                              {adjustment.adjustedBy || 'Unknown'}
                            </div>
                            {adjustment.managerCode && (
                              <div className="text-xs text-gray-500">
                                Code: {adjustment.managerCode}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* Stock Deduction History */}
        {showDeductionHistory && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Stock Deduction History</h2>
                <p className="text-gray-600 text-sm mt-1">View all stock deductions from transactions</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={deductionDateFilter}
                  onChange={(e) => setDeductionDateFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="all">All Time</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="90days">Last 90 Days</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadStockDeductions}
                  disabled={loadingDeductions}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingDeductions ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by product name, client name, or transaction ID..."
                  value={deductionSearchTerm}
                  onChange={(e) => setDeductionSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
            </div>

            {/* Deductions Table */}
            {loadingDeductions ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading deduction history...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Transaction ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Processed By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stockDeductions
                      .filter(deduction => {
                        if (!deductionSearchTerm) return true;
                        const search = deductionSearchTerm.toLowerCase();
                        return (
                          deduction.productName?.toLowerCase().includes(search) ||
                          deduction.clientName?.toLowerCase().includes(search) ||
                          deduction.transactionId?.toLowerCase().includes(search)
                        );
                      })
                      .map((deduction) => (
                        <tr key={deduction.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {format(deduction.createdAt, 'MMM dd, yyyy')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {format(deduction.createdAt, 'hh:mm a')}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">
                              {deduction.productName}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              -{deduction.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900">{deduction.clientName}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-600 font-mono">
                              #{deduction.transactionId.slice(-8)}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">
                              ₱{deduction.total.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-600">{deduction.createdBy}</div>
                          </td>
                        </tr>
                      ))}
                    {stockDeductions.filter(deduction => {
                      if (!deductionSearchTerm) return true;
                      const search = deductionSearchTerm.toLowerCase();
                      return (
                        deduction.productName?.toLowerCase().includes(search) ||
                        deduction.clientName?.toLowerCase().includes(search) ||
                        deduction.transactionId?.toLowerCase().includes(search)
                      );
                    }).length === 0 && (
                      <tr>
                        <td colSpan="7" className="px-4 py-12 text-center text-gray-500">
                          <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p>No stock deductions found</p>
                          {deductionSearchTerm && (
                            <p className="text-sm mt-1">Try adjusting your search</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            {!loadingDeductions && stockDeductions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    Total Deductions: <span className="font-semibold text-gray-900">{stockDeductions.length}</span>
                  </span>
                  <span className="text-gray-600">
                    Total Quantity Deducted: <span className="font-semibold text-red-600">
                      -{stockDeductions.reduce((sum, d) => sum + d.quantity, 0)}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Search and Filters */}
        <Card className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                placeholder="Search by product name, brand, or UPC... (debounced for performance)"
                value={searchTerm}
                onChange={setSearchTerm}
                className="w-full"
              />
              {searchTerm !== debouncedSearchTerm && (
                <p className="text-xs text-gray-500 mt-1">Searching...</p>
              )}
            </div>
            <div className="flex gap-2 md:gap-3 flex-wrap">
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="In Stock">In Stock</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
              <select
                value={filters.usageType}
                onChange={(e) => setFilters(prev => ({ ...prev, usageType: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Usage Types</option>
                <option value="otc">OTC Only</option>
                <option value="salon-use">Salon Use Only</option>
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
                onClick={handleExportStocks}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export Excel
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFilters({
                    status: 'all',
                    category: 'all',
                    stockRange: { min: '', max: '' },
                    lowStock: false,
                    usageType: 'all'
                  });
                  setSearchTerm('');
                  reloadStocks();
                }}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </Card>

        {/* Stock Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <div className="inline-block min-w-full align-middle md:px-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product / Batch
                    </th>
                    <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Beginning
                    </th>
                    <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current
                    </th>
                    <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Status
                    </th>
                    <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {visibleStocks.map((stockData) => {
                  const stock = stockData;
                  const product = stockData.product;
                  const currentStock = stock.realTimeStock || stock.weekFourStock || stock.beginningStock || 0;
                  const productName = stock.productName || product?.name || 'Unknown Product';
                  const brand = stock.brand || product?.brand || '';
                  const upc = stock.upc || product?.upc || '';
                  const category = stock.category || product?.category || '';
                  const monthLabel = stock.startPeriod ? format(new Date(stock.startPeriod), 'MMMM yyyy') : 'Unknown';
                  
                  // Check if this is a batch_stock
                  const isBatchStock = stock.stockType === 'batch' || stock.batchId || stock.batchNumber;
                  const batchNumber = stock.batchNumber || 'N/A';
                  const batchId = stock.batchId || null;
                  
                  return (
                  <tr key={stock.id || `${stock.productId}-${stock.startPeriod}-${batchId}`} className={`hover:bg-gray-50 ${isBatchStock ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-sm font-medium text-gray-900">{productName}</div>
                          {isBatchStock && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                              Batch: {batchNumber}
                            </span>
                          )}
                          {/* Usage Type Badge - Always show for batch stocks */}
                          {isBatchStock && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              (stock.usageType || 'otc') === 'salon-use'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-green-100 text-green-800 border border-green-200'
                            }`}>
                              {(stock.usageType || 'otc') === 'salon-use' ? 'Salon Use' : 'OTC'}
                            </span>
                          )}
                          {/* Usage Type Badge for non-batch stocks */}
                          {!isBatchStock && stock.usageType && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              stock.usageType === 'salon-use'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-green-100 text-green-800 border border-green-200'
                            }`}>
                              {stock.usageType === 'salon-use' ? 'Salon Use' : 'OTC'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs md:text-sm text-gray-500">{brand} • {upc}</div>
                        <div className="text-xs text-gray-400 hidden md:block">
                          {category}
                          {isBatchStock && stock.expirationDate && (
                            <span className="ml-2 text-orange-600">
                              • Expires: {format(new Date(stock.expirationDate), 'MMM dd, yyyy')}
                            </span>
                          )}
                        </div>
                        {isBatchStock && stock.receivedDate && (
                          <div className="text-xs text-gray-400 hidden md:block">
                            Received: {format(new Date(stock.receivedDate), 'MMM dd, yyyy')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                      <div className="text-sm font-medium text-blue-900">{stock.beginningStock || 0}</div>
                      <div className="text-xs text-blue-600">Beginning</div>
                    </td>
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{currentStock}</div>
                      <div className="text-xs text-gray-500">{monthLabel}</div>
                    </td>
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(stock.status || 'In Stock')}`}>
                        {getStatusIcon(stock.status || 'In Stock')}
                        {stock.status || 'In Stock'}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(stock)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewHistory(stock)}
                          className="flex items-center gap-1"
                        >
                          <Calendar className="h-3 w-3" />
                          History
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleForceAdjustStock(stock)}
                          className="flex items-center gap-1 border-orange-300 text-orange-600 hover:bg-orange-50"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Force Adjust
                        </Button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
          
          {/* Pagination Controls */}
          <div className="px-6 py-4 bg-gray-50 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Pagination Info */}
            <div className="text-sm text-gray-600">
              Showing <span className="font-medium">{visibleStartIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(visibleEndIndex, filteredStocks.length)}</span> of{' '}
              <span className="font-medium">{filteredStocks.length}</span> filtered items
              {stockStats.totalItems > stockStats.loadedItems && (
                <span className="ml-2 text-blue-600">
                  ({stockStats.loadedItems} loaded, {totalItems} total in database)
                </span>
              )}
            </div>

            {/* Page Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newStart = Math.max(0, visibleStartIndex - 50);
                  setVisibleStartIndex(newStart);
                  setVisibleEndIndex(newStart + 50);
                }}
                disabled={visibleStartIndex === 0}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <span className="text-sm text-gray-600 px-3 min-w-[120px] text-center">
                Page {currentPageNumber} of {totalPages || 1}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newStart = Math.min(filteredStocks.length - 50, visibleStartIndex + 50);
                  setVisibleStartIndex(newStart);
                  setVisibleEndIndex(Math.min(newStart + 50, filteredStocks.length));
                }}
                disabled={visibleEndIndex >= filteredStocks.length}
                className="flex items-center gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Load More from Database Button */}
          {hasMore && filteredStocks.length > 0 && !loadingMore && (
            <div className="px-6 py-3 bg-blue-50 border-t flex justify-center">
              <Button
                variant="outline"
                onClick={loadMoreStocks}
                disabled={loadingMore}
                className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                <Package className="h-4 w-4" />
                Load More from Database ({totalItems - stocks.length} remaining)
              </Button>
            </div>
          )}
          
          {/* Loading More from Database Indicator */}
          {loadingMore && (
            <div className="px-6 py-3 bg-blue-50 border-t flex justify-center">
              <div className="flex items-center gap-2 text-blue-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Loading more items from database...</span>
              </div>
            </div>
          )}

          {/* Load More Visible Items (Virtual Scroll) */}
          {visibleEndIndex < filteredStocks.length && !loadingMore && (
            <div className="px-6 py-3 bg-gray-50 border-t flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMoreVisible}
                className="flex items-center gap-2"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Show More ({filteredStocks.length - visibleEndIndex} more items)
              </Button>
            </div>
          )}
        </Card>

        {/* Empty State */}
        {filteredStocks.length === 0 && !loading && (
          <Card className="p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Stock Items Found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || Object.values(filters).some(f => f !== 'all' && f !== '')
                ? 'Try adjusting your search or filters'
                : 'Get started by adding stock items'
              }
            </p>
            {(userData?.role === 'systemAdmin' || userData?.role === 'operationalManager') ? (
              <Button 
                className="flex items-center gap-2 mx-auto"
                onClick={() => setIsCreateStockModalOpen(true)}
                title="Manual stock creation is restricted. All new stock should come from Purchase Orders."
              >
                <Plus className="h-4 w-4" />
                Add Stock Item (Admin Only)
              </Button>
            ) : (
              <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  Stock must be created through Purchase Orders to maintain proper batch tracking.
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Stock Details Modal */}
        {isDetailsModalOpen && selectedStock && (
          <Modal
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false);
              setSelectedStock(null);
            }}
            title="Stock Details"
            size="lg"
          >
            <div className="space-y-6">
              {/* Stock Header */}
              <div className="flex gap-6">
                <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Package className="h-16 w-16 text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-900">
                        {selectedStock.productName || selectedStock.product?.name || 'Unknown Product'}
                      </h2>
                      {(selectedStock.stockType === 'batch' || selectedStock.batchId || selectedStock.batchNumber) && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                            Batch: {selectedStock.batchNumber || 'N/A'}
                          </span>
                          {selectedStock.purchaseOrderId && (
                            <span className="text-xs text-gray-500">
                              PO: {selectedStock.purchaseOrderId}
                            </span>
                          )}
                          {/* Usage Type Badge */}
                          {selectedStock.usageType && (
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                              selectedStock.usageType === 'salon-use'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-green-100 text-green-800 border border-green-200'
                            }`}>
                              {selectedStock.usageType === 'salon-use' ? 'Salon Use' : 'OTC'}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Show usage type even for non-batch stocks */}
                      {(!selectedStock.stockType || selectedStock.stockType !== 'batch') && selectedStock.usageType && (
                        <div className="mt-2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                            selectedStock.usageType === 'salon-use'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-green-100 text-green-800 border border-green-200'
                          }`}>
                            {selectedStock.usageType === 'salon-use' ? 'Salon Use' : 'OTC'}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedStock.status || 'In Stock')}`}>
                      {getStatusIcon(selectedStock.status || 'In Stock')}
                      {selectedStock.status || 'In Stock'}
                    </span>
                  </div>
                  <p className="text-lg text-gray-600 mb-2">
                    {selectedStock.brand || selectedStock.product?.brand || ''}
                  </p>
                  <p className="text-sm text-gray-500">
                    UPC: {selectedStock.upc || selectedStock.product?.upc || 'N/A'}
                  </p>
                  {(selectedStock.stockType === 'batch' || selectedStock.batchId) && selectedStock.expirationDate && (
                    <p className="text-sm text-orange-600 mt-1 font-medium">
                      Expiration: {format(new Date(selectedStock.expirationDate), 'MMM dd, yyyy')}
                    </p>
                  )}
                  {(selectedStock.stockType === 'batch' || selectedStock.batchId) && selectedStock.receivedDate && (
                    <p className="text-sm text-gray-500 mt-1">
                      Received: {format(new Date(selectedStock.receivedDate), 'MMM dd, yyyy')}
                    </p>
                  )}
                  <p className="text-sm text-blue-600 mt-2 font-medium">
                    {selectedStock.startPeriod ? format(new Date(selectedStock.startPeriod), 'MMMM yyyy') : 'No period set'}
                  </p>
                </div>
              </div>

              {/* Monthly Stock Information */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3">Monthly Stock Record</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-medium text-blue-700">Beginning Stock</label>
                    <p className="text-lg font-bold text-blue-900">{selectedStock.beginningStock || 0} units</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-blue-700">Week 1 Stock</label>
                    <p className="text-lg font-bold text-blue-900">{selectedStock.weekOneStock || 0} units</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-blue-700">Week 2 Stock</label>
                    <p className="text-lg font-bold text-blue-900">{selectedStock.weekTwoStock || 0} units</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-blue-700">Week 3 Stock</label>
                    <p className="text-lg font-bold text-blue-900">{selectedStock.weekThreeStock || 0} units</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-blue-700">Week 4 Stock</label>
                    <p className="text-lg font-bold text-blue-900">{selectedStock.weekFourStock || 0} units</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-blue-700">Real-time Stock</label>
                    <p className="text-lg font-bold text-green-600">{selectedStock.realTimeStock || 0} units</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-blue-700">Period</label>
                    <p className="text-sm text-blue-900">
                      {selectedStock.startPeriod ? format(new Date(selectedStock.startPeriod), 'MMM dd, yyyy') : 'N/A'} - 
                      {selectedStock.endPeriod ? format(new Date(selectedStock.endPeriod), ' MMM dd, yyyy') : ' N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Ending Stock Calculation */}
              {selectedStock.startPeriod && selectedStock.endPeriod && (() => {
                const endingStockInfo = calculateEndingStock(
                  selectedStock.productId,
                  new Date(selectedStock.startPeriod),
                  new Date(selectedStock.endPeriod)
                );
                return (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-900 mb-3">Ending Stock Calculation</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-medium text-green-700">Next Month Beginning</label>
                        <p className="text-lg font-bold text-green-900">{endingStockInfo.endingStock} units</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-green-700">Deliveries This Month</label>
                        <p className="text-lg font-bold text-green-900">{endingStockInfo.deliveries} units</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-green-700">Calculated Ending Stock</label>
                        <p className="text-xl font-bold text-green-600">{endingStockInfo.calculatedEndingStock} units</p>
                        <p className="text-xs text-green-600 mt-1">(Next Month Beginning + Deliveries)</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Stock Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Branch</label>
                    <p className="text-gray-900">{selectedStock.branchName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Location</label>
                    <p className="text-gray-900">{selectedStock.location || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Tracking Mode</label>
                    <p className="text-gray-900 capitalize">{selectedStock.weekTrackingMode || 'Manual'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">End Stock Mode</label>
                    <p className="text-gray-900 capitalize">{selectedStock.endStockMode || 'Manual'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created At</label>
                    <p className="text-gray-900">
                      {selectedStock.createdAt ? format(new Date(selectedStock.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Updated At</label>
                    <p className="text-gray-900">
                      {selectedStock.updatedAt ? format(new Date(selectedStock.updatedAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    handleEditStock(selectedStock);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Weekly Stocks
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Edit Stock Modal */}
        {isEditStockModalOpen && selectedStock && (
          <Modal
            isOpen={isEditStockModalOpen}
            onClose={() => {
              setIsEditStockModalOpen(false);
              setEditStockForm({
                weekOneStock: '',
                weekTwoStock: '',
                weekThreeStock: '',
                weekFourStock: ''
              });
              setEditStockErrors({});
            }}
            title={`Edit Weekly Stocks - ${selectedStock.productName || 'Product'}`}
            size="lg"
          >
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Period:</strong> {selectedStock.startPeriod ? format(new Date(selectedStock.startPeriod), 'MMM dd, yyyy') : 'N/A'} - 
                  {selectedStock.endPeriod ? format(new Date(selectedStock.endPeriod), ' MMM dd, yyyy') : ' N/A'}
                  <br />
                  <strong>Beginning Stock:</strong> {selectedStock.beginningStock || 0} units
                </p>
              </div>

              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-4">Record Weekly Stock Counts</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Record the actual physical count at the end of each week as the month progresses.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Week 1 Stock Count
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Record at end of Week 1"
                      value={editStockForm.weekOneStock}
                      onChange={(e) => {
                        setEditStockForm(prev => ({ ...prev, weekOneStock: e.target.value }));
                        setEditStockErrors(prev => ({ ...prev, weekOneStock: '' }));
                      }}
                      className={editStockErrors.weekOneStock ? 'border-red-500' : ''}
                    />
                    {editStockErrors.weekOneStock && (
                      <p className="text-red-500 text-xs mt-1">{editStockErrors.weekOneStock}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Week 2 Stock Count
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Record at end of Week 2"
                      value={editStockForm.weekTwoStock}
                      onChange={(e) => {
                        setEditStockForm(prev => ({ ...prev, weekTwoStock: e.target.value }));
                        setEditStockErrors(prev => ({ ...prev, weekTwoStock: '' }));
                      }}
                      className={editStockErrors.weekTwoStock ? 'border-red-500' : ''}
                    />
                    {editStockErrors.weekTwoStock && (
                      <p className="text-red-500 text-xs mt-1">{editStockErrors.weekTwoStock}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Week 3 Stock Count
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Record at end of Week 3"
                      value={editStockForm.weekThreeStock}
                      onChange={(e) => {
                        setEditStockForm(prev => ({ ...prev, weekThreeStock: e.target.value }));
                        setEditStockErrors(prev => ({ ...prev, weekThreeStock: '' }));
                      }}
                      className={editStockErrors.weekThreeStock ? 'border-red-500' : ''}
                    />
                    {editStockErrors.weekThreeStock && (
                      <p className="text-red-500 text-xs mt-1">{editStockErrors.weekThreeStock}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Week 4 Stock Count
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Record at end of Week 4"
                      value={editStockForm.weekFourStock}
                      onChange={(e) => {
                        setEditStockForm(prev => ({ ...prev, weekFourStock: e.target.value }));
                        setEditStockErrors(prev => ({ ...prev, weekFourStock: '' }));
                      }}
                      className={editStockErrors.weekFourStock ? 'border-red-500' : ''}
                    />
                    {editStockErrors.weekFourStock && (
                      <p className="text-red-500 text-xs mt-1">{editStockErrors.weekFourStock}</p>
                    )}
                  </div>
                </div>
              </div>

              {editStockErrors.general && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-800 text-sm">{editStockErrors.general}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditStockModalOpen(false);
                    setEditStockForm({
                      weekOneStock: '',
                      weekTwoStock: '',
                      weekThreeStock: '',
                      weekFourStock: ''
                    });
                    setEditStockErrors({});
                  }}
                  disabled={isSubmittingEdit}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    // Validation
                    const errors = {};
                    
                    if (editStockForm.weekOneStock && parseInt(editStockForm.weekOneStock) < 0) {
                      errors.weekOneStock = 'Week 1 stock count must be 0 or greater';
                    }
                    
                    if (editStockForm.weekTwoStock && parseInt(editStockForm.weekTwoStock) < 0) {
                      errors.weekTwoStock = 'Week 2 stock count must be 0 or greater';
                    }
                    
                    if (editStockForm.weekThreeStock && parseInt(editStockForm.weekThreeStock) < 0) {
                      errors.weekThreeStock = 'Week 3 stock count must be 0 or greater';
                    }
                    
                    if (editStockForm.weekFourStock && parseInt(editStockForm.weekFourStock) < 0) {
                      errors.weekFourStock = 'Week 4 stock count must be 0 or greater';
                    }
                    
                    if (Object.keys(errors).length > 0) {
                      setEditStockErrors(errors);
                      return;
                    }
                    
                    try {
                      setIsSubmittingEdit(true);
                      setEditStockErrors({});
                      
                      const stockDocRef = doc(db, 'stocks', selectedStock.id);
                      const updateData = {
                        weekOneStock: editStockForm.weekOneStock ? parseInt(editStockForm.weekOneStock) : 0,
                        weekTwoStock: editStockForm.weekTwoStock ? parseInt(editStockForm.weekTwoStock) : 0,
                        weekThreeStock: editStockForm.weekThreeStock ? parseInt(editStockForm.weekThreeStock) : 0,
                        weekFourStock: editStockForm.weekFourStock ? parseInt(editStockForm.weekFourStock) : 0,
                        endStock: editStockForm.weekFourStock ? parseInt(editStockForm.weekFourStock) : (selectedStock.endStock || 0),
                        updatedAt: serverTimestamp()
                      };
                      
                      await updateDoc(stockDocRef, updateData);
                      
                      // Log activity
                      await logActivity(
                        'update',
                        'stock',
                        selectedStock.id,
                        selectedStock.productName || 'Unknown Product',
                        {
                          before: {
                            weekOneStock: selectedStock.weekOneStock || 0,
                            weekTwoStock: selectedStock.weekTwoStock || 0,
                            weekThreeStock: selectedStock.weekThreeStock || 0,
                            weekFourStock: selectedStock.weekFourStock || 0
                          },
                          after: {
                            weekOneStock: parseInt(editStockForm.weekOneStock) || 0,
                            weekTwoStock: parseInt(editStockForm.weekTwoStock) || 0,
                            weekThreeStock: parseInt(editStockForm.weekThreeStock) || 0,
                            weekFourStock: parseInt(editStockForm.weekFourStock) || 0
                          }
                        },
                        'Weekly stock update',
                        `Updated weekly stock counts for ${selectedStock.productName || 'product'}`
                      );
                      
                      setIsEditStockModalOpen(false);
                      setIsDetailsModalOpen(false);
                      setSelectedStock(null);
                      
                      // Reload data
                      await reloadStocks();
                      
                      alert('Weekly stocks updated successfully!');
                    } catch (error) {
                      console.error('Error updating stock:', error);
                      setEditStockErrors({ general: 'Failed to update weekly stocks. Please try again.' });
                    } finally {
                      setIsSubmittingEdit(false);
                    }
                  }}
                  disabled={isSubmittingEdit}
                >
                  {isSubmittingEdit ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4 mr-2" />
                      Update Weekly Stocks
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Stock History Modal */}
        {isHistoryModalOpen && selectedProductId && (() => {
          const historyStocks = getStockHistoryForProduct(selectedProductId);
          const selectedProduct = products.find(p => p.id === selectedProductId);
          const selectedStock = stocks.find(s => s.productId === selectedProductId);
          return (
            <Modal
              isOpen={isHistoryModalOpen}
              onClose={() => {
                setIsHistoryModalOpen(false);
                setSelectedProductId(null);
                setActivityLogs([]);
                setHistoryDateFilter('all');
              }}
              title={`Stock History & Activity Logs - ${selectedProduct?.name || 'Unknown Product'}`}
              size="xl"
            >
              <div className="space-y-6">
                {/* Date Filter */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Filter by Date:</label>
                  <select
                    value={historyDateFilter}
                    onChange={(e) => {
                      setHistoryDateFilter(e.target.value);
                      if (e.target.value !== 'custom') {
                        loadActivityLogs(selectedProductId, selectedStock?.id);
                      }
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Time</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                    <option value="90days">Last 90 Days</option>
                    <option value="1year">Last Year</option>
                    <option value="custom">Custom Range</option>
                  </select>
                  {historyDateFilter === 'custom' && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="px-3 py-2"
                      />
                      <span className="text-gray-500">to</span>
                      <Input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="px-3 py-2"
                      />
                      <Button
                        size="sm"
                        onClick={() => loadActivityLogs(selectedProductId, selectedStock?.id)}
                        className="flex items-center gap-2"
                      >
                        <Search className="h-4 w-4" />
                        Apply
                      </Button>
                    </div>
                  )}
                </div>

                {/* Stock History Table */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Monthly Stock Records</h3>
                  {historyStocks.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">No stock history found for this product</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beginning</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Real-time</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ending Stock</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {historyStocks.map((stock) => {
                            const endingStockValue = stock.endingStockInfo?.calculatedEndingStock || stock.realTimeStock || 0;
                            return (
                              <tr key={stock.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">{stock.monthLabel}</div>
                                  <div className="text-xs text-gray-500">
                                    {stock.startPeriod ? format(new Date(stock.startPeriod), 'MMM dd') : ''} - 
                                    {stock.endPeriod ? format(new Date(stock.endPeriod), ' MMM dd') : ''}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stock.beginningStock || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">{stock.realTimeStock || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="text-sm font-bold text-green-600">{endingStockValue}</div>
                                  {stock.endingStockInfo && (
                                    <div className="text-xs text-gray-500">
                                      Next: {stock.endingStockInfo.endingStock} + Del: {stock.endingStockInfo.deliveries}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Activity Logs */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Activity Logs & Adjustments</h3>
                  {loadingActivityLogs ? (
                    <div className="text-center py-8">
                      <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                      <p className="text-gray-600">Loading activity logs...</p>
                    </div>
                  ) : activityLogs.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <Activity className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">No activity logs found for this period</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {activityLogs.map((log) => {
                        const actionColors = {
                          create: 'bg-green-100 text-green-800',
                          update: 'bg-blue-100 text-blue-800',
                          adjust: 'bg-orange-100 text-orange-800',
                          delete: 'bg-red-100 text-red-800'
                        };
                        const actionIcons = {
                          create: <Plus className="h-4 w-4" />,
                          update: <Edit className="h-4 w-4" />,
                          adjust: <AlertTriangle className="h-4 w-4" />,
                          delete: <XCircle className="h-4 w-4" />
                        };
                        return (
                          <Card key={log.id} className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${actionColors[log.action] || 'bg-gray-100 text-gray-800'}`}>
                                    {actionIcons[log.action]}
                                    {log.action.toUpperCase()}
                                  </span>
                                  <span className="text-sm text-gray-600">
                                    {format(log.timestamp || log.createdAt, 'MMM dd, yyyy HH:mm')}
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-gray-900 mb-1">{log.entityName}</p>
                                {log.reason && (
                                  <p className="text-sm text-gray-700 mb-2">
                                    <span className="font-medium">Reason:</span> {log.reason}
                                  </p>
                                )}
                                {log.notes && (
                                  <p className="text-sm text-gray-600 mb-2">{log.notes}</p>
                                )}
                                {log.changes && Object.keys(log.changes).length > 0 && (
                                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                                    {log.changes.before && log.changes.after && (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-red-600">Before:</span>
                                          <span>{JSON.stringify(log.changes.before, null, 2)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-green-600">After:</span>
                                          <span>{JSON.stringify(log.changes.after, null, 2)}</span>
                                        </div>
                                      </div>
                                    )}
                                    {log.changes.adjustmentQuantity && (
                                      <div className="text-orange-600">
                                        Adjustment: {log.changes.adjustmentQuantity} units
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                                  <span>By: {log.userName} ({log.userRole})</span>
                                  <span>•</span>
                                  <span>Branch: {log.branchName}</span>
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Modal>
          );
        })()}

        {/* Create Stock Modal - Fullscreen */}
        {isCreateStockModalOpen && (
          <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4">
                <h2 className="text-2xl font-bold text-gray-900">Create Stock Record</h2>
                {(userData?.role === 'systemAdmin' || userData?.role === 'operationalManager') && (
                  <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>Admin Only:</strong> Manual stock creation should only be used for initial setup or adjustments. 
                      All new stock should normally come from Purchase Orders to maintain proper batch tracking and audit trails.
                    </p>
                  </div>
                )}
                <button
                  onClick={() => {
                    setIsCreateStockModalOpen(false);
                    setCreateStockForm({
                      productId: '',
                      beginningStock: '',
                      startPeriod: '',
                      endPeriod: '',
                      weekOneStock: '',
                      weekTwoStock: '',
                      weekThreeStock: '',
                      weekFourStock: ''
                    });
                    setCreateStockErrors({});
                    setProductSearchTerm('');
                    setSelectedProduct(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
              <div className="space-y-8">
                {/* Product Selection - Big Data Friendly */}
                <div>
                  <label className="block text-base font-semibold text-gray-900 mb-3">
                    Product <span className="text-red-500">*</span>
                  </label>
                  
                  {!createStockForm.productId ? (
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsProductPickerOpen(true)}
                        className="w-full py-3 text-left justify-start border-2 border-dashed border-gray-300 hover:border-blue-500"
                      >
                        <Package className="h-5 w-5 mr-2" />
                        Click to select a product
                      </Button>
                      {createStockErrors.productId && (
                        <p className="text-red-500 text-sm mt-2">{createStockErrors.productId}</p>
                      )}
                    </div>
                  ) : (
                    <Card className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Package className="h-6 w-6 text-gray-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{selectedProduct?.name || 'Selected Product'}</p>
                            <p className="text-sm text-gray-500">{selectedProduct?.brand || ''} • {selectedProduct?.category || ''}</p>
                            {selectedProduct?.upc && (
                              <p className="text-xs text-gray-400">UPC: {selectedProduct.upc}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCreateStockForm(prev => ({ ...prev, productId: '' }));
                            setSelectedProduct(null);
                          }}
                        >
                          Change
                        </Button>
                      </div>
                    </Card>
                  )}
                </div>

                {/* Product Picker Modal */}
                {isProductPickerOpen && (
                  <div className="fixed inset-0 z-[60] bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                      {/* Picker Header */}
                      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                        <h3 className="text-lg font-semibold text-gray-900">Select Product</h3>
                        <button
                          onClick={() => {
                            setIsProductPickerOpen(false);
                            setProductSearchTerm('');
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <XCircle className="h-6 w-6" />
                        </button>
                      </div>
                      
                      {/* Search Bar */}
                      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <SearchInput
                          placeholder="Search by product name, brand, category, or UPC... (Type to filter thousands of products)"
                          value={productSearchTerm}
                          onChange={setProductSearchTerm}
                          className="w-full"
                          autoFocus
                        />
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-gray-500">
                            {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} found
                            {hasMoreProducts && ` (Showing first 100, use search to narrow down)`}
                          </p>
                          {productSearchTerm && (
                            <button
                              onClick={() => setProductSearchTerm('')}
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              Clear search
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Products List - Scrollable with Virtualization */}
                      <div className="flex-1 overflow-y-auto px-6 py-4">
                        {displayedProducts.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {displayedProducts.map(product => (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setCreateStockForm(prev => ({ 
                                    ...prev, 
                                    productId: product.id 
                                  }));
                                  setCreateStockErrors(prev => ({ ...prev, productId: '' }));
                                  setIsProductPickerOpen(false);
                                  setProductSearchTerm('');
                                }}
                                className={`text-left p-4 border-2 rounded-lg hover:border-blue-500 transition-colors ${
                                  createStockForm.productId === product.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    {product.imageUrl ? (
                                      <img
                                        src={product.imageUrl}
                                        alt={product.name}
                                        className="w-full h-full object-cover rounded-lg"
                                      />
                                    ) : (
                                      <Package className="h-6 w-6 text-gray-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 truncate">{product.name}</p>
                                    <p className="text-sm text-gray-600 truncate">{product.brand}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {product.category} {product.upc && `• ${product.upc}`}
                                    </p>
                                    {product.status && (
                                      <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs ${
                                        product.status === 'Active' ? 'bg-green-100 text-green-700' :
                                        product.status === 'Inactive' ? 'bg-gray-100 text-gray-700' :
                                        'bg-red-100 text-red-700'
                                      }`}>
                                        {product.status}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">No products found</p>
                            <p className="text-sm text-gray-500 mt-2">
                              {productSearchTerm 
                                ? 'Try adjusting your search term' 
                                : 'No products available'}
                            </p>
                          </div>
                        )}
                        
                        {/* Load More Products Indicator */}
                        {hasMoreProducts && displayedProducts.length > 0 && (
                          <div className="mt-4 text-center">
                            <p className="text-sm text-gray-500">
                              Showing 100 of {filteredProducts.length} products. 
                              {productSearchTerm ? ' Refine your search to see more.' : ' Use search to find specific products.'}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {/* Picker Footer */}
                      <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsProductPickerOpen(false);
                            setProductSearchTerm('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Period Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Period <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={createStockForm.startPeriod}
                    onChange={(e) => {
                      setCreateStockForm(prev => ({ ...prev, startPeriod: e.target.value }));
                      setCreateStockErrors(prev => ({ ...prev, startPeriod: '' }));
                    }}
                    className={createStockErrors.startPeriod ? 'border-red-500' : ''}
                  />
                  <p className="text-xs text-gray-500 mt-1">Usually the 1st of the month</p>
                  {createStockErrors.startPeriod && (
                    <p className="text-red-500 text-xs mt-1">{createStockErrors.startPeriod}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Period <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={createStockForm.endPeriod}
                    onChange={(e) => {
                      setCreateStockForm(prev => ({ ...prev, endPeriod: e.target.value }));
                      setCreateStockErrors(prev => ({ ...prev, endPeriod: '' }));
                    }}
                    className={createStockErrors.endPeriod ? 'border-red-500' : ''}
                  />
                  <p className="text-xs text-gray-500 mt-1">Usually the last day of the month</p>
                  {createStockErrors.endPeriod && (
                    <p className="text-red-500 text-xs mt-1">{createStockErrors.endPeriod}</p>
                  )}
                </div>
              </div>

                {/* Beginning Stock */}
                <div>
                  <label className="block text-base font-semibold text-gray-900 mb-3">
                    Beginning Stock <span className="text-red-500">*</span>
                  </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Enter beginning stock quantity"
                  value={createStockForm.beginningStock}
                  onChange={(e) => {
                    setCreateStockForm(prev => ({ ...prev, beginningStock: e.target.value }));
                    setCreateStockErrors(prev => ({ ...prev, beginningStock: '' }));
                  }}
                  className={createStockErrors.beginningStock ? 'border-red-500' : ''}
                />
                <p className="text-xs text-gray-500 mt-1">Physical count at the start of the month (1st day)</p>
                {createStockErrors.beginningStock && (
                  <p className="text-red-500 text-xs mt-1">{createStockErrors.beginningStock}</p>
                )}
              </div>

                {/* Weekly Stocks - Optional (Edit Later) */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="text-base font-semibold text-gray-900 mb-2">Weekly Stock Recording</h4>
                  <p className="text-sm text-yellow-800 mb-3">
                    <strong>Note:</strong> Weekly stocks are optional when creating a new record. 
                    You can edit this record later to record Week 1, Week 2, Week 3, and Week 4 counts as the month progresses.
                    <br />
                    <span className="text-xs">• Create record with beginning stock only</span>
                    <br />
                    <span className="text-xs">• Edit weekly as you record actual counts at end of each week</span>
                  </p>
                </div>


                {/* Real-time Stock - Auto Calculated */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <label className="block text-base font-semibold text-gray-900 mb-2">
                    Real-time Stock (Auto-Calculated)
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-white border border-green-300 rounded-lg p-3">
                      <p className="text-xs font-medium text-green-700 mb-1">Calculated Stock</p>
                      <p className="text-2xl font-bold text-green-900">
                        {createStockForm.beginningStock || '0'} units
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        = Beginning Stock ({createStockForm.beginningStock || 0})
                        <br />
                        - Sales + Force Adjustments
                        <br />
                        <span className="text-green-500">(damaged, expired, corrections)</span>
                      </p>
                    </div>
                    <div className="text-green-600">
                      <CheckCircle className="h-8 w-8" />
                    </div>
                  </div>
                  <p className="text-xs text-green-700 mt-2">
                    <strong>Auto-calculated:</strong> Real-time stock = Beginning Stock - Sales + Force Adjustments.
                    <br />
                    It updates automatically when products are sold (from transactions) or when force adjustments are made (damaged goods, expired items, etc.).
                  </p>
                </div>

                {/* Stock Summary */}
                {createStockForm.beginningStock && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h4 className="text-base font-semibold text-blue-900 mb-4">Stock Summary</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-blue-700">Beginning:</span>
                        <span className="font-semibold text-blue-900 ml-2">{createStockForm.beginningStock || 0} units</span>
                      </div>
                      <div>
                        <span className="text-blue-700">Week 4 (Record Later):</span>
                        <span className="font-semibold text-blue-900 ml-2">{createStockForm.weekFourStock || 'Not recorded'} {createStockForm.weekFourStock ? 'units' : ''}</span>
                      </div>
                      <div>
                        <span className="text-blue-700">Real-time (Auto):</span>
                        <span className="font-semibold text-blue-900 ml-2">{createStockForm.beginningStock || 0} units</span>
                        <span className="text-xs text-blue-600 ml-1">(updates from sales/adjustments)</span>
                      </div>
                    </div>
                  </div>
                )}

              {/* Error Message */}
              {Object.keys(createStockErrors).length > 0 && createStockErrors.general && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-800 text-sm">{createStockErrors.general}</p>
                </div>
              )}

                {/* Action Buttons - Sticky Footer */}
                <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 mt-8">
                  <div className="max-w-7xl mx-auto flex justify-end gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsCreateStockModalOpen(false);
                        setCreateStockForm({
                          productId: '',
                          beginningStock: '',
                          startPeriod: '',
                          endPeriod: '',
                          weekOneStock: '',
                          weekTwoStock: '',
                          weekThreeStock: '',
                          weekFourStock: ''
                        });
                        setCreateStockErrors({});
                        setProductSearchTerm('');
                        setSelectedProduct(null);
                      }}
                      disabled={isSubmitting}
                      size="lg"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={async () => {
                        // Check if user is authorized
                        if (userData?.role !== 'systemAdmin' && userData?.role !== 'operationalManager') {
                          alert('Unauthorized: Only system administrators and operational managers can create stock manually. All new stock must come from Purchase Orders.');
                          return;
                        }

                        // Validation
                        const errors = {};
                        
                        if (!createStockForm.productId) {
                          errors.productId = 'Please select a product';
                        }
                        
                        if (!createStockForm.startPeriod) {
                          errors.startPeriod = 'Start period is required';
                        }
                        
                        if (!createStockForm.endPeriod) {
                          errors.endPeriod = 'End period is required';
                        }
                        
                        if (createStockForm.startPeriod && createStockForm.endPeriod) {
                          if (new Date(createStockForm.endPeriod) <= new Date(createStockForm.startPeriod)) {
                            errors.endPeriod = 'End period must be after start period';
                          }
                        }
                        
                        if (!createStockForm.beginningStock || parseInt(createStockForm.beginningStock) < 0) {
                          errors.beginningStock = 'Beginning stock must be 0 or greater';
                        }
                        
                        // Weekly stocks are optional on create - can be filled in later via edit
                        // Only validate if values are provided
                        if (createStockForm.weekOneStock && parseInt(createStockForm.weekOneStock) < 0) {
                          errors.weekOneStock = 'Week 1 stock count must be 0 or greater';
                        }
                        
                        if (createStockForm.weekTwoStock && parseInt(createStockForm.weekTwoStock) < 0) {
                          errors.weekTwoStock = 'Week 2 stock count must be 0 or greater';
                        }
                        
                        if (createStockForm.weekThreeStock && parseInt(createStockForm.weekThreeStock) < 0) {
                          errors.weekThreeStock = 'Week 3 stock count must be 0 or greater';
                        }
                        
                        if (createStockForm.weekFourStock && parseInt(createStockForm.weekFourStock) < 0) {
                          errors.weekFourStock = 'Week 4 stock count must be 0 or greater';
                        }
                        
                        if (Object.keys(errors).length > 0) {
                          setCreateStockErrors(errors);
                          return;
                        }
                        
                        // Submit
                        try {
                          setIsSubmitting(true);
                          setCreateStockErrors({});
                          
                          const selectedProductData = selectedProduct || products.find(p => p.id === createStockForm.productId);
                      const beginningStock = parseInt(createStockForm.beginningStock);
                      
                      // Weekly stocks are optional on create - will be filled in via edit later
                      // Use 0 or empty if not provided
                      const weekOneStock = createStockForm.weekOneStock ? parseInt(createStockForm.weekOneStock) : 0;
                      const weekTwoStock = createStockForm.weekTwoStock ? parseInt(createStockForm.weekTwoStock) : 0;
                      const weekThreeStock = createStockForm.weekThreeStock ? parseInt(createStockForm.weekThreeStock) : 0;
                      const weekFourStock = createStockForm.weekFourStock ? parseInt(createStockForm.weekFourStock) : 0;
                      
                      // End stock is the recorded Week 4 count (or 0 if not recorded yet)
                      const endStock = weekFourStock || 0;
                      
                      // Real-time stock is automatically calculated from:
                      // beginningStock + adjustments (from stockAdjustments) - sales (from product_transactions)
                      // When creating new record, it starts equal to beginningStock
                      // It will be recalculated automatically when adjustments/sales occur
                      const realTimeStock = beginningStock;
                      
                      const stockData = {
                        productId: createStockForm.productId,
                        productName: selectedProductData?.name || 'Unknown',
                        branchId: userData?.branchId,
                        beginningStock: beginningStock,
                        startPeriod: createStockForm.startPeriod,
                        weekTrackingMode: 'manual', // Manual recording of weekly counts
                        weekOneStock: weekOneStock,
                        weekTwoStock: weekTwoStock,
                        weekThreeStock: weekThreeStock,
                        weekFourStock: weekFourStock,
                        endPeriod: createStockForm.endPeriod,
                        endStockMode: 'auto', // Always automatic
                        endStock: endStock,
                        realTimeStock: realTimeStock, // Auto-calculated: beginningStock + adjustments - sales
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        createdBy: userData?.uid,
                        status: 'active'
                      };
                      
                      const stockDocRef = await addDoc(collection(db, 'stocks'), stockData);
                      
                      // Log activity
                      await logActivity(
                        'create',
                        'stock',
                        stockDocRef.id,
                        selectedProductData?.name || 'Unknown Product',
                        {
                          beginningStock,
                          startPeriod: createStockForm.startPeriod,
                          endPeriod: createStockForm.endPeriod,
                          weekOneStock,
                          weekTwoStock,
                          weekThreeStock,
                          weekFourStock,
                          endStock
                        },
                        'Stock record creation',
                        `Created new stock record for ${selectedProductData?.name || 'product'}`
                      );
                      
                      // Reset form and close modal
                      setCreateStockForm({
                        productId: '',
                        beginningStock: '',
                        startPeriod: '',
                        endPeriod: '',
                        weekOneStock: '',
                        weekTwoStock: '',
                        weekThreeStock: '',
                        weekFourStock: ''
                      });
                      setProductSearchTerm('');
                      setSelectedProduct(null);
                      setIsCreateStockModalOpen(false);
                      
                      // Reload data
                      await reloadStocks();
                      
                      alert('Stock record created successfully!');
                    } catch (error) {
                      console.error('Error creating stock:', error);
                      setCreateStockErrors({ general: 'Failed to create stock record. Please try again.' });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting}
                  size="lg"
                  className="flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create Stock
                    </>
                  )}
                </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Force Adjust Stock Modal */}
        {isForceAdjustModalOpen && (
          <Modal
            isOpen={isForceAdjustModalOpen}
            onClose={() => {
              setIsForceAdjustModalOpen(false);
              setForceAdjustForm({
                productId: '',
                stockId: '',
                currentStock: '',
                newStock: '',
                adjustmentQuantity: '',
                reason: '',
                managerCode: '',
                notes: ''
              });
              setForceAdjustErrors({});
            }}
            title="Force Adjust Stock"
            size="lg"
          >
            <div className="space-y-6">
              {/* Current Stock Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Current Stock Information</h4>
                <p className="text-sm text-blue-700">Current Stock: <strong className="text-blue-900">{forceAdjustForm.currentStock}</strong> units</p>
              </div>

              {/* New Stock */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Stock Level <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Enter new stock quantity"
                  value={forceAdjustForm.newStock}
                  onChange={(e) => {
                    const newStock = e.target.value;
                    const adjustment = parseInt(newStock) - parseInt(forceAdjustForm.currentStock || 0);
                    setForceAdjustForm(prev => ({ 
                      ...prev, 
                      newStock: newStock,
                      adjustmentQuantity: isNaN(adjustment) ? '' : adjustment.toString()
                    }));
                    setForceAdjustErrors(prev => ({ ...prev, newStock: '' }));
                  }}
                  className={forceAdjustErrors.newStock ? 'border-red-500' : ''}
                />
                {forceAdjustForm.adjustmentQuantity && (
                  <p className={`text-xs mt-1 font-medium ${
                    parseInt(forceAdjustForm.adjustmentQuantity) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    Adjustment: {parseInt(forceAdjustForm.adjustmentQuantity) >= 0 ? '+' : ''}{forceAdjustForm.adjustmentQuantity} units
                  </p>
                )}
                {forceAdjustErrors.newStock && (
                  <p className="text-red-500 text-xs mt-1">{forceAdjustErrors.newStock}</p>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Adjustment <span className="text-red-500">*</span>
                </label>
                <select
                  value={forceAdjustForm.reason}
                  onChange={(e) => {
                    setForceAdjustForm(prev => ({ ...prev, reason: e.target.value }));
                    setForceAdjustErrors(prev => ({ ...prev, reason: '' }));
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    forceAdjustErrors.reason ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a reason</option>
                  <option value="damage">Damage/Loss</option>
                  <option value="theft">Theft</option>
                  <option value="count_error">Counting Error</option>
                  <option value="restock">Restock/Correction</option>
                  <option value="expiry">Expired Items</option>
                  <option value="system_error">System Error</option>
                  <option value="manual_correction">Manual Correction</option>
                  <option value="other">Other</option>
                </select>
                {forceAdjustErrors.reason && (
                  <p className="text-red-500 text-xs mt-1">{forceAdjustErrors.reason}</p>
                )}
              </div>

              {/* Manager Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Branch Manager Authorization Code <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="password"
                    placeholder="Enter branch manager code"
                    value={forceAdjustForm.managerCode}
                    onChange={(e) => {
                      setForceAdjustForm(prev => ({ ...prev, managerCode: e.target.value }));
                      setForceAdjustErrors(prev => ({ ...prev, managerCode: '' }));
                    }}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      forceAdjustErrors.managerCode ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <ShieldCheck className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Requires branch manager authorization code</p>
                {forceAdjustErrors.managerCode && (
                  <p className="text-red-500 text-xs mt-1">{forceAdjustErrors.managerCode}</p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  rows="3"
                  placeholder="Enter any additional notes or details about this adjustment..."
                  value={forceAdjustForm.notes}
                  onChange={(e) => {
                    setForceAdjustForm(prev => ({ ...prev, notes: e.target.value }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Error Message */}
              {forceAdjustErrors.general && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-800 text-sm">{forceAdjustErrors.general}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsForceAdjustModalOpen(false);
                    setForceAdjustForm({
                      productId: '',
                      stockId: '',
                      currentStock: '',
                      newStock: '',
                      adjustmentQuantity: '',
                      reason: '',
                      managerCode: '',
                      notes: ''
                    });
                    setForceAdjustErrors({});
                  }}
                  disabled={isSubmittingAdjust}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={async () => {
                    // Validation
                    const errors = {};
                    
                    if (!forceAdjustForm.newStock || parseInt(forceAdjustForm.newStock) < 0) {
                      errors.newStock = 'New stock must be 0 or greater';
                    }
                    
                    if (!forceAdjustForm.reason) {
                      errors.reason = 'Reason is required';
                    }
                    
                    if (!forceAdjustForm.managerCode) {
                      errors.managerCode = 'Manager authorization code is required';
                    }
                    
                    if (Object.keys(errors).length > 0) {
                      setForceAdjustErrors(errors);
                      return;
                    }
                    
                    // Verify manager code
                    try {
                      setIsSubmittingAdjust(true);
                      setForceAdjustErrors({});
                      
                      const isValidCode = await verifyManagerCode(forceAdjustForm.managerCode, userData?.branchId);
                      
                      if (!isValidCode) {
                        setForceAdjustErrors({ managerCode: 'Invalid manager authorization code. Please contact branch manager.' });
                        setIsSubmittingAdjust(false);
                        return;
                      }
                      
                      // Get stock document reference
                      const stocksRef = collection(db, 'stocks');
                      const stockDocRef = doc(db, 'stocks', forceAdjustForm.stockId);
                      
                      // Create adjustment record in separate collection
                      const adjustmentData = {
                        stockId: forceAdjustForm.stockId,
                        productId: forceAdjustForm.productId,
                        branchId: userData?.branchId,
                        previousStock: parseInt(forceAdjustForm.currentStock),
                        newStock: parseInt(forceAdjustForm.newStock),
                        adjustmentQuantity: parseInt(forceAdjustForm.adjustmentQuantity),
                        reason: forceAdjustForm.reason,
                        notes: forceAdjustForm.notes || '',
                        adjustedBy: userData?.uid,
                        managerCode: forceAdjustForm.managerCode.substring(0, 4) + '****', // Partially mask for security
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        status: 'completed'
                      };
                      
                      // Save to stockAdjustments collection (separate collection for audit trail)
                      await addDoc(collection(db, 'stockAdjustments'), adjustmentData);
                      
                      // Update the stock record's realTimeStock
                      await updateDoc(stockDocRef, {
                        realTimeStock: parseInt(forceAdjustForm.newStock),
                        updatedAt: serverTimestamp()
                      });
                      
                      // Get product name for logging
                      const stockDoc = await getDoc(stockDocRef);
                      const stockData = stockDoc.data();
                      const productName = stockData?.productName || 'Unknown Product';
                      
                      // Log activity
                      await logActivity(
                        'adjust',
                        'stock',
                        forceAdjustForm.stockId,
                        productName,
                        {
                          before: {
                            realTimeStock: parseInt(forceAdjustForm.currentStock)
                          },
                          after: {
                            realTimeStock: parseInt(forceAdjustForm.newStock)
                          },
                          adjustmentQuantity: parseInt(forceAdjustForm.adjustmentQuantity)
                        },
                        forceAdjustForm.reason,
                        forceAdjustForm.notes || `Stock force adjustment: ${parseInt(forceAdjustForm.currentStock)} → ${parseInt(forceAdjustForm.newStock)}`
                      );
                      
                      // Reset form and close modal
                      setForceAdjustForm({
                        productId: '',
                        stockId: '',
                        currentStock: '',
                        newStock: '',
                        adjustmentQuantity: '',
                        reason: '',
                        managerCode: '',
                        notes: ''
                      });
                      setIsForceAdjustModalOpen(false);
                      
                      // Reload data
                      await reloadStocks();
                      
                      alert('Stock adjusted successfully!');
                    } catch (error) {
                      console.error('Error adjusting stock:', error);
                      setForceAdjustErrors({ general: 'Failed to adjust stock. Please try again.' });
                    } finally {
                      setIsSubmittingAdjust(false);
                    }
                  }}
                  disabled={isSubmittingAdjust}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isSubmittingAdjust ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Force Adjust Stock
                    </>
                  )}
                </Button>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Stock Range</label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    placeholder="Min Stock"
                    value={filters.stockRange.min}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      stockRange: { ...prev.stockRange, min: e.target.value }
                    }))}
                  />
                  <Input
                    type="number"
                    placeholder="Max Stock"
                    value={filters.stockRange.max}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      stockRange: { ...prev.stockRange, max: e.target.value }
                    }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Usage Type</label>
                <select
                  value={filters.usageType}
                  onChange={(e) => setFilters(prev => ({ ...prev, usageType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Usage Types</option>
                  <option value="otc">OTC Only</option>
                  <option value="salon-use">Salon Use Only</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="lowStock"
                  checked={filters.lowStock}
                  onChange={(e) => setFilters(prev => ({ ...prev, lowStock: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="lowStock" className="ml-2 block text-sm text-gray-900">
                  Show only low stock items
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setFilters({
                  branch: 'all',
                  status: 'all',
                  category: 'all',
                  stockRange: { min: '', max: '' },
                  lowStock: false,
                  usageType: 'all'
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

export default Stocks;
