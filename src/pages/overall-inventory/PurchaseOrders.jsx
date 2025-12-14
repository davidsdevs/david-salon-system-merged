// Purchase Orders Approval Page for Overall Inventory Controller
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  ShoppingCart,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Banknote,
  RefreshCw,
  AlertTriangle,
  FileText,
  X,
  Truck,
  Calendar,
  Package,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { inventoryService } from '../../services/inventoryService';

const OverallInventoryControllerPurchaseOrders = () => {
  const { userData } = useAuth();

  // Data states
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [branchStocks, setBranchStocks] = useState([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [isConfirmApproveModalOpen, setIsConfirmApproveModalOpen] = useState(false);
  const [isConfirmRejectModalOpen, setIsConfirmRejectModalOpen] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState(null);

  // Load purchase orders that need approval (created by Inventory Controller, status = Received)
  useEffect(() => {
    loadPurchaseOrders();
  }, []);

  const loadPurchaseOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const purchaseOrdersRef = collection(db, 'purchaseOrders');
      // Load all orders created by Inventory Controllers (not just Received)
      const q = query(
        purchaseOrdersRef,
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
          receivedAt: data.receivedAt?.toDate ? data.receivedAt.toDate() : (data.receivedAt ? new Date(data.receivedAt) : null),
          approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate() : (data.approvedAt ? new Date(data.approvedAt) : null),
          rejectedAt: data.rejectedAt?.toDate ? data.rejectedAt.toDate() : (data.rejectedAt ? new Date(data.rejectedAt) : null),
          rejectionNote: data.rejectionNote || null,
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
      setError(err.message);
    } finally {
      setLoading(false);
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

      return matchesSearch && matchesStatus;
    });
  }, [purchaseOrders, searchTerm, selectedStatus]);

  // Purchase order statistics
  const orderStats = useMemo(() => {
    return {
      totalOrders: purchaseOrders.length,
      pendingApproval: purchaseOrders.filter(o => o.status === 'Received').length,
      approvedOrders: purchaseOrders.filter(o => o.status === 'Approved' || o.status === 'In Transit').length,
      rejectedOrders: purchaseOrders.filter(o => o.status === 'Rejected').length,
      totalValue: purchaseOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
    };
  }, [purchaseOrders]);

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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending': return <Clock className="h-3 w-3" />;
      case 'Received': return <CheckCircle className="h-3 w-3" />;
      case 'Approved': return <CheckCircle className="h-3 w-3" />;
      case 'In Transit': return <Truck className="h-3 w-3" />;
      case 'Rejected': return <XCircle className="h-3 w-3" />;
      case 'Shipped': return <Truck className="h-3 w-3" />;
      case 'Delivered': return <CheckCircle className="h-3 w-3" />;
      case 'Cancelled': return <XCircle className="h-3 w-3" />;
      case 'Overdue': return <AlertTriangle className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  // Open approve confirmation modal
  const handleOpenApproveModal = (orderId) => {
    setPendingOrderId(orderId);
    setIsConfirmApproveModalOpen(true);
  };

  // Handle approve order (after confirmation)
  const handleApproveOrder = async () => {
    if (!pendingOrderId) return;
    
    try {
      setIsProcessing(true);
      setError(null);
      const orderRef = doc(db, 'purchaseOrders', pendingOrderId);
      await updateDoc(orderRef, {
        status: 'In Transit',
        approvedBy: userData.uid || userData.id,
        approvedByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await loadPurchaseOrders();
      setIsConfirmApproveModalOpen(false);
      setIsDetailsModalOpen(false);
      setSelectedOrder(null);
      setBranchStocks([]);
      setPendingOrderId(null);
    } catch (err) {
      console.error('Error approving order:', err);
      setError('Failed to approve order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Open reject modal
  const handleOpenRejectModal = (order) => {
    setSelectedOrder(order);
    setRejectionNote('');
    setIsRejectModalOpen(true);
  };

  // Handle reject order confirmation (opens confirmation modal after note is entered)
  const handleRejectOrderConfirm = () => {
    if (!selectedOrder || !rejectionNote.trim()) {
      setError('Rejection note is required');
      return;
    }
    setIsConfirmRejectModalOpen(true);
  };

  // Handle reject order with note (after confirmation)
  const handleRejectOrder = async () => {
    if (!selectedOrder || !rejectionNote.trim()) {
      setError('Rejection note is required');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      const orderRef = doc(db, 'purchaseOrders', selectedOrder.id);
      await updateDoc(orderRef, {
        status: 'Rejected',
        rejectedBy: userData.uid || userData.id,
        rejectedByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        rejectedAt: serverTimestamp(),
        rejectionNote: rejectionNote.trim(),
        updatedAt: serverTimestamp()
      });
      await loadPurchaseOrders();
      setIsConfirmRejectModalOpen(false);
      setIsRejectModalOpen(false);
      setIsDetailsModalOpen(false);
      setSelectedOrder(null);
      setRejectionNote('');
    } catch (err) {
      console.error('Error rejecting order:', err);
      setError('Failed to reject order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Check if order can be approved/rejected (Only Pending status - Received orders cannot be approved again)
  const canApproveOrReject = (order) => {
    return order.status === 'Pending';
  };

  // Load branch stocks when viewing order details
  const loadBranchStocks = async (branchId) => {
    if (!branchId) {
      setBranchStocks([]);
      return;
    }

    try {
      setLoadingStocks(true);
      const result = await inventoryService.getBranchStocks(branchId);
      if (result.success) {
        setBranchStocks(result.stocks);
      } else {
        setBranchStocks([]);
      }
    } catch (err) {
      console.error('Error loading branch stocks:', err);
      setBranchStocks([]);
    } finally {
      setLoadingStocks(false);
    }
  };

  // Get current stock for a product
  const getCurrentStock = (productId) => {
    const stock = branchStocks.find(s => s.productId === productId);
    return stock ? stock.currentStock || 0 : null;
  };

  // Get stock status indicator
  const getStockStatus = (productId, orderedQty) => {
    const currentStock = getCurrentStock(productId);
    if (currentStock === null) return { text: 'No stock data', color: 'text-gray-500', icon: null };
    
    const stock = branchStocks.find(s => s.productId === productId);
    const minStock = stock?.minStock || 0;
    
    if (currentStock <= minStock) {
      return { text: `Low (${currentStock})`, color: 'text-red-600', icon: <TrendingDown className="h-3 w-3" /> };
    } else if (currentStock < orderedQty) {
      return { text: `Current: ${currentStock}`, color: 'text-amber-600', icon: <AlertTriangle className="h-3 w-3" /> };
    } else {
      return { text: `Current: ${currentStock}`, color: 'text-green-600', icon: <CheckCircle className="h-3 w-3" /> };
    }
  };

  // Handle open details modal
  const handleOpenDetailsModal = (order) => {
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
    if (order.branchId) {
      loadBranchStocks(order.branchId);
    }
  };

  if (loading && purchaseOrders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-[#160B53]" />
        <span className="ml-2 text-gray-600">Loading purchase orders...</span>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders Approval</h1>
          <p className="text-gray-600">Review and approve/reject purchase orders from Inventory Controllers</p>
        </div>
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
              <p className="text-sm font-medium text-gray-600">Pending Approval</p>
              <p className="text-xl font-bold text-gray-900">{orderStats.pendingApproval}</p>
            </div>
          </div>
        </Card>
          
        <Card className="p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-xl font-bold text-gray-900">{orderStats.approvedOrders}</p>
            </div>
          </div>
        </Card>
          
        <Card className="p-4">
          <div className="flex items-center">
            <XCircle className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Rejected</p>
              <p className="text-xl font-bold text-gray-900">{orderStats.rejectedOrders}</p>
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
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setSelectedStatus('all');
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
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">₱{(order.totalAmount || 0).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.createdByName || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">Inventory Controller</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDetailsModal(order)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                        {canApproveOrReject(order) && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleOpenApproveModal(order.id)}
                              disabled={isProcessing}
                              className="bg-green-600 text-white hover:bg-green-700"
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleOpenRejectModal(order)}
                              disabled={isProcessing}
                              className="bg-red-600 text-white hover:bg-red-700"
                            >
                              Reject
                            </Button>
                          </>
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
    </div>

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
                  setBranchStocks([]);
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
                    <p className="text-xs text-gray-500">Inventory Controller</p>
                  </div>
                  {selectedOrder.receivedByName && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Received By</label>
                      <p className="text-gray-900">{selectedOrder.receivedByName}</p>
                      {selectedOrder.receivedAt && (
                        <p className="text-xs text-gray-500">
                          {format(new Date(selectedOrder.receivedAt), 'MMM dd, yyyy HH:mm')}
                        </p>
                      )}
                    </div>
                  )}
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

              {/* Branch Stock Info */}
              {selectedOrder.branchId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-blue-600" />
                      <h4 className="font-semibold text-blue-900">Branch Current Stock</h4>
                    </div>
                    {loadingStocks ? (
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                    ) : (
                      <span className="text-sm text-blue-700">
                        {branchStocks.length} products tracked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Current stock levels help determine if this order is justified
                  </p>
                </div>
              )}

              {/* Order Items */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Ordered Qty</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedOrder.items && selectedOrder.items.length > 0 ? (
                        selectedOrder.items.map((item, index) => {
                          const stockStatus = getStockStatus(item.productId, item.quantity);
                          const currentStock = getCurrentStock(item.productId);
                            
                          return (
                            <tr key={index} className={currentStock !== null && currentStock <= (branchStocks.find(s => s.productId === item.productId)?.minStock || 0) ? 'bg-red-50' : ''}>
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{item.productName}</div>
                                {item.sku && (
                                  <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="text-gray-900 font-medium">{item.quantity}</div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {loadingStocks ? (
                                  <RefreshCw className="h-4 w-4 animate-spin text-gray-400 mx-auto" />
                                ) : (
                                  <div className={`flex items-center justify-center gap-1 ${stockStatus.color}`}>
                                    {stockStatus.icon}
                                    <span className="text-sm font-medium">{stockStatus.text}</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-900">₱{(item.unitPrice || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-900">₱{(item.totalPrice || 0).toLocaleString()}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="5" className="px-4 py-4 text-center text-gray-500">No items</td>
                        </tr>
                      )}
                    </tbody>
                    {selectedOrder.items && selectedOrder.items.length > 0 && (
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan="4" className="px-4 py-3 text-right font-semibold text-gray-900">Total:</td>
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
              {canApproveOrReject(selectedOrder) && (
                <>
                  <Button
                    onClick={() => handleOpenRejectModal(selectedOrder)}
                    disabled={isProcessing}
                    className="bg-red-600 text-white hover:bg-red-700"
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleOpenApproveModal(selectedOrder.id)}
                    disabled={isProcessing}
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    Approve
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  setSelectedOrder(null);
                  setBranchStocks([]);
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

    {/* Rejection Modal */}
    {isRejectModalOpen && selectedOrder && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-100">
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white/20 rounded-lg">
                  <XCircle className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Reject Purchase Order</h2>
                  <p className="text-white/80 text-sm mt-1">{selectedOrder.orderId || selectedOrder.id}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setRejectionNote('');
                  setError(null);
                }}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <p className="text-red-800 flex-1 text-sm">{error}</p>
                <Button variant="ghost" size="sm" onClick={() => setError(null)} className="text-red-600 hover:text-red-700 flex-shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="font-semibold text-blue-900">Order: {selectedOrder.orderId || selectedOrder.id}</p>
                <p className="text-sm text-blue-700">Supplier: {selectedOrder.supplierName || 'Unknown'}</p>
                <p className="text-sm text-blue-700">Total: ₱{(selectedOrder.totalAmount || 0).toLocaleString()}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Note <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  placeholder="Please provide a reason for rejecting this purchase order..."
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">This note will be visible to the Inventory Controller and Branch Manager.</p>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setRejectionNote('');
                  setError(null);
                }}
                disabled={isProcessing}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRejectOrderConfirm}
                disabled={isProcessing || !rejectionNote.trim()}
                className="bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="h-4 w-4" />
                Continue to Confirm
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Approve Confirmation Modal */}
    {isConfirmApproveModalOpen && pendingOrderId && (() => {
      const orderToApprove = purchaseOrders.find(o => o.id === pendingOrderId);
      if (!orderToApprove) return null;
      
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-100">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Confirm Approval</h2>
                    <p className="text-white/90 text-sm mt-1">Are you sure you want to approve this purchase order?</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsConfirmApproveModalOpen(false);
                    setPendingOrderId(null);
                  }}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="space-y-4">
                {/* Order Summary */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order ID:</span>
                      <span className="font-medium text-gray-900">{orderToApprove.orderId || orderToApprove.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Supplier:</span>
                      <span className="font-medium text-gray-900">{orderToApprove.supplierName || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order Date:</span>
                      <span className="font-medium text-gray-900">
                        {orderToApprove.orderDate ? format(new Date(orderToApprove.orderDate), 'MMM dd, yyyy') : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expected Delivery:</span>
                      <span className="font-medium text-gray-900">
                        {orderToApprove.expectedDelivery ? format(new Date(orderToApprove.expectedDelivery), 'MMM dd, yyyy') : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Number of Items:</span>
                      <span className="font-medium text-gray-900">{orderToApprove.items?.length || 0}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-300">
                      <span className="font-semibold text-gray-900">Total Amount:</span>
                      <span className="text-lg font-bold text-green-600">₱{(orderToApprove.totalAmount || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>Note:</strong> Approving this order will change its status to "In Transit" and notify the Inventory Controller. 
                    This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsConfirmApproveModalOpen(false);
                    setPendingOrderId(null);
                  }}
                  disabled={isProcessing}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleApproveOrder}
                  disabled={isProcessing}
                  className="bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Confirm Approval
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    })()}

    {/* Reject Confirmation Modal */}
    {isConfirmRejectModalOpen && selectedOrder && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-100">
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white/20 rounded-lg">
                  <XCircle className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Confirm Rejection</h2>
                  <p className="text-white/90 text-sm mt-1">Are you sure you want to reject this purchase order?</p>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsConfirmRejectModalOpen(false);
                }}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="p-6">
            <div className="space-y-4">
              {/* Order Summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order ID:</span>
                    <span className="font-medium text-gray-900">{selectedOrder.orderId || selectedOrder.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Supplier:</span>
                    <span className="font-medium text-gray-900">{selectedOrder.supplierName || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-medium text-gray-900">₱{(selectedOrder.totalAmount || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Rejection Note Preview */}
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-900 mb-2">Rejection Reason</h3>
                <p className="text-sm text-red-800 whitespace-pre-wrap">{rejectionNote}</p>
                <p className="text-xs text-red-600 mt-2">
                  <strong>Note:</strong> This rejection reason will be visible to the Inventory Controller and Branch Manager.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Warning:</strong> Rejecting this order will change its status to "Rejected" and notify the Inventory Controller. 
                  This action cannot be undone.
                </p>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsConfirmRejectModalOpen(false);
                }}
                disabled={isProcessing}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRejectOrder}
                disabled={isProcessing}
                className="bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    Confirm Rejection
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

export default OverallInventoryControllerPurchaseOrders;


