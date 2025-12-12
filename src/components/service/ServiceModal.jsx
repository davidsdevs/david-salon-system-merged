/**
 * Service Modal Component
 * For creating/editing global services (System Admin)
 */

import { useState, useEffect } from 'react';
import { X, Upload, Plus, Trash2, Package, Search } from 'lucide-react';
import { getServiceCategories } from '../../services/serviceManagementService';
import { uploadToCloudinary, validateImageFile } from '../../services/imageService';
import { productService } from '../../services/productService';
import toast from 'react-hot-toast';

const ServiceModal = ({
  isOpen,
  service,
  onClose,
  onSubmit,
  loading = false
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Haircut and Blowdry',
    duration: 30,
    imageURL: '',
    isChemical: false,
    isActive: true
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [productMappings, setProductMappings] = useState([]); // Array of {productId, productName, quantity, unit, percentage}
  const [allProducts, setAllProducts] = useState([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen]);

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || '',
        description: service.description || '',
        category: service.category || 'Haircut and Blowdry',
        duration: service.duration || 30,
        imageURL: service.imageURL || '',
        isChemical: service.isChemical || false,
        isActive: service.isActive !== undefined ? service.isActive : true
      });
      setImagePreview(service.imageURL || null);
      
      // Load existing product mappings if any (from products collection)
      loadExistingMappings(service.id);
    } else {
      setFormData({
        name: '',
        description: '',
        category: 'Haircut and Blowdry',
        duration: 30,
        imageURL: '',
        isChemical: false,
        isActive: true
      });
      setImagePreview(null);
      setProductMappings([]);
    }
    setImageFile(null);
  }, [service, isOpen]);

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const result = await productService.getAllProducts();
      if (result.success) {
        setAllProducts(result.products.filter(p => p.status === 'Active'));
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadExistingMappings = async (serviceId) => {
    try {
      // Load mappings from service document (new structure)
      const { getServiceById } = await import('../../services/serviceManagementService');
      const service = await getServiceById(serviceId);
      
      if (service && service.productMappings && Array.isArray(service.productMappings)) {
        setProductMappings(service.productMappings);
      } else {
        // Fallback: Load from products collection (legacy structure)
        const result = await productService.getAllProducts();
        if (result.success) {
          const mappings = [];
          result.products.forEach(product => {
            if (product.serviceProductMapping && product.serviceProductMapping[serviceId]) {
              mappings.push({
                productId: product.id,
                productName: product.name,
                quantity: 0, // Default values for legacy
                unit: 'ml',
                percentage: 0
              });
            }
          });
          setProductMappings(mappings);
        }
      }
    } catch (error) {
      console.error('Error loading existing mappings:', error);
    }
  };

  const filteredProducts = allProducts.filter(product => {
    const matchesSearch = product.name?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                         product.brand?.toLowerCase().includes(productSearchTerm.toLowerCase());
    const alreadyMapped = productMappings.some(m => m.productId === product.id);
    return matchesSearch && !alreadyMapped;
  });

  const handleAddProduct = (product) => {
    setProductMappings([...productMappings, {
      productId: product.id,
      productName: product.name,
      quantity: 0,
      unit: 'ml', // Default unit
      percentage: 0 // Percentage of service price
    }]);
    setShowProductSelector(false);
    setProductSearchTerm('');
  };

  const handleRemoveProduct = (productId) => {
    setProductMappings(productMappings.filter(m => m.productId !== productId));
  };

  const handleUpdateMapping = (productId, field, value) => {
    setProductMappings(productMappings.map(m => 
      m.productId === productId 
        ? { ...m, [field]: field === 'quantity' || field === 'percentage' ? parseFloat(value) || 0 : value }
        : m
    ));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file && validateImageFile(file)) {
      setImageFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData({ ...formData, imageURL: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      let imageURL = formData.imageURL;
      
      // Upload image if new file selected
      if (imageFile) {
        setUploading(true);
        imageURL = await uploadToCloudinary(imageFile, 'services');
        setUploading(false);
      }
      
      onSubmit({
        ...formData,
        imageURL,
        id: service?.id,
        productMappings // Pass product mappings to parent
      });
    } catch (error) {
      setUploading(false);
      toast.error('Failed to upload image');
    }
  };

  if (!isOpen) return null;

  const categories = getServiceCategories();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {service ? 'Edit Service' : 'Create Service'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Services are global and shared across all branches. Each branch will configure their own pricing.
              </p>
            </div>

            {/* Service Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g., Basic Haircut, Manicure, Facial Treatment"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Describe what this service includes..."
              />
            </div>

            {/* Category and Duration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (minutes) *
                </label>
                <input
                  type="number"
                  required
                  min="5"
                  step="5"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="30"
                />
              </div>
            </div>

            {/* Chemical Service Flag */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isChemical}
                  onChange={(e) => setFormData({ ...formData, isChemical: e.target.checked })}
                  className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Chemical Service</span>
                  <p className="text-xs text-gray-600">Check if this service uses chemicals (e.g., hair color, perm, relaxer)</p>
                </div>
              </label>
            </div>

            {/* Service Image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Service Image
              </label>
              
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Service preview"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="service-image"
                  />
                  <label htmlFor="service-image" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Click to upload service image
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, JPG up to 5MB
                    </p>
                  </label>
                </div>
              )}
            </div>

            {/* Product Mappings */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service-Product Mapping
                  </label>
                  <p className="text-xs text-gray-500">
                    Map products used in this service with quantity and percentage of service price
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProductSelector(!showProductSelector)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              </div>

              {/* Product Selector */}
              {showProductSelector && (
                <div className="mb-4 border border-gray-300 rounded-lg p-3 bg-gray-50">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {loadingProducts ? (
                      <p className="text-sm text-gray-500 text-center py-2">Loading products...</p>
                    ) : filteredProducts.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-2">No products found</p>
                    ) : (
                      filteredProducts.map(product => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleAddProduct(product)}
                          className="w-full text-left px-3 py-2 bg-white border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300 transition-colors flex items-center gap-3"
                        >
                          <Package className="w-4 h-4 text-gray-400" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{product.name}</p>
                            <p className="text-xs text-gray-500">{product.brand} - {product.category}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Mapped Products List */}
              {productMappings.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No products mapped to this service yet
                </p>
              ) : (
                <div className="space-y-2">
                  {productMappings.map((mapping) => (
                    <div key={mapping.productId} className="p-3 bg-white border border-gray-200 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <p className="text-sm font-medium text-gray-900 truncate">{mapping.productName}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(mapping.productId)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">Quantity</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={mapping.quantity || 0}
                            onChange={(e) => handleUpdateMapping(mapping.productId, 'quantity', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">Unit</label>
                          <select
                            value={mapping.unit || 'ml'}
                            onChange={(e) => handleUpdateMapping(mapping.productId, 'unit', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="ml">ml</option>
                            <option value="g">g</option>
                            <option value="pieces">pieces</option>
                            <option value="units">units</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">% of Price</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={mapping.percentage || 0}
                              onChange={(e) => handleUpdateMapping(mapping.productId, 'percentage', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="0"
                            />
                            <span className="text-xs text-gray-500">%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Toggle */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Active Service</span>
                  <p className="text-xs text-gray-500">Inactive services won't be available to branches</p>
                </div>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {(loading || uploading) ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {uploading ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                service ? 'Update Service' : 'Create Service'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServiceModal;

