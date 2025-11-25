import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  Truck,
  Search,
  Eye,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  FileText,
  X,
  Package,
  Loader2,
  PackageCheck,
  Download,
  CheckSquare,
  Square,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import toast from 'react-hot-toast';

const Deliveries = () => {
  const { userData } = useAuth();

  // Data states
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Receiving modal states (for In Transit orders)
  const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);
  const [receivedQuantities, setReceivedQuantities] = useState({});
  const [checkedItems, setCheckedItems] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [receivingNotes, setReceivingNotes] = useState('');
  
  // Delivery modal states (for Received orders - mark as delivered with expiration dates)
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [deliveryExpirationDates, setDeliveryExpirationDates] = useState({});
  const [isMarkingDelivered, setIsMarkingDelivered] = useState(false);

  // Load deliveries (purchase orders with In Transit or Received status)
  useEffect(() => {
    loadDeliveries();
  }, [userData?.branchId]);

  const loadDeliveries = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!userData?.branchId) {
        setError('Branch ID not found');
        setLoading(false);
        return;
      }

      const purchaseOrdersRef = collection(db, 'purchaseOrders');
      
      // Query for In Transit orders only (Received orders are now automatically marked as Delivered)
      const q = query(
        purchaseOrdersRef,
        where('branchId', '==', userData.branchId),
        where('status', '==', 'In Transit')
      );
      
      const snapshot = await getDocs(q);

      const deliveriesList = [];
      
      // Process In Transit orders
      snapshot.forEach((doc) => {
        const data = doc.data();
        deliveriesList.push({
          id: doc.id,
          ...data,
          orderDate: data.orderDate?.toDate ? data.orderDate.toDate() : new Date(data.orderDate),
          expectedDelivery: data.expectedDelivery?.toDate ? data.expectedDelivery.toDate() : new Date(data.expectedDelivery),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate() : (data.approvedAt ? new Date(data.approvedAt) : null),
          receivedAt: data.receivedAt?.toDate ? data.receivedAt.toDate() : (data.receivedAt ? new Date(data.receivedAt) : null),
        });
      });

      // Sort by approvedAt descending (most recently approved first)
      deliveriesList.sort((a, b) => {
        const dateA = a.approvedAt instanceof Date ? a.approvedAt : (a.approvedAt ? new Date(a.approvedAt) : new Date(0));
        const dateB = b.approvedAt instanceof Date ? b.approvedAt : (b.approvedAt ? new Date(b.approvedAt) : new Date(0));
        return dateB.getTime() - dateA.getTime();
      });

      setDeliveries(deliveriesList);
    } catch (err) {
      console.error('Error loading deliveries:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get unique suppliers from deliveries
  const suppliers = useMemo(() => {
    const supplierMap = new Map();
    deliveries.forEach(delivery => {
      if (delivery.supplierId && delivery.supplierName) {
        if (!supplierMap.has(delivery.supplierId)) {
          supplierMap.set(delivery.supplierId, delivery.supplierName);
        }
      }
    });
    return Array.from(supplierMap.entries()).map(([id, name]) => ({ id, name }));
  }, [deliveries]);

  // Filter deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter(delivery => {
      const matchesSearch = 
        delivery.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        delivery.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        delivery.notes?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSupplier = selectedSupplierFilter === 'all' || delivery.supplierId === selectedSupplierFilter;
      const matchesStatus = selectedStatusFilter === 'all' || delivery.status === selectedStatusFilter;

      // Date filter - filter by orderDate
      let matchesDate = true;
      if (dateFilterStart || dateFilterEnd) {
        const orderDate = delivery.orderDate ? new Date(delivery.orderDate) : null;
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

      return matchesSearch && matchesSupplier && matchesStatus && matchesDate;
    });
  }, [deliveries, searchTerm, selectedSupplierFilter, selectedStatusFilter, dateFilterStart, dateFilterEnd]);

  // Delivery statistics
  const deliveryStats = useMemo(() => {
    return {
      totalDeliveries: deliveries.length,
      inTransit: deliveries.filter(d => d.status === 'In Transit').length,
      totalValue: deliveries.reduce((sum, d) => sum + (d.totalAmount || 0), 0),
      totalItems: deliveries.reduce((sum, d) => sum + (d.items?.length || 0), 0)
    };
  }, [deliveries]);

  // Open receiving modal and initialize data (for In Transit orders)
  const handleOpenReceivingModal = (order) => {
    setSelectedOrder(order);
    const initialQuantities = {};
    const initialChecked = {};
    // Initialize expiration dates - set to 1 year from today as default
    const defaultExpiration = new Date();
    defaultExpiration.setFullYear(defaultExpiration.getFullYear() + 1);
    const defaultExpirationStr = defaultExpiration.toISOString().split('T')[0];
    const initialDates = {};
    
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        initialQuantities[item.productId] = item.quantity || 0;
        initialChecked[item.productId] = false;
        initialDates[item.productId] = defaultExpirationStr;
      });
    }
    setReceivedQuantities(initialQuantities);
    setCheckedItems(initialChecked);
    setDeliveryExpirationDates(initialDates);
    setReceivingNotes('');
    setIsReceivingModalOpen(true);
  };

  // Open delivery modal and initialize expiration dates (for Received orders)
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

  // Calculate discrepancy for an item
  const calculateDiscrepancy = (item) => {
    const orderedQty = item.quantity || 0;
    const receivedQty = receivedQuantities[item.productId] || 0;
    return receivedQty - orderedQty;
  };

  // Check if all items are checked
  const allItemsChecked = useMemo(() => {
    if (!selectedOrder || !selectedOrder.items) return false;
    return selectedOrder.items.every(item => checkedItems[item.productId] === true);
  }, [selectedOrder, checkedItems]);

  // Handle receive delivery (for In Transit orders) - Now includes expiration dates and marks as Delivered
  const handleReceiveDelivery = async () => {
    if (!selectedOrder || !selectedOrder.items || selectedOrder.items.length === 0) {
      setError('Invalid order data');
      return;
    }

    if (!allItemsChecked) {
      setError('Please check all items before receiving the delivery');
      return;
    }

    // Validate expiration dates for all items
    const missingExpiration = selectedOrder.items.find(item => {
      const expirationDate = deliveryExpirationDates[item.productId];
      return !expirationDate;
    });

    if (missingExpiration) {
      setError(`Expiration date required for ${missingExpiration.productName}`);
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // Prepare items with expiration dates
      const itemsWithExpiration = selectedOrder.items.map(item => {
        const orderedQty = item.quantity || 0;
        const receivedQty = receivedQuantities[item.productId] || 0;
        const discrepancy = receivedQty - orderedQty;
        const expirationDate = deliveryExpirationDates[item.productId];
        
        return {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku || null,
          orderedQuantity: orderedQty,
          receivedQuantity: receivedQty,
          discrepancy: discrepancy,
          unitPrice: item.unitPrice || 0,
          expirationDate: expirationDate,
          checked: checkedItems[item.productId] || false
        };
      });

      const receivingData = {
        purchaseOrderId: selectedOrder.orderId || selectedOrder.id,
        purchaseOrderDocId: selectedOrder.id,
        branchId: userData.branchId,
        supplierId: selectedOrder.supplierId,
        supplierName: selectedOrder.supplierName,
        items: itemsWithExpiration,
        notes: receivingNotes.trim(),
        receivedBy: userData.uid || userData.id,
        receivedByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        receivedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      };

      // Save receiving record
      await addDoc(collection(db, 'deliveryReceipts'), receivingData);

      // Save delivery data with expiration dates for batch creation
      await addDoc(collection(db, 'deliveries'), {
        purchaseOrderId: selectedOrder.orderId || selectedOrder.id,
        purchaseOrderDocId: selectedOrder.id,
        branchId: userData.branchId,
        supplierId: selectedOrder.supplierId,
        supplierName: selectedOrder.supplierName,
        items: itemsWithExpiration,
        deliveredBy: userData.uid || userData.id,
        deliveredByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        deliveredAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // Update purchase order status to Delivered (not Received)
      const orderRef = doc(db, 'purchaseOrders', selectedOrder.id);
      await updateDoc(orderRef, {
        status: 'Delivered',
        receivedBy: userData.uid || userData.id,
        receivedByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        receivedAt: serverTimestamp(),
        deliveredBy: userData.uid || userData.id,
        deliveredByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        expirationDates: deliveryExpirationDates // Store expiration dates in the order
      });

      await loadDeliveries();
      
      setIsReceivingModalOpen(false);
      setSelectedOrder(null);
      setReceivedQuantities({});
      setCheckedItems({});
      setDeliveryExpirationDates({});
      setReceivingNotes('');
      setError(null);
      toast.success('Delivery received and marked as delivered successfully!');
    } catch (err) {
      console.error('Error receiving delivery:', err);
      setError(err.message || 'Failed to receive delivery. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle mark as delivered with expiration dates (for Received orders)
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

      // TODO: Create batches from delivery with expiration dates
      // This would integrate with your inventory service
      // For now, we'll just update the purchase order status

      // Update purchase order status to Delivered
      const orderRef = doc(db, 'purchaseOrders', selectedOrder.id);
      await updateDoc(orderRef, {
        status: 'Delivered',
        deliveredBy: userData.uid || userData.id,
        deliveredByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        expirationDates: deliveryExpirationDates // Store expiration dates in the order
      });

      // Save delivery data with expiration dates for batch creation
      await addDoc(collection(db, 'deliveries'), {
        purchaseOrderId: selectedOrder.orderId || selectedOrder.id,
        purchaseOrderDocId: selectedOrder.id,
        branchId: userData.branchId,
        supplierId: selectedOrder.supplierId,
        supplierName: selectedOrder.supplierName,
        items: itemsWithExpiration,
        deliveredBy: userData.uid || userData.id,
        deliveredByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        deliveredAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      await loadDeliveries();
      
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

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'In Transit': return 'text-purple-600 bg-purple-100 border-purple-200';
      case 'Received': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'Delivered': return 'text-green-600 bg-green-100 border-green-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'In Transit': return <Truck className="h-4 w-4" />;
      case 'Received': return <PackageCheck className="h-4 w-4" />;
      case 'Delivered': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#160B53]" />
        <span className="ml-2 text-gray-600">Loading deliveries...</span>
      </div>
    );
  }

  if (error && !userData?.branchId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Deliveries</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadDeliveries} className="flex items-center gap-2 mx-auto">
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deliveries</h1>
          <p className="text-gray-600">Track and receive purchase orders</p>
        </div>
        <Button
          variant="outline"
          onClick={loadDeliveries}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <Truck className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Deliveries</p>
              <p className="text-xl font-bold text-gray-900">{deliveryStats.totalDeliveries}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center">
            <Truck className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">In Transit</p>
              <p className="text-xl font-bold text-gray-900">{deliveryStats.inTransit}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Items</p>
              <p className="text-xl font-bold text-gray-900">{deliveryStats.totalItems}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-xl font-bold text-gray-900">₱{deliveryStats.totalValue.toLocaleString()}</p>
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
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
              >
                <option value="all">All Status</option>
                <option value="In Transit">In Transit</option>
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
                  setSelectedStatusFilter('all');
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

      {/* Deliveries Table */}
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
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expected Delivery
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    {deliveries.length === 0 
                      ? 'No deliveries pending. Purchase orders will appear here after being approved by the Operational Manager.'
                      : 'No deliveries match your search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((delivery) => (
                  <tr key={delivery.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{delivery.orderId || delivery.id}</div>
                      <div className="text-xs text-gray-500">by {delivery.createdByName || 'Unknown'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{delivery.supplierName || 'Unknown Supplier'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(delivery.status)}`}>
                        {getStatusIcon(delivery.status)}
                        {delivery.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {delivery.expectedDelivery ? format(new Date(delivery.expectedDelivery), 'MMM dd, yyyy') : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">₱{(delivery.totalAmount || 0).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{delivery.items?.length || 0} items</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(delivery);
                            setIsDetailsModalOpen(true);
                          }}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                        {delivery.status === 'In Transit' && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenReceivingModal(delivery)}
                            className="bg-green-600 text-white hover:bg-green-700 flex items-center gap-1"
                          >
                            <PackageCheck className="h-3 w-3" />
                            Receive & Deliver
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Order Details Modal */}
      {isDetailsModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Truck className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Delivery Details</h2>
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
                    {selectedOrder.receivedByName && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Received By</label>
                        <p className="text-gray-900 text-blue-600 font-semibold">{selectedOrder.receivedByName}</p>
                        {selectedOrder.receivedAt && (
                          <p className="text-xs text-gray-500">
                            {format(new Date(selectedOrder.receivedAt), 'MMM dd, yyyy HH:mm')}
                          </p>
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
                {selectedOrder.status === 'In Transit' && (
                  <Button
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      handleOpenReceivingModal(selectedOrder);
                    }}
                    className="bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
                  >
                    <PackageCheck className="h-4 w-4" />
                    Receive
                  </Button>
                )}
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

      {/* Receiving Modal - For In Transit orders */}
      {isReceivingModalOpen && selectedOrder && selectedOrder.status === 'In Transit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <PackageCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Receive & Deliver</h2>
                    <p className="text-white/80 text-sm mt-1">Purchase Order: {selectedOrder.orderId || selectedOrder.id} - Enter expiration dates for each batch</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsReceivingModalOpen(false);
                    setReceivedQuantities({});
                    setCheckedItems({});
                    setReceivingNotes('');
                    setError(null);
                  }}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-blue-900">Supplier: {selectedOrder.supplierName || 'Unknown'}</p>
                      <p className="text-sm text-blue-700">Order Date: {selectedOrder.orderDate ? format(new Date(selectedOrder.orderDate), 'MMM dd, yyyy') : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-900">Total Amount: ₱{(selectedOrder.totalAmount || 0).toLocaleString()}</p>
                      <p className="text-sm text-blue-700">Items: {selectedOrder.items?.length || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Checklist Table */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Receiving Checklist</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ordered Qty</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Received Qty</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Discrepancy</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiration Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedOrder.items && selectedOrder.items.length > 0 ? (
                          selectedOrder.items.map((item, index) => {
                            const discrepancy = calculateDiscrepancy(item);
                            const discrepancyClass = discrepancy > 0 ? 'text-green-600 font-semibold' : discrepancy < 0 ? 'text-red-600 font-semibold' : 'text-gray-600';
                            const discrepancyText = discrepancy > 0 ? `+${discrepancy}` : discrepancy.toString();
                            
                            return (
                              <tr key={item.productId || index} className={checkedItems[item.productId] ? 'bg-green-50' : 'hover:bg-gray-50'}>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => {
                                      setCheckedItems(prev => ({
                                        ...prev,
                                        [item.productId]: !prev[item.productId]
                                      }));
                                    }}
                                    className="flex items-center justify-center"
                                  >
                                    {checkedItems[item.productId] ? (
                                      <CheckSquare className="h-5 w-5 text-green-600" />
                                    ) : (
                                      <Square className="h-5 w-5 text-gray-400" />
                                    )}
                                  </button>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-gray-900">{item.productName}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-sm text-gray-500">{item.sku || 'N/A'}</div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="text-gray-900 font-medium">{item.quantity || 0}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={receivedQuantities[item.productId] || 0}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value) || 0;
                                      setReceivedQuantities(prev => ({
                                        ...prev,
                                        [item.productId]: value
                                      }));
                                    }}
                                    className="w-24 text-center"
                                  />
                                </td>
                                <td className={`px-4 py-3 text-center ${discrepancyClass}`}>
                                  {discrepancyText}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="text-gray-900">₱{(item.unitPrice || 0).toLocaleString()}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <Input
                                    type="date"
                                    value={deliveryExpirationDates[item.productId] || ''}
                                    onChange={(e) => {
                                      setDeliveryExpirationDates(prev => ({
                                        ...prev,
                                        [item.productId]: e.target.value
                                      }));
                                    }}
                                    className="w-full"
                                    required
                                  />
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="8" className="px-4 py-4 text-center text-gray-500">No items</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Receiving Notes</label>
                  <textarea
                    value={receivingNotes}
                    onChange={(e) => setReceivingNotes(e.target.value)}
                    placeholder="Add any notes about the delivery (discrepancies, damages, etc.)..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>

                {/* Summary */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Items Checked</p>
                      <p className="text-lg font-bold text-gray-900">
                        {Object.values(checkedItems).filter(Boolean).length} / {selectedOrder.items?.length || 0}
                      </p>
                    </div>
                    {!allItemsChecked && (
                      <div className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="text-sm font-medium">Please check all items</span>
                      </div>
                    )}
                    {allItemsChecked && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span className="text-sm font-medium">All items checked</span>
                      </div>
                    )}
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
                    setIsReceivingModalOpen(false);
                    setReceivedQuantities({});
                    setCheckedItems({});
                    setDeliveryExpirationDates({});
                    setReceivingNotes('');
                    setError(null);
                  }}
                  disabled={isProcessing}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReceiveDelivery}
                  disabled={isProcessing || !allItemsChecked}
                  className="bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Receive & Mark as Delivered
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Modal - Mark as Delivered with Expiration Dates (for Received orders) */}
      {isDeliveryModalOpen && selectedOrder && selectedOrder.status === 'Received' && (
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
  );
};

export default Deliveries;

