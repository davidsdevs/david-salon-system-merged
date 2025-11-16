/**
 * Referral Program Service
 * Module: M06 - CRM
 * Handles referral codes, tracking, and rewards
 */

import { 
  collection, 
  doc, 
  getDoc,
  updateDoc,
  setDoc,
  query, 
  where,
  getDocs,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import toast from 'react-hot-toast';
import { logActivity } from './activityService';
import { earnLoyaltyPoints } from './loyaltyService';

const CLIENTS_COLLECTION = 'clients';
const USERS_COLLECTION = 'users';
const REFERRAL_CODES_COLLECTION = 'referral_codes'; // For storing referral codes: referral_codes/{clientId} with branchCodes map
const REFERRALS_COLLECTION = 'referrals'; // For storing referral records: referrals/{clientId} with branchReferrals map

// Default referral rewards (can be configured by System Admin)
const DEFAULT_REFERRER_REWARD = 50; // Points for referrer (branch-specific)
const DEFAULT_REFERRED_REWARD = 25; // Points for new client (branch-specific)

/**
 * Check if client has visited a branch (has transactions at that branch)
 * @param {string} clientId - Client ID
 * @param {string} branchId - Branch ID
 * @returns {Promise<boolean>} - True if client has visited the branch
 */
const hasVisitedBranch = async (clientId, branchId) => {
  try {
    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      where('clientId', '==', clientId),
      where('branchId', '==', branchId),
      where('status', '==', 'paid'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking branch visit:', error);
    return false;
  }
};

/**
 * Get referral code for a client at a specific branch
 * Code is only generated/returned if client has visited that branch
 * @param {string} clientId - Client ID
 * @param {string} branchId - Branch ID (required)
 * @returns {Promise<string|null>} - Referral code for the branch, or null if not eligible
 */
export const getReferralCode = async (clientId, branchId) => {
  try {
    if (!branchId) {
      console.warn('⚠️ branchId is required for getReferralCode');
      return null;
    }

    // Check if client has visited this branch
    const hasVisited = await hasVisitedBranch(clientId, branchId);
    if (!hasVisited) {
      console.log(`⚠️ Client ${clientId} has not visited branch ${branchId} - cannot generate referral code`);
      return null;
    }

    // Get or create referral codes document (in referral_codes collection)
    const referralCodesRef = doc(db, REFERRAL_CODES_COLLECTION, clientId);
    const referralCodesSnap = await getDoc(referralCodesRef);
    
    let branchCodes = {};
    if (referralCodesSnap.exists()) {
      branchCodes = referralCodesSnap.data().branchCodes || {};
    }
    
    // If code exists for this branch, return it
    if (branchCodes[branchId]) {
      return branchCodes[branchId];
    }
    
    // Generate new code for this branch
    const code = generateReferralCode(clientId, branchId);
    branchCodes[branchId] = code;
    
    // Save to referral_codes collection
    await setDoc(referralCodesRef, {
      clientId,
      branchCodes,
      updatedAt: Timestamp.now()
    }, { merge: true });
    
    console.log(`✅ Generated referral code for client ${clientId} at branch ${branchId}: ${code}`);
    return code;
  } catch (error) {
    console.error('Error getting referral code:', error);
    return null;
  }
};

/**
 * Get all referral codes for a client (all branches they've visited)
 * @param {string} clientId - Client ID
 * @returns {Promise<Array>} - Array of { branchId, referralCode }
 */
export const getAllReferralCodes = async (clientId) => {
  try {
    const referralCodesRef = doc(db, REFERRAL_CODES_COLLECTION, clientId);
    const referralCodesSnap = await getDoc(referralCodesRef);
    
    if (!referralCodesSnap.exists()) {
      return [];
    }
    
    const branchCodes = referralCodesSnap.data().branchCodes || {};
    return Object.entries(branchCodes).map(([branchId, referralCode]) => ({
      branchId,
      referralCode
    }));
  } catch (error) {
    console.error('Error getting all referral codes:', error);
    return [];
  }
};

/**
 * Validate referral code (check if it exists and is valid)
 * @param {string} referralCode - Referral code to validate
 * @returns {Promise<Object>} - Validation result with referrerId and branchId if valid
 */
export const validateReferralCode = async (referralCode) => {
  try {
    if (!referralCode || !referralCode.trim()) {
      return { valid: false, message: 'No referral code provided' };
    }
    
    // Find referrer by code in referral_codes collection (branch-specific codes)
    const referralCodesCollectionRef = collection(db, REFERRAL_CODES_COLLECTION);
    const snapshot = await getDocs(referralCodesCollectionRef);
    
    let referrerId = null;
    let codeBranchId = null;
    
    // Search through all referral codes to find matching code
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const branchCodes = data.branchCodes || {};
      
      // Check each branch's code
      for (const [refBranchId, code] of Object.entries(branchCodes)) {
        if (code === referralCode.toUpperCase().trim()) {
          referrerId = data.clientId;
          codeBranchId = refBranchId;
          break;
        }
      }
      
      if (referrerId) break;
    }
    
    if (!referrerId) {
      return { valid: false, message: 'Invalid referral code' };
    }
    
    return {
      valid: true,
      referrerId,
      branchId: codeBranchId,
      message: 'Referral code is valid'
    };
  } catch (error) {
    console.error('Error validating referral code:', error);
    return { valid: false, message: 'Error validating referral code' };
  }
};

/**
 * Process referral when new client registers (branch-specific rewards)
 * @param {string} newClientId - New client ID
 * @param {string} referralCode - Referral code used
 * @param {string} branchId - Branch ID where registration/referral happens (optional, auto-detected if not provided)
 * @param {Object} currentUser - User processing registration
 * @returns {Promise<Object>} - Referral processing result
 */
export const processReferral = async (newClientId, referralCode, branchId = null, currentUser) => {
  try {
    if (!referralCode || !referralCode.trim()) {
      return { success: false, message: 'No referral code provided' };
    }
    
    // Find referrer by code in referral_codes collection (branch-specific codes)
    const referralCodesCollectionRef = collection(db, REFERRAL_CODES_COLLECTION);
    const snapshot = await getDocs(referralCodesCollectionRef);
    
    let referrerId = null;
    let codeBranchId = null;
    
    // Search through all referral codes to find matching code
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const branchCodes = data.branchCodes || {};
      
      // Check each branch's code
      for (const [refBranchId, code] of Object.entries(branchCodes)) {
        if (code === referralCode.toUpperCase().trim()) {
          referrerId = data.clientId;
          codeBranchId = refBranchId;
          break;
        }
      }
      
      if (referrerId) break;
    }
    
    if (!referrerId) {
      return { success: false, message: 'Invalid referral code' };
    }
    
    // Use branch ID from referral code if not provided
    const finalBranchId = branchId || codeBranchId;
    
    // Verify the referral code is for the correct branch (if branchId was provided)
    if (branchId && codeBranchId !== branchId) {
      return { success: false, message: `This referral code is for a different branch. Please use a referral code for the correct branch.` };
    }
    
    // Prevent self-referral
    if (referrerId === newClientId) {
      return { success: false, message: 'Cannot refer yourself' };
    }
    
    // Check if this referral was already processed for this branch (fraud prevention)
    const newClientReferralsRef = doc(db, REFERRALS_COLLECTION, newClientId);
    const newClientReferralsSnap = await getDoc(newClientReferralsRef);
    
    if (newClientReferralsSnap.exists()) {
      const branchReferrals = newClientReferralsSnap.data().branchReferrals || {};
      if (branchReferrals[finalBranchId] && branchReferrals[finalBranchId].referredBy === referrerId) {
        return { success: false, message: 'Referral already processed for this branch' };
      }
    }
    
    // Update new client profile (create if doesn't exist)
    const newClientRef = doc(db, CLIENTS_COLLECTION, newClientId);
    const newClientSnap = await getDoc(newClientRef);
    
    if (!newClientSnap.exists()) {
      await setDoc(newClientRef, {
        clientId: newClientId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    }
    
    // Store branch-specific referral record
    const referralsData = newClientReferralsSnap.exists() ? newClientReferralsSnap.data() : { clientId: newClientId, branchReferrals: {} };
    const branchReferrals = referralsData.branchReferrals || {};
    
    branchReferrals[finalBranchId] = {
      referredBy: referrerId,
      referralCode: referralCode.toUpperCase().trim(),
      processedAt: Timestamp.now(),
      processedBy: currentUser?.uid || 'system'
    };
    
    await setDoc(newClientReferralsRef, {
      ...referralsData,
      branchReferrals,
      updatedAt: Timestamp.now()
    }, { merge: true });
    
    // Reward new client at the branch where they registered (branch-specific)
    try {
      await earnLoyaltyPoints(
        newClientId,
        finalBranchId,
        DEFAULT_REFERRED_REWARD, // Use amount as points directly
        null, // No billId for referral reward
        currentUser,
        1 // 1 point per peso (direct points, not based on amount)
      );
      console.log(`✅ Awarded ${DEFAULT_REFERRED_REWARD} points to new client ${newClientId} at branch ${finalBranchId}`);
    } catch (error) {
      console.error('Error awarding points to new client:', error);
      // Continue even if points award fails
    }
    
    // Reward referrer at the same branch (branch-specific)
    try {
      await earnLoyaltyPoints(
        referrerId,
        finalBranchId,
        DEFAULT_REFERRER_REWARD, // Use amount as points directly
        null, // No billId for referral reward
        currentUser,
        1 // 1 point per peso (direct points, not based on amount)
      );
      console.log(`✅ Awarded ${DEFAULT_REFERRER_REWARD} points to referrer ${referrerId} at branch ${finalBranchId}`);
    } catch (error) {
      console.error('Error awarding points to referrer:', error);
      // Continue even if points award fails
    }
    
    // Log activity
    await logActivity({
      performedBy: currentUser?.uid || 'system',
      action: 'PROCESS_REFERRAL',
      targetType: 'client',
      targetId: newClientId,
      details: `New client registered with referral code from ${referrerId} at branch ${finalBranchId}`,
      metadata: { referrerId, referralCode, branchId: finalBranchId }
    });
    
    toast.success('Referral processed successfully! Both clients received rewards at this branch.');
    
    return {
      success: true,
      message: 'Referral processed successfully',
      referrerReward: DEFAULT_REFERRER_REWARD,
      referredReward: DEFAULT_REFERRED_REWARD,
      branchId: finalBranchId
    };
  } catch (error) {
    console.error('Error processing referral:', error);
    toast.error('Failed to process referral');
    return { success: false, message: error.message };
  }
};

/**
 * Get referral statistics for a client (branch-specific)
 * @param {string} clientId - Client ID
 * @param {string} branchId - Optional branch ID to filter by
 * @returns {Promise<Object>} - Referral stats
 */
export const getReferralStats = async (clientId, branchId = null) => {
  try {
    // Query referrals collection to find clients referred by this client
    const referralsRef = collection(db, REFERRALS_COLLECTION);
    const snapshot = await getDocs(referralsRef);
    
    const allReferrals = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const branchReferrals = data.branchReferrals || {};
      
      // Check each branch's referrals
      Object.entries(branchReferrals).forEach(([refBranchId, referralData]) => {
        // If branchId filter is provided, only include that branch
        if (branchId && refBranchId !== branchId) {
          return;
        }
        
        // If this referral was made by our client
        if (referralData.referredBy === clientId) {
          allReferrals.push({
            id: doc.id,
            clientId: data.clientId,
            branchId: refBranchId,
            referralCode: referralData.referralCode,
            processedAt: referralData.processedAt?.toDate()
          });
        }
      });
    });
    
    return {
      totalReferrals: allReferrals.length,
      referrals: allReferrals
    };
  } catch (error) {
    console.error('Error getting referral stats:', error);
    return { totalReferrals: 0, referrals: [] };
  }
};

/**
 * Generate unique referral code for a branch
 * @param {string} clientId - Client ID
 * @param {string} branchId - Branch ID
 * @returns {string} - Referral code
 */
const generateReferralCode = (clientId, branchId) => {
  // Use first 4 chars of clientId + first 4 chars of branchId + random 2 chars
  const clientPrefix = clientId.substring(0, 4).toUpperCase();
  const branchPrefix = branchId.substring(0, 4).toUpperCase();
  const random = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `${clientPrefix}${branchPrefix}${random}`;
};

