/**
 * Branch Services Service
 * Manages services available at each branch
 * 
 * NEW MODEL:
 * - Single 'services' collection with global service info
 * - branchPricing field: { [branchId]: price } (direct price values)
 * - Branch offers service if branchPricing[branchId] exists
 * - Branch stops offering by deleting branchPricing[branchId]
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { logActivity } from './activityService';
import { getFullName } from '../utils/helpers';
import toast from 'react-hot-toast';

/**
 * Get all services offered by a branch (those with branchPricing[branchId] defined)
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of services with branch pricing
 */
export const getBranchServices = async (branchId) => {
  try {
    const servicesRef = collection(db, 'services');
    // Get all active global services
    const q = query(
      servicesRef,
      where('isActive', '==', true),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    
    // Filter to only those offered by this branch (has branchPricing[branchId])
    return snapshot.docs
      .filter(doc => {
        const data = doc.data();
        return data.branchPricing && data.branchPricing[branchId] !== undefined;
      })
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Include branch-specific price at top level for convenience
          price: data.branchPricing[branchId]
        };
      });
  } catch (error) {
    console.error('Error fetching branch services:', error);
    throw error;
  }
};

/**
 * Get all global services with branch configuration
 * Used by branch manager to see all services and configure which ones to offer
 * @param {string} branchId - Branch ID
 * @returns {Promise<Array>} Array of all services with branch config
 */
export const getAllServicesWithBranchConfig = async (branchId) => {
  try {
    const servicesRef = collection(db, 'services');
    const q = query(
      servicesRef,
      where('isActive', '==', true),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      const branchPrice = data.branchPricing?.[branchId];
      return {
        id: doc.id,
        ...data,
        // Include branch price if configured, otherwise null
        price: branchPrice || null,
        isOfferedByBranch: branchPrice !== undefined
      };
    });
  } catch (error) {
    console.error('Error fetching all services with branch config:', error);
    throw error;
  }
};

/**
 * Set or update branch price for a service
 * Creates branchPricing[branchId] entry if it doesn't exist
 * @param {string} serviceId - Service ID
 * @param {string} branchId - Branch ID
 * @param {number} price - Price for this branch
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<void>}
 */
export const setBranchPrice = async (serviceId, branchId, price, currentUser) => {
  try {
    const serviceRef = doc(db, 'services', serviceId);
    
    // Get current service to preserve other branchPricing
    const serviceDoc = await getDoc(serviceRef);
    if (!serviceDoc.exists()) {
      throw new Error('Service not found');
    }
    
    const currentData = serviceDoc.data();
    const branchPricing = currentData.branchPricing || {};
    const oldPrice = branchPricing[branchId];
    
    // Convert prices to numbers for proper comparison
    const oldPriceNum = (oldPrice !== undefined && oldPrice !== null) ? parseFloat(oldPrice) : null;
    const newPriceNum = parseFloat(price);
    
    // Validate new price
    if (isNaN(newPriceNum) || newPriceNum < 0) {
      throw new Error('Invalid price value');
    }
    
    // Track history if price actually changed (including first-time price setting)
    // Use a small epsilon for floating point comparison
    const EPSILON = 0.01;
    const priceChanged = oldPriceNum === null || oldPriceNum === undefined || Math.abs(oldPriceNum - newPriceNum) > EPSILON;
    
    if (priceChanged) {
      try {
        // Record price change history in services_price_history collection
        const priceHistoryRef = collection(db, 'services_price_history');
        
        // Get user display name - fetch from Firestore to ensure we have full name
        let changedByName = 'Unknown';
        let changedByUid = currentUser?.uid || currentUser?.id;
        
        if (changedByUid) {
          try {
            // Fetch user data from Firestore to get full name
            const userDoc = await getDoc(doc(db, 'users', changedByUid));
            if (userDoc.exists()) {
              const userDocData = userDoc.data();
              changedByName = getFullName(userDocData) || userDocData.email || 'Unknown';
            } else if (currentUser?.displayName) {
              changedByName = currentUser.displayName;
            } else if (currentUser?.email) {
              changedByName = currentUser.email;
            }
          } catch (fetchError) {
            console.warn('Could not fetch user name from Firestore, using fallback:', fetchError);
            // Fallback to available data
            if (currentUser?.displayName) {
              changedByName = currentUser.displayName;
            } else if (currentUser?.firstName) {
              changedByName = `${currentUser.firstName} ${currentUser.lastName || ''}`.trim();
            } else if (currentUser?.email) {
              changedByName = currentUser.email;
            }
          }
        }
        
        const historyData = {
          serviceId,
          serviceName: currentData.name || currentData.serviceName,
          branchId,
          oldPrice: (oldPriceNum !== null && oldPriceNum !== undefined && !isNaN(oldPriceNum)) ? oldPriceNum : 0,
          newPrice: newPriceNum,
          changedBy: changedByUid || currentUser?.uid || currentUser?.id,
          changedByName: changedByName,
          changedAt: Timestamp.now(),
          createdAt: Timestamp.now()
        };
        
        const historyDocRef = await addDoc(priceHistoryRef, historyData);
        console.log('Price history saved to services_price_history:', { 
          historyId: historyDocRef.id,
          serviceId, 
          serviceName: historyData.serviceName,
          branchId, 
          oldPrice: historyData.oldPrice, 
          newPrice: historyData.newPrice,
          changedBy: historyData.changedByName
        });
      } catch (historyError) {
        // Log error but don't fail the price update
        console.error('Error saving price history (continuing with price update):', historyError);
        toast.error('Price updated but failed to save history. Please check console.');
      }
    } else {
      console.log('Price history not saved - no change detected:', { 
        serviceId, 
        branchId, 
        oldPrice: oldPriceNum, 
        newPrice: newPriceNum,
        difference: oldPriceNum !== null ? Math.abs(oldPriceNum - newPriceNum) : 'N/A'
      });
    }
    
    // Update or add this branch's price (direct value) - store as number
    branchPricing[branchId] = newPriceNum;
    
    await updateDoc(serviceRef, {
      branchPricing,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    });
    
    // Log activity
    await logActivity({
      action: 'branch_service_price_set',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        branchId,
        serviceId,
        serviceName: currentData.name,
        price
      }
    });
    
    toast.success('Service price set successfully!');
  } catch (error) {
    console.error('Error setting branch price:', error);
    toast.error('Failed to set service price');
    throw error;
  }
};

/**
 * Disable a service for a branch (remove from branchPricing)
 * @param {string} serviceId - Service ID
 * @param {string} branchId - Branch ID
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<void>}
 */
export const disableBranchService = async (serviceId, branchId, currentUser) => {
  try {
    const serviceRef = doc(db, 'services', serviceId);
    
    // Get current service
    const serviceDoc = await getDoc(serviceRef);
    if (!serviceDoc.exists()) {
      throw new Error('Service not found');
    }
    
    const currentData = serviceDoc.data();
    const branchPricing = currentData.branchPricing || {};
    
    // Remove this branch from branchPricing
    delete branchPricing[branchId];
    
    await updateDoc(serviceRef, {
      branchPricing,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    });
    
    // Log activity
    await logActivity({
      action: 'branch_service_disabled',
      performedBy: currentUser.uid,
      targetUser: null,
      details: {
        branchId,
        serviceId,
        serviceName: currentData.name
      }
    });
    
    toast.success('Service disabled for this branch!');
  } catch (error) {
    console.error('Error disabling branch service:', error);
    toast.error('Failed to disable service');
    throw error;
  }
};


/**
 * Get a single service by ID
 * @param {string} serviceId - Service ID
 * @returns {Promise<Object>} Service data
 */
export const getServiceById = async (serviceId) => {
  try {
    const serviceRef = doc(db, 'services', serviceId);
    const serviceDoc = await getDoc(serviceRef);
    
    if (!serviceDoc.exists()) {
      throw new Error('Service not found');
    }
    
    return {
      id: serviceDoc.id,
      ...serviceDoc.data()
    };
  } catch (error) {
    console.error('Error fetching service:', error);
    throw error;
  }
};


/**
 * Get service categories
 * @returns {Array<string>} Array of service categories
 */
export const getServiceCategories = () => {
  return [
    'Haircut and Blowdry',
    'Hair Coloring',
    'Straightening & Forming',
    'Hair & Make Up',
    'Hair Treatment',
    'Nail Care / Waxing / Threading'
  ];
};
