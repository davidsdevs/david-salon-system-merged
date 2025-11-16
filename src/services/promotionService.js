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
  Timestamp
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
      type: promotionData.type || 'discount', // 'discount', 'points', 'free_service'
      discountType: promotionData.discountType || 'percentage', // 'percentage' or 'fixed'
      discountValue: promotionData.discountValue || 0,
      // Targeting
      branchId: promotionData.branchId || null, // null = all branches
      targetSegment: promotionData.targetSegment || 'all', // 'all', 'bronze', 'silver', 'gold', 'platinum'
      applicableServices: promotionData.applicableServices || [], // Empty = all services
      // Validity
      startDate: Timestamp.fromDate(new Date(promotionData.startDate)),
      endDate: Timestamp.fromDate(new Date(promotionData.endDate)),
      // Status
      isActive: true,
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
