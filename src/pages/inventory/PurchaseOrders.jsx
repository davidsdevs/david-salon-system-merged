import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import InventoryLayout from '../../layouts/InventoryLayout';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  ShoppingCart,
  Search,
  Eye,
  Plus,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Package,
  Building,
  FileText,
  Truck,
  ArrowRight,
  Trash2,
  X,
  Loader2,
  Home,
  TrendingUp,
  ArrowRightLeft,
  QrCode,
  Calendar,
  BarChart3,
  ClipboardList,
  UserCog,
  PackageCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { inventoryService } from '../../services/inventoryService';
import toast from 'react-hot-toast';

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

const PurchaseOrders = () => {
  const { userData } = useAuth();

  

  // Data states
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branchProducts, setBranchProducts] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('all');
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [deliveryExpirationDates, setDeliveryExpirationDates] = useState({}); // { productId: expirationDate }
  const [isMarkingDelivered, setIsMarkingDelivered] = useState(false);
  
  // Big data optimizations
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const debouncedProductSearchTerm = useDebounce(productSearchTerm, 300);
  const [currentProductPage, setCurrentProductPage] = useState(1);
  const productsPerPage = 20; // Pagination for products

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

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [userData?.branchId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!userData?.branchId) {
        setError('Branch ID not found');
        setLoading(false);
        return;
      }

      // Load suppliers
      await loadSuppliers();

      // Load branch products
      await loadBranchProducts();

      // Load purchase orders created by Inventory Controller for this branch
      await loadPurchaseOrders();
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
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

  const loadBranchProducts = async () => {
    try {
      if (!userData?.branchId) return;

      // Only show products available to this Inventory Controller's branch (no branch filtering needed)
      const productsRef = collection(db, 'products');
      const productsSnapshot = await getDocs(productsRef);

      const branchProductsList = [];
      productsSnapshot.forEach((doc) => {
        const productData = doc.data();

        // Only include products available to this branch (automatically filtered)
        const isAvailableToBranch = productData.branches && 
          productData.branches.includes(userData.branchId);

        if (isAvailableToBranch) {
          branchProductsList.push({
            id: doc.id,
            name: productData.name,
            category: productData.category,
            brand: productData.brand,
            unitCost: productData.unitCost || 0,
            suppliers: productData.suppliers || (productData.supplier ? [productData.supplier] : []), // Suppliers array
            supplier: productData.supplier, // Keep for backward compatibility
            imageUrl: productData.imageUrl,
            description: productData.description,
            sku: productData.sku,
            ...productData
          });
        }
      });

      setBranchProducts(branchProductsList);
    } catch (err) {
      console.error('Error loading branch products:', err);
      throw err;
    }
  };

  const loadPurchaseOrders = async () => {
    try {
      if (!userData?.branchId) return;

      // Only show purchase orders for this Inventory Controller's branch (no branch filtering needed)
      const purchaseOrdersRef = collection(db, 'purchaseOrders');
      const q = query(
        purchaseOrdersRef,
        where('branchId', '==', userData.branchId), // Automatically filtered to user's branch only
        where('createdByRole', '==', 'inventoryController')
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

      // Sort by createdAt descending (most recent first)
      ordersList.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      setPurchaseOrders(ordersList);
    } catch (err) {
      console.error('Error loading purchase orders:', err);
      // If query fails due to index, try without createdByRole filter
      try {
        const purchaseOrdersRef = collection(db, 'purchaseOrders');
        const q = query(
          purchaseOrdersRef,
          where('branchId', '==', userData.branchId)
        );
        const snapshot = await getDocs(q);
        const ordersList = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Filter client-side for inventoryController role
          if (data.createdByRole === 'inventoryController') {
            ordersList.push({
              id: doc.id,
              ...data,
              orderDate: data.orderDate?.toDate ? data.orderDate.toDate() : new Date(data.orderDate),
              expectedDelivery: data.expectedDelivery?.toDate ? data.expectedDelivery.toDate() : new Date(data.expectedDelivery),
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date())
            });
          }
        });
        ordersList.sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
        setPurchaseOrders(ordersList);
      } catch (fallbackErr) {
        throw err;
      }
    }
  };

  // When supplier is selected, filter products (suppliers is now an array)
  useEffect(() => {
    if (selectedSupplierId && branchProducts.length > 0) {
      const filtered = branchProducts.filter(product => {
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
  }, [selectedSupplierId, branchProducts]);

  // Filter and paginate products for big data
  const filteredAndPaginatedProducts = useMemo(() => {
    if (!selectedSupplierId || supplierProducts.length === 0) return { products: [], total: 0, totalPages: 0, hasMore: false };
    
    // Filter by search term
    let filtered = supplierProducts;
    if (debouncedProductSearchTerm.trim()) {
      const searchLower = debouncedProductSearchTerm.toLowerCase();
      filtered = supplierProducts.filter(product => 
        product.name?.toLowerCase().includes(searchLower) ||
        product.brand?.toLowerCase().includes(searchLower) ||
        product.category?.toLowerCase().includes(searchLower) ||
        product.sku?.toLowerCase().includes(searchLower)
      );
    }
    
    // Paginate
    const startIndex = (currentProductPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    return {
      products: filtered.slice(startIndex, endIndex),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / productsPerPage),
      hasMore: endIndex < filtered.length
    };
  }, [supplierProducts, debouncedProductSearchTerm, currentProductPage, selectedSupplierId]);

  // Handle supplier selection
  const handleSupplierSelect = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
      setSelectedSupplierId(supplierId);
      setSelectedSupplierName(supplier.name);
      setShowProductSelection(true);
      setOrderItems([]); // Reset items when changing supplier
    }
  };

  // Get total current stock for a product (sum of all batch stocks)
  const getTotalCurrentStock = async (productId) => {
    if (!productId || !userData?.branchId) return 0;
    
    try {
      // Get all batch stocks for this product
      const stocksRef = collection(db, 'stocks');
      const stocksQuery = query(
        stocksRef,
        where('branchId', '==', userData.branchId),
        where('productId', '==', productId),
        where('status', '==', 'active')
      );
      
      const stocksSnapshot = await getDocs(stocksQuery);
      let totalStock = 0;
      
      stocksSnapshot.forEach((doc) => {
        const stockData = doc.data();
        const realTimeStock = stockData.realTimeStock || 0;
        totalStock += realTimeStock;
      });
      
      return totalStock;
    } catch (error) {
      console.error('Error getting total stock:', error);
      return 0;
    }
  };

  // Add product to order with stock validation
  const addProductToOrder = async (product) => {
    // Check current stock before adding
    const currentStock = await getTotalCurrentStock(product.id);
    const REORDER_THRESHOLD = 5; // Only allow ordering if stock is 5 or less
    
    if (currentStock > REORDER_THRESHOLD) {
      toast.error(
        `${product.name} has ${currentStock} units in stock. Only order when stock is ${REORDER_THRESHOLD} or less.`,
        { duration: 4000 }
      );
      
      const confirmOrder = window.confirm(
        `⚠️ Warning: ${product.name} currently has ${currentStock} units in stock.\n\n` +
        `Reorder Policy: You should only order when stock is ${REORDER_THRESHOLD} or less.\n\n` +
        `Do you want to proceed anyway? (Not recommended)`
      );
      
      if (!confirmOrder) {
        return; // User cancelled
      }
      
      toast('Ordering despite high stock level', { icon: '⚠️', duration: 3000 });
    } else if (currentStock > 0 && currentStock <= REORDER_THRESHOLD) {
      toast.success(`${product.name} has ${currentStock} units - Good time to reorder!`, { duration: 3000 });
    } else if (currentStock === 0) {
      toast.error(`${product.name} is out of stock - Order immediately!`, { duration: 4000 });
    }
    
    const existingItem = orderItems.find(item => item.productId === product.id);
    if (existingItem) {
      // Update quantity if already in order
      setOrderItems(prev => prev.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * item.unitPrice }
          : item
      ));
    } else {
      // Add new item - ensure all fields have values (no undefined)
      setOrderItems(prev => [...prev, {
        productId: product.id || '',
        productName: product.name || '',
        quantity: 1,
        unitPrice: product.unitCost || 0,
        totalPrice: product.unitCost || 0,
        category: product.category || null,
        sku: product.sku || null,
        currentStock: currentStock // Store current stock for display
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
            // Ensure all fields are defined
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
    setOrderFormData({
      orderDate: new Date().toISOString().split('T')[0],
      expectedDelivery: '',
      notes: ''
    });
    setIsCreateModalOpen(true);
  };

  // Helper function to remove undefined values from object
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
    if (e) {
      e.preventDefault();
    }
    
    if (!selectedSupplierId) {
      setError('Please select a supplier');
      return;
    }

    if (orderItems.length === 0) {
      setError('Please add at least one product to the order');
      return;
    }

    if (!orderFormData.orderDate) {
      setError('Please select an order date');
      return;
    }

    if (!orderFormData.expectedDelivery) {
      setError('Please select an expected delivery date');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Validate all required fields before creating document
      if (!userData?.branchId) {
        throw new Error('Branch ID is missing. Please refresh the page.');
      }

      // Generate incremental order ID
      const orderId = generateNextPONumber();

      if (!userData?.uid && !userData?.id) {
        throw new Error('User ID is missing. Please refresh the page.');
      }

      // Create purchase order document - ensure no undefined values
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
          // Validate each item - ensure all fields are defined
          const validatedItem = {
            productId: String(item.productId || ''),
            productName: String(item.productName || ''),
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            totalPrice: Number(item.totalPrice) || 0
          };
          
          // Optional fields - only include if they have values
          if (item.category) {
            validatedItem.category = String(item.category);
          }
          if (item.sku) {
            validatedItem.sku = String(item.sku);
          }
          
          return validatedItem;
        }),
        notes: orderFormData.notes ? String(orderFormData.notes) : '',
        createdBy: userData.uid || userData.id,
        createdByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        createdByRole: 'inventoryController', // Changed from 'branchManager' to 'inventoryController'
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Remove any undefined values before sending to Firestore
      const cleanedData = removeUndefined(purchaseOrderData);

      // Final validation - check for any undefined values
      const hasUndefined = JSON.stringify(cleanedData).includes('undefined');
      if (hasUndefined) {
        console.error('Purchase order data contains undefined values:', cleanedData);
        throw new Error('Invalid data: Some fields are undefined. Please check product information.');
      }

      console.log('Creating purchase order with data:', cleanedData);
      await addDoc(collection(db, 'purchaseOrders'), cleanedData);

      // Reload purchase orders
      await loadPurchaseOrders();
      
      // Success - reset form and close modal
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
      setError(null);
    } catch (err) {
      console.error('Error creating purchase order:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      
      // Provide more specific error message
      let errorMessage = 'Failed to create purchase order.';
      if (err.message.includes('undefined')) {
        errorMessage = 'Error: Some required fields are missing. Please ensure all product information is complete.';
      } else if (err.message.includes('permission')) {
        errorMessage = 'Permission denied. Please check your access rights.';
      } else {
        errorMessage = err.message || 'Failed to create purchase order. Please try again.';
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter purchase orders
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter(order => {
      const matchesSearch = 
        order.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.notes?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
      const matchesSupplier = selectedSupplierFilter === 'all' || order.supplierId === selectedSupplierFilter;

      // Date filter - filter by orderDate
      let matchesDate = true;
      if (dateFilterStart || dateFilterEnd) {
        const orderDate = order.orderDate ? new Date(order.orderDate) : null;
        if (orderDate) {
          if (dateFilterStart) {
            const startDate = new Date(dateFilterStart);
            startDate.setHours(0, 0, 0, 0);
            if (orderDate < startDate) {
              matchesDate = false;
            }
          }
          if (dateFilterEnd) {
            const endDate = new Date(dateFilterEnd);
            endDate.setHours(23, 59, 59, 999);
            if (orderDate > endDate) {
              matchesDate = false;
            }
          }
        } else {
          matchesDate = false; // If no order date, exclude if date filter is active
        }
      }

      return matchesSearch && matchesStatus && matchesSupplier && matchesDate;
    });
  }, [purchaseOrders, searchTerm, selectedStatus, selectedSupplierFilter, dateFilterStart, dateFilterEnd]);

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'Received': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'Approved': return 'text-green-600 bg-green-100 border-green-200';
      case 'In Transit': return 'text-purple-600 bg-purple-100 border-purple-200';
      case 'Rejected': return 'text-red-600 bg-red-100 border-red-200';
      case 'Shipped': return 'text-purple-600 bg-purple-100 border-purple-200';
      case 'Delivered': return 'text-green-600 bg-green-100 border-green-200';
      case 'Cancelled': return 'text-red-600 bg-red-100 border-red-200';
      case 'Overdue': return 'text-orange-600 bg-orange-100 border-orange-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending': return <Clock className="h-4 w-4" />;
      case 'Received': return <CheckCircle className="h-4 w-4" />;
      case 'Approved': return <CheckCircle className="h-4 w-4" />;
      case 'In Transit': return <Truck className="h-4 w-4" />;
      case 'Rejected': return <XCircle className="h-4 w-4" />;
      case 'Shipped': return <Truck className="h-4 w-4" />;
      case 'Delivered': return <CheckCircle className="h-4 w-4" />;
      case 'Cancelled': return <XCircle className="h-4 w-4" />;
      case 'Overdue': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Calculate order statistics
  const orderStats = useMemo(() => {
    return {
      totalOrders: purchaseOrders.length,
      pendingOrders: purchaseOrders.filter(o => o.status === 'Pending').length,
      approvedOrders: purchaseOrders.filter(o => o.status === 'Approved' || o.status === 'In Transit').length,
      deliveredOrders: purchaseOrders.filter(o => o.status === 'Delivered').length,
      overdueOrders: purchaseOrders.filter(o => o.status === 'Overdue').length,
      totalValue: purchaseOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
    };
  }, [purchaseOrders]);

  // Check if order can be marked as delivered (must be In Transit)
  const canMarkDelivered = (order) => {
    return order.status === 'In Transit';
  };

  // Handle mark as delivered with batch creation
  const handleMarkAsDelivered = async () => {
    if (!selectedOrder || !selectedOrder.items || selectedOrder.items.length === 0) {
      setError('Invalid order data');
      return;
    }

    try {
      setIsMarkingDelivered(true);
      setError(null);

      // Validate expiration dates for all items
      const itemsWithExpiration = selectedOrder.items.map(item => {
        const expirationDate = deliveryExpirationDates[item.productId];
        if (!expirationDate) {
          throw new Error(`Expiration date required for ${item.productName}`);
        }
        return {
          ...item,
          expirationDate: expirationDate
        };
      });

      // Create batches from delivery
      const deliveryData = {
        purchaseOrderId: selectedOrder.orderId || selectedOrder.id,
        branchId: userData.branchId,
        items: itemsWithExpiration,
        receivedBy: userData.uid || userData.id,
        receivedByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        receivedAt: new Date()
      };

      const batchesResult = await inventoryService.createProductBatches(deliveryData);
      if (!batchesResult.success) {
        throw new Error(batchesResult.message || 'Failed to create product batches');
      }

      // Update stock for each product
      for (const item of selectedOrder.items) {
        const stockData = {
          branchId: userData.branchId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitCost: item.unitPrice,
          reason: 'Purchase Order Delivery',
          notes: `Batch created from PO: ${selectedOrder.orderId || selectedOrder.id}`,
          createdBy: userData.uid || userData.id
        };

        const stockResult = await inventoryService.addStock(stockData);
        if (!stockResult.success) {
          console.error(`Failed to update stock for ${item.productName}:`, stockResult.message);
          // Continue with other items even if one fails
        }
      }

      // Update purchase order status to Delivered
      const orderRef = doc(db, 'purchaseOrders', selectedOrder.id);
      await updateDoc(orderRef, {
        status: 'Delivered',
        deliveredBy: userData.uid || userData.id,
        deliveredByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Reload purchase orders
      await loadPurchaseOrders();
      
      // Close modals and reset
      setIsDeliveryModalOpen(false);
      setIsDetailsModalOpen(false);
      setSelectedOrder(null);
      setDeliveryExpirationDates({});
      setError(null);
    } catch (err) {
      console.error('Error marking order as delivered:', err);
      setError(err.message || 'Failed to mark order as delivered. Please try again.');
    } finally {
      setIsMarkingDelivered(false);
    }
  };

  // Open delivery modal and initialize expiration dates
  const handleOpenDeliveryModal = (order) => {
    setSelectedOrder(order);
    // Initialize expiration dates - set to 1 year from today as default
    const defaultExpiration = new Date();
    defaultExpiration.setFullYear(defaultExpiration.getFullYear() + 1);
    const defaultExpirationStr = defaultExpiration.toISOString().split('T')[0];
    
    const initialDates = {};
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        initialDates[item.productId] = defaultExpirationStr;
      });
    }
    setDeliveryExpirationDates(initialDates);
    setIsDeliveryModalOpen(true);
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[#160B53]" />
          <span className="ml-2 text-gray-600">Loading purchase orders...</span>
        </div>
      </>
    );
  }

  if (error && !userData?.branchId) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Purchase Orders</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadData} className="flex items-center gap-2 mx-auto">
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
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-sm md:text-base text-gray-600">Create and manage purchase orders from suppliers</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleCreateOrder} className="flex items-center gap-2 bg-[#160B53] text-white hover:bg-[#12094A] text-xs md:text-sm">
              <Plus className="h-4 w-4" />
              Create Order
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
              <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
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
              <CheckCircle className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-xl font-bold text-gray-900">{orderStats.approvedOrders}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <Truck className="h-8 w-8 text-green-600" />
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
              <DollarSign className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-xl font-bold text-gray-900">₱{orderStats.totalValue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="p-6">
          <div className="space-y-4">
            {/* Search and Status/Supplier Filters */}
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by order ID, supplier, or notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
              <div className="flex gap-3">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                >
                  <option value="all">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Received">Received</option>
                  <option value="Approved">Approved</option>
                  <option value="In Transit">In Transit</option>
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
                    setSearchTerm('');
                    setSelectedStatus('all');
                    setSelectedSupplierFilter('all');
                    setDateFilterStart('');
                    setDateFilterEnd('');
                  }}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>

            {/* Date Range Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-end border-t pt-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Date Range:</span>
              </div>
              <div className="flex-1 flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
                  <Input
                    type="date"
                    value={dateFilterStart}
                    onChange={(e) => setDateFilterStart(e.target.value)}
                    className="w-full"
                    max={dateFilterEnd || undefined}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
                  <Input
                    type="date"
                    value={dateFilterEnd}
                    onChange={(e) => setDateFilterEnd(e.target.value)}
                    className="w-full"
                    min={dateFilterStart || undefined}
                  />
                </div>
                {(dateFilterStart || dateFilterEnd) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDateFilterStart('');
                      setDateFilterEnd('');
                    }}
                    className="flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    Clear Dates
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Purchase Orders Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <div className="inline-block min-w-full align-middle md:px-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Supplier
                    </th>
                    <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Order Date
                    </th>
                    <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Expected
                    </th>
                    <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Amount
                    </th>
                    <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                      Items
                    </th>
                    <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-3 md:px-6 py-8 text-center text-gray-500">
                      No purchase orders found. Create your first order to get started.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{order.orderId || order.id}</div>
                        <div className="text-xs text-gray-500">by {order.createdByName || 'Unknown'}</div>
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                        <div className="text-sm text-gray-900">{order.supplierName || 'Unknown Supplier'}</div>
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                        <div className="text-sm text-gray-900">
                          {order.orderDate ? format(new Date(order.orderDate), 'MMM dd, yyyy') : 'N/A'}
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                        <div className="text-sm text-gray-900">
                          {order.expectedDelivery ? format(new Date(order.expectedDelivery), 'MMM dd, yyyy') : 'N/A'}
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          {order.status}
                        </span>
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                        <div className="text-sm font-medium text-gray-900">₱{(order.totalAmount || 0).toLocaleString()}</div>
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap hidden xl:table-cell">
                        <div className="text-sm text-gray-900">{order.items?.length || 0} items</div>
                      </td>
                      <td className="px-3 md:px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsDetailsModalOpen(true);
                            }}
                            className="flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>
        </Card>

        {/* Create Order Modal - Full Page */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 bg-white overflow-hidden">
            <div className="h-full w-full flex flex-col">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <ShoppingCart className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Create Purchase Order</h2>
                      <p className="text-white/80 text-sm mt-1">
                        {!selectedSupplierId ? 'Step 1: Select Supplier' : 'Step 2: Select Products'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setSelectedSupplierId('');
                      setSelectedSupplierName('');
                      setShowProductSelection(false);
                      setOrderItems([]);
                      setProductSearchTerm('');
                      setCurrentProductPage(1);
                    }}
                    className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Modal Content - Full Height */}
              <div className="flex-1 overflow-hidden flex flex-col p-6">
                {/* Error Display in Modal */}
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <p className="text-red-800 flex-1 text-sm">{error}</p>
                    <Button variant="ghost" size="sm" onClick={() => setError(null)} className="text-red-600 hover:text-red-700 flex-shrink-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                {!showProductSelection ? (
                  /* Step 1: Supplier Selection */
                  <div className="space-y-6 flex-shrink-0">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Supplier *</label>
                      <select
                        value={selectedSupplierId}
                        onChange={(e) => handleSupplierSelect(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                        required
                      >
                        <option value="">Choose a supplier...</option>
                        {suppliers.map(supplier => (
                          <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                        ))}
                      </select>
                      {selectedSupplierId && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Building className="h-5 w-5 text-blue-600" />
                            <div>
                              <p className="font-semibold text-blue-900">{selectedSupplierName}</p>
                              {suppliers.find(s => s.id === selectedSupplierId)?.contactPerson && (
                                <p className="text-sm text-blue-700">
                                  Contact: {suppliers.find(s => s.id === selectedSupplierId).contactPerson}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedSupplierId('');
                                setSelectedSupplierName('');
                                setSupplierProducts([]);
                              }}
                              className="ml-auto"
                            >
                              Change
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedSupplierId && (
                      <div className="flex justify-end">
                        <Button
                          onClick={() => setShowProductSelection(true)}
                          className="bg-[#160B53] text-white hover:bg-[#12094A]"
                        >
                          Continue to Products <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Step 2: Product Selection */
                  <form id="purchase-order-form" onSubmit={handleSubmitOrder} className="flex-1 flex flex-col min-h-0 space-y-6">
                    {/* Supplier Info */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Building className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="font-semibold text-blue-900">{selectedSupplierName}</p>
                            <p className="text-sm text-blue-700">Available products from this supplier in your branch</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowProductSelection(false);
                            setSelectedSupplierId('');
                            setSelectedSupplierName('');
                            setSupplierProducts([]);
                            setProductSearchTerm('');
                            setCurrentProductPage(1);
                          }}
                        >
                          Change Supplier
                        </Button>
                      </div>
                    </div>

                    {/* Available Products Grid with Images - Big Data Optimized */}
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="mb-4 flex items-center justify-between flex-shrink-0">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Available Products ({filteredAndPaginatedProducts.total || supplierProducts.length})
                        </h3>
                        {/* Product Search */}
                        <div className="relative w-64">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            type="text"
                            placeholder="Search products..."
                            value={productSearchTerm}
                            onChange={(e) => {
                              setProductSearchTerm(e.target.value);
                              setCurrentProductPage(1); // Reset to first page on search
                            }}
                            className="w-full pl-10"
                          />
                        </div>
                      </div>
                      
                      {supplierProducts.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg flex-1 flex items-center justify-center">
                          <div>
                            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 text-lg">No products available from this supplier in your branch.</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Products Grid with Images */}
                          <div className="flex-1 overflow-y-auto">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-2">
                              {filteredAndPaginatedProducts.products?.map((product) => {
                                const isInOrder = orderItems.some(item => item.productId === product.id);
                                return (
                                  <Card
                                    key={product.id}
                                    className={`p-3 cursor-pointer hover:border-[#160B53] hover:shadow-lg transition-all relative ${
                                      isInOrder ? 'border-2 border-green-500 bg-green-50' : ''
                                    }`}
                                    onClick={async () => await addProductToOrder(product)}
                                  >
                                    {/* Product Image */}
                                    <div className="relative w-full aspect-square mb-3 bg-gray-100 rounded-lg overflow-hidden">
                                      {product.imageUrl ? (
                                        <img
                                          src={product.imageUrl}
                                          alt={product.name}
                                          className="w-full h-full object-cover"
                                          loading="lazy"
                                          onError={(e) => {
                                            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23e5e7eb" width="200" height="200"/%3E%3Ctext fill="%239ca3af" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="14"%3ENo Image%3C/text%3E%3C/svg%3E';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                          <Package className="h-12 w-12 text-gray-400" />
                                        </div>
                                      )}
                                      {isInOrder && (
                                        <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                                          <CheckCircle className="h-4 w-4" />
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Product Info */}
                                    <div className="space-y-1">
                                      <h4 className="font-semibold text-gray-900 text-sm line-clamp-2">{product.name}</h4>
                                      {product.brand && (
                                        <p className="text-xs text-gray-600 truncate">{product.brand}</p>
                                      )}
                                      {product.category && (
                                        <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                          {product.category}
                                        </span>
                                      )}
                                      <div className="flex items-center justify-between mt-2">
                                        <span className="text-sm font-bold text-[#160B53]">
                                          ₱{(product.unitCost || 0).toLocaleString()}
                                        </span>
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            await addProductToOrder(product);
                                          }}
                                          className={`h-7 px-2 text-xs ${
                                            isInOrder 
                                              ? 'bg-green-600 hover:bg-green-700' 
                                              : 'bg-[#160B53] hover:bg-[#12094A]'
                                          } text-white`}
                                        >
                                          {isInOrder ? <CheckCircle className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                        </Button>
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                          
                          {/* Pagination Controls */}
                          {filteredAndPaginatedProducts.totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 flex-shrink-0">
                              <div className="text-sm text-gray-600">
                                Showing {((currentProductPage - 1) * productsPerPage) + 1} to{' '}
                                {Math.min(currentProductPage * productsPerPage, filteredAndPaginatedProducts.total)} of{' '}
                                {filteredAndPaginatedProducts.total} products
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCurrentProductPage(prev => Math.max(1, prev - 1))}
                                  disabled={currentProductPage === 1}
                                >
                                  Previous
                                </Button>
                                <span className="text-sm text-gray-600">
                                  Page {currentProductPage} of {filteredAndPaginatedProducts.totalPages}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCurrentProductPage(prev => 
                                    Math.min(filteredAndPaginatedProducts.totalPages, prev + 1)
                                  )}
                                  disabled={currentProductPage >= filteredAndPaginatedProducts.totalPages}
                                >
                                  Next
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Order Items with Images */}
                    {orderItems.length > 0 && (
                      <div className="border-t border-gray-200 pt-6 mt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Items ({orderItems.length})</h3>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {orderItems.map((item) => {
                            const product = supplierProducts.find(p => p.id === item.productId);
                            return (
                              <Card key={item.productId} className="p-4">
                                <div className="flex items-center gap-4">
                                  {/* Product Image */}
                                  <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                                    {product?.imageUrl ? (
                                      <img
                                        src={product.imageUrl}
                                        alt={item.productName}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect fill="%23e5e7eb" width="64" height="64"/%3E%3Ctext fill="%239ca3af" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="10"%3ENo Image%3C/text%3E%3C/svg%3E';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Package className="h-6 w-6 text-gray-400" />
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-gray-900 truncate">{item.productName}</h4>
                                    {item.sku && (
                                      <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                                    )}
                                    {item.currentStock !== undefined && (
                                      <p className={`text-xs mt-1 ${
                                        item.currentStock > 5 
                                          ? 'text-orange-600 font-medium' 
                                          : item.currentStock === 0 
                                          ? 'text-red-600 font-medium' 
                                          : 'text-green-600'
                                      }`}>
                                        Current Stock: {item.currentStock} units
                                        {item.currentStock > 5 && ' (High stock - ordering not recommended)'}
                                      </p>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                      <label className="text-sm text-gray-600 whitespace-nowrap">Qty:</label>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => updateItemQuantity(item.productId, e.target.value)}
                                        className="w-20"
                                      />
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <label className="text-sm text-gray-600 whitespace-nowrap">Unit Price:</label>
                                      <div className="w-32 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-semibold text-gray-900">
                                        ₱{item.unitPrice.toLocaleString()}
                                      </div>
                                    </div>
                                    <div className="text-right min-w-[100px]">
                                      <p className="text-sm font-semibold text-gray-900">
                                        ₱{item.totalPrice.toLocaleString()}
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeOrderItem(item.productId)}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-semibold text-gray-900">Total Amount:</span>
                            <span className="text-2xl font-bold text-[#160B53]">₱{orderTotal.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Order Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-shrink-0">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Order Date *</label>
                        <Input
                          type="date"
                          value={orderFormData.orderDate}
                          onChange={(e) => setOrderFormData(prev => ({ ...prev, orderDate: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Expected Delivery Date *</label>
                        <Input
                          type="date"
                          value={orderFormData.expectedDelivery}
                          onChange={(e) => setOrderFormData(prev => ({ ...prev, expectedDelivery: e.target.value }))}
                          required
                          min={orderFormData.orderDate}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                        <Input
                          type="text"
                          value={orderFormData.notes}
                          onChange={(e) => setOrderFormData(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Additional notes or instructions..."
                        />
                      </div>
                    </div>
                  </form>
                )}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 bg-gray-50 flex-shrink-0">
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setSelectedSupplierId('');
                      setSelectedSupplierName('');
                      setShowProductSelection(false);
                      setOrderItems([]);
                      setProductSearchTerm('');
                      setCurrentProductPage(1);
                    }}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </Button>
                  {showProductSelection && (
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleSubmitOrder();
                      }}
                      disabled={isSubmitting || orderItems.length === 0 || !orderFormData.orderDate || !orderFormData.expectedDelivery}
                      className="bg-[#160B53] text-white hover:bg-[#12094A] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creating Order...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Create Order
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedOrder.status)}`}>
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
                <div className="flex justify-end gap-3">
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

        {/* Delivery Modal - Batch Expiration Input */}
        {isDeliveryModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Truck className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Mark Order as Delivered</h2>
                      <p className="text-white/80 text-sm mt-1">Enter expiration dates for each product batch</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsDeliveryModalOpen(false);
                      setDeliveryExpirationDates({});
                    }}
                    className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Error Display */}
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <p className="text-red-800 flex-1 text-sm">{error}</p>
                    <Button variant="ghost" size="sm" onClick={() => setError(null)} className="text-red-600 hover:text-red-700 flex-shrink-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <div className="space-y-6">
                  {/* Order Info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-blue-900">Order: {selectedOrder.orderId || selectedOrder.id}</p>
                        <p className="text-sm text-blue-700">Supplier: {selectedOrder.supplierName || 'Unknown'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-blue-700">Total Amount</p>
                        <p className="text-lg font-bold text-blue-900">₱{(selectedOrder.totalAmount || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Product Expiration Dates */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Enter Expiration Dates for Each Product</h3>
                    <div className="space-y-4">
                      {selectedOrder.items && selectedOrder.items.length > 0 ? (
                        selectedOrder.items.map((item, index) => (
                          <Card key={item.productId || index} className="p-4">
                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">{item.productName}</h4>
                                {item.sku && (
                                  <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                                )}
                                <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                                  <span>Quantity: <strong>{item.quantity}</strong></span>
                                  <span>Unit Price: <strong>₱{(item.unitPrice || 0).toLocaleString()}</strong></span>
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Expiration Date *
                                </label>
                                <Input
                                  type="date"
                                  value={deliveryExpirationDates[item.productId] || ''}
                                  onChange={(e) => {
                                    setDeliveryExpirationDates(prev => ({
                                      ...prev,
                                      [item.productId]: e.target.value
                                    }));
                                  }}
                                  required
                                  min={new Date().toISOString().split('T')[0]}
                                  className="w-48"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  {deliveryExpirationDates[item.productId] 
                                    ? format(new Date(deliveryExpirationDates[item.productId]), 'MMM dd, yyyy')
                                    : 'Select date'}
                                </p>
                              </div>
                            </div>
                          </Card>
                        ))
                      ) : (
                        <p className="text-gray-500 text-center py-8">No items in this order</p>
                      )}
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-semibold mb-1">Batch Expiration Tracking</p>
                        <p>Each product will be tracked in batches with the expiration date you specify. The system will use FIFO (First In, First Out) to manage stock rotation, using the oldest batches first.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDeliveryModalOpen(false);
                      setDeliveryExpirationDates({});
                    }}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleMarkAsDelivered}
                    disabled={isMarkingDelivered || !selectedOrder.items || selectedOrder.items.length === 0}
                    className="bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isMarkingDelivered ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing Delivery...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Confirm Delivery
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PurchaseOrders;
