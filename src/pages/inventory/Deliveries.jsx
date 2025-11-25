import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import InventoryLayout from '../../layouts/InventoryLayout';
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
  Home,
  TrendingUp,
  ArrowRightLeft,
  QrCode,
  ShoppingCart,
  BarChart3,
  ClipboardList,
  UserCog,
  Calendar,
  PackageCheck,
  Download,
  Printer,
  CheckSquare,
  Square
} from 'lucide-react';
import { format } from 'date-fns';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import inventoryService from '../../services/inventoryService';
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
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);
  const [receivedQuantities, setReceivedQuantities] = useState({}); // { productId: quantity }
  const [checkedItems, setCheckedItems] = useState({}); // { productId: boolean }
  const [isProcessing, setIsProcessing] = useState(false);
  const [receivingNotes, setReceivingNotes] = useState('');
  
  // Batch expiration modal states
  const [isBatchExpirationModalOpen, setIsBatchExpirationModalOpen] = useState(false);
  const [batchExpirationDates, setBatchExpirationDates] = useState({}); // { productId: expirationDate }
  const [receivedDeliveryData, setReceivedDeliveryData] = useState(null); // Store delivery data after receiving

  // Load deliveries (purchase orders with In Transit status)
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
      const q = query(
        purchaseOrdersRef,
        where('branchId', '==', userData.branchId),
        where('status', '==', 'In Transit')
      );
      const snapshot = await getDocs(q);

      const deliveriesList = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        deliveriesList.push({
          id: doc.id,
          ...data,
          orderDate: data.orderDate?.toDate ? data.orderDate.toDate() : new Date(data.orderDate),
          expectedDelivery: data.expectedDelivery?.toDate ? data.expectedDelivery.toDate() : new Date(data.expectedDelivery),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate() : (data.approvedAt ? new Date(data.approvedAt) : null),
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

      return matchesSearch && matchesSupplier && matchesDate;
    });
  }, [deliveries, searchTerm, selectedSupplierFilter, dateFilterStart, dateFilterEnd]);

  // Delivery statistics
  const deliveryStats = useMemo(() => {
    return {
      totalDeliveries: deliveries.length,
      totalValue: deliveries.reduce((sum, d) => sum + (d.totalAmount || 0), 0),
      totalItems: deliveries.reduce((sum, d) => sum + (d.items?.length || 0), 0)
    };
  }, [deliveries]);

  // Open receiving modal and initialize data
  const handleOpenReceivingModal = (order) => {
    setSelectedOrder(order);
    // Initialize received quantities with ordered quantities
    const initialQuantities = {};
    const initialChecked = {};
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        initialQuantities[item.productId] = item.quantity || 0;
        initialChecked[item.productId] = false;
      });
    }
    setReceivedQuantities(initialQuantities);
    setCheckedItems(initialChecked);
    setReceivingNotes('');
    setIsReceivingModalOpen(true);
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

  // Handle receive delivery
  const handleReceiveDelivery = async () => {
    if (!selectedOrder || !selectedOrder.items || selectedOrder.items.length === 0) {
      setError('Invalid order data');
      return;
    }

    // Validate that all items are checked
    if (!allItemsChecked) {
      setError('Please check all items before receiving the delivery');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // Prepare receiving data
      const receivingData = {
        purchaseOrderId: selectedOrder.orderId || selectedOrder.id,
        purchaseOrderDocId: selectedOrder.id,
        branchId: userData.branchId,
        supplierId: selectedOrder.supplierId,
        supplierName: selectedOrder.supplierName,
        items: selectedOrder.items.map(item => {
          const orderedQty = item.quantity || 0;
          const receivedQty = receivedQuantities[item.productId] || 0;
          const discrepancy = receivedQty - orderedQty;
          
          return {
            productId: item.productId,
            productName: item.productName,
            sku: item.sku || null,
            orderedQuantity: orderedQty,
            receivedQuantity: receivedQty,
            discrepancy: discrepancy,
            unitPrice: item.unitPrice || 0,
            checked: checkedItems[item.productId] || false
          };
        }),
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

      // Update purchase order status to Received
      const orderRef = doc(db, 'purchaseOrders', selectedOrder.id);
      await updateDoc(orderRef, {
        status: 'Received',
        receivedBy: userData.uid || userData.id,
        receivedByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        receivedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Store delivery data for batch creation
      setReceivedDeliveryData({
        purchaseOrderId: selectedOrder.orderId || selectedOrder.id,
        purchaseOrderDocId: selectedOrder.id,
        branchId: userData.branchId,
        supplierId: selectedOrder.supplierId,
        supplierName: selectedOrder.supplierName,
        receivedBy: userData.uid || userData.id,
        receivedByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        items: selectedOrder.items.map(item => {
          const orderedQty = item.quantity || 0;
          const receivedQty = receivedQuantities[item.productId] || 0;
          return {
            productId: item.productId,
            productName: item.productName,
            sku: item.sku || null,
            quantity: receivedQty,
            unitPrice: item.unitPrice || 0
          };
        }).filter(item => item.quantity > 0), // Only include items with received quantity > 0
        receivedBy: userData.uid || userData.id,
        receivedByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        receivedAt: new Date()
      });

      // Reload deliveries
      await loadDeliveries();
      
      // Close receiving modal
      setIsReceivingModalOpen(false);
      setSelectedOrder(null);
      setReceivedQuantities({});
      setCheckedItems({});
      setReceivingNotes('');
      setError(null);
      
      // Open batch expiration modal
      const initialExpirationDates = {};
      selectedOrder.items.forEach(item => {
        const receivedQty = receivedQuantities[item.productId] || 0;
        if (receivedQty > 0) {
          // Set default expiration to 1 year from today
          const defaultExpiration = new Date();
          defaultExpiration.setFullYear(defaultExpiration.getFullYear() + 1);
          initialExpirationDates[item.productId] = defaultExpiration.toISOString().split('T')[0];
        }
      });
      setBatchExpirationDates(initialExpirationDates);
      setIsBatchExpirationModalOpen(true);
    } catch (err) {
      console.error('Error receiving delivery:', err);
      setError(err.message || 'Failed to receive delivery. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate and download report
  const generateReport = () => {
    if (!selectedOrder) return;

    const reportData = {
      orderId: selectedOrder.orderId || selectedOrder.id,
      supplierName: selectedOrder.supplierName || 'Unknown Supplier',
      orderDate: selectedOrder.orderDate ? format(new Date(selectedOrder.orderDate), 'MMM dd, yyyy') : 'N/A',
      expectedDelivery: selectedOrder.expectedDelivery ? format(new Date(selectedOrder.expectedDelivery), 'MMM dd, yyyy') : 'N/A',
      receivedDate: format(new Date(), 'MMM dd, yyyy HH:mm'),
      receivedBy: userData.firstName && userData.lastName 
        ? `${userData.firstName} ${userData.lastName}`.trim() 
        : (userData.email || 'Unknown'),
      items: selectedOrder.items.map(item => {
        const orderedQty = item.quantity || 0;
        const receivedQty = receivedQuantities[item.productId] || 0;
        const discrepancy = receivedQty - orderedQty;
        
        return {
          productName: item.productName,
          sku: item.sku || 'N/A',
          orderedQuantity: orderedQty,
          receivedQuantity: receivedQty,
          discrepancy: discrepancy,
          unitPrice: item.unitPrice || 0,
          totalPrice: (item.unitPrice || 0) * orderedQty,
          checked: checkedItems[item.productId] || false
        };
      }),
      notes: receivingNotes,
      totalAmount: selectedOrder.totalAmount || 0
    };

    // Generate HTML report
    const htmlContent = generateReportHTML(reportData);
    
    // Create and download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Delivery-Report-${reportData.orderId}-${format(new Date(), 'yyyy-MM-dd')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate HTML report content
  const generateReportHTML = (data) => {
    const discrepancyRows = data.items.map(item => {
      const discrepancyColor = item.discrepancy > 0 ? '#16a34a' : item.discrepancy < 0 ? '#dc2626' : '#4b5563';
      const discrepancyText = item.discrepancy > 0 ? `+${item.discrepancy}` : item.discrepancy.toString();
      
      return `
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 8px 16px;">${item.productName}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px 16px;">${item.sku}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px 16px; text-align: center;">${item.orderedQuantity}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px 16px; text-align: center;">${item.receivedQuantity}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px 16px; text-align: center; color: ${discrepancyColor}; font-weight: 600;">${discrepancyText}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px 16px; text-align: right;">₱${item.unitPrice.toLocaleString()}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px 16px; text-align: right;">₱${item.totalPrice.toLocaleString()}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px 16px; text-align: center;">${item.checked ? '✓' : ''}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Delivery Report - ${data.orderId}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
          .header h1 { margin: 0; color: #160B53; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
          .info-item { margin-bottom: 10px; }
          .info-label { font-weight: bold; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #f3f4f6; font-weight: bold; text-align: left; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #333; }
          .notes { margin-top: 20px; padding: 15px; background-color: #f9fafb; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Delivery Receiving Report</h1>
          <p>Purchase Order: ${data.orderId}</p>
        </div>
        
        <div class="info-grid">
          <div>
            <div class="info-item">
              <span class="info-label">Supplier:</span> ${data.supplierName}
            </div>
            <div class="info-item">
              <span class="info-label">Order Date:</span> ${data.orderDate}
            </div>
            <div class="info-item">
              <span class="info-label">Expected Delivery:</span> ${data.expectedDelivery}
            </div>
          </div>
          <div>
            <div class="info-item">
              <span class="info-label">Received Date:</span> ${data.receivedDate}
            </div>
            <div class="info-item">
              <span class="info-label">Received By:</span> ${data.receivedBy}
            </div>
            <div class="info-item">
              <span class="info-label">Total Amount:</span> ₱${data.totalAmount.toLocaleString()}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="border px-4 py-2">Product</th>
              <th class="border px-4 py-2">SKU</th>
              <th class="border px-4 py-2 text-center">Ordered Qty</th>
              <th class="border px-4 py-2 text-center">Received Qty</th>
              <th class="border px-4 py-2 text-center">Discrepancy</th>
              <th class="border px-4 py-2 text-right">Unit Price</th>
              <th class="border px-4 py-2 text-right">Total Price</th>
              <th class="border px-4 py-2 text-center">Checked</th>
            </tr>
          </thead>
          <tbody>
            ${discrepancyRows}
          </tbody>
        </table>

        ${data.notes ? `
          <div class="notes">
            <strong>Notes:</strong><br>
            ${data.notes}
          </div>
        ` : ''}

        <div class="footer">
          <p><strong>Report Generated:</strong> ${format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
        </div>
      </body>
      </html>
    `;
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[#160B53]" />
          <span className="ml-2 text-gray-600">Loading deliveries...</span>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Deliveries</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadDeliveries} className="flex items-center gap-2 mx-auto">
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
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Deliveries</h1>
            <p className="text-gray-600">Track purchase orders that are in transit</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <Card className="p-4">
            <div className="flex items-center">
              <Truck className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">In Transit</p>
                <p className="text-xl font-bold text-gray-900">{deliveryStats.totalDeliveries}</p>
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
        <Card className="p-4 md:p-6">
          <div className="space-y-4">
            {/* Search and Supplier Filters */}
            <div className="flex flex-col md:flex-row gap-4">
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
              <div className="flex gap-2 md:gap-3 flex-wrap">
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
                    Order Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expected Delivery
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Approved At
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
                    <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                      {deliveries.length === 0 
                        ? 'No deliveries in transit. Purchase orders will appear here after being approved by the Operational Manager.'
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
                        <div className="text-sm text-gray-900">
                          {delivery.orderDate ? format(new Date(delivery.orderDate), 'MMM dd, yyyy') : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {delivery.expectedDelivery ? format(new Date(delivery.expectedDelivery), 'MMM dd, yyyy') : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {delivery.approvedAt ? format(new Date(delivery.approvedAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                        </div>
                        {delivery.approvedByName && (
                          <div className="text-xs text-gray-500">by {delivery.approvedByName}</div>
                        )}
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
                          <Button
                            size="sm"
                            onClick={() => handleOpenReceivingModal(delivery)}
                            className="bg-green-600 text-white hover:bg-green-700 flex items-center gap-1"
                          >
                            <PackageCheck className="h-3 w-3" />
                            Receive
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Order Details Modal */}
      {isDetailsModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6">
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
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border text-purple-600 bg-purple-100 border-purple-200">
                    <Truck className="h-3 w-3" />
                    In Transit
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

      {/* Receiving Modal */}
      {isReceivingModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <PackageCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Receive Delivery</h2>
                    <p className="text-white/80 text-sm mt-1">Purchase Order: {selectedOrder.orderId || selectedOrder.id}</p>
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
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="7" className="px-4 py-4 text-center text-gray-500">No items</td>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
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
              <div className="flex justify-between items-center">
                <Button
                  variant="outline"
                  onClick={generateReport}
                  disabled={!selectedOrder}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Generate Report
                </Button>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsReceivingModalOpen(false);
                      setReceivedQuantities({});
                      setCheckedItems({});
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
                        Confirm Receipt
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Expiration Modal */}
      {isBatchExpirationModalOpen && receivedDeliveryData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Batch Expiration Dates</h2>
                    <p className="text-white/80 text-sm mt-1">Enter expiration dates for each product batch</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsBatchExpirationModalOpen(false);
                    setBatchExpirationDates({});
                    setReceivedDeliveryData(null);
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
                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-1 text-blue-900">Batch Expiration Tracking</p>
                      <p className="text-sm text-blue-700">
                        Each product will be tracked in batches with the expiration date you specify. 
                        The system will use FIFO (First In, First Out) to manage stock rotation, using the oldest batches first.
                        Leave expiration date empty if the product doesn't expire.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expiration Dates Table */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Expiration Dates</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quantity</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiration Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {receivedDeliveryData.items && receivedDeliveryData.items.length > 0 ? (
                          receivedDeliveryData.items.map((item, index) => (
                            <tr key={item.productId || index} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{item.productName}</div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="text-gray-900 font-medium">{item.quantity}</div>
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  type="date"
                                  value={batchExpirationDates[item.productId] || ''}
                                  onChange={(e) => {
                                    setBatchExpirationDates(prev => ({
                                      ...prev,
                                      [item.productId]: e.target.value
                                    }));
                                  }}
                                  className="w-full"
                                  min={new Date().toISOString().split('T')[0]}
                                />
                                {batchExpirationDates[item.productId] && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {format(new Date(batchExpirationDates[item.productId]), 'MMM dd, yyyy')}
                                  </p>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="3" className="px-4 py-4 text-center text-gray-500">No items</td>
                          </tr>
                        )}
                      </tbody>
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
                  onClick={async () => {
                    // Skip batch creation - just close modal
                    setIsBatchExpirationModalOpen(false);
                    setBatchExpirationDates({});
                    setReceivedDeliveryData(null);
                    toast.success('Delivery received. Batch creation skipped.');
                  }}
                  disabled={isProcessing}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Skip
                </Button>
                <Button
                  onClick={async () => {
                    if (!receivedDeliveryData) return;
                    
                    try {
                      setIsProcessing(true);
                      setError(null);

                      // Prepare items with expiration dates
                      const itemsWithExpiration = receivedDeliveryData.items.map(item => ({
                        ...item,
                        expirationDate: batchExpirationDates[item.productId] || null
                      }));

                      // Create batches
                      const deliveryData = {
                        ...receivedDeliveryData,
                        items: itemsWithExpiration
                      };

                      const batchesResult = await inventoryService.createProductBatches(deliveryData);
                      
                      if (!batchesResult.success) {
                        throw new Error(batchesResult.message || 'Failed to create product batches');
                      }

                      toast.success(`Successfully created ${batchesResult.batchesCreated || itemsWithExpiration.length} batch(es)!`);
                      
                      // Close modal and reset
                      setIsBatchExpirationModalOpen(false);
                      setBatchExpirationDates({});
                      setReceivedDeliveryData(null);
                    } catch (err) {
                      console.error('Error creating batches:', err);
                      setError(err.message || 'Failed to create batches. Please try again.');
                      toast.error(err.message || 'Failed to create batches');
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  disabled={isProcessing}
                  className="bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Batches...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Create Batches
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Deliveries;

