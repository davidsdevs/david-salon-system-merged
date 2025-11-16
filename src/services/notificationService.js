    /**
     * Notification Service
     * Module: M03 - Appointment Management
     * Stores notification data in Firestore for mobile app consumption
     * 
     * This service ONLY stores notification data in the database.
     * It does NOT send actual notifications (no push, no email, no SMS).
     * The mobile app team will fetch these notifications from the database.
     */

    import { 
    collection, 
    addDoc, 
    updateDoc,
    doc,
    query,
    where,
    orderBy,
    getDocs,
    limit as firestoreLimit,
    serverTimestamp
    } from 'firebase/firestore';
    import { db } from '../config/firebase';
    import { getBranchById } from './branchService';
    import { getUserById } from './userService';

    const NOTIFICATIONS_COLLECTION = 'notifications';

    // Notification types
    export const NOTIFICATION_TYPES = {
    APPOINTMENT_CREATED: 'appointment_created',
    APPOINTMENT_CONFIRMED: 'appointment_confirmed',
    APPOINTMENT_CANCELLED: 'appointment_cancelled',
    APPOINTMENT_REMINDER: 'appointment_reminder',
    APPOINTMENT_COMPLETED: 'appointment_completed',
    APPOINTMENT_RESCHEDULED: 'appointment_rescheduled',
    APPOINTMENT_UPDATED: 'appointment_updated',
    APPOINTMENT_STARTING: 'appointment_starting',
    APPOINTMENT_IN_SERVICE: 'appointment_in_service',
    APPOINTMENT_TRANSFERRED: 'appointment_transferred'
    };

    // Notification channels for mobile app
    export const NOTIFICATION_CHANNELS = {
    APPOINTMENTS: 'appointments',
    REMINDERS: 'reminders',
    URGENT: 'urgent',
    GENERAL: 'general'
    };

    // Push notification priorities
    export const NOTIFICATION_PRIORITIES = {
    HIGH: 'high',
    NORMAL: 'normal',
    LOW: 'low'
    };

    /**
     * Create a notification
     * @param {Object} notificationData - Notification data
     * @returns {Promise<string>} - Notification ID
     */
    export const createNotification = async (notificationData) => {
    try {
        const notification = {
        type: notificationData.type,
        title: notificationData.title || 'Notification',
        message: notificationData.message || 'You have a new notification',
        recipientId: notificationData.recipientId,
        recipientRole: notificationData.recipientRole,
        appointmentId: notificationData.appointmentId,
        createdAt: serverTimestamp(),
        isRead: false,
        clientName: notificationData.clientName || 'Unknown Client',
        stylistName: notificationData.stylistName || 'Unassigned Stylist',
        appointmentDate: notificationData.appointmentDate || null,
        appointmentTime: notificationData.appointmentTime || null,
        branchName: notificationData.branchName || 'David\'s Salon'
        };

        const docRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), notification);
        
        console.log('📱 Notification created:', {
        id: docRef.id,
        type: notification.type,
        recipientId: notification.recipientId,
        title: notification.title
        });
        
        return docRef.id;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
    };

    /**
     * Send appointment notification
     * @param {string} type - Notification type
     * @param {Object} appointmentData - Appointment data
     * @param {string} recipientId - Recipient user ID
     * @param {string} recipientRole - Recipient role ('client' or 'stylist')
     * @returns {Promise<string>} - Notification ID
     */
    export const sendAppointmentNotification = async (type, appointmentData, recipientId, recipientRole) => {
    try {
        let title = '';
        let message = '';

        const isClient = recipientRole === 'client';
        const isStylist = recipientRole === 'stylist';

        // Format appointment date and time
        const appointmentDate = appointmentData.appointmentDate 
        ? (appointmentData.appointmentDate instanceof Date 
            ? appointmentData.appointmentDate 
            : appointmentData.appointmentDate.toDate?.() || new Date(appointmentData.appointmentDate))
        : null;
        
        const formattedDate = appointmentDate 
        ? appointmentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'N/A';
        
        const formattedTime = appointmentDate
        ? appointmentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : 'N/A';

        switch (type) {
        case NOTIFICATION_TYPES.APPOINTMENT_CREATED:
            if (isClient) {
            title = 'Appointment Booked Successfully';
            message = `Your appointment has been scheduled for ${formattedDate} at ${formattedTime}`;
            } else if (isStylist) {
            title = 'New Appointment Assigned';
            message = `You have a new appointment with ${appointmentData.clientName || 'a client'} on ${formattedDate}`;
            }
            break;

        case NOTIFICATION_TYPES.APPOINTMENT_CONFIRMED:
            if (isClient) {
            title = 'Appointment Confirmed';
            message = `Your appointment for ${formattedDate} has been confirmed`;
            } else if (isStylist) {
            title = 'Appointment Confirmed';
            message = `Appointment with ${appointmentData.clientName || 'client'} has been confirmed`;
            }
            break;

        case NOTIFICATION_TYPES.APPOINTMENT_CANCELLED:
            if (isClient) {
            title = 'Appointment Cancelled';
            message = `Your appointment for ${formattedDate} has been cancelled`;
            } else if (isStylist) {
            title = 'Appointment Cancelled';
            message = `Appointment with ${appointmentData.clientName || 'client'} has been cancelled`;
            }
            break;

        case NOTIFICATION_TYPES.APPOINTMENT_REMINDER:
            if (isClient) {
            title = 'Appointment Reminder';
            message = `Reminder: You have an appointment tomorrow at ${formattedTime}`;
            } else if (isStylist) {
            title = 'Appointment Reminder';
            message = `Reminder: You have an appointment with ${appointmentData.clientName || 'client'} tomorrow`;
            }
            break;

        case NOTIFICATION_TYPES.APPOINTMENT_COMPLETED:
            if (isClient) {
            title = 'Thank You for Visiting!';
            message = `Thank you for visiting David's Salon. We hope you enjoyed your experience!`;
            } else if (isStylist) {
            title = 'Appointment Completed';
            message = `Appointment with ${appointmentData.clientName || 'client'} has been completed`;
            }
            break;

        case NOTIFICATION_TYPES.APPOINTMENT_RESCHEDULED:
            if (isClient) {
            title = 'Appointment Rescheduled';
            const newDate = appointmentData.newAppointmentDate 
                ? new Date(appointmentData.newAppointmentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : formattedDate;
            message = `Your appointment has been rescheduled to ${newDate}`;
            } else if (isStylist) {
            title = 'Appointment Rescheduled';
            message = `Appointment with ${appointmentData.clientName || 'client'} has been rescheduled`;
            }
            break;

        case NOTIFICATION_TYPES.APPOINTMENT_IN_SERVICE:
            if (isClient) {
            title = 'Service Started';
            message = `Your service has started. We hope you enjoy your experience!`;
            } else if (isStylist) {
            title = 'Service Started';
            message = `Service for ${appointmentData.clientName || 'client'} has started`;
            }
            break;

        case NOTIFICATION_TYPES.APPOINTMENT_STARTING:
            if (isStylist) {
            title = 'Appointment Starting Soon';
            message = `Your appointment with ${appointmentData.clientName || 'client'} is starting in 15 minutes`;
            }
            break;

        default:
            title = 'Appointment Update';
            message = `Appointment updated for ${appointmentData.clientName || 'client'}`;
        }

        // Extract stylist name
        let stylistName = null;
        if (appointmentData.stylistName) {
        stylistName = appointmentData.stylistName;
        } else if (appointmentData.services && Array.isArray(appointmentData.services)) {
        const firstService = appointmentData.services.find(s => s.stylistName);
        if (firstService) {
            stylistName = firstService.stylistName;
        }
        }

        const notification = {
        type,
        title,
        message,
        recipientId,
        recipientRole,
        appointmentId: appointmentData.id,
        clientName: appointmentData.clientName || 'Unknown Client',
        stylistName: stylistName || 'Unassigned Stylist',
        appointmentDate: formattedDate,
        appointmentTime: formattedTime,
        branchName: appointmentData.branchName || 'David\'s Salon'
        };

        return await createNotification(notification);
    } catch (error) {
        console.error('Error sending appointment notification:', error);
        throw error;
    }
    };

    /**
     * Extract stylist IDs from appointment data
     * @param {Object} appointmentData - Appointment data
     * @returns {Array<string>} - Array of stylist IDs
     */
    const extractStylistIds = (appointmentData) => {
    let stylistIds = [];
    
    // Handle services array (new format)
    if (appointmentData.services && Array.isArray(appointmentData.services)) {
        stylistIds = appointmentData.services
        .map(service => service.stylistId)
        .filter(id => id && id !== 'any_available');
    }
    
    // Handle single stylistId (legacy format)
    if (appointmentData.stylistId && !stylistIds.includes(appointmentData.stylistId)) {
        stylistIds.push(appointmentData.stylistId);
    }
    
    // Remove duplicates
    return [...new Set(stylistIds)];
    };

    /**
     * Enrich appointment data with branch name and client name if missing
     * @param {Object} appointmentData - Appointment data
     * @returns {Promise<Object>} - Enriched appointment data
     */
    const enrichAppointmentData = async (appointmentData) => {
    try {
        const enriched = { ...appointmentData };

        // Fetch branch name if missing
        if (!enriched.branchName && enriched.branchId) {
        try {
            const branch = await getBranchById(enriched.branchId);
            if (branch) {
            enriched.branchName = branch.name || branch.branchName || 'David\'s Salon';
            }
        } catch (error) {
            console.error('Error fetching branch for notification:', error);
        }
        }

        // Fetch client name if missing but clientId is present
        if (!enriched.clientName && enriched.clientId) {
        try {
            const client = await getUserById(enriched.clientId);
            if (client) {
            enriched.clientName = `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.displayName || 'Client';
            }
        } catch (error) {
            console.error('Error fetching client for notification:', error);
        }
        }

        // Fetch stylist names if missing (for transfer notifications)
        if (enriched.oldStylistId && !enriched.oldStylistName) {
        try {
            const oldStylist = await getUserById(enriched.oldStylistId);
            if (oldStylist) {
            enriched.oldStylistName = `${oldStylist.firstName || ''} ${oldStylist.lastName || ''}`.trim() || oldStylist.displayName || 'Previous Stylist';
            }
        } catch (error) {
            console.error('Error fetching old stylist for notification:', error);
        }
        }

        if (enriched.newStylistId && !enriched.newStylistName) {
        try {
            const newStylist = await getUserById(enriched.newStylistId);
            if (newStylist) {
            enriched.newStylistName = `${newStylist.firstName || ''} ${newStylist.lastName || ''}`.trim() || newStylist.displayName || 'New Stylist';
            }
        } catch (error) {
            console.error('Error fetching new stylist for notification:', error);
        }
        }

        return enriched;
    } catch (error) {
        console.error('Error enriching appointment data:', error);
        return appointmentData;
    }
    };

    /**
     * Store notification for all participants (client + stylists)
     * @param {string} type - Notification type
     * @param {Object} appointmentData - Appointment data
     * @returns {Promise<Array>} - Array of notification IDs
     */
    export const storeNotificationForAllParticipants = async (type, appointmentData) => {
    try {
        const allNotifications = [];
        
        console.log(`Storing ${type} notification for ALL participants for appointment:`, appointmentData.id);
        
        // Enrich appointment data with branch name if needed
        const enrichedAppointmentData = await enrichAppointmentData(appointmentData);
        
        // Store for client
        if (enrichedAppointmentData.clientId) {
        try {
            const clientNotificationId = await sendAppointmentNotification(
            type,
            enrichedAppointmentData,
            enrichedAppointmentData.clientId,
            'client'
            );
            if (clientNotificationId) {
            allNotifications.push(clientNotificationId);
            console.log('✅ Client notification stored');
            }
        } catch (error) {
            console.error('❌ Error storing client notification:', error);
        }
        }
        
        // Store for all stylists
        const stylistIds = extractStylistIds(enrichedAppointmentData);
        for (const stylistId of stylistIds) {
        try {
            const stylistNotificationId = await sendAppointmentNotification(
            type,
            enrichedAppointmentData,
            stylistId,
            'stylist'
            );
            allNotifications.push(stylistNotificationId);
            console.log(`✅ Stylist notification stored for ${stylistId}`);
        } catch (error) {
            console.error(`❌ Error storing stylist notification for ${stylistId}:`, error);
        }
        }
        
        console.log(`✅ Total notifications stored: ${allNotifications.length}`);
        console.log(`   - Client: ${enrichedAppointmentData.clientId ? 'Yes' : 'No'}`);
        console.log(`   - Stylists: ${stylistIds.length}`);
        
        return allNotifications;
    } catch (error) {
        console.error('Error storing notification for all participants:', error);
        throw error;
    }
    };

    /**
     * Store appointment created notification
     */
    export const storeAppointmentCreated = async (appointmentData) => {
    return await storeNotificationForAllParticipants(
        NOTIFICATION_TYPES.APPOINTMENT_CREATED,
        appointmentData
    );
    };

    /**
     * Store appointment confirmed notification
     */
    export const storeAppointmentConfirmed = async (appointmentData) => {
    return await storeNotificationForAllParticipants(
        NOTIFICATION_TYPES.APPOINTMENT_CONFIRMED,
        appointmentData
    );
    };

    /**
     * Store appointment cancelled notification
     */
    export const storeAppointmentCancelled = async (appointmentData) => {
    return await storeNotificationForAllParticipants(
        NOTIFICATION_TYPES.APPOINTMENT_CANCELLED,
        appointmentData
    );
    };

    /**
     * Store appointment rescheduled notification
     */
    export const storeAppointmentRescheduled = async (appointmentData) => {
    return await storeNotificationForAllParticipants(
        NOTIFICATION_TYPES.APPOINTMENT_RESCHEDULED,
        appointmentData
    );
    };

    /**
     * Store appointment completed notification
     */
    export const storeAppointmentCompleted = async (appointmentData) => {
    return await storeNotificationForAllParticipants(
        NOTIFICATION_TYPES.APPOINTMENT_COMPLETED,
        appointmentData
    );
    };

    /**
     * Store appointment in service notification
     */
    export const storeAppointmentInService = async (appointmentData) => {
    return await storeNotificationForAllParticipants(
        NOTIFICATION_TYPES.APPOINTMENT_IN_SERVICE,
        appointmentData
    );
    };

    /**
     * Store appointment transferred notification
     * Sends notifications to client, old stylist, and new stylist
     * @param {Object} appointmentData - Appointment data with oldStylistId and newStylistId
     * @returns {Promise<Array>} - Array of notification IDs
     */
    export const storeAppointmentTransferred = async (appointmentData) => {
    try {
        const enrichedData = await enrichAppointmentData(appointmentData);
        const notifications = [];

        // Format date and time
        const appointmentDate = enrichedData.appointmentDate instanceof Date 
        ? enrichedData.appointmentDate 
        : enrichedData.appointmentDate?.toDate?.() || new Date(enrichedData.appointmentDate);
        const formattedDate = appointmentDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
        });
        const formattedTime = appointmentDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
        });

        const oldStylistName = enrichedData.oldStylistName || 'Previous Stylist';
        const newStylistName = enrichedData.newStylistName || 'New Stylist';

        // Notification for Client
        if (enrichedData.clientId) {
        const clientNotification = await createNotification({
            type: NOTIFICATION_TYPES.APPOINTMENT_TRANSFERRED,
            title: 'Appointment Stylist Transferred',
            message: `Your appointment on ${formattedDate} at ${formattedTime} has been transferred from ${oldStylistName} to ${newStylistName}.`,
            recipientId: enrichedData.clientId,
            recipientRole: 'client',
            appointmentId: enrichedData.id || enrichedData.appointmentId,
            clientName: enrichedData.clientName,
            stylistName: newStylistName,
            appointmentDate: formattedDate,
            appointmentTime: formattedTime,
            branchName: enrichedData.branchName
        });
        notifications.push(clientNotification);
        }

        // Notification for Old Stylist
        if (enrichedData.oldStylistId) {
        const oldStylistNotification = await createNotification({
            type: NOTIFICATION_TYPES.APPOINTMENT_TRANSFERRED,
            title: 'Appointment Transferred',
            message: `The appointment with ${enrichedData.clientName} on ${formattedDate} at ${formattedTime} has been transferred to ${newStylistName}.`,
            recipientId: enrichedData.oldStylistId,
            recipientRole: 'stylist',
            appointmentId: enrichedData.id || enrichedData.appointmentId,
            clientName: enrichedData.clientName,
            stylistName: oldStylistName,
            appointmentDate: formattedDate,
            appointmentTime: formattedTime,
            branchName: enrichedData.branchName
        });
        notifications.push(oldStylistNotification);
        }

        // Notification for New Stylist
        if (enrichedData.newStylistId) {
        const newStylistNotification = await createNotification({
            type: NOTIFICATION_TYPES.APPOINTMENT_TRANSFERRED,
            title: 'Appointment Transferred to You',
            message: `An appointment with ${enrichedData.clientName} on ${formattedDate} at ${formattedTime} has been transferred to you from ${oldStylistName}.`,
            recipientId: enrichedData.newStylistId,
            recipientRole: 'stylist',
            appointmentId: enrichedData.id || enrichedData.appointmentId,
            clientName: enrichedData.clientName,
            stylistName: newStylistName,
            appointmentDate: formattedDate,
            appointmentTime: formattedTime,
            branchName: enrichedData.branchName
        });
        notifications.push(newStylistNotification);
        }

        console.log('📱 Transfer notifications created:', notifications.length);
        return notifications;
    } catch (error) {
        console.error('Error storing transfer notifications:', error);
        throw error;
    }
    };

    /**
     * Get notifications for a user
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} - Array of notifications
     */
    export const getNotifications = async (userId, options = {}) => {
    try {
        const {
        unreadOnly = false,
        limitCount = 50,
        orderByField = 'createdAt',
        orderDirection = 'desc'
        } = options;

        const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
        const constraints = [where('recipientId', '==', userId)];

        if (unreadOnly) {
        constraints.push(where('isRead', '==', false));
        }

        constraints.push(orderBy(orderByField, orderDirection));
        constraints.push(firestoreLimit(limitCount));

        const q = query(notificationsRef, ...constraints);
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        appointmentDate: doc.data().appointmentDate
        }));
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }
    };

    /**
     * Mark notification as read
     * @param {string} notificationId - Notification ID
     * @returns {Promise<void>}
     */
    export const markNotificationAsRead = async (notificationId) => {
    try {
        const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
        await updateDoc(notificationRef, {
        isRead: true
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
    };

    /**
     * Mark all notifications as read for a user
     * @param {string} userId - User ID
     * @returns {Promise<number>} - Number of notifications marked as read
     */
    export const markAllNotificationsAsRead = async (userId) => {
    try {
        const notifications = await getNotifications(userId, { unreadOnly: true });
        let count = 0;

        for (const notification of notifications) {
        try {
            await markNotificationAsRead(notification.id);
            count++;
        } catch (error) {
            console.error(`Error marking notification ${notification.id} as read:`, error);
        }
        }

        return count;
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
    };

    /**
     * Get unread notification count
     * @param {string} userId - User ID
     * @returns {Promise<number>} - Unread count
     */
    export const getUnreadNotificationCount = async (userId) => {
    try {
        const notifications = await getNotifications(userId, { unreadOnly: true, limitCount: 1000 });
        return notifications.length;
    } catch (error) {
        console.error('Error getting unread notification count:', error);
        return 0;
    }
    };

