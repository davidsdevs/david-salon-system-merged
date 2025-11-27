/**
 * Products Page - Client
 * Browse and view available salon products
 */

import { useState, useEffect, useMemo } from 'react';
import { Search, Package, Banknote, Filter, Eye, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getAllBranches } from '../../services/branchService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card } from '../../components/ui/Card';
import { SearchInput } from '../../components/ui/SearchInput';
import { formatCurrency } from '../../utils/helpers';
import toast from 'react-hot-toast';

const ClientProducts = () => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const data = await getAllBranches();
      setBranches(data.filter(b => b.isActive));
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const productsRef = collection(db, 'products');
      
      // Fetch all active products available to clients
      const snapshot = await getDocs(productsRef);
      const productsData = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Filter by status - only show active products
        const isActive = data.status === 'active' || data.status === undefined;
        
        if (isActive) {
          productsData.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      // Sort by name client-side
      productsData.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(product => product.category === categoryFilter);
    }

    // Apply branch filter
    if (branchFilter !== 'all') {
      filtered = filtered.filter(product => {
        // If product has branches array, check if it includes the selected branch
        if (product.branches && Array.isArray(product.branches)) {
          return product.branches.includes(branchFilter);
        }
        // If no branches specified, product is available at all branches
        return true;
      });
    }

    return filtered;
  }, [products, searchTerm, categoryFilter, branchFilter]);

  // Get unique categories from products
  const availableCategories = useMemo(() => {
    const categories = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(categories).sort();
  }, [products]);

  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    setShowDetailsModal(true);
  };

  const getBranchName = (branchId) => {
    if (!branchId) return 'All Branches';
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || branch?.branchName || 'Unknown Branch';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Our Products</h1>
        <p className="text-gray-600">Browse our premium salon products</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <SearchInput
              placeholder="Search products by name, brand, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg transition-colors flex items-center gap-2 ${
              categoryFilter !== 'all' || branchFilter !== 'all'
                ? 'bg-primary-50 border-primary-300 text-primary-700 hover:bg-primary-100'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {(categoryFilter !== 'all' || branchFilter !== 'all') && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-primary-600 text-white">
                Active
              </span>
            )}
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                {availableCategories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Branch
              </label>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Branches</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name || branch.branchName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Products Found</h3>
          <p className="text-gray-600">
            {searchTerm || categoryFilter !== 'all' || branchFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'No products available at the moment'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {/* Product Image */}
              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-16 h-16 text-gray-400" />
                  </div>
                )}
                {product.category && (
                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-1 text-xs font-medium bg-primary-600 text-white rounded">
                      {product.category}
                    </span>
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                  {product.name}
                </h3>
                {product.brand && (
                  <p className="text-sm text-gray-500 mb-2">{product.brand}</p>
                )}
                {product.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {product.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    {product.price ? (
                      <p className="text-lg font-bold text-primary-600">
                        {formatCurrency(product.price)}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">Price on request</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleViewDetails(product)}
                    className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Product Details Modal */}
      {showDetailsModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Product Details</h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedProduct(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="p-6">
              {/* Product Image */}
              <div className="mb-6">
                {selectedProduct.imageUrl ? (
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="w-full h-64 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Package className="w-24 h-24 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {selectedProduct.name}
                  </h3>
                  {selectedProduct.brand && (
                    <p className="text-lg text-gray-600 mb-1">Brand: {selectedProduct.brand}</p>
                  )}
                  {selectedProduct.category && (
                    <span className="inline-block px-3 py-1 text-sm font-medium bg-primary-100 text-primary-700 rounded">
                      {selectedProduct.category}
                    </span>
                  )}
                </div>

                {selectedProduct.description && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                    <p className="text-gray-600">{selectedProduct.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Price</h4>
                    {selectedProduct.price ? (
                      <p className="text-xl font-bold text-primary-600">
                        {formatCurrency(selectedProduct.price)}
                      </p>
                    ) : (
                      <p className="text-gray-600">Price on request</p>
                    )}
                  </div>
                  {selectedProduct.branches && Array.isArray(selectedProduct.branches) && selectedProduct.branches.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Available At</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedProduct.branches.map(branchId => (
                          <span
                            key={branchId}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                          >
                            {getBranchName(branchId)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500 text-center">
                    Visit our salon to purchase this product
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientProducts;

