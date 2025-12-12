/**
 * Verify Stocks Data
 * Check stocks with usage types and their branch associations
 */

import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore';

config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkStocks() {
  console.log('🔍 Checking stocks with usage types...\n');
  
  try {
    const stocksRef = collection(db, 'stocks');
    const snapshot = await getDocs(stocksRef);
    
    console.log(`📦 Total stocks: ${snapshot.size}\n`);
    
    const stocksByBranch = {};
    const stocksByUsageType = { 'otc': 0, 'salon-use': 0, 'none': 0 };
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const branchId = data.branchId || 'unknown';
      const usageType = data.usageType || 'none';
      const productName = data.productName || 'Unknown';
      const realTimeStock = data.realTimeStock || 0;
      
      if (!stocksByBranch[branchId]) {
        stocksByBranch[branchId] = [];
      }
      
      stocksByBranch[branchId].push({
        id: doc.id,
        productName,
        usageType,
        realTimeStock,
        productId: data.productId
      });
      
      stocksByUsageType[usageType]++;
    });
    
    console.log('📊 Stocks by Branch:');
    Object.keys(stocksByBranch).forEach(branchId => {
      console.log(`\n   Branch: ${branchId}`);
      console.log(`   Total stocks: ${stocksByBranch[branchId].length}`);
      
      const otcCount = stocksByBranch[branchId].filter(s => s.usageType === 'otc').length;
      const salonUseCount = stocksByBranch[branchId].filter(s => s.usageType === 'salon-use').length;
      const noneCount = stocksByBranch[branchId].filter(s => !s.usageType || s.usageType === 'none').length;
      
      console.log(`   - OTC: ${otcCount}`);
      console.log(`   - Salon Use: ${salonUseCount}`);
      console.log(`   - No usage type: ${noneCount}`);
      
      // Show sample stocks
      stocksByBranch[branchId].slice(0, 5).forEach(stock => {
        console.log(`     • ${stock.productName}: ${stock.realTimeStock} units (${stock.usageType || 'none'})`);
      });
    });
    
    console.log('\n📊 Stocks by Usage Type:');
    console.log(`   OTC: ${stocksByUsageType['otc']}`);
    console.log(`   Salon Use: ${stocksByUsageType['salon-use']}`);
    console.log(`   No usage type: ${stocksByUsageType['none']}`);
    
    // Check purchase orders
    console.log('\n🛒 Checking purchase orders...');
    const poRef = collection(db, 'purchaseOrders');
    const poSnapshot = await getDocs(poRef);
    console.log(`   Total POs: ${poSnapshot.size}`);
    
    const poByStatus = {};
    poSnapshot.forEach((doc) => {
      const data = doc.data();
      const status = data.status || 'unknown';
      poByStatus[status] = (poByStatus[status] || 0) + 1;
    });
    
    console.log('   By status:');
    Object.keys(poByStatus).forEach(status => {
      console.log(`     ${status}: ${poByStatus[status]}`);
    });
    
    // Check batches
    console.log('\n📦 Checking product batches...');
    const batchesRef = collection(db, 'product_batches');
    const batchesSnapshot = await getDocs(batchesRef);
    console.log(`   Total batches: ${batchesSnapshot.size}`);
    
    const batchesByUsageType = { 'otc': 0, 'salon-use': 0, 'none': 0 };
    batchesSnapshot.forEach((doc) => {
      const data = doc.data();
      const usageType = data.usageType || 'none';
      batchesByUsageType[usageType]++;
    });
    
    console.log('   By usage type:');
    console.log(`     OTC: ${batchesByUsageType['otc']}`);
    console.log(`     Salon Use: ${batchesByUsageType['salon-use']}`);
    console.log(`     No usage type: ${batchesByUsageType['none']}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkStocks().then(() => {
  console.log('\n✨ Done!');
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});





