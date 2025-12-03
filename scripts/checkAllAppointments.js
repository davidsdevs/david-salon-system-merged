/**
 * Check All Appointments in Database
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs,
  query,
  orderBy
} from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyD4ène5yOM8JDw4RIZhk7mCOzP3VEcvXU8",
  authDomain: "davids-salon.firebaseapp.com",
  projectId: "davids-salon",
  storageBucket: "davids-salon.firebasestorage.app",
  messagingSenderId: "450733830859",
  appId: "1:450733830859:web:4fe0ec9c7d36f4f5cb1e1c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkAllAppointments() {
  try {
    console.log('📊 Checking ALL appointments in database...\n');
    
    const appointmentsRef = collection(db, 'appointments');
    const q = query(appointmentsRef, orderBy('appointmentDate', 'desc'));
    const snapshot = await getDocs(q);
    
    console.log(`Total appointments: ${snapshot.size}\n`);
    
    // Check for Nov 27, 2025 appointments
    const today = new Date('2025-11-27');
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date('2025-11-28');
    tomorrow.setHours(0, 0, 0, 0);
    
    const todayAppointments = snapshot.docs.filter(doc => {
      const data = doc.data();
      if (data.appointmentDate) {
        const aptDate = data.appointmentDate.toDate();
        return aptDate >= today && aptDate < tomorrow;
      }
      return false;
    });
    
    console.log(`Appointments for Nov 27, 2025: ${todayAppointments.length}\n`);
    
    if (todayAppointments.length > 0) {
      console.log('Today\'s appointments:');
      todayAppointments.forEach((doc, i) => {
        const data = doc.data();
        const aptDate = data.appointmentDate.toDate();
        console.log(`  ${i+1}. ${data.clientName} - ${data.serviceName || data.services?.[0]?.serviceName}`);
        console.log(`     Time: ${aptDate.toLocaleTimeString()}`);
        console.log(`     Status: ${data.status}`);
        console.log(`     Branch: ${data.branchId}`);
        console.log(`     Notes: ${data.notes || 'N/A'}`);
        console.log('');
      });
    }
    
    // Also show all unique client names
    const clientNames = new Set();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      clientNames.add(data.clientName);
    });
    
    console.log('All unique client names in appointments:');
    [...clientNames].sort().forEach(name => console.log(`  - ${name}`));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAllAppointments();



