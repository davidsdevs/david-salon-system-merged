/**
 * Branch Products Page
 * For Branch Managers to view products available at their branch
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Package, Filter, Eye, Image as ImageIcon, Plus, Trash2, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Printer, Download, FileText, Palette, Sparkles, Grid3x3, Columns, Rows, Minus, Save, Edit2, Upload, Eye as EyeIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { collection, getDocs, doc, updateDoc, arrayUnion, arrayRemove, getDoc, query, limit, startAfter, orderBy, getCountFromServer } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { logActivity } from '../../services/activityService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove } from '@dnd-kit/sortable';
import { getCatalogConfig, saveCatalogConfig } from '../../services/catalogService';
import { getBranchById } from '../../services/branchService';
import { uploadToCloudinary } from '../../services/imageService';

// Debounce hook for search performance
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const SortableBrandSection = ({ brandId, children, className = '', style = {} }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: brandId });
  const sortableStyle = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      className={className}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
};

const SortableProductItem = ({ itemId, children, className = '' }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: itemId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={className}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
};

const BranchProducts = () => {
  const { currentUser, userBranch, userData } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [filterMode, setFilterMode] = useState('all'); // 'all' or 'added'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productToRemove, setProductToRemove] = useState(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [productToAdd, setProductToAdd] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSaveCatalogModal, setShowSaveCatalogModal] = useState(false);
  
  // Pagination states
  const [itemsPerPage] = useState(50); // Items per page
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Product Catalog states
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [branch, setBranch] = useState(null);
  const printRef = useRef();
  const mockupPrintRef = useRef();
  const [catalogStyle, setCatalogStyle] = useState({
    theme: 'elegant', // 'elegant', 'modern', 'classic'
    showDescriptions: true,
    showPrice: true,
    fontSize: 'medium', // 'small', 'medium', 'large'
    gridColumns: 2, // Number of columns in grid layout
    gridRows: null // Auto-calculated based on brands
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [showMockup, setShowMockup] = useState(false);
  const [catalogData, setCatalogData] = useState(null); // Stores ordered brands and products with icons
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [gridLayout, setGridLayout] = useState(null); // Stores grid positions: { brandId: { row, col } }
  const [showAdvancedLayout, setShowAdvancedLayout] = useState(false); // Collapsible section for advanced layout controls
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (userBranch) {
      fetchProducts();
      // Fetch branch info for catalog
      if (!branch) {
        getBranchById(userBranch).then(setBranch).catch(err => console.error('Error fetching branch:', err));
      }
    }
  }, [userBranch]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, categoryFilter, filterMode, brandFilter, statusFilter, priceRange.min, priceRange.max]);


  const fetchProducts = async (loadMore = false) => {
    try {
      if (!loadMore) {
        setLoading(true);
        setProducts([]);
        setLastVisible(null);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      if (!userBranch) {
        toast.error('Branch ID not found');
        return;
      }

      const productsRef = collection(db, 'products');
      
      // Get total count (for display purposes)
      if (!loadMore) {
        try {
          const countQuery = query(productsRef);
          const countSnapshot = await getCountFromServer(countQuery);
          setTotalItems(countSnapshot.data().count);
        } catch (countErr) {
          console.error('Error getting count:', countErr);
        }
      }

      // Build query with pagination
      let q = query(productsRef, orderBy('name', 'asc'), limit(itemsPerPage));
      
      if (loadMore && lastVisible) {
        q = query(productsRef, orderBy('name', 'asc'), startAfter(lastVisible), limit(itemsPerPage));
      }

      const productsSnapshot = await getDocs(q);

      const allProductsList = [];
      productsSnapshot.forEach((doc) => {
        const productData = doc.data();
        
        // Check if product is added to this branch
        const isAddedToBranch = productData.branches && 
          Array.isArray(productData.branches) &&
          productData.branches.includes(userBranch);

        // Create product object, ensuring explicit fields take precedence over spread
        const product = {
          ...productData, // Spread first to get all fields
          id: doc.id, // Override with document ID
          name: productData.name,
          category: productData.category,
          brand: productData.brand,
          unitCost: productData.unitCost || 0,
          otcPrice: productData.otcPrice || 0,
          salonUsePrice: productData.salonUsePrice || 0,
          commissionPercentage: productData.commissionPercentage || 0,
          imageUrl: productData.imageUrl,
          description: productData.description,
          sku: productData.sku,
          upc: productData.upc,
          supplier: productData.supplier,
          status: productData.status,
          shelfLife: productData.shelfLife,
          variants: productData.variants,
          addedDate: productData.addedDate,
          isAddedToBranch: isAddedToBranch
        };
        
        allProductsList.push(product);
      });

      if (loadMore) {
        // Deduplicate when loading more products
        const existingIds = new Set(products.map(p => p.id));
        const newProducts = allProductsList.filter(p => !existingIds.has(p.id));
        setProducts(prev => [...prev, ...newProducts]);
      } else {
        // Deduplicate products by ID on initial load
        const uniqueProductsMap = new Map();
        allProductsList.forEach((product) => {
          if (product.id && !uniqueProductsMap.has(product.id)) {
            uniqueProductsMap.set(product.id, product);
          }
        });
        setProducts(Array.from(uniqueProductsMap.values()));
      }

      // Update pagination state
      const lastDoc = productsSnapshot.docs[productsSnapshot.docs.length - 1];
      setLastVisible(lastDoc);
      setHasMore(productsSnapshot.docs.length === itemsPerPage);

      // Log activity (non-blocking, only on initial load)
      if (!loadMore) {
        logActivity({
          action: 'branch_products_viewed',
          performedBy: currentUser?.uid || userData?.uid,
          branchId: userBranch,
          details: {
            productCount: allProductsList.length
          }
        }).catch(err => console.error('Error logging activity:', err));
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      if (!loadMore) {
        toast.error('Failed to load products');
      } else {
        toast.error('Failed to load more products');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreProducts = useCallback(() => {
    if (!hasMore || loadingMore) return;
    fetchProducts(true);
  }, [hasMore, loadingMore, lastVisible, userBranch, itemsPerPage]);

  const handlePriceRangeInput = (field, value) => {
    setPriceRange(prev => ({
      ...prev,
      [field]: value === '' ? '' : value
    }));
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setBrandFilter('all');
    setStatusFilter('all');
    setPriceRange({ min: '', max: '' });
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const handlePageSizeChange = (value) => {
    setPageSize(value);
    setCurrentPage(1);
  };

  const renderProductCard = (product) => (
    <div className="flex items-start gap-3">
      {product.catalogIcon && (
        <img 
          src={product.catalogIcon} 
          alt={product.name}
          className="w-16 h-16 object-cover rounded"
        />
      )}
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900">{product.name}</h4>
        {catalogStyle.showDescriptions && product.description && (
          <p className="text-sm text-gray-600 mt-1">{product.description}</p>
        )}
        {catalogStyle.showPrice && (
          <p className="text-lg font-bold text-[#160B53] mt-2">
            ₱{product.otcPrice?.toLocaleString() || product.salonUsePrice?.toLocaleString() || product.unitCost?.toLocaleString() || 'N/A'}
          </p>
        )}
      </div>
    </div>
  );

  const renderProductList = (brand) => {
    const items = brand.products || [];
    if (items.length === 0) {
      return <p className="text-sm text-gray-500">No products assigned under this brand.</p>;
    }

    if (isEditMode) {
      return (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => handleProductDragEnd(brand.id, event)}
        >
          <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {items.map((product) => (
                <SortableProductItem key={product.id} itemId={product.id}>
                  {renderProductCard(product)}
                </SortableProductItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      );
    }

    return (
      <div className="space-y-4">
        {items.map(product => (
          <div key={product.id}>
            {renderProductCard(product)}
          </div>
        ))}
      </div>
    );
  };

  const renderBrandSection = (brand, options = {}) => {
    const { style = {}, className = 'mb-8' } = options;
    const brandBody = (
      <div className="h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">{brand.name}</h3>
          {isEditMode && (
            <span className="text-xs text-gray-500">Drag to reorder</span>
          )}
        </div>
        {renderProductList(brand)}
      </div>
    );

    if (isEditMode) {
      return (
        <SortableBrandSection key={brand.id} brandId={brand.id} style={style} className={className}>
          {brandBody}
        </SortableBrandSection>
      );
    }

    return (
      <div key={brand.id} style={style} className={className}>
        {brandBody}
      </div>
    );
  };

  const renderBrandGrid = () => {
    if (useGridLayout) {
      return (
        <div
          className="grid gap-6"
          style={{ 
            gridTemplateColumns: `repeat(${catalogStyle.gridColumns || 2}, 1fr)`,
            gridAutoRows: 'min-content'
          }}
        >
          {catalogData.map((brand) => {
            const pos = gridLayout?.[brand.id] || { row: 0, col: 0 };
            return renderBrandSection(brand, {
              style: {
                gridRow: pos.row + 1,
                gridColumn: pos.col + 1
              },
              className: 'mb-8'
            });
          })}
        </div>
      );
    }

    return (
      <div className="space-y-10">
        {catalogData.map((brand) => renderBrandSection(brand))}
      </div>
    );
  };

  // Memoized filtering for big data performance
  const applyFilters = useMemo(() => {
    let filtered = [...products];

    // Filter mode: 'all' or 'added'
    if (filterMode === 'added') {
      filtered = filtered.filter(product => product.isAddedToBranch === true);
    }

    // Search filter (using debounced term)
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(searchLower) ||
        product.brand?.toLowerCase().includes(searchLower) ||
        product.category?.toLowerCase().includes(searchLower) ||
        product.sku?.toLowerCase().includes(searchLower) ||
        product.upc?.toLowerCase().includes(searchLower)
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(product => product.category === categoryFilter);
    }

    // Brand filter
    if (brandFilter !== 'all') {
      filtered = filtered.filter(product => product.brand === brandFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(product => (product.status || 'Unknown') === statusFilter);
    }

    // Price range filter (using OTC price fallback)
    if (priceRange.min !== '' || priceRange.max !== '') {
      const min = priceRange.min === '' ? null : parseFloat(priceRange.min);
      const max = priceRange.max === '' ? null : parseFloat(priceRange.max);
      filtered = filtered.filter(product => {
        const price = Number(product.otcPrice ?? product.salonUsePrice ?? product.unitCost ?? 0);
        if (min !== null && price < min) return false;
        if (max !== null && price > max) return false;
        return true;
      });
    }

    // Deduplicate by product ID to prevent duplicate rows
    const uniqueProductsMap = new Map();
    filtered.forEach((product) => {
      if (product.id && !uniqueProductsMap.has(product.id)) {
        uniqueProductsMap.set(product.id, product);
      }
    });

    return Array.from(uniqueProductsMap.values());
  }, [products, debouncedSearchTerm, categoryFilter, filterMode, brandFilter, statusFilter, priceRange.min, priceRange.max]);

  const totalPages = Math.max(1, Math.ceil(applyFilters.length / pageSize) || 1);

  // Ensure current page is within bounds when data changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return applyFilters.slice(startIndex, endIndex);
  }, [applyFilters, currentPage, pageSize]);

  // Auto-load more Firestore documents if pagination needs them
  useEffect(() => {
    const requiredItems = currentPage * pageSize;
    if (products.length < requiredItems && hasMore && !loadingMore) {
      loadMoreProducts();
    }
  }, [currentPage, pageSize, products.length, hasMore, loadingMore, loadMoreProducts]);

  const handleAddProduct = (product) => {
    setProductToAdd(product);
    setShowAddModal(true);
  };

  const confirmAddProduct = async () => {
    if (!productToAdd || !userBranch || !currentUser) {
      return;
    }

    try {
      setSaving(true);
      const productRef = doc(db, 'products', productToAdd.id);
      
      // Get current product data
      const productDoc = await getDoc(productRef);
      if (!productDoc.exists()) {
        throw new Error('Product not found');
      }

      const currentData = productDoc.data();
      const branches = currentData.branches || [];

      // Add branchId to branches array if not already present
      if (!branches.includes(userBranch)) {
        await updateDoc(productRef, {
          branches: arrayUnion(userBranch),
          updatedAt: new Date().toISOString()
        });

        // Log activity
        logActivity({
          action: 'branch_product_added',
          performedBy: currentUser.uid || userData?.uid,
          branchId: userBranch,
          details: {
            productId: productToAdd.id,
            productName: productToAdd.name
          }
        }).catch(err => console.error('Error logging activity:', err));

        toast.success(`${productToAdd.name} added to your branch!`);
        // Update local state instead of refetching all
        setProducts(prev => prev.map(p => 
          p.id === productToAdd.id ? { ...p, isAddedToBranch: true } : p
        ));
      } else {
        toast.info('Product is already added to your branch');
      }
      
      setShowAddModal(false);
      setProductToAdd(null);
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Failed to add product to branch');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveProduct = (product) => {
    setProductToRemove(product);
    setShowRemoveModal(true);
  };

  const confirmRemoveProduct = async () => {
    if (!productToRemove || !userBranch || !currentUser) {
      return;
    }

    try {
      setSaving(true);
      const productRef = doc(db, 'products', productToRemove.id);
      
      // Get current product data
      const productDoc = await getDoc(productRef);
      if (!productDoc.exists()) {
        throw new Error('Product not found');
      }

      // Remove branchId from branches array
      await updateDoc(productRef, {
        branches: arrayRemove(userBranch),
        updatedAt: new Date().toISOString()
      });

      // Log activity
      logActivity({
        action: 'branch_product_removed',
        performedBy: currentUser.uid || userData?.uid,
        branchId: userBranch,
        details: {
          productId: productToRemove.id,
          productName: productToRemove.name
        }
      }).catch(err => console.error('Error logging activity:', err));

      toast.success(`${productToRemove.name} removed from your branch!`);
      // Update local state instead of refetching all
      setProducts(prev => prev.map(p => 
        p.id === productToRemove.id ? { ...p, isAddedToBranch: false } : p
      ));
      setShowRemoveModal(false);
      setProductToRemove(null);
    } catch (error) {
      console.error('Error removing product:', error);
      toast.error('Failed to remove product from branch');
    } finally {
      setSaving(false);
    }
  };

  const categories = useMemo(() => ['all', ...new Set(products.map(p => p.category).filter(Boolean))], [products]);
  const brands = useMemo(() => ['all', ...new Set(products.map(p => p.brand).filter(Boolean))], [products]);
  const statusOptions = useMemo(() => ['all', ...new Set(products.map(p => p.status || 'Unknown').filter(Boolean))], [products]);
  const pageSizeOptions = [10, 25, 50, 100];
  const useGridLayout = Boolean(gridLayout && (catalogStyle.gridColumns || 2) > 1);
  const brandSortingStrategy = useGridLayout ? rectSortingStrategy : verticalListSortingStrategy;

  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    setShowDetailsModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return 'N/A';
    }
  };

  // Get products added to branch
  const getBranchProducts = useMemo(() => {
    return products.filter(p => p.isAddedToBranch === true);
  }, [products]);

  // Product Catalog functions
  const dedupeCatalogData = (savedConfig) => {
    if (!savedConfig || !Array.isArray(savedConfig.catalogData)) {
      return null;
    }

    const iconMap = {};
    const brandOrder = [];
    const productOrderMap = {};

    savedConfig.catalogData.forEach((brand) => {
      if (!brand) return;
      brandOrder.push(brand.name);
      productOrderMap[brand.name] = brand.products?.map(p => p.id) || [];
      brand.products?.forEach((product) => {
        if (product?.id) {
          iconMap[product.id] = product.catalogIcon || product.imageUrl || null;
        }
      });
    });

    const brandProductMap = {};
    getBranchProducts.forEach((product) => {
      const brandName = product.brand || 'Other Brands';
      if (!brandProductMap[brandName]) {
        brandProductMap[brandName] = new Map();
      }
      if (!brandProductMap[brandName].has(product.id)) {
        brandProductMap[brandName].set(product.id, {
          ...product,
          catalogIcon: iconMap[product.id] ?? product.catalogIcon ?? product.imageUrl ?? null
        });
      }
    });

    const existingBrandIds = {};
    savedConfig.catalogData.forEach((brand) => {
      if (brand?.id) {
        existingBrandIds[brand.name] = brand.id;
      }
    });

    const orderedBrandNames = [...brandOrder];
    Object.keys(brandProductMap).forEach((brandName) => {
      if (!orderedBrandNames.includes(brandName)) {
        orderedBrandNames.push(brandName);
      }
    });

    const sanitizedCatalog = orderedBrandNames
      .map((brandName) => {
        const productMap = brandProductMap[brandName];
        if (!productMap || productMap.size === 0) return null;

        const products = Array.from(productMap.values());
        const savedOrder = productOrderMap[brandName] || [];
        products.sort((a, b) => {
          const indexA = savedOrder.indexOf(a.id);
          const indexB = savedOrder.indexOf(b.id);
          if (indexA === -1 && indexB === -1) {
            return a.name.localeCompare(b.name);
          }
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });

        return {
          id: existingBrandIds[brandName] || `brand-${brandName}`,
          name: brandName,
          products
        };
      })
      .filter(Boolean);

    const columns = savedConfig.style?.gridColumns ?? catalogStyle.gridColumns ?? 2;
    const layout = {};
    sanitizedCatalog.forEach((brand, index) => {
      const savedLayout = savedConfig.gridLayout?.[brand.id];
      layout[brand.id] = savedLayout ?? {
        row: Math.floor(index / columns),
        col: index % columns
      };
    });

    return {
      catalogData: sanitizedCatalog,
      gridLayout: layout,
      style: {
        ...catalogStyle,
        ...savedConfig.style,
        gridColumns: savedConfig.style?.gridColumns ?? catalogStyle.gridColumns ?? 2
      }
    };
  };

  const handleOpenCatalog = async () => {
    setShowCatalogModal(true);
    // Load saved catalog configuration
    if (userBranch && getBranchProducts.length > 0) {
      try {
        const savedConfig = await getCatalogConfig(`product-${userBranch}`);
        if (savedConfig && savedConfig.catalogData && savedConfig.catalogData.length > 0) {
          const sanitized = dedupeCatalogData(savedConfig);
          if (sanitized) {
            setCatalogData(sanitized.catalogData);
            setGridLayout(sanitized.gridLayout);
            setCatalogStyle(sanitized.style);
          } else {
            initializeCatalogData();
          }
        } else {
          initializeCatalogData();
        }
      } catch (error) {
        console.error('Error loading catalog config:', error);
        initializeCatalogData();
      }
    } else if (getBranchProducts.length > 0) {
      initializeCatalogData();
    }
  };

  const initializeCatalogData = () => {
    // Deduplicate products by ID first to prevent duplicates
    const uniqueProductsMap = new Map();
    getBranchProducts.forEach((product) => {
      if (product.id && !uniqueProductsMap.has(product.id)) {
        uniqueProductsMap.set(product.id, {
          ...product,
          catalogIcon: product.imageUrl || null
        });
      }
    });
    const uniqueProducts = Array.from(uniqueProductsMap.values());
    
    const grouped = uniqueProducts.reduce((acc, product) => {
      const brand = product.brand || 'Other Brands';
      if (!acc[brand]) {
        acc[brand] = [];
      }
      acc[brand].push(product);
      return acc;
    }, {});
    
    const columns = catalogStyle.gridColumns || 2;
    
    // Convert to array format for drag and drop
    const brandsArray = Object.keys(grouped).map((brand, index) => ({
      id: `brand-${brand}`,
      name: brand,
      products: grouped[brand],
      gridRow: Math.floor(index / columns),
      gridCol: index % columns
    }));
    
    setCatalogData(brandsArray);
    
    // Initialize grid layout
    const layout = {};
    brandsArray.forEach((brand, index) => {
      layout[brand.id] = {
        row: Math.floor(index / columns),
        col: index % columns
      };
    });
    setGridLayout(layout);
    
    if (!catalogStyle.gridColumns) {
      setCatalogStyle(prev => ({
        ...prev,
        gridColumns: 2
      }));
    }
  };

  const handleSaveCatalog = () => {
    setShowSaveCatalogModal(true);
  };

  const confirmSaveCatalog = async () => {
    if (!userBranch || !catalogData) return;
    
    try {
      setSavingCatalog(true);
      const catalogDataWithGrid = catalogData.map(brand => ({
        ...brand,
        gridRow: gridLayout?.[brand.id]?.row ?? brand.gridRow ?? 0,
        gridCol: gridLayout?.[brand.id]?.col ?? brand.gridCol ?? 0
      }));
      
      await saveCatalogConfig(`product-${userBranch}`, {
        catalogData: catalogDataWithGrid,
        style: catalogStyle,
        gridLayout,
        type: 'product' // Distinguish from service catalog
      }, currentUser);
      toast.success('Product catalog configuration saved!');
      setShowSaveCatalogModal(false);
    } catch (error) {
      console.error('Error saving catalog:', error);
      toast.error('Failed to save catalog configuration');
    } finally {
      setSavingCatalog(false);
    }
  };

  const handleBrandDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !catalogData) return;

    if (isEditMode && gridLayout) {
      const draggedBrand = catalogData.find(b => b.id === active.id);
      const targetBrand = catalogData.find(b => b.id === over.id);
      
      if (draggedBrand && targetBrand) {
        const updatedLayout = { ...gridLayout };
        const draggedPos = updatedLayout[draggedBrand.id];
        const targetPos = updatedLayout[targetBrand.id];
        
        updatedLayout[draggedBrand.id] = targetPos;
        updatedLayout[targetBrand.id] = draggedPos;
        
        setGridLayout(updatedLayout);
      }
    } else {
      const oldIndex = catalogData.findIndex(b => b.id === active.id);
      const newIndex = catalogData.findIndex(b => b.id === over.id);
      setCatalogData(arrayMove(catalogData, oldIndex, newIndex));
    }
  };

  const handleProductDragEnd = (brandId, event) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !catalogData) return;

    const brandIndex = catalogData.findIndex(b => b.id === brandId);
    if (brandIndex === -1) return;

    const productIndex = catalogData[brandIndex].products.findIndex(p => p.id === active.id);
    if (productIndex === -1) return;

    const updatedCatalogData = [...catalogData];
    const oldIndex = productIndex;
    const newIndex = catalogData[brandIndex].products.findIndex(p => p.id === over.id);

    updatedCatalogData[brandIndex].products = arrayMove(
      updatedCatalogData[brandIndex].products,
      oldIndex,
      newIndex
    );
    setCatalogData(updatedCatalogData);
  };

  const handleIconUpload = async (productId, file) => {
    try {
      const iconUrl = await uploadToCloudinary(file, 'product-icons');
      
      const brandIndex = catalogData.findIndex(b => 
        b.products.some(p => p.id === productId)
      );
      if (brandIndex === -1) return;

      const productIndex = catalogData[brandIndex].products.findIndex(p => p.id === productId);
      if (productIndex === -1) return;

      const updatedCatalogData = [...catalogData];
      updatedCatalogData[brandIndex].products[productIndex].catalogIcon = iconUrl;
      
      setCatalogData(updatedCatalogData);
      toast.success('Icon uploaded successfully!');
    } catch (error) {
      console.error('Error uploading icon:', error);
      toast.error('Failed to upload icon');
    }
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `${branch?.name || branch?.branchName || 'David Salon'} - Product Catalog`,
    pageStyle: `
      @page {
        size: A4;
        margin: 1cm;
      }
      @media print {
        body * {
          visibility: hidden;
        }
        .print-content, .print-content * {
          visibility: visible;
        }
        .print-content {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          background: white !important;
        }
        .print-content * {
          background: white !important;
        }
      }
    `,
    onBeforeGetContent: () => {
      return Promise.resolve();
    }
  });

  const handlePrintPreview = () => {
    if (!printRef.current) {
      toast.error('No catalog content to preview');
      return;
    }

    // Create a new window for print preview
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      toast.error('Please allow pop-ups to view print preview');
      return;
    }

    const printContent = printRef.current.cloneNode(true);
    
    // Get all style sheets from the main document
    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules || [])
            .map((rule) => rule.cssText)
            .join('\n');
        } catch (e) {
          return '';
        }
      })
      .join('\n');
    
    // Add print styles to the preview window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Preview - ${branch?.name || branch?.branchName || 'David Salon'} - Product Catalog</title>
          <style>
            ${styles}
            * {
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              background: #f5f5f5;
              padding: 20px;
              margin: 0;
            }
            .preview-container {
              background: white;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            @media print {
              body {
                background: white;
                padding: 0;
              }
              .preview-container {
                box-shadow: none;
                padding: 0;
                max-width: 100%;
              }
              .print-preview-actions {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-preview-actions" style="position: fixed; top: 10px; right: 10px; z-index: 9999; display: flex; gap: 10px;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #160B53; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
              Print
            </button>
            <button onclick="window.close()" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
              Close
            </button>
          </div>
          <div class="preview-container">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    toast.success('Print preview opened in new window');
  };

  const handleDownloadPDF = () => {
    handlePrint();
  };

  const handleAddColumn = () => {
    setCatalogStyle(prev => ({
      ...prev,
      gridColumns: (prev.gridColumns || 2) + 1
    }));
  };

  const handleRemoveColumn = () => {
    const currentColumns = catalogStyle.gridColumns || 2;
    if (currentColumns <= 1) return;
    
    setCatalogStyle(prev => ({
      ...prev,
      gridColumns: (prev.gridColumns || 2) - 1
    }));
    
    if (catalogData && gridLayout) {
      const updatedLayout = { ...gridLayout };
      const maxCol = currentColumns - 1;
      
      catalogData.forEach(brand => {
        const pos = updatedLayout[brand.id];
        if (pos && pos.col >= maxCol) {
          updatedLayout[brand.id] = {
            row: pos.row + 1,
            col: 0
          };
        }
      });
      
      setGridLayout(updatedLayout);
    }
  };

  const handleAddRow = () => {
    // Rows are auto-calculated, but we can add empty space if needed
    if (gridLayout && catalogData) {
      const updatedLayout = { ...gridLayout };
      setGridLayout(updatedLayout);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/manager/settings')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Branch Products</h1>
            <p className="text-gray-600 mt-1">View products available at your branch</p>
          </div>
        </div>
        {getBranchProducts.length > 0 && (
          <Button
            onClick={handleOpenCatalog}
            className="flex items-center gap-2 bg-[#160B53] hover:bg-[#1a0f6b]"
          >
            <FileText className="h-4 w-4" />
            Generate Product Catalog
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="space-y-4">
          {/* Filter Mode Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterMode === 'all'
                  ? 'bg-[#160B53] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Products
            </button>
            <button
              onClick={() => setFilterMode('added')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterMode === 'added'
                  ? 'bg-[#160B53] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Added to Branch
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-500" />
                Search
              </label>
              <Input
                type="text"
                placeholder="Search products by name, brand, category, or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
              >
                {brands.map(brand => (
                  <option key={brand} value={brand}>
                    {brand === 'all' ? 'All Brands' : brand}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
              >
                {statusOptions.map(status => (
                  <option key={status} value={status}>
                    {status === 'all' ? 'All Statuses' : status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Price (₱)</label>
              <Input
                type="number"
                min="0"
                placeholder="e.g. 500"
                value={priceRange.min}
                onChange={(e) => handlePriceRangeInput('min', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Price (₱)</label>
              <Input
                type="number"
                min="0"
                placeholder="e.g. 2000"
                value={priceRange.max}
                onChange={(e) => handlePriceRangeInput('max', e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleResetFilters}
                variant="outline"
                className="w-full"
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Brand
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  OTC Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Branch Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {applyFilters.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    {products.length === 0 
                      ? 'No products found. Loading products...'
                      : 'No products match your search criteria.'}
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {product.imageUrl ? (
                          <div className="flex-shrink-0">
                            <img 
                              src={product.imageUrl} 
                              alt={product.name}
                              className="w-20 h-20 rounded-lg object-cover border border-gray-200"
                            />
                          </div>
                        ) : (
                          <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200 flex-shrink-0">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            {product.name}
                          </div>
                          {product.sku && (
                            <div className="text-xs text-gray-500 mt-1">
                              SKU: {product.sku}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {product.category ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {product.category}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {product.brand || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      ₱{product.unitCost?.toLocaleString() || '0'}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      ₱{product.otcPrice?.toLocaleString() || '0'}
                    </td>
                    <td className="px-6 py-4">
                      {product.status ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          product.status === 'Active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {product.status}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {product.isAddedToBranch ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Added
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Not Added
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewDetails(product)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View Details"
                          disabled={saving}
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        {product.isAddedToBranch ? (
                          <button
                            onClick={() => handleRemoveProduct(product)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            title="Remove from Branch"
                            disabled={saving}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAddProduct(product)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                            title="Add to Branch"
                            disabled={saving}
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary and Pagination */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-gray-600">
            Showing{' '}
            <span className="font-semibold">
              {applyFilters.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-semibold">
              {applyFilters.length === 0 ? 0 : Math.min(currentPage * pageSize, applyFilters.length)}
            </span>{' '}
            of <span className="font-semibold">{applyFilters.length}</span> filtered products
            {totalItems > products.length && (
              <span className="ml-2 text-blue-600 text-xs sm:text-sm">
                ({products.length} loaded, {totalItems} total in database)
              </span>
            )}
          </div>
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
              >
                {pageSizeOptions.map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <span className="text-sm text-gray-700">
                Page <span className="font-semibold">{currentPage}</span> of{' '}
                <span className="font-semibold">{totalPages}</span>
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Product Details Modal */}
      {showDetailsModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Product Details</h2>
                    <p className="text-white/80 text-sm mt-1">{selectedProduct.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedProduct(null);
                  }}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column - Image */}
                <div>
                  {selectedProduct.imageUrl ? (
                    <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        className="w-full h-auto object-contain max-h-[500px] mx-auto"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                      <ImageIcon className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Right Column - Details */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedProduct.name}</h3>
                    <p className="text-sm text-gray-500">{selectedProduct.brand}</p>
                  </div>

                  {selectedProduct.description && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
                      <p className="text-sm text-gray-600">{selectedProduct.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Category</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProduct.category || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Status</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        selectedProduct.status === 'Active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedProduct.status || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Unit Cost</p>
                      <p className="text-sm font-semibold text-gray-900">₱{selectedProduct.unitCost?.toLocaleString() || '0'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">OTC Price</p>
                      <p className="text-sm font-semibold text-gray-900">₱{selectedProduct.otcPrice?.toLocaleString() || '0'}</p>
                    </div>
                    {selectedProduct.salonUsePrice && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Salon Use Price</p>
                        <p className="text-sm font-semibold text-gray-900">₱{selectedProduct.salonUsePrice.toLocaleString()}</p>
                      </div>
                    )}
                    {selectedProduct.commissionPercentage && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Commission</p>
                        <p className="text-sm font-semibold text-gray-900">{selectedProduct.commissionPercentage}%</p>
                      </div>
                    )}
                    {selectedProduct.sku && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">SKU</p>
                        <p className="text-sm font-medium text-gray-900">{selectedProduct.sku}</p>
                      </div>
                    )}
                    {selectedProduct.upc && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">UPC</p>
                        <p className="text-sm font-medium text-gray-900">{selectedProduct.upc}</p>
                      </div>
                    )}
                    {selectedProduct.supplier && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Supplier</p>
                        <p className="text-sm font-medium text-gray-900">{selectedProduct.supplier}</p>
                      </div>
                    )}
                    {selectedProduct.shelfLife && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Shelf Life</p>
                        <p className="text-sm font-medium text-gray-900">{selectedProduct.shelfLife}</p>
                      </div>
                    )}
                    {selectedProduct.variants && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Variants</p>
                        <p className="text-sm font-medium text-gray-900">{selectedProduct.variants}</p>
                      </div>
                    )}
                    {selectedProduct.addedDate && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Added Date</p>
                        <p className="text-sm font-medium text-gray-900">{formatDate(selectedProduct.addedDate)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedProduct(null);
                  }}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Product Confirmation Modal */}
      <ConfirmModal
        isOpen={showRemoveModal}
        onClose={() => {
          setShowRemoveModal(false);
          setProductToRemove(null);
        }}
        onConfirm={confirmRemoveProduct}
        title="Remove Product from Branch"
        message={`Are you sure you want to remove "${productToRemove?.name}" from your branch? This product will no longer be available at your branch.`}
        confirmText="Remove Product"
        confirmVariant="danger"
        isLoading={saving}
      />

      {/* Add Product Confirmation Modal */}
      <ConfirmModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setProductToAdd(null);
        }}
        onConfirm={confirmAddProduct}
        title="Add Product to Branch"
        message={`Are you sure you want to add "${productToAdd?.name}" to your branch? This product will become available for use at your branch.`}
        confirmText="Add Product"
        confirmVariant="primary"
        isLoading={saving}
      />

      {/* Save Catalog Confirmation Modal */}
      <ConfirmModal
        isOpen={showSaveCatalogModal}
        onClose={() => {
          setShowSaveCatalogModal(false);
        }}
        onConfirm={confirmSaveCatalog}
        title="Save Catalog Configuration"
        message="Are you sure you want to save this catalog configuration? This will overwrite any existing catalog settings for your branch."
        confirmText="Save Configuration"
        confirmVariant="primary"
        isLoading={savingCatalog}
      />

      {/* Product Catalog Modal */}
      {showCatalogModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCatalogModal(false);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#160B53] to-[#1a0f6b] text-white p-6 rounded-t-xl flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Product Catalog Generator</h2>
                <p className="text-white/80 text-sm mt-1">Create a printable product catalog/poster for your branch</p>
              </div>
              <button
                onClick={() => setShowCatalogModal(false)}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Catalog Controls */}
            <div className="p-6 border-b border-gray-200 space-y-6">
              {/* Main Quick Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Palette className="inline h-4 w-4 mr-1.5 text-gray-500" />
                    Color Theme
                  </label>
                  <select
                    value={catalogStyle.theme}
                    onChange={(e) => setCatalogStyle({ ...catalogStyle, theme: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] text-sm"
                  >
                    <option value="elegant">Elegant (Purple)</option>
                    <option value="modern">Modern (Blue)</option>
                    <option value="classic">Classic (Amber)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FileText className="inline h-4 w-4 mr-1.5 text-gray-500" />
                    Font Size
                  </label>
                  <select
                    value={catalogStyle.fontSize}
                    onChange={(e) => setCatalogStyle({ ...catalogStyle, fontSize: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] text-sm"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Sparkles className="inline h-4 w-4 mr-1.5 text-gray-500" />
                    Display Options
                  </label>
                  <div className="space-y-2 pt-1">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={catalogStyle.showDescriptions}
                        onChange={(e) => setCatalogStyle({ ...catalogStyle, showDescriptions: e.target.checked })}
                        className="rounded border-gray-300 text-[#160B53] focus:ring-[#160B53]"
                      />
                      <span>Show Descriptions</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={catalogStyle.showPrice}
                        onChange={(e) => setCatalogStyle({ ...catalogStyle, showPrice: e.target.checked })}
                        className="rounded border-gray-300 text-[#160B53] focus:ring-[#160B53]"
                      />
                      <span>Show Price</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Advanced Layout Controls - Collapsible */}
              {isEditMode && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowAdvancedLayout(!showAdvancedLayout)}
                    className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Grid3x3 className="w-4 h-4 text-gray-600" />
                      <span className="font-medium text-gray-900">Advanced Layout Options</span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({catalogStyle.gridColumns || 2} columns
                        {gridLayout && catalogData && `, ${Math.max(...Object.values(gridLayout).map(pos => pos.row), -1) + 1 || 1} rows`})
                      </span>
                    </div>
                    {showAdvancedLayout ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                  {showAdvancedLayout && (
                    <div className="p-4 bg-white border-t border-gray-200">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 font-medium">Grid Columns:</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleRemoveColumn}
                            disabled={(catalogStyle.gridColumns || 2) <= 1}
                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Remove Column"
                          >
                            <Minus className="w-4 h-4 text-gray-700" />
                          </button>
                          <span className="text-sm font-semibold text-gray-900 w-8 text-center">
                            {catalogStyle.gridColumns || 2}
                          </span>
                          <button
                            onClick={handleAddColumn}
                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Add Column"
                          >
                            <Plus className="w-4 h-4 text-gray-700" />
                          </button>
                        </div>
                        <span className="text-xs text-gray-500 ml-auto">
                          Tip: Drag and drop brands to reorder them
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setIsEditMode(!isEditMode)}
                    className="flex items-center gap-2"
                    variant={isEditMode ? "default" : "outline"}
                  >
                    {isEditMode ? <EyeIcon className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                    {isEditMode ? 'View Mode' : 'Edit Mode'}
                  </Button>
                  {isEditMode && (
                    <Button
                      onClick={handleSaveCatalog}
                      disabled={savingCatalog}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <Save className="h-4 w-4" />
                      {savingCatalog ? 'Saving...' : 'Save'}
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    onClick={handlePrintPreview}
                    variant="outline"
                    className="flex items-center gap-2 text-sm"
                  >
                    <EyeIcon className="h-4 w-4" />
                    Preview
                  </Button>
                  <Button
                    onClick={handleDownloadPDF}
                    variant="outline"
                    className="flex items-center gap-2 text-sm"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                  <Button
                    onClick={handlePrint}
                    className="flex items-center gap-2 bg-[#160B53] hover:bg-[#1a0f6b] text-sm"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                </div>
              </div>
            </div>

            {/* Catalog Preview */}
            <div className="p-6 overflow-y-auto flex-1 min-h-0">
              {!catalogData || catalogData.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">No products available. Please add products to your branch first.</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-lg p-12 print-content" ref={printRef}>
                  <div className="text-center mb-12 border-b-2 border-gray-300 pb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-3">David Salon</h1>
                    <h2 className="text-2xl font-semibold text-[#160B53] mb-4">
                      {branch?.name || branch?.branchName || 'Branch'} - Product Catalog
                    </h2>
                  </div>
                  {isEditMode ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleBrandDragEnd}
                    >
                      <SortableContext
                        items={catalogData.map(brand => brand.id)}
                        strategy={brandSortingStrategy}
                      >
                        {renderBrandGrid()}
                      </SortableContext>
                    </DndContext>
                  ) : (
                    renderBrandGrid()
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchProducts;

