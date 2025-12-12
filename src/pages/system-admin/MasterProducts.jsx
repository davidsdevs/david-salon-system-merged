import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { productService } from '../../services/productService';
import { cloudinaryService } from '../../services/cloudinaryService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Eye,
  Package,
  Banknote,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  MoreVertical,
  Users,
  Home,
  Building2,
  Building,
  Settings,
  BarChart3,
  UserCog,
  Scissors,
  Package2,
  QrCode,
  Sparkles,
  Copy,
  ScanLine
} from 'lucide-react';
import { getAllServices } from '../../services/serviceManagementService';

const MasterProducts = () => {
  const { userData } = useAuth();
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [supplierFilter, setSupplierFilter] = useState('All');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);


  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalMode, setModalMode] = useState('create'); // 'create', 'edit', 'view'
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    brand: '',
    suppliers: [], // Changed to array for multiple suppliers
    description: '',
    unitCost: 0,
    otcPrice: 0,
    variants: '',
    upc: '',
    shelfLife: '',
    imageUrl: '',
    status: 'Active',
    commissionPercentage: 0
  });

  // Validation states
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  
  // Image upload states
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Service mapping states
  const [serviceMappings, setServiceMappings] = useState([]); // Array of {serviceId, serviceName, instructions: [{instruction, quantity, unit, percentage}]}
  const [allServices, setAllServices] = useState([]);
  const [showServiceSelector, setShowServiceSelector] = useState(false);
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');

  // Validation functions
  const validateField = (name, value) => {
    let error = '';
    
    switch (name) {
      case 'name':
        if (!value.trim()) {
          error = 'Product name is required';
        } else if (value.trim().length < 2) {
          error = 'Product name must be at least 2 characters';
        } else if (value.trim().length > 100) {
          error = 'Product name must be less than 100 characters';
        }
        break;
      
      case 'category':
        if (!value.trim()) {
          error = 'Category is required';
        } else if (value.trim().length < 2) {
          error = 'Category must be at least 2 characters';
        }
        break;
      
      case 'brand':
        if (!value.trim()) {
          error = 'Brand is required';
        } else if (value.trim().length < 2) {
          error = 'Brand must be at least 2 characters';
        }
        break;
      
      case 'suppliers':
        if (!value || (Array.isArray(value) && value.length === 0)) {
          error = 'Please select at least one supplier';
        }
        break;
      
      case 'unitCost':
        if (!value || value <= 0) {
          error = 'Unit cost must be greater than 0';
        } else if (value > 1000000) {
          error = 'Unit cost must be less than ₱1,000,000';
        }
        break;
      
      case 'otcPrice':
        if (!value || value <= 0) {
          error = 'OTC price must be greater than 0';
        } else if (value > 1000000) {
          error = 'OTC price must be less than ₱1,000,000';
        }
        break;
      
      case 'upc':
        if (!value.trim()) {
          error = 'UPC code is required';
        } else if (!/^DS-[A-Z]{4}-[A-Z]{4}-\d{4}$/.test(value.trim())) {
          error = 'UPC code must be in format: DS-XXXX-XXXX-XXXX';
        }
        break;
      
      case 'description':
        if (value.trim().length > 500) {
          error = 'Description must be less than 500 characters';
        }
        break;
      
      case 'imageUrl':
        if (value && !/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(value)) {
          error = 'Please enter a valid image URL (jpg, jpeg, png, gif, webp)';
        }
        break;
      
      case 'commissionPercentage':
        if (value < 0) {
          error = 'Commission percentage cannot be negative';
        } else if (value > 100) {
          error = 'Commission percentage cannot exceed 100%';
        }
        break;
      
      default:
        break;
    }
    
    return error;
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Validate all fields
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key]);
      if (error) {
        newErrors[key] = error;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Load suppliers from Firestore
  const loadSuppliers = async () => {
    try {
      const suppliersRef = collection(db, 'suppliers');
      const snapshot = await getDocs(suppliersRef);
      const suppliersList = [];
      snapshot.forEach((doc) => {
        suppliersList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setSuppliers(suppliersList);
    } catch (err) {
      console.error('Error loading suppliers:', err);
      // Don't set error state - suppliers are optional
    }
  };

  // Load products on component mount
  useEffect(() => {
    loadSuppliers();
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Loading products from database...');
      const result = await productService.getAllProducts();
      
      if (result.success) {
        // productService returns { success: true, products: [...] }
        const productsList = result.products || result.data || [];
        setProducts(productsList);
        console.log('✅ Products loaded from database:', productsList.length);
        if (productsList.length > 0) {
          console.log('📅 Sample product:', {
            id: productsList[0].id,
            name: productsList[0].name,
            supplier: productsList[0].supplier,
            createdAt: productsList[0].createdAt,
            updatedAt: productsList[0].updatedAt,
            createdAtType: typeof productsList[0].createdAt,
            updatedAtType: typeof productsList[0].updatedAt
          });
        }
      } else {
        setError(result.error || result.message || 'Failed to load products');
        console.error('❌ Failed to load products:', result.error || result.message);
      }
      
    } catch (err) {
      setError('Failed to load products');
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter products based on search and filters
  const filteredProducts = products.filter(product => {
    // Get supplier name for search
    const supplierDoc = product.supplier ? suppliers.find(s => s.id === product.supplier) : null;
    const supplierName = supplierDoc ? supplierDoc.name : product.supplier || '';
    
    const matchesSearch = 
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.upc?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'All' || product.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || product.status === statusFilter;
    const matchesBrand = brandFilter === 'All' || product.brand === brandFilter;
    const matchesSupplier = supplierFilter === 'All' || (() => {
      // If supplierFilter is a name, try to match by supplier name
      if (product.supplier) {
        const supplierDoc = suppliers.find(s => s.id === product.supplier);
        const supplierName = supplierDoc ? supplierDoc.name : product.supplier;
        return supplierName === supplierFilter;
      }
      return false;
    })();
    
    return matchesSearch && matchesCategory && matchesStatus && matchesBrand && matchesSupplier;
  });

  // Get unique categories, brands, and suppliers from real data
  const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];
  const brands = ['All', ...new Set(products.map(p => p.brand).filter(Boolean))];
  
  // Get supplier names for filter dropdown (from products) - handle both array and single supplier
  const supplierNames = ['All', ...new Set(products.flatMap(p => {
    if (Array.isArray(p.suppliers) && p.suppliers.length > 0) {
      return p.suppliers.map(supplierId => {
        const supplierDoc = suppliers.find(s => s.id === supplierId);
        return supplierDoc ? supplierDoc.name : supplierId;
      });
    }
    // Fallback for old single supplier structure
    if (p.supplier) {
      const supplierDoc = suppliers.find(s => s.id === p.supplier);
      return supplierDoc ? supplierDoc.name : p.supplier;
    }
    return [];
  }).filter(Boolean))];

  // Pagination calculations
  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, statusFilter, brandFilter, supplierFilter]);

  // Generate UPC code in format: DS-4LETTERS-BRAND-RANDOM
  const generateUPC = () => {
    // Get first 4 letters from product name (uppercase, no spaces)
    const nameAbbr = formData.name 
      ? formData.name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '').padEnd(4, 'X')
      : 'PROD';
    
    // Get brand abbreviation (uppercase, no spaces, max 4 chars)
    const brandAbbr = formData.brand 
      ? formData.brand.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '').padEnd(4, 'X')
      : 'BRND';
    
    // Generate random 4-digit number
    const randomNum = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Format: DS-XXXX-XXXX-XXXX
    const upc = `DS-${nameAbbr}-${brandAbbr}-${randomNum}`;
    
    return upc;
  };

  // Load services when modal opens
  useEffect(() => {
    const loadServices = async () => {
      if (showModal) {
        try {
          const services = await getAllServices();
          setAllServices(services);
        } catch (error) {
          console.error('Error loading services:', error);
        }
      }
    };
    loadServices();
  }, [showModal]);

  // Load existing service mappings when editing a product
  useEffect(() => {
    const loadServiceMappings = async () => {
      if (modalMode === 'edit' && selectedProduct?.id) {
        try {
          const services = await getAllServices();
          // Find services that use this product
          const mappings = [];
          services.forEach(service => {
            if (service.productMappings && Array.isArray(service.productMappings)) {
              const mapping = service.productMappings.find(m => m.productId === selectedProduct.id);
              if (mapping) {
                // Check if mapping has instructions (new structure) or old structure
                if (mapping.instructions && Array.isArray(mapping.instructions)) {
                  // New structure with instructions
                  mappings.push({
                    serviceId: service.id,
                    serviceName: service.name,
                    instructions: mapping.instructions
                  });
                } else {
                  // Old structure - convert to new structure with single instruction
                  mappings.push({
                    serviceId: service.id,
                    serviceName: service.name,
                    instructions: [{
                      instruction: 'Default',
                      quantity: mapping.quantity || 0,
                      unit: mapping.unit || 'ml',
                      percentage: mapping.percentage || 0
                    }]
                  });
                }
              }
            }
          });
          setServiceMappings(mappings);
        } catch (error) {
          console.error('Error loading service mappings:', error);
        }
      } else if (modalMode === 'create') {
        setServiceMappings([]);
      }
    };
    loadServiceMappings();
  }, [modalMode, selectedProduct?.id]);

  // Modal handlers
  const openCreateModal = () => {
    // Generate default UPC (will be regenerated when user fills in name/brand)
    const nameAbbr = 'PROD';
    const brandAbbr = 'BRND';
    const randomNum = Math.floor(1000 + Math.random() * 9000).toString();
    const autoGeneratedUPC = `DS-${nameAbbr}-${brandAbbr}-${randomNum}`;
    
    setFormData({
      name: '',
      category: '',
      brand: '',
      suppliers: [],
      description: '',
      unitCost: 0,
      otcPrice: 0,
      variants: '',
      upc: autoGeneratedUPC,
      shelfLife: '',
      imageUrl: '',
      status: 'Active',
      commissionPercentage: 0
    });
    setServiceMappings([]);
    setModalMode('create');
    setSelectedProduct(null);
    setShowModal(true);
  };

  const openEditModal = (product) => {
    // Handle both old format (single supplier) and new format (suppliers array)
    let suppliersArray = [];
    if (Array.isArray(product.suppliers)) {
      suppliersArray = product.suppliers;
    } else if (product.supplier) {
      suppliersArray = [product.supplier];
    }
    
    setFormData({
      name: product.name || '',
      category: product.category || '',
      brand: product.brand || '',
      suppliers: suppliersArray,
      description: product.description || '',
      unitCost: product.unitCost || 0,
      otcPrice: product.otcPrice || 0,
      variants: product.variants || '',
      upc: product.upc || '',
      shelfLife: product.shelfLife || '',
      imageUrl: product.imageUrl || '',
      status: product.status || 'Active',
      commissionPercentage: product.commissionPercentage || 0
    });
    setModalMode('edit');
    setSelectedProduct(product);
    setShowModal(true);
  };

  const openViewModal = (product) => {
    console.log('👁️ Opening view modal for product:', {
      id: product.id,
      name: product.name,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      createdAtType: typeof product.createdAt,
      updatedAtType: typeof product.updatedAt
    });
    
    // Handle both old format (single supplier) and new format (suppliers array)
    let suppliersArray = [];
    if (Array.isArray(product.suppliers)) {
      suppliersArray = product.suppliers;
    } else if (product.supplier) {
      suppliersArray = [product.supplier];
    }
    
    setFormData({
      name: product.name || '',
      category: product.category || '',
      brand: product.brand || '',
      suppliers: suppliersArray,
      description: product.description || '',
      unitCost: product.unitCost || 0,
      otcPrice: product.otcPrice || 0,
      variants: product.variants || '',
      upc: product.upc || '',
      shelfLife: product.shelfLife || '',
      imageUrl: product.imageUrl || '',
      status: product.status || 'Active',
      commissionPercentage: product.commissionPercentage || 0,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    });
    setModalMode('view');
    setSelectedProduct(product);
    setShowModal(true);
  };

  const openInactiveModal = (product) => {
    setSelectedProduct(product);
    setShowDeleteModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setShowDeleteModal(false);
    setSelectedProduct(null);
    setFormData({
      name: '',
      category: '',
      brand: '',
      suppliers: [],
      description: '',
      unitCost: 0,
      otcPrice: 0,
      variants: '',
      upc: '',
      shelfLife: '',
      imageUrl: '',
      status: 'Active',
      commissionPercentage: 0
    });
    // Reset image states
    setImageFile(null);
    setImagePreview(null);
    setUploadingImage(false);
    // Reset service mappings
    setServiceMappings([]);
    setShowServiceSelector(false);
    setServiceSearchTerm('');
    // Reset validation states
    setErrors({});
    setTouched({});
    // Clear any error messages
    setError(null);
  };

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Handle checkbox for suppliers
    if (name === 'supplierCheckbox') {
      const supplierId = value;
      setFormData(prev => {
        const currentSuppliers = prev.suppliers || [];
        let newSuppliers;
        if (checked) {
          // Add supplier if checked
          newSuppliers = [...currentSuppliers, supplierId];
        } else {
          // Remove supplier if unchecked
          newSuppliers = currentSuppliers.filter(id => id !== supplierId);
        }
        return {
          ...prev,
          suppliers: newSuppliers
        };
      });
      
      // Mark field as touched
      setTouched(prev => ({
        ...prev,
        suppliers: true
      }));
      
      // Validate field in real-time
      const currentSuppliers = formData.suppliers || [];
      const newSuppliers = checked 
        ? [...currentSuppliers, supplierId]
        : currentSuppliers.filter(id => id !== supplierId);
      const error = validateField('suppliers', newSuppliers);
      setErrors(prev => ({
        ...prev,
        suppliers: error
      }));
    } else {
      const newValue = type === 'number' ? parseFloat(value) || 0 : value;
      
      setFormData(prev => ({
        ...prev,
        [name]: newValue
      }));

      // Mark field as touched
      setTouched(prev => ({
        ...prev,
        [name]: true
      }));

      // Validate field in real-time
      const error = validateField(name, newValue);
      setErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
  };

  // Handle image file selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Generate UPC code in format: DS-4LETTERS-BRAND-RANDOM
  const generateUPCForForm = () => {
    // Get first 4 letters from product name (uppercase, no spaces)
    const nameAbbr = formData.name 
      ? formData.name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '').padEnd(4, 'X')
      : 'PROD';
    
    // Get brand abbreviation (uppercase, no spaces, max 4 chars)
    const brandAbbr = formData.brand 
      ? formData.brand.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '').padEnd(4, 'X')
      : 'BRND';
    
    // Generate random 4-digit number
    const randomNum = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Format: DS-XXXX-XXXX-XXXX
    const upc = `DS-${nameAbbr}-${brandAbbr}-${randomNum}`;
    
    setFormData(prev => ({ ...prev, upc }));
    
    // Mark as touched and clear error
    setTouched(prev => ({ ...prev, upc: true }));
    setErrors(prev => ({ ...prev, upc: '' }));
  };

  // Copy to clipboard helper
  const copyToClipboard = async (text, fieldName) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess(`${fieldName} copied to clipboard!`);
      setTimeout(() => setSuccess(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Handle barcode scanner input (UPC field)
  // Barcode scanners typically send Enter key after scanning
  const handleUPCKeyDown = (e) => {
    // If Enter is pressed and field has valid UPC format, treat as barcode scan
    if (e.key === 'Enter' && /^DS-[A-Z]{4}-[A-Z]{4}-\d{4}$/.test(formData.upc)) {
      e.preventDefault();
      // Validate and move to next field or submit
      handleBlur({ target: { name: 'upc' } });
    }
  };

  // Service mapping handlers
  const handleAddService = (service) => {
    setServiceMappings([...serviceMappings, {
      serviceId: service.id,
      serviceName: service.name,
      instructions: [
        {
          instruction: 'Small Hair',
          quantity: 0,
          unit: 'ml',
          percentage: 0
        },
        {
          instruction: 'Medium Hair',
          quantity: 0,
          unit: 'ml',
          percentage: 0
        },
        {
          instruction: 'Long Hair',
          quantity: 0,
          unit: 'ml',
          percentage: 0
        }
      ]
    }]);
    setShowServiceSelector(false);
    setServiceSearchTerm('');
  };

  const handleRemoveService = (serviceId) => {
    setServiceMappings(serviceMappings.filter(m => m.serviceId !== serviceId));
  };

  const handleAddInstruction = (serviceId) => {
    setServiceMappings(serviceMappings.map(m => 
      m.serviceId === serviceId 
        ? { 
            ...m, 
            instructions: [...(m.instructions || []), {
              instruction: '',
              quantity: 0,
              unit: 'ml',
              percentage: 0
            }]
          }
        : m
    ));
  };

  const handleRemoveInstruction = (serviceId, instructionIndex) => {
    setServiceMappings(serviceMappings.map(m => 
      m.serviceId === serviceId 
        ? { 
            ...m, 
            instructions: m.instructions.filter((_, idx) => idx !== instructionIndex)
          }
        : m
    ));
  };

  const handleUpdateInstruction = (serviceId, instructionIndex, field, value) => {
    setServiceMappings(serviceMappings.map(m => 
      m.serviceId === serviceId 
        ? { 
            ...m, 
            instructions: m.instructions.map((inst, idx) => 
              idx === instructionIndex
                ? { ...inst, [field]: field === 'quantity' || field === 'percentage' ? parseFloat(value) || 0 : value }
                : inst
            )
          }
        : m
    ));
  };

  // Update services with product mappings
  const updateServiceMappings = async (productId, productName) => {
    try {
      const { doc, updateDoc, writeBatch } = await import('firebase/firestore');
      const { db } = await import('../../config/firebase');
      const { Timestamp } = await import('firebase/firestore');
      
      const batch = writeBatch(db);
      const allServicesData = await getAllServices();
      
      // Get current service mappings for this product (from all services)
      const currentMappings = new Map();
      allServicesData.forEach(service => {
        if (service.productMappings && Array.isArray(service.productMappings)) {
          const mapping = service.productMappings.find(m => m.productId === productId);
          if (mapping) {
            currentMappings.set(service.id, mapping);
          }
        }
      });

      // Create map of new mappings
      const newMappings = new Map();
      serviceMappings.forEach(mapping => {
        newMappings.set(mapping.serviceId, mapping);
      });

      // Update services that need changes
      for (const service of allServicesData) {
        const serviceRef = doc(db, 'services', service.id);
        const currentMapping = currentMappings.get(service.id);
        const newMapping = newMappings.get(service.id);

        let productMappings = service.productMappings || [];
        
        if (newMapping) {
          // Add or update mapping with instructions
          const existingIndex = productMappings.findIndex(m => m.productId === productId);
          const mappingData = {
            productId,
            productName,
            instructions: newMapping.instructions || []
          };
          
          if (existingIndex >= 0) {
            productMappings[existingIndex] = mappingData;
          } else {
            productMappings.push(mappingData);
          }
        } else if (currentMapping) {
          // Remove mapping
          productMappings = productMappings.filter(m => m.productId !== productId);
        } else {
          // No change needed
          continue;
        }

        batch.update(serviceRef, {
          productMappings,
          updatedAt: Timestamp.now(),
          updatedBy: userData?.uid || 'system'
        });
      }

      await batch.commit();
    } catch (error) {
      console.error('Error updating service mappings:', error);
      throw error;
    }
  };

  // Upload image to Cloudinary
  const uploadImage = async () => {
    if (!imageFile) {
      console.log('❌ No image file selected');
      return null;
    }
    
    console.log('🔄 Starting image upload...');
    setUploadingImage(true);
    try {
      const result = await cloudinaryService.uploadImage(imageFile, 'salon-products');
      if (result.success) {
        console.log('✅ Image upload successful:', result.url);
        return result.url;
      } else {
        console.error('❌ Image upload failed:', result.error);
        alert('Image upload failed: ' + result.error);
        return null;
      }
    } catch (error) {
      console.error('❌ Image upload error:', error);
      alert('Image upload error: ' + error.message);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  // CRUD operations
  const handleCreate = async () => {
    try {
      // Upload image if selected (optional - don't fail if upload fails)
      let imageUrl = formData.imageUrl;
      if (imageFile) {
        console.log('🔄 Attempting to upload image...');
        try {
          const uploadedUrl = await uploadImage();
          if (uploadedUrl) {
            imageUrl = uploadedUrl;
            console.log('✅ Image uploaded successfully:', uploadedUrl);
          } else {
            console.log('⚠️ Image upload failed, using fallback URL');
          }
        } catch (imageError) {
          console.error('⚠️ Image upload error (non-blocking):', imageError);
          // Continue with product creation even if image upload fails
        }
      }

      const productData = {
        ...formData,
        imageUrl,
        suppliers: Array.isArray(formData.suppliers) ? formData.suppliers : (formData.suppliers ? [formData.suppliers] : [])
      };

      console.log('📦 Creating product with data:', productData);

      // Use the actual productService to create in database
      const result = await productService.createProduct(productData);
      
      if (result.success) {
        console.log('✅ Product created successfully with ID:', result.id);
        
        // Update service mappings if any
        if (serviceMappings.length > 0) {
          try {
            await updateServiceMappings(result.id, formData.name);
            console.log('✅ Service mappings updated successfully');
          } catch (mappingError) {
            console.error('⚠️ Error updating service mappings (non-blocking):', mappingError);
            // Don't fail product creation if mapping update fails
          }
        }
        
        // Reload products from database
        await loadProducts();
        setSuccess('Product created successfully!');
        closeModal();
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        console.error('❌ Failed to create product:', result.error);
        setError('Failed to create product: ' + result.error);
      }
      
    } catch (err) {
      console.error('❌ Error creating product:', err);
      setError('Error creating product: ' + err.message);
    }
  };

  const handleUpdate = async () => {
    try {
      // Upload image if selected (optional - don't fail if upload fails)
      let imageUrl = formData.imageUrl;
      if (imageFile) {
        console.log('🔄 Attempting to upload image...');
        try {
          const uploadedUrl = await uploadImage();
          if (uploadedUrl) {
            imageUrl = uploadedUrl;
            console.log('✅ Image uploaded successfully:', uploadedUrl);
          } else {
            console.log('⚠️ Image upload failed, using fallback URL');
          }
        } catch (imageError) {
          console.error('⚠️ Image upload error (non-blocking):', imageError);
          // Continue with product update even if image upload fails
        }
      }

      const productData = {
        ...formData,
        imageUrl,
        suppliers: Array.isArray(formData.suppliers) ? formData.suppliers : (formData.suppliers ? [formData.suppliers] : [])
      };

      console.log('📦 Updating product with data:', productData);

      // Use the actual productService to update in database
      const result = await productService.updateProduct(selectedProduct.id, productData);
      
      if (result.success) {
        console.log('✅ Product updated successfully');
        
        // Update service mappings
        try {
          await updateServiceMappings(selectedProduct.id, formData.name);
          console.log('✅ Service mappings updated successfully');
        } catch (mappingError) {
          console.error('⚠️ Error updating service mappings (non-blocking):', mappingError);
          // Don't fail product update if mapping update fails
        }
        
        // Reload products from database
        await loadProducts();
        setSuccess('Product updated successfully!');
        closeModal();
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        console.error('❌ Failed to update product:', result.error);
        setError('Failed to update product: ' + result.error);
      }
      
    } catch (err) {
      console.error('❌ Error updating product:', err);
      setError('Error updating product: ' + err.message);
    }
  };

  const handleToggleStatus = async () => {
    try {
      const newStatus = selectedProduct.status === 'Active' ? 'Inactive' : 'Active';
      console.log('🔄 Toggling product status:', selectedProduct.id, 'to', newStatus);
      
      // Use the actual productService to update status
      const result = await productService.updateProduct(selectedProduct.id, { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      if (result.success) {
        console.log('✅ Product status updated successfully');
        // Reload products from database
        await loadProducts();
        setShowDeleteModal(false);
        setSuccess(`Product ${newStatus.toLowerCase()} successfully!`);
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        console.error('❌ Failed to update product status:', result.error);
        setError('Failed to update product status: ' + result.error);
      }
      
    } catch (err) {
      console.error('❌ Error updating product status:', err);
      setError('Error updating product status: ' + err.message);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Mark all fields as touched
    const allTouched = {};
    Object.keys(formData).forEach(key => {
      allTouched[key] = true;
    });
    setTouched(allTouched);
    
    // Validate form
    if (!validateForm()) {
      setError('Please fix the validation errors before submitting.');
      return;
    }
    
    if (modalMode === 'create') {
      handleCreate();
    } else if (modalMode === 'edit') {
      handleUpdate();
    }
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const statusConfig = {
      'Active': { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      'Inactive': { color: 'bg-red-100 text-red-800', icon: XCircle },
      'Discontinued': { color: 'bg-gray-100 text-gray-800', icon: AlertTriangle }
    };
    
    const config = statusConfig[status] || statusConfig['Inactive'];
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="h-3 w-3" />
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#160B53]"></div>
        </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
        {/* === Error Display === */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
              <p className="text-red-800 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* === Success Display === */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <p className="text-green-800 text-sm">{success}</p>
              <button
                onClick={() => setSuccess(null)}
                className="ml-auto text-green-600 hover:text-green-800"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        
        {/* === Summary Cards === */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-full"><Package className="h-6 w-6 text-blue-600"/></div>
            <div>
              <p className="text-xs text-gray-500">Total Products</p>
              <p className="text-2xl font-semibold text-center">{products.length}</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-full"><CheckCircle className="h-6 w-6 text-green-600"/></div>
            <div>
              <p className="text-xs text-gray-500">Active</p>
              <p className="text-2xl font-semibold text-center">{products.filter(p => p.status === 'Active').length}</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-4">
            <div className="p-3 bg-red-50 rounded-full"><XCircle className="h-6 w-6 text-red-600"/></div>
            <div>
              <p className="text-xs text-gray-500">Inactive</p>
              <p className="text-2xl font-semibold text-center">{products.filter(p => p.status === 'Inactive').length}</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-full"><Banknote className="h-6 w-6 text-purple-600"/></div>
            <div>
              <p className="text-xs text-gray-500">Categories</p>
              <p className="text-2xl font-semibold text-center">{categories.length - 1}</p>
            </div>
          </Card>
        </div>

        {/* === Filter + Actions === */}
        <Card className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            {/* Left Side: Add Product Button */}
            <div className="flex-shrink-0">
              <Button
                className="flex items-center gap-2 bg-[#160B53] text-white hover:bg-[#12094A] transition-colors shadow-sm"
                onClick={openCreateModal}
              >
                <Plus className="h-4 w-4" /> Add Product
              </Button>
            </div>
              
            {/* Center: Search and Filters */}
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
                <Search className="absolute left-3 top-8 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                />
              </div>
              
              {/* Filters Row */}
              <div className="flex gap-2 flex-wrap">
              {/* Category Filter */}
                <div className="min-w-[100px]">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#160B53] focus:border-[#160B53]"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
                </div>
              
              {/* Brand Filter */}
                <div className="min-w-[100px]">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Brand</label>
              <select
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#160B53] focus:border-[#160B53]"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
              >
                {brands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
                </div>
              
              {/* Supplier Filter */}
                <div className="min-w-[100px]">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Supplier</label>
              <select
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#160B53] focus:border-[#160B53]"
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
              >
                {supplierNames.map(supplier => (
                  <option key={supplier} value={supplier}>{supplier}</option>
                ))}
              </select>
                </div>
              
              {/* Status Filter */}
                <div className="min-w-[100px]">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#160B53] focus:border-[#160B53]"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Discontinued">Discontinued</option>
              </select>
                </div>
              </div>
            </div>

            {/* Right Side: Status Info */}
            <div className="flex-shrink-0">
              <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg whitespace-nowrap">
                Showing <span className="font-semibold text-gray-900">{paginatedProducts.length}</span> of <span className="font-semibold text-gray-900">{filteredProducts.length}</span> products
                {filteredProducts.length !== products.length && (
                  <span className="text-blue-600"> (filtered)</span>
                )}
                {searchTerm && ` for "${searchTerm}"`}
              </div>
            </div>
          </div>
        </Card>

        {/* === Products Table === */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Brand
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    UPC
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Pricing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Commission
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Package className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                        <p className="text-gray-500 mb-4">
                          {filteredProducts.length === 0 
                            ? "Try adjusting your search or filter criteria"
                            : "No products match your current filters"
                          }
                        </p>
                        <Button
                          onClick={() => {
                            setSearchTerm('');
                            setCategoryFilter('All');
                            setStatusFilter('All');
                            setBrandFilter('All');
                            setSupplierFilter('All');
                          }}
                          className="bg-[#160B53] hover:bg-[#12094A] text-white"
                        >
                          Clear All Filters
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {product.imageUrl ? (
                            <img
                              className="h-10 w-10 rounded-lg object-cover"
                              src={product.imageUrl}
                              alt={product.name}
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-gray-200 flex items-center justify-center">
                              <Package className="h-5 w-5 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="ml-4 min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 break-words">
                            {product.name}
                          </div>
                          <div className="text-sm text-gray-500 break-words">
                            {product.description?.substring(0, 60)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="break-words">{product.category}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="break-words">{product.brand}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="break-words font-mono">{product.upc}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="space-y-1">
                        <div className="font-semibold text-[#160B53]">
                          ₱{product.unitCost?.toFixed(2) || '0.00'}
                        </div>
                        <div className="text-xs text-green-600">
                          OTC: ₱{product.otcPrice?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="text-center">
                        <span className="font-semibold text-purple-600">
                          {product.commissionPercentage || 0}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={product.status} />
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium">
                      <div className="flex justify-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openViewModal(product)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(product)}
                          className="text-green-600 hover:text-green-800"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openInactiveModal(product)}
                          className={product.status === 'Active' ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'}
                        >
                          {product.status === 'Active' ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="bg-white px-4 py-3 border-t border-gray-200">
            <div className="flex flex-col space-y-3">
              {/* Top row: Items per page and page info */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Show</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#160B53] focus:border-[#160B53]"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-xs text-gray-600">per page</span>
                </div>

                <div className="text-xs text-gray-600">
                  Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(endIndex, totalItems)}</span> of{' '}
                  <span className="font-medium">{totalItems}</span> results
                </div>
              </div>

              {/* Bottom row: Navigation buttons */}
              <div className="flex items-center justify-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs min-w-[40px]"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs min-w-[40px]"
                >
                  Prev
                </Button>
                
                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage <= 2) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 1) {
                      pageNum = totalPages - 2 + i;
                    } else {
                      pageNum = currentPage - 1 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-2 py-1 text-xs min-w-[32px] ${
                          currentPage === pageNum 
                            ? 'bg-[#160B53] text-white' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs min-w-[40px]"
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs min-w-[40px]"
                >
                  Last
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Simple Create/Edit/View Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className={`bg-white rounded-lg shadow-lg w-full mx-4 max-h-[90vh] overflow-hidden ${
              modalMode === 'view' ? 'max-w-4xl' : 'max-w-3xl'
            }`}>
              
              {/* Simple Modal Header */}
              <div className="bg-[#160B53] text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {modalMode === 'create' && <Plus className="h-5 w-5 text-white" />}
                    {modalMode === 'edit' && <Edit className="h-5 w-5 text-white" />}
                    {modalMode === 'view' && <Eye className="h-5 w-5 text-white" />}
                    <h2 className="text-xl font-semibold text-white">
                        {modalMode === 'create' && 'Add New Product'}
                        {modalMode === 'edit' && 'Edit Product'}
                        {modalMode === 'view' && 'Product Details'}
                      </h2>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={closeModal} 
                    className="text-white border-white hover:bg-white hover:text-[#160B53]"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="p-8 max-h-[calc(95vh-120px)] overflow-y-auto">

                {modalMode === 'view' ? (
                  /* Clean View Modal Layout */
                  <div className="space-y-6">
                    {/* Product Header */}
                    <div className="bg-gray-50 rounded-lg p-6">
                      <div className="flex items-start space-x-4">
                        {/* Product Image */}
                        <div className="flex-shrink-0">
                          {formData.imageUrl ? (
                            <img
                              src={formData.imageUrl}
                              alt={formData.name}
                              className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                            />
                          ) : (
                            <div className="w-20 h-20 bg-gray-200 rounded-lg border border-gray-200 flex items-center justify-center">
                              <Package className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                        
                        {/* Product Basic Info */}
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">{formData.name}</h3>
                          <div className="flex items-center space-x-3 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              formData.status === 'Active' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {formData.status}
                            </span>
                            <span className="text-sm text-gray-600">
                              UPC: {formData.upc}
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm">{formData.description}</p>
                        </div>
                        
                        {/* Price Display */}
                        <div className="text-right">
                          <div className="text-xl font-semibold text-[#160B53]">
                            ₱{formData.unitCost?.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">Unit Cost</div>
                            </div>
                      </div>
                    </div>

                    {/* Product Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Product Information */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                          <Package className="h-5 w-5 text-blue-600 mr-2" />
                            Product Information
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-sm font-medium text-gray-600">Category</span>
                            <span className="text-sm text-gray-900">{formData.category}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-sm font-medium text-gray-600">Brand</span>
                            <span className="text-sm text-gray-900">{formData.brand}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-sm font-medium text-gray-600">Suppliers</span>
                            <span className="text-sm text-gray-900">
                              {(() => {
                                if (!formData.suppliers || formData.suppliers.length === 0) {
                                  return 'N/A';
                                }
                                const supplierNames = formData.suppliers
                                  .map(supplierId => {
                                    const supplierDoc = suppliers.find(s => s.id === supplierId);
                                    return supplierDoc ? supplierDoc.name : supplierId;
                                  })
                                  .filter(Boolean);
                                return supplierNames.length > 0 ? supplierNames.join(', ') : 'N/A';
                              })()}
                            </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-sm font-medium text-gray-600">Shelf Life</span>
                            <span className="text-sm text-gray-900">{formData.shelfLife || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                              <span className="text-sm font-medium text-gray-600">Variants</span>
                            <span className="text-sm text-gray-900">{formData.variants || 'N/A'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Pricing Information */}
                        <div className="border border-gray-200 rounded-lg p-4">
                          <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                            <Banknote className="h-5 w-5 text-green-600 mr-2" />
                            Pricing Information
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-sm font-medium text-gray-600">Unit Cost</span>
                              <span className="text-sm text-gray-900 font-semibold">₱{formData.unitCost?.toLocaleString()}</span>
                                    </div>
                            <div className="flex justify-between items-center py-2 border-b border-gray-100">
                              <span className="text-sm font-medium text-gray-600">OTC Price</span>
                              <span className="text-sm text-green-600 font-semibold">₱{formData.otcPrice?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                              <span className="text-sm font-medium text-gray-600">Commission</span>
                              <span className="text-sm text-purple-600 font-semibold">{formData.commissionPercentage || 0}%</span>
                                    </div>
                                    </div>
                      </div>
                    </div>
                  </div>
                  ) : (
                    /* Enhanced Create/Edit Form Layout */
                    <form onSubmit={handleSubmit} className="space-y-6">
                      
                      {/* Form Progress Indicator */}
                      <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 bg-[#160B53] rounded-full animate-pulse"></div>
                            <span className="font-medium text-gray-700">Basic Information</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 bg-blue-300 rounded-full"></div>
                            <span className="text-gray-500">Pricing & Details</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                            <span className="text-gray-500">Media & Status</span>
                          </div>
                        </div>
                      </div>

                      {/* Basic Information Section */}
                      <div className="border border-gray-200 rounded-lg p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                          <Package className="h-5 w-5 text-blue-600 mr-2" />
                          Basic Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Product Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              name="name"
                              value={formData.name}
                              onChange={handleInputChange}
                              onBlur={handleBlur}
                              required
                              disabled={modalMode === 'view'}
                              placeholder="Enter product name"
                              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 ${
                                errors.name && touched.name 
                                  ? 'border-red-500' 
                                  : 'border-gray-300'
                              }`}
                            />
                            {errors.name && touched.name && (
                              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Category <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              name="category"
                              value={formData.category}
                              onChange={handleInputChange}
                              onBlur={handleBlur}
                              required
                              disabled={modalMode === 'view'}
                              placeholder="Enter category"
                              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 ${
                                errors.category && touched.category 
                                  ? 'border-red-500' 
                                  : 'border-gray-300'
                              }`}
                            />
                            {errors.category && touched.category && (
                              <p className="mt-1 text-sm text-red-600">{errors.category}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Brand <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              name="brand"
                              value={formData.brand}
                              onChange={handleInputChange}
                              onBlur={handleBlur}
                              required
                              disabled={modalMode === 'view'}
                              placeholder="Enter brand name"
                              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 ${
                                errors.brand && touched.brand 
                                  ? 'border-red-500' 
                                  : 'border-gray-300'
                              }`}
                            />
                            {errors.brand && touched.brand && (
                              <p className="mt-1 text-sm text-red-600">{errors.brand}</p>
                            )}
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Suppliers <span className="text-red-500">*</span>
                              <span className="text-xs text-gray-500 ml-2">(Select all suppliers that have this product)</span>
                            </label>
                            <div className={`border rounded-md p-4 max-h-60 overflow-y-auto ${
                              errors.suppliers && touched.suppliers 
                                ? 'border-red-500' 
                                : 'border-gray-300'
                            }`}>
                              {suppliers.length === 0 ? (
                                <p className="text-sm text-gray-500">No suppliers available. Please add suppliers first.</p>
                              ) : (
                                <div className="space-y-2">
                                  {suppliers.map(supplier => {
                                    const isChecked = formData.suppliers?.includes(supplier.id) || false;
                                    return (
                                      <label
                                        key={supplier.id}
                                        className={`flex items-center p-2 rounded-md cursor-pointer transition-colors ${
                                          isChecked 
                                            ? 'bg-blue-50 border border-blue-200' 
                                            : 'hover:bg-gray-50'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          name="supplierCheckbox"
                                          value={supplier.id}
                                          checked={isChecked}
                                          onChange={handleInputChange}
                                          onBlur={() => handleBlur({ target: { name: 'suppliers' } })}
                                          disabled={modalMode === 'view'}
                                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <span className="ml-3 text-sm text-gray-900">
                                          {supplier.name}
                                          {supplier.contactPerson && (
                                            <span className="text-gray-500 ml-2">({supplier.contactPerson})</span>
                                          )}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {errors.suppliers && touched.suppliers && (
                              <p className="mt-1 text-sm text-red-600">{errors.suppliers}</p>
                            )}
                            {formData.suppliers && formData.suppliers.length > 0 && (
                              <p className="mt-2 text-xs text-gray-600">
                                Selected: {formData.suppliers.length} supplier{formData.suppliers.length !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Pricing & Details Section */}
                      <div className="border border-gray-200 rounded-lg p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
                          <Banknote className="h-5 w-5 text-green-600 mr-2" />
                          Pricing & Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              UPC Code <span className="text-red-500">*</span>
                              <span className="text-xs text-gray-500 ml-2">(Format: DS-XXXX-XXXX-XXXX)</span>
                            </label>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <ScanLine className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                  type="text"
                                  name="upc"
                                  value={formData.upc}
                                  onChange={handleInputChange}
                                  onBlur={handleBlur}
                                  onKeyDown={handleUPCKeyDown}
                                  required
                                  disabled={modalMode === 'view'}
                                  placeholder="DS-XXXX-XXXX-XXXX"
                                  maxLength="20"
                                  autoComplete="off"
                                  className={`w-full pl-10 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 font-mono text-center ${
                                    errors.upc && touched.upc 
                                      ? 'border-red-500' 
                                      : 'border-gray-300'
                                  }`}
                                />
                                {/^DS-[A-Z]{4}-[A-Z]{4}-\d{4}$/.test(formData.upc) && (
                                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  </div>
                                )}
                              </div>
                              {modalMode !== 'view' && (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={generateUPCForForm}
                                    className="flex items-center gap-1 whitespace-nowrap"
                                    title="Generate random UPC"
                                  >
                                    <QrCode className="h-4 w-4" />
                                    Generate
                                  </Button>
                                  {formData.upc && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => copyToClipboard(formData.upc, 'UPC')}
                                      className="flex items-center gap-1"
                                      title="Copy UPC"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                            {errors.upc && touched.upc && (
                              <p className="mt-1 text-sm text-red-600">{errors.upc}</p>
                            )}
                            {formData.upc && !/^DS-[A-Z]{4}-[A-Z]{4}-\d{4}$/.test(formData.upc) && (
                              <p className="mt-1 text-xs text-gray-500">
                                Format: DS-XXXX-XXXX-XXXX (4 letters from product name, 4 letters from brand, 4 random digits)
                              </p>
                            )}
                            {/^DS-[A-Z]{4}-[A-Z]{4}-\d{4}$/.test(formData.upc) && (
                              <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Valid UPC code format
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Unit Cost <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">₱</span>
                              <input
                                type="number"
                                name="unitCost"
                                value={formData.unitCost}
                                onChange={handleInputChange}
                                onBlur={handleBlur}
                                required
                                min="0"
                                step="0.01"
                                disabled={modalMode === 'view'}
                                placeholder="0.00"
                                className={`w-full pl-8 pr-3 py-2.5 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 ${
                                  errors.unitCost && touched.unitCost 
                                    ? 'border-red-500' 
                                    : 'border-gray-300'
                                }`}
                              />
                            </div>
                            {errors.unitCost && touched.unitCost && (
                              <p className="mt-1 text-sm text-red-600">{errors.unitCost}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              OTC Price <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-green-500 font-bold">₱</span>
                              <input
                                type="number"
                                name="otcPrice"
                                value={formData.otcPrice}
                                onChange={handleInputChange}
                                required
                                min="0"
                                step="0.01"
                                disabled={modalMode === 'view'}
                                placeholder="0.00"
                                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] disabled:bg-gray-50 transition-all duration-200"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Product Variants
                            </label>
                            <input
                              type="text"
                              name="variants"
                              value={formData.variants}
                              onChange={handleInputChange}
                              disabled={modalMode === 'view'}
                              placeholder="e.g., 250ml, 500ml, 1L"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Shelf Life
                            </label>
                            <input
                              type="text"
                              name="shelfLife"
                              value={formData.shelfLife}
                              onChange={handleInputChange}
                              disabled={modalMode === 'view'}
                              placeholder="e.g., 24 months"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Commission Percentage
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                name="commissionPercentage"
                                value={formData.commissionPercentage}
                                onChange={handleInputChange}
                                onBlur={handleBlur}
                                min="0"
                                max="100"
                                step="0.01"
                                disabled={modalMode === 'view'}
                                placeholder="0.00"
                                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 ${
                                  errors.commissionPercentage && touched.commissionPercentage 
                                    ? 'border-red-500' 
                                    : 'border-gray-300'
                                }`}
                              />
                              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">%</span>
                            </div>
                            {errors.commissionPercentage && touched.commissionPercentage && (
                              <p className="mt-1 text-sm text-red-600">{errors.commissionPercentage}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Media & Status Section */}
                      <div className="border border-gray-200 rounded-lg p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                          <Settings className="h-5 w-5 text-purple-600 mr-2" />
                          Media & Status
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Product Status
                            </label>
                            <select
                              name="status"
                              value={formData.status}
                              onChange={handleInputChange}
                              disabled={modalMode === 'view'}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                            >
                              <option value="Active">🟢 Active</option>
                              <option value="Inactive">🔴 Inactive</option>
                              <option value="Discontinued">⚫ Discontinued</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Shelf Life
                            </label>
                            <input
                              type="text"
                              name="shelfLife"
                              value={formData.shelfLife}
                              onChange={handleInputChange}
                              disabled={modalMode === 'view'}
                              placeholder="e.g., 24 months"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Enhanced Image Upload Section */}
                      <div className="border border-gray-200 rounded-lg p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                          <Package className="h-5 w-5 text-orange-600 mr-2" />
                          Product Image
                        </h3>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Left Side: Upload Controls */}
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Upload Image File
                              </label>
                              <div className="relative">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                disabled={modalMode === 'view' || uploadingImage}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                  id="image-upload"
                                />
                                <label
                                  htmlFor="image-upload"
                                  className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <div className="flex items-center space-x-2">
                                    <Package className="h-5 w-5 text-gray-400" />
                                    <span className="text-sm font-medium text-gray-700">
                                      {uploadingImage ? 'Uploading...' : 'Choose Image File'}
                                    </span>
                                  </div>
                                </label>
                              </div>
                              
                              {/* Upload Status */}
                              {uploadingImage && (
                                <div className="mt-3 text-sm text-blue-600 font-medium">
                                  <div className="flex items-center space-x-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                    <span>Uploading image...</span>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Or Enter Image URL
                              </label>
                              <input
                                type="url"
                                name="imageUrl"
                                value={formData.imageUrl}
                                onChange={handleInputChange}
                                disabled={modalMode === 'view'}
                                placeholder="https://example.com/image.jpg"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                              />
                            </div>
                          </div>
                          
                          {/* Right Side: Image Preview */}
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-full max-w-sm">
                              <label className="block text-sm font-bold text-gray-700 mb-3 text-center">
                                Image Preview
                              </label>
                              
                              {(imagePreview || formData.imageUrl) ? (
                                <div className="relative">
                                  <img
                                    src={imagePreview || formData.imageUrl}
                                    alt="Product preview"
                                    className="w-full h-64 object-cover rounded-xl border-2 border-gray-200 shadow-lg"
                                  />
                                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-1">
                                    <Package className="h-4 w-4 text-gray-600" />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full h-64 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center">
                                  <Package className="h-12 w-12 text-gray-400 mb-3" />
                                  <p className="text-gray-500 text-sm font-medium">No image selected</p>
                                  <p className="text-gray-400 text-xs mt-1">Upload an image or enter URL</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Service-Product Mapping Section */}
                      <div className="border border-gray-200 rounded-lg p-6 mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <Scissors className="h-5 w-5 text-blue-600 mr-2" />
                          Service-Product Mapping
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Map this product to services with different instructions (e.g., Small Hair: 5ml @ 10%, Medium Hair: 10ml @ 12%, Long Hair: 20ml @ 15%). When a service is performed, the appropriate quantity will be deducted from salon-use batches based on the instruction selected.
                        </p>

                        {/* Service Mappings List */}
                        {serviceMappings.length > 0 && (
                          <div className="space-y-4 mb-4">
                            {serviceMappings.map((mapping) => {
                              const service = allServices.find(s => s.id === mapping.serviceId);
                              return (
                                <div key={mapping.serviceId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                      <h4 className="font-semibold text-gray-900 text-base mb-3">
                                        {mapping.serviceName || 'Unknown Service'}
                                      </h4>
                                      {service && (
                                        <p className="text-xs text-gray-500 mb-3">Category: {service.category || 'N/A'}</p>
                                      )}
                                    </div>
                                    {modalMode !== 'view' && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveService(mapping.serviceId)}
                                        className="text-red-600 hover:text-red-800 p-1"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                  {/* Instructions List */}
                                  <div className="space-y-3">
                                    {(mapping.instructions || []).map((instruction, instIdx) => (
                                      <div key={instIdx} className="bg-white border border-gray-200 rounded-lg p-3">
                                        <div className="flex items-start justify-between mb-2">
                                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Instruction
                                              </label>
                                              <input
                                                type="text"
                                                value={instruction.instruction || ''}
                                                onChange={(e) => handleUpdateInstruction(mapping.serviceId, instIdx, 'instruction', e.target.value)}
                                                disabled={modalMode === 'view'}
                                                placeholder="e.g., Small Hair, Medium Hair"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 text-sm"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Quantity (ml)
                                              </label>
                                              <div className="flex gap-2">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  value={instruction.quantity || 0}
                                                  onChange={(e) => handleUpdateInstruction(mapping.serviceId, instIdx, 'quantity', e.target.value)}
                                                  disabled={modalMode === 'view'}
                                                  placeholder="0"
                                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 text-sm"
                                                />
                                                <select
                                                  value={instruction.unit || 'ml'}
                                                  onChange={(e) => handleUpdateInstruction(mapping.serviceId, instIdx, 'unit', e.target.value)}
                                                  disabled={modalMode === 'view'}
                                                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 text-sm"
                                                >
                                                  <option value="ml">ml</option>
                                                  <option value="g">g</option>
                                                  <option value="pcs">pcs</option>
                                                  <option value="oz">oz</option>
                                                </select>
                                              </div>
                                            </div>
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Percentage (%)
                                              </label>
                                              <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                value={instruction.percentage || 0}
                                                onChange={(e) => handleUpdateInstruction(mapping.serviceId, instIdx, 'percentage', e.target.value)}
                                                disabled={modalMode === 'view'}
                                                placeholder="0"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 text-sm"
                                              />
                                            </div>
                                          </div>
                                          {modalMode !== 'view' && (
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveInstruction(mapping.serviceId, instIdx)}
                                              className="ml-2 text-red-600 hover:text-red-800 p-1"
                                              title="Remove instruction"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                    
                                    {/* Add Instruction Button */}
                                    {modalMode !== 'view' && (
                                      <button
                                        type="button"
                                        onClick={() => handleAddInstruction(mapping.serviceId)}
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded-md hover:bg-blue-50"
                                      >
                                        <Plus className="h-4 w-4" />
                                        Add Instruction
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Add Service Button */}
                        {modalMode !== 'view' && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowServiceSelector(!showServiceSelector)}
                              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium text-gray-700"
                            >
                              <Plus className="h-4 w-4" />
                              Add Service
                            </button>

                            {/* Service Selector Dropdown */}
                            {showServiceSelector && (
                              <div className="absolute z-10 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                <div className="p-2">
                                  <input
                                    type="text"
                                    placeholder="Search services..."
                                    value={serviceSearchTerm}
                                    onChange={(e) => setServiceSearchTerm(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm mb-2"
                                  />
                                  <div className="space-y-1">
                                    {allServices
                                      .filter(service => {
                                        const matchesSearch = service.name?.toLowerCase().includes(serviceSearchTerm.toLowerCase()) ||
                                                             service.category?.toLowerCase().includes(serviceSearchTerm.toLowerCase());
                                        const alreadyAdded = serviceMappings.some(m => m.serviceId === service.id);
                                        return matchesSearch && !alreadyAdded && service.isActive;
                                      })
                                      .map(service => (
                                        <button
                                          key={service.id}
                                          type="button"
                                          onClick={() => handleAddService(service)}
                                          className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded-md text-sm"
                                        >
                                          <div className="font-medium text-gray-900">{service.name}</div>
                                          <div className="text-xs text-gray-500">{service.category || 'N/A'}</div>
                                        </button>
                                      ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {serviceMappings.length === 0 && modalMode === 'view' && (
                          <p className="text-sm text-gray-500">This product is not mapped to any services.</p>
                        )}
                      </div>

                      {/* Description Section */}

                      <div className="border border-gray-200 rounded-lg p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                          <div className="w-3 h-3 bg-indigo-500 rounded-full mr-3"></div>
                          Additional Information
                        </h3>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">
                            Product Description
                          </label>
                          <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            disabled={modalMode === 'view'}
                            rows={4}
                            placeholder="Enter detailed product description..."
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] disabled:bg-gray-50 transition-all duration-200 resize-none"
                          />
                        </div>
                      </div>
                      
                      {/* Enhanced Form Actions */}
                      {modalMode !== 'view' && (
                        <div className="flex justify-end space-x-4 pt-8 border-t-2 border-gray-100">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={closeModal}
                            className="px-6 py-2 text-gray-700 hover:bg-gray-50"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 font-medium"
                          >
                            {modalMode === 'create' ? 'Create Product' : 'Update Product'}
                          </Button>
                        </div>
                      )}

                      {modalMode === 'view' && (
                        <div className="flex justify-end pt-8 border-t-2 border-gray-100">
                          <div className="flex space-x-4">
                            <Button 
                              onClick={() => {
                                setModalMode('edit');
                                setSelectedProduct(products.find(p => p.id === selectedProduct?.id));
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 font-medium"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Product
                            </Button>
                            <Button 
                              onClick={closeModal}
                              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 font-medium"
                            >
                              Close
                            </Button>
                          </div>
                        </div>
                      )}
                    </form>
                )}

              </div>
            </div>
          </div>
        )}

        {/* Enhanced Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 animate-in zoom-in-95 duration-300">
              
              {/* Enhanced Header */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-t-2xl">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-red-500/20 rounded-xl border border-red-400/30">
                    <AlertTriangle className="h-6 w-6 text-red-200" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Toggle Product Status</h3>
                    <p className="text-red-100 text-sm">Change product availability</p>
                  </div>
                </div>
              </div>
              
              <div className="p-8">
                {/* Product Info */}
                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                  <div className="flex items-center space-x-4">
                    {selectedProduct?.imageUrl ? (
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        className="w-16 h-16 object-cover rounded-lg border-2 border-white shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center border-2 border-white shadow-sm">
                        <Package className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg">{selectedProduct?.name}</h4>
                      <p className="text-sm text-gray-600">{selectedProduct?.category} • {selectedProduct?.brand}</p>
                      <p className="text-sm text-gray-500">UPC: {selectedProduct?.upc}</p>
                    </div>
                  </div>
                </div>
                
                <p className="text-gray-700 mb-8 text-center leading-relaxed">
                  Are you sure you want to {selectedProduct?.status === 'Active' ? 'make this product inactive' : 'make this product active'}? This will {selectedProduct?.status === 'Active' ? 'hide' : 'show'} the product from branch availability.
                </p>
                
                <div className="flex justify-end space-x-4">
                  <Button 
                    variant="outline" 
                    onClick={closeModal}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-all duration-200 font-medium"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleToggleStatus}
                    className={selectedProduct?.status === 'Active' ? 
                      "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-200 font-medium" :
                      "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
                    }
                  >
                    {selectedProduct?.status === 'Active' ? <ToggleLeft className="h-4 w-4 mr-2" /> : <ToggleRight className="h-4 w-4 mr-2" />}
                    {selectedProduct?.status === 'Active' ? 'Make Inactive' : 'Make Active'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
};

// Service-Product Mapping Section Component
const ServiceProductMappingSection = ({ productId, productName, isCreating = false }) => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMappings = async () => {
      try {
        setLoading(true);
        
        // If creating a new product, no productId exists yet, so no mappings
        if (isCreating || !productId) {
          setServices([]);
          setLoading(false);
          return;
        }
        
        const allServices = await getAllServices();
        
        // Filter services that use this product
        const servicesUsingProduct = allServices.filter(service => {
          if (!service.productMappings || !Array.isArray(service.productMappings)) return false;
          return service.productMappings.some(mapping => mapping.productId === productId);
        });
        
        setServices(servicesUsingProduct);
      } catch (error) {
        console.error('Error loading service mappings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMappings();
  }, [productId, isCreating]);

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 mb-6">
        <p className="text-sm text-gray-500">Loading service mappings...</p>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
          <Scissors className="h-5 w-5 text-blue-600 mr-2" />
          Service-Product Mapping
        </h3>
        {isCreating ? (
          <>
            <p className="text-sm text-gray-500">This product will be available for mapping to services after creation.</p>
            <p className="text-xs text-gray-400 mt-1">To map this product to services, go to Service Management and edit the service to add this product with quantity and percentage.</p>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500">This product is not currently mapped to any services.</p>
            <p className="text-xs text-gray-400 mt-1">To map this product to services, edit the service in Service Management.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Scissors className="h-5 w-5 text-blue-600 mr-2" />
        Service-Product Mapping
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        This product is used in the following services:
      </p>
      <div className="space-y-4">
        {services.map(service => {
          const mapping = service.productMappings.find(m => m.productId === productId);
          if (!mapping) return null;
          
          return (
            <div key={service.id} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
              <h4 className="font-semibold text-gray-900 text-base mb-2">
                {service.name || 'Unknown Service'}
              </h4>
              <div className="space-y-1 text-sm text-gray-700">
                <div>
                  <span className="font-medium">Quantity:</span>
                  <span className="ml-2">
                    {mapping.quantity || 0} {mapping.unit || 'ml'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Percentage:</span>
                  <span className="ml-2">
                    {mapping.percentage || 0}%
                  </span>
                </div>
                <div>
                  <span className="font-medium">Category:</span>
                  <span className="ml-2">
                    {service.category || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 mt-4">
        Note: Products used in services are automatically deducted from salon-use batches when services are performed.
      </p>
    </div>
  );
};

export default MasterProducts;
