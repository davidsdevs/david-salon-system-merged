/**
 * Rewards Page - Client
 * View loyalty points, referrals, and membership status
 */

import { useState, useEffect } from 'react';
import { Gift, Star, Users, Copy, CheckCircle, Calendar, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAllBranchLoyaltyPoints, getLoyaltyHistory } from '../../services/loyaltyService';
import { getAllReferralCodes, getReferralStats } from '../../services/referralService';
import { getAllBranches } from '../../services/branchService';
import { getAppointmentsByClient } from '../../services/appointmentService';
import { formatDate, formatCurrency } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const ClientRewards = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [branchPoints, setBranchPoints] = useState([]);
  const [referralCodes, setReferralCodes] = useState([]);
  const [referralStats, setReferralStats] = useState({ totalReferrals: 0, totalRewards: 0 });
  const [branches, setBranches] = useState([]);
  const [loyaltyHistory, setLoyaltyHistory] = useState([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [totalVisits, setTotalVisits] = useState(0);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    if (currentUser?.uid) {
      fetchRewardsData();
    }
  }, [currentUser]);

  const fetchRewardsData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [pointsData, codesData, branchesData, appointmentsData] = await Promise.all([
        getAllBranchLoyaltyPoints(currentUser.uid),
        getAllReferralCodes(currentUser.uid),
        getAllBranches(),
        getAppointmentsByClient(currentUser.uid)
      ]);

      setBranchPoints(pointsData);
      setReferralCodes(codesData);
      setBranches(branchesData.filter(b => b.isActive));

      // Calculate total points
      const total = pointsData.reduce((sum, item) => sum + (item.loyaltyPoints || 0), 0);
      setTotalPoints(total);

      // Calculate total visits (completed appointments)
      const completed = appointmentsData.filter(apt => apt.status === 'completed');
      setTotalVisits(completed.length);

      // Fetch referral stats
      try {
        const stats = await getReferralStats(currentUser.uid);
        setReferralStats(stats || { totalReferrals: 0, totalRewards: 0 });
      } catch (error) {
        console.error('Error fetching referral stats:', error);
      }

      // Fetch recent loyalty history
      try {
        const history = await getLoyaltyHistory(currentUser.uid, null, 10);
        setLoyaltyHistory(history || []);
      } catch (error) {
        console.error('Error fetching loyalty history:', error);
      }

    } catch (error) {
      console.error('Error fetching rewards data:', error);
      toast.error('Failed to load rewards data');
    } finally {
      setLoading(false);
    }
  };

  const getBranchName = (branchId) => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || branch?.branchName || 'Unknown Branch';
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Referral code copied!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getMembershipTier = (points) => {
    if (points >= 10000) return { name: 'Platinum', color: 'bg-purple-100 text-purple-700', icon: '👑' };
    if (points >= 5000) return { name: 'Gold', color: 'bg-yellow-100 text-yellow-700', icon: '⭐' };
    if (points >= 2000) return { name: 'Silver', color: 'bg-gray-100 text-gray-700', icon: '✨' };
    return { name: 'Bronze', color: 'bg-orange-100 text-orange-700', icon: '🌟' };
  };

  const membershipTier = getMembershipTier(totalPoints);

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
        <h1 className="text-2xl font-bold text-gray-900">My Rewards</h1>
        <p className="text-gray-600">Track your loyalty points and referrals</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Star className="w-8 h-8" />
            <span className="text-2xl">{membershipTier.icon}</span>
          </div>
          <p className="text-primary-100 text-sm mb-1">Total Points</p>
          <p className="text-3xl font-bold">{totalPoints.toLocaleString()}</p>
          <p className="text-primary-100 text-xs mt-2">{membershipTier.name} Member</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-gray-500 text-sm mb-1">Total Visits</p>
          <p className="text-3xl font-bold text-gray-900">{totalVisits}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-gray-500 text-sm mb-1">Referrals</p>
          <p className="text-3xl font-bold text-gray-900">{referralStats.totalReferrals || 0}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <Gift className="w-6 h-6 text-purple-600" />
          </div>
          <p className="text-gray-500 text-sm mb-1">Referral Rewards</p>
          <p className="text-3xl font-bold text-gray-900">{referralStats.totalRewards || 0}</p>
        </div>
      </div>

      {/* Loyalty Points by Branch */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Star className="w-5 h-5 text-primary-600" />
            Loyalty Points by Branch
          </h2>
        </div>
        <div className="p-6">
          {branchPoints.length === 0 ? (
            <div className="text-center py-8">
              <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No loyalty points yet</p>
              <p className="text-sm text-gray-400 mt-1">Start booking appointments to earn points!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {branchPoints.map((item) => (
                <div key={item.branchId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{getBranchName(item.branchId)}</p>
                    <p className="text-sm text-gray-500">
                      {item.updatedAt ? `Last updated: ${formatDate(item.updatedAt)}` : 'No updates yet'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-600">{item.loyaltyPoints || 0}</p>
                    <p className="text-xs text-gray-500">points</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Referral Codes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-green-600" />
            My Referral Codes
          </h2>
          <p className="text-sm text-gray-500 mt-1">Share your code with friends to earn rewards!</p>
        </div>
        <div className="p-6">
          {referralCodes.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No referral codes yet</p>
              <p className="text-sm text-gray-400 mt-1">Visit a branch to get your referral code</p>
            </div>
          ) : (
            <div className="space-y-4">
              {referralCodes.map((item) => (
                <div key={item.branchId} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">{getBranchName(item.branchId)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg font-mono text-lg font-semibold">
                      {item.referralCode}
                    </div>
                    <button
                      onClick={() => handleCopyCode(item.referralCode)}
                      className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                        copiedCode === item.referralCode
                          ? 'bg-green-100 text-green-700'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                      }`}
                    >
                      {copiedCode === item.referralCode ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Loyalty History */}
      {loyaltyHistory.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Recent Activity
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {loyaltyHistory.slice(0, 10).map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {item.action === 'EARN_LOYALTY_POINTS' ? (
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                        <Gift className="w-5 h-5 text-orange-600" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.action === 'EARN_LOYALTY_POINTS' ? 'Earned Points' : 'Redeemed Points'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {item.branchId ? getBranchName(item.branchId) : 'All Branches'} • {formatDate(item.timestamp)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${item.action === 'EARN_LOYALTY_POINTS' ? 'text-green-600' : 'text-orange-600'}`}>
                      {item.action === 'EARN_LOYALTY_POINTS' ? '+' : '-'}{item.points || 0}
                    </p>
                    <p className="text-xs text-gray-500">points</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientRewards;

