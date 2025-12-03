/**
 * POS-Style Billing Modal Component
 * Design matches modern POS interface
 */

import { useState, useEffect, useRef } from 'react';
import { X, Banknote, Tag, Search, CreditCard, Wallet, Gift, Scissors, Package, Smartphone, Star, CheckCircle, AlertCircle, QrCode, Camera } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import LoadingSpinner from '../ui/LoadingSpinner';
import { PAYMENT_METHODS, calculateBillTotals } from '../../services/billingService';
import { getLoyaltyPoints } from '../../services/loyaltyService';
import { validatePromotionCode, calculatePromotionDiscount, trackPromotionUsage } from '../../services/promotionService';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import toast from 'react-hot-toast';
import { inventoryService } from '../../services/inventoryService';
import { formatDate } from '../../utils/helpers';

const BillingModalPOS = ({
  isOpen,
  appointment,
  onClose,
  onSubmit,
  loading,
  services = [],
  stylists = [],
  clients = [],
  mode = 'billing' // 'billing', 'start-service', or 'checkin'
}) => {
  const { userBranch } = useAuth();
  const [formData, setFormData] = useState({
    items: [], // Each item will have: { id, name, price, basePrice, stylistId, stylistName, clientType, adjustment, adjustmentReason }
    discountType: 'fixed',
    discount: '',
    loyaltyPointsUsed: '',
    paymentMethod: PAYMENT_METHODS.CASH,
    paymentReference: '',
    receiptNumber: '', // Receipt number from physical receipt
    notes: '',
    amountReceived: '',
    tax: '',
    // Client info for walk-in customers
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    clientId: ''
  });

  const [totals, setTotals] = useState({
    subtotal: 0,
    discount: 0,
    serviceCharge: 0,
    tax: 0,
    total: 0
  });

  const [serviceSearch, setServiceSearch] = useState('');
  const [salePanelWidth, setSalePanelWidth] = useState(384); // 384px = w-96
  const [isResizing, setIsResizing] = useState(false);
  const [matchedClient, setMatchedClient] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientList, setShowClientList] = useState(false);
  const [activeTab, setActiveTab] = useState('service'); // 'service' or 'product'
  const [clientLoyaltyPoints, setClientLoyaltyPoints] = useState(0);
  
  // Promotion code states
  const [promotionCode, setPromotionCode] = useState('');
  const [appliedPromotion, setAppliedPromotion] = useState(null);
  const [promotionDiscount, setPromotionDiscount] = useState(0);
  const [validatingPromotion, setValidatingPromotion] = useState(false);
  const [promotionError, setPromotionError] = useState('');
  
  // Products and stocks
  const [availableProducts, setAvailableProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  
  // QR Code Scanner states
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const qrCodeScannerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      const modalRect = document.querySelector('.billing-modal-content')?.getBoundingClientRect();
      if (!modalRect) return;
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const newWidth = modalRect.right - clientX;
      const minWidth = 300;
      const maxWidth = 800;
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setSalePanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove);
      document.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isResizing]);

  // Fetch client loyalty points when appointment/client changes
  useEffect(() => {
    const fetchLoyaltyPoints = async () => {
      // Priority: appointment.clientId (from appointment) > formData.clientId (from walk-in selection)
      const clientId = appointment?.clientId || formData.clientId;
      // Get branchId from appointment or userBranch
      const branchId = appointment?.branchId || userBranch;
      
      if (clientId && branchId && isOpen) {
        try {
          console.log('🔍 Fetching loyalty points for client:', clientId, 'at branch:', branchId);
          const points = await getLoyaltyPoints(clientId, branchId);
          setClientLoyaltyPoints(points);
          console.log('✅ Fetched loyalty points:', points, 'for client:', clientId, 'at branch:', branchId);
        } catch (error) {
          console.error('❌ Error fetching loyalty points:', error);
          setClientLoyaltyPoints(0);
        }
      } else {
        setClientLoyaltyPoints(0);
      }
    };

    if (isOpen) {
      fetchLoyaltyPoints();
    }
  }, [isOpen, appointment?.clientId, appointment?.branchId, formData.clientId, userBranch]);

  // Reset form data when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData(prev => ({
        ...prev,
        receiptNumber: '', // Reset receipt number when modal closes
        items: [],
        discount: '',
        loyaltyPointsUsed: '',
        paymentMethod: PAYMENT_METHODS.CASH,
        paymentReference: '',
        amountReceived: '',
        tax: ''
      }));
      setAppliedPromotion(null);
      setPromotionCode('');
      setPromotionDiscount(0);
    }
  }, [isOpen]);

  // Fetch products and stocks when modal opens
  useEffect(() => {
    const fetchProductsAndStocks = async () => {
      if (!isOpen || !userBranch) return;

      try {
        setLoadingProducts(true);

        // Fetch products available to this branch
        const productsRef = collection(db, 'products');
        const productsSnapshot = await getDocs(productsRef);
        
        const branchProducts = [];
        productsSnapshot.forEach((doc) => {
          const productData = doc.data();
          
          // Check if product is available to this branch
          const isAvailableToBranch = productData.branches && 
            Array.isArray(productData.branches) &&
            productData.branches.includes(userBranch);
          
          if (isAvailableToBranch) {
            branchProducts.push({
              id: doc.id,
              name: productData.name || 'Unknown Product',
              price: productData.otcPrice || productData.salonUsePrice || productData.unitCost || 0,
              basePrice: productData.otcPrice || productData.salonUsePrice || productData.unitCost || 0,
              category: productData.category || '',
              brand: productData.brand || '',
              imageUrl: productData.imageUrl || '',
              description: productData.description || '',
              status: productData.status || 'Active',
              stock: 0, // Will be updated with stock data
              ...productData
            });
          }
        });

        // Fetch stock information for this branch from stocks collection
        const stocksRef = collection(db, 'stocks');
        const stocksQuery = query(
          stocksRef,
          where('branchId', '==', userBranch),
          where('status', '==', 'active')
        );
        const stocksSnapshot = await getDocs(stocksQuery);
        
        const stocks = [];
        stocksSnapshot.forEach((doc) => {
          const stockData = doc.data();
          stocks.push({
            id: doc.id,
            productId: stockData.productId,
            productName: stockData.productName,
            realTimeStock: stockData.realTimeStock || 0,
            status: stockData.status || 'active',
            ...stockData
          });
        });

        // Merge products with stock data
        const productsWithStock = branchProducts.map(product => {
          const stock = stocks.find(s => s.productId === product.id);
          return {
            ...product,
            stock: stock?.realTimeStock || 0,
            stockId: stock?.id || null,
            stockStatus: stock?.status || 'Out of Stock'
          };
        });

        // Only show active products
        setAvailableProducts(productsWithStock.filter(p => p.status === 'Active'));
      } catch (error) {
        console.error('Error fetching products and stocks:', error);
        toast.error('Failed to load products');
        setAvailableProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    if (isOpen) {
      fetchProductsAndStocks();
    } else {
      // Reset when modal closes
      setAvailableProducts([]);
    }
  }, [isOpen, userBranch]);

  useEffect(() => {
    if (isOpen) {
      // Initialize client info (for walk-in or from appointment)
      const isWalkIn = appointment?.isWalkIn || !appointment?.clientId;
      // Check if this is a checkout with existing services (from arrivals - walk-in or appointment)
      const hasExistingServices = appointment?.services?.length > 0 || appointment?.serviceName;
      // For walk-in checkout, we should pre-fill with arrival data
      const isWalkInCheckout = isWalkIn && hasExistingServices && mode === 'billing';
      
      if (isWalkIn && !isWalkInCheckout) {
        // For new walk-in (no existing services), start with empty fields
        setFormData(prev => ({
          ...prev,
          clientName: '',
          clientPhone: '',
          clientEmail: '',
          clientId: '',
          items: []
        }));
        setMatchedClient(null);
        setClientSearch('');
        setShowClientList(false);
      } else if (isWalkInCheckout) {
        // For walk-in checkout with existing services, pre-fill client info from arrival
        setClientSearch(appointment?.clientName || '');
        setFormData(prev => ({
          ...prev,
          clientName: appointment?.clientName || '',
          clientPhone: appointment?.clientPhone || '',
          clientEmail: appointment?.clientEmail || '',
          clientId: appointment?.clientId || '',
          items: [] // Will be filled below
        }));
        setMatchedClient(null);
        setShowClientList(false);
      } else {
        // Sync clientSearch with formData.clientName for appointment-based billing
        setClientSearch(appointment?.clientName || '');
        // For appointment, use appointment client data
        setFormData(prev => ({
          ...prev,
          clientName: appointment?.clientName || '',
          clientPhone: appointment?.clientPhone || '',
          clientEmail: appointment?.clientEmail || '',
          clientId: appointment?.clientId || '',
          items: []
        }));
        setMatchedClient(null);
      }

      // If appointment/arrival exists and has services/products, load them
      // This now includes walk-in checkouts with existing services
      if (appointment && (!isWalkIn || isWalkInCheckout)) {
        // Load services
        const serviceItems = appointment.services && appointment.services.length > 0
          ? appointment.services.map(svc => {
              // Read client type and adjustments from appointment if they exist
              // These should be set when confirming/starting the appointment
              const basePrice = svc.price || svc.basePrice || 0;
              const adjustment = svc.adjustment || 0;
              const adjustedPrice = svc.adjustedPrice || (basePrice + adjustment);
              
              return {
                type: 'service',
                id: svc.serviceId,
                name: svc.serviceName,
                basePrice: basePrice,
                price: adjustedPrice, // Use adjusted price if available
                quantity: 1,
                stylistId: svc.stylistId,
                stylistName: svc.stylistName,
                clientType: svc.clientType || 'R', // Read from appointment
                adjustment: adjustment, // Read from appointment
                adjustmentReason: svc.adjustmentReason || '' // Read from appointment
              };
            })
          : appointment.serviceName
          ? [{
              type: 'service',
              id: appointment.serviceId || '',
              name: appointment.serviceName,
              basePrice: appointment.servicePrice || appointment.basePrice || 0,
              price: appointment.adjustedPrice || appointment.servicePrice || 0,
              quantity: 1,
              stylistId: appointment.stylistId,
              stylistName: appointment.stylistName,
              clientType: appointment.clientType || 'R',
              adjustment: appointment.adjustment || 0,
              adjustmentReason: appointment.adjustmentReason || ''
            }]
          : [];

        // Load products
        const productItems = appointment.products && appointment.products.length > 0
          ? appointment.products.map(prod => ({
              type: 'product',
              id: prod.productId,
              name: prod.productName,
              basePrice: prod.price,
              price: prod.total || (prod.price * (prod.quantity || 1)),
              quantity: prod.quantity || 1
            }))
          : [];

        // Combine services and products
        const items = [...serviceItems, ...productItems];

        // Load billing fields (discount, tax rate, etc.) if they exist
        setFormData(prev => ({
          ...prev,
          items,
          discount: appointment.discount !== undefined ? String(appointment.discount) : prev.discount,
          discountType: appointment.discountType || prev.discountType,
          tax: appointment.taxRate !== undefined ? String(appointment.taxRate) : (appointment.tax !== undefined ? String(appointment.tax) : prev.tax) // Support both taxRate and tax for backward compatibility
        }));
      }
    } else {
      // Reset form when modal closes
      setFormData({
        items: [],
        discountType: 'fixed',
        discount: '',
        loyaltyPointsUsed: '',
        paymentMethod: PAYMENT_METHODS.CASH,
        paymentReference: '',
        notes: '',
        amountReceived: '',
        tax: '',
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        clientId: ''
      });
    }
  }, [appointment, isOpen]);

  useEffect(() => {
    // Calculate promotion discount if promotion is applied
    let promoDiscount = 0;
    if (appliedPromotion) {
      const services = formData.items.filter(item => item.type === 'service');
      const products = formData.items.filter(item => item.type === 'product');
      const subtotal = formData.items.reduce((sum, item) => sum + (item.price || 0), 0);
      const promoResult = calculatePromotionDiscount(appliedPromotion, subtotal, services, products);
      promoDiscount = promoResult.discountAmount;
      setPromotionDiscount(promoDiscount);
    } else {
      setPromotionDiscount(0);
    }

    const calculated = calculateBillTotals({
      items: formData.items,
      discount: parseFloat(formData.discount) || 0,
      discountType: formData.discountType,
      taxRate: parseFloat(formData.tax) || 0,
      serviceChargeRate: 0,
      loyaltyPointsUsed: parseInt(formData.loyaltyPointsUsed) || 0,
      promotionDiscount: promoDiscount // Add promotion discount
    });
    setTotals(calculated);
  }, [formData.items, formData.discount, formData.discountType, formData.loyaltyPointsUsed, formData.tax, appliedPromotion]);

  const handleToggleService = (service) => {
    const existing = formData.items.find(item => item.id === service.id && item.type === 'service');
    if (existing) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter(item => !(item.id === service.id && item.type === 'service'))
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, {
          type: 'service',
          id: service.id,
          name: service.serviceName || service.name || 'Unknown Service',
          basePrice: service.price || 0,
          price: service.price || 0,
          quantity: 1,
          stylistId: '',
          stylistName: '',
          clientType: 'R',
          adjustment: 0,
          adjustmentReason: ''
        }]
      }));
    }
  };

  // Handle QR code scan result
  const handleQRCodeScanned = async (decodedText) => {
    try {
      // Parse QR code data (should be JSON from UPC generator)
      let qrData;
      try {
        qrData = JSON.parse(decodedText);
      } catch (e) {
        // If not JSON, try to find product by UPC or other identifier
        toast.error('Invalid QR code format');
        return;
      }

      // QR code should contain: productId, productName, batchNumber, etc.
      const productId = qrData.productId;
      const batchNumber = qrData.batchNumber;

      if (!productId) {
        toast.error('QR code does not contain product information');
        return;
      }

      // Find the product in available products
      let product = availableProducts.find(p => p.id === productId);
      
      // If product not found in current branch, try to load it
      if (!product && userBranch) {
        try {
          // Try to get product from inventory service
          const stocksRef = collection(db, 'branch_stocks');
          const stockQuery = query(
            stocksRef,
            where('branchId', '==', userBranch),
            where('productId', '==', productId)
          );
          const stockSnapshot = await getDocs(stockQuery);
          
          if (!stockSnapshot.empty) {
            const stockDoc = stockSnapshot.docs[0].data();
            // Get product details
            const productDocRef = doc(db, 'products', productId);
            const productDoc = await getDoc(productDocRef);
            
            if (productDoc.exists()) {
              const productData = productDoc.data();
              product = {
                id: productId,
                name: productData.name || qrData.productName,
                price: productData.otcPrice || productData.price || 0,
                stock: stockDoc.realTimeStock || 0,
                stockId: stockSnapshot.docs[0].id,
                unitCost: stockDoc.unitCost || 0,
                commissionPercentage: productData.commissionPercentage || 0
              };
            }
          }
        } catch (error) {
          console.error('Error loading product from QR code:', error);
        }
      }

      if (!product) {
        toast.error(`Product not found in this branch. Product ID: ${productId}`);
        return;
      }

      // Check stock
      if (product.stock <= 0) {
        toast.error(`${product.name} is out of stock`);
        return;
      }

      // Check if product is already in cart
      const existing = formData.items.find(item => item.id === product.id && item.type === 'product');
      if (existing) {
        // If already in cart, just increase quantity
        const existingIndex = formData.items.findIndex(item => item.id === product.id && item.type === 'product');
        handleUpdateItem(existingIndex, 'quantity', existing.quantity + 1);
        toast.success(`Increased quantity of ${product.name}`);
      } else {
        // Add product to cart (similar to handleToggleProduct)
        let batches = [];
        try {
          if (userBranch) {
            const batchesResult = await inventoryService.getBatchesForSale({
              branchId: userBranch,
              productId: product.id,
              quantity: 1
            });
            
            if (batchesResult.success && batchesResult.batches.length > 0) {
              // If QR code has batchNumber, try to match it
              if (batchNumber) {
                const matchedBatch = batchesResult.batches.find(b => b.batchNumber === batchNumber);
                if (matchedBatch) {
                  batches = [matchedBatch];
                } else {
                  batches = batchesResult.batches;
                }
              } else {
                batches = batchesResult.batches;
              }
            }
          }
        } catch (error) {
          console.error('Error fetching batches:', error);
        }

        setFormData(prev => ({
          ...prev,
          items: [...prev.items, {
            type: 'product',
            id: product.id,
            name: product.name || 'Unknown Product',
            basePrice: product.price || 0,
            price: product.price || 0,
            quantity: 1,
            stock: product.stock || 0,
            stockId: product.stockId || null,
            batches: batches,
            unitCost: product.unitCost || 0,
            commissionPercentage: product.commissionPercentage || 0,
            commissionerId: '',
            commissionerName: '',
            commissionPoints: 0
          }]
        }));
        
        toast.success(`Added ${product.name} to cart`);
      }

      // Stop scanning after successful scan
      stopQRScanner();
    } catch (error) {
      console.error('Error processing QR code:', error);
      toast.error('Failed to process QR code: ' + error.message);
    }
  };

  // Start QR code scanner
  const startQRScanner = async () => {
    try {
      setScannerError('');
      setIsScanning(true);

      const scanner = new Html5Qrcode('qr-reader');
      qrCodeScannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' }, // Use back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          // Successfully scanned
          handleQRCodeScanned(decodedText);
        },
        (errorMessage) => {
          // Ignore scanning errors (they're frequent during scanning)
        }
      );
    } catch (error) {
      console.error('Error starting QR scanner:', error);
      setScannerError('Failed to start camera. Please check permissions.');
      setIsScanning(false);
      toast.error('Failed to start QR scanner. Please allow camera access.');
    }
  };

  // Stop QR code scanner
  const stopQRScanner = async () => {
    try {
      if (qrCodeScannerRef.current) {
        await qrCodeScannerRef.current.stop();
        await qrCodeScannerRef.current.clear();
        qrCodeScannerRef.current = null;
      }
      setIsScanning(false);
      setScannerError('');
    } catch (error) {
      console.error('Error stopping QR scanner:', error);
    }
  };

  // Cleanup scanner on unmount or modal close
  useEffect(() => {
    if (!isOpen && isScanning) {
      stopQRScanner();
    }
    return () => {
      if (isScanning) {
        stopQRScanner();
      }
    };
  }, [isOpen]);

  const handleToggleProduct = async (product) => {
    // Check if product is in stock
    if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }

    const existing = formData.items.find(item => item.id === product.id && item.type === 'product');
    if (existing) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter(item => !(item.id === product.id && item.type === 'product'))
      }));
    } else {
      // Fetch batch information for FIFO tracking
      let batches = [];
      try {
        if (userBranch) {
          const batchesResult = await inventoryService.getBatchesForSale({
            branchId: userBranch,
            productId: product.id,
            quantity: 1
          });
          
          if (batchesResult.success && batchesResult.batches.length > 0) {
            batches = batchesResult.batches;
          }
        }
      } catch (error) {
        console.error('Error fetching batches:', error);
        // Continue without batch info if there's an error
      }

      setFormData(prev => ({
        ...prev,
        items: [...prev.items, {
          type: 'product',
          id: product.id,
          name: product.name || 'Unknown Product',
          basePrice: product.price || 0,
          price: product.price || 0,
          quantity: 1,
          stock: product.stock || 0,
          stockId: product.stockId || null,
          batches: batches, // Store batch information for FIFO tracking
          unitCost: product.unitCost || 0, // Store unit cost for commission calculation
          commissionPercentage: product.commissionPercentage || 0, // Store commission percentage
          commissionerId: '', // Will be set when commissioner is selected
          commissionerName: '', // Will be set when commissioner is selected
          commissionPoints: 0 // Will be calculated when commissioner is selected
        }]
      }));
    }
  };

  const handleUpdateItem = (index, field, value) => {
    const updatedItems = [...formData.items];
    const currentItem = updatedItems[index];
    
    if (field === 'stylistId') {
      const stylist = stylists.find(s => s.id === value);
      updatedItems[index].stylistId = value;
      updatedItems[index].stylistName = stylist ? `${stylist.firstName} ${stylist.lastName}` : '';
    } else if (field === 'clientType') {
      // When changing clientType from TR to X or R, clear stylist selection
      const wasTR = currentItem.clientType === 'TR' || currentItem.clientType === 'TR-Transfer';
      const isNowXorR = value === 'X' || value === 'R';
      
      updatedItems[index][field] = value;
      
      // If changing from TR to X/R, clear stylist (stylist should only be changeable for TR)
      if (wasTR && isNowXorR && currentItem.type === 'service') {
        updatedItems[index].stylistId = '';
        updatedItems[index].stylistName = '';
      }
    } else if (field === 'adjustment') {
      updatedItems[index].adjustment = parseFloat(value) || 0;
      // Recalculate final price: basePrice + adjustment
      updatedItems[index].price = updatedItems[index].basePrice + (parseFloat(value) || 0);
    } else if (field === 'quantity') {
      // For products, update quantity and recalculate price
      const quantity = parseInt(value) || 1;
      updatedItems[index].quantity = quantity;
      if (updatedItems[index].type === 'product') {
        updatedItems[index].price = updatedItems[index].basePrice * quantity;
        
        // Recalculate commission points if commissioner is selected
        if (updatedItems[index].commissionerId && updatedItems[index].unitCost && updatedItems[index].commissionPercentage) {
          const unitCost = Number(updatedItems[index].unitCost) || 0;
          const commissionPercentage = Number(updatedItems[index].commissionPercentage) || 0;
          updatedItems[index].commissionPoints = (unitCost * quantity) * (commissionPercentage / 100);
        }
        
        // Fetch updated batch information for the new quantity
        if (userBranch && updatedItems[index].id) {
          inventoryService.getBatchesForSale({
            branchId: userBranch,
            productId: updatedItems[index].id,
            quantity: quantity
          }).then(batchesResult => {
            if (batchesResult.success && batchesResult.batches.length > 0) {
              updatedItems[index].batches = batchesResult.batches;
              setFormData(prev => {
                const newItems = [...prev.items];
                newItems[index] = updatedItems[index];
                return { ...prev, items: newItems };
              });
            }
          }).catch(error => {
            console.error('Error fetching batches for quantity update:', error);
          });
        }
      }
    } else if (field === 'commissionerId') {
      // Handle commissioner selection for products
      const commissioner = stylists.find(s => s.id === value);
      updatedItems[index].commissionerId = value;
      updatedItems[index].commissionerName = commissioner ? `${commissioner.firstName} ${commissioner.lastName}` : '';
      
      // Calculate commission points: (unitCost * quantity) * (commissionPercentage / 100)
      if (updatedItems[index].type === 'product' && value) {
        const unitCost = Number(updatedItems[index].unitCost) || 0;
        const quantity = Number(updatedItems[index].quantity) || 1;
        const commissionPercentage = Number(updatedItems[index].commissionPercentage) || 0;
        updatedItems[index].commissionPoints = (unitCost * quantity) * (commissionPercentage / 100);
      } else {
        updatedItems[index].commissionPoints = 0;
      }
    } else {
      updatedItems[index][field] = value;
    }
    setFormData(prev => ({ ...prev, items: updatedItems }));
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Filter clients based on search (use formData.clientName as primary source)
  const searchTerm = (clientSearch || formData.clientName || '').trim().toLowerCase();
  const filteredClients = (clients || []).filter(client => {
    if (!client || !client.firstName || !client.lastName) return false;
    if (!searchTerm || searchTerm.length === 0) return false;
    
    const clientName = `${client.firstName || ''} ${client.lastName || ''}`.trim().toLowerCase();
    const clientPhone = (client.phoneNumber || client.phone || '').toString().trim();
    
    return clientName.includes(searchTerm) || clientPhone.includes(searchTerm);
  });

  // Handle client selection from search list
  const handleSelectClient = async (client) => {
    setMatchedClient(client);
    setClientSearch(`${client.firstName} ${client.lastName}`);
    setShowClientList(false);
    setFormData(prev => ({
      ...prev,
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      clientPhone: client.phoneNumber || client.phone || '',
      clientEmail: client.email || ''
    }));
    
    // Fetch loyalty points for selected client (branch-specific)
    if (client.id) {
      try {
        const branchId = appointment?.branchId || userBranch;
        if (branchId) {
          const points = await getLoyaltyPoints(client.id, branchId);
          setClientLoyaltyPoints(points);
        } else {
          setClientLoyaltyPoints(0);
        }
      } catch (error) {
        console.error('Error fetching loyalty points:', error);
        setClientLoyaltyPoints(0);
      }
    }
  };

  // Handle client name input change
  const handleClientNameChange = (e) => {
    const value = e.target.value;
    setClientSearch(value);
    setFormData(prev => ({ ...prev, clientName: value }));
    
    // Show client list if there's input and it's walk-in
    const isWalkIn = appointment?.isWalkIn || !appointment?.clientId;
    if (isWalkIn && value.trim().length >= 1 && clients && Array.isArray(clients) && clients.length > 0) {
      setShowClientList(true);
      // Clear matched client if user is typing a different name
      if (matchedClient && `${matchedClient.firstName} ${matchedClient.lastName}` !== value) {
        setMatchedClient(null);
        setFormData(prev => ({ ...prev, clientId: '' }));
      }
    } else {
      setShowClientList(false);
      if (value.trim().length === 0) {
        setMatchedClient(null);
        setFormData(prev => ({ ...prev, clientId: '' }));
      }
    }
  };

  // Handle client phone change
  const handleClientPhoneChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, clientPhone: value }));
    
    // Update search and show list if typing in name field is empty
    if (!clientSearch) {
      setClientSearch(value);
      const isWalkIn = appointment?.isWalkIn || !appointment?.clientId;
      if (isWalkIn && value.trim().length >= 1 && clients.length > 0) {
        setShowClientList(true);
      }
    }
  };

  // Close client list when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showClientList && !event.target.closest('.client-search-container')) {
        setShowClientList(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showClientList]);

  // Handle promotion code validation
  const handleValidatePromotionCode = async () => {
    if (!promotionCode.trim()) {
      setPromotionError('Please enter a promotion code');
      return;
    }

    if (!userBranch) {
      setPromotionError('Branch ID not found');
      return;
    }

    setValidatingPromotion(true);
    setPromotionError('');

    try {
      const clientId = appointment?.clientId || formData.clientId || null;
      const result = await validatePromotionCode(promotionCode.trim(), userBranch, clientId);

      if (result.success) {
        setAppliedPromotion(result.promotion);
        toast.success(`Promotion "${result.promotion.title}" applied!`);
        setPromotionError('');
      } else {
        setAppliedPromotion(null);
        setPromotionError(result.error || 'Invalid promotion code');
        toast.error(result.error || 'Invalid promotion code');
      }
    } catch (error) {
      console.error('Error validating promotion code:', error);
      setAppliedPromotion(null);
      setPromotionError('Failed to validate promotion code');
      toast.error('Failed to validate promotion code');
    } finally {
      setValidatingPromotion(false);
    }
  };

  // Remove promotion code
  const handleRemovePromotion = () => {
    setPromotionCode('');
    setAppliedPromotion(null);
    setPromotionDiscount(0);
    setPromotionError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate client name for service transactions
    if (formData.items.length > 0 && !formData.clientName.trim()) {
      toast.error('Client name is required for service transactions');
      return;
    }

    if (formData.items.length === 0) {
      toast.error('Please add at least one service or product');
      return;
    }

    // Validate product stock availability
    for (const item of formData.items) {
      if (item.type === 'product') {
        const product = availableProducts.find(p => p.id === item.id);
        if (!product) {
          toast.error(`Product "${item.name}" is no longer available`);
          return;
        }
        
        if (product.stock <= 0) {
          toast.error(`Product "${item.name}" is out of stock`);
          return;
        }
        
        if (item.quantity > product.stock) {
          toast.error(`Insufficient stock for "${item.name}". Only ${product.stock} units available.`);
          return;
        }
      }
    }

    // Validate stylist selection for TR (Transfer) client type in billing mode
    if (mode === 'billing') {
    const transferServices = formData.items.filter(item => item.type === 'service' && item.clientType === 'TR');
    for (const service of transferServices) {
      if (!service.stylistId || service.stylistId.trim() === '') {
        toast.error(`Stylist is required for Transfer (TR) client type. Please select a stylist for "${service.name}".`);
          return;
        }
      }
    }

    // Validate stylist selection for ALL services in checkin mode
    if (mode === 'checkin') {
      const servicesWithoutStylist = formData.items.filter(item => 
        item.type === 'service' && (!item.stylistId || item.stylistId.trim() === '')
      );
      if (servicesWithoutStylist.length > 0) {
        const serviceNames = servicesWithoutStylist.map(s => s.name).join(', ');
        toast.error(`Please assign a stylist to: ${serviceNames}`);
        return;
      }
    }

    // Validate amount received for cash payments (only in billing mode)
    if (mode === 'billing' && formData.paymentMethod === PAYMENT_METHODS.CASH) {
      const amountReceived = parseFloat(formData.amountReceived) || 0;
      if (!formData.amountReceived || amountReceived < totals.total) {
        toast.error(`Insufficient amount received! Required: ₱${totals.total.toFixed(2)}`);
        return;
      }
    }

    const isWalkIn = appointment?.isWalkIn || !appointment?.clientId;

    // Validate receipt number for billing mode
    if (mode === 'billing' && !formData.receiptNumber.trim()) {
      toast.error('Receipt number is required');
      return;
    }

    const billData = {
      appointmentId: isWalkIn ? null : appointment?.id,
      clientId: formData.clientId || null,
      clientName: formData.clientName,
      clientPhone: formData.clientPhone || '',
      clientEmail: formData.clientEmail || '',
      branchId: appointment?.branchId,
      branchName: appointment?.branchName,
      stylistId: appointment?.stylistId || formData.items[0]?.stylistId,
      stylistName: appointment?.stylistName || formData.items[0]?.stylistName,
      items: formData.items,
      subtotal: totals.subtotal,
      discount: parseFloat(formData.discount) || 0, // Store discount amount/percentage (not computed)
      discountType: formData.discountType,
      promotionCode: appliedPromotion ? promotionCode.trim().toUpperCase() : null,
      promotionId: appliedPromotion?.id || null,
      promotionDiscount: promotionDiscount || 0,
      loyaltyPointsUsed: parseInt(formData.loyaltyPointsUsed) || 0,
      tax: totals.tax, // Computed tax amount (for billing)
      taxRate: parseFloat(formData.tax) || 0, // Tax rate (for storing in appointment)
      total: totals.total,
      paymentMethod: formData.paymentMethod,
      paymentReference: formData.paymentReference,
      receiptNumber: formData.receiptNumber.trim(), // Receipt number from physical receipt
      amountReceived: formData.paymentMethod === PAYMENT_METHODS.CASH ? (parseFloat(formData.amountReceived) || 0) : totals.total,
      notes: formData.notes || (isWalkIn ? 'Walk-in customer' : '')
    };

    // Track promotion usage if promotion was applied
    if (appliedPromotion) {
      try {
        const clientId = formData.clientId || appointment?.clientId || null;
        await trackPromotionUsage(appliedPromotion.id, clientId);
      } catch (error) {
        console.error('Error tracking promotion usage:', error);
        // Don't block the submission if tracking fails
      }
    }

    onSubmit(billData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[1600px] h-[95vh] flex flex-col overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header - Dark Purple like Appointment Form */}
          <div className="bg-[#2D1B4E] px-8 py-5 relative">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="absolute top-4 right-4 p-1 text-white/80 hover:text-white transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-white mb-1">
              {mode === 'checkin'
                ? (appointment?.isWalkIn ? 'Add Walk-in Client' : 'Check-in Client')
                : mode === 'start-service' 
                ? 'Start Service' 
                : appointment?.isWalkIn || !appointment?.clientId 
                  ? 'Walk-in Customer' 
                  : 'Process Payment'}
            </h2>
            <p className="text-white/70 text-sm">
              {mode === 'checkin'
                ? 'Add services, products, and adjust details before confirming arrival'
                : mode === 'start-service'
                ? 'Add services/products and adjust prices before starting service'
                : appointment?.isWalkIn || !appointment?.clientId 
                  ? 'Create new transaction for walk-in customer'
                  : `Complete payment for pending invoice • Transaction #${appointment?.id?.slice(-8).toUpperCase() || 'Pending'}`
              }
            </p>
          </div>

          {/* Main Content - Two Columns */}
          <div className="flex-1 flex overflow-hidden billing-modal-content">
            {/* LEFT SIDE - Services Selection */}
            <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
              {/* Client Info */}
              <div className="bg-white p-6 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-[#2D1B4E]">
                  <div className="w-7 h-7 bg-[#2D1B4E] text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <h3 className="text-base font-bold text-gray-900">Client Information</h3>
                </div>
                {(appointment?.isWalkIn || !appointment?.clientId) ? (
                  // Walk-in: Editable fields with searchable client list
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="relative client-search-container">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Client Name *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.clientName}
                            onChange={handleClientNameChange}
                            onFocus={() => {
                              const isWalkIn = appointment?.isWalkIn || !appointment?.clientId;
                              if (isWalkIn && clients && Array.isArray(clients) && clients.length > 0) {
                                const currentSearch = (clientSearch || formData.clientName || '').trim();
                                if (currentSearch.length >= 1) {
                                  setShowClientList(true);
                                }
                              }
                            }}
                            className={`w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent text-sm ${
                              matchedClient ? 'bg-green-50 border-green-300' : ''
                            }`}
                            placeholder="Search or enter client name"
                            required
                          />
                          {/* Profile Picture next to input */}
                          {matchedClient && (
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-gray-200 border border-green-300">
                              {matchedClient.photoURL ? (
                                <img 
                                  src={matchedClient.photoURL} 
                                  alt={`${matchedClient.firstName} ${matchedClient.lastName}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-primary-600 flex items-center justify-center text-white text-xs font-semibold">
                                  {matchedClient.firstName?.[0]?.toUpperCase() || ''}
                                  {matchedClient.lastName?.[0]?.toUpperCase() || ''}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Searchable Client List */}
                        {showClientList && searchTerm.length >= 1 && (
                          <>
                            {filteredClients.length > 0 ? (
                              <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {filteredClients.map(client => (
                                  <button
                                    key={client.id}
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleSelectClient(client);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      {/* Profile Picture */}
                                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                                        {client.photoURL ? (
                                          <img 
                                            src={client.photoURL} 
                                            alt={`${client.firstName} ${client.lastName}`}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full bg-primary-600 flex items-center justify-center text-white text-xs font-semibold">
                                            {client.firstName?.[0]?.toUpperCase() || ''}
                                            {client.lastName?.[0]?.toUpperCase() || ''}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900">
                                          {client.firstName} {client.lastName}
                                        </p>
                                        <p className="text-xs text-gray-500 truncate">
                                          {(client.phoneNumber || client.phone) && `${client.phoneNumber || client.phone}`}
                                          {client.email && ` • ${client.email}`}
                                        </p>
                                      </div>
                                      {matchedClient?.id === client.id && (
                                        <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
                                <p className="text-xs text-gray-500">No matching clients found</p>
                              </div>
                            )}
                          </>
                        )}
                        
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
                        <input
                          type="tel"
                          value={formData.clientPhone}
                          onChange={handleClientPhoneChange}
                          className={`w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent text-sm ${
                            matchedClient ? 'bg-green-50 border-green-300' : ''
                          }`}
                          placeholder="Enter phone number"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
                        <input
                          type="email"
                          value={formData.clientEmail}
                          onChange={(e) => setFormData(prev => ({ ...prev, clientEmail: e.target.value }))}
                          className={`w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent text-sm ${
                            matchedClient ? 'bg-green-50 border-green-300' : ''
                          }`}
                          placeholder="Enter email address"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  // Appointment: Read-only fields
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Client Name *</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm font-medium">
                      {appointment?.clientName}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm">
                      {appointment?.clientPhone || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm">
                      {appointment?.clientEmail || '-'}
                    </div>
                  </div>
                </div>
                )}
              </div>

              {/* Services & Products Grid */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-[#2D1B4E]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-[#2D1B4E] text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                    <h3 className="text-base font-bold text-gray-900">Services & Products</h3>
                  </div>
                  
                  {/* Tab Buttons */}
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('service')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                        activeTab === 'service'
                          ? 'bg-[#2D1B4E] text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Scissors className="w-4 h-4" />
                      <span className="text-sm font-medium">Services</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('product')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                        activeTab === 'product'
                          ? 'bg-[#2D1B4E] text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Package className="w-4 h-4" />
                      <span className="text-sm font-medium">Products</span>
                    </button>
                  </div>
                </div>

                {/* Search Bar with QR Scanner Button (Products Tab Only) */}
                <div className="relative mb-4 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      placeholder={activeTab === 'service' ? 'Search services...' : 'Search products or scan QR code...'}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent text-sm"
                    />
                  </div>
                  {activeTab === 'product' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isScanning) {
                          stopQRScanner();
                        } else {
                          startQRScanner();
                        }
                      }}
                      className={`px-4 py-2 rounded-lg border-2 transition-all flex items-center gap-2 ${
                        isScanning
                          ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                          : 'bg-[#2D1B4E] border-[#2D1B4E] text-white hover:bg-[#3D2B5E]'
                      }`}
                    >
                      {isScanning ? (
                        <>
                          <X className="w-4 h-4" />
                          <span className="text-sm font-medium">Stop Scan</span>
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4" />
                          <span className="text-sm font-medium">Scan QR</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                {/* QR Code Scanner */}
                {isScanning && activeTab === 'product' && (
                  <div className="mb-4 p-4 bg-gray-900 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-white text-sm font-medium">Scan Product QR Code</p>
                      <button
                        type="button"
                        onClick={stopQRScanner}
                        className="text-white hover:text-gray-300"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div id="qr-reader" className="w-full"></div>
                    {scannerError && (
                      <p className="text-red-400 text-xs mt-2">{scannerError}</p>
                    )}
                    <p className="text-gray-400 text-xs mt-2 text-center">
                      Point camera at product QR code sticker
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-5 gap-3">
                  {/* Services Tab */}
                  {activeTab === 'service' && services
                    .filter(service => 
                      service?.serviceName?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
                      service?.name?.toLowerCase().includes(serviceSearch.toLowerCase())
                    )
                    .map((service) => {
                    const isSelected = formData.items.some(item => item.id === service.id && item.type === 'service');
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => handleToggleService(service)}
                        className={`px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
                          isSelected
                            ? 'border-[#2D1B4E] bg-purple-50 shadow-md'
                            : 'border-gray-300 bg-white hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          <Scissors className="w-3 h-3 text-blue-600" />
                          <p className={`font-semibold text-sm ${isSelected ? 'text-[#2D1B4E]' : 'text-gray-900'}`}>
                            {service.serviceName || service.name || 'Unknown Service'}
                          </p>
                        </div>
                        <p className={`text-base font-bold mb-0.5 ${isSelected ? 'text-purple-700' : 'text-gray-900'}`}>
                          ₱{service.price}
                        </p>
                        <p className="text-xs text-gray-500">{service.duration || '30'} m</p>
                      </button>
                    );
                  })}
                  
                  {/* Products Tab */}
                  {activeTab === 'product' && (
                    loadingProducts ? (
                      <div className="col-span-5 flex items-center justify-center py-8">
                        <LoadingSpinner size="sm" />
                        <span className="ml-2 text-sm text-gray-500">Loading products...</span>
                      </div>
                    ) : availableProducts.length === 0 ? (
                      <div className="col-span-5 text-center py-8 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No products available</p>
                      </div>
                    ) : (
                      availableProducts
                        .filter(product => 
                          product?.name?.toLowerCase().includes(serviceSearch.toLowerCase())
                        )
                        .map((product) => {
                          const isSelected = formData.items.some(item => item.id === product.id && item.type === 'product');
                          const isOutOfStock = product.stock <= 0;
                          const isLowStock = product.stock > 0 && product.stock <= 10;
                          
                          return (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => handleToggleProduct(product)}
                              disabled={isOutOfStock}
                              className={`px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
                                isOutOfStock
                                  ? 'border-red-300 bg-red-50 opacity-60 cursor-not-allowed'
                                  : isSelected
                                  ? 'border-[#2D1B4E] bg-purple-50 shadow-md'
                                  : 'border-gray-300 bg-white hover:border-gray-400'
                              }`}
                            >
                              <div className="flex items-center gap-1 mb-0.5">
                                <Package className={`w-3 h-3 ${isOutOfStock ? 'text-red-600' : 'text-green-600'}`} />
                                <p className={`font-semibold text-sm ${isSelected ? 'text-[#2D1B4E]' : isOutOfStock ? 'text-red-700' : 'text-gray-900'}`}>
                                  {product.name || 'Unknown Product'}
                                </p>
                              </div>
                              <p className={`text-base font-bold mb-0.5 ${isSelected ? 'text-purple-700' : isOutOfStock ? 'text-red-700' : 'text-gray-900'}`}>
                                ₱{product.price}
                              </p>
                              <p className={`text-xs ${
                                isOutOfStock 
                                  ? 'text-red-600 font-semibold' 
                                  : isLowStock 
                                  ? 'text-yellow-600 font-semibold' 
                                  : 'text-gray-500'
                              }`}>
                                {isOutOfStock ? 'Out of Stock' : `Stock: ${product.stock}`}
                                {isLowStock && !isOutOfStock && ' (Low)'}
                              </p>
                            </button>
                          );
                        })
                    )
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT SIDE - Current Sale */}
            <div 
              className="flex flex-col bg-gray-50 border-l border-gray-300 relative"
              style={{ width: `${salePanelWidth}px` }}
            >
              {/* Resize Handle */}
              <div
                onMouseDown={() => setIsResizing(true)}
                onTouchStart={() => setIsResizing(true)}
                className={`absolute left-0 top-0 bottom-0 w-4 cursor-col-resize hover:bg-[#2D1B4E]/20 active:bg-[#2D1B4E]/30 transition-colors z-20 ${
                  isResizing ? 'bg-[#2D1B4E]/30' : 'bg-transparent'
                }`}
                title="Drag to resize"
              >
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-16 bg-gray-400 rounded-full" />
              </div>

              {/* Sale Header */}
              <div className="flex-1 p-4 overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-[#2D1B4E]">
                  <div className="w-7 h-7 bg-[#2D1B4E] text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  <h3 className="text-base font-bold text-gray-900">Current Sale</h3>
                </div>
                {!appointment?.isWalkIn && appointment?.clientId && (
                  <div className="text-xs text-gray-500 mb-4">
                    Transaction #: {appointment?.id?.slice(-8).toUpperCase() || 'Pending'}
              </div>
                )}

              {/* Scrollable Content */}
                <div className="space-y-2 flex-1 overflow-y-auto">
                    {formData.items.map((item, index) => (
                    <div key={index} className="bg-white p-3 rounded border">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {item.type === 'product' ? (
                              <Package className="h-3 w-3 text-green-600" />
                            ) : (
                              <Scissors className="h-3 w-3 text-blue-600" />
                            )}
                            <h5 className="font-medium text-gray-900 text-sm">{item.name}</h5>
                            {item.type === 'product' && (
                              <span className="text-xs text-gray-500">(Product)</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {item.type === 'product' ? (
                              <>
                                <span>₱{item.basePrice} x {item.quantity}</span>
                                <span className="ml-2 font-semibold text-green-600">
                                  = ₱{item.price}
                                </span>
                                {/* Display batch information for FIFO tracking */}
                                {item.batches && item.batches.length > 0 && (
                                  <div className="mt-1 text-xs text-gray-500">
                                    <span className="font-medium">Batch(es): </span>
                                    {item.batches.map((batch, idx) => {
                                      const expirationDate = batch.expirationDate 
                                        ? (batch.expirationDate instanceof Date 
                                            ? batch.expirationDate 
                                            : batch.expirationDate.toDate 
                                            ? batch.expirationDate.toDate() 
                                            : new Date(batch.expirationDate))
                                        : null;
                                      const formattedDate = expirationDate 
                                        ? formatDate(expirationDate, 'MMM dd, yyyy')
                                        : 'N/A';
                                      
                                      return (
                                        <div key={idx} className="mt-1">
                                          <span className="font-medium">{batch.batchNumber}</span>
                                          <span className="ml-1">({batch.quantity} unit{batch.quantity !== 1 ? 's' : ''})</span>
                                          {expirationDate && (
                                            <span className="ml-2 text-orange-600">
                                              • Expires: {formattedDate}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <span className={item.adjustment !== 0 ? 'line-through text-gray-400' : ''}>
                                  ₱{item.basePrice}
                                </span>
                                {item.adjustment !== 0 && (
                                  <span className="ml-2 font-semibold text-green-600">
                                    ₱{item.price}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                          className="text-red-500 hover:text-red-700 text-sm ml-2"
                          >
                          <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Quantity Input (for products) */}
                        {item.type === 'product' && (
                          <div className="mb-2">
                            <label className="text-xs text-gray-500 mb-1 block">Quantity:</label>
                            <input
                              type="number"
                              min="1"
                              max={item.stock || 0}
                              value={item.quantity || 1}
                              onChange={(e) => {
                                const quantity = parseInt(e.target.value) || 1;
                                const maxQuantity = item.stock || 0;
                                if (quantity > maxQuantity) {
                                  toast.error(`Only ${maxQuantity} units available`);
                                  handleUpdateItem(index, 'quantity', maxQuantity);
                                } else {
                                  handleUpdateItem(index, 'quantity', quantity);
                                }
                              }}
                              className={`w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent ${
                                item.quantity > (item.stock || 0) 
                                  ? 'border-red-300 bg-red-50' 
                                  : 'border-gray-300'
                              }`}
                            />
                            {item.stock !== undefined && (
                              <p className={`text-xs mt-1 ${
                                item.quantity > (item.stock || 0) 
                                  ? 'text-red-600 font-semibold' 
                                  : (item.stock || 0) <= 10 
                                  ? 'text-yellow-600' 
                                  : 'text-gray-400'
                              }`}>
                                Available: {item.stock}
                                {item.quantity > (item.stock || 0) && ' (Exceeds stock!)'}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Commissioner Selection (for products) */}
                        {item.type === 'product' && (
                          <div className="mb-2">
                            <label className="text-xs text-gray-500 mb-1 block">
                              Commissioner (Stylist)
                            </label>
                            <select
                              value={item.commissionerId || ''}
                              onChange={(e) => {
                                handleUpdateItem(index, 'commissionerId', e.target.value);
                              }}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent"
                            >
                              <option value="">No Commissioner</option>
                              {stylists.map(stylist => (
                                <option key={stylist.id} value={stylist.id}>
                                  {stylist.firstName} {stylist.lastName}
                                </option>
                              ))}
                            </select>
                            {item.commissionerId && item.commissionPoints > 0 && (
                              <p className="text-xs mt-1 text-purple-600">
                                Commission: ₱{item.commissionPoints.toFixed(2)} 
                                {item.commissionPercentage > 0 && ` (${item.commissionPercentage}% of ₱${((item.unitCost || 0) * (item.quantity || 1)).toFixed(2)})`}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Stylist Selection (only for services, and only changeable for TR) */}
                        {item.type === 'service' && (
                          <div className="mb-2">
                            <label className="text-xs text-gray-500 mb-1 block">
                              Stylist {mode === 'checkin' && <span className="text-red-500">*</span>}
                              {mode !== 'checkin' && item.clientType === 'TR' && <span className="text-red-500">*</span>}
                            </label>
                            {(mode === 'checkin' || item.clientType === 'TR') ? (
                              // Checkin mode or TR: Allow stylist change
                              <>
                                <select
                                  value={item.stylistId || ''}
                                  onChange={(e) => {
                                    const stylist = stylists.find(s => s.id === e.target.value);
                                    handleUpdateItem(index, 'stylistId', e.target.value);
                                    if (stylist) {
                                      handleUpdateItem(index, 'stylistName', `${stylist.firstName} ${stylist.lastName}`);
                                    } else {
                                      handleUpdateItem(index, 'stylistName', '');
                                    }
                                  }}
                                  required={mode === 'checkin' || item.clientType === 'TR'}
                                  className={`w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent ${
                                    (mode === 'checkin' || item.clientType === 'TR') && !item.stylistId 
                                      ? 'border-red-300 bg-red-50' 
                                      : 'border-gray-300'
                                  }`}
                                >
                                  <option value="">Select Stylist *</option>
                                  {stylists.map(stylist => (
                                    <option key={stylist.id} value={stylist.id}>
                                      {stylist.firstName} {stylist.lastName}
                                    </option>
                                  ))}
                                </select>
                                {(mode === 'checkin' || item.clientType === 'TR') && !item.stylistId && (
                                  <p className="text-xs text-red-500 mt-1">
                                    {mode === 'checkin' ? 'Please select a stylist' : 'Stylist is required for Transfer'}
                                  </p>
                                )}
                              </>
                            ) : (
                              // Billing mode with X or R: Show stylist as read-only (from appointment/service)
                              <input
                                type="text"
                                value={item.stylistName || 'Not assigned'}
                                readOnly
                                disabled
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600 cursor-not-allowed"
                              />
                            )}
                          </div>
                        )}

                        {/* Client Type (only for services) */}
                        {item.type === 'service' && (
                          <div className="space-y-1">
                            <label className="text-xs text-gray-500">Client Type:</label>
                            <div className="flex space-x-2">
                              <label className="flex items-center space-x-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`clientType-${index}`}
                                  value="X"
                                  checked={item.clientType === 'X' || item.clientType === 'X-New'}
                                  onChange={(e) => handleUpdateItem(index, 'clientType', e.target.value)}
                                  className="text-green-600 focus:ring-green-500"
                                />
                                <span className="text-xs text-gray-700">X-New</span>
                              </label>
                              <label className="flex items-center space-x-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`clientType-${index}`}
                                  value="R"
                                  checked={item.clientType === 'R' || item.clientType === 'R-Regular'}
                                  onChange={(e) => handleUpdateItem(index, 'clientType', e.target.value)}
                                  className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs text-gray-700">R-Regular</span>
                              </label>
                              <label className="flex items-center space-x-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`clientType-${index}`}
                                  value="TR"
                                  checked={item.clientType === 'TR' || item.clientType === 'TR-Transfer'}
                              onChange={(e) => handleUpdateItem(index, 'clientType', e.target.value)}
                              className="text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-xs text-gray-700">TR-Transfer</span>
                          </label>
                        </div>
                      </div>
                      )}

                      {/* Price Adjustment (only for services) */}
                      {item.type === 'service' && (
                        <div className="space-y-2 mt-2 pt-2 border-t border-gray-200">
                          <label className="text-xs text-gray-500">Price Adjustment:</label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="number"
                              placeholder="Adjustment (₱)"
                              value={item.adjustment || ''}
                              onChange={(e) => {
                                const adjustment = parseFloat(e.target.value) || 0;
                                const newPrice = item.basePrice + adjustment;
                                handleUpdateItem(index, 'adjustment', adjustment);
                                handleUpdateItem(index, 'price', newPrice);
                              }}
                              className="w-full sm:w-32 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent"
                            />
                          <input
                            type="text"
                            placeholder="Reason (e.g., Long hair)"
                            value={item.adjustmentReason || ''}
                            onChange={(e) => handleUpdateItem(index, 'adjustmentReason', e.target.value)}
                            className="flex-1 min-w-0 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent"
                          />
                        </div>
                        {item.adjustment !== 0 && (
                          <div className="text-xs text-gray-600 mt-2">
                            <span className="text-gray-400">Base: ₱{item.basePrice}</span>
                            <span className="mx-2">+</span>
                            <span className={item.adjustment > 0 ? 'text-green-600' : 'text-red-600'}>
                              ₱{item.adjustment}
                            </span>
                            <span className="mx-2">=</span>
                            <span className="font-semibold text-green-600">₱{item.price}</span>
                          </div>
                        )}
                        </div>
                      )}
                    </div>
                  ))}

                  {formData.items.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">No items selected</p>
                      <p className="text-xs">Add services or products to start a sale</p>
                    </div>
                  )}
                      </div>
                    </div>

              {/* Fixed Bottom Section */}
              <div className="border-t bg-white p-3 flex-shrink-0">
                <div className="space-y-2 mb-3">
                  {/* Promotion Code */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-purple-600" />
                        <label className="block text-xs font-medium text-gray-700">
                          Promotion Code
                        </label>
                      </div>
                      {appliedPromotion && (
                        <button
                          type="button"
                          onClick={handleRemovePromotion}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promotionCode}
                        onChange={(e) => {
                          setPromotionCode(e.target.value.toUpperCase());
                          setPromotionError('');
                          if (appliedPromotion) {
                            setAppliedPromotion(null);
                            setPromotionDiscount(0);
                          }
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleValidatePromotionCode();
                          }
                        }}
                        disabled={validatingPromotion || !!appliedPromotion}
                        className={`flex-1 px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent ${
                          appliedPromotion
                            ? 'bg-green-50 border-green-300'
                            : promotionError
                            ? 'border-red-300 bg-red-50'
                            : 'border-purple-300'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        placeholder="Enter promotion code"
                      />
                      {!appliedPromotion && (
                        <button
                          type="button"
                          onClick={handleValidatePromotionCode}
                          disabled={validatingPromotion || !promotionCode.trim()}
                          className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {validatingPromotion ? (
                            <>
                              <LoadingSpinner size="sm" />
                              Validating...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3" />
                              Apply
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    {appliedPromotion && (
                      <div className="mt-2 p-2 bg-green-100 border border-green-300 rounded">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <p className="text-xs font-semibold text-green-800">{appliedPromotion.title}</p>
                        </div>
                        <p className="text-xs text-green-700">{appliedPromotion.description}</p>
                        <p className="text-xs font-bold text-green-800 mt-1">
                          Discount: ₱{promotionDiscount.toFixed(2)}
                        </p>
                      </div>
                    )}
                    {promotionError && !appliedPromotion && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        <span>{promotionError}</span>
                      </div>
                    )}
                  </div>

                  {/* Loyalty Points (only for registered clients) */}
                  {(appointment?.clientId || formData.clientId) && clientLoyaltyPoints > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-600 fill-yellow-600" />
                          <label className="block text-xs font-medium text-gray-700">
                            Loyalty Points Available: <span className="font-bold text-yellow-700">{clientLoyaltyPoints}</span>
                          </label>
                        </div>
                        <span className="text-xs text-gray-500">1 pt = ₱1</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={clientLoyaltyPoints}
                        step="1"
                        value={formData.loyaltyPointsUsed || ''}
                        onChange={(e) => {
                          const points = parseInt(e.target.value) || 0;
                          if (points <= clientLoyaltyPoints) {
                            setFormData(prev => ({ ...prev, loyaltyPointsUsed: points.toString() }));
                          }
                        }}
                        className="w-full px-2 py-1 text-sm border border-yellow-300 rounded focus:ring-1 focus:ring-yellow-500 focus:border-transparent"
                        placeholder="Enter points to redeem"
                      />
                      {formData.loyaltyPointsUsed && parseInt(formData.loyaltyPointsUsed) > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          Discount: ₱{parseInt(formData.loyaltyPointsUsed) || 0}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Discount and Tax - Always editable */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Discount (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={formData.discount}
                        onChange={(e) => setFormData(prev => ({ ...prev, discount: e.target.value, discountType: 'percentage' }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tax (₱)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.tax}
                        onChange={(e) => setFormData(prev => ({ ...prev, tax: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                  </div>

                {/* Payment Method - Only show in billing mode */}
                {mode === 'billing' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Method *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={PAYMENT_METHODS.CASH}
                          checked={formData.paymentMethod === PAYMENT_METHODS.CASH}
                          onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                          className="text-blue-600"
                        />
                        <Banknote className="h-4 w-4 text-green-600" />
                        <span className="text-xs">Cash</span>
                      </label>
                      
                      <label className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={PAYMENT_METHODS.CARD}
                          checked={formData.paymentMethod === PAYMENT_METHODS.CARD}
                          onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                          className="text-blue-600"
                        />
                        <CreditCard className="h-4 w-4 text-blue-600" />
                        <span className="text-xs">Card</span>
                      </label>
                      
                      <label className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={PAYMENT_METHODS.VOUCHER}
                          checked={formData.paymentMethod === PAYMENT_METHODS.VOUCHER || formData.paymentMethod === PAYMENT_METHODS.GIFT_CARD}
                          onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: PAYMENT_METHODS.VOUCHER }))}
                          className="text-blue-600"
                        />
                        <Smartphone className="h-4 w-4 text-purple-600" />
                        <span className="text-xs">Digital</span>
                      </label>
                    </div>

                    {formData.paymentMethod === PAYMENT_METHODS.CASH && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received (₱) *</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.amountReceived}
                          onChange={(e) => setFormData(prev => ({ ...prev, amountReceived: e.target.value }))}
                          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent ${
                            formData.amountReceived && parseFloat(formData.amountReceived) < totals.total
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-300'
                          }`}
                          placeholder="Enter amount received"
                          required
                        />
                        {formData.amountReceived && parseFloat(formData.amountReceived) >= totals.total && (
                          <p className="mt-2 text-sm text-green-600 font-medium">
                            Change: ₱{Math.max(0, parseFloat(formData.amountReceived) - totals.total).toFixed(2)}
                          </p>
                        )}
                        {formData.amountReceived && parseFloat(formData.amountReceived) < totals.total && (
                          <p className="mt-2 text-sm text-red-600 font-medium">
                            Insufficient amount! Required: ₱{totals.total.toFixed(2)} | Short: ₱{(totals.total - parseFloat(formData.amountReceived)).toFixed(2)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Payment Reference for non-cash */}
                    {formData.paymentMethod !== PAYMENT_METHODS.CASH && (
                      <input
                        type="text"
                        value={formData.paymentReference}
                        onChange={(e) => setFormData(prev => ({ ...prev, paymentReference: e.target.value }))}
                        className="w-full mt-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B4E]"
                        placeholder="Reference number (optional)"
                      />
                    )}

                    {/* Receipt Number Input - Required when processing payment */}
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Receipt Number *
                      </label>
                      <input
                        type="text"
                        value={formData.receiptNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, receiptNumber: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent"
                        placeholder="Enter receipt number from physical receipt"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter the receipt number from the physical receipt</p>
                    </div>
                  </div>
                )}

                {/* Bill Summary */}
                <div className="space-y-1 text-xs mb-3">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₱{totals.subtotal.toFixed(2)}</span>
                  </div>
                  {promotionDiscount > 0 && (
                    <div className="flex justify-between text-purple-600">
                      <span>Promotion Discount:</span>
                      <span>-₱{promotionDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {totals.discount > 0 && (
                    <div className="flex justify-between">
                      <span>Discount ({formData.discount || 0}%):</span>
                      <span>-₱{totals.discount.toFixed(2)}</span>
                      </div>
                    )}
                  {totals.tax > 0 && (
                      <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>₱{totals.tax.toFixed(2)}</span>
                      </div>
                    )}
                  <hr />
                  <div className="flex justify-between font-bold text-base">
                    <span>TOTAL:</span>
                    <span className="text-[#2D1B4E]">₱{totals.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                <button
                  type="submit"
                  disabled={
                    loading || 
                    formData.items.length === 0 || 
                    (mode === 'billing' && formData.paymentMethod === PAYMENT_METHODS.CASH && 
                     (!formData.amountReceived || parseFloat(formData.amountReceived) < totals.total))
                  }
                    className="flex-1 bg-[#2D1B4E] hover:bg-[#3d2a5f] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 px-4 py-2 text-sm"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Processing...</span>
                    </>
                  ) : (
                      <span>
                        {mode === 'start-service' ? 'Start Service' : 
                         mode === 'checkin' ? (appointment?.isWalkIn ? 'Add to Queue' : 'Confirm Check-in') :
                         'Process Payment'}
                      </span>
                  )}
                </button>
                </div>
              </div>
            </div>
          </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BillingModalPOS;
