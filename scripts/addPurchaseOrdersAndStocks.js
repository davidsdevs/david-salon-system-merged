/**
 * Purchase Orders and Stocks Mock Data Generator
 * Creates purchase orders with various usage types and corresponding stock records
 * 
 * Usage: node scripts/addPurchaseOrdersAndStocks.js
 */

import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  setDoc, 
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  getDocs,
  query,
  where
} from 'firebase/firestore';

// Load environment variables
config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: process.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID",
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
  console.error('\n❌ ERROR: Firebase config not found!');
  console.error('Please set up your .env file or update the config in this script.\n');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get existing products
async function getProducts() {
  try {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting products:', error);
    return [];
  }
}

// Get or create branch
async function getOrCreateBranch() {
  try {
    const branchesRef = collection(db, 'branches');
    const snapshot = await getDocs(branchesRef);
    
    if (!snapshot.empty) {
      const branch = snapshot.docs[0];
      return { id: branch.id, name: branch.data().name || 'Default Branch' };
    }
    
    const branchData = {
      name: "Main Branch",
      address: "123 Main Street",
      phone: "+1234567890",
      email: "main@salon.com",
      status: "Active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(branchesRef, branchData);
    return { id: docRef.id, name: branchData.name };
  } catch (error) {
    console.error('Error getting/creating branch:', error);
    throw error;
  }
}

// Get or create supplier
async function getOrCreateSupplier() {
  try {
    const suppliersRef = collection(db, 'suppliers');
    const snapshot = await getDocs(suppliersRef);
    
    if (!snapshot.empty) {
      const supplier = snapshot.docs[0];
      return { id: supplier.id, name: supplier.data().name || 'Default Supplier' };
    }
    
    const supplierData = {
      name: "Beauty Supplies Co.",
      contactPerson: "John Doe",
      email: "contact@beautysupplies.com",
      phone: "+1234567890",
      address: "123 Beauty Street",
      status: "Active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(suppliersRef, supplierData);
    return { id: docRef.id, name: supplierData.name };
  } catch (error) {
    console.error('Error getting/creating supplier:', error);
    throw error;
  }
}

// Create purchase orders with various usage types
async function createPurchaseOrders(branchId, supplierId, products) {
  console.log('🛒 Creating purchase orders with mixed usage types...');
  
  if (products.length < 3) {
    console.log('⚠️  Not enough products. Need at least 3 products.');
    return [];
  }

  const purchaseOrders = [
    // PO 1: Mixed usage types for same products
    {
      orderId: `PO-MOCK-${Date.now()}-001`,
      supplierId: supplierId,
      supplierName: "Beauty Supplies Co.",
      branchId: branchId,
      orderDate: Timestamp.fromDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)), // 14 days ago
      expectedDelivery: Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)), // 7 days ago
      status: "Delivered",
      totalAmount: 0,
      items: [
        {
          productId: products[0].id,
          productName: products[0].name,
          quantity: 30,
          unitPrice: products[0].unitCost || 150,
          totalPrice: (products[0].unitCost || 150) * 30,
          usageType: "salon-use"
        },
        {
          productId: products[0].id,
          productName: products[0].name,
          quantity: 15,
          unitPrice: products[0].unitCost || 150,
          totalPrice: (products[0].unitCost || 150) * 15,
          usageType: "otc"
        },
        {
          productId: products[1].id,
          productName: products[1].name,
          quantity: 20,
          unitPrice: products[1].unitCost || 200,
          totalPrice: (products[1].unitCost || 200) * 20,
          usageType: "salon-use"
        }
      ],
      createdBy: "system",
      createdByName: "System Admin",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deliveredAt: Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      deliveredBy: "system",
      deliveredByName: "System Admin"
    },
    // PO 2: Mostly OTC products
    {
      orderId: `PO-MOCK-${Date.now()}-002`,
      supplierId: supplierId,
      supplierName: "Beauty Supplies Co.",
      branchId: branchId,
      orderDate: Timestamp.fromDate(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)), // 10 days ago
      expectedDelivery: Timestamp.fromDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)), // 3 days ago
      status: "Delivered",
      totalAmount: 0,
      items: [
        {
          productId: products[2].id,
          productName: products[2].name,
          quantity: 40,
          unitPrice: products[2].unitCost || 180,
          totalPrice: (products[2].unitCost || 180) * 40,
          usageType: "otc"
        },
        {
          productId: products[3].id || products[0].id,
          productName: products[3]?.name || products[0].name,
          quantity: 25,
          unitPrice: products[3]?.unitCost || products[0].unitCost || 120,
          totalPrice: (products[3]?.unitCost || products[0].unitCost || 120) * 25,
          usageType: "otc"
        },
        {
          productId: products[1].id,
          productName: products[1].name,
          quantity: 10,
          unitPrice: products[1].unitCost || 200,
          totalPrice: (products[1].unitCost || 200) * 10,
          usageType: "otc"
        }
      ],
      createdBy: "system",
      createdByName: "System Admin",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deliveredAt: Timestamp.fromDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)),
      deliveredBy: "system",
      deliveredByName: "System Admin"
    },
    // PO 3: Mostly salon-use products
    {
      orderId: `PO-MOCK-${Date.now()}-003`,
      supplierId: supplierId,
      supplierName: "Beauty Supplies Co.",
      branchId: branchId,
      orderDate: Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)), // 5 days ago
      expectedDelivery: Timestamp.fromDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)), // 2 days from now
      status: "Delivered",
      totalAmount: 0,
      items: [
        {
          productId: products[4]?.id || products[0].id,
          productName: products[4]?.name || products[0].name,
          quantity: 35,
          unitPrice: products[4]?.unitCost || products[0].unitCost || 300,
          totalPrice: (products[4]?.unitCost || products[0].unitCost || 300) * 35,
          usageType: "salon-use"
        },
        {
          productId: products[2].id,
          productName: products[2].name,
          quantity: 20,
          unitPrice: products[2].unitCost || 180,
          totalPrice: (products[2].unitCost || 180) * 20,
          usageType: "salon-use"
        },
        {
          productId: products[1].id,
          productName: products[1].name,
          quantity: 18,
          unitPrice: products[1].unitCost || 200,
          totalPrice: (products[1].unitCost || 200) * 18,
          usageType: "salon-use"
        }
      ],
      createdBy: "system",
      createdByName: "System Admin",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deliveredAt: Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)),
      deliveredBy: "system",
      deliveredByName: "System Admin"
    },
    // PO 4: Pending order (not delivered yet)
    {
      orderId: `PO-MOCK-${Date.now()}-004`,
      supplierId: supplierId,
      supplierName: "Beauty Supplies Co.",
      branchId: branchId,
      orderDate: Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)), // 2 days ago
      expectedDelivery: Timestamp.fromDate(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)), // 5 days from now
      status: "Pending",
      totalAmount: 0,
      items: [
        {
          productId: products[0].id,
          productName: products[0].name,
          quantity: 50,
          unitPrice: products[0].unitCost || 150,
          totalPrice: (products[0].unitCost || 150) * 50,
          usageType: "otc"
        },
        {
          productId: products[1].id,
          productName: products[1].name,
          quantity: 30,
          unitPrice: products[1].unitCost || 200,
          totalPrice: (products[1].unitCost || 200) * 30,
          usageType: "salon-use"
        }
      ],
      createdBy: "system",
      createdByName: "System Admin",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
  ];

  // Calculate total amounts
  purchaseOrders.forEach(po => {
    po.totalAmount = po.items.reduce((sum, item) => sum + item.totalPrice, 0);
  });

  const poIds = [];
  for (const po of purchaseOrders) {
    try {
      const docRef = await addDoc(collection(db, 'purchaseOrders'), po);
      poIds.push({ id: docRef.id, ...po });
      console.log(`  ✅ Created PO: ${po.orderId} (${po.status})`);
    } catch (error) {
      console.error(`  ❌ Error creating PO ${po.orderId}:`, error);
    }
  }

  return poIds;
}

// Create batches from delivered purchase orders
async function createBatchesFromPOs(branchId, purchaseOrders) {
  console.log('\n📦 Creating product batches from delivered purchase orders...');
  
  const deliveredPOs = purchaseOrders.filter(po => po.status === 'Delivered');
  
  for (const po of deliveredPOs) {
    for (const item of po.items) {
      try {
        const batchNumber = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + 12); // 12 months from now
        
        const batchData = {
          batchNumber: batchNumber,
          productId: item.productId,
          productName: item.productName,
          branchId: branchId,
          purchaseOrderId: po.id,
          quantity: item.quantity,
          remainingQuantity: item.quantity,
          unitCost: item.unitPrice,
          expirationDate: Timestamp.fromDate(expirationDate),
          receivedDate: po.deliveredAt || Timestamp.now(),
          receivedBy: "system",
          usageType: item.usageType, // Important: Copy usage type from PO item
          status: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        const docRef = await addDoc(collection(db, 'product_batches'), batchData);
        console.log(`  ✅ Created batch: ${batchNumber} (${item.usageType}) - ${item.productName} x${item.quantity}`);
        
        // Create or update stock record with usage type
        await createOrUpdateStock(branchId, item.productId, item.productName, item.quantity, item.usageType);
      } catch (error) {
        console.error(`  ❌ Error creating batch for ${item.productName}:`, error);
      }
    }
  }
}

// Create or update stock records with usage type tracking
async function createOrUpdateStock(branchId, productId, productName, quantity, usageType) {
  try {
    // Check if stock record exists for this product and usage type
    const stocksRef = collection(db, 'stocks');
    const q = query(
      stocksRef,
      where('branchId', '==', branchId),
      where('productId', '==', productId),
      where('usageType', '==', usageType)
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      // Update existing stock record
      const stockDoc = snapshot.docs[0];
      const currentStock = stockDoc.data().realTimeStock || 0;
      const beginningStock = stockDoc.data().beginningStock || 0;
      
      await updateDoc(stockDoc.ref, {
        realTimeStock: currentStock + quantity,
        beginningStock: beginningStock + quantity,
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new stock record with usage type
      const stockId = `${branchId}_${productId}_${usageType}`;
      await setDoc(doc(db, 'stocks', stockId), {
        branchId: branchId,
        productId: productId,
        productName: productName,
        usageType: usageType, // Important: Track usage type in stock
        realTimeStock: quantity,
        beginningStock: quantity,
        status: 'active',
        stockType: 'batch', // Indicate this is batch-based stock
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error(`  ⚠️ Error updating stock for ${productName} (${usageType}):`, error);
  }
}

// Main function
async function main() {
  console.log('🚀 Starting Purchase Orders and Stocks mock data generation...\n');
  
  try {
    // Get branch and supplier
    console.log('📍 Getting branch and supplier...');
    const branch = await getOrCreateBranch();
    const supplier = await getOrCreateSupplier();
    console.log(`  ✅ Branch: ${branch.name}`);
    console.log(`  ✅ Supplier: ${supplier.name}\n`);
    
    // Get existing products
    console.log('📦 Getting products...');
    const products = await getProducts();
    if (products.length === 0) {
      console.log('  ⚠️  No products found. Please run addMockData.js first to create products.');
      return;
    }
    console.log(`  ✅ Found ${products.length} products\n`);
    
    // Create purchase orders
    const purchaseOrders = await createPurchaseOrders(branch.id, supplier.id, products);
    console.log(`\n✅ Created ${purchaseOrders.length} purchase orders\n`);
    
    // Create batches and stocks from delivered POs
    await createBatchesFromPOs(branch.id, purchaseOrders);
    
    console.log('\n🎉 Mock data generation complete!');
    console.log('\n📊 Summary:');
    console.log(`   - Purchase Orders: ${purchaseOrders.length} (${purchaseOrders.filter(po => po.status === 'Delivered').length} delivered)`);
    console.log(`   - Batches: Created with usage types`);
    console.log(`   - Stocks: Created/updated with usage type tracking`);
    console.log('\n💡 Stock records are now separated by usage type:');
    console.log('   - Each product can have separate stock records for OTC and Salon Use');
    console.log('   - Stocks page can now filter by usage type');
    console.log('\n📝 Next Steps:');
    console.log('   1. Go to Inventory → Stocks');
    console.log('   2. Use the usage type filter to view OTC vs Salon Use stocks');
    console.log('   3. Go to Inventory → Purchase Orders to see the new orders');
    
  } catch (error) {
    console.error('❌ Error generating mock data:', error);
  }
}

// Run the script
main().then(() => {
  console.log('\n✨ Done!');
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

