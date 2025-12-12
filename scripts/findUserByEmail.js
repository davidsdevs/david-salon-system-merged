/**
 * Find User by Email Script
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

async function findUserByEmail() {
  try {
    const email = 'kcanapati6@gmail.com';
    console.log(`🔍 Searching for user with email: ${email}\n`);
    
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('❌ User not found!');
    } else {
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log('✅ User found:');
        console.log(`  Document ID: ${doc.id}`);
        console.log(`  Email: ${data.email}`);
        console.log(`  Name: ${data.firstName} ${data.lastName}`);
        console.log(`  Branch ID: ${data.branchId}`);
        console.log(`  Role: ${data.role}`);
        console.log(`  All data:`, JSON.stringify(data, null, 2));
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findUserByEmail();



