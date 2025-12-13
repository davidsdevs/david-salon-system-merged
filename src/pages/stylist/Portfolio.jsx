/**
 * Portfolio Page - Stylist
 * Upload and manage portfolio images
 */

import { useState, useEffect, useMemo } from 'react';
import { Image as ImageIcon, Upload, X, Eye, CheckCircle, XCircle, Clock, Filter, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getPortfoliosByStylist, createPortfolio, deletePortfolio } from '../../services/portfolioService';
import { uploadToCloudinary } from '../../services/imageService';
import { validateImageFile } from '../../services/imageService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const Portfolio = () => {
  const { currentUser } = useAuth();
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    category: '',
    description: '',
    imageFile: null,
    imagePreview: null
  });

  useEffect(() => {
    if (currentUser?.uid) {
      fetchPortfolios();
    }
  }, [currentUser]);

  const fetchPortfolios = async () => {
    try {
      setLoading(true);
      if (currentUser?.uid) {
        const data = await getPortfoliosByStylist(currentUser.uid);
        setPortfolios(data);
      }
    } catch (error) {
      console.error('Error fetching portfolios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateImageFile(file)) return;

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadForm(prev => ({
        ...prev,
        imageFile: file,
        imagePreview: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!uploadForm.imageFile) {
      toast.error('Please select an image');
      return;
    }

    if (!uploadForm.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    try {
      setUploading(true);

      // Upload image to Cloudinary
      const imageUrl = await uploadToCloudinary(uploadForm.imageFile, 'stylist-portfolios');

      // Create portfolio entry
      await createPortfolio({
        stylistId: currentUser.uid,
        title: uploadForm.title.trim(),
        category: uploadForm.category.trim() || 'Uncategorized',
        description: uploadForm.description.trim(),
        imageUrl,
        thumbnailUrl: imageUrl // Use same URL for thumbnail
      });

      // Reset form and close modal
      setUploadForm({
        title: '',
        category: '',
        description: '',
        imageFile: null,
        imagePreview: null
      });
      setShowUploadModal(false);

      // Refresh portfolios
      await fetchPortfolios();
    } catch (error) {
      console.error('Error uploading portfolio:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (portfolioId) => {
    if (!confirm('Are you sure you want to delete this portfolio item?')) return;

    try {
      await deletePortfolio(portfolioId);
      await fetchPortfolios();
    } catch (error) {
      console.error('Error deleting portfolio:', error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      active: 'bg-green-100 text-green-800 border-green-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
    };
    return badges[status] || badges.pending;
  };

  const getStatusIcon = (status) => {
    if (status === 'active' || status === 'approved') {
      return <CheckCircle className="w-4 h-4" />;
    }
    if (status === 'rejected') {
      return <XCircle className="w-4 h-4" />;
    }
    return <Clock className="w-4 h-4" />;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredPortfolios = useMemo(() => {
    if (statusFilter === 'all') {
      return portfolios;
    }
    return portfolios.filter(p => {
      if (statusFilter === 'approved') {
        return p.status === 'active' || p.status === 'approved';
      }
      return p.status === statusFilter;
    });
  }, [portfolios, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: portfolios.length,
      pending: portfolios.filter(p => p.status === 'pending').length,
      approved: portfolios.filter(p => p.status === 'active' || p.status === 'approved').length,
      rejected: portfolios.filter(p => p.status === 'rejected').length,
    };
  }, [portfolios]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Portfolio</h1>
          <p className="text-gray-600 mt-1">Upload and manage your portfolio images</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Upload Portfolio
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <ImageIcon className="w-8 h-8 text-primary-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.approved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.rejected}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All Portfolios</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Portfolio Grid */}
      {filteredPortfolios.length === 0 ? (
        <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
          <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No portfolios found</h3>
          <p className="text-gray-600 mb-4">
            {statusFilter === 'all'
              ? "You haven't uploaded any portfolio images yet."
              : `No ${statusFilter} portfolios found.`}
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Upload className="w-5 h-5" />
            Upload Your First Portfolio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPortfolios.map((portfolio) => (
            <div
              key={portfolio.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Image */}
              <div className="relative aspect-square bg-gray-100">
                <img
                  src={portfolio.thumbnailUrl || portfolio.imageUrl}
                  alt={portfolio.title}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setPreviewImage(portfolio)}
                />
                <button
                  onClick={() => setPreviewImage(portfolio)}
                  className="absolute top-2 right-2 bg-white/90 p-2 rounded-full hover:bg-white transition-colors"
                >
                  <Eye className="w-4 h-4 text-gray-700" />
                </button>
                
                {/* Status Badge */}
                <div className="absolute top-2 left-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(portfolio.status)}`}
                  >
                    {getStatusIcon(portfolio.status)}
                    {portfolio.status === 'active' ? 'Approved' : portfolio.status.charAt(0).toUpperCase() + portfolio.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Portfolio Info */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-gray-900 line-clamp-1">
                    {portfolio.title || 'Untitled'}
                  </h3>
                  {portfolio.category && (
                    <p className="text-sm text-gray-600 mt-1">
                      {portfolio.category}
                    </p>
                  )}
                </div>

                {portfolio.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {portfolio.description}
                  </p>
                )}

                <div className="text-xs text-gray-500 space-y-1">
                  <div>Uploaded: {formatDate(portfolio.createdAt)}</div>
                  {portfolio.status === 'active' && portfolio.approvedAt && (
                    <div className="text-green-600">Approved: {formatDate(portfolio.approvedAt)}</div>
                  )}
                  {portfolio.status === 'rejected' && portfolio.rejectedAt && (
                    <div className="text-red-600">Rejected: {formatDate(portfolio.rejectedAt)}</div>
                  )}
                </div>

                {portfolio.status === 'rejected' && portfolio.rejectionRemark && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-red-800 mb-1">Rejection Reason:</p>
                    <p className="text-xs text-red-700">{portfolio.rejectionRemark}</p>
                  </div>
                )}

                {portfolio.status === 'pending' && (
                  <button
                    onClick={() => handleDelete(portfolio.id)}
                    className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Upload Portfolio Image</h2>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadForm({
                      title: '',
                      category: '',
                      description: '',
                      imageFile: null,
                      imagePreview: null
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Image *
                  </label>
                  {uploadForm.imagePreview ? (
                    <div className="relative">
                      <img
                        src={uploadForm.imagePreview}
                        alt="Preview"
                        className="w-full h-64 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        onClick={() => setUploadForm(prev => ({ ...prev, imageFile: null, imagePreview: null }))}
                        className="absolute top-2 right-2 bg-white/90 p-2 rounded-full hover:bg-white transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-700" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-10 h-10 text-gray-400 mb-3" />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageSelect}
                      />
                    </label>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter portfolio title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <input
                    type="text"
                    value={uploadForm.category}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="e.g., Haircut, Coloring, Styling"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your work..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4">
                  <button
                    onClick={handleUpload}
                    disabled={uploading || !uploadForm.imageFile || !uploadForm.title.trim()}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Uploading...' : 'Upload Portfolio'}
                  </button>
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadForm({
                        title: '',
                        category: '',
                        description: '',
                        imageFile: null,
                        imagePreview: null
                      });
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl w-full">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 bg-white/90 p-2 rounded-full hover:bg-white transition-colors z-10"
            >
              <X className="w-6 h-6 text-gray-700" />
            </button>
            <img
              src={previewImage.imageUrl}
              alt={previewImage.title}
              className="w-full h-auto rounded-lg"
            />
            <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 mt-4">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{previewImage.title}</h3>
              {previewImage.category && (
                <p className="text-sm text-gray-600 mb-2">Category: {previewImage.category}</p>
              )}
              {previewImage.description && (
                <p className="text-sm text-gray-700 mb-2">{previewImage.description}</p>
              )}
              <div className="flex items-center gap-2 mt-4">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(previewImage.status)}`}>
                  {getStatusIcon(previewImage.status)}
                  {previewImage.status === 'active' ? 'Approved' : previewImage.status.charAt(0).toUpperCase() + previewImage.status.slice(1)}
                </span>
                <span className="text-xs text-gray-500">
                  Uploaded: {formatDate(previewImage.createdAt)}
                </span>
              </div>
              {previewImage.status === 'rejected' && previewImage.rejectionRemark && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
                  <p className="text-sm font-semibold text-red-800 mb-1">Rejection Reason:</p>
                  <p className="text-sm text-red-700">{previewImage.rejectionRemark}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Portfolio;

