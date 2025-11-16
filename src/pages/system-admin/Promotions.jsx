/**
 * System Admin Promotions Management Page
 * Module: M06 - CRM
 * Allows system admins to create and manage promotional campaigns
 */

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, Tag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAllPromotions, createPromotion, updatePromotion, deletePromotion } from '../../services/promotionService';
import { getBranches } from '../../services/branchService';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const Promotions = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'discount',
    discountType: 'percentage',
    discountValue: '',
    branchId: '',
    targetSegment: 'all',
    applicableServices: [],
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [promosData, branchesData] = await Promise.all([
        getAllPromotions(),
        getBranches()
      ]);
      setPromotions(promosData);
      setBranches(branchesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedPromotion(null);
    setFormData({
      name: '',
      description: '',
      type: 'discount',
      discountType: 'percentage',
      discountValue: '',
      branchId: '',
      targetSegment: 'all',
      applicableServices: [],
      startDate: '',
      endDate: ''
    });
    setShowModal(true);
  };

  const handleEdit = (promotion) => {
    setSelectedPromotion(promotion);
    setFormData({
      name: promotion.name,
      description: promotion.description || '',
      type: promotion.type || 'discount',
      discountType: promotion.discountType || 'percentage',
      discountValue: promotion.discountValue || '',
      branchId: promotion.branchId || '',
      targetSegment: promotion.targetSegment || 'all',
      applicableServices: promotion.applicableServices || [],
      startDate: promotion.startDate ? promotion.startDate.toISOString().split('T')[0] : '',
      endDate: promotion.endDate ? promotion.endDate.toISOString().split('T')[0] : ''
    });
    setShowModal(true);
  };

  const handleDelete = (promotion) => {
    setSelectedPromotion(promotion);
    setShowDeleteModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.startDate || !formData.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (selectedPromotion) {
        await updatePromotion(selectedPromotion.id, formData, currentUser);
      } else {
        await createPromotion(formData, currentUser);
      }
      
      setShowModal(false);
      await fetchData();
    } catch (error) {
      console.error('Error saving promotion:', error);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await deletePromotion(selectedPromotion.id, currentUser);
      setShowDeleteModal(false);
      setSelectedPromotion(null);
      await fetchData();
    } catch (error) {
      console.error('Error deleting promotion:', error);
    }
  };

  const isActive = (promotion) => {
    if (!promotion.isActive) return false;
    const now = new Date();
    const start = promotion.startDate?.toDate() || new Date();
    const end = promotion.endDate?.toDate() || new Date();
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
          <h1 className="text-2xl font-bold text-gray-900">Promotions & Campaigns</h1>
          <p className="text-gray-600">Create and manage promotional campaigns</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Promotion
        </Button>
      </div>

      {/* Promotions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotions.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No promotions created yet
          </div>
        ) : (
          promotions.map((promotion) => (
            <Card key={promotion.id}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-5 w-5 text-[#2D1B4E]" />
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
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      {promotion.startDate?.toLocaleDateString()} - {promotion.endDate?.toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Discount: {promotion.discountType === 'percentage' ? `${promotion.discountValue}%` : `₱${promotion.discountValue}`}
                  </div>
                  <div className="text-sm text-gray-600">
                    Target: {promotion.targetSegment || 'All'} clients
                  </div>
                  {promotion.branchId && (
                    <div className="text-sm text-gray-600">
                      Branch: {branches.find(b => b.id === promotion.branchId)?.name || 'N/A'}
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
        title={selectedPromotion ? 'Edit Promotion' : 'Create Promotion'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Promotion Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
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
              Target Segment
            </label>
            <select
              value={formData.targetSegment}
              onChange={(e) => setFormData(prev => ({ ...prev, targetSegment: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent"
            >
              <option value="all">All Clients</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch (Leave empty for all branches)
            </label>
            <select
              value={formData.branchId}
              onChange={(e) => setFormData(prev => ({ ...prev, branchId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent"
            >
              <option value="">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name || branch.branchName}
                </option>
              ))}
            </select>
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
        title="Delete Promotion"
        message={`Are you sure you want to delete "${selectedPromotion?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
      />
    </div>
  );
};

export default Promotions;

