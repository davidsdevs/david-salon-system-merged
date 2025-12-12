/**
 * Billing Service
 * Handles all billing and POS operations
 */

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  addDoc, 
  updateDoc,
  query, 
  where, 
  orderBy,
  Timestamp,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
// Inventory service removed - inventory deduction disabled
import toast from 'react-hot-toast';
import { earnLoyaltyPoints, redeemLoyaltyPoints } from './loyaltyService';
import { getClientProfile, updateClientProfile } from './clientService';
import { getReferralCode } from './referralService';

// Collections
const BILLS_COLLECTION = 'transactions';
const BILLING_LOGS_COLLECTION = 'transaction_logs';

// Bill Status Constants
export const BILL_STATUS = {
  PAID: 'paid',
  REFUNDED: 'refunded',
  VOIDED: 'voided'
};

// Payment Methods
export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  VOUCHER: 'voucher',
  GIFT_CARD: 'gift_card'
};

/**
 * Generate a new bill for a completed appointment
 * @param {Object} billData - Bill information
 * @param {Object} currentUser - User creating the bill
 * @returns {Promise<string>} - Bill ID
 */
export const createBill = async (billData, currentUser) => {
  try {
    const billRef = collection(db, BILLS_COLLECTION);
    
    // Ensure we have valid user data
    if (!currentUser) {
      throw new Error('Invalid user data. Please log in again.');
    }
    
    // Get user ID - handle both Firebase Auth user and userData from Firestore
    const userId = currentUser.uid || currentUser.id;
    const userName = currentUser.displayName || 
                    `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 
                    currentUser.email || 
                    'Unknown User';
    
    // Determine sales type based on items
    const items = billData.items || [];
    let salesType = 'service'; // Default to service
    
    if (items.length > 0) {
      const hasServices = items.some(item => item.type === 'service');
      const hasProducts = items.some(item => item.type === 'product');
      
      if (hasServices && hasProducts) {
        salesType = 'mixed';
      } else if (hasProducts && !hasServices) {
        salesType = 'product';
      } else {
        salesType = 'service';
      }
    }
    
    const bill = {
      appointmentId: billData.appointmentId,
      clientId: billData.clientId,
      clientName: billData.clientName,
      clientPhone: billData.clientPhone || '',
      branchId: billData.branchId,
      branchName: billData.branchName,
      stylistId: billData.stylistId || null,
      stylistName: billData.stylistName || '',
      items: items, // Array of services/products
      salesType: salesType, // 'service', 'product', or 'mixed'
      subtotal: billData.subtotal || 0,
      discount: billData.discount || 0,
      discountType: billData.discountType || null, // 'percentage' or 'fixed'
      discountCode: billData.discountCode || null,
      promotionCode: billData.promotionCode || null,
      promotionId: billData.promotionId || null,
      promotionDiscount: billData.promotionDiscount || 0,
      loyaltyPointsUsed: billData.loyaltyPointsUsed || 0,
      tax: billData.tax || 0,
      taxRate: billData.taxRate || 0,
      total: billData.total || 0,
      paymentMethod: billData.paymentMethod,
      paymentReference: billData.paymentReference || null,
      receiptNumber: billData.receiptNumber || null, // Receipt number from physical receipt
      status: BILL_STATUS.PAID,
      notes: billData.notes || '',
      createdBy: userId,
      createdByName: userName,
      approvedBy: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await addDoc(billRef, bill);
    
    // Deduct stock using FIFO (First In First Out) for products in transaction
    if (salesType === 'product' || salesType === 'mixed') {
      try {
        const productItems = items.filter(item => item.type === 'product');
        
        if (productItems.length > 0) {
          // Import inventoryService for FIFO batch deduction
          const { inventoryService } = await import('./inventoryService');
          
          for (const item of productItems) {
            if (!item.id || !item.quantity || item.quantity <= 0) continue;
            
            // Use FIFO to deduct from batches (oldest batches first)
            // If batches are already provided in the item, use those
            // Otherwise, let deductStockFIFO determine which batches to use
            if (item.batches && item.batches.length > 0) {
              // Batches are already determined, use deductStockFIFO which will use FIFO logic
              // Pass the batches so it uses the exact batches from the transaction
              const deductionResult = await inventoryService.deductStockFIFO({
                branchId: billData.branchId,
                productId: item.id,
                quantity: item.quantity,
                reason: 'Transaction Sale (OTC)',
                notes: `Bill ID: ${docRef.id}, Product: ${item.name}`,
                createdBy: billData.createdBy || 'system',
                productName: item.name || 'Unknown Product',
                batches: item.batches, // Pass the batches from the transaction
                usageType: 'otc' // Explicitly mark as OTC sale
              });
              
              if (!deductionResult.success) {
                console.warn(`⚠️ FIFO deduction failed for ${item.name}:`, deductionResult.message);
                // Fallback to old method if FIFO fails
                const stockQuery = query(
                  collection(db, 'stocks'),
                  where('productId', '==', item.id),
                  where('branchId', '==', billData.branchId),
                  where('status', '==', 'active')
                );
                
                const stockSnapshot = await getDocs(stockQuery);
                if (!stockSnapshot.empty) {
                  const stockDoc = stockSnapshot.docs[0];
                  const stockData = stockDoc.data();
                  const stockRef = stockDoc.ref;
                  const currentStock = parseInt(stockData.realTimeStock || 0);
                  const quantityToDeduct = parseInt(item.quantity || 0);
                  const newStock = Math.max(0, currentStock - quantityToDeduct);
                  
                  await updateDoc(stockRef, {
                    realTimeStock: newStock,
                    updatedAt: serverTimestamp()
                  });
                }
              } else {
                console.log(`✅ FIFO Stock deducted: ${item.name} - ${item.quantity} units from batches:`, 
                  deductionResult.updatedBatches?.map(b => b.batchNumber).join(', ') || 'N/A');
              }
            } else {
              // No batches provided, use FIFO to determine which batches to use
              const deductionResult = await inventoryService.deductStockFIFO({
                branchId: billData.branchId,
                productId: item.id,
                quantity: item.quantity,
                reason: 'Transaction Sale (OTC)',
                notes: `Bill ID: ${docRef.id}, Product: ${item.name}`,
                createdBy: billData.createdBy || 'system',
                productName: item.name || 'Unknown Product',
                usageType: 'otc' // Explicitly mark as OTC sale
              });
              
              if (!deductionResult.success) {
                console.warn(`⚠️ FIFO deduction failed for ${item.name}:`, deductionResult.message);
                // Fallback to old method if FIFO fails
                const stockQuery = query(
                  collection(db, 'stocks'),
                  where('productId', '==', item.id),
                  where('branchId', '==', billData.branchId),
                  where('status', '==', 'active')
                );
                
                const stockSnapshot = await getDocs(stockQuery);
                if (!stockSnapshot.empty) {
                  const stockDoc = stockSnapshot.docs[0];
                  const stockData = stockDoc.data();
                  const stockRef = stockDoc.ref;
                  const currentStock = parseInt(stockData.realTimeStock || 0);
                  const quantityToDeduct = parseInt(item.quantity || 0);
                  const newStock = Math.max(0, currentStock - quantityToDeduct);
                  
                  await updateDoc(stockRef, {
                    realTimeStock: newStock,
                    updatedAt: serverTimestamp()
                  });
                }
              } else {
                console.log(`✅ FIFO Stock deducted: ${item.name} - ${item.quantity} units from batches:`, 
                  deductionResult.updatedBatches?.map(b => b.batchNumber).join(', ') || 'N/A');
              }
            }
          }
          
          console.log(`✅ FIFO Stock deduction completed for ${productItems.length} product(s)`);
        }
      } catch (stockError) {
        console.error('Error deducting stock:', stockError);
        // Don't fail the transaction if stock deduction fails, but log it
        toast.error('Transaction created but stock deduction failed. Please update stock manually.');
      }
    }

    // Deduct products for services performed (salon-use products)
    if (salesType === 'service' || salesType === 'mixed') {
      try {
        const serviceItems = items.filter(item => item.type === 'service');
        const { inventoryService } = await import('./inventoryService');
        const { getServiceById } = await import('./serviceManagementService');
        
        for (const serviceItem of serviceItems) {
          if (!serviceItem.id) continue;
          
          try {
            // Get service details including product mappings
            const service = await getServiceById(serviceItem.id);
            if (!service || !service.productMappings || service.productMappings.length === 0) {
              continue; // No product mappings for this service
            }
            
            // Deduct products for this service (salon-use batches only)
            for (const mapping of service.productMappings) {
              if (!mapping.productId || !mapping.quantity) continue;
              
              // Deduct from salon-use batches only
              const deductionResult = await inventoryService.deductStockFIFO({
                branchId: billData.branchId,
                productId: mapping.productId,
                quantity: mapping.quantity,
                reason: 'Service Use',
                notes: `Service: ${service.name || serviceItem.name}, Bill ID: ${docRef.id}`,
                createdBy: billData.createdBy || 'system',
                productName: mapping.productName || 'Unknown Product',
                usageType: 'salon-use' // Only use salon-use batches for services
              });
              
              if (!deductionResult.success) {
                console.warn(`⚠️ Service product deduction failed for ${mapping.productName}:`, deductionResult.message);
                // Log but don't fail the transaction
              } else {
                console.log(`✅ Service product deducted: ${mapping.productName} - ${mapping.quantity} units (salon-use)`);
              }
            }
          } catch (serviceError) {
            console.error(`Error processing service ${serviceItem.id}:`, serviceError);
            // Continue with other services
          }
        }
      } catch (serviceStockError) {
        console.error('Error deducting service products:', serviceStockError);
        // Don't fail the transaction if service product deduction fails
        toast.error('Transaction created but service product deduction failed. Please update stock manually.');
      }
    }
    
    // CRM Integration: Handle loyalty points
    if (billData.clientId && billData.branchId) {
      try {
        // Redeem loyalty points if used
        if (billData.loyaltyPointsUsed > 0) {
          await redeemLoyaltyPoints(
            billData.clientId,
            billData.branchId,
            billData.loyaltyPointsUsed,
            docRef.id,
            currentUser
          );
        }
        
        // Earn loyalty points from transaction (after redemption, so net amount)
        if (billData.total > 0) {
          await earnLoyaltyPoints(
            billData.clientId,
            billData.branchId,
            billData.total,
            docRef.id,
            currentUser
          );
        }
        
        // Update client profile stats (visitCount, totalSpent, lastVisit)
        // This was previously done in addServiceHistory, but we removed service_history as redundant
        try {
          const profile = await getClientProfile(billData.clientId);
          if (profile) {
            // Count services in this transaction
            const serviceCount = billData.items?.filter(item => item.type === 'service').length || 0;
            const serviceTotal = billData.items?.filter(item => item.type === 'service')
              .reduce((sum, item) => sum + (item.price || 0), 0) || 0;
            
            await updateClientProfile(billData.clientId, {
              visitCount: (profile.visitCount || 0) + serviceCount,
              lastVisit: Timestamp.now(),
              totalSpent: (profile.totalSpent || 0) + serviceTotal,
              updatedAt: Timestamp.now()
            }, currentUser);
          }
        } catch (profileError) {
          console.error('Error updating client profile stats:', profileError);
          // Don't fail the bill creation if profile update fails
        }
        
        // Auto-generate referral code for this branch (if client hasn't visited before)
        // This happens after the transaction is created, so hasVisitedBranch will return true
        try {
          if (billData.clientId && billData.branchId) {
            await getReferralCode(billData.clientId, billData.branchId);
            // getReferralCode will check if client has visited and generate code if eligible
            console.log(`✅ Referral code check/generation for client ${billData.clientId} at branch ${billData.branchId}`);
          }
        } catch (referralError) {
          console.error('Error generating referral code:', referralError);
          // Don't fail the bill creation if referral code generation fails
        }
        
        // Service history removed - redundant, data already in transactions collection
      } catch (error) {
        console.error('Error processing CRM integration:', error);
        // Don't fail the bill creation if CRM integration fails
      }
    }
    
    // Log the action
    await logBillingAction({
      billId: docRef.id,
      action: 'create',
      performedBy: userId,
      performedByName: userName,
      branchId: billData.branchId,
      details: `Bill created for ${billData.clientName}`
    });

    toast.success('Bill created successfully');
    return docRef.id;
  } catch (error) {
    console.error('Error creating bill:', error);
    toast.error('Failed to create bill');
    throw error;
  }
};

/**
 * Get bill by ID
 * @param {string} billId - Bill ID
 * @returns {Promise<Object>} - Bill data
 */
export const getBillById = async (billId) => {
  try {
    const billRef = doc(db, BILLS_COLLECTION, billId);
    const billSnap = await getDoc(billRef);
    
    if (!billSnap.exists()) {
      throw new Error('Bill not found');
    }
    
    return {
      id: billSnap.id,
      ...billSnap.data(),
      createdAt: billSnap.data().createdAt?.toDate(),
      updatedAt: billSnap.data().updatedAt?.toDate()
    };
  } catch (error) {
    console.error('Error fetching bill:', error);
    throw error;
  }
};

/**
 * Get all bills for a branch
 * @param {string} branchId - Branch ID
 * @param {Object} filters - Optional filters (startDate, endDate, status)
 * @returns {Promise<Array>} - Array of bills
 */
export const getBillsByBranch = async (branchId, filters = {}) => {
  try {
    const billsRef = collection(db, BILLS_COLLECTION);
    let q = query(
      billsRef,
      where('branchId', '==', branchId),
      orderBy('createdAt', 'desc')
    );

    // Apply status filter if provided
    if (filters.status) {
      q = query(
        billsRef,
        where('branchId', '==', branchId),
        where('status', '==', filters.status),
        orderBy('createdAt', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    let bills = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));

    // Apply date filters in memory (to avoid complex Firestore queries)
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      bills = bills.filter(bill => bill.createdAt >= start);
    }

    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      bills = bills.filter(bill => bill.createdAt <= end);
    }

    return bills;
  } catch (error) {
    console.error('Error fetching bills:', error);
    toast.error('Failed to fetch bills');
    return [];
  }
};

/**
 * Get bills by client ID
 * @param {string} clientId - Client ID
 * @returns {Promise<Array>} - Array of bills
 */
export const getBillsByClient = async (clientId) => {
  try {
    const billsRef = collection(db, BILLS_COLLECTION);
    const q = query(
      billsRef,
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching client bills:', error);
    return [];
  }
};

/**
 * Process a refund for a bill
 * @param {string} billId - Bill ID
 * @param {Object} refundData - Refund information
 * @param {Object} currentUser - User processing the refund
 * @returns {Promise<void>}
 */
export const refundBill = async (billId, refundData, currentUser) => {
  try {
    const billRef = doc(db, BILLS_COLLECTION, billId);
    const bill = await getBillById(billId);

    if (bill.status === BILL_STATUS.REFUNDED || bill.status === BILL_STATUS.VOIDED) {
      throw new Error('Bill is already refunded or voided');
    }

    const newStatus = BILL_STATUS.REFUNDED;

    const userId = currentUser.uid || currentUser.id;
    const userName = currentUser.displayName || 
                    `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 
                    currentUser.email || 
                    'Unknown User';

    await updateDoc(billRef, {
      status: newStatus,
      refundAmount: refundData.amount || bill.total,
      refundReason: refundData.reason || '',
      approvedBy: userId,
      approvedByName: userName,
      refundedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    // Log the refund action
    await logBillingAction({
      billId,
      action: 'refund',
      performedBy: userId,
      performedByName: userName,
      branchId: bill.branchId,
      details: `Refund of ₱${refundData.amount || bill.total}. Reason: ${refundData.reason || 'No reason provided'}`
    });

    toast.success('Refund processed successfully');
  } catch (error) {
    console.error('Error processing refund:', error);
    toast.error(error.message || 'Failed to process refund');
    throw error;
  }
};

/**
 * Void a bill transaction
 * @param {string} billId - Bill ID
 * @param {string} reason - Void reason
 * @param {Object} currentUser - User voiding the bill
 * @param {Object} witnessInfo - Witness information {id, email, name}
 * @returns {Promise<void>}
 */
export const voidBill = async (billId, reason, currentUser, witnessInfo = null) => {
  try {
    const billRef = doc(db, BILLS_COLLECTION, billId);
    const bill = await getBillById(billId);

    if (bill.status === BILL_STATUS.VOIDED) {
      throw new Error('Bill is already voided');
    }

    // Require witness for voiding
    if (!witnessInfo || !witnessInfo.id) {
      throw new Error('Witness verification is required to void a transaction');
    }

    const userId = currentUser.uid || currentUser.id;
    const userName = currentUser.displayName || 
                    `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 
                    currentUser.email || 
                    'Unknown User';

    await updateDoc(billRef, {
      status: BILL_STATUS.VOIDED,
      voidReason: reason,
      approvedBy: userId,
      approvedByName: userName,
      witnessId: witnessInfo.id,
      witnessEmail: witnessInfo.email,
      witnessName: witnessInfo.name,
      voidedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    // Log the void action with witness information
    await logBillingAction({
      billId,
      action: 'void',
      performedBy: userId,
      performedByName: userName,
      branchId: bill.branchId,
      details: `Bill voided. Reason: ${reason}. Witness: ${witnessInfo.name} (${witnessInfo.email})`
    });

    toast.success('Bill voided successfully');
  } catch (error) {
    console.error('Error voiding bill:', error);
    toast.error(error.message || 'Failed to void bill');
    throw error;
  }
};

/**
 * Get daily sales summary for a branch
 * @param {string} branchId - Branch ID
 * @param {Date} date - Date (defaults to today)
 * @returns {Promise<Object>} - Sales summary
 */
export const getDailySalesSummary = async (branchId, date = new Date()) => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bills = await getBillsByBranch(branchId, {
      startDate: startOfDay,
      endDate: endOfDay
    });

    const summary = {
      totalTransactions: 0,
      totalRevenue: 0,
      totalDiscounts: 0,
      totalRefunds: 0,
      totalTax: 0,
      paymentBreakdown: {
        cash: 0,
        card: 0,
        voucher: 0,
        gift_card: 0
      },
      statusBreakdown: {
        paid: 0,
        refunded: 0,
        voided: 0
      }
    };

    bills.forEach(bill => {
      // Count by status
      summary.statusBreakdown[bill.status] = (summary.statusBreakdown[bill.status] || 0) + 1;

      if (bill.status === BILL_STATUS.PAID) {
        summary.totalTransactions++;
        summary.totalRevenue += bill.total;
        summary.totalDiscounts += bill.discount;
        summary.totalTax += bill.tax;

        // Payment breakdown
        if (bill.paymentMethod) {
          summary.paymentBreakdown[bill.paymentMethod] += bill.total;
        }
      }

      if (bill.status === BILL_STATUS.REFUNDED) {
        summary.totalRefunds += bill.refundAmount || bill.total;
      }
    });

    // Net revenue (after refunds)
    summary.netRevenue = summary.totalRevenue - summary.totalRefunds;

    return summary;
  } catch (error) {
    console.error('Error getting daily sales summary:', error);
    return null;
  }
};

/**
 * Calculate bill totals
 * @param {Object} billData - Bill data with items, discount, tax rate, etc.
 * @returns {Object} - Calculated totals
 */
export const calculateBillTotals = (billData) => {
  const { items = [], discount = 0, discountType = 'fixed', taxRate = 0, loyaltyPointsUsed = 0, promotionDiscount = 0 } = billData;

  // Calculate subtotal from items
  const subtotal = items.reduce((sum, item) => {
    return sum + (item.price * (item.quantity || 1));
  }, 0);

  // Calculate discount amount
  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = (subtotal * discount) / 100;
  } else {
    discountAmount = discount;
  }

  // Add loyalty points discount (e.g., 1 point = 1 peso)
  discountAmount += loyaltyPointsUsed;

  // Add promotion discount
  discountAmount += (promotionDiscount || 0);

  // Amount after discount
  const amountAfterDiscount = Math.max(0, subtotal - discountAmount);

  // Calculate tax (no service charge)
  const tax = (amountAfterDiscount * taxRate) / 100;

  // Calculate total
  const total = amountAfterDiscount + tax;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    discount: parseFloat(discountAmount.toFixed(2)),
    serviceCharge: 0,
    tax: parseFloat(tax.toFixed(2)),
    total: parseFloat(total.toFixed(2))
  };
};

/**
 * Log billing action for audit trail
 * @param {Object} logData - Log information
 * @returns {Promise<void>}
 */
const logBillingAction = async (logData) => {
  try {
    const logsRef = collection(db, BILLING_LOGS_COLLECTION);
    await addDoc(logsRef, {
      billId: logData.billId,
      action: logData.action,
      performedBy: logData.performedBy,
      performedByName: logData.performedByName,
      branchId: logData.branchId,
      details: logData.details,
      timestamp: Timestamp.now()
    });
  } catch (error) {
    console.error('Error logging billing action:', error);
    // Don't throw - logging failures shouldn't break the main operation
  }
};

/**
 * Get billing logs for a bill
 * @param {string} billId - Bill ID
 * @returns {Promise<Array>} - Array of logs
 */
export const getBillingLogs = async (billId) => {
  try {
    const logsRef = collection(db, BILLING_LOGS_COLLECTION);
    const q = query(
      logsRef,
      where('billId', '==', billId),
      orderBy('timestamp', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching billing logs:', error);
    return [];
  }
};

/**
 * Get all billing logs for a branch
 * @param {string} branchId - Branch ID
 * @param {number} limit - Maximum number of logs to retrieve
 * @returns {Promise<Array>} - Array of logs
 */
export const getBranchBillingLogs = async (branchId, limit = 100) => {
  try {
    const logsRef = collection(db, BILLING_LOGS_COLLECTION);
    const q = query(
      logsRef,
      where('branchId', '==', branchId),
      orderBy('timestamp', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, limit).map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching branch billing logs:', error);
    return [];
  }
};
