/**
 * Price History Service
 * Manages service price change history and sales analytics
 */

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Get price change history for a service and branch
 * @param {string} serviceId - Service ID
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of price change records
 */
export const getPriceHistory = async (serviceId, branchId) => {
  try {
    if (!serviceId || !branchId) {
      console.error('Missing serviceId or branchId for price history query', { serviceId, branchId });
      return [];
    }
    
    console.log('Fetching price history for:', { serviceId, branchId });
    // Check both collection names for backward compatibility
    const priceHistoryRef = collection(db, 'services_price_history');
    
    // Query all price history for this service and branch
    // Try with orderBy first (requires composite index), fallback if needed
    let snapshot;
    try {
      const q = query(
        priceHistoryRef,
        where('serviceId', '==', serviceId),
        where('branchId', '==', branchId),
        orderBy('changedAt', 'desc')
      );
      snapshot = await getDocs(q);
    } catch (indexError) {
      // If index error, try without orderBy and sort manually
      console.warn('Index error (might need Firestore composite index), fetching without orderBy:', indexError);
      const q = query(
        priceHistoryRef,
        where('serviceId', '==', serviceId),
        where('branchId', '==', branchId)
      );
      snapshot = await getDocs(q);
    }
    
    const history = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      history.push({
        id: doc.id,
        ...data,
        oldPrice: data.oldPrice !== undefined ? (typeof data.oldPrice === 'number' ? data.oldPrice : parseFloat(data.oldPrice) || 0) : 0,
        newPrice: data.newPrice !== undefined ? (typeof data.newPrice === 'number' ? data.newPrice : parseFloat(data.newPrice) || 0) : 0,
        changedAt: data.changedAt?.toDate ? data.changedAt.toDate() : (data.changedAt ? new Date(data.changedAt) : new Date())
      });
    });
    
    // Sort manually by date (newest first)
    history.sort((a, b) => {
      const aTime = a.changedAt instanceof Date ? a.changedAt.getTime() : new Date(a.changedAt).getTime();
      const bTime = b.changedAt instanceof Date ? b.changedAt.getTime() : new Date(b.changedAt).getTime();
      return bTime - aTime;
    });
    
    console.log(`Found ${history.length} price history records for service "${serviceId}" at branch "${branchId}"`);
    if (history.length === 0) {
      console.warn('No price history found. This could mean:');
      console.warn('1. No price changes have been recorded yet');
      console.warn('2. Price was set before history tracking was implemented');
      console.warn('3. Query parameters might not match saved records');
    }
    
    return history;
  } catch (error) {
    console.error('Error fetching price history:', error);
    console.error('Query parameters:', { serviceId, branchId });
    // Return empty array instead of throwing to prevent UI crashes
    return [];
  }
};

/**
 * Get sales data for a service and branch within a date range
 * @param {string} serviceId - Service ID
 * @param {string} branchId - Branch ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Sales statistics
 */
export const getServiceSalesData = async (serviceId, branchId, startDate, endDate) => {
  try {
    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      where('branchId', '==', branchId),
      where('status', '==', 'paid'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);
    
    let totalSales = 0;
    let totalQuantity = 0;
    let totalRevenue = 0;
    const salesByDate = {};
    
    snapshot.forEach((doc) => {
      const transaction = doc.data();
      const transactionDate = transaction.createdAt?.toDate 
        ? transaction.createdAt.toDate() 
        : new Date(transaction.createdAt);
      
      // Filter by date range
      if (transactionDate >= startDateObj && transactionDate <= endDateObj) {
        // Check if this transaction includes the service
        // Transactions have a 'services' array (primary), but may also have 'items' for compatibility
        const servicesArray = transaction.services || [];
        const itemsArray = transaction.items || [];
        const allServices = servicesArray.length > 0 ? servicesArray : itemsArray;
        
        allServices.forEach(service => {
          // Match by serviceId field
          const matchesService = service.serviceId === serviceId || service.id === serviceId;
          
          // Ensure it's a service (not a product) - services don't have productId
          const isService = !service.productId && (service.serviceId || service.id);
          
          if (isService && matchesService) {
            const quantity = service.quantity || 1;
            // Get price from various possible fields (prioritize adjustedPrice for accuracy)
            const price = service.adjustedPrice || service.price || service.basePrice || 
                         service.servicePrice || service.total || 0;
            
            totalQuantity += quantity;
            totalRevenue += price * quantity;
            totalSales += 1;
            
            // Group by date
            const dateKey = transactionDate.toISOString().split('T')[0];
            if (!salesByDate[dateKey]) {
              salesByDate[dateKey] = { quantity: 0, revenue: 0, count: 0 };
            }
            salesByDate[dateKey].quantity += quantity;
            salesByDate[dateKey].revenue += price * quantity;
            salesByDate[dateKey].count += 1;
          }
        });
      }
    });
    
    return {
      totalSales,
      totalQuantity,
      totalRevenue,
      averagePrice: totalQuantity > 0 ? totalRevenue / totalQuantity : 0,
      salesByDate
    };
  } catch (error) {
    console.error('Error fetching sales data:', error);
    throw error;
  }
};

/**
 * Get price change impact analysis
 * Compares sales before and after a price change
 * @param {string} serviceId - Service ID
 * @param {string} branchId - Branch ID
 * @param {Date} priceChangeDate - Date when price was changed
 * @param {number} daysBefore - Number of days before price change to analyze
 * @param {number} daysAfter - Number of days after price change to analyze
 * @returns {Promise<Object>} Comparison data
 */
export const getPriceChangeImpact = async (
  serviceId, 
  branchId, 
  priceChangeDate, 
  daysBefore = 30, 
  daysAfter = 30
) => {
  try {
    const changeDate = new Date(priceChangeDate);
    const beforeStart = new Date(changeDate);
    beforeStart.setDate(beforeStart.getDate() - daysBefore);
    const afterEnd = new Date(changeDate);
    afterEnd.setDate(afterEnd.getDate() + daysAfter);
    
    const [beforeData, afterData] = await Promise.all([
      getServiceSalesData(serviceId, branchId, beforeStart, changeDate),
      getServiceSalesData(serviceId, branchId, changeDate, afterEnd)
    ]);
    
    // Calculate percentage changes
    const quantityChange = beforeData.totalQuantity > 0
      ? ((afterData.totalQuantity - beforeData.totalQuantity) / beforeData.totalQuantity) * 100
      : 0;
    
    const revenueChange = beforeData.totalRevenue > 0
      ? ((afterData.totalRevenue - beforeData.totalRevenue) / beforeData.totalRevenue) * 100
      : 0;
    
    const salesCountChange = beforeData.totalSales > 0
      ? ((afterData.totalSales - beforeData.totalSales) / beforeData.totalSales) * 100
      : 0;
    
    return {
      before: {
        ...beforeData,
        period: `${daysBefore} days before`
      },
      after: {
        ...afterData,
        period: `${daysAfter} days after`
      },
      changes: {
        quantityChange,
        revenueChange,
        salesCountChange
      },
      priceChangeDate: changeDate
    };
  } catch (error) {
    console.error('Error calculating price change impact:', error);
    throw error;
  }
};

/**
 * Get transactions for a service within a price range and date range
 * Filters transactions where the service was sold at a specific price
 * @param {string} serviceId - Service ID
 * @param {string} branchId - Branch ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {number} price - Specific price to filter by (optional, allows small variance)
 * @returns {Promise<Array>} Array of transaction objects
 */
export const getTransactionsForPricePeriod = async (
  serviceId,
  branchId,
  startDate,
  endDate,
  price = null
) => {
  try {
    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      where('branchId', '==', branchId),
      where('status', '==', 'paid'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);
    
    const transactions = [];
    
    snapshot.forEach((doc) => {
      const transaction = doc.data();
      const transactionDate = transaction.createdAt?.toDate 
        ? transaction.createdAt.toDate() 
        : new Date(transaction.createdAt);
      
      // Filter by date range
      if (transactionDate >= startDateObj && transactionDate <= endDateObj) {
        // Check if this transaction includes the service
        // Transactions have a 'services' array (primary), but may also have 'items' for compatibility
        const servicesArray = transaction.services || [];
        const itemsArray = transaction.items || [];
        const allServices = servicesArray.length > 0 ? servicesArray : itemsArray;
        
        allServices.forEach(service => {
          // Match by serviceId field
          const matchesService = service.serviceId === serviceId || service.id === serviceId;
          
          // Ensure it's a service (not a product) - services don't have productId
          const isService = !service.productId && (service.serviceId || service.id);
          
          if (isService && matchesService) {
            // Get price from various possible fields (prioritize adjustedPrice for accuracy)
            const itemPrice = service.adjustedPrice || service.price || service.basePrice || 
                             service.servicePrice || service.total || 0;
            
            // If price filter is provided, check if it matches (allow 1 peso variance for rounding)
            if (price === null || Math.abs(itemPrice - price) <= 1) {
              transactions.push({
                id: doc.id,
                transactionId: doc.id,
                transactionDate,
                clientName: transaction.clientInfo?.name || transaction.clientName || 'Walk-in',
                clientId: transaction.clientId || null,
                itemName: service.serviceName || service.name || 'Unknown Service',
                itemPrice,
                quantity: service.quantity || 1,
                subtotal: transaction.subtotal || 0,
                discount: transaction.discount || 0,
                total: transaction.total || transaction.totalAmount || 0,
                paymentMethod: transaction.paymentMethod || 'cash',
                stylistName: service.stylistName || transaction.stylistName || 'N/A',
                appointmentId: transaction.appointmentId || null,
                createdAt: transactionDate
              });
            }
          }
        });
      }
    });
    
    return transactions;
  } catch (error) {
    console.error('Error fetching transactions for price period:', error);
    throw error;
  }
};

