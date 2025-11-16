/**
 * Appointment Service
 * Handles all appointment-related operations
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
import { getBranchById } from './branchService';
import { getBranchCalendar } from './branchCalendarService';
import { logActivity } from './activityService';
import { 
  storeAppointmentCreated, 
  storeAppointmentConfirmed, 
  storeAppointmentCancelled, 
  storeAppointmentRescheduled,
  storeAppointmentCompleted,
  storeAppointmentInService,
  storeAppointmentTransferred
} from './notificationService';
import toast from 'react-hot-toast';

const APPOINTMENTS_COLLECTION = 'appointments';

/**
 * Appointment Status Constants
 */
export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_SERVICE: 'in_service',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show'
};

/**
 * Get all appointments
 */
export const getAllAppointments = async () => {
  try {
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const q = query(appointmentsRef, orderBy('appointmentDate', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      appointmentDate: doc.data().appointmentDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching appointments:', error);
    toast.error('Failed to load appointments');
    throw error;
  }
};

/**
 * Get appointments by branch
 */
export const getAppointmentsByBranch = async (branchId) => {
  try {
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const q = query(
      appointmentsRef,
      where('branchId', '==', branchId),
      orderBy('appointmentDate', 'desc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      appointmentDate: doc.data().appointmentDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching branch appointments:', error);
    toast.error('Failed to load branch appointments');
    throw error;
  }
};

/**
 * Get appointments by client
 */
export const getAppointmentsByClient = async (clientId) => {
  try {
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const q = query(
      appointmentsRef,
      where('clientId', '==', clientId),
      orderBy('appointmentDate', 'desc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      appointmentDate: doc.data().appointmentDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching client appointments:', error);
    toast.error('Failed to load your appointments');
    throw error;
  }
};

/**
 * Get appointments by stylist
 * Handles both single-service appointments (stylistId field) 
 * and multi-service appointments (services array)
 */
export const getAppointmentsByStylist = async (stylistId) => {
  try {
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    
    // Query 1: Single-service appointments with stylistId field
    const singleServiceQuery = query(
      appointmentsRef,
      where('stylistId', '==', stylistId),
      orderBy('appointmentDate', 'desc')
    );
    const singleServiceSnapshot = await getDocs(singleServiceQuery);
    const singleServiceAppointments = singleServiceSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      appointmentDate: doc.data().appointmentDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));
    
    // Query 2: Multi-service appointments where stylist is in services array
    // Get all appointments and filter client-side (Firestore can't query array contains with specific field)
    const allAppointmentsQuery = query(
      appointmentsRef,
      orderBy('appointmentDate', 'desc')
    );
    const allAppointmentsSnapshot = await getDocs(allAppointmentsQuery);
    const multiServiceAppointments = allAppointmentsSnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        appointmentDate: doc.data().appointmentDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }))
      .filter(apt => 
        apt.services && 
        apt.services.some(svc => svc.stylistId === stylistId)
      );
    
    // Combine and deduplicate
    const allAppointments = [...singleServiceAppointments];
    multiServiceAppointments.forEach(apt => {
      if (!allAppointments.find(a => a.id === apt.id)) {
        allAppointments.push(apt);
      }
    });
    
    // Sort by date descending
    return allAppointments.sort((a, b) => {
      const dateA = a.appointmentDate ? new Date(a.appointmentDate) : new Date(0);
      const dateB = b.appointmentDate ? new Date(b.appointmentDate) : new Date(0);
      return dateB - dateA;
    });
    
  } catch (error) {
    console.error('Error fetching stylist appointments:', error);
    toast.error('Failed to load your appointments');
    throw error;
  }
};

/**
 * Get appointments by date range
 */
export const getAppointmentsByDateRange = async (branchId, startDate, endDate) => {
  try {
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    
    // Build query constraints dynamically
    const constraints = [where('branchId', '==', branchId)];
    
    // Add date filters only if dates are provided
    if (startDate) {
      constraints.push(where('appointmentDate', '>=', Timestamp.fromDate(startDate)));
    }
    if (endDate) {
      constraints.push(where('appointmentDate', '<=', Timestamp.fromDate(endDate)));
    }
    
    // Add ordering
    constraints.push(orderBy('appointmentDate', 'asc'));
    
    const q = query(appointmentsRef, ...constraints);
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      appointmentDate: doc.data().appointmentDate?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching appointments by date range:', error);
    toast.error('Failed to load appointments');
    throw error;
  }
};

/**
 * Get single appointment by ID
 */
export const getAppointmentById = async (appointmentId) => {
  try {
    const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    const appointmentSnap = await getDoc(appointmentRef);
    
    if (!appointmentSnap.exists()) {
      throw new Error('Appointment not found');
    }
    
    return {
      id: appointmentSnap.id,
      ...appointmentSnap.data(),
      appointmentDate: appointmentSnap.data().appointmentDate?.toDate(),
      createdAt: appointmentSnap.data().createdAt?.toDate(),
      updatedAt: appointmentSnap.data().updatedAt?.toDate()
    };
  } catch (error) {
    console.error('Error fetching appointment:', error);
    toast.error('Failed to load appointment details');
    throw error;
  }
};

/**
 * Create new appointment
 */
export const createAppointment = async (appointmentData, currentUser) => {
  try {
    // Validate required fields
    // For guest clients, clientId is optional but clientName is required
    const isGuest = appointmentData.isGuest;
    
    // Support both single service (serviceId) and multi-service (services array)
    const hasService = appointmentData.serviceId || (appointmentData.services && appointmentData.services.length > 0);
    
    if (!appointmentData.branchId || !hasService || !appointmentData.appointmentDate) {
      throw new Error('Missing required appointment fields');
    }
    
    if (!isGuest && !appointmentData.clientId) {
      throw new Error('Client ID is required for registered client appointments');
    }
    
    if (isGuest && !appointmentData.clientName) {
      throw new Error('Client name is required for guest client appointments');
    }

    // Check for double booking
    // For multi-service appointments, check each stylist's availability
    if (appointmentData.services && appointmentData.services.length > 0) {
      // Check availability for each stylist assigned to services
      for (const service of appointmentData.services) {
        if (service.stylistId) {
          const isAvailable = await checkStylistAvailability(
            service.stylistId,
            appointmentData.appointmentDate,
            appointmentData.duration || 60
          );
          
          if (!isAvailable) {
            toast.error('Selected time slot is not available for one or more stylists');
            throw new Error('Time slot not available');
          }
        }
      }
    } else if (appointmentData.stylistId) {
      // Single service appointment - check single stylist
      const isAvailable = await checkStylistAvailability(
        appointmentData.stylistId,
        appointmentData.appointmentDate,
        appointmentData.duration || 60
      );

      if (!isAvailable) {
        toast.error('Selected time slot is not available');
        throw new Error('Time slot not available');
      }
    }

    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const newAppointment = {
      ...appointmentData,
      appointmentDate: Timestamp.fromDate(new Date(appointmentData.appointmentDate)),
      status: appointmentData.status || APPOINTMENT_STATUS.PENDING,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(appointmentsRef, newAppointment);

    // Prepare appointment data for notification
    const appointmentForNotification = {
      id: docRef.id,
      ...newAppointment,
      appointmentDate: appointmentData.appointmentDate
    };

    // Send notification to client and stylist(s)
    try {
      await storeAppointmentCreated(appointmentForNotification);
    } catch (error) {
      console.error('Error sending appointment created notification:', error);
      // Don't fail appointment creation if notification fails
    }

    // Log activity
    await logActivity({
      performedBy: currentUser.uid,
      action: 'CREATE_APPOINTMENT',
      targetType: 'appointment',
      targetId: docRef.id,
      details: `Created appointment for client ${appointmentData.clientName || appointmentData.clientId}`,
      metadata: {
        branchId: appointmentData.branchId,
        serviceId: appointmentData.serviceId || null,
        services: appointmentData.services || null,
        appointmentDate: appointmentData.appointmentDate
      }
    });

    toast.success('Appointment created successfully');
    return docRef.id;
  } catch (error) {
    console.error('Error creating appointment:', error);
    if (error.message !== 'Time slot not available') {
      toast.error('Failed to create appointment');
    }
    throw error;
  }
};

/**
 * Update appointment
 */
export const updateAppointment = async (appointmentId, updates, currentUser) => {
  try {
    const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    
    // If rescheduling, check availability and time restrictions
    if (updates.appointmentDate) {
      const appointment = await getAppointmentById(appointmentId);
      
      // Check 2-hour advance notice requirement
      const now = new Date();
      // Handle both Firestore Timestamp and Date objects
      const originalTime = appointment.appointmentDate instanceof Date 
        ? appointment.appointmentDate 
        : appointment.appointmentDate.toDate();
      const timeDiff = originalTime.getTime() - now.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff < 2 && hoursDiff > 0) {
        toast.error('Appointments must be rescheduled at least 2 hours in advance');
        throw new Error('Insufficient advance notice');
      }
      
      // Check availability for multi-service or single-service
      if (updates.services && updates.services.length > 0) {
        // Multi-service: check each stylist
        for (const service of updates.services) {
          if (service.stylistId) {
            const isAvailable = await checkStylistAvailability(
              service.stylistId,
              updates.appointmentDate,
              updates.duration || appointment.duration || 60,
              appointmentId // Exclude current appointment
            );

            if (!isAvailable) {
              toast.error('Selected time slot is not available for one or more stylists');
              throw new Error('Time slot not available');
            }
          }
        }
      } else {
        // Single service: check single stylist
        const isAvailable = await checkStylistAvailability(
          updates.stylistId || appointment.stylistId,
          updates.appointmentDate,
          updates.duration || appointment.duration || 60,
          appointmentId // Exclude current appointment
        );

        if (!isAvailable) {
          toast.error('Selected time slot is not available');
          throw new Error('Time slot not available');
        }
      }

      updates.appointmentDate = Timestamp.fromDate(new Date(updates.appointmentDate));
    }

    // Filter out undefined values from updates
    const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});

    // Get appointment before update to check status change and stylist changes
    const appointmentBeforeUpdate = await getAppointmentById(appointmentId);
    const oldStatus = appointmentBeforeUpdate.status;

    // Check for stylist transfer (when clientType is TR and stylist changes)
    let stylistTransferDetected = false;
    let oldStylistId = null;
    let newStylistId = null;
    let oldStylistName = null;
    let newStylistName = null;

    // Check if services array is being updated
    if (cleanUpdates.services && Array.isArray(cleanUpdates.services)) {
      // Check each service for TR clientType and stylist changes
      for (let i = 0; i < cleanUpdates.services.length; i++) {
        const newService = cleanUpdates.services[i];
        const oldService = appointmentBeforeUpdate.services?.[i] || appointmentBeforeUpdate.services?.find(s => s.serviceId === newService.serviceId);
        
        if (newService.clientType === 'TR' && oldService) {
          // Check if stylist changed
          if (oldService.stylistId && newService.stylistId && oldService.stylistId !== newService.stylistId) {
            stylistTransferDetected = true;
            oldStylistId = oldService.stylistId;
            newStylistId = newService.stylistId;
            oldStylistName = oldService.stylistName || 'Previous Stylist';
            newStylistName = newService.stylistName || 'New Stylist';
            break; // Use first service's transfer info
          }
        }
      }
    }

    await updateDoc(appointmentRef, {
      ...cleanUpdates,
      updatedAt: serverTimestamp()
    });

    // Get updated appointment for notifications
    const updatedAppointment = await getAppointmentById(appointmentId);
    const newStatus = updatedAppointment.status;

    // Send notification if status changed
    if (oldStatus !== newStatus && newStatus) {
      try {
        const appointmentForNotification = {
          ...updatedAppointment,
          appointmentDate: updatedAppointment.appointmentDate
        };

        switch (newStatus) {
          case APPOINTMENT_STATUS.CONFIRMED:
            await storeAppointmentConfirmed(appointmentForNotification);
            break;
          case APPOINTMENT_STATUS.CANCELLED:
            await storeAppointmentCancelled(appointmentForNotification);
            break;
          case APPOINTMENT_STATUS.IN_SERVICE:
            await storeAppointmentInService(appointmentForNotification);
            break;
          case APPOINTMENT_STATUS.COMPLETED:
            await storeAppointmentCompleted(appointmentForNotification);
            break;
        }
      } catch (error) {
        console.error('Error sending status change notification:', error);
      }
    }

    // Send notification if rescheduled (appointmentDate changed)
    if (updates.appointmentDate) {
      try {
        const appointmentForNotification = {
          ...updatedAppointment,
          newAppointmentDate: updates.appointmentDate instanceof Date 
            ? updates.appointmentDate 
            : updates.appointmentDate.toDate?.() || new Date(updates.appointmentDate),
          appointmentDate: updatedAppointment.appointmentDate
        };
        await storeAppointmentRescheduled(appointmentForNotification);
      } catch (error) {
        console.error('Error sending rescheduled notification:', error);
      }
    }

    // Send transfer notification if stylist changed and clientType is TR
    if (stylistTransferDetected && oldStylistId && newStylistId) {
      try {
        const transferNotificationData = {
          ...updatedAppointment,
          oldStylistId,
          newStylistId,
          oldStylistName,
          newStylistName,
          appointmentDate: updatedAppointment.appointmentDate
        };
        await storeAppointmentTransferred(transferNotificationData);
        console.log('✅ Transfer notification sent:', { oldStylistId, newStylistId });
      } catch (error) {
        console.error('Error sending transfer notification:', error);
        // Don't fail the update if notification fails
      }
    }

    // Log activity
    await logActivity({
      performedBy: currentUser.uid,
      action: 'UPDATE_APPOINTMENT',
      targetType: 'appointment',
      targetId: appointmentId,
      details: `Updated appointment`,
      metadata: updates
    });

    toast.success('Appointment updated successfully');
  } catch (error) {
    console.error('Error updating appointment:', error);
    if (error.message !== 'Time slot not available') {
      toast.error('Failed to update appointment');
    }
    throw error;
  }
};

/**
 * Update appointment status
 */
export const updateAppointmentStatus = async (appointmentId, status, currentUser, postServiceNotes = null, servicesAssessment = null) => {
  try {
    const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    
    const updates = {
      status,
      updatedAt: serverTimestamp()
    };
    
    // Update services with client type and price adjustments if provided
    if (servicesAssessment && servicesAssessment.length > 0) {
      // If appointment has services array, update it
      const appointment = await getAppointmentById(appointmentId);
      if (appointment.services && appointment.services.length > 0) {
        const updatedServices = appointment.services.map((svc, index) => {
          const assessment = servicesAssessment.find(a => a.serviceId === svc.serviceId) || servicesAssessment[index];
          if (assessment) {
            const updatedService = {
              ...svc,
              clientType: assessment.clientType,
              adjustment: assessment.adjustment || 0,
              adjustmentReason: assessment.adjustmentReason || '',
              adjustedPrice: assessment.price || (svc.price || svc.basePrice || 0) + (assessment.adjustment || 0),
              basePrice: assessment.basePrice || svc.price || svc.basePrice || 0
            };
            // Remove status field if it exists (redundant - appointment has status, not individual services)
            delete updatedService.status;
            return updatedService;
          }
          // Remove status from existing service if it exists
          const cleanedService = { ...svc };
          delete cleanedService.status;
          return cleanedService;
        });
        updates.services = updatedServices;
      } else if (appointment.serviceName) {
        // Single service appointment
        const assessment = servicesAssessment[0];
        if (assessment) {
          updates.clientType = assessment.clientType;
          updates.adjustment = assessment.adjustment || 0;
          updates.adjustmentReason = assessment.adjustmentReason || '';
          updates.adjustedPrice = assessment.price || (appointment.servicePrice || 0) + (assessment.adjustment || 0);
          updates.basePrice = assessment.basePrice || appointment.servicePrice || 0;
        }
      }
    }
    
    // Add post-service notes if completing appointment
    if (status === APPOINTMENT_STATUS.COMPLETED && postServiceNotes) {
      updates.postServiceNotes = postServiceNotes;
      updates.completedAt = serverTimestamp();
      updates.completedBy = currentUser.uid;
    }
    
    await updateDoc(appointmentRef, updates);
    
    // Get updated appointment for notifications
    const updatedAppointment = await getAppointmentById(appointmentId);

    // Send notification based on status change
    try {
      const appointmentForNotification = {
        ...updatedAppointment,
        appointmentDate: updatedAppointment.appointmentDate
      };

      switch (status) {
        case APPOINTMENT_STATUS.CONFIRMED:
          await storeAppointmentConfirmed(appointmentForNotification);
          break;
        case APPOINTMENT_STATUS.CANCELLED:
          await storeAppointmentCancelled(appointmentForNotification);
          break;
        case APPOINTMENT_STATUS.IN_SERVICE:
          await storeAppointmentInService(appointmentForNotification);
          break;
        case APPOINTMENT_STATUS.COMPLETED:
          await storeAppointmentCompleted(appointmentForNotification);
          break;
      }
    } catch (error) {
      console.error('Error sending status change notification:', error);
      // Don't fail status update if notification fails
    }

    // Log activity
    await logActivity({
      performedBy: currentUser.uid,
      action: 'UPDATE_APPOINTMENT_STATUS',
      targetType: 'appointment',
      targetId: appointmentId,
      details: `Changed appointment status to ${status}`,
      metadata: { status }
    });

    toast.success(`Appointment marked as ${status}`);
  } catch (error) {
    console.error('Error updating appointment status:', error);
    toast.error('Failed to update appointment status');
    throw error;
  }
};

/**
 * Cancel appointment
 */
export const cancelAppointment = async (appointmentId, reason, currentUser, bypassValidation = false) => {
  try {
    const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    const appointment = await getAppointmentById(appointmentId);
    
    // Check 2-hour cancellation window (unless bypassed by staff)
    if (!bypassValidation) {
      const now = new Date();
      // Handle both Firestore Timestamp and Date objects
      const appointmentTime = appointment.appointmentDate instanceof Date 
        ? appointment.appointmentDate 
        : appointment.appointmentDate.toDate();
      const timeDiff = appointmentTime.getTime() - now.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff < 2 && hoursDiff > 0) {
        toast.error('Appointments must be cancelled at least 2 hours in advance');
        throw new Error('Insufficient advance notice for cancellation');
      }
    }
    
    await updateDoc(appointmentRef, {
      status: APPOINTMENT_STATUS.CANCELLED,
      cancellationReason: reason || 'No reason provided',
      cancelledBy: currentUser.uid,
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Get updated appointment for notifications
    const updatedAppointment = await getAppointmentById(appointmentId);

    // Send cancellation notification
    try {
      const appointmentForNotification = {
        ...updatedAppointment,
        appointmentDate: updatedAppointment.appointmentDate
      };
      await storeAppointmentCancelled(appointmentForNotification);
    } catch (error) {
      console.error('Error sending cancellation notification:', error);
      // Don't fail cancellation if notification fails
    }

    // Log activity
    await logActivity({
      performedBy: currentUser.uid,
      action: 'CANCEL_APPOINTMENT',
      targetType: 'appointment',
      targetId: appointmentId,
      details: `Cancelled appointment: ${reason || 'No reason provided'}`,
      metadata: { reason }
    });

    toast.success('Appointment cancelled successfully');
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    toast.error('Failed to cancel appointment');
    throw error;
  }
};

/**
 * Delete appointment
 */
export const deleteAppointment = async (appointmentId, currentUser) => {
  try {
    const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
    
    // Get appointment data before deleting
    const appointment = await getAppointmentById(appointmentId);
    
    await deleteDoc(appointmentRef);

    // Log activity
    await logActivity({
      performedBy: currentUser.uid,
      action: 'DELETE_APPOINTMENT',
      targetType: 'appointment',
      targetId: appointmentId,
      details: `Deleted appointment`,
      metadata: { 
        clientId: appointment.clientId,
        appointmentDate: appointment.appointmentDate
      }
    });

    toast.success('Appointment deleted successfully');
  } catch (error) {
    console.error('Error deleting appointment:', error);
    toast.error('Failed to delete appointment');
    throw error;
  }
};

/**
 * Check stylist availability for a time slot
 * Now checks both old format (stylistId field) and new format (services array)
 */
export const checkStylistAvailability = async (stylistId, appointmentDate, duration = 60, excludeAppointmentId = null) => {
  try {
    if (!stylistId) return true; // If no stylist assigned, allow booking

    const startTime = new Date(appointmentDate);
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    
    // Get all appointments for the date range with active statuses
    // We need to fetch all and filter client-side because Firestore can't query nested array fields
    const dateStart = new Date(appointmentDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(appointmentDate);
    dateEnd.setHours(23, 59, 59, 999);
    
    const q = query(
      appointmentsRef,
      where('appointmentDate', '>=', Timestamp.fromDate(dateStart)),
      where('appointmentDate', '<=', Timestamp.fromDate(dateEnd)),
      where('status', 'in', [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.IN_SERVICE])
    );
    
    const snapshot = await getDocs(q);
    
    for (const doc of snapshot.docs) {
      if (excludeAppointmentId && doc.id === excludeAppointmentId) {
        continue; // Skip the appointment being updated
      }

      const existingAppointment = doc.data();
      
      // Check if stylist is assigned to this appointment
      let isStylistAssigned = false;
      
      // Check old format (single stylistId field)
      if (existingAppointment.stylistId === stylistId) {
        isStylistAssigned = true;
      }
      
      // Check new format (services array)
      if (existingAppointment.services && Array.isArray(existingAppointment.services)) {
        const hasStylist = existingAppointment.services.some(svc => svc.stylistId === stylistId);
        if (hasStylist) {
          isStylistAssigned = true;
        }
      }
      
      if (!isStylistAssigned) {
        continue; // This appointment doesn't involve the stylist we're checking
      }
      
      // Stylist is assigned, now check for time overlap
      const existingStart = existingAppointment.appointmentDate.toDate();
      const existingEnd = new Date(existingStart.getTime() + (existingAppointment.duration || 60) * 60000);

      // Check for overlap
      if (
        (startTime >= existingStart && startTime < existingEnd) ||
        (endTime > existingStart && endTime <= existingEnd) ||
        (startTime <= existingStart && endTime >= existingEnd)
      ) {
        return false; // Time slot is not available
      }
    }

    return true; // Time slot is available
  } catch (error) {
    console.error('Error checking stylist availability:', error);
    return false;
  }
};

/**
 * Get available time slots for a stylist on a specific date
 * Now integrated with branch operating hours and calendar
 * @returns {Object} { slots: Array, message: string|null }
 */
export const getAvailableTimeSlots = async (stylistId, branchId, date, serviceDuration = 60) => {
  try {
    // Get branch data for operating hours
    const branch = await getBranchById(branchId);
    if (!branch) {
      console.error('Branch not found:', branchId);
      return { slots: [], message: 'Branch not found' };
    }

    // Get day of week
    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Get operating hours for this day
    const dayHours = branch.operatingHours?.[dayOfWeek];
    if (!dayHours) {
      return { slots: [], message: 'No operating hours configured for this branch' };
    }
    
    // Check if branch is open (backwards compatible with old 'closed' field)
    const isBranchOpen = dayHours.isOpen !== undefined 
      ? dayHours.isOpen 
      : !dayHours.closed; // Fallback to old field
    
    if (!isBranchOpen) {
      return { slots: [], message: `Branch is closed on ${dayName}s` };
    }

    // Check calendar for holidays/closures
    const calendar = await getBranchCalendar(branchId);
    const dateString = selectedDate.toISOString().split('T')[0];
    
    const dayEvents = calendar.filter(entry => {
      // entry.date is already a Date object (converted by getBranchCalendar)
      const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
      const entryDateString = entryDate.toISOString().split('T')[0];
      return entryDateString === dateString;
    });

    // Check if there's a holiday or closure
    const closureEvent = dayEvents.find(e => e.type === 'holiday' || e.type === 'closure');
    if (closureEvent) {
      const reason = closureEvent.type === 'holiday' ? 'Holiday' : 'Temporary Closure';
      const title = closureEvent.title ? ` (${closureEvent.title})` : '';
      return { slots: [], message: `${reason}${title} - No appointments available` };
    }

    // Check for special hours
    const specialHours = dayEvents.find(e => e.type === 'special_hours');
    const workingHours = specialHours?.specialHours || dayHours;

    // Parse start and end times
    const [startHour, startMinute] = workingHours.open.split(':').map(Number);
    const [endHour, endMinute] = workingHours.close.split(':').map(Number);

    // OPTIMIZATION: Fetch ALL appointments for the day at once
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    
    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const q = query(
      appointmentsRef,
      where('branchId', '==', branchId),
      where('appointmentDate', '>=', Timestamp.fromDate(dayStart)),
      where('appointmentDate', '<=', Timestamp.fromDate(dayEnd)),
      where('status', 'in', [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.IN_SERVICE])
    );
    const snapshot = await getDocs(q);
    const dayAppointments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      appointmentDate: doc.data().appointmentDate?.toDate()
    }));

    const slots = [];
    const slotDate = new Date(date);
    slotDate.setHours(startHour, startMinute, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(endHour, endMinute, 0, 0);

    // Generate all possible time slots (30-minute intervals)
    while (slotDate.getTime() < endTime.getTime()) {
      const slotEnd = new Date(slotDate.getTime() + serviceDuration * 60000);
      
      // Check if slot end time is within working hours
      if (slotEnd.getTime() <= endTime.getTime()) {
        // Check availability from in-memory appointments instead of database query
        let isAvailable = true;
        
        if (stylistId) {
          // Check if this specific stylist has conflicts
          for (const apt of dayAppointments) {
            const aptStart = apt.appointmentDate;
            const aptEnd = new Date(aptStart.getTime() + (apt.duration || 60) * 60000);
            
            // Check if stylist is assigned to this appointment
            const hasStylist = apt.services?.some(svc => svc.stylistId === stylistId);
            if (hasStylist) {
              // Check for time overlap
              if (slotDate < aptEnd && slotEnd > aptStart) {
                isAvailable = false;
                break;
              }
            }
          }
        }
        
        slots.push({
          time: new Date(slotDate),
          available: isAvailable
        });
      }

      slotDate.setMinutes(slotDate.getMinutes() + 30); // 30-minute intervals
    }

    return { slots, message: null };
  } catch (error) {
    console.error('Error getting available time slots:', error);
    return { slots: [], message: 'Error loading time slots. Please try again.' };
  }
};

/**
 * Get appointment statistics for a branch
 */
export const getAppointmentStats = async (branchId, startDate, endDate) => {
  try {
    const appointments = await getAppointmentsByDateRange(branchId, startDate, endDate);

    const stats = {
      total: appointments.length,
      pending: appointments.filter(a => a.status === APPOINTMENT_STATUS.PENDING).length,
      confirmed: appointments.filter(a => a.status === APPOINTMENT_STATUS.CONFIRMED).length,
      completed: appointments.filter(a => a.status === APPOINTMENT_STATUS.COMPLETED).length,
      cancelled: appointments.filter(a => a.status === APPOINTMENT_STATUS.CANCELLED).length,
      noShow: appointments.filter(a => a.status === APPOINTMENT_STATUS.NO_SHOW).length,
      inService: appointments.filter(a => a.status === APPOINTMENT_STATUS.IN_SERVICE).length
    };

    return stats;
  } catch (error) {
    console.error('Error getting appointment stats:', error);
    return null;
  }
};

/**
 * Get today's appointment statistics for a branch (Receptionist)
 */
export const getTodayAppointmentStats = async (branchId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await getAppointmentsByDateRange(branchId, today, tomorrow);

    const stats = {
      today: appointments.length,
      pending: appointments.filter(a => a.status === APPOINTMENT_STATUS.PENDING).length,
      confirmed: appointments.filter(a => a.status === APPOINTMENT_STATUS.CONFIRMED).length,
      completed: appointments.filter(a => a.status === APPOINTMENT_STATUS.COMPLETED).length,
      cancelled: appointments.filter(a => a.status === APPOINTMENT_STATUS.CANCELLED).length,
      inService: appointments.filter(a => a.status === APPOINTMENT_STATUS.IN_SERVICE).length
    };

    return stats;
  } catch (error) {
    console.error('Error getting today appointment stats:', error);
    return null;
  }
};

/**
 * Get today's appointment statistics for a stylist
 */
export const getStylistTodayStats = async (stylistId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
    const q = query(
      appointmentsRef,
      where('stylistId', '==', stylistId),
      where('appointmentDate', '>=', Timestamp.fromDate(today)),
      where('appointmentDate', '<', Timestamp.fromDate(tomorrow))
    );

    const snapshot = await getDocs(q);
    const appointments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // For multi-service appointments, also get appointments where stylist is in services array
    const multiServiceQuery = query(
      appointmentsRef,
      where('appointmentDate', '>=', Timestamp.fromDate(today)),
      where('appointmentDate', '<', Timestamp.fromDate(tomorrow))
    );

    const multiServiceSnapshot = await getDocs(multiServiceQuery);
    const multiServiceAppointments = multiServiceSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(apt => 
        apt.services && 
        apt.services.some(svc => svc.stylistId === stylistId)
      );

    // Combine and deduplicate
    const allAppointments = [...appointments];
    multiServiceAppointments.forEach(apt => {
      if (!allAppointments.find(a => a.id === apt.id)) {
        allAppointments.push(apt);
      }
    });

    const stats = {
      today: allAppointments.length,
      pending: allAppointments.filter(a => 
        a.status === APPOINTMENT_STATUS.PENDING || 
        a.status === APPOINTMENT_STATUS.CONFIRMED
      ).length,
      inService: allAppointments.filter(a => a.status === APPOINTMENT_STATUS.IN_SERVICE).length,
      completed: allAppointments.filter(a => a.status === APPOINTMENT_STATUS.COMPLETED).length
    };

    return stats;
  } catch (error) {
    console.error('Error getting stylist today stats:', error);
    return null;
  }
};

export default {
  getAllAppointments,
  getAppointmentsByBranch,
  getAppointmentsByClient,
  getAppointmentsByStylist,
  getAppointmentsByDateRange,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
  cancelAppointment,
  deleteAppointment,
  checkStylistAvailability,
  getAvailableTimeSlots,
  getAppointmentStats,
  getTodayAppointmentStats,
  getStylistTodayStats,
  APPOINTMENT_STATUS
};
