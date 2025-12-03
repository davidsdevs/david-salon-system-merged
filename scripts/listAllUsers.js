/**
 * List All Users with Complete Data
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs
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

async function listAllUsers() {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    console.log(`Total users: ${snapshot.size}\n`);
    console.log('All users with complete data:\n');
    
    snapshot.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log(`${i+1}. Document ID: ${doc.id}`);
      console.log(`   All data:`, JSON.stringify(data, null, 2));
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listAllUsers();



