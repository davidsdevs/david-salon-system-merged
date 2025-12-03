/**
 * Arrivals Service
 * Handles arrivals queue - both checked-in appointments and walk-ins
 */

import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where,
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { logActivity } from './activityService';
import toast from 'react-hot-toast';

const ARRIVALS_COLLECTION = 'check-in';

/**
 * Arrival Status Constants
 */
export const ARRIVAL_STATUS = {
  ARRIVED: 'arrived',
  IN_SERVICE: 'in_service',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

/**
 * Get arrivals by branch and date
 */
export const getArrivalsByBranch = async (branchId, startDate = null, endDate = null) => {
  try {
    const arrivalsRef = collection(db, ARRIVALS_COLLECTION);
    let q;

    if (startDate && endDate) {
      q = query(
        arrivalsRef,
        where('branchId', '==', branchId),
        where('arrivedAt', '>=', Timestamp.fromDate(startDate)),
        where('arrivedAt', '<', Timestamp.fromDate(endDate)),
        orderBy('arrivedAt', 'asc')
      );
    } else if (startDate) {
      q = query(
        arrivalsRef,
        where('branchId', '==', branchId),
        where('arrivedAt', '>=', Timestamp.fromDate(startDate)),
        orderBy('arrivedAt', 'asc')
      );
    } else {
      q = query(
        arrivalsRef,
        where('branchId', '==', branchId),
        orderBy('arrivedAt', 'asc')
      );
    }

    const snapshot = await getDocs(q);
    const arrivals = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return arrivals;
  } catch (error) {
    console.error('Error fetching arrivals:', error);
    throw error;
  }
};

/**
 * Get arrival by ID
 */
export const getArrivalById = async (arrivalId) => {
  try {
    const arrivalRef = doc(db, ARRIVALS_COLLECTION, arrivalId);
    const arrivalDoc = await getDoc(arrivalRef);
    
    if (!arrivalDoc.exists()) {
      return null;
    }

    return {
      id: arrivalDoc.id,
      ...arrivalDoc.data()
    };
  } catch (error) {
    console.error('Error fetching arrival:', error);
    throw error;
  }
};

/**
 * Create arrival entry from appointment check-in
 * Can accept either full appointment object or appointmentId with custom data
 */
export const createArrivalFromAppointment = async (appointmentIdOrObject, dataOrCurrentUser, currentUserIfData) => {
  try {
    const arrivalsRef = collection(db, ARRIVALS_COLLECTION);
    
    // Determine if we're using old signature (appointment object) or new signature (id + data)
    let appointmentId, appointmentData, currentUser;
    
    if (typeof appointmentIdOrObject === 'string') {
      // New signature: (appointmentId, data, currentUser)
      appointmentId = appointmentIdOrObject;
      appointmentData = dataOrCurrentUser;
      currentUser = currentUserIfData;
    } else {
      // Old signature: (appointment, currentUser)
      appointmentId = appointmentIdOrObject.id;
      appointmentData = appointmentIdOrObject;
      currentUser = dataOrCurrentUser;
    }
    
    // Build arrival object and filter out undefined values
    const arrivalRaw = {
      branchId: appointmentData.branchId,
      branchName: appointmentData.branchName || '',
      appointmentId: appointmentId, // Reference to original appointment
      isWalkIn: false,
      clientId: appointmentData.clientId || null,
      clientName: appointmentData.clientName || 'Unknown Client',
      clientPhone: appointmentData.clientPhone || '',
      clientEmail: appointmentData.clientEmail || '',
      services: appointmentData.services || [],
      products: appointmentData.products || [], // Products to be sold
      serviceName: appointmentData.serviceName || '',
      servicePrice: appointmentData.servicePrice || 0,
      stylistId: appointmentData.stylistId || null,
      stylistName: appointmentData.stylistName || '',
      status: appointmentData.status || ARRIVAL_STATUS.ARRIVED, // Allow custom status
      arrivedAt: serverTimestamp(),
      checkedInBy: currentUser.uid,
      notes: appointmentData.notes || '',
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Filter out undefined values (Firestore doesn't allow undefined)
    const arrival = Object.entries(arrivalRaw).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});

    console.log('📝 Creating arrival in check-in collection:', arrival);
    const docRef = await addDoc(arrivalsRef, arrival);
    console.log('✅ Arrival created with ID:', docRef.id);

    // Note: We don't update the appointment document anymore
    // The arrival record in check-in collection is the source of truth for check-ins

    // Log activity
    await logActivity({
      performedBy: currentUser.uid,
      action: 'CREATE_ARRIVAL_FROM_APPOINTMENT',
      targetType: 'arrival',
      targetId: docRef.id,
      details: `Checked in ${appointmentData.clientName || 'client'}`,
      metadata: {
        branchId: appointmentData.branchId,
        appointmentId: appointmentId,
        clientName: appointmentData.clientName,
        isWalkIn: false,
        status: arrival.status
      }
    });

    toast.success('Client checked in and added to arrivals queue');
    const createdArrival = { id: docRef.id, ...arrival };
    console.log('🎉 Returning created arrival:', createdArrival);
    return createdArrival;
  } catch (error) {
    console.error('Error creating arrival from appointment:', error);
    toast.error('Failed to check in client');
    throw error;
  }
};

/**
 * Create arrival entry for walk-in client
 */
export const createWalkInArrival = async (walkInData, currentUser) => {
  try {
    const arrivalsRef = collection(db, ARRIVALS_COLLECTION);
    
    // Build arrival object and filter out undefined values
    const arrivalRaw = {
      branchId: walkInData.branchId,
      branchName: walkInData.branchName || '',
      appointmentId: null, // Walk-ins don't have appointment
      isWalkIn: true,
      clientId: walkInData.clientId || null,
      clientName: walkInData.clientName || 'Walk-in Client',
      clientPhone: walkInData.clientPhone || '',
      clientEmail: walkInData.clientEmail || '',
      services: walkInData.services || [],
      products: walkInData.products || [], // Products to be sold
      serviceName: walkInData.serviceName || '',
      servicePrice: walkInData.servicePrice || 0,
      stylistId: walkInData.stylistId || null,
      stylistName: walkInData.stylistName || '',
      status: walkInData.status || ARRIVAL_STATUS.ARRIVED, // Allow custom status
      arrivedAt: serverTimestamp(),
      checkedInBy: currentUser.uid,
      notes: walkInData.notes || 'Walk-in client',
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Filter out undefined values (Firestore doesn't allow undefined)
    const arrival = Object.entries(arrivalRaw).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});

    console.log('📝 Creating walk-in arrival in check-in collection:', arrival);
    const docRef = await addDoc(arrivalsRef, arrival);
    console.log('✅ Walk-in arrival created with ID:', docRef.id);

    // Log activity
    await logActivity({
      performedBy: currentUser.uid,
      action: 'CREATE_WALK_IN_ARRIVAL',
      targetType: 'arrival',
      targetId: docRef.id,
      details: `Created walk-in arrival for ${arrival.clientName}`,
      metadata: {
        branchId: walkInData.branchId,
        clientName: arrival.clientName,
        isWalkIn: true,
        status: arrival.status
      }
    });

    toast.success('Walk-in client added to arrivals queue');
    const createdArrival = { id: docRef.id, ...arrival };
    console.log('🎉 Returning created walk-in arrival:', createdArrival);
    return createdArrival;
  } catch (error) {
    console.error('Error creating walk-in arrival:', error);
    toast.error('Failed to add walk-in client');
    throw error;
  }
};

/**
 * Update arrival status
 * Also syncs appointment status when arrival is completed
 */
export const updateArrivalStatus = async (arrivalId, status, currentUser) => {
  try {
    const arrivalRef = doc(db, ARRIVALS_COLLECTION, arrivalId);
    const arrival = await getArrivalById(arrivalId);
    
    if (!arrival) {
      throw new Error('Arrival not found');
    }

    const updates = {
      status,
      updatedAt: serverTimestamp()
    };
    
    // Add timestamps based on status
    if (status === ARRIVAL_STATUS.IN_SERVICE) {
      updates.startedAt = serverTimestamp();
      updates.startedBy = currentUser.uid;
    } else if (status === ARRIVAL_STATUS.COMPLETED) {
      updates.completedAt = serverTimestamp();
      updates.completedBy = currentUser.uid;
    } else if (status === ARRIVAL_STATUS.CANCELLED) {
      updates.cancelledAt = serverTimestamp();
      updates.cancelledBy = currentUser.uid;
    }
    
    await updateDoc(arrivalRef, updates);

    // Sync appointment status if this arrival is linked to an appointment
    if (arrival.appointmentId && !arrival.isWalkIn) {
      try {
        const appointmentRef = doc(db, 'appointments', arrival.appointmentId);
        const appointmentDoc = await getDoc(appointmentRef);
        
        if (appointmentDoc.exists()) {
          let appointmentStatus = null;
          
          // Map arrival status to appointment status
          if (status === ARRIVAL_STATUS.IN_SERVICE) {
            appointmentStatus = 'in_service';
          } else if (status === ARRIVAL_STATUS.COMPLETED) {
            appointmentStatus = 'completed';
          } else if (status === ARRIVAL_STATUS.CANCELLED) {
            appointmentStatus = 'cancelled';
          }
          
          if (appointmentStatus) {
            await updateDoc(appointmentRef, {
              status: appointmentStatus,
              updatedAt: serverTimestamp()
            });
            console.log(`✅ Synced appointment ${arrival.appointmentId} status to ${appointmentStatus}`);
          }
        }
      } catch (syncError) {
        // Log but don't fail the main operation
        console.error('Error syncing appointment status:', syncError);
      }
    }

    // Log activity
    await logActivity({
      performedBy: currentUser.uid,
      action: 'UPDATE_ARRIVAL_STATUS',
      targetType: 'arrival',
      targetId: arrivalId,
      details: `Changed arrival status to ${status}`,
      metadata: { 
        status,
        isWalkIn: arrival.isWalkIn,
        clientName: arrival.clientName,
        appointmentId: arrival.appointmentId || null
      }
    });

    toast.success(`Arrival status updated to ${status}`);
  } catch (error) {
    console.error('Error updating arrival status:', error);
    toast.error('Failed to update arrival status');
    throw error;
  }
};

/**
 * Update arrival
 */
export const updateArrival = async (arrivalId, updates, currentUser) => {
  try {
    const arrivalRef = doc(db, ARRIVALS_COLLECTION, arrivalId);
    
    // Filter out undefined values
    const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});

    cleanUpdates.updatedAt = serverTimestamp();

    await updateDoc(arrivalRef, cleanUpdates);

    // Log activity
    await logActivity({
      performedBy: currentUser.uid,
      action: 'UPDATE_ARRIVAL',
      targetType: 'arrival',
      targetId: arrivalId,
      details: 'Updated arrival details',
      metadata: updates
    });

    toast.success('Arrival updated successfully');
  } catch (error) {
    console.error('Error updating arrival:', error);
    toast.error('Failed to update arrival');
    throw error;
  }
};

/**
 * Delete arrival
 */
export const deleteArrival = async (arrivalId, currentUser) => {
  try {
    const arrivalRef = doc(db, ARRIVALS_COLLECTION, arrivalId);
    await deleteDoc(arrivalRef);

    // Log activity
    await logActivity({
      performedBy: currentUser.uid,
      action: 'DELETE_ARRIVAL',
      targetType: 'arrival',
      targetId: arrivalId,
      details: 'Deleted arrival entry'
    });

    toast.success('Arrival deleted successfully');
  } catch (error) {
    console.error('Error deleting arrival:', error);
    toast.error('Failed to delete arrival');
    throw error;
  }
};

/**
 * Check if arrival exists for appointment
 */
export const getArrivalByAppointmentId = async (appointmentId) => {
  try {
    const arrivalsRef = collection(db, ARRIVALS_COLLECTION);
    const q = query(
      arrivalsRef,
      where('appointmentId', '==', appointmentId),
      where('isWalkIn', '==', false)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    };
  } catch (error) {
    console.error('Error fetching arrival by appointment ID:', error);
    throw error;
  }
};

export default {
  getArrivalsByBranch,
  getArrivalById,
  createArrivalFromAppointment,
  createWalkInArrival,
  updateArrivalStatus,
  updateArrival,
  deleteArrival,
  getArrivalByAppointmentId,
  ARRIVAL_STATUS
};

