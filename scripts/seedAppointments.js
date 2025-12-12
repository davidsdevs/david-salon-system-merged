/**
 * Seed Appointments Script
 * Creates 50 varied appointments for testing purposes
 * - Different statuses: pending, confirmed, completed, cancelled, no_show, in_service
 * - Different dates: past, today, upcoming
 * - Different clients, services, and stylists
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs,
  deleteDoc,
  query,
  where,
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env') });

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

console.log('Using Firebase project:', firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Constants - Use KYiL9JprSX3LBOYzrF6e for the current logged-in user's branch
const BRANCH_ID = 'KYiL9JprSX3LBOYzrF6e'; // David's Salon Branch
const BRANCH_NAME = 'David Salon Branch';

// Appointment statuses
const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_SERVICE: 'in_service',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show'
};

// Fetch real users from Firebase
async function fetchClients() {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    const clients = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      // Get users with client role
      const roles = Array.isArray(data.roles) ? data.roles : (data.role ? [data.role] : []);
      if (roles.includes('client') && data.isActive !== false) {
        const fullName = `${data.firstName || ''} ${data.middleName || ''} ${data.lastName || ''}`.trim() || data.displayName || data.email;
        clients.push({
          id: doc.id,
          name: fullName,
          phone: data.phone || '',
          email: data.email || '',
          isGuest: false
        });
      }
    });
    
    // Add some walk-in/guest clients
    clients.push(
      { id: null, name: 'Walk-in Client A', phone: '09171111111', email: '', isGuest: true },
      { id: null, name: 'Walk-in Client B', phone: '09172222222', email: '', isGuest: true },
      { id: null, name: 'Guest Client', phone: '09173333333', email: '', isGuest: true }
    );
    
    console.log(`✅ Fetched ${clients.length} clients (${clients.filter(c => !c.isGuest).length} registered, ${clients.filter(c => c.isGuest).length} guests)`);
    return clients;
  } catch (error) {
    console.error('Error fetching clients:', error);
    throw error;
  }
}

// Fetch real stylists from Firebase
async function fetchStylists() {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    const stylists = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      // Get users with stylist role and matching branch
      const roles = Array.isArray(data.roles) ? data.roles : (data.role ? [data.role] : []);
      if (roles.includes('stylist') && (data.branchId === BRANCH_ID || !data.branchId) && data.isActive !== false) {
        const fullName = `${data.firstName || ''} ${data.middleName || ''} ${data.lastName || ''}`.trim() || data.displayName || data.email;
        stylists.push({
          id: doc.id,
          name: fullName
        });
      }
    });
    
    console.log(`✅ Fetched ${stylists.length} stylists`);
    return stylists;
  } catch (error) {
    console.error('Error fetching stylists:', error);
    throw error;
  }
}

// Fetch real services from Firebase
async function fetchServices() {
  try {
    const servicesRef = collection(db, 'services');
    const snapshot = await getDocs(servicesRef);
    
    const services = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      // Get services that are active and have pricing for this branch
      if (data.isActive !== false) {
        const branchPrice = data.branchPricing?.[BRANCH_ID];
        if (branchPrice !== undefined) {
          services.push({
            id: doc.id,
            name: data.name || 'Unknown Service',
            price: branchPrice,
            duration: data.duration || 60,
            category: data.category || 'General'
          });
        }
      }
    });
    
    console.log(`✅ Fetched ${services.length} services`);
    return services;
  } catch (error) {
    console.error('Error fetching services:', error);
    throw error;
  }
}

// Client types for billing
const CLIENT_TYPES = ['X', 'R', 'TR'];

// Helper to get random item from array
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Helper to get random number in range
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper to create appointment date
const createAppointmentDate = (daysOffset, hour, minute) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
};

// Generate 50 appointments with variety
const generateAppointments = (clients, stylists, services) => {
  if (clients.length === 0) {
    throw new Error('No clients found. Please ensure there are client users in the database.');
  }
  if (stylists.length === 0) {
    throw new Error('No stylists found. Please ensure there are stylist users in the database.');
  }
  if (services.length === 0) {
    throw new Error('No services found. Please ensure there are services configured for this branch.');
  }
  
  const appointments = [];
  
  // Past completed appointments (15 appointments - past 2 weeks)
  for (let i = 0; i < 15; i++) {
    const daysAgo = getRandomInt(1, 14);
    const client = getRandomItem(clients);
    const service = getRandomItem(services);
    const stylist = getRandomItem(stylists);
    const hour = getRandomInt(9, 18);
    
    appointments.push({
      type: 'past_completed',
      daysOffset: -daysAgo,
      hour,
      minute: getRandomItem([0, 30]),
      client,
      service,
      stylist,
      status: APPOINTMENT_STATUS.COMPLETED,
      clientType: getRandomItem(CLIENT_TYPES),
    });
  }
  
  // Past cancelled appointments (5 appointments)
  for (let i = 0; i < 5; i++) {
    const daysAgo = getRandomInt(1, 7);
    const client = getRandomItem(clients);
    const service = getRandomItem(services);
    const stylist = getRandomItem(stylists);
    const hour = getRandomInt(9, 18);
    
    appointments.push({
      type: 'past_cancelled',
      daysOffset: -daysAgo,
      hour,
      minute: getRandomItem([0, 30]),
      client,
      service,
      stylist,
      status: APPOINTMENT_STATUS.CANCELLED,
      cancelReason: getRandomItem(['Client requested', 'Schedule conflict', 'Personal emergency', 'Rescheduled']),
    });
  }
  
  // Past no-show appointments (3 appointments)
  for (let i = 0; i < 3; i++) {
    const daysAgo = getRandomInt(1, 5);
    const client = getRandomItem(clients);
    const service = getRandomItem(services);
    const stylist = getRandomItem(stylists);
    const hour = getRandomInt(9, 18);
    
    appointments.push({
      type: 'past_noshow',
      daysOffset: -daysAgo,
      hour,
      minute: getRandomItem([0, 30]),
      client,
      service,
      stylist,
      status: APPOINTMENT_STATUS.NO_SHOW,
    });
  }
  
  // Today's completed appointments (3 appointments - earlier today)
  for (let i = 0; i < 3; i++) {
    const currentHour = new Date().getHours();
    const hour = Math.max(9, currentHour - getRandomInt(1, 4));
    const client = getRandomItem(clients);
    const service = getRandomItem(services);
    const stylist = getRandomItem(stylists);
    
    appointments.push({
      type: 'today_completed',
      daysOffset: 0,
      hour,
      minute: getRandomItem([0, 30]),
      client,
      service,
      stylist,
      status: APPOINTMENT_STATUS.COMPLETED,
      clientType: getRandomItem(CLIENT_TYPES),
    });
  }
  
  // Today's confirmed appointments (5 appointments - upcoming today)
  for (let i = 0; i < 5; i++) {
    const currentHour = new Date().getHours();
    const hour = Math.min(20, currentHour + getRandomInt(1, 3));
    const client = getRandomItem(clients);
    const service = getRandomItem(services);
    const stylist = getRandomItem(stylists);
    
    appointments.push({
      type: 'today_confirmed',
      daysOffset: 0,
      hour,
      minute: getRandomItem([0, 30]),
      client,
      service,
      stylist,
      status: APPOINTMENT_STATUS.CONFIRMED,
    });
  }
  
  // Today's pending appointments (2 appointments)
  for (let i = 0; i < 2; i++) {
    const currentHour = new Date().getHours();
    const hour = Math.min(20, currentHour + getRandomInt(2, 4));
    const client = getRandomItem(clients);
    const service = getRandomItem(services);
    const stylist = getRandomItem(stylists);
    
    appointments.push({
      type: 'today_pending',
      daysOffset: 0,
      hour,
      minute: getRandomItem([0, 30]),
      client,
      service,
      stylist,
      status: APPOINTMENT_STATUS.PENDING,
    });
  }
  
  // Future confirmed appointments (10 appointments - next 7 days)
  for (let i = 0; i < 10; i++) {
    const daysAhead = getRandomInt(1, 7);
    const client = getRandomItem(clients);
    const service = getRandomItem(services);
    const stylist = getRandomItem(stylists);
    const hour = getRandomInt(9, 18);
    
    appointments.push({
      type: 'future_confirmed',
      daysOffset: daysAhead,
      hour,
      minute: getRandomItem([0, 30]),
      client,
      service,
      stylist,
      status: APPOINTMENT_STATUS.CONFIRMED,
    });
  }
  
  // Future pending appointments (5 appointments - need confirmation)
  for (let i = 0; i < 5; i++) {
    const daysAhead = getRandomInt(1, 14);
    const client = getRandomItem(clients);
    const service = getRandomItem(services);
    const stylist = getRandomItem(stylists);
    const hour = getRandomInt(9, 18);
    
    appointments.push({
      type: 'future_pending',
      daysOffset: daysAhead,
      hour,
      minute: getRandomItem([0, 30]),
      client,
      service,
      stylist,
      status: APPOINTMENT_STATUS.PENDING,
    });
  }
  
  // Multi-service appointments (2 appointments)
  for (let i = 0; i < 2; i++) {
    const daysOffset = getRandomInt(1, 5);
    const client = getRandomItem(clients.filter(c => !c.isGuest));
    const service1 = getRandomItem(services.filter(s => s.category === 'Haircut and Blowdry'));
    const service2 = getRandomItem(services.filter(s => s.category === 'Nail Care'));
    const stylist = getRandomItem(stylists);
    const hour = getRandomInt(10, 16);
    
    appointments.push({
      type: 'multi_service',
      daysOffset,
      hour,
      minute: 0,
      client,
      services: [service1, service2],
      stylist,
      status: APPOINTMENT_STATUS.CONFIRMED,
      isMultiService: true,
    });
  }
  
  return appointments;
};

// Clear all existing appointments
async function clearAppointments() {
  console.log('🗑️  Clearing all existing appointments...');
  
  const appointmentsRef = collection(db, 'appointments');
  const snapshot = await getDocs(appointmentsRef);
  
  let deletedCount = 0;
  for (const doc of snapshot.docs) {
    await deleteDoc(doc.ref);
    deletedCount++;
  }
  
  console.log(`✅ Deleted ${deletedCount} existing appointments\n`);
  return deletedCount;
}

// Create a single appointment
async function createAppointment(appointmentConfig, index) {
  const appointmentDate = createAppointmentDate(
    appointmentConfig.daysOffset,
    appointmentConfig.hour,
    appointmentConfig.minute
  );
  
  const client = appointmentConfig.client;
  const stylist = appointmentConfig.stylist;
  
  // Build services array
  let services;
  let totalDuration;
  let totalPrice;
  
  if (appointmentConfig.isMultiService && appointmentConfig.services) {
    services = appointmentConfig.services.map(svc => ({
      serviceId: svc.id,
      serviceName: svc.name,
      price: svc.price,
      duration: svc.duration,
      category: svc.category,
      stylistId: stylist.id,
      stylistName: stylist.name,
      clientType: appointmentConfig.clientType || 'R',
    }));
    totalDuration = appointmentConfig.services.reduce((sum, s) => sum + s.duration, 0);
    totalPrice = appointmentConfig.services.reduce((sum, s) => sum + s.price, 0);
  } else {
    const service = appointmentConfig.service;
    services = [{
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      duration: service.duration,
      category: service.category,
      stylistId: stylist.id,
      stylistName: stylist.name,
      clientType: appointmentConfig.clientType || 'R',
    }];
    totalDuration = service.duration;
    totalPrice = service.price;
  }
  
  // Build history based on status
  const history = [{
    action: 'created',
    by: 'system_seed',
    timestamp: new Date(appointmentDate.getTime() - 86400000).toISOString(), // 1 day before
    notes: 'Seeded appointment for testing'
  }];
  
  if (appointmentConfig.status === APPOINTMENT_STATUS.CONFIRMED) {
    history.push({
      action: 'status_changed_to_confirmed',
      by: 'system_seed',
      timestamp: new Date(appointmentDate.getTime() - 43200000).toISOString(), // 12 hours before
    });
  }
  
  if (appointmentConfig.status === APPOINTMENT_STATUS.COMPLETED) {
    history.push({
      action: 'status_changed_to_confirmed',
      by: 'system_seed',
      timestamp: new Date(appointmentDate.getTime() - 43200000).toISOString(),
    });
    history.push({
      action: 'status_changed_to_completed',
      by: 'system_seed',
      timestamp: new Date(appointmentDate.getTime() + totalDuration * 60000).toISOString(),
    });
  }
  
  if (appointmentConfig.status === APPOINTMENT_STATUS.CANCELLED) {
    history.push({
      action: 'status_changed_to_cancelled',
      by: 'system_seed',
      timestamp: new Date(appointmentDate.getTime() - 3600000).toISOString(),
      reason: appointmentConfig.cancelReason || 'No reason provided',
    });
  }
  
  if (appointmentConfig.status === APPOINTMENT_STATUS.NO_SHOW) {
    history.push({
      action: 'status_changed_to_confirmed',
      by: 'system_seed',
      timestamp: new Date(appointmentDate.getTime() - 43200000).toISOString(),
    });
    history.push({
      action: 'status_changed_to_no_show',
      by: 'system_seed',
      timestamp: new Date(appointmentDate.getTime() + 1800000).toISOString(), // 30 min after
    });
  }
  
  const appointmentData = {
    branchId: BRANCH_ID,
    branchName: BRANCH_NAME,
    clientId: client.id,
    clientName: client.name,
    clientPhone: client.phone,
    clientEmail: client.email,
    isGuest: client.isGuest,
    services,
    serviceId: services[0].serviceId,
    serviceName: services[0].serviceName,
    servicePrice: services[0].price,
    stylistId: stylist.id,
    stylistName: stylist.name,
    duration: totalDuration,
    totalPrice,
    appointmentDate: Timestamp.fromDate(appointmentDate),
    appointmentTime: `${String(appointmentConfig.hour).padStart(2, '0')}:${String(appointmentConfig.minute).padStart(2, '0')}`,
    status: appointmentConfig.status,
    isWalkIn: client.isGuest && appointmentConfig.type.includes('today'),
    notes: `Seeded test appointment #${index + 1} - ${appointmentConfig.type}`,
    history,
    createdBy: 'system_seed',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  // Add completed-specific fields
  if (appointmentConfig.status === APPOINTMENT_STATUS.COMPLETED) {
    appointmentData.completedAt = Timestamp.fromDate(new Date(appointmentDate.getTime() + totalDuration * 60000));
    appointmentData.completedBy = 'system_seed';
  }
  
  // Add cancellation-specific fields
  if (appointmentConfig.status === APPOINTMENT_STATUS.CANCELLED) {
    appointmentData.cancellationReason = appointmentConfig.cancelReason || 'No reason provided';
    appointmentData.cancelledBy = 'system_seed';
    appointmentData.cancelledAt = Timestamp.fromDate(new Date(appointmentDate.getTime() - 3600000));
  }
  
  const docRef = await addDoc(collection(db, 'appointments'), appointmentData);
  return docRef.id;
}

// Main seeding function
async function seedAppointments() {
  try {
    console.log('🌱 Starting Appointments Seeding...\n');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    // Step 1: Fetch real data from Firebase
    console.log('📥 Fetching real data from Firebase...\n');
    const clients = await fetchClients();
    const stylists = await fetchStylists();
    const services = await fetchServices();
    console.log('');
    
    // Step 2: Clear existing appointments
    await clearAppointments();
    
    // Step 3: Generate appointment configs
    console.log('📋 Generating 50 appointment configurations...\n');
    const appointmentConfigs = generateAppointments(clients, stylists, services);
    
    // Step 4: Create appointments
    console.log('📝 Creating appointments...\n');
    
    const statusCounts = {
      [APPOINTMENT_STATUS.PENDING]: 0,
      [APPOINTMENT_STATUS.CONFIRMED]: 0,
      [APPOINTMENT_STATUS.IN_SERVICE]: 0,
      [APPOINTMENT_STATUS.COMPLETED]: 0,
      [APPOINTMENT_STATUS.CANCELLED]: 0,
      [APPOINTMENT_STATUS.NO_SHOW]: 0,
    };
    
    const typeCounts = {
      past: 0,
      today: 0,
      future: 0,
    };
    
    for (let i = 0; i < appointmentConfigs.length; i++) {
      const config = appointmentConfigs[i];
      const appointmentId = await createAppointment(config, i);
      
      statusCounts[config.status]++;
      
      if (config.daysOffset < 0) typeCounts.past++;
      else if (config.daysOffset === 0) typeCounts.today++;
      else typeCounts.future++;
      
      console.log(`  ✅ Created #${i + 1}: ${config.client.name} - ${config.service?.name || 'Multi-service'} (${config.status})`);
    }
    
    // Step 5: Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 SEEDING SUMMARY:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`\nBranch: ${BRANCH_NAME} (${BRANCH_ID})`);
    console.log(`Total Appointments Created: ${appointmentConfigs.length}`);
    
    console.log('\n📅 By Time Period:');
    console.log(`  Past:   ${typeCounts.past}`);
    console.log(`  Today:  ${typeCounts.today}`);
    console.log(`  Future: ${typeCounts.future}`);
    
    console.log('\n📋 By Status:');
    console.log(`  Pending:    ${statusCounts[APPOINTMENT_STATUS.PENDING]}`);
    console.log(`  Confirmed:  ${statusCounts[APPOINTMENT_STATUS.CONFIRMED]}`);
    console.log(`  In Service: ${statusCounts[APPOINTMENT_STATUS.IN_SERVICE]}`);
    console.log(`  Completed:  ${statusCounts[APPOINTMENT_STATUS.COMPLETED]}`);
    console.log(`  Cancelled:  ${statusCounts[APPOINTMENT_STATUS.CANCELLED]}`);
    console.log(`  No Show:    ${statusCounts[APPOINTMENT_STATUS.NO_SHOW]}`);
    
    console.log('\n🎉 Appointments seeding completed successfully!');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding appointments:', error);
    process.exit(1);
  }
}

// Run the seeding
seedAppointments();

