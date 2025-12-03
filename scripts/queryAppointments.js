/**
 * Query Appointments by Branch
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs,
  query,
  where,
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

const BRANCH_ID = 'XFL1DUK3fe3JrhygLYUv';

async function queryAppointments() {
  try {
    console.log(`📊 Querying appointments for branch: ${BRANCH_ID}\n`);
    
    const appointmentsRef = collection(db, 'appointments');
    const q = query(
      appointmentsRef,
      where('branchId', '==', BRANCH_ID),
      orderBy('appointmentDate', 'desc')
    );
    
    const snapshot = await getDocs(q);
    
    console.log(`Found ${snapshot.size} appointments\n`);
    
    // Show first 10
    snapshot.docs.slice(0, 10).forEach((doc, i) => {
      const data = doc.data();
      console.log(`${i+1}. ${data.clientName} - ${data.serviceName || data.services?.[0]?.serviceName} (${data.status})`);
      if (data.appointmentDate) {
        const date = data.appointmentDate.toDate();
        console.log(`   Date: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`);
      }
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

queryAppointments();



