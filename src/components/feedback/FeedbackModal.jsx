/**
 * Feedback Modal Component
 * Module: M06 - CRM
 * Allows clients to submit feedback and ratings after appointments
 */

import { useState } from 'react';
import { X, Star } from 'lucide-react';
import { submitFeedback } from '../../services/feedbackService';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import toast from 'react-hot-toast';

const FeedbackModal = ({ isOpen, onClose, appointment, onSubmitted }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    overallRating: 0,
    stylistRating: 0,
    serviceRating: 0,
    comments: '',
    wouldRecommend: false,
    visitAgain: false
  });
  const [hoveredRating, setHoveredRating] = useState({
    overall: 0,
    stylist: 0,
    service: 0
  });

  const handleRatingClick = (category, value) => {
    setFormData(prev => ({
      ...prev,
      [category]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.overallRating === 0) {
      toast.error('Please provide an overall rating');
      return;
    }

    try {
      setLoading(true);
      
      await submitFeedback({
        clientId: appointment?.clientId,
        clientName: appointment?.clientName,
        appointmentId: appointment?.id,
        branchId: appointment?.branchId,
        branchName: appointment?.branchName,
        stylistId: appointment?.stylistId,
        stylistName: appointment?.stylistName,
        overallRating: formData.overallRating,
        stylistRating: formData.stylistRating || formData.overallRating,
        serviceRating: formData.serviceRating || formData.overallRating,
        comments: formData.comments,
        wouldRecommend: formData.wouldRecommend,
        visitAgain: formData.visitAgain
      });

      toast.success('Thank you for your feedback!');
      
      // Reset form
      setFormData({
        overallRating: 0,
        stylistRating: 0,
        serviceRating: 0,
        comments: '',
        wouldRecommend: false,
        visitAgain: false
      });
      
      if (onSubmitted) {
        onSubmitted();
      }
      
      onClose();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  const renderStarRating = (category, value, onHover) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleRatingClick(category, star)}
            onMouseEnter={() => setHoveredRating(prev => ({ ...prev, [category]: star }))}
            onMouseLeave={() => setHoveredRating(prev => ({ ...prev, [category]: 0 }))}
            className="focus:outline-none"
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                star <= (hoveredRating[category] || value)
                  ? 'text-yellow-500 fill-yellow-500'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Your Feedback"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Overall Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Overall Experience <span className="text-red-500">*</span>
          </label>
          {renderStarRating('overallRating', formData.overallRating, 'overall')}
        </div>

        {/* Stylist Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Stylist Performance
          </label>
          {renderStarRating('stylistRating', formData.stylistRating, 'stylist')}
        </div>

        {/* Service Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Service Quality
          </label>
          {renderStarRating('serviceRating', formData.serviceRating, 'service')}
        </div>

        {/* Comments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comments (Optional)
          </label>
          <textarea
            value={formData.comments}
            onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent"
            placeholder="Tell us about your experience..."
          />
        </div>

        {/* Additional Questions */}
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.wouldRecommend}
              onChange={(e) => setFormData(prev => ({ ...prev, wouldRecommend: e.target.checked }))}
              className="mr-2 h-4 w-4 text-[#2D1B4E] focus:ring-[#2D1B4E] border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">I would recommend this salon to others</span>
          </label>
          
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.visitAgain}
              onChange={(e) => setFormData(prev => ({ ...prev, visitAgain: e.target.checked }))}
              className="mr-2 h-4 w-4 text-[#2D1B4E] focus:ring-[#2D1B4E] border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">I plan to visit again</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || formData.overallRating === 0}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Submitting...
              </>
            ) : (
              'Submit Feedback'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default FeedbackModal;

