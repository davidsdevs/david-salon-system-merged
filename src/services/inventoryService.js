// src/services/inventoryService.js
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  Timestamp,
  writeBatch,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

class InventoryService {
  constructor() {
    this.stocksCollection = 'branch_stocks';
    this.inventoryMovementsCollection = 'inventory_movements';
    this.productBatchesCollection = 'product_batches';
  }

  /**
   * Get all stocks for a specific branch
   */
  async getBranchStocks(branchId, filters = {}) {
    try {
      let q = query(
        collection(db, this.stocksCollection),
        where('branchId', '==', branchId)
      );

      // Apply filters (but don't use orderBy - we'll sort client-side)
      if (filters.status) {
        q = query(q, where('status', '==', filters.status));
      }
      if (filters.category) {
        q = query(q, where('category', '==', filters.category));
      }

      // Fetch data without orderBy to avoid index requirements
      const querySnapshot = await getDocs(q);
      const stocks = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        stocks.push({
          id: doc.id,
          ...data,
          lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate() : 
                     data.lastUpdated instanceof Date ? data.lastUpdated :
                     data.lastUpdated ? new Date(data.lastUpdated) : new Date(),
          lastRestocked: data.lastRestocked?.toDate ? data.lastRestocked.toDate() : 
                        data.lastRestocked instanceof Date ? data.lastRestocked :
                        data.lastRestocked ? new Date(data.lastRestocked) : null,
          expiryDate: data.expiryDate?.toDate ? data.expiryDate.toDate() : 
                     data.expiryDate instanceof Date ? data.expiryDate :
                     data.expiryDate ? new Date(data.expiryDate) : null,
        });
      });

      // Sort client-side to avoid Firestore index requirements
      const sortField = filters.orderBy || 'productName';
      const sortDirection = filters.orderDirection || 'asc';
      
      stocks.sort((a, b) => {
        let aValue = a[sortField];
        let bValue = b[sortField];
        
        // Handle different data types
        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';
        
        // Convert to comparable values
        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }
        
        if (sortDirection === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });

      return { success: true, stocks };
    } catch (error) {
      console.error('Error getting branch stocks:', error);
      return { success: false, message: error.message, stocks: [] };
    }
  }

  /**
   * Get stock by ID
   */
  async getStockById(stockId) {
    try {
      const stockRef = doc(db, this.stocksCollection, stockId);
      const stockSnap = await getDoc(stockRef);
      
      if (stockSnap.exists()) {
        const data = stockSnap.data();
        return {
          success: true,
          stock: {
            id: stockSnap.id,
            ...data,
            lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate() : 
                       data.lastUpdated instanceof Date ? data.lastUpdated :
                       data.lastUpdated ? new Date(data.lastUpdated) : new Date(),
          }
        };
      } else {
        return { success: false, message: 'Stock not found' };
      }
    } catch (error) {
      console.error('Error getting stock:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Add stock to a product
   */
  async addStock(stockData) {
    try {
      const batch = writeBatch(db);

      // Check if stock entry exists for this product in this branch
      const existingStockQuery = query(
        collection(db, this.stocksCollection),
        where('branchId', '==', stockData.branchId),
        where('productId', '==', stockData.productId)
      );
      const existingStockSnap = await getDocs(existingStockQuery);

      let stockRef;
      let newQuantity = Number(stockData.quantity) || 0;
      
      if (existingStockSnap.empty) {
        // Create new stock entry
        stockRef = doc(collection(db, this.stocksCollection));
        const newStock = {
          branchId: String(stockData.branchId),
          productId: String(stockData.productId),
          productName: String(stockData.productName || ''),
          brand: String(stockData.brand || ''),
          category: String(stockData.category || ''),
          currentStock: newQuantity,
          minStock: Number(stockData.minStock) || 0,
          maxStock: Number(stockData.maxStock) || 0,
          unitCost: Number(stockData.unitCost) || 0,
          location: String(stockData.location || ''),
          supplier: String(stockData.supplier || ''),
          status: newQuantity > (stockData.minStock || 0) ? 'In Stock' : 
                 newQuantity > 0 ? 'Low Stock' : 'Out of Stock',
          lastUpdated: serverTimestamp(),
          lastRestocked: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        if (stockData.expiryDate) {
          newStock.expiryDate = Timestamp.fromDate(new Date(stockData.expiryDate));
        }
        
        batch.set(stockRef, newStock);
      } else {
        // Update existing stock
        stockRef = existingStockSnap.docs[0].ref;
        const currentStock = existingStockSnap.docs[0].data().currentStock || 0;
        const updatedStock = currentStock + newQuantity;
        
        batch.update(stockRef, {
          currentStock: updatedStock,
          status: updatedStock > (stockData.minStock || 0) ? 'In Stock' : 
                 updatedStock > 0 ? 'Low Stock' : 'Out of Stock',
          lastUpdated: serverTimestamp(),
          lastRestocked: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // Create inventory movement record
      const movementRef = doc(collection(db, this.inventoryMovementsCollection));
      batch.set(movementRef, {
        branchId: String(stockData.branchId),
        productId: String(stockData.productId),
        productName: String(stockData.productName || ''),
        type: 'stock_in',
        quantity: newQuantity,
        previousStock: existingStockSnap.empty ? 0 : existingStockSnap.docs[0].data().currentStock || 0,
        newStock: existingStockSnap.empty ? newQuantity : (existingStockSnap.docs[0].data().currentStock || 0) + newQuantity,
        reason: String(stockData.reason || 'Stock added'),
        notes: String(stockData.notes || ''),
        createdBy: String(stockData.createdBy || ''),
        createdAt: serverTimestamp()
      });

      await batch.commit();
      return { success: true, message: 'Stock added successfully' };
    } catch (error) {
      console.error('Error adding stock:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Reduce stock (for sales/damage/etc)
   */
  async reduceStock(stockData) {
    try {
      const batch = writeBatch(db);

      // Get current stock
      const stockQuery = query(
        collection(db, this.stocksCollection),
        where('branchId', '==', stockData.branchId),
        where('productId', '==', stockData.productId)
      );
      const stockSnap = await getDocs(stockQuery);

      if (stockSnap.empty) {
        return { success: false, message: 'Stock not found for this product' };
      }

      const stockRef = stockSnap.docs[0].ref;
      const currentStock = stockSnap.docs[0].data().currentStock || 0;
      const reduceQuantity = Number(stockData.quantity) || 0;
      const newStock = Math.max(0, currentStock - reduceQuantity);

      // Update stock
      batch.update(stockRef, {
        currentStock: newStock,
        status: newStock > (stockSnap.docs[0].data().minStock || 0) ? 'In Stock' : 
               newStock > 0 ? 'Low Stock' : 'Out of Stock',
        lastUpdated: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Create inventory movement record
      const movementRef = doc(collection(db, this.inventoryMovementsCollection));
      batch.set(movementRef, {
        branchId: String(stockData.branchId),
        productId: String(stockData.productId),
        productName: String(stockData.productName || ''),
        type: 'stock_out',
        quantity: reduceQuantity,
        previousStock: currentStock,
        newStock: newStock,
        reason: String(stockData.reason || 'Stock reduced'),
        notes: String(stockData.notes || ''),
        createdBy: String(stockData.createdBy || ''),
        createdAt: serverTimestamp()
      });

      await batch.commit();
      return { success: true, message: 'Stock reduced successfully' };
    } catch (error) {
      console.error('Error reducing stock:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Update stock details
   */
  async updateStock(stockId, updateData) {
    try {
      const stockRef = doc(db, this.stocksCollection, stockId);
      const stockSnap = await getDoc(stockRef);

      if (!stockSnap.exists()) {
        return { success: false, message: 'Stock not found' };
      }

      const updateFields = {
        updatedAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      };

      // Only update provided fields
      if (updateData.minStock !== undefined) updateFields.minStock = Number(updateData.minStock);
      if (updateData.maxStock !== undefined) updateFields.maxStock = Number(updateData.maxStock);
      if (updateData.unitCost !== undefined) updateFields.unitCost = Number(updateData.unitCost);
      if (updateData.location !== undefined) updateFields.location = String(updateData.location);
      if (updateData.supplier !== undefined) updateFields.supplier = String(updateData.supplier);
      if (updateData.expiryDate !== undefined) {
        updateFields.expiryDate = Timestamp.fromDate(new Date(updateData.expiryDate));
      }

      // Recalculate status if currentStock or minStock changed
      if (updateData.currentStock !== undefined || updateData.minStock !== undefined) {
        const currentStock = updateData.currentStock !== undefined 
          ? Number(updateData.currentStock)
          : stockSnap.data().currentStock;
        const minStock = updateData.minStock !== undefined 
          ? Number(updateData.minStock)
          : stockSnap.data().minStock || 0;
        
        updateFields.currentStock = currentStock;
        updateFields.status = currentStock > minStock ? 'In Stock' : 
                             currentStock > 0 ? 'Low Stock' : 'Out of Stock';
      }

      await updateDoc(stockRef, updateFields);
      return { success: true, message: 'Stock updated successfully' };
    } catch (error) {
      console.error('Error updating stock:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get inventory movements/history for a branch
   */
  async getInventoryMovements(branchId, filters = {}) {
    try {
      let q = query(
        collection(db, this.inventoryMovementsCollection),
        where('branchId', '==', branchId)
      );

      if (filters.type) {
        q = query(q, where('type', '==', filters.type));
      }
      if (filters.productId) {
        q = query(q, where('productId', '==', filters.productId));
      }

      // Don't use orderBy - we'll sort client-side
      if (filters.limit) {
        q = query(q, limit(filters.limit));
      }

      const querySnapshot = await getDocs(q);
      const movements = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        movements.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : 
                     data.createdAt instanceof Date ? data.createdAt :
                     data.createdAt ? new Date(data.createdAt) : new Date(),
        });
      });

      // Sort client-side by createdAt descending
      movements.sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return bTime - aTime; // Descending order
      });

      return { success: true, movements };
    } catch (error) {
      console.error('Error getting inventory movements:', error);
      return { success: false, message: error.message, movements: [] };
    }
  }

  /**
   * Get inventory statistics for a branch
   */
  async getInventoryStats(branchId) {
    try {
      const stocksResult = await this.getBranchStocks(branchId);
      if (!stocksResult.success) {
        return { success: false, message: stocksResult.message };
      }

      const stocks = stocksResult.stocks;
      const totalProducts = stocks.length;
      const totalValue = stocks.reduce((sum, stock) => {
        return sum + ((stock.currentStock || 0) * (stock.unitCost || 0));
      }, 0);
      const inStockCount = stocks.filter(s => s.status === 'In Stock').length;
      const lowStockCount = stocks.filter(s => s.status === 'Low Stock').length;
      const outOfStockCount = stocks.filter(s => s.status === 'Out of Stock').length;

      return {
        success: true,
        stats: {
          totalProducts,
          totalValue,
          inStockCount,
          lowStockCount,
          outOfStockCount
        }
      };
    } catch (error) {
      console.error('Error getting inventory stats:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get sales data related to inventory (from transactions)
   */
  async getInventorySales(branchId, startDate, endDate) {
    try {
      // Get transactions for the branch
      // Note: Filtering by date range client-side to avoid complex Firestore index requirements
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('branchId', '==', branchId),
        where('status', '==', 'completed')
      );

      const transactionsSnap = await getDocs(transactionsQuery);
      const salesData = {};
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999); // End of day
      
      transactionsSnap.forEach((doc) => {
        const transaction = doc.data();
        // Get transaction date (could be date, createdAt, or timestamp)
        let transactionDate = null;
        if (transaction.date) {
          transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
        } else if (transaction.createdAt) {
          transactionDate = transaction.createdAt?.toDate ? transaction.createdAt.toDate() : new Date(transaction.createdAt);
        } else if (transaction.timestamp) {
          transactionDate = transaction.timestamp?.toDate ? transaction.timestamp.toDate() : new Date(transaction.timestamp);
        }
        
        // Filter by date range
        if (transactionDate && transactionDate >= startDateObj && transactionDate <= endDateObj) {
          if (transaction.items && Array.isArray(transaction.items)) {
            transaction.items.forEach(item => {
              if (item.type === 'product' && item.productId) {
                const productId = item.productId;
                if (!salesData[productId]) {
                  salesData[productId] = {
                    productId,
                    productName: item.name || 'Unknown Product',
                    quantitySold: 0,
                    totalRevenue: 0,
                    transactions: 0
                  };
                }
                salesData[productId].quantitySold += Number(item.quantity || 0);
                salesData[productId].totalRevenue += Number(item.total || 0);
                salesData[productId].transactions += 1;
              }
            });
          }
        }
      });

      // Merge with stock data for complete picture
      const stocksResult = await this.getBranchStocks(branchId);
      if (stocksResult.success) {
        Object.keys(salesData).forEach(productId => {
          const stock = stocksResult.stocks.find(s => s.productId === productId);
          if (stock) {
            salesData[productId].currentStock = stock.currentStock;
            salesData[productId].unitCost = stock.unitCost;
            salesData[productId].totalCost = (stock.currentStock || 0) * (stock.unitCost || 0);
            salesData[productId].profit = salesData[productId].totalRevenue - 
                                        ((salesData[productId].quantitySold || 0) * (stock.unitCost || 0));
          }
        });
      }

      return { success: true, salesData: Object.values(salesData) };
    } catch (error) {
      console.error('Error getting inventory sales:', error);
      return { success: false, message: error.message, salesData: [] };
    }
  }

  /**
   * Create product batches from purchase order delivery
   * @param {Object} deliveryData - Delivery data containing purchase order items
   */
  async createProductBatches(deliveryData) {
    try {
      const batch = writeBatch(db);
      const batches = [];
      const batchStocks = [];

      // deliveryData should contain:
      // - purchaseOrderId
      // - branchId
      // - items: [{ productId, productName, quantity, unitPrice, expirationDate }]
      // - receivedBy, receivedAt

      if (!deliveryData.items || !Array.isArray(deliveryData.items)) {
        return { success: false, message: 'Invalid delivery data: items array required' };
      }

      for (const item of deliveryData.items) {
        if (!item.productId || !item.quantity || item.quantity <= 0) {
          continue; // Skip invalid items
        }

        // Generate batch number: PO-YYYY-XXXX-BATCH-XX
        const batchNumber = `${deliveryData.purchaseOrderId || 'PO'}-BATCH-${String(batches.length + 1).padStart(3, '0')}`;
        
        const batchRef = doc(collection(db, this.productBatchesCollection));
        const expirationDate = item.expirationDate ? Timestamp.fromDate(new Date(item.expirationDate)) : null;
        const receivedDate = deliveryData.receivedAt ? Timestamp.fromDate(new Date(deliveryData.receivedAt)) : serverTimestamp();

        const batchData = {
          batchNumber: batchNumber,
          productId: String(item.productId),
          productName: String(item.productName || ''),
          branchId: String(deliveryData.branchId),
          purchaseOrderId: String(deliveryData.purchaseOrderId || ''),
          quantity: Number(item.quantity),
          remainingQuantity: Number(item.quantity), // Track remaining stock in this batch
          unitCost: Number(item.unitPrice || 0),
          expirationDate: expirationDate,
          receivedDate: receivedDate,
          receivedBy: String(deliveryData.receivedBy || ''),
          usageType: String(item.usageType || 'otc'), // Copy usage type from PO item: 'otc' or 'salon-use'
          status: 'active', // active, expired, depleted
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        batch.set(batchRef, batchData);
        batches.push({ id: batchRef.id, ...batchData });

        // Create batch_stock entry in stocks collection for FIFO tracking
        // This allows weekly REALCOUNTSTOCK tracking per batch
        const batchStockRef = doc(collection(db, 'stocks'));
        const batchQuantity = Number(item.quantity);
        const currentDate = new Date();
        const startPeriod = Timestamp.fromDate(currentDate);
        
        // Calculate end period (4 weeks from now for monthly tracking)
        const endPeriodDate = new Date(currentDate);
        endPeriodDate.setDate(endPeriodDate.getDate() + 28); // 4 weeks
        const endPeriod = Timestamp.fromDate(endPeriodDate);

        const batchStockData = {
          batchId: batchRef.id, // Reference to the product_batch
          batchNumber: batchNumber, // For easy reference
          productId: String(item.productId),
          productName: String(item.productName || ''),
          branchId: String(deliveryData.branchId),
          purchaseOrderId: String(deliveryData.purchaseOrderId || ''),
          beginningStock: batchQuantity, // Initial quantity from this batch
          startPeriod: startPeriod,
          weekTrackingMode: 'manual', // Manual recording of weekly counts
          weekOneStock: 0, // Will be recorded weekly
          weekTwoStock: 0,
          weekThreeStock: 0,
          weekFourStock: 0,
          endPeriod: endPeriod,
          endStockMode: 'auto', // Always automatic
          endStock: 0, // Will be calculated
          realTimeStock: batchQuantity, // Starts equal to beginningStock, will be updated as stock is used
          expirationDate: expirationDate, // Link to batch expiration
          receivedDate: receivedDate, // When batch was received
          receivedBy: String(deliveryData.receivedBy || ''),
          receivedByName: String(deliveryData.receivedByName || ''),
          usageType: String(item.usageType || 'otc'), // Copy usage type from PO item: 'otc' or 'salon-use'
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: String(deliveryData.receivedBy || ''),
          status: 'active',
          stockType: 'batch' // Indicates this is a batch_stock entry
        };

        batch.set(batchStockRef, batchStockData);
        batchStocks.push({ id: batchStockRef.id, batchId: batchRef.id, ...batchStockData });
      }

      await batch.commit();
      return { 
        success: true, 
        batches, 
        batchStocks,
        message: `Created ${batches.length} product batches and ${batchStocks.length} batch stock entries` 
      };
    } catch (error) {
      console.error('Error creating product batches:', error);
      return { success: false, message: error.message, batches: [], batchStocks: [] };
    }
  }

  /**
   * Get all batches for a product in a branch
   */
  async getProductBatches(branchId, productId, filters = {}) {
    try {
      let q = query(
        collection(db, this.productBatchesCollection),
        where('branchId', '==', branchId),
        where('productId', '==', productId)
      );

      if (filters.status) {
        q = query(q, where('status', '==', filters.status));
      }

      const querySnapshot = await getDocs(q);
      const batches = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        batches.push({
          id: doc.id,
          ...data,
          expirationDate: data.expirationDate?.toDate ? data.expirationDate.toDate() : 
                         data.expirationDate instanceof Date ? data.expirationDate :
                         data.expirationDate ? new Date(data.expirationDate) : null,
          receivedDate: data.receivedDate?.toDate ? data.receivedDate.toDate() : 
                       data.receivedDate instanceof Date ? data.receivedDate :
                       data.receivedDate ? new Date(data.receivedDate) : new Date(),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : 
                    data.createdAt instanceof Date ? data.createdAt :
                    data.createdAt ? new Date(data.createdAt) : new Date(),
        });
      });

      // Sort by expiration date (FIFO - oldest first) and received date
      batches.sort((a, b) => {
        // First sort by expiration date (if available)
        if (a.expirationDate && b.expirationDate) {
          return a.expirationDate.getTime() - b.expirationDate.getTime();
        }
        if (a.expirationDate) return -1;
        if (b.expirationDate) return 1;
        // Then by received date (oldest first)
        return a.receivedDate.getTime() - b.receivedDate.getTime();
      });

      return { success: true, batches };
    } catch (error) {
      console.error('Error getting product batches:', error);
      return { success: false, message: error.message, batches: [] };
    }
  }

  /**
   * Get all batches for a branch (across all products)
   */
  async getBranchBatches(branchId, filters = {}) {
    try {
      let q = query(
        collection(db, this.productBatchesCollection),
        where('branchId', '==', branchId)
      );

      if (filters.status) {
        q = query(q, where('status', '==', filters.status));
      }
      if (filters.productId) {
        q = query(q, where('productId', '==', filters.productId));
      }

      const querySnapshot = await getDocs(q);
      const batches = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        batches.push({
          id: doc.id,
          ...data,
          expirationDate: data.expirationDate?.toDate ? data.expirationDate.toDate() : 
                         data.expirationDate instanceof Date ? data.expirationDate :
                         data.expirationDate ? new Date(data.expirationDate) : null,
          receivedDate: data.receivedDate?.toDate ? data.receivedDate.toDate() : 
                       data.receivedDate instanceof Date ? data.receivedDate :
                       data.receivedDate ? new Date(data.receivedDate) : new Date(),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : 
                    data.createdAt instanceof Date ? data.createdAt :
                    data.createdAt ? new Date(data.createdAt) : new Date(),
        });
      });

      // Sort by expiration date (oldest first)
      batches.sort((a, b) => {
        if (a.expirationDate && b.expirationDate) {
          return a.expirationDate.getTime() - b.expirationDate.getTime();
        }
        if (a.expirationDate) return -1;
        if (b.expirationDate) return 1;
        return a.receivedDate.getTime() - b.receivedDate.getTime();
      });

      return { success: true, batches };
    } catch (error) {
      console.error('Error getting branch batches:', error);
      return { success: false, message: error.message, batches: [] };
    }
  }

  /**
   * Get batches for sale (FIFO selection without deduction)
   * Returns which batches should be used for a sale/transaction
   * @param {Object} saleData - { branchId, productId, quantity, saleType? }
   * @param {string} saleData.saleType - 'otc' (default) or 'salon-use' - filters batches by usage type
   * @returns {Object} - { success, batches: [{ batchId, batchNumber, quantity, expirationDate, ... }] }
   */
  async getBatchesForSale(saleData) {
    try {
      const { branchId, productId, quantity, saleType = 'otc' } = saleData;
      let remainingNeeded = Number(quantity);

      // Get all active batches for this product, sorted by expiration date (FIFO)
      const batchesResult = await this.getProductBatches(branchId, productId, { status: 'active' });
      if (!batchesResult.success || batchesResult.batches.length === 0) {
        return { success: false, message: 'No active batches found for this product', batches: [] };
      }

      // Filter batches by usage type
      const filteredBatches = batchesResult.batches.filter(batch => {
        const batchUsageType = batch.usageType || 'otc'; // Default to 'otc' for backward compatibility
        return batchUsageType === saleType;
      });

      if (filteredBatches.length === 0) {
        const typeLabel = saleType === 'otc' ? 'OTC' : 'salon-use';
        return { 
          success: false, 
          message: `No ${typeLabel} batches available for this product`,
          batches: [],
          availableQuantity: 0
        };
      }

      const batchesForSale = [];
      let totalAvailable = 0;

      // Select batches in FIFO order
      for (const batchRecord of filteredBatches) {
        if (remainingNeeded <= 0) break;

        const availableInBatch = batchRecord.remainingQuantity || 0;
        if (availableInBatch <= 0) continue;

        totalAvailable += availableInBatch;
        const quantityFromBatch = Math.min(remainingNeeded, availableInBatch);
        remainingNeeded -= quantityFromBatch;

        batchesForSale.push({
          batchId: batchRecord.id,
          batchNumber: batchRecord.batchNumber,
          quantity: quantityFromBatch,
          expirationDate: batchRecord.expirationDate,
          unitCost: batchRecord.unitCost,
          remainingQuantity: availableInBatch, // Current remaining before sale
          usageType: batchRecord.usageType || 'otc'
        });
      }

      if (remainingNeeded > 0) {
        return { 
          success: false, 
          message: `Insufficient ${saleType === 'otc' ? 'OTC' : 'salon-use'} stock. Only ${quantity - remainingNeeded} units available.`,
          batches: batchesForSale,
          availableQuantity: totalAvailable
        };
      }

      return { 
        success: true, 
        batches: batchesForSale,
        availableQuantity: totalAvailable,
        message: `Found ${batchesForSale.length} batch(es) for ${saleType === 'otc' ? 'OTC' : 'salon-use'} sale`
      };
    } catch (error) {
      console.error('Error getting batches for sale:', error);
      return { success: false, message: error.message, batches: [] };
    }
  }

  /**
   * Get batches for transfer (FIFO selection without deduction)
   * Returns which batches should be used for a transfer
   * @param {Object} transferData - { branchId, productId, quantity }
   * @returns {Object} - { success, batches: [{ batchId, batchNumber, quantity, expirationDate, ... }] }
   */
  async getBatchesForTransfer(transferData) {
    try {
      const { branchId, productId, quantity } = transferData;
      let remainingNeeded = Number(quantity);

      // Get all active batches for this product, sorted by expiration date (FIFO)
      const batchesResult = await this.getProductBatches(branchId, productId, { status: 'active' });
      if (!batchesResult.success || batchesResult.batches.length === 0) {
        return { success: false, message: 'No active batches found for this product', batches: [] };
      }

      const batchesForTransfer = [];

      // Select batches in FIFO order
      for (const batchRecord of batchesResult.batches) {
        if (remainingNeeded <= 0) break;

        const availableInBatch = batchRecord.remainingQuantity || 0;
        if (availableInBatch <= 0) continue;

        const quantityFromBatch = Math.min(remainingNeeded, availableInBatch);
        remainingNeeded -= quantityFromBatch;

        batchesForTransfer.push({
          batchId: batchRecord.id,
          batchNumber: batchRecord.batchNumber,
          quantity: quantityFromBatch,
          expirationDate: batchRecord.expirationDate,
          unitCost: batchRecord.unitCost,
          remainingQuantity: availableInBatch // Current remaining before transfer
        });
      }

      if (remainingNeeded > 0) {
        return { 
          success: false, 
          message: `Insufficient stock. Only ${quantity - remainingNeeded} units available.`,
          batches: batchesForTransfer
        };
      }

      return { 
        success: true, 
        batches: batchesForTransfer,
        message: `Found ${batchesForTransfer.length} batch(es) for transfer`
      };
    } catch (error) {
      console.error('Error getting batches for transfer:', error);
      return { success: false, message: error.message, batches: [] };
    }
  }

  /**
   * Deduct stock using FIFO (First In First Out) - oldest batches first
   * @param {Object} deductionData - { branchId, productId, quantity, reason, notes, createdBy, batches?, usageType? }
   * @param {Array} deductionData.batches - Optional: Pre-determined batches to use (from transaction/transfer)
   * @param {string} deductionData.usageType - Optional: 'otc' or 'salon-use' - filters batches by usage type
   */
  async deductStockFIFO(deductionData) {
    try {
      const { branchId, productId, quantity, batches: providedBatches, usageType, reason } = deductionData;
      let remainingToDeduct = Number(quantity);

      const batch = writeBatch(db);
      const updatedBatches = [];
      let batchesToUse = [];

      // Determine usage type based on reason if not explicitly provided
      let requiredUsageType = usageType;
      if (!requiredUsageType && reason) {
        // If reason indicates service use, require salon-use batches
        if (reason.toLowerCase().includes('service') || reason.toLowerCase().includes('salon')) {
          requiredUsageType = 'salon-use';
        }
      }

      // If batches are provided (from transaction/transfer), use those
      // Otherwise, get all active batches for this product, sorted by expiration date (FIFO)
      if (providedBatches && providedBatches.length > 0) {
        // Use provided batches - need to get full batch records from product_batches
        const batchIds = providedBatches.map(b => b.batchId || b.id).filter(Boolean);
        if (batchIds.length > 0) {
          const batchPromises = batchIds.map(batchId => 
            getDoc(doc(db, this.productBatchesCollection, batchId))
          );
          const batchDocs = await Promise.all(batchPromises);
          batchesToUse = batchDocs
            .filter(doc => doc.exists())
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              expirationDate: doc.data().expirationDate?.toDate ? doc.data().expirationDate.toDate() : 
                             doc.data().expirationDate instanceof Date ? doc.data().expirationDate :
                             doc.data().expirationDate ? new Date(doc.data().expirationDate) : null,
              receivedDate: doc.data().receivedDate?.toDate ? doc.data().receivedDate.toDate() : 
                           doc.data().receivedDate instanceof Date ? doc.data().receivedDate :
                           doc.data().receivedDate ? new Date(doc.data().receivedDate) : new Date(),
            }))
            .sort((a, b) => {
              // Sort by expiration date (FIFO)
              if (a.expirationDate && b.expirationDate) {
                return a.expirationDate.getTime() - b.expirationDate.getTime();
              }
              if (a.expirationDate) return -1;
              if (b.expirationDate) return 1;
              // Then by received date
              return a.receivedDate.getTime() - b.receivedDate.getTime();
            });
        }
      } else {
        // Get all active batches for this product, sorted by expiration date (FIFO)
        const batchesResult = await this.getProductBatches(branchId, productId, { status: 'active' });
        if (!batchesResult.success || batchesResult.batches.length === 0) {
          return { success: false, message: 'No active batches found for this product' };
        }
        batchesToUse = batchesResult.batches;
      }

      // Filter batches by usage type if specified
      if (requiredUsageType) {
        batchesToUse = batchesToUse.filter(batch => {
          const batchUsageType = batch.usageType || 'otc'; // Default to 'otc' for backward compatibility
          return batchUsageType === requiredUsageType;
        });

        if (batchesToUse.length === 0) {
          const typeLabel = requiredUsageType === 'otc' ? 'OTC' : 'salon-use';
          return { 
            success: false, 
            message: `No ${typeLabel} batches available for this product. Required for: ${reason || 'deduction'}` 
          };
        }
      }

      if (batchesToUse.length === 0) {
        return { success: false, message: 'No batches available for deduction' };
      }

      // Deduct from batches in FIFO order
      for (const batchRecord of batchesToUse) {
        if (remainingToDeduct <= 0) break;

        const availableInBatch = batchRecord.remainingQuantity || 0;
        if (availableInBatch <= 0) continue;

        const deductFromBatch = Math.min(remainingToDeduct, availableInBatch);
        const newRemaining = availableInBatch - deductFromBatch;
        remainingToDeduct -= deductFromBatch;

        // Update product_batch (batch definition)
        const batchRef = doc(db, this.productBatchesCollection, batchRecord.id);
        const updateData = {
          remainingQuantity: newRemaining,
          status: newRemaining <= 0 ? 'depleted' : 'active',
          updatedAt: serverTimestamp()
        };
        batch.update(batchRef, updateData);

        // CRITICAL: Also update the batch_stock in stocks collection
        // Find the batch_stock document by batchId
        // Note: We query without stockType filter first to avoid index issues, then filter client-side
        const batchStockQuery = query(
          collection(db, 'stocks'),
          where('batchId', '==', batchRecord.id),
          where('branchId', '==', branchId)
        );
        const batchStockSnap = await getDocs(batchStockQuery);
        
        // Filter client-side for stockType and status
        const batchStockDoc = batchStockSnap.docs.find(doc => {
          const data = doc.data();
          return (data.stockType === 'batch' || data.batchId) && (data.status === 'active' || !data.status);
        });
        
        if (batchStockDoc) {
          const batchStockRef = batchStockDoc.ref;
          const batchStockData = batchStockDoc.data();
          const currentRealTimeStock = Number(batchStockData.realTimeStock) || 0;
          const newRealTimeStock = Math.max(0, currentRealTimeStock - deductFromBatch);
          
          console.log(`📦 Updating batch_stock: ${batchRecord.batchNumber}`, {
            batchId: batchRecord.id,
            stockId: batchStockDoc.id,
            currentRealTimeStock,
            deducting: deductFromBatch,
            newRealTimeStock
          });
          
          batch.update(batchStockRef, {
            realTimeStock: newRealTimeStock,
            updatedAt: serverTimestamp()
          });
        } else {
          console.warn(`⚠️ Batch stock not found for batchId: ${batchRecord.id}, batchNumber: ${batchRecord.batchNumber}`);
        }

        updatedBatches.push({
          batchId: batchRecord.id,
          batchNumber: batchRecord.batchNumber,
          deducted: deductFromBatch,
          remaining: newRemaining
        });
      }

      if (remainingToDeduct > 0) {
        return { success: false, message: `Insufficient stock. Only ${quantity - remainingToDeduct} units available.` };
      }

      // Update main stock record
      const stockQuery = query(
        collection(db, this.stocksCollection),
        where('branchId', '==', branchId),
        where('productId', '==', productId)
      );
      const stockSnap = await getDocs(stockQuery);

      if (!stockSnap.empty) {
        const stockRef = stockSnap.docs[0].ref;
        const currentStock = stockSnap.docs[0].data().currentStock || 0;
        const newStock = Math.max(0, currentStock - quantity);

        batch.update(stockRef, {
          currentStock: newStock,
          status: newStock > (stockSnap.docs[0].data().minStock || 0) ? 'In Stock' : 
                 newStock > 0 ? 'Low Stock' : 'Out of Stock',
          lastUpdated: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // Create inventory movement record
      const movementRef = doc(collection(db, this.inventoryMovementsCollection));
      batch.set(movementRef, {
        branchId: String(branchId),
        productId: String(productId),
        productName: String(deductionData.productName || ''),
        type: 'stock_out',
        quantity: quantity,
        reason: String(deductionData.reason || 'Stock reduced'),
        notes: String(deductionData.notes || ''),
        createdBy: String(deductionData.createdBy || ''),
        batchDeductions: updatedBatches, // Track which batches were used
        createdAt: serverTimestamp()
      });

      await batch.commit();
      return { 
        success: true, 
        message: 'Stock deducted successfully using FIFO',
        batchesUsed: updatedBatches
      };
    } catch (error) {
      console.error('Error deducting stock FIFO:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Check and update batch expiration status
   */
  async updateBatchExpirationStatus(branchId) {
    try {
      const batchesResult = await this.getBranchBatches(branchId, { status: 'active' });
      if (!batchesResult.success) {
        return { success: false, message: batchesResult.message };
      }

      const batch = writeBatch(db);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let updatedCount = 0;

      for (const batchRecord of batchesResult.batches) {
        if (!batchRecord.expirationDate) continue;

        const expirationDate = batchRecord.expirationDate instanceof Date 
          ? batchRecord.expirationDate 
          : new Date(batchRecord.expirationDate);
        expirationDate.setHours(0, 0, 0, 0);

        // Mark as expired if expiration date has passed
        if (expirationDate < today && batchRecord.status === 'active') {
          const batchRef = doc(db, this.productBatchesCollection, batchRecord.id);
          batch.update(batchRef, {
            status: 'expired',
            updatedAt: serverTimestamp()
          });
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        await batch.commit();
      }

      return { success: true, updatedCount, message: `Updated ${updatedCount} batches to expired status` };
    } catch (error) {
      console.error('Error updating batch expiration status:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get expiring batches (within specified days)
   */
  async getExpiringBatches(branchId, daysAhead = 30) {
    try {
      const batchesResult = await this.getBranchBatches(branchId, { status: 'active' });
      if (!batchesResult.success) {
        return { success: false, message: batchesResult.message, batches: [] };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const alertDate = new Date(today);
      alertDate.setDate(alertDate.getDate() + daysAhead);

      const expiringBatches = batchesResult.batches.filter(batch => {
        if (!batch.expirationDate || batch.remainingQuantity <= 0) return false;
        
        const expirationDate = batch.expirationDate instanceof Date 
          ? batch.expirationDate 
          : new Date(batch.expirationDate);
        expirationDate.setHours(0, 0, 0, 0);

        return expirationDate >= today && expirationDate <= alertDate;
      });

      // Sort by expiration date (soonest first)
      expiringBatches.sort((a, b) => {
        const aDate = a.expirationDate instanceof Date ? a.expirationDate : new Date(a.expirationDate);
        const bDate = b.expirationDate instanceof Date ? b.expirationDate : new Date(b.expirationDate);
        return aDate.getTime() - bDate.getTime();
      });

      return { success: true, batches: expiringBatches };
    } catch (error) {
      console.error('Error getting expiring batches:', error);
      return { success: false, message: error.message, batches: [] };
    }
  }

  /**
   * Get expired batches
   */
  async getExpiredBatches(branchId) {
    try {
      const batchesResult = await this.getBranchBatches(branchId, { status: 'expired' });
      if (!batchesResult.success) {
        return { success: false, message: batchesResult.message, batches: [] };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Also check active batches that have expired
      const activeBatchesResult = await this.getBranchBatches(branchId, { status: 'active' });
      if (activeBatchesResult.success) {
        activeBatchesResult.batches.forEach(batch => {
          if (batch.expirationDate) {
            const expirationDate = batch.expirationDate instanceof Date 
              ? batch.expirationDate 
              : new Date(batch.expirationDate);
            expirationDate.setHours(0, 0, 0, 0);
            
            if (expirationDate < today && batch.remainingQuantity > 0) {
              batchesResult.batches.push(batch);
            }
          }
        });
      }

      return { success: true, batches: batchesResult.batches };
    } catch (error) {
      console.error('Error getting expired batches:', error);
      return { success: false, message: error.message, batches: [] };
    }
  }

  /**
   * Create transfer batches when receiving stock from another branch
   * @param {Object} transferData - { transferId, toBranchId, items: [{ productId, productName, quantity, batches: [...] }], receivedBy, receivedAt }
   */
  async createTransferBatches(transferData) {
    try {
      const batch = writeBatch(db);
      const createdBatches = [];
      let batchSequence = 1;

      if (!transferData.items || !Array.isArray(transferData.items)) {
        return { success: false, message: 'Invalid transfer data: items array required' };
      }

      for (const item of transferData.items) {
        if (!item.productId || !item.quantity || item.quantity <= 0) {
          continue;
        }

        // If item has batch information from transfer, use it
        if (item.batches && Array.isArray(item.batches) && item.batches.length > 0) {
          // Create a batch for each source batch
          for (const sourceBatch of item.batches) {
            const batchNumber = `${transferData.transferId || 'TR'}-BATCH-${String(batchSequence).padStart(3, '0')}`;
            const batchRef = doc(collection(db, this.productBatchesCollection));
            
            const expirationDate = sourceBatch.expirationDate 
              ? (sourceBatch.expirationDate instanceof Date 
                  ? Timestamp.fromDate(sourceBatch.expirationDate)
                  : Timestamp.fromDate(new Date(sourceBatch.expirationDate)))
              : null;
            
            const receivedDate = transferData.receivedAt 
              ? Timestamp.fromDate(new Date(transferData.receivedAt)) 
              : serverTimestamp();

            const batchData = {
              batchNumber: batchNumber,
              productId: String(item.productId),
              productName: String(item.productName || ''),
              branchId: String(transferData.toBranchId),
              sourceType: 'transfer',
              sourceTransferId: String(transferData.transferId || ''),
              originalBatchId: String(sourceBatch.batchId || ''),
              originalBatchNumber: String(sourceBatch.batchNumber || ''),
              quantity: Number(sourceBatch.quantity),
              remainingQuantity: Number(sourceBatch.quantity),
              unitCost: Number(sourceBatch.unitCost || item.unitCost || 0),
              expirationDate: expirationDate,
              receivedDate: receivedDate,
              receivedBy: String(transferData.receivedBy || ''),
              fromBranchId: String(transferData.fromBranchId || ''),
              status: 'active',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };

            batch.set(batchRef, batchData);
            createdBatches.push({ id: batchRef.id, ...batchData });
            batchSequence++;
          }
        } else {
          // Fallback: Create single batch if no batch info provided (backward compatibility)
          const batchNumber = `${transferData.transferId || 'TR'}-BATCH-${String(batchSequence).padStart(3, '0')}`;
          const batchRef = doc(collection(db, this.productBatchesCollection));
          const receivedDate = transferData.receivedAt 
            ? Timestamp.fromDate(new Date(transferData.receivedAt)) 
            : serverTimestamp();

          const batchData = {
            batchNumber: batchNumber,
            productId: String(item.productId),
            productName: String(item.productName || ''),
            branchId: String(transferData.toBranchId),
            sourceType: 'transfer',
            sourceTransferId: String(transferData.transferId || ''),
            quantity: Number(item.quantity),
            remainingQuantity: Number(item.quantity),
            unitCost: Number(item.unitCost || 0),
            expirationDate: null, // Unknown expiration if no batch info
            receivedDate: receivedDate,
            receivedBy: String(transferData.receivedBy || ''),
            fromBranchId: String(transferData.fromBranchId || ''),
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };

          batch.set(batchRef, batchData);
          createdBatches.push({ id: batchRef.id, ...batchData });
          batchSequence++;
        }
      }

      await batch.commit();
      return { success: true, batches: createdBatches, message: `Created ${createdBatches.length} transfer batch(es)` };
    } catch (error) {
      console.error('Error creating transfer batches:', error);
      return { success: false, message: error.message, batches: [] };
    }
  }

  /**
   * Return stock to original batch (for returned transfers)
   * Handles three scenarios:
   * 1. Original batch exists → Restore to original batch
   * 2. Original batch was sold/depleted → Create return batch at original branch
   * 3. New products returned (different from transferred) → Create new batch at original branch
   * 
   * @param {Object} returnData - { batchId, quantity, returnReason, returnedBy, returnedAt, isNewProduct?, newProductData? }
   */
  async returnStockToBatch(returnData) {
    try {
      const { batchId, quantity } = returnData;
      
      // Get the transfer batch
      const batchRef = doc(db, this.productBatchesCollection, batchId);
      const batchDoc = await getDoc(batchRef);
      
      if (!batchDoc.exists()) {
        return { success: false, message: 'Transfer batch not found' };
      }

      const transferBatch = batchDoc.data();
      
      // Check if this is a transfer batch
      if (transferBatch.sourceType !== 'transfer' || !transferBatch.originalBatchId) {
        return { success: false, message: 'This batch is not a transfer batch or has no original batch reference' };
      }

      // Check if there's enough quantity to return
      if (transferBatch.remainingQuantity < quantity) {
        return { success: false, message: `Insufficient quantity. Only ${transferBatch.remainingQuantity} units available to return.` };
      }

      const batch = writeBatch(db);
      const { isNewProduct = false, newProductData = null } = returnData;
      let originalBatchDoc = null; // Track if original batch exists
      
      // SCENARIO 3: New products returned (different from what was transferred)
      if (isNewProduct && newProductData) {
        // Create a new batch at the original branch with the new product data
        const newBatchNumber = `RET-NEW-${transferBatch.originalBatchNumber || 'BATCH'}-${Date.now()}`;
        const newBatchRef = doc(collection(db, this.productBatchesCollection));
        
        batch.set(newBatchRef, {
          batchNumber: newBatchNumber,
          productId: newProductData.productId || transferBatch.productId,
          productName: newProductData.productName || transferBatch.productName,
          branchId: transferBatch.fromBranchId, // Return to original branch
          sourceType: 'return_new',
          sourceTransferId: transferBatch.sourceTransferId,
          originalBatchId: transferBatch.originalBatchId,
          originalBatchNumber: transferBatch.originalBatchNumber,
          quantity: quantity,
          remainingQuantity: quantity,
          unitCost: newProductData.unitCost || transferBatch.unitCost,
          expirationDate: newProductData.expirationDate || transferBatch.expirationDate,
          receivedDate: returnData.returnedAt 
            ? Timestamp.fromDate(new Date(returnData.returnedAt)) 
            : serverTimestamp(),
          receivedBy: String(returnData.returnedBy || ''),
          fromBranchId: transferBatch.branchId, // Branch returning the stock
          returnReason: String(returnData.returnReason || 'New product returned (original was sold)'),
          notes: `Original transferred products were sold. New products returned instead.`,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else {
        // SCENARIO 1 & 2: Try to restore to original batch
        const originalBatchRef = doc(db, this.productBatchesCollection, transferBatch.originalBatchId);
        originalBatchDoc = await getDoc(originalBatchRef);
        
        if (originalBatchDoc.exists()) {
          // SCENARIO 1: Original batch exists - restore quantity
          const originalBatch = originalBatchDoc.data();
          const newRemaining = (originalBatch.remainingQuantity || 0) + quantity;
          
          batch.update(originalBatchRef, {
            remainingQuantity: newRemaining,
            status: newRemaining > 0 ? 'active' : originalBatch.status,
            updatedAt: serverTimestamp()
          });
        } else {
          // SCENARIO 2: Original batch was sold/depleted - create return batch
          const returnBatchNumber = `RET-${transferBatch.originalBatchNumber || 'BATCH'}-${Date.now()}`;
          const returnBatchRef = doc(collection(db, this.productBatchesCollection));
          
          batch.set(returnBatchRef, {
            batchNumber: returnBatchNumber,
            productId: transferBatch.productId,
            productName: transferBatch.productName,
            branchId: transferBatch.fromBranchId, // Return to original branch
            sourceType: 'return',
            sourceTransferId: transferBatch.sourceTransferId,
            originalBatchId: transferBatch.originalBatchId,
            originalBatchNumber: transferBatch.originalBatchNumber,
            quantity: quantity,
            remainingQuantity: quantity,
            unitCost: transferBatch.unitCost,
            expirationDate: transferBatch.expirationDate,
            receivedDate: returnData.returnedAt 
              ? Timestamp.fromDate(new Date(returnData.returnedAt)) 
              : serverTimestamp(),
            receivedBy: String(returnData.returnedBy || ''),
            fromBranchId: transferBatch.branchId, // Branch returning the stock
            returnReason: String(returnData.returnReason || 'Original batch was sold/depleted'),
            notes: `Original batch ${transferBatch.originalBatchNumber} was sold or depleted. Stock returned as new batch.`,
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }

      // Update transfer batch (reduce remaining quantity)
      const newTransferRemaining = transferBatch.remainingQuantity - quantity;
      batch.update(batchRef, {
        remainingQuantity: newTransferRemaining,
        status: newTransferRemaining <= 0 ? 'depleted' : 'active',
        updatedAt: serverTimestamp()
      });

      // IMPORTANT: Update main stock record at the lending branch (fromBranchId)
      // This ensures the stock count is correct when products are returned
      const stocksRef = collection(db, 'stocks');
      const stockQuery = query(
        stocksRef,
        where('branchId', '==', transferBatch.fromBranchId), // Lending branch
        where('productId', '==', transferBatch.productId),
        where('status', '==', 'active')
      );
      const stockSnapshot = await getDocs(stockQuery);
      
      if (!stockSnapshot.empty) {
        const stockDoc = stockSnapshot.docs[0];
        const stockData = stockDoc.data();
        const currentRealTimeStock = parseInt(stockData.realTimeStock || stockData.currentStock || stockData.beginningStock || 0);
        const newRealTimeStock = currentRealTimeStock + quantity; // Add back the returned quantity
        
        batch.update(stockDoc.ref, {
          realTimeStock: newRealTimeStock,
          currentStock: newRealTimeStock, // Update both fields for compatibility
          updatedAt: serverTimestamp()
        });
      } else {
        console.warn(`No active stock record found for product ${transferBatch.productId} in branch ${transferBatch.fromBranchId} when returning stock`);
      }

      await batch.commit();
      return { 
        success: true, 
        message: `Returned ${quantity} units successfully`,
        returnedToOriginal: originalBatchDoc?.exists() || false
      };
    } catch (error) {
      console.error('Error returning stock to batch:', error);
      return { success: false, message: error.message };
    }
  }
}

export const inventoryService = new InventoryService();
export default inventoryService;

