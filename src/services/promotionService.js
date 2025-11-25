/**
 * Promotions & Campaigns Service
 * Module: M06 - CRM
 * Handles promotional campaigns and client targeting
 */

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
  Timestamp,
  increment,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../config/firebase';
import toast from 'react-hot-toast';
import { logActivity } from './activityService';

const PROMOTIONS_COLLECTION = 'promotions';

/**
 * Create a new promotion
 * @param {Object} promotionData - Promotion information
 * @param {Object} currentUser - User creating the promotion
 * @returns {Promise<string>} - Promotion ID
 */
export const createPromotion = async (promotionData, currentUser) => {
  try {
    const promotionsRef = collection(db, PROMOTIONS_COLLECTION);
    
    const promotion = {
      name: promotionData.name,
      description: promotionData.description || '',
      promotionCode: promotionData.promotionCode || '',
      type: promotionData.type || 'discount', // 'discount', 'points', 'free_service'
      discountType: promotionData.discountType || 'percentage', // 'percentage' or 'fixed'
      discountValue: promotionData.discountValue || 0,
      // Targeting
      branchId: promotionData.branchId !== undefined ? promotionData.branchId : null, // null = all branches (system-wide)
      targetSegment: promotionData.targetSegment || 'all', // 'all', 'bronze', 'silver', 'gold', 'platinum'
      applicableTo: promotionData.applicableTo || 'all',
      applicableServices: promotionData.applicableServices || [], // Empty = all services
      specificServices: promotionData.specificServices || [],
      specificProducts: promotionData.specificProducts || [],
      // Usage
      usageType: promotionData.usageType || 'repeating',
      maxUses: promotionData.maxUses || null,
      usedBy: promotionData.usedBy || [],
      usageCount: promotionData.usageCount || 0,
      // Validity
      startDate: Timestamp.fromDate(new Date(promotionData.startDate)),
      endDate: Timestamp.fromDate(new Date(promotionData.endDate)),
      // Status
      isActive: promotionData.isActive !== undefined ? promotionData.isActive : true,
      // Metadata
      createdBy: currentUser?.uid || 'system',
      createdByName: currentUser?.displayName || currentUser?.firstName || 'System',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    const docRef = await addDoc(promotionsRef, promotion);
    
    // Log activity
    await logActivity({
      performedBy: currentUser?.uid || 'system',
      action: 'CREATE_PROMOTION',
      targetType: 'promotion',
      targetId: docRef.id,
      details: `Created promotion: ${promotion.name}`,
      metadata: { 
        branchId: promotionData.branchId,
        type: promotion.type,
        targetSegment: promotion.targetSegment
      }
    });
    
    toast.success('Promotion created successfully');
    return docRef.id;
  } catch (error) {
    console.error('Error creating promotion:', error);
    toast.error('Failed to create promotion');
    throw error;
  }
};

/**
 * Get all active promotions for a branch
 * @param {string} branchId - Branch ID (null for all branches)
 * @returns {Promise<Array>} - Active promotions
 */
export const getActivePromotions = async (branchId = null) => {
  try {
    const promotionsRef = collection(db, PROMOTIONS_COLLECTION);
    const now = Timestamp.now();
    
    let q;
    if (branchId) {
      q = query(
        promotionsRef,
        where('isActive', '==', true),
        where('startDate', '<=', now),
        where('endDate', '>=', now),
        where('branchId', 'in', [branchId, null]), // Branch-specific or global
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        promotionsRef,
        where('isActive', '==', true),
        where('startDate', '<=', now),
        where('endDate', '>=', now),
        orderBy('createdAt', 'desc')
      );
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startDate: doc.data().startDate?.toDate(),
      endDate: doc.data().endDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching active promotions:', error);
    return [];
  }
};

/**
 * Get all promotions (active and inactive)
 * @param {string} branchId - Branch ID (optional filter)
 * @returns {Promise<Array>} - All promotions
 */
export const getAllPromotions = async (branchId = null) => {
  try {
    const promotionsRef = collection(db, PROMOTIONS_COLLECTION);
    
    let q;
    if (branchId) {
      q = query(
        promotionsRef,
        where('branchId', 'in', [branchId, null]),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(promotionsRef, orderBy('createdAt', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startDate: doc.data().startDate?.toDate(),
      endDate: doc.data().endDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching promotions:', error);
    return [];
  }
};

/**
 * Update promotion
 * @param {string} promotionId - Promotion ID
 * @param {Object} updates - Fields to update
 * @param {Object} currentUser - User updating
 * @returns {Promise<void>}
 */
export const updatePromotion = async (promotionId, updates, currentUser) => {
  try {
    const promotionRef = doc(db, PROMOTIONS_COLLECTION, promotionId);
    
    const updateData = {
      ...updates,
      updatedAt: Timestamp.now()
    };
    
    // Convert dates if provided
    if (updates.startDate) {
      updateData.startDate = Timestamp.fromDate(new Date(updates.startDate));
    }
    if (updates.endDate) {
      updateData.endDate = Timestamp.fromDate(new Date(updates.endDate));
    }
    
    await updateDoc(promotionRef, updateData);
    
    // Log activity
    await logActivity({
      performedBy: currentUser?.uid || 'system',
      action: 'UPDATE_PROMOTION',
      targetType: 'promotion',
      targetId: promotionId,
      details: 'Updated promotion',
      metadata: { updates }
    });
    
    toast.success('Promotion updated successfully');
  } catch (error) {
    console.error('Error updating promotion:', error);
    toast.error('Failed to update promotion');
    throw error;
  }
};

/**
 * Delete promotion
 * @param {string} promotionId - Promotion ID
 * @param {Object} currentUser - User deleting
 * @returns {Promise<void>}
 */
export const deletePromotion = async (promotionId, currentUser) => {
  try {
    const promotionRef = doc(db, PROMOTIONS_COLLECTION, promotionId);
    await deleteDoc(promotionRef);
    
    // Log activity
    await logActivity({
      performedBy: currentUser?.uid || 'system',
      action: 'DELETE_PROMOTION',
      targetType: 'promotion',
      targetId: promotionId,
      details: 'Deleted promotion'
    });
    
    toast.success('Promotion deleted successfully');
  } catch (error) {
    console.error('Error deleting promotion:', error);
    toast.error('Failed to delete promotion');
    throw error;
  }
};

/**
 * Check if client is eligible for promotion
 * @param {string} clientId - Client ID
 * @param {string} promotionId - Promotion ID
 * @returns {Promise<boolean>} - Eligibility status
 */
export const checkPromotionEligibility = async (clientId, promotionId) => {
  try {
    const promotionRef = doc(db, PROMOTIONS_COLLECTION, promotionId);
    const promotionSnap = await getDoc(promotionRef);
    
    if (!promotionSnap.exists() || !promotionSnap.data().isActive) {
      return false;
    }
    
    const promotion = promotionSnap.data();
    const now = Timestamp.now();
    
    // Check date validity
    if (now < promotion.startDate || now > promotion.endDate) {
      return false;
    }
    
    // Check target segment (requires client segmentation)
    if (promotion.targetSegment !== 'all') {
      // This would require getClientSegmentation from clientService
      // For now, return true if segment is 'all'
      // TODO: Implement segment checking
    }
    
    return true;
  } catch (error) {
    console.error('Error checking promotion eligibility:', error);
    return false;
  }
};

/**
 * Validate and get promotion by code
 * @param {string} code - Promotion code
 * @param {string} branchId - Branch ID
 * @param {string} clientId - Client ID (optional, for one-time use validation)
 * @returns {Promise<Object>} - Promotion data or error
 */
export const validatePromotionCode = async (code, branchId, clientId = null) => {
  try {
    if (!code || !branchId) {
      return {
        success: false,
        error: 'Promotion code and branch ID are required'
      };
    }

    const codeUpper = code.trim().toUpperCase();
    
    // Find promotion by code - check both branch-specific and system-wide (branchId === null)
    const promotionsRef = collection(db, PROMOTIONS_COLLECTION);
    // First, try to find branch-specific promotion
    let q = query(
      promotionsRef,
      where('promotionCode', '==', codeUpper),
      where('branchId', '==', branchId)
    );
    
    let snapshot = await getDocs(q);
    
    // If not found, check for system-wide promotion (branchId === null)
    if (snapshot.empty) {
      q = query(
        promotionsRef,
        where('promotionCode', '==', codeUpper),
        where('branchId', '==', null)
      );
      snapshot = await getDocs(q);
    }
    
    if (snapshot.empty) {
      return {
        success: false,
        error: 'Invalid promotion code'
      };
    }

    const promotionDoc = snapshot.docs[0];
    const promotion = {
      id: promotionDoc.id,
      ...promotionDoc.data()
    };

    // Check if promotion is active
    if (!promotion.isActive) {
      return {
        success: false,
        error: 'This promotion is not active'
      };
    }

    // Check date validity
    const now = new Date();
    const startDate = promotion.startDate?.toDate ? promotion.startDate.toDate() : new Date(promotion.startDate);
    const endDate = promotion.endDate?.toDate ? promotion.endDate.toDate() : new Date(promotion.endDate);

    if (now < startDate) {
      return {
        success: false,
        error: `This promotion starts on ${startDate.toLocaleDateString()}`
      };
    }

    if (now > endDate) {
      return {
        success: false,
        error: 'This promotion has expired'
      };
    }

    // Check one-time use
    if (promotion.usageType === 'one-time') {
      if (!clientId) {
        return {
          success: false,
          error: 'Client ID is required for one-time use promotions'
        };
      }

      const usedBy = promotion.usedBy || [];
      if (usedBy.includes(clientId)) {
        return {
          success: false,
          error: 'You have already used this promotion'
        };
      }
    }

    // Check max uses for repeating promotions
    if (promotion.usageType === 'repeating' && promotion.maxUses) {
      const usageCount = promotion.usageCount || 0;
      if (usageCount >= promotion.maxUses) {
        return {
          success: false,
          error: 'This promotion has reached its maximum usage limit'
        };
      }
    }

    // Convert Firestore timestamps to dates
    return {
      success: true,
      promotion: {
        ...promotion,
        startDate: startDate,
        endDate: endDate
      }
    };
  } catch (error) {
    console.error('Error validating promotion code:', error);
    return {
      success: false,
      error: 'Failed to validate promotion code'
    };
  }
};

/**
 * Calculate promotion discount
 * @param {Object} promotion - Promotion data
 * @param {number} subtotal - Transaction subtotal
 * @param {Array} services - Services in transaction
 * @param {Array} products - Products in transaction
 * @returns {Object} - Discount details
 */
export const calculatePromotionDiscount = (promotion, subtotal, services = [], products = []) => {
  if (!promotion || !promotion.isActive) {
    return { discountAmount: 0, applicableItems: [] };
  }

  let applicableSubtotal = subtotal;

  // Check if promotion applies to specific services/products
  if (promotion.applicableTo === 'services') {
    // Only apply to services
    applicableSubtotal = services.reduce((sum, service) => {
      const serviceId = service.id || service.serviceId;
      if (promotion.specificServices && promotion.specificServices.length > 0) {
        if (promotion.specificServices.includes(serviceId)) {
          return sum + (service.price || service.adjustedPrice || 0);
        }
      } else {
        // Apply to all services
        return sum + (service.price || service.adjustedPrice || 0);
      }
      return sum;
    }, 0);
  } else if (promotion.applicableTo === 'products') {
    // Only apply to products
    applicableSubtotal = products.reduce((sum, product) => {
      const productId = product.id || product.productId;
      if (promotion.specificProducts && promotion.specificProducts.length > 0) {
        if (promotion.specificProducts.includes(productId)) {
          return sum + (product.price || 0);
        }
      } else {
        // Apply to all products
        return sum + (product.price || 0);
      }
      return sum;
    }, 0);
  } else if (promotion.applicableTo === 'specific') {
    // Apply to specific services/products only
    applicableSubtotal = 0;
    
    // Check services
    if (promotion.specificServices && promotion.specificServices.length > 0) {
      services.forEach(service => {
        const serviceId = service.id || service.serviceId;
        if (promotion.specificServices.includes(serviceId)) {
          applicableSubtotal += (service.price || service.adjustedPrice || 0);
        }
      });
    }
    
    // Check products
    if (promotion.specificProducts && promotion.specificProducts.length > 0) {
      products.forEach(product => {
        const productId = product.id || product.productId;
        if (promotion.specificProducts.includes(productId)) {
          applicableSubtotal += (product.price || 0);
        }
      });
    }
  }

  // Calculate discount
  let discountAmount = 0;
  if (promotion.discountType === 'percentage') {
    discountAmount = (applicableSubtotal * promotion.discountValue) / 100;
  } else if (promotion.discountType === 'fixed') {
    discountAmount = Math.min(promotion.discountValue, applicableSubtotal);
  }

  return {
    discountAmount: Math.round(discountAmount * 100) / 100, // Round to 2 decimal places
    applicableSubtotal
  };
};

/**
 * Track promotion usage
 * @param {string} promotionId - Promotion ID
 * @param {string} clientId - Client ID (for one-time use)
 * @returns {Promise<void>}
 */
export const trackPromotionUsage = async (promotionId, clientId = null) => {
  try {
    const promotionRef = doc(db, PROMOTIONS_COLLECTION, promotionId);
    const promotionSnap = await getDoc(promotionRef);
    
    if (!promotionSnap.exists()) {
      throw new Error('Promotion not found');
    }

    const promotion = promotionSnap.data();
    const updates = {
      updatedAt: Timestamp.now()
    };

    if (promotion.usageType === 'one-time' && clientId) {
      // Add client to usedBy array
      updates.usedBy = arrayUnion(clientId);
    } else if (promotion.usageType === 'repeating') {
      // Increment usage count
      updates.usageCount = increment(1);
    }

    await updateDoc(promotionRef, updates);
  } catch (error) {
    console.error('Error tracking promotion usage:', error);
    throw error;
  }
};
