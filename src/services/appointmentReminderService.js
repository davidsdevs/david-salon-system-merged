/**
 * Appointment Reminder Service
 * Handles checking and sending appointment reminders
 */

import { 
    collection, 
    query, 
    where, 
    getDocs,
    updateDoc,
    doc,
    Timestamp
  } from 'firebase/firestore';
  import { db } from '../config/firebase';
  import { APPOINTMENT_STATUS, getAppointmentsByDateRange } from './appointmentService';
  import { 
    storeNotificationForAllParticipants,
    NOTIFICATION_TYPES 
  } from './notificationService';
  
  const APPOINTMENTS_COLLECTION = 'appointments';
  
  /**
   * Trigger reminder check for a branch
   * Checks for appointments that need reminders and sends them
   * @param {string} branchId - Branch ID
   * @returns {Promise<{success: boolean, remindersSent: number}>}
   */
  export const triggerReminderCheck = async (branchId) => {
    try {
      if (!branchId) {
        console.warn('⚠️ No branchId provided for reminder check');
        return { success: false, remindersSent: 0 };
      }
  
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
  
      // Get appointments for tomorrow (24-hour reminder window)
      const appointments = await getAppointmentsByDateRange(branchId, tomorrow, tomorrow);
  
      // Filter appointments that need reminders:
      // 1. Status is CONFIRMED or PENDING
      // 2. Reminder hasn't been sent yet (reminderSent24h !== true)
      // 3. Appointment is within 24-25 hours from now
      const nowTime = now.getTime();
      const remindersToSend = appointments.filter(apt => {
        const aptDate = apt.appointmentDate instanceof Date 
          ? apt.appointmentDate 
          : new Date(apt.appointmentDate);
        
        const aptTime = aptDate.getTime();
        const hoursUntilAppointment = (aptTime - nowTime) / (1000 * 60 * 60);
        
        // Check if appointment is between 20-28 hours away (24-hour reminder window with buffer)
        const needsReminder = 
          (apt.status === APPOINTMENT_STATUS.CONFIRMED || apt.status === APPOINTMENT_STATUS.PENDING) &&
          !apt.reminderSent24h &&
          hoursUntilAppointment >= 20 &&
          hoursUntilAppointment <= 28;
  
        return needsReminder;
      });
  
      let remindersSent = 0;
  
      // Send reminders for each appointment
      for (const appointment of remindersToSend) {
        try {
          // Send reminder notification
          await storeNotificationForAllParticipants(
            NOTIFICATION_TYPES.APPOINTMENT_REMINDER,
            appointment
          );
  
          // Mark reminder as sent
          const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointment.id);
          await updateDoc(appointmentRef, {
            reminderSent24h: true,
            reminderSent24hAt: Timestamp.now()
          });
  
          remindersSent++;
          console.log(`✅ Reminder sent for appointment ${appointment.id} (${appointment.clientName})`);
        } catch (error) {
          console.error(`❌ Error sending reminder for appointment ${appointment.id}:`, error);
          // Continue with other appointments even if one fails
        }
      }
  
      console.log(`📧 Reminder check completed: ${remindersSent} reminder(s) sent for branch ${branchId}`);
  
      return {
        success: true,
        remindersSent
      };
    } catch (error) {
      console.error('Error triggering reminder check:', error);
      return {
        success: false,
        remindersSent: 0
      };
    }
  };
  
  /**
   * Send reminder for a specific appointment
   * @param {string} appointmentId - Appointment ID
   * @returns {Promise<{success: boolean}>}
   */
  export const sendAppointmentReminder = async (appointmentId) => {
    try {
      const { getAppointmentById } = await import('./appointmentService');
      const appointment = await getAppointmentById(appointmentId);
  
      if (!appointment) {
        return { success: false, error: 'Appointment not found' };
      }
  
      // Check if appointment is confirmed or pending
      if (appointment.status !== APPOINTMENT_STATUS.CONFIRMED && 
          appointment.status !== APPOINTMENT_STATUS.PENDING) {
        return { success: false, error: 'Can only send reminders for confirmed or pending appointments' };
      }
  
      // Send reminder notification
      await storeNotificationForAllParticipants(
        NOTIFICATION_TYPES.APPOINTMENT_REMINDER,
        appointment
      );
  
      // Mark reminder as sent
      const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
      await updateDoc(appointmentRef, {
        reminderSent24h: true,
        reminderSent24hAt: Timestamp.now()
      });
  
      return { success: true };
    } catch (error) {
      console.error('Error sending appointment reminder:', error);
      return { success: false, error: error.message };
    }
  };
  
  