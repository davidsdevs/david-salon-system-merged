/**
 * Check User Branch Script
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs,
  query,
  where
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

async function checkUserBranch() {
  try {
    console.log('📊 Checking user branch assignments...\n');
    
    // Get users collection
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    console.log(`Total users: ${snapshot.size}\n`);
    
    const receptionists = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      // Check for receptionists
      if (data.role === 'receptionist' || data.roles?.includes('receptionist')) {
        receptionists.push({
          id: doc.id,
          email: data.email,
          name: data.firstName ? `${data.firstName} ${data.lastName}` : data.displayName,
          branchId: data.branchId,
          role: data.role || data.roles
        });
      }
    });
    
    console.log('👤 Receptionists:');
    receptionists.forEach((user, i) => {
      console.log(`  ${i+1}. ${user.email}`);
      console.log(`     Name: ${user.name}`);
      console.log(`     Branch ID: ${user.branchId}`);
      console.log(`     Role: ${user.role}`);
      console.log('');
    });
    
    // Check branches
    console.log('\n📁 Branches:');
    const branchesRef = collection(db, 'branches');
    const branchSnapshot = await getDocs(branchesRef);
    branchSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  ${doc.id}: ${data.name || data.branchName}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUserBranch();



