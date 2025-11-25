/**
 * Price History Analytics Page
 * For Operational Manager to view service price change history and sales impact
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import {
  TrendingUp,
  TrendingDown,
  Banknote,
  ShoppingCart,
  Calendar,
  Search,
  AlertCircle,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  Activity,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  X,
  User,
  Clock,
  Tag
} from 'lucide-react';
import { format } from 'date-fns';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getPriceHistory, getPriceChangeImpact, getTransactionsForPricePeriod } from '../../services/priceHistoryService';
import { getAllBranches } from '../../services/branchService';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const PriceHistoryAnalytics = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [priceHistory, setPriceHistory] = useState([]);
  const [impactData, setImpactData] = useState(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [selectedPriceChange, setSelectedPriceChange] = useState(null);
  const [selectedPriceType, setSelectedPriceType] = useState(null); // 'old' or 'new'

  useEffect(() => {
    loadServices();
    loadBranches();
  }, []);

  useEffect(() => {
    if (selectedServiceId && selectedBranchId) {
      loadPriceHistory();
    } else {
      setPriceHistory([]);
      setImpactData(null);
    }
  }, [selectedServiceId, selectedBranchId]);

  const loadServices = async () => {
    try {
      const servicesRef = collection(db, 'services');
      const q = query(
        servicesRef,
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );
      const snapshot = await getDocs(q);
      const servicesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setServices(servicesList);
    } catch (error) {
      console.error('Error loading services:', error);
      toast.error('Failed to load services');
    }
  };

  const loadBranches = async () => {
    try {
      const branchesList = await getAllBranches();
      setBranches(branchesList);
    } catch (error) {
      console.error('Error loading branches:', error);
      toast.error('Failed to load branches');
    }
  };

  const loadPriceHistory = async () => {
    try {
      setLoading(true);
      const history = await getPriceHistory(selectedServiceId, selectedBranchId);
      setPriceHistory(history);
    } catch (error) {
      console.error('Error loading price history:', error);
      toast.error('Failed to load price history');
    } finally {
      setLoading(false);
    }
  };

  const loadImpactAnalysis = async (priceChange) => {
    try {
      setLoadingImpact(true);
      const impact = await getPriceChangeImpact(
        selectedServiceId,
        selectedBranchId,
        priceChange.changedAt,
        30, // 30 days before
        30  // 30 days after
      );
      setImpactData({
        ...impact,
        priceChange
      });
    } catch (error) {
      console.error('Error loading impact analysis:', error);
      toast.error('Failed to load impact analysis');
    } finally {
      setLoadingImpact(false);
    }
  };

  const loadTransactionsForPeriod = async (priceChange, priceType = 'old') => {
    try {
      setLoadingTransactions(true);
      setSelectedPriceChange(priceChange);
      setSelectedPriceType(priceType);
      const changeDate = new Date(priceChange.changedAt);
      const price = priceType === 'old' ? priceChange.oldPrice : priceChange.newPrice;
      
      // Get transactions 30 days before or after based on price type
      const startDate = new Date(changeDate);
      const endDate = new Date(changeDate);
      
      if (priceType === 'old') {
        startDate.setDate(startDate.getDate() - 30);
        endDate.setDate(endDate.getDate() - 1); // Up to day before change
      } else {
        startDate.setDate(startDate.getDate() + 1); // Day after change
        endDate.setDate(endDate.getDate() + 30);
      }
      
      const transactionsData = await getTransactionsForPricePeriod(
        selectedServiceId,
        selectedBranchId,
        startDate,
        endDate,
        price
      );
      
      setTransactions(transactionsData);
      setIsTransactionsModalOpen(true);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedService = services.find(s => s.id === selectedServiceId);
  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  const getPriceChangePercentage = (oldPrice, newPrice) => {
    if (!oldPrice || oldPrice === 0) return 0;
    return ((newPrice - oldPrice) / oldPrice) * 100;
  };

  const formatCurrency = (amount) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '₱0.00';
    return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-[#160B53] to-[#3B2E7A] rounded-lg">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Price History Analytics</h1>
          </div>
          <p className="text-gray-600 ml-[52px]">Track service price changes and analyze their impact on sales performance</p>
        </div>
      </div>

      {/* Selection Card */}
      <Card className="p-6 shadow-lg border border-gray-200">
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="h-5 w-5 text-[#160B53]" />
            <h2 className="text-lg font-semibold text-gray-900">Service & Branch Selection</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Service Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Select Service
              </label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search services..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-gray-300 focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                  />
                </div>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] bg-white transition-all hover:border-gray-400"
                >
                  <option value="">-- Select Service --</option>
                  {filteredServices.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name} {service.category ? `(${service.category})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Branch Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Select Branch
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] bg-white transition-all hover:border-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={!selectedServiceId}
              >
                <option value="">-- Select Branch --</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name || branch.branchName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedService && selectedBranch && (
            <div className="mt-4 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Selected Service</p>
                  <p className="text-xl font-bold text-gray-900 mb-1">
                    {selectedService.name}
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    at {selectedBranch.name || selectedBranch.branchName}
                  </p>
                  {selectedService.branchPricing?.[selectedBranchId] && (
                    <div className="flex items-center gap-2 mt-2">
                      <Banknote className="h-5 w-5 text-green-600" />
                      <p className="text-base font-semibold text-green-700">
                        Current Price: {formatCurrency(selectedService.branchPricing[selectedBranchId])}
                      </p>
                    </div>
                  )}
                </div>
                <div className="ml-4 p-3 bg-white rounded-lg shadow-sm border border-blue-100">
                  <Tag className="h-8 w-8 text-[#160B53]" />
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Price History */}
      {selectedServiceId && selectedBranchId && (
        <>
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : priceHistory.length === 0 ? (
            <Card className="p-12 shadow-lg border-2 border-gray-200">
              <div className="text-center py-8">
                <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                  <AlertCircle className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">No Price History</h3>
                <p className="text-gray-600 text-lg max-w-md mx-auto">
                  No price changes have been recorded for this service at this branch yet.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Price history will appear here once changes are made.
                </p>
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden shadow-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <Activity className="h-5 w-5 text-[#160B53]" />
                  <h2 className="text-xl font-bold text-gray-900">Price Change History</h2>
                </div>
                <p className="text-sm text-gray-600 ml-8">
                  Click on any price change to view detailed sales impact analysis
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-800 to-gray-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Date Changed
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        Old Price
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        New Price
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        Change
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Changed By
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {priceHistory.map((change) => {
                      const changePercent = getPriceChangePercentage(change.oldPrice, change.newPrice);
                      const isIncrease = change.newPrice > change.oldPrice;
                      
                      return (
                        <tr key={change.id} className="hover:bg-blue-50 transition-colors duration-150">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <div>
                                <div className="text-sm font-semibold text-gray-900">
                                  {format(change.changedAt, 'MMM dd, yyyy')}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {format(change.changedAt, 'hh:mm a')}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-700">
                              {formatCurrency(change.oldPrice)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-[#160B53]">
                              {formatCurrency(change.newPrice)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                              isIncrease 
                                ? 'bg-red-100 text-red-700 border border-red-200' 
                                : 'bg-green-100 text-green-700 border border-green-200'
                            }`}>
                              {isIncrease ? (
                                <ArrowUp className="h-4 w-4" />
                              ) : (
                                <ArrowDown className="h-4 w-4" />
                              )}
                              {Math.abs(changePercent).toFixed(1)}%
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatCurrency(Math.abs(change.newPrice - change.oldPrice))}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-900">
                                {change.changedByName || 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadImpactAnalysis(change)}
                                className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 hover:text-blue-800"
                              >
                                <BarChart3 className="h-4 w-4" />
                                Impact
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadTransactionsForPeriod(change, 'old')}
                                className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700"
                                title="View transactions with old price"
                              >
                                <ShoppingCart className="h-4 w-4" />
                                Old
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadTransactionsForPeriod(change, 'new')}
                                className="flex items-center gap-2 bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
                                title="View transactions with new price"
                              >
                                <ShoppingCart className="h-4 w-4" />
                                New
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Impact Analysis */}
          {impactData && (
            <Card className="p-6 shadow-lg border border-gray-200">
              <div className="mb-6 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                    <TrendingUpIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Sales Impact Analysis</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Comparing sales 30 days before and after the price change on{' '}
                      <span className="font-semibold text-[#160B53]">
                        {format(impactData.priceChange.changedAt, 'MMM dd, yyyy')}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {loadingImpact ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-green-500 rounded-xl">
                          <Banknote className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Revenue Change</p>
                        <p className="text-3xl font-bold text-gray-900 mb-4">
                          {impactData.changes.revenueChange > 0 ? (
                            <span className="text-green-600 flex items-center gap-2">
                              <TrendingUp className="h-6 w-6" />
                              +{impactData.changes.revenueChange.toFixed(1)}%
                            </span>
                          ) : impactData.changes.revenueChange < 0 ? (
                            <span className="text-red-600 flex items-center gap-2">
                              <TrendingDown className="h-6 w-6" />
                              {impactData.changes.revenueChange.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-600 flex items-center gap-2">
                              <Minus className="h-6 w-6" />
                              0%
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="pt-4 border-t-2 border-green-200 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-gray-600 uppercase">Before</span>
                          <span className="text-sm font-bold text-gray-900">
                            {formatCurrency(impactData.before.totalRevenue)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-gray-600 uppercase">After</span>
                          <span className="text-sm font-bold text-green-700">
                            {formatCurrency(impactData.after.totalRevenue)}
                          </span>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-500 rounded-xl">
                          <Activity className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Sales Count Change</p>
                        <p className="text-3xl font-bold text-gray-900 mb-4">
                          {impactData.changes.salesCountChange > 0 ? (
                            <span className="text-red-600 flex items-center gap-2">
                              <TrendingUp className="h-6 w-6" />
                              +{impactData.changes.salesCountChange.toFixed(1)}%
                            </span>
                          ) : impactData.changes.salesCountChange < 0 ? (
                            <span className="text-green-600 flex items-center gap-2">
                              <TrendingDown className="h-6 w-6" />
                              {impactData.changes.salesCountChange.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-600 flex items-center gap-2">
                              <Minus className="h-6 w-6" />
                              0%
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="pt-4 border-t-2 border-purple-200 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-gray-600 uppercase">Before</span>
                          <span className="text-sm font-bold text-gray-900">
                            {impactData.before.totalSales}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-gray-600 uppercase">After</span>
                          <span className="text-sm font-bold text-purple-700">
                            {impactData.after.totalSales}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Detailed Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="p-6 border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-md">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-500 rounded-lg">
                          <Clock className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">
                          30 Days Before Price Change
                        </h3>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-blue-100">
                          <span className="text-sm font-medium text-gray-700">Total Sales:</span>
                          <span className="font-bold text-blue-700 text-lg">{impactData.before.totalSales}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-blue-100">
                          <span className="text-sm font-medium text-gray-700">Total Revenue:</span>
                          <span className="font-bold text-blue-700 text-lg">{formatCurrency(impactData.before.totalRevenue)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-blue-100">
                          <span className="text-sm font-medium text-gray-700">Average Price:</span>
                          <span className="font-bold text-blue-700 text-lg">
                            {formatCurrency(impactData.before.averagePrice)}
                          </span>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-6 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-purple-500 rounded-lg">
                          <TrendingUpIcon className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">
                          30 Days After Price Change
                        </h3>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-purple-100">
                          <span className="text-sm font-medium text-gray-700">Total Sales:</span>
                          <span className="font-bold text-purple-700 text-lg">{impactData.after.totalSales}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-purple-100">
                          <span className="text-sm font-medium text-gray-700">Total Revenue:</span>
                          <span className="font-bold text-purple-700 text-lg">{formatCurrency(impactData.after.totalRevenue)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-purple-100">
                          <span className="text-sm font-medium text-gray-700">Average Price:</span>
                          <span className="font-bold text-purple-700 text-lg">
                            {formatCurrency(impactData.after.averagePrice)}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Comparison Charts */}
                  {impactData && (
                    <div className="space-y-6 mt-8">
                      <div className="flex items-center gap-3 mb-4">
                        <BarChart3 className="h-6 w-6 text-[#160B53]" />
                        <h3 className="text-xl font-bold text-gray-900">Sales Trends Comparison</h3>
                      </div>
                      
                      {/* Revenue Chart */}
                      <Card className="p-6 border-2 border-gray-200 shadow-md">
                        <div className="flex items-center gap-3 mb-6">
                          <Banknote className="h-5 w-5 text-green-600" />
                          <h4 className="text-lg font-bold text-gray-900">Daily Revenue Trend</h4>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={(() => {
                            // Combine before and after sales by date
                            const beforeDates = Object.keys(impactData.before.salesByDate || {});
                            const afterDates = Object.keys(impactData.after.salesByDate || {});
                            const allDates = [...new Set([...beforeDates, ...afterDates])].sort();
                            
                            return allDates.map(date => ({
                              date: format(new Date(date), 'MMM dd'),
                              before: impactData.before.salesByDate[date]?.revenue || 0,
                              after: impactData.after.salesByDate[date]?.revenue || 0,
                              changeDate: format(impactData.priceChangeDate, 'MMM dd')
                            }));
                          })()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip formatter={(value) => `₱${value.toLocaleString()}`} />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="before" 
                              stroke="#3b82f6" 
                              strokeWidth={2}
                              name="30 Days Before"
                              dot={{ r: 4 }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="after" 
                              stroke="#ef4444" 
                              strokeWidth={2}
                              name="30 Days After"
                              dot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </Card>

                      {/* Sales Count Chart */}
                      <Card className="p-6 border-2 border-gray-200 shadow-md">
                        <div className="flex items-center gap-3 mb-6">
                          <Activity className="h-5 w-5 text-purple-600" />
                          <h4 className="text-lg font-bold text-gray-900">Daily Sales Count</h4>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={(() => {
                            const beforeDates = Object.keys(impactData.before.salesByDate || {});
                            const afterDates = Object.keys(impactData.after.salesByDate || {});
                            const allDates = [...new Set([...beforeDates, ...afterDates])].sort();
                            
                            return allDates.map(date => ({
                              date: format(new Date(date), 'MMM dd'),
                              before: impactData.before.salesByDate[date]?.count || 0,
                              after: impactData.after.salesByDate[date]?.count || 0
                            }));
                          })()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="before" 
                              stroke="#3b82f6" 
                              strokeWidth={2}
                              name="30 Days Before"
                              dot={{ r: 4 }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="after" 
                              stroke="#ef4444" 
                              strokeWidth={2}
                              name="30 Days After"
                              dot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Transactions Modal */}
          {isTransactionsModalOpen && selectedPriceChange && (
            <Modal
              isOpen={isTransactionsModalOpen}
              onClose={() => {
                setIsTransactionsModalOpen(false);
                setSelectedPriceChange(null);
                setSelectedPriceType(null);
                setTransactions([]);
              }}
              title={`Transactions - ${selectedPriceType === 'old' ? 'Old' : 'New'} Price Period (₱${(selectedPriceType === 'old' ? selectedPriceChange.oldPrice : selectedPriceChange.newPrice).toLocaleString()})`}
              size="xl"
            >
              {loadingTransactions ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Transactions Found</h3>
                  <p className="text-gray-600">
                    No transactions found for this price period.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Price Period:</p>
                        <p className="text-lg font-semibold text-gray-900">
                          ₱{(selectedPriceType === 'old' ? selectedPriceChange.oldPrice : selectedPriceChange.newPrice).toLocaleString()} per service
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Total Transactions: {transactions.length} | 
                          Total Revenue: ₱{transactions.reduce((sum, t) => sum + t.itemPrice, 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stylist</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {transactions.map((transaction) => (
                          <tr key={transaction.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className="text-xs text-gray-900">
                                {format(transaction.transactionDate, 'MMM dd, yyyy')}
                              </div>
                              <div className="text-xs text-gray-500">
                                {format(transaction.transactionDate, 'hh:mm a')}
                              </div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-900">
                              {transaction.clientName}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-900">
                              {transaction.itemName}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-900">
                              ₱{transaction.itemPrice.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-900 font-medium">
                              ₱{transaction.itemPrice.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-900">
                              <span className="capitalize">{transaction.paymentMethod}</span>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-900">
                              {transaction.stylistName}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Modal>
          )}
        </>
      )}
    </div>
  );
};

export default PriceHistoryAnalytics;



