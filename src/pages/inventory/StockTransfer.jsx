// src/pages/06_InventoryController/StockTransfer.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import InventoryLayout from '../../layouts/InventoryLayout';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import { productService } from '../../services/productService';
import { getBranches } from '../../services/branchService';
import { inventoryService } from '../../services/inventoryService';
import { db } from '../../config/firebase';
import { collection, addDoc, getDocs, getDoc, query, where, orderBy, limit, startAfter, serverTimestamp, updateDoc, doc, writeBatch, getCountFromServer } from 'firebase/firestore';
import { 
  ArrowRightLeft,
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
  Clock,
  Package, 
  Calendar,
  Building,
  FileText,
  Truck,
  ArrowRight,
  Minus,
  Trash2,
  MapPin,
  Home, 
  TrendingUp,
  QrCode,
  ShoppingCart, 
  BarChart3, 
  Banknote,
  ClipboardList,
  UserCog,
  AlertCircle,
  PackageCheck,
  Printer
} from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel } from '../../utils/excelExport';
import { toast } from 'react-hot-toast';

const StockTransfer = () => {
  const { userData } = useAuth();

  
  
  // Data states
  const [transfers, setTransfers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination states for big data
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedTransferType, setSelectedTransferType] = useState('all'); // 'all', 'transfer', 'borrow'
  const [selectedFromBranch, setSelectedFromBranch] = useState('all');
  const [selectedToBranch, setSelectedToBranch] = useState('all');
  const [sortBy, setSortBy] = useState('transferDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateBorrowModalOpen, setIsCreateBorrowModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isReviewBorrowModalOpen, setIsReviewBorrowModalOpen] = useState(false);
  const [selectedBorrowRequest, setSelectedBorrowRequest] = useState(null);
  const [approvedItems, setApprovedItems] = useState([]); // Items selected for approval
  
  // Filter states
  const [filters, setFilters] = useState({
    status: 'all',
    fromBranch: 'all',
    toBranch: 'all',
    dateRange: { start: '', end: '' },
    valueRange: { min: '', max: '' },
    itemCountRange: { min: '', max: '' },
    transferType: 'all'
  });

  // Form states
  const [formData, setFormData] = useState({
    transferType: 'transfer', // 'transfer' or 'borrow'
    fromBranchId: '',
    toBranchId: '',
    toBranchName: '',
    toBranchHasSystem: false, // Flag for branches without system
    transferDate: new Date().toISOString().split('T')[0],
    expectedDelivery: '',
    reason: '',
    notes: '',
    items: []
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Product search for adding items
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [availableStocks, setAvailableStocks] = useState([]); // Stocks with realTimeStock > 0 (current branch)
  const [lendingBranchStocks, setLendingBranchStocks] = useState([]); // Stocks from the branch we're borrowing FROM (for borrow requests)
  const [pendingRequestsFromToBranch, setPendingRequestsFromToBranch] = useState([]); // Pending borrow requests FROM the selected To Branch TO current branch
  const [selectedRequestId, setSelectedRequestId] = useState(''); // Selected request ID for autofill
  const [productBatches, setProductBatches] = useState({}); // Store batches for each product: { productId: [{ batchId, batchNumber, remainingQuantity, expirationDate }] }

  // Mock transfer data
  const mockTransfers = [
    {
      id: 'TR-2024-001',
      fromBranchId: 'branch1',
      fromBranchName: 'Harbor Point Ayala',
      toBranchId: 'branch2',
      toBranchName: 'SM Mall of Asia',
      transferDate: new Date('2024-01-15'),
      expectedDelivery: new Date('2024-01-17'),
      actualDelivery: null,
      status: 'In Transit',
      reason: 'Stock Rebalancing',
      totalItems: 15,
      totalValue: 25000,
      items: [
        { productId: 'prod1', productName: 'Olaplex No.3 Hair Perfector', quantity: 10, unitCost: 1400, totalCost: 14000 },
        { productId: 'prod2', productName: 'L\'Oréal Hair Color', quantity: 5, unitCost: 800, totalCost: 4000 }
      ],
      notes: 'Urgent transfer needed',
      createdBy: 'John Smith',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15')
    },
    {
      id: 'TR-2024-002',
      fromBranchId: 'branch2',
      fromBranchName: 'SM Mall of Asia',
      toBranchId: 'branch3',
      toBranchName: 'Greenbelt 5',
      transferDate: new Date('2024-01-10'),
      expectedDelivery: new Date('2024-01-12'),
      actualDelivery: new Date('2024-01-11'),
      status: 'Completed',
      reason: 'Overstock',
      totalItems: 8,
      totalValue: 12000,
      items: [
        { productId: 'prod3', productName: 'Kerastase Shampoo', quantity: 8, unitCost: 1500, totalCost: 12000 }
      ],
      notes: 'Regular stock rebalancing',
      createdBy: 'Maria Santos',
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-01-11')
    },
    {
      id: 'TR-2024-003',
      fromBranchId: 'branch1',
      fromBranchName: 'Harbor Point Ayala',
      toBranchId: 'branch2',
      toBranchName: 'SM Mall of Asia',
      transferDate: new Date('2024-01-05'),
      expectedDelivery: new Date('2024-01-07'),
      actualDelivery: null,
      status: 'Pending',
      reason: 'Emergency Stock',
      totalItems: 12,
      totalValue: 18000,
      items: [
        { productId: 'prod4', productName: 'Wella Hair Color', quantity: 12, unitCost: 1500, totalCost: 18000 }
      ],
      notes: 'Emergency restock for weekend rush',
      createdBy: 'Carlos Mendoza',
      createdAt: new Date('2024-01-05'),
      updatedAt: new Date('2024-01-05')
    }
  ];

  // Mock branches and products
  const mockBranches = [
    { id: 'branch1', name: 'Harbor Point Ayala', address: 'Harbor Point, Ayala Center, Makati City' },
    { id: 'branch2', name: 'SM Mall of Asia', address: 'SM Mall of Asia, Pasay City' },
    { id: 'branch3', name: 'Greenbelt 5', address: 'Greenbelt 5, Makati City' }
  ];

  const mockProducts = [
    { id: 'prod1', name: 'Olaplex No.3 Hair Perfector', unitCost: 1400 },
    { id: 'prod2', name: 'L\'Oréal Hair Color', unitCost: 800 },
    { id: 'prod3', name: 'Kerastase Shampoo', unitCost: 1500 },
    { id: 'prod4', name: 'Wella Hair Color', unitCost: 1500 }
  ];

  // Reload transfers function (big data friendly with pagination)
  const reloadTransfers = async () => {
    try {
      setLoading(true);
      setCurrentPage(1);
      setLastVisible(null);
      setHasMore(false);
      
      const transfersRef = collection(db, 'stock_transfer');
      let baseQuery;
      
      // No orderBy to avoid composite index - fetch all and sort client-side
      baseQuery = query(transfersRef, limit(itemsPerPage));
      
      // Get total count
      try {
        const countQuery = query(transfersRef);
        const countSnapshot = await getCountFromServer(countQuery);
        setTotalItems(countSnapshot.data().count);
      } catch (countErr) {
        console.error('Error getting count:', countErr);
        setTotalItems(0);
      }
      
      // Fetch first page
      let transfersData = [];
      try {
        const transfersSnapshot = await getDocs(baseQuery);
        transfersData = transfersSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            transferType: data.transferType || 'transfer', // Default for existing data
            transferDate: data.transferDate?.toDate ? data.transferDate.toDate() : (data.transferDate ? new Date(data.transferDate) : new Date()),
            expectedDelivery: data.expectedDelivery?.toDate ? data.expectedDelivery.toDate() : (data.expectedDelivery ? new Date(data.expectedDelivery) : null),
            actualDelivery: data.actualDelivery?.toDate ? data.actualDelivery.toDate() : (data.actualDelivery ? new Date(data.actualDelivery) : null),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date())
          };
        });
        
        // Filter by branch involvement for non-admin users
        if (userData?.role !== 'systemAdmin' && userData?.role !== 'operationalManager') {
          transfersData = transfersData.filter(transfer => 
            transfer.fromBranchId === userData?.branchId || 
            transfer.toBranchId === userData?.branchId
          );
        }
        
        // Sort client-side by transferDate (descending)
        transfersData.sort((a, b) => {
          const dateA = new Date(a.transferDate).getTime();
          const dateB = new Date(b.transferDate).getTime();
          return dateB - dateA;
        });
        
        setLastVisible(transfersSnapshot.docs[transfersSnapshot.docs.length - 1]);
        setHasMore(transfersSnapshot.docs.length === itemsPerPage);
      } catch (transferError) {
        console.log('No stock transfers collection found or empty:', transferError);
        transfersData = [];
      }
      
      setTransfers(transfersData);
    } catch (err) {
      console.error('Error reloading transfers:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Load more transfers (pagination)
  const loadMoreTransfers = async () => {
    if (!hasMore || loadingMore || !lastVisible) return;
    
    try {
      setLoadingMore(true);
      const transfersRef = collection(db, 'stock_transfer');
      const nextQuery = query(transfersRef, limit(itemsPerPage), startAfter(lastVisible));
      
      const transfersSnapshot = await getDocs(nextQuery);
      const newTransfers = transfersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          transferType: data.transferType || 'transfer',
          transferDate: data.transferDate?.toDate ? data.transferDate.toDate() : (data.transferDate ? new Date(data.transferDate) : new Date()),
          expectedDelivery: data.expectedDelivery?.toDate ? data.expectedDelivery.toDate() : (data.expectedDelivery ? new Date(data.expectedDelivery) : null),
          actualDelivery: data.actualDelivery?.toDate ? data.actualDelivery.toDate() : (data.actualDelivery ? new Date(data.actualDelivery) : null),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date())
        };
      });
      
      // Filter by branch involvement for non-admin users
      if (userData?.role !== 'systemAdmin' && userData?.role !== 'operationalManager') {
        const filteredNew = newTransfers.filter(transfer => 
          transfer.fromBranchId === userData?.branchId || 
          transfer.toBranchId === userData?.branchId
        );
        setTransfers(prev => {
          const combined = [...prev, ...filteredNew].sort((a, b) => {
            const dateA = new Date(a.transferDate).getTime();
            const dateB = new Date(b.transferDate).getTime();
            return dateB - dateA;
          });
          return combined;
        });
      } else {
        setTransfers(prev => {
          const combined = [...prev, ...newTransfers].sort((a, b) => {
            const dateA = new Date(a.transferDate).getTime();
            const dateB = new Date(b.transferDate).getTime();
            return dateB - dateA;
          });
          return combined;
        });
      }
      
      setLastVisible(transfersSnapshot.docs[transfersSnapshot.docs.length - 1]);
      setHasMore(transfersSnapshot.docs.length === itemsPerPage);
      setCurrentPage(prev => prev + 1);
    } catch (err) {
      console.error('Error loading more transfers:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load branches (including those without system)
      try {
        const allBranches = await getBranches(
          userData?.role,
          userData?.uid,
          100 // Get all branches
        );
        // Filter to only active branches and ensure we have valid data
        const validBranches = Array.isArray(allBranches) 
          ? allBranches
              .filter(b => b && (b.isActive !== false) && (b.name || b.branchName))
              .map(b => {
                const branchName = b.name || b.branchName || 'Unknown';
                return {
                  ...b,
                  name: branchName,
                  branchName: branchName
                };
              })
          : [];
        setBranches(validBranches);
        console.log(`[StockTransfer] Loaded ${validBranches.length} branches`, validBranches);
      } catch (branchError) {
        console.error('Error loading branches:', branchError);
        // Try fallback: load directly from Firestore
        try {
          const branchesRef = collection(db, 'branches');
          const branchesSnapshot = await getDocs(branchesRef);
          const fallbackBranches = [];
          branchesSnapshot.forEach((doc) => {
            const branchData = doc.data();
            if (branchData && (branchData.isActive !== false)) {
              fallbackBranches.push({
                id: doc.id,
                name: branchData.name || branchData.branchName || 'Unknown',
                branchName: branchData.branchName || branchData.name || 'Unknown',
                ...branchData
              });
            }
          });
          setBranches(fallbackBranches);
          console.log(`[StockTransfer] Loaded ${fallbackBranches.length} branches (fallback)`);
        } catch (fallbackError) {
          console.error('Fallback branch loading failed:', fallbackError);
          setBranches([]);
        }
      }
      
      // Load stock transfers with pagination (big data friendly)
      await reloadTransfers();
      
      // Load products (for reference - needed for otcPrice)
      const productsResult = await productService.getAllProducts();
      let productsData = [];
      if (productsResult.success) {
        productsData = productsResult.products;
        setProducts(productsData);
      }
      
      // Load available stocks (products with realTimeStock > 0) ONLY for current branch
      if (userData?.branchId) {
        const stocksRef = collection(db, 'stocks');
        // Only get stocks from the current user's branch
        const stocksQuery = query(
          stocksRef,
          where('branchId', '==', userData.branchId),
          where('status', '==', 'active')
        );
        const stocksSnapshot = await getDocs(stocksQuery);
        const stocksData = stocksSnapshot.docs
          .map(doc => {
            const data = doc.data();
            // Get otcPrice from product if available, otherwise use 0
            const product = productsData.find(p => p.id === data.productId);
            return {
              id: doc.id,
              ...data,
              productId: data.productId,
              productName: data.productName,
              branchId: data.branchId, // Ensure branchId is included
              realTimeStock: data.realTimeStock || 0,
              otcPrice: product?.otcPrice || 0, // Use otcPrice from product
              unitCost: product?.otcPrice || 0, // Use otcPrice as unit cost
              usageType: data.usageType || (product?.otcPrice > 0 ? 'otc' : 'salon-use') // Include usageType
            };
          })
          .filter(stock => {
            // Double-check: only include stocks from current branch with available quantity
            return stock.branchId === userData.branchId && stock.realTimeStock > 0;
          });
        
        setAvailableStocks(stocksData);
      } else {
        // If no branch assigned, no stocks available
        setAvailableStocks([]);
      }
      
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Filter and sort transfers
  const filteredTransfers = transfers
    .filter(transfer => {
      const matchesSearch = transfer.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           transfer.fromBranchName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           transfer.toBranchName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           transfer.reason?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filters.status === 'all' || transfer.status === filters.status;
      
      // Handle transferType filter - if 'all', show all; otherwise match exactly
      // Normalize transferType: default to 'transfer' if undefined/null, and ensure lowercase comparison
      const transferType = (transfer.transferType || 'transfer').toLowerCase();
      const selectedType = selectedTransferType.toLowerCase();
      const matchesTransferType = selectedType === 'all' || transferType === selectedType;
      
      const matchesFromBranch = filters.fromBranch === 'all' || transfer.fromBranchId === filters.fromBranch;
      const matchesToBranch = filters.toBranch === 'all' || transfer.toBranchId === filters.toBranch;
      
      const matchesDateRange = (!filters.dateRange.start || new Date(transfer.transferDate) >= new Date(filters.dateRange.start)) &&
                              (!filters.dateRange.end || new Date(transfer.transferDate) <= new Date(filters.dateRange.end));
      
      const matchesValueRange = (!filters.valueRange.min || transfer.totalValue >= parseFloat(filters.valueRange.min)) &&
                               (!filters.valueRange.max || transfer.totalValue <= parseFloat(filters.valueRange.max));
      
      const matchesItemCountRange = (!filters.itemCountRange.min || transfer.totalItems >= parseInt(filters.itemCountRange.min)) &&
                                   (!filters.itemCountRange.max || transfer.totalItems <= parseInt(filters.itemCountRange.max));
      
      return matchesSearch && matchesStatus && matchesTransferType && matchesFromBranch && matchesToBranch && matchesDateRange && matchesValueRange && matchesItemCountRange;
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'transferDate' || sortBy === 'expectedDelivery' || sortBy === 'actualDelivery' || sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // Handle transfer details
  const handleViewDetails = (transfer) => {
    setSelectedTransfer(transfer);
    setIsDetailsModalOpen(true);
  };

  // Print individual transfer
  const handlePrintTransfer = (transfer) => {
    if (!transfer) return;

    const transferType = transfer.transferType === 'borrow' ? 'Borrow Request' : 'Stock Transfer';
    const statusColor = transfer.status === 'Completed' ? '#16a34a' : 
                       transfer.status === 'In Transit' ? '#2563eb' : 
                       transfer.status === 'Pending' ? '#ca8a04' : '#dc2626';

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${transferType} - ${transfer.id}</title>
          <style>
            @media print {
              @page { margin: 1.5cm; }
              .no-print { display: none; }
            }
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #160B53; padding-bottom: 20px; }
            .header h1 { color: #160B53; margin: 0 0 10px 0; font-size: 24px; }
            .header .subtitle { color: #666; font-size: 14px; }
            .info-section { margin-bottom: 25px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px; }
            .info-item { margin-bottom: 15px; }
            .info-item label { display: block; font-weight: bold; color: #666; font-size: 12px; margin-bottom: 5px; }
            .info-item .value { font-size: 14px; color: #333; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: bold; margin-left: 10px; }
            .badge-transfer { background-color: #dbeafe; color: #1e40af; }
            .badge-borrow { background-color: #fef3c7; color: #92400e; }
            .badge-manual { background-color: #fef3c7; color: #92400e; }
            .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: bold; color: #333; }
            .text-right { text-align: right; }
            .total-section { margin-top: 20px; padding-top: 15px; border-top: 2px solid #ddd; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
            .total-row.final { font-size: 18px; font-weight: bold; color: #160B53; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #666; }
            .notes { margin-top: 20px; padding: 15px; background-color: #f9fafb; border-left: 3px solid #160B53; }
            .notes label { font-weight: bold; margin-bottom: 5px; display: block; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${transferType.toUpperCase()}</h1>
            <div class="subtitle">
              Transfer ID: ${transfer.id}
              ${transfer.transferType === 'borrow' ? '<span class="badge badge-borrow">Borrow Request</span>' : '<span class="badge badge-transfer">Transfer</span>'}
              <span class="status-badge" style="background-color: ${statusColor}20; color: ${statusColor};">
                ${transfer.status}
              </span>
            </div>
          </div>

          <div class="info-section">
            <h2 style="color: #160B53; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 15px;">Transfer Information</h2>
            <div class="info-grid">
              <div>
                <div class="info-item">
                  <label>${transfer.transferType === 'borrow' ? 'Lending Branch (From)' : 'From Branch'}</label>
                  <div class="value">${transfer.fromBranchName}</div>
                </div>
                <div class="info-item">
                  <label>${transfer.transferType === 'borrow' ? 'Requesting Branch (To)' : 'To Branch'}</label>
                  <div class="value">
                    ${transfer.toBranchName}
                    ${transfer.toBranchHasSystem === false ? '<span class="badge badge-manual">Manual Branch</span>' : ''}
                  </div>
                </div>
                <div class="info-item">
                  <label>Transfer Date</label>
                  <div class="value">${format(new Date(transfer.transferDate), 'MMM dd, yyyy')}</div>
                </div>
              </div>
              <div>
                <div class="info-item">
                  <label>Expected Delivery</label>
                  <div class="value">${format(new Date(transfer.expectedDelivery), 'MMM dd, yyyy')}</div>
                </div>
                ${transfer.actualDelivery ? `
                <div class="info-item">
                  <label>Actual Delivery</label>
                  <div class="value" style="color: #16a34a;">${format(new Date(transfer.actualDelivery), 'MMM dd, yyyy')}</div>
                </div>
                ` : ''}
                <div class="info-item">
                  <label>Reason</label>
                  <div class="value">${transfer.reason || 'N/A'}</div>
                </div>
                <div class="info-item">
                  <label>Created By</label>
                  <div class="value">${transfer.createdBy || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="info-section">
            <h2 style="color: #160B53; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 15px;">Transfer Items</h2>
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th class="text-right">Quantity</th>
                  <th class="text-right">Unit Cost</th>
                  <th class="text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                ${transfer.items.map(item => `
                  <tr>
                    <td>${item.productName}</td>
                    <td class="text-right">${item.quantity}</td>
                    <td class="text-right">₱${(item.unitCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td class="text-right">₱${(item.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="total-section">
              <div class="total-row">
                <span>Total Items:</span>
                <span>${transfer.totalItems} items</span>
              </div>
              <div class="total-row final">
                <span>Total Value:</span>
                <span>₱${(transfer.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          ${transfer.notes ? `
          <div class="notes">
            <label>Notes:</label>
            <div>${transfer.notes}</div>
          </div>
          ` : ''}

          <div class="footer">
            <div>Printed on: ${format(new Date(), 'MMM dd, yyyy HH:mm')}</div>
            <div>Branch: ${userData?.branchName || 'N/A'}</div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Handle edit transfer
  const handleEditTransfer = (transfer) => {
    setSelectedTransfer(transfer);
    setFormData({
      fromBranchId: transfer.fromBranchId,
      toBranchId: transfer.toBranchId,
      transferDate: transfer.transferDate.toISOString().split('T')[0],
      expectedDelivery: transfer.expectedDelivery.toISOString().split('T')[0],
      reason: transfer.reason,
      notes: transfer.notes,
      items: transfer.items
    });
    setIsEditModalOpen(true);
  };

  // Handle create transfer (lending to other branches)
  const handleCreateTransfer = () => {
    setFormData({
      transferType: 'transfer', // Transferring out
      fromBranchId: userData?.branchId || '', // Current branch is FROM
      toBranchId: '',
      toBranchName: '',
      toBranchHasSystem: false,
      transferDate: new Date().toISOString().split('T')[0],
      expectedDelivery: '',
      reason: '',
      notes: '',
      items: []
    });
    setFormErrors({});
    setPendingRequestsFromToBranch([]);
    setSelectedRequestId('');
    setIsCreateModalOpen(true);
  };
  
  // Handle create borrow request (borrowing from other branches)
  const handleCreateBorrowRequest = () => {
    setFormData({
      transferType: 'borrow', // Borrowing in
      fromBranchId: '', // Other branch is FROM (we select it)
      toBranchId: userData?.branchId || '', // Current branch is TO (auto-filled)
      toBranchName: '',
      toBranchHasSystem: false,
      transferDate: new Date().toISOString().split('T')[0],
      expectedDelivery: '',
      reason: '',
      notes: '',
      items: []
    });
    setFormErrors({});
    setIsCreateBorrowModalOpen(true);
  };

  // Get incoming borrow requests (requests made TO this branch - where we are the lending branch)
  const incomingBorrowRequests = transfers.filter(transfer => 
    transfer.transferType === 'borrow' &&
    transfer.fromBranchId === userData?.branchId && // We are the FROM branch (lending)
    transfer.status === 'Pending'
  );

  // Handle review borrow request
  const handleReviewBorrowRequest = async (transfer) => {
    try {
      // Load current stock for each item in the request
      const stocksRef = collection(db, 'stocks');
      const itemsWithStock = await Promise.all(
        transfer.items.map(async (item) => {
          try {
            // Find stock for this product in our branch
            const stockQuery = query(
              stocksRef,
              where('branchId', '==', userData?.branchId),
              where('productId', '==', item.productId),
              where('status', '==', 'active')
            );
            const stockSnapshot = await getDocs(stockQuery);
            
            if (!stockSnapshot.empty) {
              const stockDoc = stockSnapshot.docs[0];
              const stockData = stockDoc.data();
              return {
                ...item,
                stockId: stockDoc.id,
                availableStock: stockData.realTimeStock || 0,
                approved: true, // Default to approved
                approvedQuantity: Math.min(item.quantity, stockData.realTimeStock || 0) // Default to requested or available, whichever is less
              };
            } else {
              return {
                ...item,
                stockId: null,
                availableStock: 0,
                approved: false,
                approvedQuantity: 0
              };
            }
          } catch (err) {
            console.error(`Error loading stock for product ${item.productId}:`, err);
            return {
              ...item,
              stockId: null,
              availableStock: 0,
              approved: false,
              approvedQuantity: 0
            };
          }
        })
      );
      
      setSelectedBorrowRequest({
        ...transfer,
        itemsWithStock
      });
      setApprovedItems(itemsWithStock);
      setIsReviewBorrowModalOpen(true);
    } catch (err) {
      console.error('Error reviewing borrow request:', err);
      alert('Failed to load borrow request details. Please try again.');
    }
  };

  // Handle approve borrow request (with selected items)
  const handleApproveBorrowRequest = async () => {
    if (!selectedBorrowRequest || approvedItems.length === 0) return;
    
    // Validate: at least one item must be approved
    const approvedItemsList = approvedItems.filter(item => item.approved && item.approvedQuantity > 0);
    if (approvedItemsList.length === 0) {
      alert('Please approve at least one item to process this borrow request.');
      return;
    }

    // Validate quantities
    for (const item of approvedItemsList) {
      if (item.approvedQuantity > item.availableStock) {
        alert(`Cannot approve ${item.approvedQuantity} units of ${item.productName}. Only ${item.availableStock} units available.`);
        return;
      }
      if (item.approvedQuantity <= 0) {
        alert(`Approved quantity for ${item.productName} must be greater than 0.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const batch = writeBatch(db);
      
      const transferRef = doc(db, 'stock_transfer', selectedBorrowRequest.id);
      
      // Update transfer with approved items
      const approvedItemsData = approvedItemsList.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.approvedQuantity,
        unitCost: item.unitCost || 0,
        totalCost: item.approvedQuantity * (item.unitCost || 0),
        stockId: item.stockId || null
      }));

      const totalApprovedItems = approvedItemsList.reduce((sum, item) => sum + item.approvedQuantity, 0);
      const totalApprovedValue = approvedItemsList.reduce((sum, item) => sum + (item.approvedQuantity * (item.unitCost || 0)), 0);

      // Update transfer status to 'In Transit' and include approved items
      batch.update(transferRef, {
        status: 'In Transit',
        approvedItems: approvedItemsData,
        approvedTotalItems: totalApprovedItems,
        approvedTotalValue: totalApprovedValue,
        approvedBy: userData?.uid,
        approvedByName: userData?.name || userData?.email || 'Unknown',
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Deduct stock for each approved item
      for (const item of approvedItemsList) {
        if (item.stockId) {
          const stockRef = doc(db, 'stocks', item.stockId);
          const stockDoc = await getDoc(stockRef);
          
          if (stockDoc.exists()) {
            const stockData = stockDoc.data();
            const currentStock = stockData.realTimeStock || 0;
            const newStock = Math.max(0, currentStock - item.approvedQuantity);
            batch.update(stockRef, {
              realTimeStock: newStock,
              updatedAt: serverTimestamp()
            });
          }
        }
      }

      await batch.commit();
      
      // Reset states
      setIsReviewBorrowModalOpen(false);
      setSelectedBorrowRequest(null);
      setApprovedItems([]);
      
      // Reload data
      await reloadTransfers();
      await loadData();
      
      alert(`Borrow request approved! ${approvedItemsList.length} item(s) processed. Stock deducted.`);
    } catch (error) {
      console.error('Error approving borrow request:', error);
      alert('Failed to approve borrow request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle decline borrow request
  const handleDeclineBorrowRequest = async () => {
    if (!selectedBorrowRequest) return;
    
    if (!confirm(`Are you sure you want to decline this borrow request from ${selectedBorrowRequest.toBranchName}?`)) {
      return;
    }

    try {
      setIsSubmitting(true);
      const transferRef = doc(db, 'stock_transfer', selectedBorrowRequest.id);
      
      await updateDoc(transferRef, {
        status: 'Cancelled',
        declinedBy: userData?.uid,
        declinedByName: userData?.name || userData?.email || 'Unknown',
        declinedAt: serverTimestamp(),
        declinedReason: 'Declined by lending branch',
        updatedAt: serverTimestamp()
      });

      setIsReviewBorrowModalOpen(false);
      setSelectedBorrowRequest(null);
      setApprovedItems([]);
      
      await reloadTransfers();
      await loadData();
      
      alert('Borrow request declined.');
    } catch (error) {
      console.error('Error declining borrow request:', error);
      alert('Failed to decline borrow request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    const errors = {};
    
    // Different validation for transfer vs borrow
    if (formData.transferType === 'borrow') {
      // Borrow: fromBranchId is required (branch we're borrowing from)
      if (!formData.fromBranchId) errors.fromBranchId = 'Please select a branch to borrow from';
      // toBranchId is auto-set to current branch
      if (!userData?.branchId) errors.toBranchId = 'You must be assigned to a branch';
    } else {
      // Transfer: fromBranchId is auto-set to current branch
      if (!userData?.branchId) errors.fromBranchId = 'You must be assigned to a branch';
      if (!formData.toBranchId && !formData.toBranchName) errors.toBranchId = 'To branch is required';
    }
    if (!formData.transferDate) errors.transferDate = 'Transfer date is required';
    if (!formData.expectedDelivery) errors.expectedDelivery = 'Expected delivery is required';
    if (!formData.reason) errors.reason = 'Reason is required';
    if (formData.items.length === 0) errors.items = 'At least one item is required';
    
    // Validate items - different validation for transfer vs borrow
    formData.items.forEach((item, index) => {
      if (!item.productId) {
        errors[`item${index}_product`] = 'Product is required';
      } else {
        if (formData.transferType === 'transfer') {
          // TRANSFER: Verify product belongs to current branch (we're sending it)
          const stock = availableStocks.find(s => 
            s.productId === item.productId && s.branchId === userData?.branchId
          );
          if (!stock) {
            errors[`item${index}_product`] = 'Product must be from your branch';
          }
          if (item.availableStock && item.quantity > item.availableStock) {
            errors[`item${index}_quantity`] = `Cannot exceed available stock in your branch: ${item.availableStock}`;
          }
          // Validate usage type selection for transfers
          if (!item.selectedUsageTypes || item.selectedUsageTypes.length === 0) {
            errors[`item${index}_usageType`] = 'Please select at least one usage type (OTC or Salon Use)';
          }
          
          // Validate batch selection for transfers
          if (!item.selectedBatchId) {
            errors[`item${index}_batch`] = 'Please select a batch for this product';
          } else {
            const selectedBatch = productBatches[item.productId]?.find(b => b.batchId === item.selectedBatchId);
            if (!selectedBatch) {
              errors[`item${index}_batch`] = 'Selected batch not found';
            } else {
              // Verify batch matches selected usage type
              const batchUsageType = selectedBatch.usageType || (selectedBatch.otcPrice > 0 ? 'otc' : 'salon-use');
              if (!item.selectedUsageTypes?.includes(batchUsageType)) {
                errors[`item${index}_batch`] = 'Selected batch does not match selected usage type';
              } else if (parseInt(item.quantity) > selectedBatch.remainingQuantity) {
                errors[`item${index}_quantity`] = `Cannot exceed available quantity in batch ${item.selectedBatchNumber || selectedBatch.batchNumber}: ${selectedBatch.remainingQuantity}`;
              }
            }
          }
        } else if (formData.transferType === 'borrow') {
          // BORROW: Verify product exists in the lending branch (branch we're borrowing FROM)
          const stock = lendingBranchStocks.find(s => 
            s.productId === item.productId && s.branchId === formData.fromBranchId
          );
          if (!stock) {
            errors[`item${index}_product`] = `Product must be available in ${formData.fromBranchName || 'the lending branch'}`;
          }
          if (item.availableStock && item.quantity > item.availableStock) {
            errors[`item${index}_quantity`] = `Cannot exceed available stock in ${formData.fromBranchName || 'lending branch'}: ${item.availableStock}`;
          }
        }
      }
      if (!item.quantity || item.quantity <= 0) {
        errors[`item${index}_quantity`] = 'Quantity must be greater than 0';
      }
    });
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    try {
      setIsSubmitting(true);
      setFormErrors({});
      
      const batch = writeBatch(db);
      
      // Determine branches based on transfer type
      // This ensures clear differentiation and prevents confusion
      let finalFromBranchId, finalFromBranchName, finalToBranchId, finalToBranchName;
      
      if (formData.transferType === 'borrow') {
        // BORROW REQUEST: Current branch is RECEIVING (TO), other branch is LENDING (FROM)
        finalFromBranchId = formData.fromBranchId || null; // Branch we're borrowing FROM
        finalFromBranchName = formData.fromBranchName || branches.find(b => b.id === formData.fromBranchId)?.name || '';
        finalToBranchId = userData?.branchId; // Current branch (receiving)
        finalToBranchName = branches.find(b => b.id === userData?.branchId)?.name || '';
      } else {
        // TRANSFER: Current branch is SENDING (FROM), other branch is RECEIVING (TO)
        finalFromBranchId = userData?.branchId; // Current branch (sending)
        finalFromBranchName = branches.find(b => b.id === userData?.branchId)?.name || '';
        finalToBranchId = formData.toBranchId || null; // Branch receiving
        finalToBranchName = formData.toBranchName || branches.find(b => b.id === formData.toBranchId)?.name || '';
      }
      
      // Prepare items with batch information (for transfers)
      const itemsWithBatches = [];
      
      // STOCK DEDUCTION - Clear logic prevents mixing up:
      if (formData.transferType === 'transfer') {
        // TRANSFER TYPE: Deduct stock IMMEDIATELY from sending branch (fromBranchId)
        // Current branch is sending, so deduct from their inventory
        // Use batch-aware transfer (FIFO)
        for (const item of formData.items) {
          const itemData = {
            productId: item.productId,
            productName: item.productName,
            stockId: item.stockId,
            quantity: parseInt(item.quantity),
            unitCost: parseFloat(item.unitCost) || 0,
            totalCost: parseFloat(item.totalCost) || 0,
            batches: [] // Will be populated if batches found
          };

          // Use selected batch if available, otherwise fall back to FIFO
          if (item.selectedBatchId && item.selectedBatchNumber) {
            // Use manually selected batch
            const selectedBatch = productBatches[item.productId]?.find(b => b.batchId === item.selectedBatchId);
            if (!selectedBatch) {
              throw new Error(`Selected batch not found for ${item.productName}`);
            }
            
            if (parseInt(item.quantity) > selectedBatch.remainingQuantity) {
              throw new Error(`Insufficient stock in batch ${item.selectedBatchNumber}. Available: ${selectedBatch.remainingQuantity}, Requested: ${item.quantity}`);
            }

            // Add batch information to transfer item
            itemData.batches = [{
              batchId: selectedBatch.batchId,
              batchNumber: selectedBatch.batchNumber,
              quantity: parseInt(item.quantity),
              expirationDate: selectedBatch.expirationDate instanceof Date 
                ? selectedBatch.expirationDate.toISOString() 
                : (selectedBatch.expirationDate ? new Date(selectedBatch.expirationDate).toISOString() : null),
              unitCost: selectedBatch.unitCost || item.unitCost || 0,
              originalBatchId: selectedBatch.batchId // Store for return tracking
            }];

            // Deduct from the specific batch
            const batchRef = doc(db, 'product_batches', selectedBatch.batchId);
            const batchDoc = await getDoc(batchRef);
            if (!batchDoc.exists()) {
              throw new Error(`Batch ${item.selectedBatchNumber} not found`);
            }
            
            const batchData = batchDoc.data();
            const newRemaining = Math.max(0, (batchData.remainingQuantity || 0) - parseInt(item.quantity));
            
            batch.update(batchRef, {
              remainingQuantity: newRemaining,
              updatedAt: serverTimestamp()
            });

            // Also update stock record
            if (item.stockId) {
              const stockRef = doc(db, 'stocks', item.stockId);
              const stockDoc = await getDoc(stockRef);
              if (stockDoc.exists()) {
                const stockData = stockDoc.data();
                const newStock = Math.max(0, (stockData.realTimeStock || 0) - parseInt(item.quantity));
                batch.update(stockRef, {
                  realTimeStock: newStock,
                  remainingQuantity: newStock,
                  updatedAt: serverTimestamp()
                });
              }
            }
          } else {
            // Fallback to FIFO automatic selection (if no batch selected)
            const batchesResult = await inventoryService.getBatchesForTransfer({
              branchId: finalFromBranchId,
              productId: item.productId,
              quantity: parseInt(item.quantity)
            });

            if (batchesResult.success && batchesResult.batches.length > 0) {
              // Add batch information to transfer item
              itemData.batches = batchesResult.batches.map(b => ({
                batchId: b.batchId,
                batchNumber: b.batchNumber,
                quantity: b.quantity,
                expirationDate: b.expirationDate instanceof Date 
                  ? b.expirationDate.toISOString() 
                  : (b.expirationDate ? new Date(b.expirationDate).toISOString() : null),
                unitCost: b.unitCost,
                originalBatchId: b.batchId // Store for return tracking
              }));

              // Deduct from batches using FIFO
              const deductResult = await inventoryService.deductStockFIFO({
                branchId: finalFromBranchId,
                productId: item.productId,
                quantity: parseInt(item.quantity),
                reason: 'Stock Transfer',
                notes: `Transfer to ${finalToBranchName}`,
                createdBy: userData?.uid,
                productName: item.productName
              });

              if (!deductResult.success) {
                throw new Error(`Failed to deduct stock for ${item.productName}: ${deductResult.message}`);
              }
            } else {
              // Fallback: Update stock directly if no batches found (backward compatibility)
              if (item.stockId) {
                const stockRef = doc(db, 'stocks', item.stockId);
                const stockDoc = await getDoc(stockRef);
                
                if (stockDoc.exists()) {
                  const stockData = stockDoc.data();
                  if (stockData.branchId === finalFromBranchId) {
                    const currentStock = stockData.realTimeStock || 0;
                    const newStock = Math.max(0, currentStock - parseInt(item.quantity));
                    batch.update(stockRef, {
                      realTimeStock: newStock,
                      updatedAt: serverTimestamp()
                    });
                  }
                }
              }
            }
          }

          itemsWithBatches.push(itemData);
        }
      } else if (formData.transferType === 'borrow') {
        // BORROW TYPE: NO stock deduction yet
        // Stock will be deducted by the LENDING branch (fromBranchId) 
        // when they approve/process the borrow request
        // This prevents accidental deduction from the wrong branch
        itemsWithBatches.push(...formData.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          stockId: item.stockId,
          quantity: parseInt(item.quantity),
          unitCost: parseFloat(item.unitCost) || 0,
          totalCost: parseFloat(item.totalCost) || 0
        })));
      }

      // Prepare transfer data - SAME COLLECTION, differentiated by transferType
      // Both transfers and borrow requests use the same structure for consistency
      const transferData = {
        transferType: formData.transferType || 'transfer', // KEY DIFFERENTIATOR: 'transfer' or 'borrow'
        initiatedBy: userData?.branchId, // Which branch initiated this (for filtering/audit)
        fromBranchId: finalFromBranchId, // Branch sending/lending
        fromBranchName: finalFromBranchName,
        toBranchId: finalToBranchId, // Branch receiving/borrowing
        toBranchName: finalToBranchName,
        toBranchHasSystem: formData.toBranchHasSystem, // Flag for branches with/without system
        transferDate: formData.transferDate,
        expectedDelivery: formData.expectedDelivery,
        actualDelivery: null,
        status: 'Pending',
        reason: formData.reason,
        notes: formData.notes || '',
        items: itemsWithBatches,
        totalItems: formData.items.reduce((sum, item) => sum + parseInt(item.quantity), 0),
        totalValue: formData.items.reduce((sum, item) => sum + parseFloat(item.totalCost), 0),
        createdBy: userData?.uid,
        createdByName: userData?.name || userData?.email || 'Unknown',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Create transfer document in stock_transfer collection
      // ============================================================
      // ARCHITECTURE: Single Collection Design (stock_transfer)
      // ============================================================
      // WHY ONE COLLECTION? Both are the SAME transaction type (stock movement between branches)
      // just initiated from different sides:
      //   - Transfer: Branch A → Branch B (A initiates, sends stock)
      //   - Borrow: Branch A → Branch B (B initiates, requests stock from A)
      // 
      // SAFEGUARDS TO PREVENT CONFUSION:
      // 1. transferType field: 'transfer' or 'borrow' (ALWAYS checked before processing)
      // 2. initiatedBy field: Which branch created this record (for audit)
      // 3. Different stock deduction logic based on type
      // 4. Visual badges in UI to distinguish them
      // 5. Different filter options in UI
      // ============================================================
      const transferRef = doc(collection(db, 'stock_transfer'));
      batch.set(transferRef, transferData);
      
      // Commit batch
      await batch.commit();
      
      // Reset form
      setFormData({
        transferType: 'transfer',
        fromBranchId: userData?.branchId || '',
        toBranchId: '',
        toBranchName: '',
        toBranchHasSystem: false,
        transferDate: new Date().toISOString().split('T')[0],
        expectedDelivery: '',
        reason: '',
        notes: '',
        items: []
      });
      setFormErrors({});
    setIsCreateModalOpen(false);
      setIsCreateBorrowModalOpen(false);
    setIsEditModalOpen(false);
      
      // Reload data
      await reloadTransfers();
      await loadData();
      
      const message = formData.transferType === 'borrow' 
        ? 'Borrow request created successfully! The lending branch will review your request.'
        : 'Stock transfer created successfully! Stock deducted from inventory.';
      alert(message);
      
    } catch (error) {
      console.error('Error creating transfer:', error);
      setFormErrors({ general: 'Failed to create transfer. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle receiving a transfer (mark as completed and create transfer batches)
  const handleReceiveTransfer = async (transfer) => {
    if (!transfer || transfer.status === 'Completed') {
      alert('Transfer is already completed or invalid');
      return;
    }

    if (transfer.toBranchId !== userData?.branchId) {
      alert('You can only receive transfers sent to your branch');
      return;
    }

    if (!confirm(`Confirm receipt of transfer from ${transfer.fromBranchName}?`)) {
      return;
    }

    try {
      setIsSubmitting(true);

      // Create transfer batches at receiving branch
      const transferBatchesResult = await inventoryService.createTransferBatches({
        transferId: transfer.id,
        fromBranchId: transfer.fromBranchId,
        toBranchId: transfer.toBranchId,
        items: transfer.items || [],
        receivedBy: userData?.uid,
        receivedAt: new Date()
      });

      if (!transferBatchesResult.success) {
        throw new Error(transferBatchesResult.message || 'Failed to create transfer batches');
      }

      // Update stock for each product (add to receiving branch)
      for (const item of transfer.items || []) {
        const stockData = {
          branchId: transfer.toBranchId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitCost: item.unitCost,
          reason: 'Stock Transfer Received',
          notes: `Transfer from ${transfer.fromBranchName} - Transfer ID: ${transfer.id}`,
          createdBy: userData?.uid
        };

        const stockResult = await inventoryService.addStock(stockData);
        if (!stockResult.success) {
          console.error(`Failed to update stock for ${item.productName}:`, stockResult.message);
        }
      }

      // Update transfer status to Completed
      const transferRef = doc(db, 'stock_transfer', transfer.id);
      await updateDoc(transferRef, {
        status: 'Completed',
        actualDelivery: serverTimestamp(),
        receivedBy: userData?.uid,
        receivedByName: userData?.name || userData?.email || 'Unknown',
        receivedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await reloadTransfers();
      alert('Transfer received successfully! Transfer batches created.');
    } catch (error) {
      console.error('Error receiving transfer:', error);
      alert(`Failed to receive transfer: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle returning stock from a transfer
  const handleReturnStock = async (transfer, item, returnQuantity, returnReason) => {
    if (!transfer || transfer.status !== 'Completed') {
      alert('Can only return stock from completed transfers');
      return;
    }

    if (transfer.fromBranchId !== userData?.branchId) {
      alert('You can only return stock to transfers you sent');
      return;
    }

    if (!returnQuantity || returnQuantity <= 0) {
      alert('Please enter a valid return quantity');
      return;
    }

    if (returnQuantity > item.quantity) {
      alert(`Return quantity cannot exceed transferred quantity (${item.quantity})`);
      return;
    }

    if (!confirm(`Return ${returnQuantity} units of ${item.productName}?`)) {
      return;
    }

    try {
      setIsSubmitting(true);

      // Find transfer batches for this item
      const batchesResult = await inventoryService.getBranchBatches(userData?.branchId, {
        productId: item.productId
      });

      if (!batchesResult.success) {
        throw new Error('Failed to get batches');
      }

      // Find batches from this transfer
      const transferBatches = batchesResult.batches.filter(b => 
        b.sourceType === 'transfer' && 
        b.sourceTransferId === transfer.id &&
        b.productId === item.productId
      );

      if (transferBatches.length === 0) {
        throw new Error('No transfer batches found for this item');
      }

      // Return stock - restore to original batch if available, otherwise use transfer batches
      let remainingToReturn = returnQuantity;
      const batch = writeBatch(db);
      
      // Check if item has originalBatchId (from manual batch selection)
      const transferItem = transfer.items?.find(i => i.productId === item.productId);
      const originalBatchId = transferItem?.batches?.[0]?.originalBatchId;
      
      if (originalBatchId) {
        // Restore to original batch
        try {
          const originalBatchRef = doc(db, 'product_batches', originalBatchId);
          const originalBatchDoc = await getDoc(originalBatchRef);
          
          if (originalBatchDoc.exists()) {
            const originalBatchData = originalBatchDoc.data();
            const newRemaining = (originalBatchData.remainingQuantity || 0) + remainingToReturn;
            
            batch.update(originalBatchRef, {
              remainingQuantity: newRemaining,
              updatedAt: serverTimestamp()
            });
            
            // Also update stock record
            const stocksRef = collection(db, 'stocks');
            const stockQuery = query(
              stocksRef,
              where('branchId', '==', userData?.branchId),
              where('productId', '==', item.productId),
              where('status', '==', 'active')
            );
            const stockSnapshot = await getDocs(stockQuery);
            if (!stockSnapshot.empty) {
              const stockRef = doc(db, 'stocks', stockSnapshot.docs[0].id);
              const stockData = stockSnapshot.docs[0].data();
              const newStock = (stockData.realTimeStock || 0) + remainingToReturn;
              batch.update(stockRef, {
                realTimeStock: newStock,
                remainingQuantity: newStock,
                updatedAt: serverTimestamp()
              });
            }
            
            // Deduct from transfer batches
            for (const transferBatch of transferBatches) {
              if (remainingToReturn <= 0) break;
              const deductQty = Math.min(remainingToReturn, transferBatch.remainingQuantity || 0);
              if (deductQty > 0) {
                const transferBatchRef = doc(db, 'product_batches', transferBatch.id);
                const transferBatchData = transferBatch;
                const newTransferRemaining = Math.max(0, (transferBatchData.remainingQuantity || 0) - deductQty);
                batch.update(transferBatchRef, {
                  remainingQuantity: newTransferRemaining,
                  updatedAt: serverTimestamp()
                });
                remainingToReturn -= deductQty;
              }
            }
            
            await batch.commit();
          } else {
            throw new Error('Original batch not found');
          }
        } catch (error) {
          console.error('Error restoring to original batch:', error);
          // Fallback to regular return process
          for (const batch of transferBatches) {
            if (remainingToReturn <= 0) break;
            
            const returnQty = Math.min(remainingToReturn, batch.remainingQuantity || 0);
            if (returnQty <= 0) continue;

            const returnResult = await inventoryService.returnStockToBatch({
              batchId: batch.id,
              quantity: returnQty,
              returnReason: returnReason || 'Stock return',
              returnedBy: userData?.uid,
              returnedAt: new Date()
            });

            if (!returnResult.success) {
              throw new Error(returnResult.message);
            }
            remainingToReturn -= returnQty;
          }
        }
      } else {
        // No original batch - use regular return process (FIFO from transfer batches)
        for (const batch of transferBatches) {
          if (remainingToReturn <= 0) break;
          
          const returnQty = Math.min(remainingToReturn, batch.remainingQuantity || 0);
          if (returnQty <= 0) continue;

          const returnResult = await inventoryService.returnStockToBatch({
            batchId: batch.id,
            quantity: returnQty,
            returnReason: returnReason || 'Stock return',
            returnedBy: userData?.uid,
            returnedAt: new Date()
          });

          if (!returnResult.success) {
            throw new Error(returnResult.message);
          }
          remainingToReturn -= returnQty;
        }
      }

      if (remainingToReturn > 0) {
        throw new Error(`Could not return all quantity. ${remainingToReturn} units could not be returned.`);
      }

      // Update stock at receiving branch (deduct)
      const stockData = {
        branchId: transfer.toBranchId,
        productId: item.productId,
        productName: item.productName,
        quantity: -returnQuantity, // Negative for deduction
        unitCost: item.unitCost,
        reason: 'Stock Return',
        notes: `Returned to ${transfer.fromBranchName} - Transfer ID: ${transfer.id}`,
        createdBy: userData?.uid
      };

      await inventoryService.addStock(stockData);

      await reloadTransfers();
      alert(`Successfully returned ${returnQuantity} units of ${item.productName}`);
    } catch (error) {
      console.error('Error returning stock:', error);
      alert(`Failed to return stock: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add item to transfer
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { productId: '', quantity: 1, unitCost: 0, totalCost: 0, selectedUsageTypes: [] }]
    }));
  };

  // Get unique products (grouped by productId)
  const uniqueProducts = useMemo(() => {
    const productMap = new Map();
    
    availableStocks
      .filter(stock => stock.branchId === userData?.branchId && stock.realTimeStock > 0)
      .forEach(stock => {
        if (!productMap.has(stock.productId)) {
          productMap.set(stock.productId, {
            productId: stock.productId,
            productName: stock.productName,
            hasOTC: false,
            hasSalonUse: false,
            otcStock: 0,
            salonUseStock: 0,
            otcPrice: stock.otcPrice || 0,
            stocks: []
          });
        }
        
        const product = productMap.get(stock.productId);
        product.stocks.push(stock);
        
        const isOTC = stock.usageType === 'otc' || (stock.usageType !== 'salon-use' && stock.otcPrice > 0);
        if (isOTC) {
          product.hasOTC = true;
          product.otcStock += stock.realTimeStock || 0;
        } else {
          product.hasSalonUse = true;
          product.salonUseStock += stock.realTimeStock || 0;
        }
      });
    
    return Array.from(productMap.values());
  }, [availableStocks, userData?.branchId]);

  // Remove item from transfer
  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Fetch batches for a product
  const fetchBatchesForProduct = async (productId, branchId) => {
    if (!productId || !branchId) return;
    
    try {
      const batchesResult = await inventoryService.getProductBatches(branchId, productId, { status: 'active' });
      if (batchesResult.success) {
        // Filter batches that have remaining quantity > 0 and map them
        const validBatches = batchesResult.batches
          .filter(b => (b.remainingQuantity || 0) > 0)
          .map(b => ({
            batchId: b.id,
            batchNumber: b.batchNumber || `BATCH-${b.id}`, // Use batchNumber from product_batches (e.g., PO-KYI-01-OTC-001)
            remainingQuantity: b.remainingQuantity || 0,
            expirationDate: b.expirationDate,
            unitCost: b.unitCost || 0,
            usageType: b.usageType || (b.otcPrice > 0 ? 'otc' : 'salon-use'), // Include usageType
            otcPrice: b.otcPrice || 0, // Include otcPrice for fallback
            purchaseOrderId: b.purchaseOrderId || '', // Include PO ID for reference
            receivedDate: b.receivedDate || null // Include received date for FIFO
          }));
        
        // Sort by received date (FIFO) - oldest batches first
        validBatches.sort((a, b) => {
          if (a.receivedDate && b.receivedDate) {
            const dateA = a.receivedDate instanceof Date ? a.receivedDate : new Date(a.receivedDate);
            const dateB = b.receivedDate instanceof Date ? b.receivedDate : new Date(b.receivedDate);
            return dateA.getTime() - dateB.getTime();
          }
          if (a.receivedDate) return -1;
          if (b.receivedDate) return 1;
          // If no received date, sort by batch number
          if (a.batchNumber && b.batchNumber) {
            return a.batchNumber.localeCompare(b.batchNumber);
          }
          return 0;
        });
        
        setProductBatches(prev => ({
          ...prev,
          [productId]: validBatches
        }));
      } else {
        setProductBatches(prev => ({
          ...prev,
          [productId]: []
        }));
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
      setProductBatches(prev => ({
        ...prev,
        [productId]: []
      }));
    }
  };

  // Update item in transfer
  const updateItem = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          
          // Auto-fill product details when product is selected
          // Only allow products from current branch
          if (field === 'productId' && value) {
            const stock = availableStocks.find(s => 
              s.productId === value && s.branchId === userData?.branchId
            );
            if (stock) {
              updatedItem.productName = stock.productName;
              updatedItem.unitCost = stock.otcPrice || stock.unitCost || 0; // Use otcPrice automatically
              updatedItem.stockId = stock.id;
              updatedItem.availableStock = stock.realTimeStock;
              updatedItem.usageType = stock.usageType || (stock.otcPrice > 0 ? 'otc' : 'salon-use'); // Store usage type
              // Fetch batches for this product
              if (formData.transferType === 'transfer' && userData?.branchId) {
                fetchBatchesForProduct(value, userData.branchId);
              }
              updatedItem.branchId = stock.branchId; // Ensure branchId is set
              // Auto-calculate total when product is selected
              updatedItem.totalCost = (updatedItem.quantity || 0) * (updatedItem.unitCost || 0);
            }
          }
          
          // Calculate total cost when quantity changes (unitCost is read-only, so only quantity matters)
          if (field === 'quantity') {
            updatedItem.totalCost = (parseInt(value) || 0) * (updatedItem.unitCost || 0);
          }
          
          // Validate quantity doesn't exceed available stock
          if (field === 'quantity' && updatedItem.availableStock) {
            const qty = parseInt(value) || 0;
            if (qty > updatedItem.availableStock) {
              setFormErrors(prev => ({
                ...prev,
                [`item${index}_quantity`]: `Available stock: ${updatedItem.availableStock} units`
              }));
            } else {
              setFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[`item${index}_quantity`];
                return newErrors;
              });
            }
          }
          
          return updatedItem;
        }
        return item;
      })
    }));
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'text-yellow-600 bg-yellow-100';
      case 'In Transit': return 'text-blue-600 bg-blue-100';
      case 'Completed': return 'text-green-600 bg-green-100';
      case 'Cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending': return <Clock className="h-4 w-4" />;
      case 'In Transit': return <Truck className="h-4 w-4" />;
      case 'Completed': return <CheckCircle className="h-4 w-4" />;
      case 'Cancelled': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  // Export to Excel
  const handleExportToExcel = () => {
    if (!filteredTransfers.length) {
      toast.error('No transfers to export');
      return;
    }

    try {
      const headers = [
        { key: 'id', label: 'Transfer ID' },
        { key: 'transferType', label: 'Type' },
        { key: 'fromBranchName', label: 'From Branch' },
        { key: 'toBranchName', label: 'To Branch' },
        { key: 'transferDate', label: 'Transfer Date' },
        { key: 'expectedDelivery', label: 'Expected Delivery' },
        { key: 'actualDelivery', label: 'Actual Delivery' },
        { key: 'status', label: 'Status' },
        { key: 'reason', label: 'Reason' },
        { key: 'totalItems', label: 'Total Items' },
        { key: 'totalValue', label: 'Total Value' },
        { key: 'createdByName', label: 'Created By' },
        { key: 'createdAt', label: 'Created At' }
      ];

      const exportData = filteredTransfers.map(transfer => ({
        id: transfer.id || 'N/A',
        transferType: transfer.transferType === 'borrow' ? 'Borrow Request' : 'Transfer',
        fromBranchName: transfer.fromBranchName || 'N/A',
        toBranchName: transfer.toBranchName || 'N/A',
        transferDate: transfer.transferDate ? format(new Date(transfer.transferDate), 'MMM dd, yyyy') : 'N/A',
        expectedDelivery: transfer.expectedDelivery ? format(new Date(transfer.expectedDelivery), 'MMM dd, yyyy') : 'N/A',
        actualDelivery: transfer.actualDelivery ? format(new Date(transfer.actualDelivery), 'MMM dd, yyyy') : 'N/A',
        status: transfer.status || 'N/A',
        reason: transfer.reason || 'N/A',
        totalItems: transfer.totalItems || 0,
        totalValue: transfer.totalValue || 0,
        createdByName: transfer.createdByName || 'N/A',
        createdAt: transfer.createdAt ? format(new Date(transfer.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'
      }));

      exportToExcel(exportData, 'stock_transfers_export', 'Stock Transfers', headers);
      toast.success('Stock transfers exported to Excel successfully');
    } catch (error) {
      console.error('Error exporting transfers:', error);
      toast.error('Failed to export transfers');
    }
  };

  // Print Report
  const handlePrintReport = () => {
    if (!filteredTransfers.length) {
      toast.error('No transfers to print');
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Stock Transfers Report - ${userData?.branchName || 'Branch'}</title>
          <style>
            @media print {
              @page { margin: 1cm; }
            }
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #160B53; margin-bottom: 10px; }
            .header-info { margin-bottom: 20px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: bold; }
            .status-pending { color: #ca8a04; }
            .status-in-transit { color: #2563eb; }
            .status-completed { color: #16a34a; }
            .status-cancelled { color: #dc2626; }
            .footer { margin-top: 30px; font-size: 12px; color: #666; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; }
            .badge-transfer { background-color: #dbeafe; color: #1e40af; }
            .badge-borrow { background-color: #fef3c7; color: #92400e; }
          </style>
        </head>
        <body>
          <h1>Stock Transfers Report</h1>
          <div class="header-info">
            <p><strong>Branch:</strong> ${userData?.branchName || 'N/A'}</p>
            <p><strong>Generated:</strong> ${format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
            <p><strong>Total Transfers:</strong> ${filteredTransfers.length}</p>
            <p><strong>Total Value:</strong> ₱${filteredTransfers.reduce((sum, t) => sum + (t.totalValue || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>From Branch</th>
                <th>To Branch</th>
                <th>Date</th>
                <th>Status</th>
                <th>Items</th>
                <th>Value</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTransfers.map(transfer => {
                const statusClass = transfer.status === 'Pending' ? 'status-pending' : 
                                  transfer.status === 'In Transit' ? 'status-in-transit' : 
                                  transfer.status === 'Completed' ? 'status-completed' : 'status-cancelled';
                const typeBadge = transfer.transferType === 'borrow' ? 
                  '<span class="badge badge-borrow">Borrow</span>' : 
                  '<span class="badge badge-transfer">Transfer</span>';
                return `
                  <tr>
                    <td>${transfer.id || 'N/A'}</td>
                    <td>${typeBadge}</td>
                    <td>${transfer.fromBranchName || 'N/A'}</td>
                    <td>${transfer.toBranchName || 'N/A'}</td>
                    <td>${transfer.transferDate ? format(new Date(transfer.transferDate), 'MMM dd, yyyy') : 'N/A'}</td>
                    <td class="${statusClass}">${transfer.status || 'N/A'}</td>
                    <td>${transfer.totalItems || 0}</td>
                    <td>₱${(transfer.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>${transfer.reason || 'N/A'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div class="footer">
            <p>This report is for internal use only.</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Generate PDF form for borrow request from branch without system
  const handleGenerateBorrowRequestPDF = (transferData) => {
    const pdfContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Borrow Request Form - ${transferData.id || 'N/A'}</title>
          <style>
            @media print {
              @page { margin: 1.5cm; }
            }
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #160B53; padding-bottom: 20px; }
            .header h1 { color: #160B53; margin: 0; }
            .form-section { margin-bottom: 25px; }
            .form-section h2 { color: #160B53; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 15px; }
            .form-row { display: flex; margin-bottom: 15px; }
            .form-group { flex: 1; margin-right: 20px; }
            .form-group:last-child { margin-right: 0; }
            .form-group label { display: block; font-weight: bold; margin-bottom: 5px; color: #333; }
            .form-group .value { border-bottom: 1px solid #333; padding: 5px 0; min-height: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: bold; }
            .signature-section { margin-top: 50px; }
            .signature-box { display: inline-block; width: 250px; margin-right: 50px; }
            .signature-box:last-child { margin-right: 0; }
            .signature-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 5px; text-align: center; }
            .footer { margin-top: 30px; font-size: 11px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>BORROW REQUEST FORM</h1>
            <p>David's Salon - Stock Borrow Request</p>
          </div>

          <div class="form-section">
            <h2>Request Information</h2>
            <div class="form-row">
              <div class="form-group">
                <label>Request ID:</label>
                <div class="value">${transferData.id || 'N/A'}</div>
              </div>
              <div class="form-group">
                <label>Request Date:</label>
                <div class="value">${transferData.transferDate ? format(new Date(transferData.transferDate), 'MMM dd, yyyy') : 'N/A'}</div>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Requesting Branch (To):</label>
                <div class="value">${transferData.toBranchName || 'N/A'}</div>
              </div>
              <div class="form-group">
                <label>Lending Branch (From):</label>
                <div class="value">${transferData.fromBranchName || 'N/A'}</div>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Expected Delivery Date:</label>
                <div class="value">${transferData.expectedDelivery ? format(new Date(transferData.expectedDelivery), 'MMM dd, yyyy') : 'N/A'}</div>
              </div>
              <div class="form-group">
                <label>Reason:</label>
                <div class="value">${transferData.reason || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div class="form-section">
            <h2>Requested Items</h2>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product Name</th>
                  <th>Quantity</th>
                  <th>Unit Cost</th>
                  <th>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                ${(transferData.items || []).map((item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${item.productName || 'N/A'}</td>
                    <td>${item.quantity || 0}</td>
                    <td>₱${(item.unitCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>₱${(item.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
                <tr style="font-weight: bold;">
                  <td colspan="4" style="text-align: right;">Total:</td>
                  <td>₱${(transferData.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          ${transferData.notes ? `
          <div class="form-section">
            <h2>Notes</h2>
            <div class="value">${transferData.notes}</div>
          </div>
          ` : ''}

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-line">
                <strong>Requested By</strong><br>
                ${transferData.createdByName || 'N/A'}<br>
                ${transferData.toBranchName || 'N/A'}
              </div>
            </div>
            <div class="signature-box">
              <div class="signature-line">
                <strong>Approved By</strong><br>
                <br>
                ${transferData.fromBranchName || 'N/A'}
              </div>
            </div>
          </div>

          <div class="footer">
            <p>This form is generated for branches without system access. Please print and submit to the lending branch.</p>
            <p>Generated on: ${format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(pdfContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Calculate transfer statistics
  const transferStats = {
    totalTransfers: transfers.length,
    pendingTransfers: transfers.filter(t => t.status === 'Pending').length,
    inTransitTransfers: transfers.filter(t => t.status === 'In Transit').length,
    completedTransfers: transfers.filter(t => t.status === 'Completed').length,
    totalValue: transfers.reduce((sum, t) => sum + t.totalValue, 0)
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading transfer data...</span>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Transfer Data</h3>
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
        {/* Header - Action Buttons */}
        <div className="flex items-center justify-end gap-3">
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={handleExportToExcel}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              onClick={handlePrintReport}
            >
              <FileText className="h-4 w-4" />
              Report
            </Button>
          <Button 
            variant="outline" 
            onClick={handleCreateBorrowRequest} 
            className="flex items-center gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            <ArrowRight className="h-4 w-4" />
            Create Borrow Request
            </Button>
            <Button onClick={handleCreateTransfer} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Transfer
            </Button>
          </div>

        {/* Incoming Borrow Requests Notification */}
        {incomingBorrowRequests.length > 0 && (
          <Card className="bg-purple-50 border-purple-200 mb-4">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-purple-600" />
                  <div>
                    <h3 className="font-semibold text-purple-900">
                      {incomingBorrowRequests.length} Borrow Request{incomingBorrowRequests.length !== 1 ? 's' : ''} Pending Review
                    </h3>
                    <p className="text-sm text-purple-700">
                      Other branches are requesting to borrow products from you. Review and approve or decline each request.
                    </p>
        </div>
                </div>
                <Button
                  onClick={() => setSelectedTransferType('borrow')}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  View Requests
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
          <Card className="p-4">
            <div className="flex items-center">
              <ArrowRightLeft className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Transfers</p>
                <p className="text-xl font-bold text-gray-900">{transferStats.totalTransfers}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-xl font-bold text-gray-900">{transferStats.pendingTransfers}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <Truck className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">In Transit</p>
                <p className="text-xl font-bold text-gray-900">{transferStats.inTransitTransfers}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-xl font-bold text-gray-900">{transferStats.completedTransfers}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-xl font-bold text-gray-900">₱{transferStats.totalValue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                placeholder="Search by transfer ID, branches, or reason..."
                value={searchTerm}
                onChange={setSearchTerm}
                className="w-full"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={selectedTransferType}
                onChange={(e) => setSelectedTransferType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="transfer">Transfers (Lending)</option>
                <option value="borrow">Borrow Requests</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="Pending">Pending</option>
                <option value="In Transit">In Transit</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <select
                value={filters.fromBranch}
                onChange={(e) => setFilters(prev => ({ ...prev, fromBranch: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">From Branch</option>
                {branches.length > 0 ? branches.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name || branch.branchName || 'Unknown'}</option>
                )) : (
                  <option value="" disabled>Loading branches...</option>
                )}
              </select>
              <select
                value={filters.toBranch}
                onChange={(e) => setFilters(prev => ({ ...prev, toBranch: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">To Branch</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name || branch.branchName || 'Unknown'}</option>
                ))}
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
                  status: 'all',
                  fromBranch: 'all',
                  toBranch: 'all',
                  dateRange: { start: '', end: '' },
                  valueRange: { min: '', max: '' },
                  itemCountRange: { min: '', max: '' },
                  transferType: 'all'
                })}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </Card>

        {/* Transfers Cards */}
        {filteredTransfers.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Transfers Found</h3>
              <p className="text-gray-600">Create your first transfer to get started.</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTransfers.map((transfer) => {
              // Check if this is an incoming borrow request that needs review
              const isIncomingBorrowRequest = 
                transfer.transferType === 'borrow' &&
                transfer.fromBranchId === userData?.branchId && // We are the lending branch
                transfer.status === 'Pending';
              
              // Get product images from items (first 4 products for preview)
              const previewItems = (transfer.items || []).slice(0, 4);
              
              return (
                <Card 
                  key={transfer.id} 
                  className={`p-4 hover:shadow-lg transition-shadow ${isIncomingBorrowRequest ? 'border-2 border-purple-300 bg-purple-50' : ''}`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{transfer.id}</h3>
                        {transfer.transferType === 'borrow' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800" title="Borrow Request">
                            <ArrowRight className="h-3 w-3" />
                            Borrow
                          </span>
                        )}
                        {(!transfer.transferType || transfer.transferType === 'transfer') && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800" title="Transfer">
                            <ArrowRightLeft className="h-3 w-3" />
                            Transfer
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">by {transfer.createdByName || transfer.createdBy}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transfer.status)}`}>
                      {getStatusIcon(transfer.status)}
                      {transfer.status}
                    </span>
                  </div>

                  {/* Branch Info */}
                  <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <Building className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-700">From:</span>
                      <span className="text-gray-900">{transfer.fromBranchName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-700">To:</span>
                      <span className="text-gray-900">{transfer.toBranchName}</span>
                      {transfer.toBranchHasSystem === false && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 ml-1">
                          Manual
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Product Images Preview */}
                  {previewItems.length > 0 && (
                    <div className="mb-3">
                      <div className="grid grid-cols-4 gap-1">
                        {previewItems.map((item, idx) => {
                          // Find product to get image
                          const product = products.find(p => p.id === item.productId);
                          const imageUrl = product?.imageUrl || item.productImageUrl;
                          
                          return (
                            <div key={idx} className="relative aspect-square bg-gray-100 rounded overflow-hidden">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={item.productName || 'Product'}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className="w-full h-full flex items-center justify-center bg-gray-100" style={{ display: imageUrl ? 'none' : 'flex' }}>
                                <Package className="h-6 w-6 text-gray-400" />
                              </div>
                              {item.quantity > 1 && (
                                <div className="absolute bottom-0 right-0 bg-black/70 text-white text-xs px-1 rounded-tl">
                                  {item.quantity}x
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {(transfer.items || []).length > 4 && (
                        <p className="text-xs text-gray-500 mt-1 text-center">
                          +{(transfer.items || []).length - 4} more items
                        </p>
                      )}
                    </div>
                  )}

                  {/* Transfer Date */}
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                    <Calendar className="h-4 w-4" />
                    <span>{format(new Date(transfer.transferDate), 'MMM dd, yyyy')}</span>
                    {transfer.expectedDelivery && (
                      <>
                        <span>•</span>
                        <span>Expected: {format(new Date(transfer.expectedDelivery), 'MMM dd')}</span>
                      </>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-500">Items</p>
                      <p className="text-sm font-semibold text-gray-900">{transfer.totalItems || (transfer.items || []).length} items</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Total Value</p>
                      <p className="text-sm font-bold text-[#160B53]">₱{transfer.totalValue.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    {isIncomingBorrowRequest ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleReviewBorrowRequest(transfer)}
                        className="flex-1 flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <ClipboardList className="h-3 w-3" />
                        Review Request
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(transfer)}
                          className="flex-1 flex items-center justify-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                        {transfer.status === 'Pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTransfer(transfer)}
                            className="flex items-center justify-center gap-1"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination Load More */}
        {filteredTransfers.length > 0 && hasMore && (
          <Card className="p-4">
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={loadMoreTransfers}
                disabled={loadingMore}
                className="flex items-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    Load More ({totalItems - filteredTransfers.length} remaining)
                  </>
                )}
              </Button>
            </div>
            <p className="text-center text-xs text-gray-500 mt-2">
              Showing {filteredTransfers.length} of {totalItems} transfers
            </p>
          </Card>
        )}

        {/* Empty State */}
        {filteredTransfers.length === 0 && !loading && (
          <Card className="p-12 text-center">
            <ArrowRightLeft className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Transfers Found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || Object.values(filters).some(f => f !== 'all' && f !== '') || selectedTransferType !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first stock transfer or borrow request'
              }
            </p>
            <div className="flex gap-3 justify-center">
              <Button 
                variant="outline"
                onClick={handleCreateBorrowRequest} 
                className="flex items-center gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                <ArrowRight className="h-4 w-4" />
                Create Borrow Request
              </Button>
              <Button onClick={handleCreateTransfer} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Transfer
            </Button>
            </div>
          </Card>
        )}

        {/* Review Borrow Request Modal */}
        {isReviewBorrowModalOpen && selectedBorrowRequest && (
          <Modal
            isOpen={isReviewBorrowModalOpen}
            onClose={() => {
              setIsReviewBorrowModalOpen(false);
              setSelectedBorrowRequest(null);
              setApprovedItems([]);
            }}
            title="Review Borrow Request"
            size="xl"
          >
            <div className="space-y-6">
              {/* Request Header */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      Request from {selectedBorrowRequest.toBranchName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      <strong>Request Date:</strong> {format(new Date(selectedBorrowRequest.transferDate), 'MMM dd, yyyy')}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Reason:</strong> {selectedBorrowRequest.reason}
                    </p>
                    {selectedBorrowRequest.notes && (
                      <p className="text-sm text-gray-600 mt-1">
                        <strong>Notes:</strong> {selectedBorrowRequest.notes}
                      </p>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                    <Clock className="h-4 w-4" />
                    Pending Review
                  </span>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Instructions:</strong> Review each item below. You can approve or decline individual items, 
                  and adjust the approved quantity. Only approved items will be processed and deducted from your stock.
                </p>
              </div>

              {/* Items List with Approval Options */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Requested Items</h4>
                {approvedItems.map((item, index) => (
                  <div key={index} className={`border rounded-lg p-4 ${item.approved ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Checkbox to Approve */}
                      <div className="col-span-1">
                        <input
                          type="checkbox"
                          checked={item.approved}
                          onChange={(e) => {
                            const updated = [...approvedItems];
                            updated[index] = {
                              ...item,
                              approved: e.target.checked,
                              approvedQuantity: e.target.checked ? Math.min(item.quantity, item.availableStock) : 0
                            };
                            setApprovedItems(updated);
                          }}
                          className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                          disabled={item.availableStock === 0}
                        />
                      </div>

                      {/* Product Info */}
                      <div className="col-span-4">
                        <p className="font-medium text-gray-900">{item.productName}</p>
                        <p className="text-xs text-gray-500">Unit Cost: ₱{(item.unitCost || 0).toLocaleString()}</p>
                      </div>

                      {/* Requested Quantity */}
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500">Requested</label>
                        <p className="text-sm font-medium text-gray-900">{item.quantity} units</p>
                      </div>

                      {/* Available Stock */}
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500">Available</label>
                        <p className={`text-sm font-medium ${item.availableStock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.availableStock} units
                        </p>
                        {item.availableStock === 0 && (
                          <p className="text-xs text-red-600 mt-1">Out of stock</p>
                        )}
                      </div>

                      {/* Approved Quantity (editable) */}
                      <div className="col-span-3">
                        <label className="text-xs text-gray-500 mb-1 block">Approve Quantity</label>
                        <Input
                          type="number"
                          min="0"
                          max={item.availableStock}
                          value={item.approvedQuantity || 0}
                          onChange={(e) => {
                            const qty = Math.max(0, Math.min(parseInt(e.target.value) || 0, item.availableStock));
                            const updated = [...approvedItems];
                            updated[index] = {
                              ...item,
                              approvedQuantity: qty,
                              approved: qty > 0
                            };
                            setApprovedItems(updated);
                          }}
                          disabled={!item.approved || item.availableStock === 0}
                          className={`text-sm ${item.approved ? '' : 'bg-gray-100'}`}
                        />
                      </div>
                    </div>

                    {/* Total Cost for this item */}
                    {item.approved && item.approvedQuantity > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                          Total: <span className="font-semibold text-gray-900">
                            ₱{(item.approvedQuantity * (item.unitCost || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary */}
              {approvedItems.some(item => item.approved && item.approvedQuantity > 0) && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Approval Summary</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Items Approved:</p>
                      <p className="text-lg font-bold text-gray-900">
                        {approvedItems.filter(item => item.approved && item.approvedQuantity > 0).length} items
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Quantity:</p>
                      <p className="text-lg font-bold text-gray-900">
                        {approvedItems.reduce((sum, item) => sum + (item.approved && item.approvedQuantity > 0 ? item.approvedQuantity : 0), 0)} units
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-gray-600">Total Value:</p>
                      <p className="text-xl font-bold text-green-600">
                        ₱{approvedItems.reduce((sum, item) => 
                          sum + (item.approved && item.approvedQuantity > 0 ? (item.approvedQuantity * (item.unitCost || 0)) : 0), 
                          0
                        ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDeclineBorrowRequest}
                  disabled={isSubmitting}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Decline Request
                </Button>
                <Button
                  type="button"
                  onClick={handleApproveBorrowRequest}
                  disabled={isSubmitting || !approvedItems.some(item => item.approved && item.approvedQuantity > 0)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Selected Items
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Transfer Details Modal */}
        {isDetailsModalOpen && selectedTransfer && (
          <Modal
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false);
              setSelectedTransfer(null);
            }}
            title="Transfer Details"
            size="lg"
          >
            <div className="space-y-6">
              {/* Print Button */}
              <div className="flex justify-end mb-4">
                <Button
                  variant="outline"
                  onClick={() => handlePrintTransfer(selectedTransfer)}
                  className="flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print Transfer
                </Button>
              </div>

              {/* Transfer Header */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold text-gray-900">{selectedTransfer.id}</h2>
                    {selectedTransfer.transferType === 'borrow' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <ArrowRight className="h-3 w-3" />
                        Borrow Request
                      </span>
                    )}
                    {(!selectedTransfer.transferType || selectedTransfer.transferType === 'transfer') && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <ArrowRightLeft className="h-3 w-3" />
                        Transfer
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600">{selectedTransfer.reason}</p>
                  {selectedTransfer.transferType === 'borrow' && (
                    <p className="text-xs text-purple-700 mt-1">
                      <strong>Note:</strong> This is a borrow request. Stock will be deducted by the lending branch when approved.
                    </p>
                  )}
                </div>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedTransfer.status)}`}>
                  {getStatusIcon(selectedTransfer.status)}
                  {selectedTransfer.status}
                </span>
              </div>

              {/* Transfer Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      {selectedTransfer.transferType === 'borrow' ? 'Lending Branch (From)' : 'From Branch'}
                    </label>
                    <p className="text-gray-900">{selectedTransfer.fromBranchName}</p>
                    {selectedTransfer.transferType === 'borrow' && (
                      <p className="text-xs text-purple-600 mt-1">Branch that will lend the stock</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      {selectedTransfer.transferType === 'borrow' ? 'Requesting Branch (To)' : 'To Branch'}
                    </label>
                    <div className="flex items-center gap-2">
                    <p className="text-gray-900">{selectedTransfer.toBranchName}</p>
                      {selectedTransfer.toBranchHasSystem === false && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <AlertCircle className="h-3 w-3" />
                          Manual Branch
                        </span>
                      )}
                    </div>
                    {selectedTransfer.transferType === 'borrow' && (
                      <p className="text-xs text-purple-600 mt-1">Branch that requested the stock</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Transfer Date</label>
                    <p className="text-gray-900">{format(new Date(selectedTransfer.transferDate), 'MMM dd, yyyy')}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Expected Delivery</label>
                    <p className="text-gray-900">{format(new Date(selectedTransfer.expectedDelivery), 'MMM dd, yyyy')}</p>
                  </div>
                  
                  {selectedTransfer.actualDelivery && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Actual Delivery</label>
                      <p className="text-green-600">{format(new Date(selectedTransfer.actualDelivery), 'MMM dd, yyyy')}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Value</label>
                    <p className="text-2xl font-bold text-gray-900">₱{selectedTransfer.totalValue.toLocaleString()}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Number of Items</label>
                    <p className="text-gray-900">{selectedTransfer.totalItems} items</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created By</label>
                    <p className="text-gray-900">{selectedTransfer.createdBy}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Notes</label>
                    <p className="text-gray-900">{selectedTransfer.notes || 'No notes'}</p>
                  </div>
                </div>
              </div>

              {/* Transfer Items */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Transfer Items</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedTransfer.items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.productName}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">₱{item.unitCost.toLocaleString()}</td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">₱{item.totalCost.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Create Borrow Request Modal */}
        {isCreateBorrowModalOpen && (
          <Modal
            isOpen={isCreateBorrowModalOpen}
            onClose={() => {
              setIsCreateBorrowModalOpen(false);
              setFormData({
                transferType: 'borrow',
                fromBranchId: '',
                toBranchId: userData?.branchId || '',
                toBranchName: '',
                toBranchHasSystem: false,
                transferDate: new Date().toISOString().split('T')[0],
                expectedDelivery: '',
                reason: '',
                notes: '',
                items: []
              });
              setFormErrors({});
              setLendingBranchStocks([]); // Clear lending branch stocks
            }}
            title="Create Borrow Request"
            size="xl"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-purple-800">
                  <strong>Borrow Request:</strong> Request to borrow stock from another branch. 
                  Stock will not be deducted until the lending branch approves and processes the request.
                </p>
              </div>
              
              {/* Transfer Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* From Branch - Select branch to borrow FROM */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From Branch (Lending Branch) *</label>
                  <select
                    value={formData.fromBranchId}
                    onChange={async (e) => {
                      const selectedBranchId = e.target.value;
                      const selectedBranch = branches.find(b => b.id === selectedBranchId);
                      setFormData(prev => ({ 
                        ...prev, 
                        fromBranchId: selectedBranchId,
                        fromBranchName: selectedBranch?.name || '',
                        items: [] // Clear items when branch changes
                      }));
                      setFormErrors(prev => ({ ...prev, fromBranchId: '' }));
                      
                      // Load available stocks from BOTH branches (intersection)
                      // Only show products that exist in BOTH the lending branch AND current branch
                      if (selectedBranchId && products.length > 0 && userData?.branchId) {
                        try {
                          const stocksRef = collection(db, 'stocks');
                          
                          // Fetch stocks from LENDING branch
                          const lendingBranchQuery = query(
                            stocksRef,
                            where('branchId', '==', selectedBranchId),
                            where('status', '==', 'active')
                          );
                          const lendingStocksSnapshot = await getDocs(lendingBranchQuery);
                          const lendingStocks = lendingStocksSnapshot.docs
                            .map(doc => {
                              const data = doc.data();
                              return {
                                id: doc.id,
                                productId: data.productId,
                                productName: data.productName,
                                realTimeStock: data.realTimeStock || 0
                              };
                            })
                            .filter(stock => stock.realTimeStock > 0); // Only stocks with available quantity
                          
                          // Fetch stocks from CURRENT branch (user's branch)
                          const currentBranchQuery = query(
                            stocksRef,
                            where('branchId', '==', userData.branchId),
                            where('status', '==', 'active')
                          );
                          const currentStocksSnapshot = await getDocs(currentBranchQuery);
                          const currentStocks = currentStocksSnapshot.docs
                            .map(doc => {
                              const data = doc.data();
                              return {
                                id: doc.id,
                                productId: data.productId
                              };
                            });
                          
                          // Find intersection: products that exist in BOTH branches
                          const currentBranchProductIds = new Set(currentStocks.map(s => s.productId));
                          const intersectionStocks = lendingStocks
                            .filter(lendingStock => currentBranchProductIds.has(lendingStock.productId))
                            .map(stock => {
                              const product = products.find(p => p.id === stock.productId);
                              return {
                                id: stock.id,
                                ...stock,
                                branchId: selectedBranchId,
                                otcPrice: product?.otcPrice || 0,
                                unitCost: product?.otcPrice || 0
                              };
                            });
                          
                          setLendingBranchStocks(intersectionStocks);
                        } catch (err) {
                          console.error('Error loading lending branch stocks:', err);
                          setLendingBranchStocks([]);
                        }
                      } else {
                        setLendingBranchStocks([]);
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                      formErrors.fromBranchId ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  >
                    <option value="">Select Branch to Borrow From</option>
                    {branches.filter(b => b.id !== userData?.branchId).map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                  {formErrors.fromBranchId && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.fromBranchId}</p>
                  )}
                  {formData.fromBranchId && lendingBranchStocks.length > 0 && (
                    <p className="text-xs text-purple-600 mt-1">
                      {lendingBranchStocks.length} product{lendingBranchStocks.length !== 1 ? 's' : ''} available in both branches
                    </p>
                  )}
                  {formData.fromBranchId && lendingBranchStocks.length === 0 && (
                    <p className="text-xs text-yellow-600 mt-1">
                      No common products found. Products must exist in both {formData.fromBranchName} and your branch.
                    </p>
                  )}
                </div>
                
                {/* To Branch - Auto-filled (current branch) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To Branch (Your Branch)</label>
                  <Input
                    type="text"
                    value={branches.find(b => b.id === userData?.branchId)?.name || 'Current Branch'}
                    disabled
                    className="bg-gray-50 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Automatically set to your branch (receiving)</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Request Date *</label>
                  <Input
                    type="date"
                    value={formData.transferDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, transferDate: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expected Delivery *</label>
                  <Input
                    type="date"
                    value={formData.expectedDelivery}
                    onChange={(e) => setFormData(prev => ({ ...prev, expectedDelivery: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reason *</label>
                  <select
                    value={formData.reason}
                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    required
                  >
                    <option value="">Select Reason</option>
                    <option value="Stock Rebalancing">Stock Rebalancing</option>
                    <option value="Overstock">Overstock</option>
                    <option value="Emergency Stock">Emergency Stock</option>
                    <option value="Seasonal Demand">Seasonal Demand</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <Input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              {/* Request Items */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">Request Items</h3>
                    <p className="text-xs text-gray-500">
                      Select products available from {formData.fromBranchName || 'the lending branch'} that also exist in your branch
                    </p>
                  </div>
                  <Button 
                    type="button" 
                    onClick={addItem} 
                    className="flex items-center gap-2"
                    disabled={!formData.fromBranchId}
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                </div>
                
                {!formData.fromBranchId ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-yellow-800">
                      <strong>Note:</strong> Please select a lending branch first to see available products.
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-blue-800">
                      <strong>Available Products:</strong> You can only borrow products that exist in <strong>both</strong> your branch <strong>and</strong> <strong>{formData.fromBranchName}</strong>. 
                      {lendingBranchStocks.length > 0 
                        ? ` ${lendingBranchStocks.length} common product${lendingBranchStocks.length !== 1 ? 's' : ''} found.`
                        : ' No common products found between branches.'}
                    </p>
                  </div>
                )}
                
                <div className="space-y-4">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-4 items-end">
                      <div className="col-span-5">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Product *</label>
                        {!formData.fromBranchId ? (
                          <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                            <p className="text-sm text-gray-500">Select lending branch first</p>
                          </div>
                        ) : lendingBranchStocks.length === 0 ? (
                          <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                            <p className="text-sm text-gray-500">No common products available</p>
                          </div>
                        ) : (
                          <>
                            <select
                              value={item.productId || ''}
                              onChange={(e) => {
                                const stock = lendingBranchStocks.find(s => s.productId === e.target.value);
                                if (stock) {
                                  updateItem(index, 'productId', stock.productId);
                                  updateItem(index, 'productName', stock.productName);
                                  updateItem(index, 'unitCost', stock.otcPrice || stock.unitCost || 0);
                                  updateItem(index, 'availableStock', stock.realTimeStock);
                                  // Auto-calculate total
                                  updateItem(index, 'totalCost', (item.quantity || 0) * (stock.otcPrice || 0));
                                }
                                setFormErrors(prev => ({ ...prev, [`item${index}_product`]: '' }));
                              }}
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                                formErrors[`item${index}_product`] ? 'border-red-500' : 'border-gray-300'
                              }`}
                            >
                              <option value="">Select Product from {formData.fromBranchName}</option>
                              {lendingBranchStocks.map(stock => (
                                <option key={stock.id} value={stock.productId}>
                                  {stock.productName} (Available: {stock.realTimeStock} units)
                                </option>
                              ))}
                            </select>
                            {item.availableStock !== undefined && (
                              <p className="text-xs text-gray-500 mt-1">
                                Available in {formData.fromBranchName}: {item.availableStock} units
                              </p>
                            )}
                          </>
                        )}
                        {formErrors[`item${index}_product`] && (
                          <p className="text-red-500 text-xs mt-1">{formErrors[`item${index}_product`]}</p>
                        )}
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
                        <Input
                          type="number"
                          min="1"
                          max={item.availableStock || 9999}
                          value={item.quantity}
                          onChange={(e) => {
                            const qty = parseInt(e.target.value) || 0;
                            updateItem(index, 'quantity', qty);
                            // Auto-calculate total
                            updateItem(index, 'totalCost', qty * (item.unitCost || 0));
                          }}
                          className={formErrors[`item${index}_quantity`] ? 'border-red-500' : ''}
                          disabled={!item.productId}
                        />
                        {item.availableStock !== undefined && (
                          <p className="text-xs text-gray-500 mt-1">
                            Max: {item.availableStock} units
                          </p>
                        )}
                        {formErrors[`item${index}_quantity`] && (
                          <p className="text-red-500 text-xs mt-1">{formErrors[`item${index}_quantity`]}</p>
                        )}
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Unit Cost</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitCost || 0}
                          disabled
                          className="bg-gray-50 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500 mt-1">Auto-set from product</p>
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Total</label>
                        <Input
                          type="number"
                          value={item.totalCost || 0}
                          disabled
                          className="bg-gray-50"
                        />
                      </div>
                      
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className="w-full"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {formData.items.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No items added yet. Click "Add Item" to specify what you want to borrow.
                  </div>
                )}
              </div>

              {/* Total */}
              {formData.items.length > 0 && (
                <div className="border-t-2 border-purple-200 pt-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Borrow Request Summary</h4>
                      <p className="text-xs text-gray-500">Total value of items being requested</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-purple-600">
                        ₱{formData.items.reduce((sum, item) => sum + (parseFloat(item.totalCost) || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {formData.items.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0)} items • {formData.items.length} product{formData.items.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {formErrors.general && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-800 text-sm">{formErrors.general}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateBorrowModalOpen(false);
                    setFormData({
                      transferType: 'borrow',
                      fromBranchId: '',
                      toBranchId: userData?.branchId || '',
                      toBranchName: '',
                      toBranchHasSystem: false,
                      transferDate: new Date().toISOString().split('T')[0],
                      expectedDelivery: '',
                      reason: '',
                      notes: '',
                      items: []
                    });
                    setFormErrors({});
                    setLendingBranchStocks([]); // Clear lending branch stocks
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                {!formData.toBranchHasSystem && formData.items.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const tempTransferData = {
                        id: `BR-${Date.now()}`,
                        transferType: 'borrow',
                        fromBranchName: branches.find(b => b.id === formData.fromBranchId)?.name || formData.fromBranchName || 'N/A',
                        toBranchName: branches.find(b => b.id === userData?.branchId)?.name || 'N/A',
                        transferDate: formData.transferDate,
                        expectedDelivery: formData.expectedDelivery,
                        reason: formData.reason,
                        notes: formData.notes,
                        items: formData.items,
                        totalValue: formData.items.reduce((sum, item) => sum + parseFloat(item.totalCost || 0), 0),
                        createdByName: userData?.name || userData?.email || 'N/A'
                      };
                      handleGenerateBorrowRequestPDF(tempTransferData);
                    }}
                    className="flex items-center gap-2 border-green-300 text-green-700 hover:bg-green-50"
                  >
                    <FileText className="h-4 w-4" />
                    Generate PDF Form
                  </Button>
                )}
                <Button type="submit" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700">
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Create Borrow Request
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Create/Edit Transfer Modal */}
        {(isCreateModalOpen || isEditModalOpen) && (
          <Modal
            isOpen={isCreateModalOpen || isEditModalOpen}
            onClose={() => {
              setIsCreateModalOpen(false);
              setIsEditModalOpen(false);
              setSelectedTransfer(null);
              setPendingRequestsFromToBranch([]);
              setSelectedRequestId('');
            }}
            title={isCreateModalOpen ? 'Create Stock Transfer' : 'Edit Stock Transfer'}
            size="xl"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Transfer Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* From Branch - Auto-filled from logged-in user */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From Branch</label>
                  <Input
                    type="text"
                    value={branches.find(b => b.id === userData?.branchId)?.name || 'Current Branch'}
                    disabled
                    className="bg-gray-50 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Automatically set to your branch</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    To Branch * 
                    <span className="text-xs text-gray-500 ml-2">(Select branch or enter manual branch)</span>
                  </label>
                  
                  {/* Checkbox for branches without system */}
                  <div className="mb-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={!formData.toBranchHasSystem}
                        onChange={(e) => {
                          const withoutSystem = e.target.checked; // true if checked (branch without system)
                          setFormData(prev => ({
                            ...prev,
                            toBranchHasSystem: !withoutSystem, // if withoutSystem=true, hasSystem=false
                            toBranchId: withoutSystem ? '' : prev.toBranchId,
                            toBranchName: withoutSystem ? '' : prev.toBranchName
                          }));
                          setFormErrors(prev => ({ ...prev, toBranchId: '', toBranchName: '' }));
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Branch without system (manual/offline branch)
                      </span>
                    </label>
                  </div>
                  
                  {formData.toBranchHasSystem ? (
                    <>
                      <select
                        value={formData.toBranchId}
                        onChange={async (e) => {
                          const selectedBranchId = e.target.value;
                          const selectedBranch = branches.find(b => b.id === selectedBranchId);
                          setFormData(prev => ({ 
                            ...prev, 
                            toBranchId: selectedBranchId,
                            toBranchName: selectedBranch?.name || '',
                            items: [] // Clear items when branch changes
                          }));
                          setFormErrors(prev => ({ ...prev, toBranchId: '' }));
                          setSelectedRequestId(''); // Clear selected request
                          
                          // Fetch pending borrow requests FROM this To Branch TO current branch
                          if (selectedBranchId && userData?.branchId) {
                            try {
                              const transfersRef = collection(db, 'stock_transfer');
                              const requestsQuery = query(
                                transfersRef,
                                where('transferType', '==', 'borrow'),
                                where('fromBranchId', '==', selectedBranchId), // They requested from us
                                where('toBranchId', '==', userData.branchId), // We are the receiving branch
                                where('status', '==', 'Pending')
                              );
                              const requestsSnapshot = await getDocs(requestsQuery);
                              const requests = requestsSnapshot.docs.map(doc => ({
                                id: doc.id,
                                ...doc.data(),
                                transferDate: doc.data().transferDate?.toDate ? doc.data().transferDate.toDate() : doc.data().transferDate
                              }));
                              setPendingRequestsFromToBranch(requests);
                            } catch (err) {
                              console.error('Error loading pending requests:', err);
                              setPendingRequestsFromToBranch([]);
                            }
                          } else {
                            setPendingRequestsFromToBranch([]);
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          formErrors.toBranchId ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select To Branch</option>
                        {branches.filter(b => b.id !== userData?.branchId).map(branch => (
                          <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                      </select>
                      
                      {/* Request Selection Dropdown - Only show if there are pending requests */}
                      {formData.toBranchId && pendingRequestsFromToBranch.length > 0 && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Request (Optional - to autofill items)
                          </label>
                          <select
                            value={selectedRequestId}
                            onChange={async (e) => {
                              const requestId = e.target.value;
                              setSelectedRequestId(requestId);
                              
                              // Autofill items from selected request
                              if (requestId) {
                                const selectedRequest = pendingRequestsFromToBranch.find(r => r.id === requestId);
                                if (selectedRequest && selectedRequest.items && userData?.branchId) {
                                  try {
                                    // Load current stock for each item in the request to get accurate data
                                    const stocksRef = collection(db, 'stocks');
                                    const autofilledItems = await Promise.all(
                                      selectedRequest.items.map(async (requestItem) => {
                                        try {
                                          // Find stock for this product in our branch
                                          const stockQuery = query(
                                            stocksRef,
                                            where('branchId', '==', userData.branchId),
                                            where('productId', '==', requestItem.productId),
                                            where('status', '==', 'active')
                                          );
                                          const stockSnapshot = await getDocs(stockQuery);
                                          
                                          if (!stockSnapshot.empty) {
                                            const stockDoc = stockSnapshot.docs[0];
                                            const stockData = stockDoc.data();
                                            const product = products.find(p => p.id === requestItem.productId);
                                            const availableQty = stockData.realTimeStock || 0;
                                            const unitCost = product?.otcPrice || stockData.otcPrice || 0;
                                            const quantity = Math.min(requestItem.quantity, availableQty);
                                            
                                            return {
                                              productId: requestItem.productId,
                                              productName: requestItem.productName,
                                              quantity: quantity,
                                              unitCost: unitCost,
                                              totalCost: quantity * unitCost,
                                              stockId: stockDoc.id,
                                              availableStock: availableQty,
                                              branchId: userData.branchId
                                            };
                                          }
                                          return null; // Stock not available in our branch
                                        } catch (err) {
                                          console.error(`Error loading stock for product ${requestItem.productId}:`, err);
                                          return null;
                                        }
                                      })
                                    );
                                    
                                    // Filter out null items (items not available in our stock)
                                    const validItems = autofilledItems.filter(item => item !== null);
                                    
                                    setFormData(prev => ({
                                      ...prev,
                                      items: validItems,
                                      reason: selectedRequest.reason || prev.reason,
                                      notes: selectedRequest.notes || prev.notes
                                    }));
                                  } catch (err) {
                                    console.error('Error autofilling items from request:', err);
                                    // Fallback: try using availableStocks if async loading fails
                                    const autofilledItems = selectedRequest.items.map(requestItem => {
                                      const matchingStock = availableStocks.find(stock => 
                                        stock.productId === requestItem.productId && 
                                        stock.branchId === userData?.branchId
                                      );
                                      
                                      if (matchingStock) {
                                        const quantity = Math.min(requestItem.quantity, matchingStock.realTimeStock);
                                        return {
                                          productId: requestItem.productId,
                                          productName: requestItem.productName,
                                          quantity: quantity,
                                          unitCost: matchingStock.otcPrice || matchingStock.unitCost || 0,
                                          totalCost: quantity * (matchingStock.otcPrice || matchingStock.unitCost || 0),
                                          stockId: matchingStock.id,
                                          availableStock: matchingStock.realTimeStock,
                                          branchId: matchingStock.branchId
                                        };
                                      }
                                      return null;
                                    }).filter(item => item !== null);
                                    
                                    setFormData(prev => ({
                                      ...prev,
                                      items: autofilledItems,
                                      reason: selectedRequest.reason || prev.reason,
                                      notes: selectedRequest.notes || prev.notes
                                    }));
                                  }
                                }
                              } else {
                                // Clear items if no request selected
                                setFormData(prev => ({ ...prev, items: [] }));
                              }
                            }}
                            className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-purple-50"
                          >
                            <option value="">No request selected (manual entry)</option>
                            {pendingRequestsFromToBranch.map(request => (
                              <option key={request.id} value={request.id}>
                                Request #{request.id} - {request.items?.length || 0} items - {format(new Date(request.transferDate), 'MMM dd, yyyy')} - {request.reason || 'No reason'}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-purple-600 mt-1">
                            {pendingRequestsFromToBranch.length} pending request{pendingRequestsFromToBranch.length !== 1 ? 's' : ''} from {formData.toBranchName}. Select one to autofill items.
                          </p>
                        </div>
                      )}
                      
                      {formData.toBranchId && pendingRequestsFromToBranch.length === 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          No pending requests from {formData.toBranchName}. You can add items manually.
                        </p>
                      )}
                    </>
                  ) : (
                    <Input
                      type="text"
                      value={formData.toBranchName}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, toBranchName: e.target.value }));
                        setFormErrors(prev => ({ ...prev, toBranchName: '' }));
                      }}
                      placeholder="Enter branch name (manual/offline branch)"
                      className={formErrors.toBranchName ? 'border-red-500' : ''}
                    />
                  )}
                  
                  {formErrors.toBranchId && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.toBranchId}</p>
                  )}
                  {formErrors.toBranchName && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.toBranchName}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Transfer Date *</label>
                  <Input
                    type="date"
                    value={formData.transferDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, transferDate: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expected Delivery *</label>
                  <Input
                    type="date"
                    value={formData.expectedDelivery}
                    onChange={(e) => setFormData(prev => ({ ...prev, expectedDelivery: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reason *</label>
                  <select
                    value={formData.reason}
                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select Reason</option>
                    <option value="Stock Rebalancing">Stock Rebalancing</option>
                    <option value="Overstock">Overstock</option>
                    <option value="Emergency Stock">Emergency Stock</option>
                    <option value="Seasonal Demand">Seasonal Demand</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <Input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              {/* Transfer Items */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                  <h3 className="font-semibold text-gray-900">Transfer Items</h3>
                    {/* Real-time Total Transfer Value */}
                    {formData.items.length > 0 && (
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-900">Total Transfer Value:</span>
                          <span className="text-xl font-bold text-blue-600">
                            ₱{formData.items.reduce((sum, item) => sum + (parseFloat(item.totalCost) || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-blue-700">Total Items:</span>
                          <span className="text-sm font-medium text-blue-900">
                            {formData.items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0)} units
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <Button type="button" onClick={addItem} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                </div>
                
                <div className="space-y-5">
                  {formData.items.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow">
                      {/* Item Header */}
                      <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-sm font-semibold text-blue-700">{index + 1}</span>
                          </div>
                          <h4 className="text-base font-semibold text-gray-800">Transfer Item #{index + 1}</h4>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-5">
                        {/* Product Selection */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                            Product <span className="text-red-500">*</span>
                          </label>
                          {availableStocks.length === 0 ? (
                            <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50">
                              <p className="text-sm text-gray-500">
                                {!userData?.branchId 
                                  ? 'You must be assigned to a branch to transfer stock'
                                  : 'No available stock in your branch'}
                              </p>
                            </div>
                          ) : (
                            <>
                              <select
                                value={item.productId}
                                onChange={async (e) => {
                                  const productId = e.target.value;
                                  updateItem(index, 'productId', productId);
                                  updateItem(index, 'selectedUsageTypes', []); // Clear usage types
                                  // Fetch batches when product is selected
                                  if (productId && userData?.branchId) {
                                    await fetchBatchesForProduct(productId, userData.branchId);
                                  }
                                  // Clear batch selection when product changes
                                  updateItem(index, 'selectedBatchId', '');
                                }}
                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all ${
                                  formErrors[`item${index}_product`] ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
                                }`}
                              >
                                <option value="">-- Select Product from Your Branch --</option>
                                {uniqueProducts
                                  .filter(product => {
                                    // Filter out already selected products (prevent duplicates)
                                    const isAlreadySelected = formData.items.some((otherItem, otherIndex) => 
                                      otherIndex !== index && otherItem.productId === product.productId
                                    );
                                    return !isAlreadySelected;
                                  })
                                  .map(product => {
                                    const badges = [];
                                    if (product.hasOTC) badges.push(`🟢 OTC: ${product.otcStock}`);
                                    if (product.hasSalonUse) badges.push(`🔵 Salon Use: ${product.salonUseStock}`);
                                    const badgeText = badges.join(' | ');
                                    
                                    return (
                                      <option key={product.productId} value={product.productId}>
                                        {product.productName} ({badgeText} units)
                                      </option>
                                    );
                                  })}
                              </select>
                              {item.productId && (() => {
                                const selectedProduct = uniqueProducts.find(p => p.productId === item.productId);
                                if (!selectedProduct) return null;
                                
                                return (
                                  <div className="mt-2.5 space-y-2">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                                      <Package className="h-4 w-4 text-gray-500" />
                                      <p className="text-xs text-gray-700">
                                        <span className="font-semibold">Product:</span> {selectedProduct.productName}
                                      </p>
                                    </div>
                                    
                                    {/* Usage Type Selection */}
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                      <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                                        Select Usage Type(s) <span className="text-red-500">*</span>
                                        <span className="text-xs font-normal text-gray-600 ml-2">(Choose OTC, Salon Use, or both)</span>
                                      </label>
                                      <div className="flex gap-4">
                                        {selectedProduct.hasOTC && (
                                          <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={item.selectedUsageTypes?.includes('otc') || false}
                                              onChange={(e) => {
                                                const currentTypes = item.selectedUsageTypes || [];
                                                if (e.target.checked) {
                                                  updateItem(index, 'selectedUsageTypes', [...currentTypes, 'otc']);
                                                } else {
                                                  updateItem(index, 'selectedUsageTypes', currentTypes.filter(t => t !== 'otc'));
                                                  // Clear batch if it was OTC
                                                  if (item.selectedBatchId) {
                                                    const batch = productBatches[item.productId]?.find(b => b.batchId === item.selectedBatchId);
                                                    if (batch?.usageType === 'otc') {
                                                      updateItem(index, 'selectedBatchId', '');
                                                    }
                                                  }
                                                }
                                              }}
                                              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">
                                              🟢 OTC ({selectedProduct.otcStock} units)
                                            </span>
                                          </label>
                                        )}
                                        {selectedProduct.hasSalonUse && (
                                          <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={item.selectedUsageTypes?.includes('salon-use') || false}
                                              onChange={(e) => {
                                                const currentTypes = item.selectedUsageTypes || [];
                                                if (e.target.checked) {
                                                  updateItem(index, 'selectedUsageTypes', [...currentTypes, 'salon-use']);
                                                } else {
                                                  updateItem(index, 'selectedUsageTypes', currentTypes.filter(t => t !== 'salon-use'));
                                                  // Clear batch if it was Salon Use
                                                  if (item.selectedBatchId) {
                                                    const batch = productBatches[item.productId]?.find(b => b.batchId === item.selectedBatchId);
                                                    if (batch?.usageType === 'salon-use') {
                                                      updateItem(index, 'selectedBatchId', '');
                                                    }
                                                  }
                                                }
                                              }}
                                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">
                                              🔵 Salon Use ({selectedProduct.salonUseStock} units)
                                            </span>
                                          </label>
                                        )}
                                      </div>
                                      {(!item.selectedUsageTypes || item.selectedUsageTypes.length === 0) && (
                                        <p className="text-xs text-red-500 mt-2 flex items-center gap-1.5">
                                          <AlertCircle className="h-3.5 w-3.5" />
                                          Please select at least one usage type
                                        </p>
                                      )}
                                      {formErrors[`item${index}_usageType`] && (
                                        <p className="text-red-500 text-xs mt-2 flex items-center gap-1.5">
                                          <AlertCircle className="h-3.5 w-3.5" />
                                          {formErrors[`item${index}_usageType`]}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                              {formErrors[`item${index}_product`] && (
                                <p className="text-red-500 text-xs mt-2 flex items-center gap-1.5">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  {formErrors[`item${index}_product`]}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                        
                        {/* Batch Selection - Only show for transfers, and when product and usage type are selected */}
                        {formData.transferType === 'transfer' && item.productId && item.selectedUsageTypes && item.selectedUsageTypes.length > 0 && (
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                              Batch Number <span className="text-red-500">*</span>
                              <span className="text-xs font-normal text-gray-600 ml-2">(Select which batch to transfer from)</span>
                            </label>
                            {!productBatches[item.productId] ? (
                              <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white">
                                <div className="flex items-center gap-2.5">
                                  <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                                  <p className="text-sm text-gray-600">Loading batches...</p>
                                </div>
                              </div>
                            ) : (() => {
                              // Filter batches by selected usage types
                              const filteredBatches = productBatches[item.productId]?.filter(batch => {
                                const batchUsageType = batch.usageType || (batch.otcPrice > 0 ? 'otc' : 'salon-use');
                                return item.selectedUsageTypes.includes(batchUsageType);
                              }) || [];
                              
                              if (filteredBatches.length === 0) {
                                return (
                                  <div className="w-full px-4 py-3 border border-yellow-300 rounded-lg bg-yellow-50">
                                    <div className="flex items-center gap-2.5">
                                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                      <p className="text-sm text-yellow-700">
                                        No batches available for selected usage type(s): {item.selectedUsageTypes.join(', ')}
                                      </p>
                                    </div>
                                  </div>
                                );
                              }
                              
                              return (
                                <>
                                  <select
                                    value={item.selectedBatchId || ''}
                                    onChange={(e) => {
                                      const batchId = e.target.value;
                                      const selectedBatch = filteredBatches.find(b => b.batchId === batchId);
                                      updateItem(index, 'selectedBatchId', batchId);
                                      if (selectedBatch) {
                                        updateItem(index, 'selectedBatchNumber', selectedBatch.batchNumber);
                                        updateItem(index, 'selectedBatchRemaining', selectedBatch.remainingQuantity);
                                        updateItem(index, 'usageType', selectedBatch.usageType || (selectedBatch.otcPrice > 0 ? 'otc' : 'salon-use'));
                                        // Update max quantity based on batch availability
                                        if (item.quantity > selectedBatch.remainingQuantity) {
                                          updateItem(index, 'quantity', selectedBatch.remainingQuantity);
                                        }
                                      }
                                    }}
                                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium transition-all ${
                                      formErrors[`item${index}_batch`] ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
                                    }`}
                                    required
                                  >
                                    <option value="">-- Select Batch Number --</option>
                                    {filteredBatches.map(batch => {
                                      const batchUsageType = batch.usageType || (batch.otcPrice > 0 ? 'otc' : 'salon-use');
                                      const typeBadge = batchUsageType === 'otc' ? '🟢 OTC' : '🔵 Salon Use';
                                      return (
                                        <option key={batch.batchId} value={batch.batchId}>
                                          {batch.batchNumber} [{typeBadge}] - {batch.remainingQuantity} units available
                                          {batch.expirationDate ? ` (Expires: ${format(new Date(batch.expirationDate), 'MMM dd, yyyy')})` : ''}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  {item.selectedBatchId && (
                                    <div className="mt-3 p-3 bg-white border border-blue-300 rounded-md shadow-sm">
                                      <div className="flex items-center gap-2.5">
                                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                                        <div className="flex-1">
                                          <p className="text-xs text-gray-700">
                                            <span className="font-semibold">Selected Batch:</span>
                                          </p>
                                          <p className="text-sm font-mono text-blue-700 font-semibold mt-0.5">
                                            {item.selectedBatchNumber}
                                          </p>
                                          <p className="text-xs text-gray-600 mt-1">
                                            <span className="font-medium">{item.selectedBatchRemaining || 0} units</span> available for transfer
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {formErrors[`item${index}_batch`] && (
                                    <p className="text-red-500 text-xs mt-2 flex items-center gap-1.5">
                                      <AlertCircle className="h-3.5 w-3.5" />
                                      {formErrors[`item${index}_batch`]}
                                    </p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                        
                        {/* Quantity, Unit Cost, and Total */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                          <div>
                            <label className="block text-sm font-semibold text-gray-800 mb-2.5">
                              Quantity <span className="text-red-500">*</span>
                            </label>
                            <Input
                              type="number"
                              min="1"
                              max={item.selectedBatchRemaining || item.availableStock || 9999}
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                              className={`text-sm ${formErrors[`item${index}_quantity`] ? 'border-red-500 bg-red-50' : ''}`}
                              placeholder="Enter quantity"
                            />
                            {item.selectedBatchRemaining !== undefined && (
                              <p className="text-xs text-gray-500 mt-2">
                                Max: <span className="font-semibold text-blue-600">{item.selectedBatchRemaining} units</span> (from selected batch)
                              </p>
                            )}
                            {formErrors[`item${index}_quantity`] && (
                              <p className="text-red-500 text-xs mt-2 flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {formErrors[`item${index}_quantity`]}
                              </p>
                            )}
                          </div>
                        
                          <div>
                            <label className="block text-sm font-semibold text-gray-800 mb-2.5">Unit Cost</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm font-medium">₱</span>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitCost || 0}
                                disabled
                                className="bg-gray-50 cursor-not-allowed pl-8 text-sm"
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Auto-set from product price</p>
                          </div>
                        
                          <div>
                            <label className="block text-sm font-semibold text-gray-800 mb-2.5">Total Cost</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm font-medium">₱</span>
                              <Input
                                type="number"
                                value={item.totalCost || 0}
                                disabled
                                className="bg-blue-50 border-blue-200 pl-8 text-sm font-semibold text-blue-900"
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Auto-calculated</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {formData.items.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No items added yet. Click "Add Item" to get started.
                  </div>
                )}
              </div>

              {/* Total Transfer Summary */}
              {formData.items.length > 0 && (
                <div className="border-t-2 border-blue-200 pt-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Transfer Summary</h4>
                      <p className="text-xs text-gray-500">Total inventory value being transferred</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-blue-600">
                        ₱{formData.items.reduce((sum, item) => sum + (parseFloat(item.totalCost) || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {formData.items.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0)} items • {formData.items.length} product{formData.items.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {formErrors.general && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-800 text-sm">{formErrors.general}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                    setSelectedTransfer(null);
                    setFormData({
                      fromBranchId: userData?.branchId || '', // Keep current user's branch
                      toBranchId: '',
                      toBranchName: '',
                      toBranchHasSystem: false,
                      transferDate: new Date().toISOString().split('T')[0],
                      expectedDelivery: '',
                      reason: '',
                      notes: '',
                      items: []
                    });
                    setFormErrors({});
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                  {isCreateModalOpen ? 'Create Transfer' : 'Update Transfer'}
                    </>
                  )}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Value Range (₱)</label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    placeholder="Min Value"
                    value={filters.valueRange.min}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      valueRange: { ...prev.valueRange, min: e.target.value }
                    }))}
                  />
                  <Input
                    type="number"
                    placeholder="Max Value"
                    value={filters.valueRange.max}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      valueRange: { ...prev.valueRange, max: e.target.value }
                    }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Item Count Range</label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    placeholder="Min Items"
                    value={filters.itemCountRange.min}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      itemCountRange: { ...prev.itemCountRange, min: e.target.value }
                    }))}
                  />
                  <Input
                    type="number"
                    placeholder="Max Items"
                    value={filters.itemCountRange.max}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      itemCountRange: { ...prev.itemCountRange, max: e.target.value }
                    }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setFilters({
                  status: 'all',
                  fromBranch: 'all',
                  toBranch: 'all',
                  dateRange: { start: '', end: '' },
                  valueRange: { min: '', max: '' },
                  itemCountRange: { min: '', max: '' },
                  transferType: 'all'
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

export default StockTransfer;