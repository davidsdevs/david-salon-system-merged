/**
 * Mock Data Generator Component
 * Run this from System Admin panel to add sample data
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { 
  collection, 
  addDoc, 
  setDoc, 
  doc,
  serverTimestamp,
  Timestamp,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import toast from 'react-hot-toast';
import { Package, Scissors, ShoppingCart, CheckCircle, Loader2 } from 'lucide-react';

const MockDataGenerator = () => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

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
      branches: userData?.branchId ? [userData.branchId] : []
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
      branches: userData?.branchId ? [userData.branchId] : []
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
      branches: userData?.branchId ? [userData.branchId] : []
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
      branches: userData?.branchId ? [userData.branchId] : []
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
      branches: userData?.branchId ? [userData.branchId] : []
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
      productMappings: []
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

  const addProducts = async () => {
    setProgress('Adding products...');
    const productIds = [];
    
    for (const product of mockProducts) {
      try {
        const productData = {
          ...product,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        const docRef = await addDoc(collection(db, 'products'), productData);
        productIds.push({ id: docRef.id, name: product.name });
        setProgress(`Added product: ${product.name}`);
      } catch (error) {
        console.error(`Error adding product ${product.name}:`, error);
        toast.error(`Failed to add ${product.name}`);
      }
    }
    
    return productIds;
  };

  const addServices = async (productIds) => {
    setProgress('Adding services with product mappings...');
    const serviceIds = [];
    
    // Create product mappings
    const serviceMappings = [
      [
        { productId: productIds[0].id, productName: mockProducts[0].name, quantity: 10, unit: 'ml', percentage: 5 },
        { productId: productIds[3].id, productName: mockProducts[3].name, quantity: 5, unit: 'ml', percentage: 3 }
      ],
      [
        { productId: productIds[2].id, productName: mockProducts[2].name, quantity: 30, unit: 'ml', percentage: 15 },
        { productId: productIds[4].id, productName: mockProducts[4].name, quantity: 10, unit: 'ml', percentage: 10 }
      ],
      [
        { productId: productIds[1].id, productName: mockProducts[1].name, quantity: 50, unit: 'ml', percentage: 20 },
        { productId: productIds[4].id, productName: mockProducts[4].name, quantity: 15, unit: 'ml', percentage: 12 }
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
        setProgress(`Added service: ${mockServices[i].name}`);
      } catch (error) {
        console.error(`Error adding service ${mockServices[i].name}:`, error);
        toast.error(`Failed to add ${mockServices[i].name}`);
      }
    }
    
    return serviceIds;
  };

  const getOrCreateSupplier = async () => {
    setProgress('Checking for supplier...');
    
    // Try to find existing supplier
    const suppliersRef = collection(db, 'suppliers');
    const snapshot = await getDocs(suppliersRef);
    
    if (!snapshot.empty) {
      const supplier = snapshot.docs[0];
      setProgress(`Using existing supplier: ${supplier.data().name}`);
      return { id: supplier.id, name: supplier.data().name };
    }
    
    // Create new supplier
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
    setProgress(`Created supplier: ${supplierData.name}`);
    return { id: docRef.id, name: supplierData.name };
  };

  const addPurchaseOrder = async (branchId, supplierId, supplierName, productIds) => {
    setProgress('Creating purchase order with mixed usage types...');
    
    const purchaseOrder = {
      orderId: `PO-MOCK-${Date.now()}`,
      supplierId: supplierId,
      supplierName: supplierName,
      branchId: branchId,
      orderDate: Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      expectedDelivery: Timestamp.fromDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)),
      status: "Pending",
      totalAmount: 0,
      items: [
        {
          productId: productIds[0].id,
          productName: mockProducts[0].name,
          quantity: 20,
          unitPrice: mockProducts[0].unitCost,
          totalPrice: mockProducts[0].unitCost * 20,
          usageType: "salon-use" // Salon use batch
        },
        {
          productId: productIds[0].id,
          productName: mockProducts[0].name,
          quantity: 10,
          unitPrice: mockProducts[0].unitCost,
          totalPrice: mockProducts[0].unitCost * 10,
          usageType: "otc" // OTC batch - same product, different usage!
        },
        {
          productId: productIds[1].id,
          productName: mockProducts[1].name,
          quantity: 15,
          unitPrice: mockProducts[1].unitCost,
          totalPrice: mockProducts[1].unitCost * 15,
          usageType: "salon-use"
        },
        {
          productId: productIds[2].id,
          productName: mockProducts[2].name,
          quantity: 25,
          unitPrice: mockProducts[2].unitCost,
          totalPrice: mockProducts[2].unitCost * 25,
          usageType: "salon-use"
        }
      ],
      createdBy: userData?.uid || 'system',
      createdByName: userData?.firstName && userData?.lastName 
        ? `${userData.firstName} ${userData.lastName}` 
        : (userData?.email || 'System Admin'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    purchaseOrder.totalAmount = purchaseOrder.items.reduce((sum, item) => sum + item.totalPrice, 0);
    
    const docRef = await addDoc(collection(db, 'purchaseOrders'), purchaseOrder);
    setProgress(`Created purchase order: ${purchaseOrder.orderId}`);
    
    return docRef.id;
  };

  const generateMockData = async () => {
    if (!userData?.branchId) {
      toast.error('Branch ID not found. Please ensure you are logged in with a branch.');
      return;
    }

    setLoading(true);
    setProgress('Starting...');

    try {
      // Step 1: Add products
      const productIds = await addProducts();
      if (productIds.length === 0) {
        toast.error('Failed to add products');
        setLoading(false);
        return;
      }
      toast.success(`Added ${productIds.length} products`);

      // Step 2: Add services
      const serviceIds = await addServices(productIds);
      if (serviceIds.length > 0) {
        toast.success(`Added ${serviceIds.length} services`);
      }

      // Step 3: Get or create supplier
      const supplier = await getOrCreateSupplier();

      // Step 4: Add purchase order
      const poId = await addPurchaseOrder(
        userData.branchId,
        supplier.id,
        supplier.name,
        productIds
      );
      toast.success('Created purchase order with mixed usage types!');

      setProgress('Complete!');
      toast.success('Mock data generated successfully!', {
        duration: 5000,
        icon: '🎉'
      });

      // Show summary
      setTimeout(() => {
        alert(
          `✅ Mock Data Generated!\n\n` +
          `📦 Products: ${productIds.length}\n` +
          `✂️ Services: ${serviceIds.length}\n` +
          `🛒 Purchase Order: Created\n\n` +
          `💡 Note: The purchase order contains the same product (Shampoo) added twice:\n` +
          `   - 20 units (Salon Use)\n` +
          `   - 10 units (OTC)\n\n` +
          `You can now:\n` +
          `1. View the PO in Inventory → Purchase Orders\n` +
          `2. Mark it as delivered to create batches\n` +
          `3. Test the usage type feature!`
        );
      }, 1000);

    } catch (error) {
      console.error('Error generating mock data:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <div className="p-6">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Package className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mock Data Generator</h1>
            <p className="text-sm text-gray-600">Generate sample data to test the usage type feature</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">What will be created:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
            <li><strong>5 Products</strong> - Hair care products with pricing</li>
            <li><strong>3 Services</strong> - With product mappings (quantity & percentage)</li>
            <li><strong>1 Purchase Order</strong> - With same product added twice (Salon Use + OTC)</li>
          </ul>
          <p className="text-xs text-blue-700 mt-3">
            💡 The purchase order demonstrates ordering the same product with different usage types!
          </p>
        </div>

        {progress && (
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
              <span className="text-sm text-gray-700">{progress}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={generateMockData}
            disabled={loading || !userData?.branchId}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Package className="h-4 w-4 mr-2" />
                Generate Mock Data
              </>
            )}
          </Button>
        </div>

        {!userData?.branchId && (
          <p className="mt-4 text-sm text-red-600">
            ⚠️ Branch ID not found. Please ensure you are logged in with a branch account.
          </p>
        )}

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Important Notes:</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
            <li>This will add real data to your database</li>
            <li>Make sure you're okay with adding test data</li>
            <li>The purchase order will be in "Pending" status - you can mark it as delivered later</li>
            <li>After delivery, batches will be created with their respective usage types</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default MockDataGenerator;





