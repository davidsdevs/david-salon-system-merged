// src/services/depositService.js
import { db } from '../config/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  query, 
  where, 
  getDocs, 
  orderBy, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

class DepositService {
  constructor() {
    this.collection = 'deposits';
  }

  /**
   * Create a new deposit submission
   * @param {Object} depositData - Deposit data including receipt image
   * @returns {Promise<string>} - Deposit ID
   */
  async createDeposit(depositData) {
    try {
      const depositRef = await addDoc(collection(db, this.collection), {
        branchId: depositData.branchId,
        depositDate: depositData.depositDate ? Timestamp.fromDate(new Date(depositData.depositDate)) : serverTimestamp(),
        amount: Number(depositData.amount) || 0,
        receiptImageUrl: depositData.receiptImageUrl || '',
        receiptImagePath: depositData.receiptImagePath || '',
        ocrExtractedAmount: depositData.ocrExtractedAmount || null,
        ocrConfidence: depositData.ocrConfidence || null,
        dailySalesTotal: depositData.dailySalesTotal || 0,
        totalExpenses: depositData.totalExpenses || 0,
        expenses: depositData.expenses || [],
        difference: depositData.difference || 0,
        validationStatus: depositData.validationStatus || 'pending', // 'pending', 'match', 'mismatch', 'manual_review'
        hasAnomaly: depositData.hasAnomaly || false,
        anomalyDescription: depositData.anomalyDescription || null,
        status: 'submitted', // 'submitted', 'approved', 'rejected'
        submittedBy: depositData.submittedBy,
        submittedByName: depositData.submittedByName,
        submittedAt: serverTimestamp(),
        notes: depositData.notes || '',
        bankName: depositData.bankName || '',
        accountNumber: depositData.accountNumber || '',
        referenceNumber: depositData.referenceNumber || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return depositRef.id;
    } catch (error) {
      console.error('Error creating deposit:', error);
      throw new Error('Failed to create deposit submission');
    }
  }

  /**
   * Get daily sales total for a branch on a specific date
   * @param {string} branchId - Branch ID
   * @param {Date} date - Date to check
   * @returns {Promise<number>} - Total sales amount
   */
  async getDailySalesTotal(branchId, date) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Convert to Firestore Timestamps for querying
      const startTimestamp = Timestamp.fromDate(startOfDay);
      const endTimestamp = Timestamp.fromDate(endOfDay);

      // Query transactions for the branch and date range
      // Include both 'paid' and 'completed' statuses (some systems use different status names)
      const q = query(
        collection(db, 'transactions'),
        where('branchId', '==', branchId),
        where('createdAt', '>=', startTimestamp),
        where('createdAt', '<=', endTimestamp)
      );

      const snapshot = await getDocs(q);
      let totalSales = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const status = (data.status || '').toLowerCase();
        
        // Include all transactions except voided, cancelled, or refunded
        // Include: 'paid', 'completed', 'in_service' (all represent sales)
        // Exclude: 'voided', 'cancelled', 'refunded'
        if (status !== 'voided' && status !== 'cancelled' && status !== 'refunded') {
          // Use the 'total' field from the transaction
          const transactionTotal = Number(data.total || data.totalAmount || 0);
          totalSales += transactionTotal;
        }
      });

      return totalSales;
    } catch (error) {
      console.error('Error getting daily sales total:', error);
      throw new Error('Failed to get daily sales total');
    }
  }

  /**
   * Validate deposit amount against daily sales
   * @param {number} depositAmount - Amount from receipt
   * @param {number} dailySalesTotal - Total sales for the day
   * @param {number} tolerance - Allowed difference (default 1 peso)
   * @returns {Object} - Validation result
   */
  validateDepositAmount(depositAmount, dailySalesTotal, tolerance = 1) {
    const difference = Math.abs(depositAmount - dailySalesTotal);
    const isMatch = difference <= tolerance;
    
    return {
      isValid: isMatch,
      difference: depositAmount - dailySalesTotal,
      status: isMatch ? 'match' : (difference > 100 ? 'mismatch' : 'manual_review'),
      message: isMatch 
        ? 'Amount matches daily sales'
        : difference > 100
        ? `Significant difference: ₱${difference.toFixed(2)}`
        : `Minor difference: ₱${difference.toFixed(2)} - requires review`
    };
  }

  /**
   * Get deposits for a branch
   * @param {string} branchId - Branch ID
   * @returns {Promise<Array>} - Array of deposits
   */
  async getBranchDeposits(branchId) {
    try {
      if (!branchId) {
        throw new Error('Branch ID is required');
      }

      // Query without orderBy to avoid composite index requirement
      // We'll sort client-side instead
      const q = query(
        collection(db, this.collection),
        where('branchId', '==', branchId)
      );

      const snapshot = await getDocs(q);
      const deposits = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        deposits.push({
          id: doc.id,
          ...data,
          depositDate: data.depositDate?.toDate ? data.depositDate.toDate() : new Date(data.depositDate),
          submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : (data.submittedAt ? new Date(data.submittedAt) : new Date()),
          reviewedAt: data.reviewedAt?.toDate ? data.reviewedAt.toDate() : (data.reviewedAt ? new Date(data.reviewedAt) : null),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date())
        });
      });

      // Sort by submittedAt descending (most recent first)
      deposits.sort((a, b) => {
        const aTime = a.submittedAt?.getTime() || 0;
        const bTime = b.submittedAt?.getTime() || 0;
        return bTime - aTime;
      });

      return deposits;
    } catch (error) {
      console.error('Error getting branch deposits:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      // Provide more specific error message
      if (error.code === 'permission-denied') {
        throw new Error('Permission denied: You do not have access to view deposits');
      } else if (error.code === 'failed-precondition') {
        throw new Error('Database index required. Please contact administrator.');
      } else if (error.message) {
        throw new Error(`Failed to get deposits: ${error.message}`);
      } else {
        throw new Error('Failed to get deposits. Please try again or contact support.');
      }
    }
  }

  /**
   * Get all deposits (for Operational Manager)
   * @returns {Promise<Array>} - Array of all deposits
   */
  async getAllDeposits() {
    try {
      // Query all deposits without orderBy to avoid index requirement
      // We'll sort client-side
      const q = query(
        collection(db, this.collection)
      );

      const snapshot = await getDocs(q);
      const deposits = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        deposits.push({
          id: doc.id,
          ...data,
          depositDate: data.depositDate?.toDate ? data.depositDate.toDate() : new Date(data.depositDate),
          submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : (data.submittedAt ? new Date(data.submittedAt) : new Date()),
          reviewedAt: data.reviewedAt?.toDate ? data.reviewedAt.toDate() : (data.reviewedAt ? new Date(data.reviewedAt) : null),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date())
        });
      });

      // Sort by submittedAt descending (most recent first)
      deposits.sort((a, b) => {
        const aTime = a.submittedAt?.getTime() || 0;
        const bTime = b.submittedAt?.getTime() || 0;
        return bTime - aTime;
      });

      return deposits;
    } catch (error) {
      console.error('Error getting all deposits:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      // Provide more specific error message
      if (error.code === 'permission-denied') {
        throw new Error('Permission denied: You do not have access to view deposits');
      } else if (error.code === 'failed-precondition') {
        throw new Error('Database index required. Please contact administrator.');
      } else if (error.message) {
        throw new Error(`Failed to get deposits: ${error.message}`);
      } else {
        throw new Error('Failed to get deposits. Please try again or contact support.');
      }
    }
  }

  /**
   * Get a single deposit by ID
   * @param {string} depositId - Deposit ID
   * @returns {Promise<Object>} - Deposit data
   */
  async getDepositById(depositId) {
    try {
      const depositRef = doc(db, this.collection, depositId);
      const depositSnap = await getDoc(depositRef);

      if (!depositSnap.exists()) {
        throw new Error('Deposit not found');
      }

      const data = depositSnap.data();
      return {
        id: depositSnap.id,
        ...data,
        depositDate: data.depositDate?.toDate ? data.depositDate.toDate() : new Date(data.depositDate),
        submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt),
        reviewedAt: data.reviewedAt?.toDate ? data.reviewedAt.toDate() : (data.reviewedAt ? new Date(data.reviewedAt) : null),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
      };
    } catch (error) {
      console.error('Error getting deposit:', error);
      throw new Error('Failed to get deposit');
    }
  }

  /**
   * Approve or reject a deposit
   * @param {string} depositId - Deposit ID
   * @param {string} action - 'approve' or 'reject'
   * @param {Object} reviewData - Review data including reviewer info and notes
   * @returns {Promise<void>}
   */
  async reviewDeposit(depositId, action, reviewData) {
    try {
      const depositRef = doc(db, this.collection, depositId);
      
      await updateDoc(depositRef, {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewedBy: reviewData.reviewedBy,
        reviewedByName: reviewData.reviewedByName,
        reviewedAt: serverTimestamp(),
        reviewNotes: reviewData.notes || '',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error reviewing deposit:', error);
      throw new Error('Failed to review deposit');
    }
  }
}

export const depositService = new DepositService();

