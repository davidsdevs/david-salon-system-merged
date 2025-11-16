/**
 * Client Service
 * Handles client/customer data operations
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

const USERS_COLLECTION = 'users';
const CLIENTS_COLLECTION = 'clients';
const SERVICE_HISTORY_COLLECTION = 'service_history'; // Flat collection: service_history/{historyId}
const FEEDBACK_COLLECTION = 'feedback'; // Flat collection: feedback/{feedbackId}

/**
 * Get all clients (users with role 'client')
 * @returns {Promise<Array>} - Array of clients
 */
export const getClients = async () => {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    
    // Try querying with roles array first (new format)
    let q = query(
      usersRef,
      where('roles', 'array-contains', 'client'),
      where('isActive', '==', true)
    );
    
    let snapshot;
    try {
      snapshot = await getDocs(q);
    } catch (error) {
      // Fallback to old format (role field) if roles array doesn't work
      console.log('Trying fallback query with role field...');
      q = query(
        usersRef,
        where('role', '==', 'client'),
        where('isActive', '==', true)
      );
      snapshot = await getDocs(q);
    }
    
    const clients = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));
    
    // Sort by firstName (manual sort if orderBy fails)
    return clients.sort((a, b) => {
      const nameA = (a.firstName || '').toLowerCase();
      const nameB = (b.firstName || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
};

/**
 * Get client by ID
 * @param {string} clientId - Client ID
 * @returns {Promise<Object|null>} - Client data or null
 */
export const getClientById = async (clientId) => {
  try {
    const clientRef = doc(db, USERS_COLLECTION, clientId);
    const clientSnap = await getDoc(clientRef);
    
    if (!clientSnap.exists()) {
      return null;
    }
    
    return {
      id: clientSnap.id,
      ...clientSnap.data(),
      createdAt: clientSnap.data().createdAt?.toDate(),
      updatedAt: clientSnap.data().updatedAt?.toDate()
    };
  } catch (error) {
    console.error('Error fetching client:', error);
    return null;
  }
};

/**
 * Create a new client (guest/walk-in)
 * @param {Object} clientData - Client information
 * @returns {Promise<string>} - Client ID
 */
export const createClient = async (clientData) => {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    
    const client = {
      firstName: clientData.firstName || '',
      lastName: clientData.lastName || '',
      email: clientData.email || '',
      phoneNumber: clientData.phoneNumber || '',
      role: 'client',
      isActive: true,
      isGuest: clientData.isGuest || false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await addDoc(usersRef, client);
    toast.success('Client created successfully');
    return docRef.id;
  } catch (error) {
    console.error('Error creating client:', error);
    toast.error('Failed to create client');
    throw error;
  }
};

/**
 * Update client information
 * @param {string} clientId - Client ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export const updateClient = async (clientId, updates) => {
  try {
    const clientRef = doc(db, USERS_COLLECTION, clientId);
    await updateDoc(clientRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
    toast.success('Client updated successfully');
  } catch (error) {
    console.error('Error updating client:', error);
    toast.error('Failed to update client');
    throw error;
  }
};

/**
 * Search clients by name or phone
 * @param {string} searchTerm - Search term
 * @returns {Promise<Array>} - Array of matching clients
 */
export const searchClients = async (searchTerm) => {
  try {
    const clients = await getClients();
    const term = searchTerm.toLowerCase();
    
    return clients.filter(client => {
      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
      const phone = client.phoneNumber || '';
      return fullName.includes(term) || phone.includes(searchTerm);
    });
  } catch (error) {
    console.error('Error searching clients:', error);
    return [];
  }
};

/**
 * Get or create client CRM profile
 * @param {string} clientId - Client ID
 * @returns {Promise<Object>} - Client CRM profile
 */
export const getClientProfile = async (clientId) => {
  try {
    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    const clientSnap = await getDoc(clientRef);
    
    if (clientSnap.exists()) {
      const data = clientSnap.data();
      return {
        id: clientSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        lastVisit: data.lastVisit?.toDate()
      };
    }
    
    // Create profile if doesn't exist
    const userData = await getClientById(clientId);
    if (!userData) {
      return null;
    }
    
    const newProfile = {
      clientId,
      preferredStylists: [],
      allergies: '',
      notes: '',
      loyaltyPoints: 0,
      referralCode: generateReferralCode(clientId),
      referredBy: null,
      totalSpent: 0,
      visitCount: 0,
      lastVisit: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    await setDoc(clientRef, newProfile);
    return { id: clientId, ...newProfile };
  } catch (error) {
    console.error('Error getting client profile:', error);
    return null;
  }
};

/**
 * Update client CRM profile
 * @param {string} clientId - Client ID
 * @param {Object} updates - Profile updates
 * @param {Object} currentUser - Current user making the update
 * @returns {Promise<void>}
 */
export const updateClientProfile = async (clientId, updates, currentUser) => {
  try {
    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    await updateDoc(clientRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
    
    // Log activity
    await logActivity({
      performedBy: currentUser?.uid || 'system',
      action: 'UPDATE_CLIENT_PROFILE',
      targetType: 'client',
      targetId: clientId,
      details: 'Updated client CRM profile',
      metadata: { updates }
    });
    
    toast.success('Client profile updated successfully');
  } catch (error) {
    console.error('Error updating client profile:', error);
    toast.error('Failed to update client profile');
    throw error;
  }
};

/**
 * Add service to client history
 * @param {string} clientId - Client ID
 * @param {Object} serviceData - Service information
 * @returns {Promise<string>} - Service history ID
 */
export const addServiceHistory = async (clientId, serviceData) => {
  try {
    const historyRef = collection(db, SERVICE_HISTORY_COLLECTION);
    
    const historyEntry = {
      clientId,
      serviceName: serviceData.serviceName,
      serviceId: serviceData.serviceId,
      appointmentId: serviceData.appointmentId,
      billId: serviceData.billId,
      date: serviceData.date || Timestamp.now(),
      stylistId: serviceData.stylistId || null,
      stylistName: serviceData.stylistName || '',
      branchId: serviceData.branchId,
      branchName: serviceData.branchName || '',
      price: serviceData.price || 0,
      createdAt: Timestamp.now()
    };
    
    const docRef = await addDoc(historyRef, historyEntry);
    
    // Update client profile stats
    const profile = await getClientProfile(clientId);
    if (profile) {
      await updateDoc(doc(db, CLIENTS_COLLECTION, clientId), {
        visitCount: (profile.visitCount || 0) + 1,
        lastVisit: Timestamp.now(),
        totalSpent: (profile.totalSpent || 0) + (serviceData.price || 0),
        updatedAt: Timestamp.now()
      });
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error adding service history:', error);
    throw error;
  }
};

/**
 * Get client service history
 * Queries from transactions collection instead of redundant service_history collection
 * @param {string} clientId - Client ID
 * @param {number} limitCount - Limit results
 * @returns {Promise<Array>} - Service history array
 */
export const getServiceHistory = async (clientId, limitCount = 50) => {
  try {
    // Query from transactions collection instead of redundant service_history
    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef, 
      where('clientId', '==', clientId),
      where('status', '==', 'paid'), // Only get paid transactions
      orderBy('createdAt', 'desc'),
      firestoreLimit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    
    // Transform transactions into service history format
    const history = [];
    snapshot.docs.forEach(doc => {
      const transaction = doc.data();
      // Extract service items from transaction
      if (transaction.items && Array.isArray(transaction.items)) {
        transaction.items.forEach((item, index) => {
          if (item.type === 'service') {
            // Handle date conversion (Timestamp or Date)
            let serviceDate = new Date();
            if (transaction.createdAt) {
              if (transaction.createdAt.toDate) {
                serviceDate = transaction.createdAt.toDate();
              } else if (transaction.createdAt instanceof Date) {
                serviceDate = transaction.createdAt;
              } else {
                serviceDate = new Date(transaction.createdAt);
              }
            }
            
            history.push({
              id: `${doc.id}_${index}`, // Unique ID for each service in transaction
              clientId: transaction.clientId,
              serviceName: item.name || 'Unknown Service',
              serviceId: item.id,
              appointmentId: transaction.appointmentId,
              billId: doc.id,
              date: serviceDate,
              stylistId: item.stylistId || transaction.stylistId || null,
              stylistName: item.stylistName || transaction.stylistName || 'Unassigned',
              branchId: transaction.branchId,
              branchName: transaction.branchName || 'Unknown Branch',
              price: item.price || 0,
              createdAt: serviceDate
            });
          }
        });
      }
    });
    
    // Sort by date descending
    history.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    // Limit results
    return history.slice(0, limitCount);
  } catch (error) {
    console.error('Error fetching service history:', error);
    return [];
  }
};

/**
 * Get client segmentation data
 * @param {string} clientId - Client ID
 * @returns {Promise<Object>} - Segmentation data
 */
export const getClientSegmentation = async (clientId) => {
  try {
    const profile = await getClientProfile(clientId);
    if (!profile) return null;
    
    const history = await getServiceHistory(clientId, 100);
    const visitFrequency = history.length;
    const avgSpend = visitFrequency > 0 ? profile.totalSpent / visitFrequency : 0;
    
    // Determine tier
    let tier = 'Bronze';
    if (visitFrequency >= 20 || profile.totalSpent >= 50000) {
      tier = 'Platinum';
    } else if (visitFrequency >= 10 || profile.totalSpent >= 25000) {
      tier = 'Gold';
    } else if (visitFrequency >= 5 || profile.totalSpent >= 10000) {
      tier = 'Silver';
    }
    
    // Get preferred services
    const serviceCounts = {};
    history.forEach(entry => {
      const serviceName = entry.serviceName;
      serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1;
    });
    const preferredServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
    
    return {
      tier,
      visitFrequency,
      avgSpend,
      totalSpent: profile.totalSpent,
      preferredServices,
      lastVisit: profile.lastVisit?.toDate()
    };
  } catch (error) {
    console.error('Error getting client segmentation:', error);
    return null;
  }
};

/**
 * Generate unique referral code
 * @param {string} clientId - Client ID
 * @returns {string} - Referral code
 */
const generateReferralCode = (clientId) => {
  // Use first 6 chars of clientId + random 4 chars
  const prefix = clientId.substring(0, 6).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${random}`;
};
