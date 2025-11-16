/**
 * Feedback & Ratings Service
 * Module: M06 - CRM
 * Handles client feedback collection and analysis
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
  limit as firestoreLimit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import toast from 'react-hot-toast';
import { logActivity } from './activityService';

const FEEDBACK_COLLECTION = 'feedback';

/**
 * Submit feedback for an appointment
 * @param {Object} feedbackData - Feedback information
 * @returns {Promise<string>} - Feedback ID
 */
export const submitFeedback = async (feedbackData) => {
  try {
    const feedbackRef = collection(db, FEEDBACK_COLLECTION);
    
    const feedback = {
      clientId: feedbackData.clientId,
      clientName: feedbackData.clientName || '',
      appointmentId: feedbackData.appointmentId,
      billId: feedbackData.billId || null,
      branchId: feedbackData.branchId,
      branchName: feedbackData.branchName || '',
      stylistId: feedbackData.stylistId || null,
      stylistName: feedbackData.stylistName || '',
      // Ratings (1-5 scale)
      overallRating: feedbackData.overallRating || 0,
      stylistRating: feedbackData.stylistRating || 0,
      serviceRating: feedbackData.serviceRating || 0,
      // Comments
      comments: feedbackData.comments || '',
      // Additional feedback
      wouldRecommend: feedbackData.wouldRecommend || false,
      visitAgain: feedbackData.visitAgain || false,
      // Metadata
      submittedAt: Timestamp.now(),
      createdAt: Timestamp.now()
    };
    
    const docRef = await addDoc(feedbackRef, feedback);
    
    // Log activity
    await logActivity({
      performedBy: feedbackData.clientId,
      action: 'SUBMIT_FEEDBACK',
      targetType: 'appointment',
      targetId: feedbackData.appointmentId,
      details: `Client submitted feedback with ${feedback.overallRating} star rating`,
      metadata: { 
        branchId: feedbackData.branchId,
        stylistId: feedbackData.stylistId,
        overallRating: feedback.overallRating
      }
    });
    
    toast.success('Thank you for your feedback!');
    return docRef.id;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    toast.error('Failed to submit feedback');
    throw error;
  }
};

/**
 * Get feedback for a specific appointment
 * @param {string} appointmentId - Appointment ID
 * @returns {Promise<Object|null>} - Feedback data
 */
export const getFeedbackByAppointment = async (appointmentId) => {
  try {
    const feedbackRef = collection(db, FEEDBACK_COLLECTION);
    const q = query(feedbackRef, where('appointmentId', '==', appointmentId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      submittedAt: doc.data().submittedAt?.toDate(),
      createdAt: doc.data().createdAt?.toDate()
    };
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return null;
  }
};

/**
 * Get all feedback for a branch
 * @param {string} branchId - Branch ID
 * @param {number} limitCount - Limit results
 * @returns {Promise<Array>} - Feedback array
 */
export const getBranchFeedback = async (branchId, limitCount = 100) => {
  try {
    const feedbackRef = collection(db, FEEDBACK_COLLECTION);
    const q = query(
      feedbackRef,
      where('branchId', '==', branchId),
      orderBy('submittedAt', 'desc'),
      firestoreLimit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      submittedAt: doc.data().submittedAt?.toDate(),
      createdAt: doc.data().createdAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching branch feedback:', error);
    return [];
  }
};

/**
 * Get feedback statistics for a branch
 * @param {string} branchId - Branch ID
 * @returns {Promise<Object>} - Feedback statistics
 */
export const getBranchFeedbackStats = async (branchId) => {
  try {
    const feedback = await getBranchFeedback(branchId, 1000);
    
    if (feedback.length === 0) {
      return {
        totalFeedback: 0,
        averageOverallRating: 0,
        averageStylistRating: 0,
        averageServiceRating: 0,
        wouldRecommend: 0,
        visitAgain: 0
      };
    }
    
    const total = feedback.length;
    const sumOverall = feedback.reduce((sum, f) => sum + (f.overallRating || 0), 0);
    const sumStylist = feedback.reduce((sum, f) => sum + (f.stylistRating || 0), 0);
    const sumService = feedback.reduce((sum, f) => sum + (f.serviceRating || 0), 0);
    const wouldRecommend = feedback.filter(f => f.wouldRecommend).length;
    const visitAgain = feedback.filter(f => f.visitAgain).length;
    
    return {
      totalFeedback: total,
      averageOverallRating: (sumOverall / total).toFixed(2),
      averageStylistRating: (sumStylist / total).toFixed(2),
      averageServiceRating: (sumService / total).toFixed(2),
      wouldRecommend,
      visitAgain,
      recommendationRate: ((wouldRecommend / total) * 100).toFixed(1),
      returnRate: ((visitAgain / total) * 100).toFixed(1)
    };
  } catch (error) {
    console.error('Error calculating feedback stats:', error);
    return {
      totalFeedback: 0,
      averageOverallRating: 0,
      averageStylistRating: 0,
      averageServiceRating: 0,
      wouldRecommend: 0,
      visitAgain: 0
    };
  }
};

/**
 * Get feedback for a stylist
 * @param {string} stylistId - Stylist ID
 * @param {number} limitCount - Limit results
 * @returns {Promise<Array>} - Feedback array
 */
export const getStylistFeedback = async (stylistId, limitCount = 50) => {
  try {
    const feedbackRef = collection(db, FEEDBACK_COLLECTION);
    const q = query(
      feedbackRef,
      where('stylistId', '==', stylistId),
      orderBy('submittedAt', 'desc'),
      firestoreLimit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      submittedAt: doc.data().submittedAt?.toDate(),
      createdAt: doc.data().createdAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching stylist feedback:', error);
    return [];
  }
};

