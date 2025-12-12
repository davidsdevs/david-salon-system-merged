/**
 * Move All Stocks to User's Branch
 * Updates all stocks, batches, and purchase orders to the specified branch
 */

import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  writeBatch
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

async function getTargetBranch() {
  try {
    const branchesRef = collection(db, 'branches');
    const snapshot = await getDocs(branchesRef);
    
    if (snapshot.empty) {
      console.error('❌ No branches found!');
      return null;
    }
    
    // Get the first branch (or you can specify which one)
    const branch = snapshot.docs[0];
    console.log(`✅ Using branch: ${branch.id} (${branch.data().name || 'N/A'})`);
    return branch.id;
  } catch (error) {
    console.error('Error getting branch:', error);
    return null;
  }
}

async function moveStocksToBranch(targetBranchId) {
  console.log('\n📦 Moving stocks to branch...');
  
  try {
    const stocksRef = collection(db, 'stocks');
    const snapshot = await getDocs(stocksRef);
    
    const batch = writeBatch(db);
    let count = 0;
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.branchId !== targetBranchId) {
        batch.update(docSnap.ref, {
          branchId: targetBranchId,
          updatedAt: new Date()
        });
        count++;
      }
    });
    
    if (count > 0) {
      await batch.commit();
      console.log(`  ✅ Updated ${count} stock records to branch ${targetBranchId}`);
    } else {
      console.log(`  ✅ All stocks already in branch ${targetBranchId}`);
    }
    
    return count;
  } catch (error) {
    console.error('  ❌ Error moving stocks:', error);
    throw error;
  }
}

async function moveBatchesToBranch(targetBranchId) {
  console.log('\n📦 Moving product batches to branch...');
  
  try {
    const batchesRef = collection(db, 'product_batches');
    const snapshot = await getDocs(batchesRef);
    
    const batch = writeBatch(db);
    let count = 0;
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.branchId !== targetBranchId) {
        batch.update(docSnap.ref, {
          branchId: targetBranchId,
          updatedAt: new Date()
        });
        count++;
      }
    });
    
    if (count > 0) {
      await batch.commit();
      console.log(`  ✅ Updated ${count} batch records to branch ${targetBranchId}`);
    } else {
      console.log(`  ✅ All batches already in branch ${targetBranchId}`);
    }
    
    return count;
  } catch (error) {
    console.error('  ❌ Error moving batches:', error);
    throw error;
  }
}

async function movePurchaseOrdersToBranch(targetBranchId) {
  console.log('\n🛒 Moving purchase orders to branch...');
  
  try {
    const poRef = collection(db, 'purchaseOrders');
    const snapshot = await getDocs(poRef);
    
    const batch = writeBatch(db);
    let count = 0;
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.branchId !== targetBranchId) {
        batch.update(docSnap.ref, {
          branchId: targetBranchId,
          updatedAt: new Date()
        });
        count++;
      }
    });
    
    if (count > 0) {
      await batch.commit();
      console.log(`  ✅ Updated ${count} purchase order records to branch ${targetBranchId}`);
    } else {
      console.log(`  ✅ All purchase orders already in branch ${targetBranchId}`);
    }
    
    return count;
  } catch (error) {
    console.error('  ❌ Error moving purchase orders:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Moving all data to your branch...\n');
  
  try {
    // Get target branch (first branch found, or you can specify)
    const targetBranchId = await getTargetBranch();
    
    if (!targetBranchId) {
      console.error('❌ Could not determine target branch');
      return;
    }
    
    // Move stocks
    const stocksMoved = await moveStocksToBranch(targetBranchId);
    
    // Move batches
    const batchesMoved = await moveBatchesToBranch(targetBranchId);
    
    // Move purchase orders
    const posMoved = await movePurchaseOrdersToBranch(targetBranchId);
    
    console.log('\n🎉 Migration complete!');
    console.log('\n📊 Summary:');
    console.log(`   - Stocks moved: ${stocksMoved}`);
    console.log(`   - Batches moved: ${batchesMoved}`);
    console.log(`   - Purchase Orders moved: ${posMoved}`);
    console.log(`\n✅ All data is now in branch: ${targetBranchId}`);
    console.log('\n📝 Next Steps:');
    console.log('   1. Refresh your Stocks page');
    console.log('   2. You should now see all stocks with usage type badges');
    console.log('   3. Use the Usage Type filter to view OTC vs Salon Use stocks');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().then(() => {
  console.log('\n✨ Done!');
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});





