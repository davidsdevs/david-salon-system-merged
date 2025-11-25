/**
 * Catalog Service
 * Manages branch-specific catalog configurations (layout, icons, ordering)
 */

import { 
  doc, 
  getDoc, 
  setDoc, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import toast from 'react-hot-toast';

/**
 * Get catalog configuration for a branch
 * @param {string} branchId - Branch ID
 * @returns {Promise<Object|null>} Catalog configuration or null
 */
export const getCatalogConfig = async (branchId) => {
  try {
    const configRef = doc(db, 'branchCatalogConfig', branchId);
    const configDoc = await getDoc(configRef);
    
    if (configDoc.exists()) {
      return configDoc.data();
    }
    return null;
  } catch (error) {
    console.error('Error fetching catalog config:', error);
    return null;
  }
};

/**
 * Save catalog configuration for a branch
 * @param {string} branchId - Branch ID
 * @param {Object} config - Catalog configuration
 * @param {Object} currentUser - User performing the action
 * @returns {Promise<void>}
 */
export const saveCatalogConfig = async (branchId, config, currentUser) => {
  try {
    const configRef = doc(db, 'branchCatalogConfig', branchId);
    
    await setDoc(configRef, {
      ...config,
      branchId,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    }, { merge: true });
    
    toast.success('Catalog configuration saved successfully!');
  } catch (error) {
    console.error('Error saving catalog config:', error);
    toast.error('Failed to save catalog configuration');
    throw error;
  }
};















