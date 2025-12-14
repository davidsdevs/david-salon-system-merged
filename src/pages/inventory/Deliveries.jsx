import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Banknote,
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
import { productService } from '../../services/productService';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';

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
  const [isConfirmReceiptModalOpen, setIsConfirmReceiptModalOpen] = useState(false);
  
  // Batch expiration modal states
  const [isBatchExpirationModalOpen, setIsBatchExpirationModalOpen] = useState(false);
  const [batchExpirationDates, setBatchExpirationDates] = useState({}); // { productId: expirationDate }
  const [receivedDeliveryData, setReceivedDeliveryData] = useState(null); // Store delivery data after receiving
  
  // Receipt modal states
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const receiptRef = useRef();
  
  // Print handler
  const handlePrint = useReactToPrint({
    content: () => receiptRef.current,
    documentTitle: receiptData ? `Delivery_Receipt_${receiptData.receiptNumber}` : 'Delivery_Receipt',
    onBeforeGetContent: () => {
      return Promise.resolve();
    }
  });

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
    // Use index-based unique key to handle same product with different usage types
    const initialQuantities = {};
    const initialChecked = {};
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item, index) => {
        const uniqueKey = `${item.productId}_${item.usageType || 'otc'}_${index}`;
        initialQuantities[uniqueKey] = item.quantity || 0;
        initialChecked[uniqueKey] = false;
      });
    }
    setReceivedQuantities(initialQuantities);
    setCheckedItems(initialChecked);
    setReceivingNotes('');
    setIsReceivingModalOpen(true);
  };

  // Get unique key for an item
  const getItemKey = (item, index) => {
    return `${item.productId}_${item.usageType || 'otc'}_${index}`;
  };

  // Calculate discrepancy for an item
  const calculateDiscrepancy = (item, index) => {
    const orderedQty = item.quantity || 0;
    const uniqueKey = getItemKey(item, index);
    const receivedQty = receivedQuantities[uniqueKey] || 0;
    return receivedQty - orderedQty;
  };

  // Check if at least one item is checked
  const atLeastOneItemChecked = useMemo(() => {
    if (!selectedOrder || !selectedOrder.items) return false;
    return selectedOrder.items.some((item, index) => {
      const uniqueKey = getItemKey(item, index);
      return checkedItems[uniqueKey] === true;
    });
  }, [selectedOrder, checkedItems]);

  // Count checked items
  const checkedItemsCount = useMemo(() => {
    if (!selectedOrder || !selectedOrder.items) return 0;
    return selectedOrder.items.filter((item, index) => {
      const uniqueKey = getItemKey(item, index);
      return checkedItems[uniqueKey] === true;
    }).length;
  }, [selectedOrder, checkedItems]);

  // Handle receive delivery (called after confirmation)
  const handleReceiveDelivery = async () => {
    if (!selectedOrder || !selectedOrder.items || selectedOrder.items.length === 0) {
      setError('Invalid order data');
      return;
    }

    // Validate that at least one item is checked
    if (!atLeastOneItemChecked) {
      setError('Please check at least one item before receiving the delivery');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // Prepare receiving data - only include checked items
      const receivingData = {
        purchaseOrderId: selectedOrder.orderId || selectedOrder.id,
        purchaseOrderDocId: selectedOrder.id,
        branchId: userData.branchId,
        supplierId: selectedOrder.supplierId,
        supplierName: selectedOrder.supplierName,
        items: selectedOrder.items
          .map((item, index) => {
            const uniqueKey = getItemKey(item, index);
            const orderedQty = item.quantity || 0;
            const receivedQty = receivedQuantities[uniqueKey] || 0;
            const discrepancy = receivedQty - orderedQty;
            const isChecked = checkedItems[uniqueKey] === true;
            
            return {
              productId: item.productId,
              productName: item.productName,
              sku: item.sku || null,
              usageType: item.usageType || 'otc',
              orderedQuantity: orderedQty,
              receivedQuantity: receivedQty,
              discrepancy: discrepancy,
              unitPrice: item.unitPrice || 0,
              checked: isChecked
            };
          })
          .filter(item => item.checked === true), // Only include checked items
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
      // Use unique keys to get received quantities and fetch shelf life
      // Only include checked items
      const deliveryItems = [];
      const productShelfLives = {}; // Store shelf life for each product
      
      // Get checked items first
      const checkedItemsList = selectedOrder.items.filter((item, index) => {
        const uniqueKey = getItemKey(item, index);
        return checkedItems[uniqueKey] === true;
      });
      
      // Fetch shelf life for all checked products in parallel
      const shelfLifePromises = checkedItemsList.map(async (item, index) => {
        // Find original index in selectedOrder.items
        const originalIndex = selectedOrder.items.findIndex((origItem, origIdx) => {
          const origKey = getItemKey(origItem, origIdx);
          const checkKey = getItemKey(item, index);
          return origKey === checkKey;
        });
        const uniqueKey = getItemKey(item, originalIndex >= 0 ? originalIndex : index);
        const receivedQty = receivedQuantities[uniqueKey] || 0;
        
        if (receivedQty > 0) {
          try {
            const productResult = await productService.getProductById(item.productId);
            if (productResult.success && productResult.product?.shelfLife) {
              return { uniqueKey, shelfLife: productResult.product.shelfLife };
            }
          } catch (err) {
            console.error(`Error fetching shelf life for product ${item.productId}:`, err);
          }
        }
        return null;
      });
      
      const shelfLifeResults = await Promise.all(shelfLifePromises);
      shelfLifeResults.forEach(result => {
        if (result) {
          productShelfLives[result.uniqueKey] = result.shelfLife;
        }
      });
      
      // Build delivery items - only checked items
      selectedOrder.items.forEach((item, index) => {
        const uniqueKey = getItemKey(item, index);
        const orderedQty = item.quantity || 0;
        const receivedQty = receivedQuantities[uniqueKey] || 0;
        const isChecked = checkedItems[uniqueKey] === true;
        
        if (receivedQty > 0 && isChecked) {
          deliveryItems.push({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku || null,
            usageType: item.usageType || 'otc',
            quantity: receivedQty,
            unitPrice: item.unitPrice || 0
          });
        }
      });

      const deliveryData = {
        purchaseOrderId: selectedOrder.orderId || selectedOrder.id,
        purchaseOrderDocId: selectedOrder.id,
        branchId: userData.branchId,
        supplierId: selectedOrder.supplierId,
        supplierName: selectedOrder.supplierName,
        receivedBy: userData.uid || userData.id,
        receivedByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        items: deliveryItems,
        receivedAt: new Date(),
        productShelfLives: productShelfLives // Store shelf life info
      };

      setReceivedDeliveryData(deliveryData);

      // Calculate totals for receipt
      const orderedTotal = receivingData.items.reduce((sum, item) => 
        sum + (item.orderedQuantity * item.unitPrice), 0
      );
      const receivedTotal = receivingData.items.reduce((sum, item) => 
        sum + (item.receivedQuantity * item.unitPrice), 0
      );
      const discrepancyAmount = receivedTotal - orderedTotal;
      
      setReceiptData({
        receiptNumber: `DR-${selectedOrder.orderId || selectedOrder.id}-${Date.now()}`,
        purchaseOrderId: selectedOrder.orderId || selectedOrder.id,
        supplierName: selectedOrder.supplierName,
        supplierId: selectedOrder.supplierId,
        orderDate: selectedOrder.orderDate ? format(new Date(selectedOrder.orderDate), 'MMM dd, yyyy') : 'N/A',
        receivedDate: format(new Date(), 'MMM dd, yyyy HH:mm'),
        receivedBy: deliveryData.receivedByName,
        items: receivingData.items,
        orderedTotal: orderedTotal,
        receivedTotal: receivedTotal,
        discrepancyAmount: discrepancyAmount,
        totalAmount: receivedTotal, // Amount to pay is based on what was actually received
        notes: receivingNotes.trim(),
        branchId: userData.branchId
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
      // Fetch product shelf life and calculate default expiration dates
      const initialExpirationDates = {};
      const receivedDate = new Date();
      
      // Fetch product data for each CHECKED item to get shelf life and calculate expiration dates
      const expirationPromises = selectedOrder.items.map(async (item, index) => {
        const uniqueKey = getItemKey(item, index);
        const receivedQty = receivedQuantities[uniqueKey] || 0;
        const isChecked = checkedItems[uniqueKey] === true;
        
        if (receivedQty > 0 && isChecked) {
          try {
            // Fetch product to get shelf life
            const productResult = await productService.getProductById(item.productId);
            let defaultExpiration = new Date();
            
            if (productResult.success && productResult.product?.shelfLife) {
              // Parse shelf life (e.g., "24 months" -> 24, or just "24" -> 24)
              const shelfLifeStr = productResult.product.shelfLife.toString().toLowerCase().trim();
              
              // Try to match "24 months" or "24" format
              let months = null;
              const monthsMatch = shelfLifeStr.match(/(\d+)\s*(?:month|months|mo)/);
              if (monthsMatch) {
                months = parseInt(monthsMatch[1], 10);
              } else {
                // Try to parse as just a number (assume it's months)
                const numberMatch = shelfLifeStr.match(/^(\d+)$/);
                if (numberMatch) {
                  months = parseInt(numberMatch[1], 10);
                }
              }
              
              if (months && months > 0) {
                // Add months to received date - handle year rollover correctly
                defaultExpiration = new Date(receivedDate);
                const currentYear = defaultExpiration.getFullYear();
                const currentMonth = defaultExpiration.getMonth();
                const currentDate = defaultExpiration.getDate();
                
                // Calculate new month and year
                const newMonth = currentMonth + months;
                const newYear = currentYear + Math.floor(newMonth / 12);
                const finalMonth = newMonth % 12;
                
                // Create new date with correct year and month
                defaultExpiration = new Date(newYear, finalMonth, currentDate);
              } else {
                // If no valid format found, default to 1 year
                defaultExpiration.setFullYear(defaultExpiration.getFullYear() + 1);
              }
            } else {
              // If no shelf life found, default to 1 year
              defaultExpiration.setFullYear(defaultExpiration.getFullYear() + 1);
            }
            
            return { uniqueKey, expirationDate: defaultExpiration.toISOString().split('T')[0] };
          } catch (err) {
            console.error(`Error fetching product ${item.productId} for shelf life:`, err);
            // Default to 1 year if error
            const defaultExpiration = new Date();
            defaultExpiration.setFullYear(defaultExpiration.getFullYear() + 1);
            return { uniqueKey, expirationDate: defaultExpiration.toISOString().split('T')[0] };
          }
        }
        return null;
      });
      
      const expirationResults = await Promise.all(expirationPromises);
      expirationResults.forEach(result => {
        if (result) {
          initialExpirationDates[result.uniqueKey] = result.expirationDate;
        }
      });
      
      setBatchExpirationDates(initialExpirationDates);
      setError(null); // Clear any previous errors
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
              <Banknote className="h-8 w-8 text-green-600" />
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
                        ? 'No deliveries in transit. Purchase orders will appear here after being approved by the Overall Inventory Controller.'
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
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Usage Type</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ordered Qty</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Received Qty</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Discrepancy</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedOrder.items && selectedOrder.items.length > 0 ? (
                          selectedOrder.items.map((item, index) => {
                            const uniqueKey = getItemKey(item, index);
                            const discrepancy = calculateDiscrepancy(item, index);
                            const discrepancyClass = discrepancy > 0 ? 'text-green-600 font-semibold' : discrepancy < 0 ? 'text-red-600 font-semibold' : 'text-gray-600';
                            const discrepancyText = discrepancy > 0 ? `+${discrepancy}` : discrepancy.toString();
                            const usageType = item.usageType || 'otc';
                            
                            return (
                              <tr key={uniqueKey} className={checkedItems[uniqueKey] ? 'bg-green-50' : 'hover:bg-gray-50'}>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => {
                                      setCheckedItems(prev => ({
                                        ...prev,
                                        [uniqueKey]: !prev[uniqueKey]
                                      }));
                                    }}
                                    className="flex items-center justify-center"
                                  >
                                    {checkedItems[uniqueKey] ? (
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
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    usageType === 'salon-use' 
                                      ? 'bg-blue-100 text-blue-800' 
                                      : 'bg-green-100 text-green-800'
                                  }`}>
                                    {usageType === 'salon-use' ? 'Salon Use' : 'OTC'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="text-gray-900 font-medium">{item.quantity || 0}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={receivedQuantities[uniqueKey] || 0}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value) || 0;
                                      setReceivedQuantities(prev => ({
                                        ...prev,
                                        [uniqueKey]: value
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                  />
                </div>

                {/* Summary */}
                <div className="space-y-4">
                  {/* Items Checked Status */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Items Checked</p>
                        <p className="text-lg font-bold text-gray-900">
                          {selectedOrder.items ? selectedOrder.items.filter((item, index) => {
                            const uniqueKey = getItemKey(item, index);
                            return checkedItems[uniqueKey] === true;
                          }).length : 0} / {selectedOrder.items?.length || 0}
                        </p>
                      </div>
                      {!atLeastOneItemChecked && (
                        <div className="flex items-center gap-2 text-amber-600">
                          <AlertTriangle className="h-5 w-5" />
                          <span className="text-sm font-medium">Please check at least one item</span>
                        </div>
                      )}
                      {atLeastOneItemChecked && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-5 w-5" />
                          <span className="text-sm font-medium">
                            {checkedItemsCount === selectedOrder.items?.length 
                              ? 'All items checked' 
                              : `${checkedItemsCount} item${checkedItemsCount > 1 ? 's' : ''} checked`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Amount Summary */}
                  {(() => {
                    // Calculate totals only for checked items
                    const orderedTotal = selectedOrder.items?.reduce((sum, item, index) => {
                      const uniqueKey = getItemKey(item, index);
                      const isChecked = checkedItems[uniqueKey] === true;
                      if (!isChecked) return sum; // Skip unchecked items
                      const orderedQty = item.quantity || 0;
                      const unitPrice = item.unitPrice || 0;
                      return sum + (orderedQty * unitPrice);
                    }, 0) || 0;

                    const receivedTotal = selectedOrder.items?.reduce((sum, item, index) => {
                      const uniqueKey = getItemKey(item, index);
                      const isChecked = checkedItems[uniqueKey] === true;
                      if (!isChecked) return sum; // Skip unchecked items
                      const receivedQty = receivedQuantities[uniqueKey] || 0;
                      const unitPrice = item.unitPrice || 0;
                      return sum + (receivedQty * unitPrice);
                    }, 0) || 0;

                    const discrepancyAmount = receivedTotal - orderedTotal;

                    return (
                      <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Amount Summary</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700">
                              Original Order Total {checkedItemsCount < (selectedOrder.items?.length || 0) ? '(Checked Items Only)' : ''}:
                            </span>
                            <span className="text-base font-semibold text-gray-900">₱{orderedTotal.toLocaleString()}</span>
                          </div>
                          {discrepancyAmount !== 0 && (
                            <div className={`flex justify-between items-center ${
                              discrepancyAmount > 0 ? 'text-green-700' : 'text-red-700'
                            }`}>
                              <span className="text-sm font-medium">
                                {discrepancyAmount > 0 ? 'Over-delivery Adjustment:' : 'Short-delivery Adjustment:'}
                              </span>
                              <span className="text-base font-semibold">
                                {discrepancyAmount > 0 ? '+' : ''}₱{Math.abs(discrepancyAmount).toLocaleString()}
                              </span>
                            </div>
                          )}
                          <div className="border-t-2 border-green-400 pt-3 mt-3">
                            <div className="flex justify-between items-center">
                              <span className="text-lg font-bold text-gray-900">Amount to Pay:</span>
                              <span className="text-2xl font-bold text-green-700">₱{receivedTotal.toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">Based on received quantities</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
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
                    onClick={() => {
                      if (!atLeastOneItemChecked) {
                        setError('Please check at least one item before confirming receipt');
                        return;
                      }
                      setIsConfirmReceiptModalOpen(true);
                    }}
                    disabled={isProcessing || !atLeastOneItemChecked}
                    className="bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Confirm Receipt
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
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Batch Expiration Dates</h2>
                  <p className="text-white/80 text-sm mt-1">Required: Enter expiration dates for each product batch</p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Error Display */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-900">Error</p>
                        <p className="text-sm text-red-700 mt-1">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-1 text-blue-900">Batch Expiration Tracking - Required</p>
                      <p className="text-sm text-blue-700">
                        Each product must have an expiration date specified. The system will use FIFO (First In, First Out) 
                        to manage stock rotation, using the oldest batches first. Expiration dates are required for proper 
                        inventory tracking and batch management.
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
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Usage Type</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quantity</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Shelf Life</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiration Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {receivedDeliveryData.items && receivedDeliveryData.items.length > 0 ? (
                          receivedDeliveryData.items.map((item, index) => {
                            // Create unique key for this item (same format as in receiving modal)
                            const uniqueKey = getItemKey(item, index);
                            const shelfLife = receivedDeliveryData.productShelfLives?.[uniqueKey] || null;
                            return (
                              <tr key={uniqueKey} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div className="font-medium text-gray-900">{item.productName}</div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    (item.usageType || 'otc') === 'salon-use' 
                                      ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                                      : 'bg-green-100 text-green-800 border border-green-200'
                                  }`}>
                                    {(item.usageType || 'otc') === 'salon-use' ? 'Salon Use' : 'OTC'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="text-gray-900 font-medium">{item.quantity}</div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {shelfLife ? (
                                    <span className="text-sm text-gray-700 font-medium">{shelfLife}</span>
                                  ) : (
                                    <span className="text-xs text-gray-400 italic">Not set</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <Input
                                    type="date"
                                    value={batchExpirationDates[uniqueKey] || ''}
                                    onChange={(e) => {
                                      setBatchExpirationDates(prev => ({
                                        ...prev,
                                        [uniqueKey]: e.target.value
                                      }));
                                    }}
                                    className={`w-full ${!batchExpirationDates[uniqueKey] ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
                                    min={new Date().toISOString().split('T')[0]}
                                    required
                                  />
                                  {!batchExpirationDates[uniqueKey] && (
                                    <p className="text-xs text-red-600 mt-1 font-medium">
                                      ⚠ Required field
                                    </p>
                                  )}
                                  {batchExpirationDates[uniqueKey] && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      {format(new Date(batchExpirationDates[uniqueKey]), 'MMM dd, yyyy')}
                                    </p>
                                  )}
                                  {shelfLife && batchExpirationDates[uniqueKey] && (
                                    <p className="text-xs text-green-600 mt-1">
                                      ✓ Based on {shelfLife} shelf life
                                    </p>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="5" className="px-4 py-4 text-center text-gray-500">No items</td>
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
                  onClick={async () => {
                    if (!receivedDeliveryData) return;
                    
                    // Validate that all items have expiration dates
                    const missingExpiration = receivedDeliveryData.items.find((item, index) => {
                      const uniqueKey = getItemKey(item, index);
                      return !batchExpirationDates[uniqueKey] || batchExpirationDates[uniqueKey].trim() === '';
                    });
                    
                    if (missingExpiration) {
                      setError('Please enter expiration dates for all products before proceeding.');
                      toast.error('All products must have expiration dates');
                      return;
                    }
                    
                    try {
                      setIsProcessing(true);
                      setError(null);

                      // Prepare items with expiration dates
                      // Use unique keys to get expiration dates
                      const itemsWithExpiration = receivedDeliveryData.items.map((item, index) => {
                        const uniqueKey = getItemKey(item, index);
                        return {
                          ...item,
                          expirationDate: batchExpirationDates[uniqueKey] || null
                        };
                      });

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
                      
                      // Close modal and show receipt
                      setIsBatchExpirationModalOpen(false);
                      setBatchExpirationDates({});
                      setReceivedDeliveryData(null);
                      setIsReceiptModalOpen(true);
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

      {/* Confirm Receipt Modal */}
      {isConfirmReceiptModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-100">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Confirm Delivery Receipt</h2>
                    <p className="text-white/80 text-sm mt-1">Please review before confirming</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setIsConfirmReceiptModalOpen(false)}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="space-y-4">
                {/* Warning if not all items checked */}
                {checkedItemsCount < (selectedOrder.items?.length || 0) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-900">Partial Delivery</p>
                        <p className="text-sm text-amber-700 mt-1">
                          Only {checkedItemsCount} out of {selectedOrder.items?.length || 0} items are checked. 
                          This means only the checked items were received. Unchecked items will not be processed.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Receipt Summary */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Receipt Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Purchase Order:</span>
                      <span className="font-medium text-gray-900">{selectedOrder.orderId || selectedOrder.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Supplier:</span>
                      <span className="font-medium text-gray-900">{selectedOrder.supplierName || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Items Checked:</span>
                      <span className="font-medium text-gray-900">
                        {checkedItemsCount} / {selectedOrder.items?.length || 0}
                      </span>
                    </div>
                    {(() => {
                      // Calculate total only for checked items
                      const receivedTotal = selectedOrder.items?.reduce((sum, item, index) => {
                        const uniqueKey = getItemKey(item, index);
                        const receivedQty = receivedQuantities[uniqueKey] || 0;
                        const unitPrice = item.unitPrice || 0;
                        const isChecked = checkedItems[uniqueKey] === true;
                        // Only count checked items
                        return isChecked ? sum + (receivedQty * unitPrice) : sum;
                      }, 0) || 0;
                      return (
                        <div className="flex justify-between pt-2 border-t border-gray-300">
                          <span className="font-semibold text-gray-900">Amount to Pay:</span>
                          <span className="text-lg font-bold text-green-700">₱{receivedTotal.toLocaleString()}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Notes */}
                {receivingNotes && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-blue-900 mb-1">Notes:</p>
                    <p className="text-sm text-blue-700">{receivingNotes}</p>
                  </div>
                )}

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    <strong>Are you sure you want to confirm this delivery receipt?</strong> This action will:
                  </p>
                  <ul className="list-disc list-inside text-sm text-gray-600 mt-2 space-y-1">
                    <li>Mark the checked items as received</li>
                    <li>Update the purchase order status</li>
                    <li>Create delivery receipt records</li>
                    <li>Proceed to batch expiration date entry</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsConfirmReceiptModalOpen(false)}
                  disabled={isProcessing}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    setIsConfirmReceiptModalOpen(false);
                    await handleReceiveDelivery();
                  }}
                  disabled={isProcessing}
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
                      Confirm & Process
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Receipt Modal */}
      {isReceiptModalOpen && receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Delivery Receipt</h2>
                    <p className="text-white/80 text-sm mt-1">Receipt #{receiptData.receiptNumber}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsReceiptModalOpen(false);
                    setReceiptData(null);
                  }}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Printable Receipt */}
              <div 
                ref={receiptRef} 
                className="bg-white p-8 max-w-3xl mx-auto"
                style={{
                  '@media print': {
                    padding: '20px',
                    margin: '0',
                    maxWidth: '100%'
                  }
                }}
              >
                {/* Receipt Header */}
                <div className="text-center mb-8 border-b-2 border-gray-300 pb-6">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">DELIVERY RECEIPT</h1>
                  <p className="text-gray-600">Receipt Number: {receiptData.receiptNumber}</p>
                </div>

                {/* Receipt Details */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Supplier Information</h3>
                    <p className="text-lg font-semibold text-gray-900">{receiptData.supplierName}</p>
                    <p className="text-sm text-gray-600">Supplier ID: {receiptData.supplierId}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Delivery Information</h3>
                    <p className="text-sm text-gray-900"><strong>Purchase Order:</strong> {receiptData.purchaseOrderId}</p>
                    <p className="text-sm text-gray-900"><strong>Order Date:</strong> {receiptData.orderDate}</p>
                    <p className="text-sm text-gray-900"><strong>Received Date:</strong> {receiptData.receivedDate}</p>
                    <p className="text-sm text-gray-900"><strong>Received By:</strong> {receiptData.receivedBy}</p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Items Received</h3>
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">#</th>
                        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Product Name</th>
                        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">SKU</th>
                        <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">Usage Type</th>
                        <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">Ordered</th>
                        <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">Received</th>
                        <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">Discrepancy</th>
                        <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">Unit Price</th>
                        <th className="border border-gray-300 px-4 py-2 text-right text-sm font-semibold text-gray-700">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receiptData.items.map((item, index) => {
                        const itemTotal = item.receivedQuantity * item.unitPrice;
                        const discrepancy = item.discrepancy || (item.receivedQuantity - item.orderedQuantity);
                        return (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="border border-gray-300 px-4 py-2 text-sm text-gray-900">{index + 1}</td>
                            <td className="border border-gray-300 px-4 py-2 text-sm text-gray-900">{item.productName}</td>
                            <td className="border border-gray-300 px-4 py-2 text-sm text-gray-600">{item.sku || 'N/A'}</td>
                            <td className="border border-gray-300 px-4 py-2 text-center text-sm">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                                item.usageType === 'salon-use'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {item.usageType === 'salon-use' ? 'Salon Use' : 'OTC'}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-center text-sm text-gray-900">{item.orderedQuantity}</td>
                            <td className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-900">{item.receivedQuantity}</td>
                            <td className={`border border-gray-300 px-4 py-2 text-center text-sm font-semibold ${
                              discrepancy > 0 ? 'text-green-600' : discrepancy < 0 ? 'text-red-600' : 'text-gray-900'
                            }`}>
                              {discrepancy > 0 ? `+${discrepancy}` : discrepancy}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-center text-sm text-gray-900">₱{item.unitPrice.toLocaleString()}</td>
                            <td className="border border-gray-300 px-4 py-2 text-right text-sm font-semibold text-gray-900">₱{itemTotal.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100">
                        <td colSpan="8" className="border border-gray-300 px-4 py-2 text-right text-sm font-semibold text-gray-900">Original Order Total:</td>
                        <td className="border border-gray-300 px-4 py-2 text-right text-sm text-gray-700">₱{receiptData.orderedTotal.toLocaleString()}</td>
                      </tr>
                      {receiptData.discrepancyAmount !== 0 && (
                        <tr className={receiptData.discrepancyAmount > 0 ? 'bg-yellow-50' : 'bg-red-50'}>
                          <td colSpan="8" className={`border border-gray-300 px-4 py-2 text-right text-sm font-semibold ${
                            receiptData.discrepancyAmount > 0 ? 'text-yellow-800' : 'text-red-800'
                          }`}>
                            {receiptData.discrepancyAmount > 0 ? 'Over-delivery Adjustment:' : 'Short-delivery Adjustment:'}
                          </td>
                          <td className={`border border-gray-300 px-4 py-2 text-right text-sm font-semibold ${
                            receiptData.discrepancyAmount > 0 ? 'text-yellow-800' : 'text-red-800'
                          }`}>
                            {receiptData.discrepancyAmount > 0 ? '+' : ''}₱{Math.abs(receiptData.discrepancyAmount).toLocaleString()}
                          </td>
                        </tr>
                      )}
                      <tr className="bg-green-100 font-bold border-t-2 border-gray-400">
                        <td colSpan="8" className="border border-gray-300 px-4 py-3 text-right text-lg font-bold text-gray-900">Amount to Pay:</td>
                        <td className="border border-gray-300 px-4 py-3 text-right text-xl font-bold text-green-700">₱{receiptData.totalAmount.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Notes */}
                {receiptData.notes && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Notes</h3>
                    <p className="text-sm text-gray-700 border border-gray-300 rounded p-3 bg-gray-50">{receiptData.notes}</p>
                  </div>
                )}

                {/* Receipt Footer */}
                <div className="border-t-2 border-gray-300 pt-6 mt-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Received By:</p>
                      <div className="border-t border-gray-300 pt-2">
                        <p className="text-sm font-semibold text-gray-900">{receiptData.receivedBy}</p>
                        <p className="text-xs text-gray-600">{receiptData.receivedDate}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Authorized Signature:</p>
                      <div className="border-t border-gray-300 pt-8">
                        <p className="text-xs text-gray-500">Signature</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Print Date */}
                <div className="text-center mt-6 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">Generated on {format(new Date(), 'MMM dd, yyyy HH:mm:ss')}</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50 flex-shrink-0">
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsReceiptModalOpen(false);
                    setReceiptData(null);
                  }}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    handlePrint();
                  }}
                  className="bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print / Save as PDF
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

