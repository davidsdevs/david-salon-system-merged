/**
 * Loyalty Points Service
 * Module: M06 - CRM
 * Handles loyalty points earning, redemption, and tracking
 */

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  addDoc, 
  updateDoc,
  setDoc,
  query, 
  where, 
  orderBy,
  limit as firestoreLimit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import toast from 'react-hot-toast';
import { logActivity } from './activityService';

const CLIENTS_COLLECTION = 'clients';
const LOYALTY_POINTS_COLLECTION = 'loyalty_points'; // Flat collection: loyalty_points/{clientId} with branchPoints map
const LOYALTY_LOGS_COLLECTION = 'loyalty_logs'; // Flat collection: loyalty_logs/{logId}

// Default loyalty rules (can be configured by System Admin)
const DEFAULT_POINTS_PER_PESO = 0.01; // 1 point per ₱100 spent
const DEFAULT_POINT_VALUE = 1; // 1 point = ₱1 discount

/**
 * Get loyalty points balance for a client at a specific branch
 * @param {string} clientId - Client ID
 * @param {string} branchId - Branch ID (required)
 * @returns {Promise<number>} - Points balance for the branch
 */
export const getLoyaltyPoints = async (clientId, branchId) => {
  try {
    if (!branchId) {
      console.warn('⚠️ branchId is required for getLoyaltyPoints');
      return 0;
    }

    // Get client's loyalty points document (single document per client)
    const pointsRef = doc(db, LOYALTY_POINTS_COLLECTION, clientId);
    const pointsSnap = await getDoc(pointsRef);
    
    if (pointsSnap.exists()) {
      const data = pointsSnap.data();
      const branchPoints = data.branchPoints || {};
      const points = branchPoints[branchId] || 0;
      console.log(`✅ Found loyalty points for client ${clientId} at branch ${branchId}:`, points);
      return points;
    }
    
    console.log(`⚠️ No loyalty points found for client ${clientId} at branch ${branchId}`);
    return 0;
  } catch (error) {
    console.error('Error getting loyalty points:', error);
    return 0;
  }
};

/**
 * Earn loyalty points from a transaction (branch-specific)
 * @param {string} clientId - Client ID
 * @param {string} branchId - Branch ID (required)
 * @param {number} amount - Transaction amount
 * @param {string} billId - Bill/Transaction ID
 * @param {Object} currentUser - User processing the transaction
 * @param {number} pointsPerPeso - Points earned per peso (default: 0.01)
 * @returns {Promise<number>} - Points earned
 */
export const earnLoyaltyPoints = async (clientId, branchId, amount, billId, currentUser, pointsPerPeso = DEFAULT_POINTS_PER_PESO) => {
  try {
    if (!branchId) {
      console.warn('⚠️ branchId is required for earnLoyaltyPoints');
      return 0;
    }

    const pointsEarned = Math.floor(amount * pointsPerPeso);
    
    if (pointsEarned <= 0) {
      return 0;
    }
    
    // Ensure client profile exists
    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    const clientSnap = await getDoc(clientRef);
    
    if (!clientSnap.exists()) {
      // Create profile if doesn't exist
      // First, try to get client info from users collection
      let clientName = 'Client';
      let clientEmail = '';
      let clientPhone = '';
      
      try {
        const userRef = doc(db, 'users', clientId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          clientName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.displayName || 'Client';
          clientEmail = userData.email || '';
          clientPhone = userData.phoneNumber || userData.phone || '';
        }
      } catch (error) {
        console.error('Error fetching user data for client profile:', error);
      }
      
      // Create new client document (without loyaltyPoints - stored per branch)
      await setDoc(clientRef, {
        clientId,
        name: clientName,
        email: clientEmail,
        phone: clientPhone,
        visitCount: 0,
        totalSpent: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        isActive: true
      });
      
      console.log('✅ Created new client document in clients collection:', clientId);
    }
    
    // Update branch-specific loyalty points in single document
    const pointsRef = doc(db, LOYALTY_POINTS_COLLECTION, clientId);
    const pointsSnap = await getDoc(pointsRef);
    
    let finalBalance;
    if (!pointsSnap.exists()) {
      // Create new document with branchPoints map
      await setDoc(pointsRef, {
        clientId,
        branchPoints: {
          [branchId]: pointsEarned
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      finalBalance = pointsEarned;
      console.log(`✅ Created loyalty points document for client ${clientId} at branch ${branchId}:`, pointsEarned);
    } else {
      // Update existing document using dot notation for nested field
      const data = pointsSnap.data();
      const branchPoints = data.branchPoints || {};
      const currentPoints = branchPoints[branchId] || 0;
      finalBalance = currentPoints + pointsEarned;
      
      await updateDoc(pointsRef, {
        [`branchPoints.${branchId}`]: finalBalance,
        updatedAt: Timestamp.now()
      });
      console.log(`✅ Updated branch points for client ${clientId} at branch ${branchId}:`, currentPoints, '->', finalBalance);
    }
    
    // Log loyalty transaction (flat collection)
    const logRef = collection(db, LOYALTY_LOGS_COLLECTION);
    await addDoc(logRef, {
      clientId,
      type: 'earned',
      branchId,
      points: pointsEarned,
      billId,
      amount,
      balance: finalBalance,
      description: `Earned ${pointsEarned} points from transaction at branch`,
      processedBy: currentUser?.uid || 'system',
      processedByName: currentUser?.displayName || currentUser?.firstName || 'System',
      createdAt: Timestamp.now()
    });
    
    console.log('✅ Loyalty points earned and logged:', {
      clientId,
      branchId,
      pointsEarned,
      finalBalance,
      billId
    });
    
    // Log activity
    await logActivity({
      performedBy: currentUser?.uid || 'system',
      action: 'EARN_LOYALTY_POINTS',
      targetType: 'client',
      targetId: clientId,
      details: `Client earned ${pointsEarned} loyalty points at branch ${branchId}`,
      metadata: { billId, amount, pointsEarned, branchId }
    });
    
    return pointsEarned;
  } catch (error) {
    console.error('Error earning loyalty points:', error);
    throw error;
  }
};

/**
 * Redeem loyalty points for discount (branch-specific)
 * @param {string} clientId - Client ID
 * @param {string} branchId - Branch ID (required)
 * @param {number} pointsToRedeem - Points to redeem
 * @param {string} billId - Bill/Transaction ID
 * @param {Object} currentUser - User processing the redemption
 * @param {number} pointValue - Value per point (default: 1)
 * @returns {Promise<number>} - Discount amount
 */
export const redeemLoyaltyPoints = async (clientId, branchId, pointsToRedeem, billId, currentUser, pointValue = DEFAULT_POINT_VALUE) => {
  try {
    if (!branchId) {
      throw new Error('Branch ID is required for redeeming loyalty points');
    }

    if (pointsToRedeem <= 0) {
      return 0;
    }
    
    // Get current balance for this branch
    const currentPoints = await getLoyaltyPoints(clientId, branchId);
    
    if (currentPoints < pointsToRedeem) {
      throw new Error(`Insufficient loyalty points. Available: ${currentPoints}, Required: ${pointsToRedeem}`);
    }
    
    // Calculate discount
    const discountAmount = pointsToRedeem * pointValue;
    
    // Update branch-specific loyalty points in single document
    const pointsRef = doc(db, LOYALTY_POINTS_COLLECTION, clientId);
    const finalBalance = currentPoints - pointsToRedeem;
    
    // Use dot notation to update nested branchPoints field
    await updateDoc(pointsRef, {
      [`branchPoints.${branchId}`]: finalBalance,
      updatedAt: Timestamp.now()
    });
    
    console.log(`✅ Redeemed ${pointsToRedeem} points for client ${clientId} at branch ${branchId}. New balance: ${finalBalance}`);
    
    // Log loyalty transaction (flat collection)
    const logRef = collection(db, LOYALTY_LOGS_COLLECTION);
    await addDoc(logRef, {
      clientId,
      type: 'redeemed',
      branchId,
      points: -pointsToRedeem,
      billId,
      discountAmount,
      balance: finalBalance,
      description: `Redeemed ${pointsToRedeem} points for ₱${discountAmount.toFixed(2)} discount at branch`,
      processedBy: currentUser?.uid || 'system',
      processedByName: currentUser?.displayName || currentUser?.firstName || 'System',
      createdAt: Timestamp.now()
    });
    
    // Log activity
    await logActivity({
      performedBy: currentUser?.uid || 'system',
      action: 'REDEEM_LOYALTY_POINTS',
      targetType: 'client',
      targetId: clientId,
      details: `Client redeemed ${pointsToRedeem} loyalty points at branch ${branchId}`,
      metadata: { billId, discountAmount, pointsRedeemed: pointsToRedeem, branchId }
    });
    
    return discountAmount;
  } catch (error) {
    console.error('Error redeeming loyalty points:', error);
    toast.error(error.message || 'Failed to redeem loyalty points');
    throw error;
  }
};

/**
 * Get loyalty transaction history (optionally filtered by branch)
 * @param {string} clientId - Client ID
 * @param {string} branchId - Optional branch ID to filter by
 * @param {number} limitCount - Limit results
 * @returns {Promise<Array>} - Loyalty logs
 */
export const getLoyaltyHistory = async (clientId, branchId = null, limitCount = 50) => {
  try {
    const logRef = collection(db, LOYALTY_LOGS_COLLECTION);
    let q;
    
    if (branchId) {
      // Filter by client and branch
      q = query(
        logRef, 
        where('clientId', '==', clientId),
        where('branchId', '==', branchId),
        orderBy('createdAt', 'desc'), 
        firestoreLimit(limitCount)
      );
    } else {
      // Get all branches for client
      q = query(
        logRef,
        where('clientId', '==', clientId),
        orderBy('createdAt', 'desc'), 
        firestoreLimit(limitCount)
      );
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching loyalty history:', error);
    return [];
  }
};

/**
 * Get all branch loyalty points for a client (summary)
 * @param {string} clientId - Client ID
 * @returns {Promise<Array>} - Array of { branchId, loyaltyPoints, updatedAt }
 */
export const getAllBranchLoyaltyPoints = async (clientId) => {
  try {
    const pointsRef = doc(db, LOYALTY_POINTS_COLLECTION, clientId);
    const pointsSnap = await getDoc(pointsRef);
    
    if (!pointsSnap.exists()) {
      return [];
    }
    
    const data = pointsSnap.data();
    const branchPoints = data.branchPoints || {};
    const updatedAt = data.updatedAt?.toDate();
    
    // Convert branchPoints map to array format
    return Object.entries(branchPoints).map(([branchId, loyaltyPoints]) => ({
      id: clientId,
      branchId,
      loyaltyPoints,
      updatedAt
    }));
  } catch (error) {
    console.error('Error fetching all branch loyalty points:', error);
    return [];
  }
};

