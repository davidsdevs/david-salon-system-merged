/**
 * Check Appointments Script
 * Checks the appointments in the database
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

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkAppointments() {
  try {
    console.log('📊 Checking appointments in database...\n');
    
    // Get all appointments
    const appointmentsRef = collection(db, 'appointments');
    const snapshot = await getDocs(appointmentsRef);
    
    console.log(`Total appointments in database: ${snapshot.size}\n`);
    
    // Group by branchId
    const branchCounts = {};
    const statusCounts = {};
    const clientNames = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Count by branch
      const branchId = data.branchId || 'unknown';
      branchCounts[branchId] = (branchCounts[branchId] || 0) + 1;
      
      // Count by status
      const status = data.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      // Collect client names (first 10)
      if (clientNames.length < 20) {
        clientNames.push({
          id: doc.id,
          clientName: data.clientName,
          branchId: data.branchId,
          status: data.status,
          notes: data.notes
        });
      }
    });
    
    console.log('📁 Appointments by Branch:');
    Object.entries(branchCounts).forEach(([branchId, count]) => {
      console.log(`  ${branchId}: ${count}`);
    });
    
    console.log('\n📋 Appointments by Status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    console.log('\n👤 Sample Appointments:');
    clientNames.forEach((apt, i) => {
      console.log(`  ${i+1}. ${apt.clientName} (${apt.status}) - Branch: ${apt.branchId}`);
      if (apt.notes) console.log(`     Notes: ${apt.notes}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAppointments();

