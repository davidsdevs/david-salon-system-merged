/**
 * Seed Appointments
 * Creates test appointments for a specific branch
 */

import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const BRANCH_ID = 'KYiL9JprSX3LBOYzrF6e';
const RECEPTIONIST_ID = '6uwV16gCEuKkWOuQV3Py';
const APPOINTMENTS_COLLECTION = 'appointments';
const USERS_COLLECTION = 'users';
const SERVICES_COLLECTION = 'services';

const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_SERVICE: 'in_service',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show'
};

// Guest client names for variety
const GUEST_NAMES = [
  'Maria Santos', 'Juan Dela Cruz', 'Anna Garcia', 'Carlos Rodriguez', 'Lisa Martinez',
  'Michael Tan', 'Sarah Lee', 'David Chen', 'Jennifer Wong', 'Robert Kim',
  'Amanda Torres', 'James Rivera', 'Michelle Cruz', 'Christopher Ong', 'Patricia Lim',
  'Daniel Yu', 'Nicole Chua', 'Mark Ang', 'Rachel Teo', 'Kevin Goh'
];

/**
 * Get branch services
 */
const getBranchServices = async () => {
  const servicesRef = collection(db, SERVICES_COLLECTION);
  const q = query(servicesRef, where('isActive', '==', true));
  const snapshot = await getDocs(q);
  
  const allServices = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  // Filter to only those offered by this branch
  return allServices.filter(service => {
    const branchPricing = service.branchPricing || {};
    return branchPricing[BRANCH_ID] !== undefined;
  });
};

/**
 * Get branch stylists
 */
const getBranchStylists = async () => {
  const usersRef = collection(db, USERS_COLLECTION);
  const q = query(
    usersRef,
    where('branchId', '==', BRANCH_ID),
    where('role', '==', 'stylist')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

/**
 * Get branch data
 */
const getBranchData = async () => {
  const branchRef = doc(db, 'branches', BRANCH_ID);
  const branchSnap = await getDoc(branchRef);
  if (!branchSnap.exists()) {
    throw new Error('Branch not found');
  }
  return {
    id: branchSnap.id,
    ...branchSnap.data()
  };
};

/**
 * Ensure stylists have services assigned
 */
const ensureStylistsHaveServices = async (stylists, services) => {
  const updatedStylists = [...stylists];
  
  // Assign services to stylists who don't have any
  for (let i = 0; i < updatedStylists.length; i++) {
    const stylist = updatedStylists[i];
    const serviceIds = stylist.service_id || stylist.serviceId || [];
    
    if (serviceIds.length === 0) {
      // Assign 2-3 random services
      const numServices = Math.floor(Math.random() * 2) + 2; // 2 or 3
      const shuffled = [...services].sort(() => 0.5 - Math.random());
      const selectedServices = shuffled.slice(0, numServices).map(s => s.id);
      
      const stylistRef = doc(db, USERS_COLLECTION, stylist.id);
      await updateDoc(stylistRef, {
        service_id: selectedServices
      });
      
      updatedStylists[i] = {
        ...stylist,
        service_id: selectedServices,
        serviceId: selectedServices
      };
    }
  }
  
  // Ensure every service has at least one stylist
  for (const service of services) {
    const hasStylist = updatedStylists.some(stylist => {
      const serviceIds = stylist.service_id || stylist.serviceId || [];
      return serviceIds.includes(service.id);
    });
    
    if (!hasStylist && updatedStylists.length > 0) {
      // Assign to random stylist
      const randomStylist = updatedStylists[Math.floor(Math.random() * updatedStylists.length)];
      const serviceIds = randomStylist.service_id || randomStylist.serviceId || [];
      const newServiceIds = [...serviceIds, service.id];
      
      const stylistRef = doc(db, USERS_COLLECTION, randomStylist.id);
      await updateDoc(stylistRef, {
        service_id: newServiceIds
      });
      
      const stylistIndex = updatedStylists.findIndex(s => s.id === randomStylist.id);
      updatedStylists[stylistIndex] = {
        ...randomStylist,
        service_id: newServiceIds,
        serviceId: newServiceIds
      };
    }
  }
  
  return updatedStylists;
};

/**
 * Get available stylist for a service
 */
const getAvailableStylistForService = async (serviceId, stylists) => {
  // Find stylist who offers this service
  let stylist = stylists.find(s => {
    const serviceIds = s.service_id || s.serviceId || [];
    return serviceIds.includes(serviceId);
  });
  
  // If no stylist found, assign to random stylist and update
  if (!stylist && stylists.length > 0) {
    stylist = stylists[Math.floor(Math.random() * stylists.length)];
    const serviceIds = stylist.service_id || stylist.serviceId || [];
    const newServiceIds = [...serviceIds, serviceId];
    
    const stylistRef = doc(db, USERS_COLLECTION, stylist.id);
    await updateDoc(stylistRef, {
      service_id: newServiceIds
    });
    
    stylist = {
      ...stylist,
      service_id: newServiceIds,
      serviceId: newServiceIds
    };
  }
  
  return stylist;
};

/**
 * Generate random date
 */
const generateDate = (daysOffset, hour = null, minute = null) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  
  if (hour !== null) {
    date.setHours(hour, minute !== null ? minute : Math.floor(Math.random() * 4) * 15, 0, 0);
  } else {
    // Random time between 9 AM and 6 PM
    const randomHour = 9 + Math.floor(Math.random() * 9);
    const randomMinute = Math.floor(Math.random() * 4) * 15;
    date.setHours(randomHour, randomMinute, 0, 0);
  }
  
  return date;
};

/**
 * Create appointment
 */
const createAppointment = async (appointmentData, branchData) => {
  const appointmentsRef = collection(db, APPOINTMENTS_COLLECTION);
  
  const newAppointment = {
    ...appointmentData,
    branchName: branchData.name || branchData.branchName || '',
    appointmentDate: Timestamp.fromDate(appointmentData.appointmentDate),
    createdBy: RECEPTIONIST_ID,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    history: [{
      action: 'created',
      by: RECEPTIONIST_ID,
      timestamp: new Date().toISOString(),
      notes: 'Seeded test appointment'
    }]
  };
  
  const docRef = await addDoc(appointmentsRef, newAppointment);
  return docRef.id;
};

/**
 * Main seed function
 */
export const seedAppointments = async () => {
  try {
    console.log('Starting appointment seeding...');
    
    // Fetch data
    const [branchData, services, stylists] = await Promise.all([
      getBranchData(),
      getBranchServices(),
      getBranchStylists()
    ]);
    
    if (stylists.length === 0) {
      throw new Error('No stylists found in branch');
    }
    
    if (services.length === 0) {
      throw new Error('No services found for branch');
    }
    
    // Ensure stylists have services
    const updatedStylists = await ensureStylistsHaveServices(stylists, services);
    
    const createdAppointments = [];
    let guestNameIndex = 0;
    
    // Helper to get next guest name
    const getNextGuestName = () => {
      const name = GUEST_NAMES[guestNameIndex % GUEST_NAMES.length];
      guestNameIndex++;
      return name;
    };
    
    // 15 past appointments (7-30 days ago) - completed, cancelled, no-show
    for (let i = 0; i < 15; i++) {
      const daysAgo = 7 + Math.floor(Math.random() * 24);
      const service = services[Math.floor(Math.random() * services.length)];
      const stylist = await getAvailableStylistForService(service.id, updatedStylists);
      
      if (!stylist) continue;
      
      const statuses = [APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.NO_SHOW];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      const appointmentDate = generateDate(-daysAgo);
      const duration = service.duration || 60;
      
      const appointmentData = {
        branchId: BRANCH_ID,
        clientName: getNextGuestName(),
        clientPhone: `09${Math.floor(Math.random() * 90000000) + 10000000}`,
        isGuest: true,
        serviceId: service.id,
        services: [{
          serviceId: service.id,
          serviceName: service.name || service.serviceName,
          stylistId: stylist.id,
          stylistName: `${stylist.firstName} ${stylist.lastName}`,
          price: service.branchPricing?.[BRANCH_ID] || service.price || 0,
          duration: duration
        }],
        stylistId: stylist.id,
        stylistName: `${stylist.firstName} ${stylist.lastName}`,
        status: status,
        totalPrice: service.branchPricing?.[BRANCH_ID] || service.price || 0,
        duration: duration,
        appointmentDate: appointmentDate,
        notes: `Seeded test appointment - ${status}`
      };
      
      if (status === APPOINTMENT_STATUS.COMPLETED) {
        appointmentData.completedAt = Timestamp.fromDate(new Date(appointmentDate.getTime() + duration * 60000));
      }
      
      const id = await createAppointment(appointmentData, branchData);
      createdAppointments.push(id);
    }
    
    // 10 recent past appointments (1-6 days ago) - mostly completed
    for (let i = 0; i < 10; i++) {
      const daysAgo = 1 + Math.floor(Math.random() * 6);
      const service = services[Math.floor(Math.random() * services.length)];
      const stylist = await getAvailableStylistForService(service.id, updatedStylists);
      
      if (!stylist) continue;
      
      const appointmentDate = generateDate(-daysAgo);
      const duration = service.duration || 60;
      const status = Math.random() > 0.1 ? APPOINTMENT_STATUS.COMPLETED : APPOINTMENT_STATUS.CANCELLED;
      
      const appointmentData = {
        branchId: BRANCH_ID,
        clientName: getNextGuestName(),
        clientPhone: `09${Math.floor(Math.random() * 90000000) + 10000000}`,
        isGuest: true,
        serviceId: service.id,
        services: [{
          serviceId: service.id,
          serviceName: service.name || service.serviceName,
          stylistId: stylist.id,
          stylistName: `${stylist.firstName} ${stylist.lastName}`,
          price: service.branchPricing?.[BRANCH_ID] || service.price || 0,
          duration: duration
        }],
        stylistId: stylist.id,
        stylistName: `${stylist.firstName} ${stylist.lastName}`,
        status: status,
        totalPrice: service.branchPricing?.[BRANCH_ID] || service.price || 0,
        duration: duration,
        appointmentDate: appointmentDate,
        notes: `Seeded test appointment - ${status}`
      };
      
      if (status === APPOINTMENT_STATUS.COMPLETED) {
        appointmentData.completedAt = Timestamp.fromDate(new Date(appointmentDate.getTime() + duration * 60000));
      }
      
      const id = await createAppointment(appointmentData, branchData);
      createdAppointments.push(id);
    }
    
    // 8 today's appointments - pending, confirmed, in_service
    for (let i = 0; i < 8; i++) {
      const service = services[Math.floor(Math.random() * services.length)];
      const stylist = await getAvailableStylistForService(service.id, updatedStylists);
      
      if (!stylist) continue;
      
      const statuses = [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.IN_SERVICE];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      // Spread throughout the day
      const hour = 9 + Math.floor(Math.random() * 9);
      const minute = Math.floor(Math.random() * 4) * 15;
      const appointmentDate = generateDate(0, hour, minute);
      const duration = service.duration || 60;
      
      const appointmentData = {
        branchId: BRANCH_ID,
        clientName: getNextGuestName(),
        clientPhone: `09${Math.floor(Math.random() * 90000000) + 10000000}`,
        isGuest: true,
        serviceId: service.id,
        services: [{
          serviceId: service.id,
          serviceName: service.name || service.serviceName,
          stylistId: stylist.id,
          stylistName: `${stylist.firstName} ${stylist.lastName}`,
          price: service.branchPricing?.[BRANCH_ID] || service.price || 0,
          duration: duration
        }],
        stylistId: stylist.id,
        stylistName: `${stylist.firstName} ${stylist.lastName}`,
        status: status,
        totalPrice: service.branchPricing?.[BRANCH_ID] || service.price || 0,
        duration: duration,
        appointmentDate: appointmentDate,
        notes: `Seeded test appointment - ${status}`
      };
      
      if (status === APPOINTMENT_STATUS.IN_SERVICE) {
        appointmentData.checkedInAt = serverTimestamp();
      }
      
      const id = await createAppointment(appointmentData, branchData);
      createdAppointments.push(id);
    }
    
    // 20 future appointments (1-30 days ahead) - pending and confirmed
    for (let i = 0; i < 20; i++) {
      const daysAhead = 1 + Math.floor(Math.random() * 30);
      const service = services[Math.floor(Math.random() * services.length)];
      const stylist = await getAvailableStylistForService(service.id, updatedStylists);
      
      if (!stylist) continue;
      
      const status = Math.random() > 0.3 ? APPOINTMENT_STATUS.CONFIRMED : APPOINTMENT_STATUS.PENDING;
      const appointmentDate = generateDate(daysAhead);
      const duration = service.duration || 60;
      
      const appointmentData = {
        branchId: BRANCH_ID,
        clientName: getNextGuestName(),
        clientPhone: `09${Math.floor(Math.random() * 90000000) + 10000000}`,
        isGuest: true,
        serviceId: service.id,
        services: [{
          serviceId: service.id,
          serviceName: service.name || service.serviceName,
          stylistId: stylist.id,
          stylistName: `${stylist.firstName} ${stylist.lastName}`,
          price: service.branchPricing?.[BRANCH_ID] || service.price || 0,
          duration: duration
        }],
        stylistId: stylist.id,
        stylistName: `${stylist.firstName} ${stylist.lastName}`,
        status: status,
        totalPrice: service.branchPricing?.[BRANCH_ID] || service.price || 0,
        duration: duration,
        appointmentDate: appointmentDate,
        notes: `Seeded test appointment - ${status}`
      };
      
      const id = await createAppointment(appointmentData, branchData);
      createdAppointments.push(id);
    }
    
    // 5 multi-service appointments
    for (let i = 0; i < 5; i++) {
      const numServices = 2 + Math.floor(Math.random() * 2); // 2 or 3 services
      const selectedServices = [];
      const serviceObjects = [];
      let totalPrice = 0;
      let totalDuration = 0;
      
      // Select random services
      const shuffled = [...services].sort(() => 0.5 - Math.random());
      for (let j = 0; j < numServices && j < shuffled.length; j++) {
        const service = shuffled[j];
        const stylist = await getAvailableStylistForService(service.id, updatedStylists);
        
        if (stylist) {
          selectedServices.push(service.id);
          const price = service.branchPricing?.[BRANCH_ID] || service.price || 0;
          const duration = service.duration || 60;
          
          serviceObjects.push({
            serviceId: service.id,
            serviceName: service.name || service.serviceName,
            stylistId: stylist.id,
            stylistName: `${stylist.firstName} ${stylist.lastName}`,
            price: price,
            duration: duration
          });
          
          totalPrice += price;
          totalDuration += duration;
        }
      }
      
      if (serviceObjects.length === 0) continue;
      
      // Use first stylist as primary
      const primaryStylist = serviceObjects[0];
      const daysAhead = Math.random() > 0.5 ? Math.floor(Math.random() * 30) : -Math.floor(Math.random() * 30);
      const appointmentDate = generateDate(daysAhead);
      
      const appointmentData = {
        branchId: BRANCH_ID,
        clientName: getNextGuestName(),
        clientPhone: `09${Math.floor(Math.random() * 90000000) + 10000000}`,
        isGuest: true,
        services: serviceObjects,
        stylistId: primaryStylist.stylistId,
        stylistName: primaryStylist.stylistName,
        status: daysAhead < 0 ? APPOINTMENT_STATUS.COMPLETED : APPOINTMENT_STATUS.CONFIRMED,
        totalPrice: totalPrice,
        duration: totalDuration,
        appointmentDate: appointmentDate,
        notes: `Seeded multi-service test appointment`
      };
      
      if (daysAhead < 0 && appointmentData.status === APPOINTMENT_STATUS.COMPLETED) {
        appointmentData.completedAt = Timestamp.fromDate(new Date(appointmentDate.getTime() + totalDuration * 60000));
      }
      
      const id = await createAppointment(appointmentData, branchData);
      createdAppointments.push(id);
    }
    
    console.log(`Successfully created ${createdAppointments.length} appointments`);
    return createdAppointments;
  } catch (error) {
    console.error('Error seeding appointments:', error);
    throw error;
  }
};
