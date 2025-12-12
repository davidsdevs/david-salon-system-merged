/**
 * Mock Data Generator Script
 * Run this script to populate your Firestore database with sample data
 * 
 * Usage:
 * 1. Make sure you have Node.js installed (v14+)
 * 2. Install dependencies: npm install firebase dotenv
 * 3. Make sure your .env file has Firebase config (or update the config below)
 * 4. Run: node scripts/addMockData.js
 * 
 * Note: This script uses ES modules. Make sure your package.json has "type": "module"
 *       OR rename this file to addMockData.mjs
 */

import { config } from 'dotenv';
import { initializeApp } from 'firebase/app';

// Load environment variables from .env file
config();
import { 
  getFirestore, 
  collection, 
  addDoc, 
  setDoc, 
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  getDocs,
  query,
  where,
  updateDoc
} from 'firebase/firestore';

// Firebase configuration - reads from .env file or environment variables
// If .env file doesn't exist, you'll need to set these values manually below
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: process.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID",
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

// Validate config
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY" || 
    !firebaseConfig.projectId || firebaseConfig.projectId === "YOUR_PROJECT_ID") {
  console.error('\n❌ ERROR: Firebase config not found!\n');
  console.error('Please do ONE of the following:\n');
  console.error('1. Create a .env file in the project root with:');
  console.error('   VITE_FIREBASE_API_KEY=your_key');
  console.error('   VITE_FIREBASE_PROJECT_ID=your_project_id');
  console.error('   ... (and other Firebase config values)\n');
  console.error('2. Or update the firebaseConfig object in scripts/addMockData.js\n');
  console.error('You can find your Firebase config in:');
  console.error('  - Your .env file (if it exists)');
  console.error('  - src/config/firebase.js');
  console.error('  - Firebase Console → Project Settings\n');
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Mock Data
const mockProducts = [
  {
    name: "Professional Hair Shampoo",
    brand: "SalonPro",
    category: "Hair Care",
    description: "Premium shampoo for professional salon use",
    unitCost: 150.00,
    salonUsePrice: 200.00,
    otcPrice: 350.00,
    status: "Active",
    commissionPercentage: 10,
    shelfLife: "24 months",
    upc: "DS-SHAM-SALO-1234",
    imageUrl: "",
    branches: [] // Will be set based on your branches
  },
  {
    name: "Deep Conditioning Treatment",
    brand: "SalonPro",
    category: "Hair Care",
    description: "Intensive conditioning treatment",
    unitCost: 200.00,
    salonUsePrice: 250.00,
    otcPrice: 450.00,
    status: "Active",
    commissionPercentage: 12,
    shelfLife: "18 months",
    upc: "DS-COND-SALO-5678",
    imageUrl: "",
    branches: []
  },
  {
    name: "Hair Color Developer",
    brand: "ColorMax",
    category: "Hair Color",
    description: "Professional hair color developer",
    unitCost: 180.00,
    salonUsePrice: 220.00,
    otcPrice: 400.00,
    status: "Active",
    commissionPercentage: 8,
    shelfLife: "12 months",
    upc: "DS-DEVE-COLO-9012",
    imageUrl: "",
    branches: []
  },
  {
    name: "Hair Styling Gel",
    brand: "StylePro",
    category: "Styling",
    description: "Strong hold styling gel",
    unitCost: 120.00,
    salonUsePrice: 150.00,
    otcPrice: 280.00,
    status: "Active",
    commissionPercentage: 15,
    shelfLife: "36 months",
    upc: "DS-GEL-STYL-3456",
    imageUrl: "",
    branches: []
  },
  {
    name: "Hair Treatment Serum",
    brand: "LuxuryCare",
    category: "Treatment",
    description: "Premium hair treatment serum",
    unitCost: 300.00,
    salonUsePrice: 350.00,
    otcPrice: 600.00,
    status: "Active",
    commissionPercentage: 10,
    shelfLife: "24 months",
    upc: "DS-SERU-LUXU-7890",
    imageUrl: "",
    branches: []
  }
];

const mockServices = [
  {
    name: "Haircut and Blowdry",
    description: "Professional haircut with blowdry styling",
    category: "Haircut",
    duration: 60,
    isChemical: false,
    isActive: true,
    branchPricing: {},
    productMappings: [] // Will be set after products are created
  },
  {
    name: "Hair Color Treatment",
    description: "Full hair coloring service",
    category: "Hair Color",
    duration: 120,
    isChemical: true,
    isActive: true,
    branchPricing: {},
    productMappings: []
  },
  {
    name: "Deep Conditioning",
    description: "Intensive deep conditioning treatment",
    category: "Treatment",
    duration: 90,
    isChemical: false,
    isActive: true,
    branchPricing: {},
    productMappings: []
  }
];

// Function to add products
async function addProducts(branchIds = []) {
  console.log('📦 Adding products...');
  const productIds = [];
  
  for (const product of mockProducts) {
    try {
      const productData = {
        ...product,
        branches: branchIds.length > 0 ? branchIds : [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'products'), productData);
      productIds.push(docRef.id);
      console.log(`  ✅ Added product: ${product.name} (ID: ${docRef.id})`);
    } catch (error) {
      console.error(`  ❌ Error adding product ${product.name}:`, error);
    }
  }
  
  return productIds;
}

// Function to add services with product mappings
async function addServices(productIds) {
  console.log('✂️ Adding services...');
  const serviceIds = [];
  
  // Create product mappings for services
  const serviceMappings = [
    // Haircut and Blowdry uses Shampoo and Styling Gel
    [
      { productId: productIds[0], productName: mockProducts[0].name, quantity: 10, unit: 'ml', percentage: 5 },
      { productId: productIds[3], productName: mockProducts[3].name, quantity: 5, unit: 'ml', percentage: 3 }
    ],
    // Hair Color uses Developer and Treatment
    [
      { productId: productIds[2], productName: mockProducts[2].name, quantity: 30, unit: 'ml', percentage: 15 },
      { productId: productIds[4], productName: mockProducts[4].name, quantity: 10, unit: 'ml', percentage: 10 }
    ],
    // Deep Conditioning uses Conditioner and Serum
    [
      { productId: productIds[1], productName: mockProducts[1].name, quantity: 50, unit: 'ml', percentage: 20 },
      { productId: productIds[4], productName: mockProducts[4].name, quantity: 15, unit: 'ml', percentage: 12 }
    ]
  ];
  
  for (let i = 0; i < mockServices.length; i++) {
    try {
      const serviceData = {
        ...mockServices[i],
        productMappings: serviceMappings[i] || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'services'), serviceData);
      serviceIds.push(docRef.id);
      console.log(`  ✅ Added service: ${mockServices[i].name} (ID: ${docRef.id})`);
    } catch (error) {
      console.error(`  ❌ Error adding service ${mockServices[i].name}:`, error);
    }
  }
  
  return serviceIds;
}

// Function to add purchase orders with mixed usage types
async function addPurchaseOrders(branchId, supplierId, productIds) {
  console.log('🛒 Adding purchase orders...');
  
  const purchaseOrders = [
    {
      orderId: `PO-${Date.now()}-001`,
      supplierId: supplierId,
      supplierName: "Beauty Supplies Co.",
      branchId: branchId,
      orderDate: Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)), // 7 days ago
      expectedDelivery: Timestamp.fromDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)), // 3 days from now
      status: "Delivered",
      totalAmount: 0,
      items: [
        {
          productId: productIds[0],
          productName: mockProducts[0].name,
          quantity: 20,
          unitPrice: mockProducts[0].unitCost,
          totalPrice: mockProducts[0].unitCost * 20,
          usageType: "salon-use" // Salon use batch
        },
        {
          productId: productIds[0],
          productName: mockProducts[0].name,
          quantity: 10,
          unitPrice: mockProducts[0].unitCost,
          totalPrice: mockProducts[0].unitCost * 10,
          usageType: "otc" // OTC batch - same product, different usage
        },
        {
          productId: productIds[1],
          productName: mockProducts[1].name,
          quantity: 15,
          unitPrice: mockProducts[1].unitCost,
          totalPrice: mockProducts[1].unitCost * 15,
          usageType: "salon-use"
        },
        {
          productId: productIds[2],
          productName: mockProducts[2].name,
          quantity: 25,
          unitPrice: mockProducts[2].unitCost,
          totalPrice: mockProducts[2].unitCost * 25,
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
      poIds.push(docRef.id);
      console.log(`  ✅ Added purchase order: ${po.orderId} (ID: ${docRef.id})`);
    } catch (error) {
      console.error(`  ❌ Error adding purchase order ${po.orderId}:`, error);
    }
  }
  
  return poIds;
}

// Function to add product batches from delivered POs
async function addProductBatches(branchId, poId, items) {
  console.log('📦 Adding product batches...');
  
  for (const item of items) {
    try {
      const batchNumber = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + 12); // 12 months from now
      
      const batchData = {
        batchNumber: batchNumber,
        productId: item.productId,
        productName: item.productName,
        branchId: branchId,
        purchaseOrderId: poId,
        quantity: item.quantity,
        remainingQuantity: item.quantity,
        unitCost: item.unitPrice,
        expirationDate: Timestamp.fromDate(expirationDate),
        receivedDate: Timestamp.now(),
        receivedBy: "system",
        usageType: item.usageType, // Important: Copy usage type from PO item
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'product_batches'), batchData);
      console.log(`  ✅ Added batch: ${batchNumber} (${item.usageType}) for ${item.productName}`);
      
      // Update stock
      await updateStock(branchId, item.productId, item.productName, item.quantity);
    } catch (error) {
      console.error(`  ❌ Error adding batch for ${item.productName}:`, error);
    }
  }
}

// Function to update stock
async function updateStock(branchId, productId, productName, quantity) {
  try {
    // Check if stock record exists
    const stocksRef = collection(db, 'stocks');
    const q = query(stocksRef, where('branchId', '==', branchId), where('productId', '==', productId));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      // Update existing stock
      const stockDoc = snapshot.docs[0];
      const currentStock = stockDoc.data().realTimeStock || 0;
      await updateDoc(stockDoc.ref, {
        realTimeStock: currentStock + quantity,
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new stock record
      await setDoc(doc(db, 'stocks', `${branchId}_${productId}`), {
        branchId: branchId,
        productId: productId,
        productName: productName,
        realTimeStock: quantity,
        beginningStock: quantity,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error(`  ⚠️ Error updating stock for ${productName}:`, error);
  }
}

// Function to get or create branch
async function getOrCreateBranch() {
  try {
    const branchesRef = collection(db, 'branches');
    const snapshot = await getDocs(branchesRef);
    
    if (!snapshot.empty) {
      const branch = snapshot.docs[0];
      console.log(`  ✅ Using existing branch: ${branch.data().name || branch.id}`);
      return { id: branch.id, name: branch.data().name || 'Default Branch' };
    }
    
    // Create a default branch
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
    console.log(`  ✅ Created branch: ${branchData.name}`);
    return { id: docRef.id, name: branchData.name };
  } catch (error) {
    console.error('  ❌ Error getting/creating branch:', error);
    throw error;
  }
}

// Function to get or create supplier
async function getOrCreateSupplier() {
  try {
    const suppliersRef = collection(db, 'suppliers');
    const snapshot = await getDocs(suppliersRef);
    
    if (!snapshot.empty) {
      const supplier = snapshot.docs[0];
      console.log(`  ✅ Using existing supplier: ${supplier.data().name || supplier.id}`);
      return { id: supplier.id, name: supplier.data().name || 'Default Supplier' };
    }
    
    // Create a default supplier
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
    console.log(`  ✅ Created supplier: ${supplierData.name}`);
    return { id: docRef.id, name: supplierData.name };
  } catch (error) {
    console.error('  ❌ Error getting/creating supplier:', error);
    throw error;
  }
}

// Main function
async function main() {
  console.log('🚀 Starting mock data generation...\n');
  
  try {
    // Get or create branch and supplier automatically
    console.log('📍 Getting/Creating branch and supplier...');
    const branch = await getOrCreateBranch();
    const supplier = await getOrCreateSupplier();
    console.log('');
    
    // Step 1: Add products
    const productIds = await addProducts([branch.id]);
    console.log(`\n✅ Added ${productIds.length} products\n`);
    
    // Step 2: Add services with product mappings
    const serviceIds = await addServices(productIds);
    console.log(`\n✅ Added ${serviceIds.length} services\n`);
    
    // Step 3: Add purchase orders (with mixed usage types)
    const poIds = await addPurchaseOrders(branch.id, supplier.id, productIds);
    console.log(`\n✅ Added ${poIds.length} purchase orders\n`);
    
    // Step 4: Add product batches from delivered POs
    if (poIds.length > 0) {
      const poDoc = await getDoc(doc(db, 'purchaseOrders', poIds[0]));
      
      if (poDoc.exists()) {
        const poData = poDoc.data();
        await addProductBatches(branch.id, poIds[0], poData.items);
        console.log(`\n✅ Added product batches\n`);
      }
    }
    
    console.log('\n🎉 Mock data generation complete!');
    console.log('\n📊 Summary:');
    console.log(`   - Branch: ${branch.name} (${branch.id})`);
    console.log(`   - Supplier: ${supplier.name} (${supplier.id})`);
    console.log(`   - Products: ${productIds.length}`);
    console.log(`   - Services: ${serviceIds.length}`);
    console.log(`   - Purchase Orders: ${poIds.length}`);
    console.log(`   - Batches: Created with usage types (salon-use and OTC)`);
    console.log('\n💡 Note: The purchase order contains the same product (Shampoo) added twice:');
    console.log('   - 20 units (Salon Use)');
    console.log('   - 10 units (OTC)');
    console.log('\n📝 Next Steps:');
    console.log('   1. Go to Inventory → Purchase Orders');
    console.log('   2. Mark the PO as "Delivered" to create batches');
    console.log('   3. View batches in Inventory → Expiry Tracker');
    console.log('   4. Test billing - products without OTC batches show "Salon Use Only"');
    
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

