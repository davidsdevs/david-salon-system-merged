/**
 * Portfolio Service
 * Handles portfolio-related operations for stylists
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import toast from 'react-hot-toast';

const PORTFOLIO_COLLECTION = 'portfolio';

/**
 * Get all portfolios for a specific stylist
 * @param {string} stylistId - Stylist ID
 * @returns {Promise<Array>} Array of portfolios
 */
export const getPortfoliosByStylist = async (stylistId) => {
  try {
    const portfoliosRef = collection(db, PORTFOLIO_COLLECTION);
    const q = query(
      portfoliosRef,
      where('stylistId', '==', stylistId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const portfolios = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      portfolios.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt)),
        approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate() : (data.approvedAt instanceof Date ? data.approvedAt : null),
        rejectedAt: data.rejectedAt?.toDate ? data.rejectedAt.toDate() : (data.rejectedAt instanceof Date ? data.rejectedAt : null),
      });
    });
    
    return portfolios;
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    // If orderBy fails (index missing), fetch without it and sort in memory
    try {
      const portfoliosRef = collection(db, PORTFOLIO_COLLECTION);
      const q = query(
        portfoliosRef,
        where('stylistId', '==', stylistId)
      );
      
      const snapshot = await getDocs(q);
      const portfolios = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        portfolios.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt)),
          approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate() : (data.approvedAt instanceof Date ? data.approvedAt : null),
          rejectedAt: data.rejectedAt?.toDate ? data.rejectedAt.toDate() : (data.rejectedAt instanceof Date ? data.rejectedAt : null),
        });
      });
      
      // Sort by createdAt descending in memory
      return portfolios.sort((a, b) => {
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return bTime - aTime;
      });
    } catch (fallbackError) {
      console.error('Error in fallback portfolio fetch:', fallbackError);
      toast.error('Failed to load portfolios');
      throw fallbackError;
    }
  }
};

/**
 * Get a single portfolio by ID
 * @param {string} portfolioId - Portfolio ID
 * @returns {Promise<Object|null>} Portfolio object or null
 */
export const getPortfolioById = async (portfolioId) => {
  try {
    const portfolioRef = doc(db, PORTFOLIO_COLLECTION, portfolioId);
    const portfolioSnap = await getDoc(portfolioRef);
    
    if (!portfolioSnap.exists()) {
      return null;
    }
    
    const data = portfolioSnap.data();
    return {
      id: portfolioSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt)),
      approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate() : (data.approvedAt instanceof Date ? data.approvedAt : null),
      rejectedAt: data.rejectedAt?.toDate ? data.rejectedAt.toDate() : (data.rejectedAt instanceof Date ? data.rejectedAt : null),
    };
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    toast.error('Failed to load portfolio');
    throw error;
  }
};

/**
 * Create a new portfolio
 * @param {Object} portfolioData - Portfolio data
 * @param {string} portfolioData.stylistId - Stylist ID
 * @param {string} portfolioData.title - Portfolio title
 * @param {string} portfolioData.category - Portfolio category
 * @param {string} portfolioData.imageUrl - Image URL
 * @param {string} portfolioData.thumbnailUrl - Thumbnail URL (optional)
 * @param {string} portfolioData.description - Description (optional)
 * @returns {Promise<string>} Portfolio document ID
 */
export const createPortfolio = async (portfolioData) => {
  try {
    const { stylistId, title, category, imageUrl, thumbnailUrl, description } = portfolioData;
    
    if (!stylistId || !imageUrl) {
      throw new Error('Stylist ID and image URL are required');
    }
    
    const portfoliosRef = collection(db, PORTFOLIO_COLLECTION);
    const newPortfolio = {
      stylistId,
      title: title || 'Untitled',
      category: category || 'Uncategorized',
      imageUrl,
      thumbnailUrl: thumbnailUrl || imageUrl,
      description: description || '',
      status: 'pending', // pending, active (approved), rejected
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    const docRef = await addDoc(portfoliosRef, newPortfolio);
    toast.success('Portfolio uploaded successfully!');
    return docRef.id;
  } catch (error) {
    console.error('Error creating portfolio:', error);
    toast.error(error.message || 'Failed to upload portfolio');
    throw error;
  }
};

/**
 * Update a portfolio
 * @param {string} portfolioId - Portfolio document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export const updatePortfolio = async (portfolioId, updates) => {
  try {
    const portfolioRef = doc(db, PORTFOLIO_COLLECTION, portfolioId);
    
    await updateDoc(portfolioRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
    
    toast.success('Portfolio updated successfully');
  } catch (error) {
    console.error('Error updating portfolio:', error);
    toast.error(error.message || 'Failed to update portfolio');
    throw error;
  }
};

/**
 * Delete a portfolio
 * @param {string} portfolioId - Portfolio document ID
 * @returns {Promise<void>}
 */
export const deletePortfolio = async (portfolioId) => {
  try {
    const portfolioRef = doc(db, PORTFOLIO_COLLECTION, portfolioId);
    await deleteDoc(portfolioRef);
    toast.success('Portfolio deleted successfully');
  } catch (error) {
    console.error('Error deleting portfolio:', error);
    toast.error('Failed to delete portfolio');
    throw error;
  }
};

