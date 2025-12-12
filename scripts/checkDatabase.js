/**
 * Check Database Contents
 * Verify what data exists in the database
 */

import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection,
  getDocs,
  query,
  limit
} from 'firebase/firestore';

config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: process.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID",
};

if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
  console.error('\n❌ ERROR: Firebase config not found!');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkCollection(collectionName, limitCount = 10) {
  try {
    const ref = collection(db, collectionName);
    const q = query(ref, limit(limitCount));
    const snapshot = await getDocs(q);
    
    console.log(`\n📦 ${collectionName}: ${snapshot.size} documents found`);
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`   - ${doc.id}: ${data.name || data.productName || data.orderId || data.batchNumber || 'N/A'}`);
      if (data.usageType) {
        console.log(`     Usage Type: ${data.usageType}`);
      }
    });
    
    return snapshot.size;
  } catch (error) {
    console.error(`❌ Error checking ${collectionName}:`, error.message);
    return 0;
  }
}

async function main() {
  console.log('🔍 Checking database contents...\n');
  
  const counts = {
    products: await checkCollection('products', 20),
    services: await checkCollection('services', 20),
    purchaseOrders: await checkCollection('purchaseOrders', 20),
    product_batches: await checkCollection('product_batches', 20),
    stocks: await checkCollection('stocks', 20),
    branches: await checkCollection('branches', 5),
    suppliers: await checkCollection('suppliers', 5)
  };
  
  console.log('\n📊 Summary:');
  console.log(`   Products: ${counts.products}`);
  console.log(`   Services: ${counts.services}`);
  console.log(`   Purchase Orders: ${counts.purchaseOrders}`);
  console.log(`   Product Batches: ${counts.product_batches}`);
  console.log(`   Stocks: ${counts.stocks}`);
  console.log(`   Branches: ${counts.branches}`);
  console.log(`   Suppliers: ${counts.suppliers}`);
  
  if (counts.products === 0 && counts.services === 0) {
    console.log('\n⚠️  No data found! Running seed scripts...');
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});





