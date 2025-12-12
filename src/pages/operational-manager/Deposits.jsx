// src/pages/02_OperationalManager/Deposits.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { depositService } from '../../services/depositService';
import { getBranchById, getBranches } from '../../services/branchService';
import {
  Banknote,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Calendar,
  Building,
  FileText,
  Loader2,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download,
  Image as ImageIcon,
  X,
  Home,
  ShoppingCart,
  BarChart3,
  UserCog
} from 'lucide-react';
import { format } from 'date-fns';

const OperationalManagerDeposits = () => {
  const { userData } = useAuth();
  
  const [deposits, setDeposits] = useState([]);
  const [branches, setBranches] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [validationFilter, setValidationFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Modal states
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  // Load deposits and branches
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load all deposits
      const depositsList = await depositService.getAllDeposits();
      setDeposits(depositsList);
      
      // Load branch names
      const branchIds = [...new Set(depositsList.map(d => d.branchId))];
      const branchesMap = {};
      
      for (const branchId of branchIds) {
        try {
          const branch = await getBranchById(branchId);
          if (branch) {
            branchesMap[branchId] = branch.name || 'Unknown Branch';
          }
        } catch (err) {
          console.error(`Error loading branch ${branchId}:`, err);
          branchesMap[branchId] = 'Unknown Branch';
        }
      }
      
      setBranches(branchesMap);
    } catch (err) {
      console.error('Error loading deposits:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userData]);

  // Filter deposits
  const filteredDeposits = deposits.filter(deposit => {
    const branchName = branches[deposit.branchId] || 'Unknown';
    const matchesSearch = 
      !searchTerm ||
      branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deposit.referenceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deposit.submittedByName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || deposit.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || deposit.branchId === branchFilter;
    const matchesValidation = validationFilter === 'all' || deposit.validationStatus === validationFilter;
    
    const matchesDate = (!dateFrom || new Date(deposit.depositDate) >= new Date(dateFrom)) &&
                       (!dateTo || new Date(deposit.depositDate) <= new Date(dateTo));
    
    return matchesSearch && matchesStatus && matchesBranch && matchesValidation && matchesDate;
  });

  // Handle approve/reject
  const handleReview = async (action) => {
    if (!selectedDeposit) return;

    try {
      setIsReviewing(true);
      setError(null);

      await depositService.reviewDeposit(selectedDeposit.id, action, {
        reviewedBy: userData.uid || userData.id,
        reviewedByName: (userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim() 
          : (userData.email || 'Unknown')),
        notes: reviewNotes
      });

      setShowReviewModal(false);
      setReviewNotes('');
      await loadData();
      
      alert(`Deposit ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
    } catch (err) {
      console.error('Error reviewing deposit:', err);
      setError(err.message || 'Failed to review deposit');
    } finally {
      setIsReviewing(false);
    }
  };

  // Statistics
  const stats = {
    total: deposits.length,
    approved: deposits.filter(d => d.status === 'approved').length,
    rejected: deposits.filter(d => d.status === 'rejected').length,
    pending: deposits.filter(d => d.status === 'submitted').length,
    totalAmount: deposits.reduce((sum, d) => sum + (d.amount || 0), 0),
    totalSales: deposits.reduce((sum, d) => sum + (d.dailySalesTotal || 0), 0),
    totalDifference: deposits.reduce((sum, d) => sum + (d.difference || 0), 0),
    matches: deposits.filter(d => d.validationStatus === 'match').length,
    mismatches: deposits.filter(d => d.validationStatus === 'mismatch').length,
    needsReview: deposits.filter(d => d.validationStatus === 'manual_review').length
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-100 border-green-200';
      case 'rejected': return 'text-red-600 bg-red-100 border-red-200';
      case 'submitted': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  // Get validation color
  const getValidationColor = (status) => {
    switch (status) {
      case 'match': return 'text-green-600 bg-green-50';
      case 'mismatch': return 'text-red-600 bg-red-50';
      case 'manual_review': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Get unique branches for filter
  const uniqueBranches = [...new Set(deposits.map(d => d.branchId))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deposit Reviews</h1>
          <p className="text-gray-600">Review and validate branch deposits against daily sales</p>
        </div>
        <Button
          variant="outline"
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Deposits</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.pending} pending</p>
            </div>
            <Banknote className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
          
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">₱{stats.totalSales.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">All branches</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </Card>
          
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Deposits</p>
              <p className="text-2xl font-bold text-gray-900">₱{stats.totalAmount.toLocaleString()}</p>
              <p className={`text-xs mt-1 ${
                stats.totalDifference >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {stats.totalDifference >= 0 ? '+' : ''}₱{Math.abs(stats.totalDifference).toFixed(2)} difference
              </p>
            </div>
            <TrendingDown className="h-8 w-8 text-purple-600" />
          </div>
        </Card>
          
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Validation Status</p>
              <p className="text-2xl font-bold text-gray-900">{stats.matches}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.mismatches} mismatches, {stats.needsReview} need review
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by branch, reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
            
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
          >
            <option value="all">All Status</option>
            <option value="submitted">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
            
          <select
            value={validationFilter}
            onChange={(e) => setValidationFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
          >
            <option value="all">All Validation</option>
            <option value="match">Match</option>
            <option value="mismatch">Mismatch</option>
            <option value="manual_review">Needs Review</option>
          </select>
            
          <Input
            type="date"
            placeholder="From Date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
            
          <Input
            type="date"
            placeholder="To Date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </Card>

      {/* Deposits Table */}
      {loading ? (
        <Card className="p-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#160B53]" />
            <span className="ml-2 text-gray-600">Loading deposits...</span>
          </div>
        </Card>
      ) : error ? (
        <Card className="p-6 bg-red-50 border-red-200">
          <p className="text-red-800">{error}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deposit Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Daily Sales</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Difference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDeposits.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                      No deposits found
                    </td>
                  </tr>
                ) : (
                  filteredDeposits.map((deposit) => (
                    <tr key={deposit.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {format(new Date(deposit.depositDate), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {branches[deposit.branchId] || 'Unknown Branch'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">
                        ₱{(deposit.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                        ₱{(deposit.dailySalesTotal || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {Math.abs(deposit.difference || 0) <= 1 ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : Math.abs(deposit.difference || 0) > 100 ? (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          )}
                          <span className={`font-medium ${
                            Math.abs(deposit.difference || 0) <= 1 
                              ? 'text-green-600' 
                              : Math.abs(deposit.difference || 0) > 100
                              ? 'text-red-600'
                              : 'text-yellow-600'
                          }`}>
                            {deposit.difference >= 0 ? '+' : ''}₱{Math.abs(deposit.difference || 0).toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getValidationColor(deposit.validationStatus)}`}>
                          {deposit.validationStatus === 'match' ? '✓ Match' :
                           deposit.validationStatus === 'mismatch' ? '✗ Mismatch' :
                           deposit.validationStatus === 'manual_review' ? '⚠ Review' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(deposit.status)}`}>
                          {deposit.status === 'approved' ? '✓ Approved' :
                           deposit.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {deposit.submittedByName || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedDeposit(deposit);
                              setShowDetailsModal(true);
                            }}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          {deposit.status === 'submitted' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedDeposit(deposit);
                                setReviewNotes('');
                                setShowReviewModal(true);
                              }}
                              className="bg-[#160B53] text-white hover:bg-[#12094A]"
                            >
                              Review
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Deposit Details Modal */}
      {showDetailsModal && selectedDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Deposit Details</h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowDetailsModal(false)}
                  className="text-white hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Cross-Comparison Card */}
              <Card className="p-6 bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Amount Comparison</h3>
                <div className="space-y-4">
                  {/* Daily Sales Total */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                      <span className="font-medium text-gray-700">Daily Sales Total (Transactions)</span>
                    </div>
                    <span className="text-xl font-bold text-blue-600">
                      ₱{(selectedDeposit.dailySalesTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* OCR Extracted Amount */}
                  {selectedDeposit.ocrExtractedAmount && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                        <span className="font-medium text-gray-700">OCR Extracted (Receipt)</span>
                        {selectedDeposit.ocrConfidence && (
                          <span className="text-xs text-gray-500">({selectedDeposit.ocrConfidence.toFixed(1)}% confidence)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-purple-600">
                          ₱{selectedDeposit.ocrExtractedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {selectedDeposit.dailySalesTotal > 0 && (
                          <span className={`text-sm font-medium ${
                            Math.abs(selectedDeposit.ocrExtractedAmount - selectedDeposit.dailySalesTotal) <= 1 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ({selectedDeposit.ocrExtractedAmount >= selectedDeposit.dailySalesTotal ? '+' : ''}₱{(selectedDeposit.ocrExtractedAmount - selectedDeposit.dailySalesTotal).toFixed(2)})
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Manual Deposit Amount */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-600"></div>
                      <span className="font-medium text-gray-700">Manual Deposit Amount</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-green-600">
                        ₱{(selectedDeposit.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {selectedDeposit.dailySalesTotal > 0 && (
                        <span className={`text-sm font-medium ${
                          Math.abs(selectedDeposit.amount - selectedDeposit.dailySalesTotal) <= 1 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ({selectedDeposit.amount >= selectedDeposit.dailySalesTotal ? '+' : ''}₱{(selectedDeposit.amount - selectedDeposit.dailySalesTotal).toFixed(2)})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Comparison Summary */}
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Validation Summary:</p>
                    <div className="space-y-1">
                      {selectedDeposit.ocrExtractedAmount && (
                        <p className="text-xs text-gray-600">
                          OCR vs Sales: <span className={`font-medium ${
                            Math.abs(selectedDeposit.ocrExtractedAmount - selectedDeposit.dailySalesTotal) <= 1 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {Math.abs(selectedDeposit.ocrExtractedAmount - selectedDeposit.dailySalesTotal) <= 1 ? '✓ Match' : `✗ Difference: ₱${Math.abs(selectedDeposit.ocrExtractedAmount - selectedDeposit.dailySalesTotal).toFixed(2)}`}
                          </span>
                        </p>
                      )}
                      <p className="text-xs text-gray-600">
                        Manual vs Sales: <span className={`font-medium ${
                          Math.abs(selectedDeposit.amount - selectedDeposit.dailySalesTotal) <= 1 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {Math.abs(selectedDeposit.amount - selectedDeposit.dailySalesTotal) <= 1 ? '✓ Match' : `✗ Difference: ₱${Math.abs(selectedDeposit.amount - selectedDeposit.dailySalesTotal).toFixed(2)}`}
                        </span>
                      </p>
                      {selectedDeposit.ocrExtractedAmount && (
                        <p className="text-xs text-gray-600">
                          OCR vs Manual: <span className={`font-medium ${
                            Math.abs(selectedDeposit.ocrExtractedAmount - selectedDeposit.amount) <= 1 ? 'text-green-600' : 'text-yellow-600'
                          }`}>
                            {Math.abs(selectedDeposit.ocrExtractedAmount - selectedDeposit.amount) <= 1 ? '✓ Match' : `⚠ Difference: ₱${Math.abs(selectedDeposit.ocrExtractedAmount - selectedDeposit.amount).toFixed(2)}`}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Receipt Image */}
              {selectedDeposit.receiptImageUrl && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Receipt Image</h3>
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <img 
                      src={selectedDeposit.receiptImageUrl} 
                      alt="Deposit receipt" 
                      className="max-w-full rounded-lg shadow-md"
                    />
                  </div>
                </div>
              )}

              {/* OCR Information */}
              {selectedDeposit.ocrExtractedAmount && (
                <Card className="p-4 bg-gray-50">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">OCR Extraction Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Extracted Amount</p>
                      <p className="text-lg font-semibold text-gray-900">
                        ₱{selectedDeposit.ocrExtractedAmount.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Confidence Level</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {(selectedDeposit.ocrConfidence || 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Deposit Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Deposit Date</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {format(new Date(selectedDeposit.depositDate), 'MMMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Branch</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {branches[selectedDeposit.branchId] || 'Unknown Branch'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Validation Status</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getValidationColor(selectedDeposit.validationStatus)}`}>
                    {selectedDeposit.validationStatus}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Review Status</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedDeposit.status)}`}>
                    {selectedDeposit.status}
                  </span>
                </div>
                {selectedDeposit.bankName && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Bank</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedDeposit.bankName}</p>
                  </div>
                )}
                {selectedDeposit.referenceNumber && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Reference Number</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedDeposit.referenceNumber}</p>
                  </div>
                )}
              </div>

              {/* Submitted By */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-500">Submitted By</p>
                <p className="text-gray-900">{selectedDeposit.submittedByName || 'Unknown'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {format(new Date(selectedDeposit.submittedAt), 'MMM dd, yyyy HH:mm')}
                </p>
              </div>

              {/* Review Information */}
              {selectedDeposit.reviewedByName && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm font-medium text-gray-500">Reviewed By</p>
                  <p className="text-gray-900">{selectedDeposit.reviewedByName}</p>
                  {selectedDeposit.reviewedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(selectedDeposit.reviewedAt), 'MMM dd, yyyy HH:mm')}
                    </p>
                  )}
                  {selectedDeposit.reviewNotes && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700">Review Notes:</p>
                      <p className="text-sm text-gray-600 mt-1">{selectedDeposit.reviewNotes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedDeposit.notes && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm font-medium text-gray-500">Notes</p>
                  <p className="text-gray-900">{selectedDeposit.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && selectedDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
            <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Review Deposit</h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowReviewModal(false)}
                  className="text-white hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-600">Daily Sales</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ₱{(selectedDeposit.dailySalesTotal || 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-600">Deposit Amount</p>
                  <p className="text-2xl font-bold text-green-600">
                    ₱{(selectedDeposit.amount || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Difference</p>
                <p className={`text-xl font-bold ${
                  Math.abs(selectedDeposit.difference || 0) <= 1 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  {selectedDeposit.difference >= 0 ? '+' : ''}₱{Math.abs(selectedDeposit.difference || 0).toFixed(2)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Notes
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                  placeholder="Add notes about your review decision..."
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowReviewModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleReview('reject')}
                  disabled={isReviewing}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  {isReviewing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleReview('approve')}
                  disabled={isReviewing}
                  className="bg-green-600 text-white hover:bg-green-700"
                >
                  {isReviewing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    
  );
};

export default OperationalManagerDeposits;

