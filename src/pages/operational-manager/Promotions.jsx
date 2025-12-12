/**
 * Operational Manager System-Wide Promotions Management Page
 * Creates promotions that can be used in ANY branch across the system
 */

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, Tag, Globe, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAllPromotions, createPromotion, updatePromotion, deletePromotion } from '../../services/promotionService';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const OperationalManagerPromotions = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    promotionCode: '',
    discountType: 'percentage',
    discountValue: '',
    targetSegment: 'all',
    applicableTo: 'all',
    specificServices: [],
    specificProducts: [],
    usageType: 'repeating',
    maxUses: '',
    startDate: '',
    endDate: '',
    isActive: true
  });

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      // Get all promotions, but filter for system-wide (branchId === null)
      const allPromos = await getAllPromotions();
      // Filter for system-wide promotions only (branchId is null)
      const systemWidePromos = allPromos.filter(promo => promo.branchId === null || promo.branchId === undefined);
      setPromotions(systemWidePromos);
    } catch (error) {
      console.error('Error fetching promotions:', error);
      toast.error('Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  const generatePromotionCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreate = () => {
    setSelectedPromotion(null);
    const code = generatePromotionCode();
    setFormData({
      name: '',
      description: '',
      promotionCode: code,
      discountType: 'percentage',
      discountValue: '',
      targetSegment: 'all',
      applicableTo: 'all',
      specificServices: [],
      specificProducts: [],
      usageType: 'repeating',
      maxUses: '',
      startDate: '',
      endDate: '',
      isActive: true
    });
    setShowModal(true);
  };

  const handleEdit = (promotion) => {
    setSelectedPromotion(promotion);
    setFormData({
      name: promotion.name || '',
      description: promotion.description || '',
      promotionCode: promotion.promotionCode || generatePromotionCode(),
      discountType: promotion.discountType || 'percentage',
      discountValue: promotion.discountValue || '',
      targetSegment: promotion.targetSegment || 'all',
      applicableTo: promotion.applicableTo || 'all',
      specificServices: promotion.specificServices || [],
      specificProducts: promotion.specificProducts || [],
      usageType: promotion.usageType || 'repeating',
      maxUses: promotion.maxUses || '',
      startDate: promotion.startDate ? new Date(promotion.startDate).toISOString().split('T')[0] : '',
      endDate: promotion.endDate ? new Date(promotion.endDate).toISOString().split('T')[0] : '',
      isActive: promotion.isActive !== false
    });
    setShowModal(true);
  };

  const handleDelete = (promotion) => {
    setSelectedPromotion(promotion);
    setShowDeleteModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.promotionCode || !formData.startDate || !formData.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      toast.error('End date must be after start date');
      return;
    }

    try {
      const promotionData = {
        ...formData,
        branchId: null, // Always null for system-wide promotions
        discountValue: parseFloat(formData.discountValue),
        maxUses: formData.maxUses ? parseInt(formData.maxUses) : null
      };

      if (selectedPromotion) {
        await updatePromotion(selectedPromotion.id, promotionData, currentUser);
      } else {
        await createPromotion(promotionData, currentUser);
      }
      
      setShowModal(false);
      await fetchPromotions();
    } catch (error) {
      console.error('Error saving promotion:', error);
      toast.error('Failed to save promotion');
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await deletePromotion(selectedPromotion.id, currentUser);
      setShowDeleteModal(false);
      setSelectedPromotion(null);
      await fetchPromotions();
    } catch (error) {
      console.error('Error deleting promotion:', error);
      toast.error('Failed to delete promotion');
    }
  };

  const isActive = (promotion) => {
    if (!promotion.isActive) return false;
    const now = new Date();
    const start = promotion.startDate?.toDate ? promotion.startDate.toDate() : new Date(promotion.startDate);
    const end = promotion.endDate?.toDate ? promotion.endDate.toDate() : new Date(promotion.endDate);
    return now >= start && now <= end;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System-Wide Promotions</h1>
          <p className="text-gray-600">Create promotions that can be used across all branches</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create System-Wide Promotion
        </Button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Globe className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">System-Wide Promotions</p>
          <p>These promotions are available in ALL branches. When you create a promotion here, it can be used by any branch in the system. Perfect for company-wide campaigns and special events.</p>
        </div>
      </div>

      {/* Promotions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotions.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Globe className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No system-wide promotions created yet</p>
            <p className="text-sm mt-2">Create your first system-wide promotion to get started</p>
          </div>
        ) : (
          promotions.map((promotion) => (
            <Card key={promotion.id} className="hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-5 w-5 text-primary-600" />
                      <h3 className="text-lg font-semibold text-gray-900">{promotion.name}</h3>
                    </div>
                    {promotion.description && (
                      <p className="text-sm text-gray-600 mb-3">{promotion.description}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded ${
                    isActive(promotion)
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {isActive(promotion) ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Tag className="h-4 w-4 text-gray-400" />
                    <span className="font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                      {promotion.promotionCode || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      {promotion.startDate?.toDate ? promotion.startDate.toDate().toLocaleDateString() : new Date(promotion.startDate).toLocaleDateString()} - {promotion.endDate?.toDate ? promotion.endDate.toDate().toLocaleDateString() : new Date(promotion.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Discount: {promotion.discountType === 'percentage' ? `${promotion.discountValue}%` : `₱${promotion.discountValue}`}
                  </div>
                  <div className="text-sm text-gray-600 flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    <span>All Branches</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Usage: {promotion.usageType === 'one-time' ? 'One-time' : 'Repeating'} 
                    {promotion.maxUses && promotion.usageType === 'repeating' && ` (Max: ${promotion.maxUses})`}
                  </div>
                  {promotion.usageCount !== undefined && (
                    <div className="text-xs text-gray-500">
                      Used: {promotion.usageCount || 0} times
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(promotion)}
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(promotion)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedPromotion(null);
        }}
        title={selectedPromotion ? 'Edit System-Wide Promotion' : 'Create System-Wide Promotion'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <Globe className="h-4 w-4" />
              <span className="font-medium">This promotion will be available in ALL branches</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Promotion Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              placeholder="e.g., Summer Sale 2024"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Promotion Code <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <Input
                value={formData.promotionCode}
                onChange={(e) => setFormData(prev => ({ ...prev, promotionCode: e.target.value.toUpperCase() }))}
                required
                className="font-mono"
                placeholder="e.g., SUMMER24"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormData(prev => ({ ...prev, promotionCode: generatePromotionCode() }))}
              >
                Generate
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              placeholder="Describe the promotion..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount Type
              </label>
              <select
                value={formData.discountType}
                onChange={(e) => setFormData(prev => ({ ...prev, discountType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₱)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount Value <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={formData.discountValue}
                onChange={(e) => setFormData(prev => ({ ...prev, discountValue: e.target.value }))}
                required
                min="0"
                step="0.01"
                placeholder={formData.discountType === 'percentage' ? 'e.g., 20' : 'e.g., 500'}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Usage Type
            </label>
            <select
              value={formData.usageType}
              onChange={(e) => setFormData(prev => ({ ...prev, usageType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              <option value="repeating">Repeating (Can be used multiple times)</option>
              <option value="one-time">One-time (Each client can use once)</option>
            </select>
          </div>

          {formData.usageType === 'repeating' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Uses (Leave empty for unlimited)
              </label>
              <Input
                type="number"
                value={formData.maxUses}
                onChange={(e) => setFormData(prev => ({ ...prev, maxUses: e.target.value }))}
                min="1"
                placeholder="Leave empty for unlimited"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Segment
            </label>
            <select
              value={formData.targetSegment}
              onChange={(e) => setFormData(prev => ({ ...prev, targetSegment: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              <option value="all">All Clients</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-600"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowModal(false);
                setSelectedPromotion(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit">
              {selectedPromotion ? 'Update' : 'Create'} Promotion
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedPromotion(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete System-Wide Promotion"
        message={`Are you sure you want to delete "${selectedPromotion?.name}"? This promotion will be removed from all branches. This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
};

export default OperationalManagerPromotions;



















