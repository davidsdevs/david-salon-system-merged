/**
 * Client Profile Page
 * Module: M06 - CRM
 * Allows clients to view their profile, loyalty points, service history, and referral code
 */

import { useState, useEffect } from 'react';
import { Star, Gift, History, Share2, Copy, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getClientProfile, getServiceHistory } from '../../services/clientService';
import { getLoyaltyPoints, getLoyaltyHistory, getAllBranchLoyaltyPoints } from '../../services/loyaltyService';
import { getAllReferralCodes } from '../../services/referralService';
import { getBranchById } from '../../services/branchService';
import { Card } from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const ClientProfile = () => {
  const { currentUser, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [branchLoyaltyPoints, setBranchLoyaltyPoints] = useState([]); // Array of { branchId, branchName, loyaltyPoints }
  const [serviceHistory, setServiceHistory] = useState([]);
  const [loyaltyHistory, setLoyaltyHistory] = useState([]);
  const [referralCodes, setReferralCodes] = useState([]); // Array of { branchId, branchName, referralCode }
  const [copiedCode, setCopiedCode] = useState(null); // Track which code was copied

  useEffect(() => {
    if (currentUser) {
      fetchProfile();
    }
  }, [currentUser]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      
      // Fetch CRM profile
      const clientProfile = await getClientProfile(currentUser.uid);
      setProfile(clientProfile);
      
      // Fetch loyalty points - branch-specific
      const allBranchPoints = await getAllBranchLoyaltyPoints(currentUser.uid);
      const totalPoints = allBranchPoints.reduce((sum, bp) => sum + (bp.loyaltyPoints || 0), 0);
      setLoyaltyPoints(totalPoints);
      
      // Fetch branch names for each branch points entry
      const branchPointsWithNames = await Promise.all(
        allBranchPoints.map(async (bp) => {
          try {
            const branch = await getBranchById(bp.branchId);
            return {
              ...bp,
              branchName: branch?.name || branch?.branchName || `Branch ${bp.branchId.slice(0, 8)}`
            };
          } catch (error) {
            console.error(`Error fetching branch ${bp.branchId}:`, error);
            return {
              ...bp,
              branchName: `Branch ${bp.branchId.slice(0, 8)}`
            };
          }
        })
      );
      setBranchLoyaltyPoints(branchPointsWithNames);
      
      // Fetch referral codes (branch-specific)
      const codes = await getAllReferralCodes(currentUser.uid);
      // Fetch branch names for each referral code
      const codesWithNames = await Promise.all(
        codes.map(async (codeData) => {
          try {
            const branch = await getBranchById(codeData.branchId);
            return {
              ...codeData,
              branchName: branch?.name || branch?.branchName || `Branch ${codeData.branchId.slice(0, 8)}`
            };
          } catch (error) {
            console.error(`Error fetching branch ${codeData.branchId}:`, error);
            return {
              ...codeData,
              branchName: `Branch ${codeData.branchId.slice(0, 8)}`
            };
          }
        })
      );
      setReferralCodes(codesWithNames);
      
      // Fetch service history
      const history = await getServiceHistory(currentUser.uid, 20);
      setServiceHistory(history);
      
      // Fetch loyalty history
      const loyalty = await getLoyaltyHistory(currentUser.uid, 20);
      setLoyaltyHistory(loyalty);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReferralCode = (code, branchName) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Referral code for ${branchName} copied!`);
    setTimeout(() => setCopiedCode(null), 2000);
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
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-600">View your loyalty points, service history, and more</p>
      </div>

      {/* Loyalty Points Card */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Loyalty Points</h2>
              <div className="flex items-center gap-2">
                <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
                <span className="text-4xl font-bold text-[#2D1B4E]">{loyaltyPoints}</span>
                <span className="text-sm text-gray-500">(Total)</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                1 point = ₱1 discount. Points are branch-specific and can only be used at the branch where they were earned.
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Total Visits</div>
              <div className="text-2xl font-bold text-gray-900">{profile?.visitCount || 0}</div>
              <div className="text-sm text-gray-500 mt-2">Total Spent</div>
              <div className="text-lg font-semibold text-gray-900">
                ₱{profile?.totalSpent?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>
          
          {/* Branch-Specific Points Breakdown */}
          {branchLoyaltyPoints.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Points by Branch</h3>
              <div className="space-y-2">
                {branchLoyaltyPoints.map((bp) => (
                  <div key={bp.branchId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{bp.branchName}</div>
                      <div className="text-xs text-gray-500">Branch-specific points</div>
                    </div>
                    <div className="text-lg font-semibold text-[#2D1B4E]">
                      {bp.loyaltyPoints || 0} pts
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Referral Codes Card */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Referral Program</h2>
              <p className="text-sm text-gray-600">
                Share your referral code with friends and earn rewards when they sign up at the same branch!
                <br />
                <span className="text-xs text-gray-500">You can only refer people to branches you've visited.</span>
              </p>
            </div>
            <Gift className="h-16 w-16 text-[#2D1B4E] opacity-20" />
          </div>
          
          {referralCodes.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-500 mb-2">No referral codes available yet</p>
              <p className="text-xs text-gray-400">
                Visit a branch and make a purchase to generate your referral code for that branch.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {referralCodes.map((codeData) => (
                <div key={codeData.branchId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{codeData.branchName}</div>
                    <div className="text-xs text-gray-500 mt-1">Branch-specific referral code</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-2 bg-white border border-gray-300 rounded-lg font-mono text-sm font-semibold">
                      {codeData.referralCode}
                    </div>
                    <button
                      onClick={() => handleCopyReferralCode(codeData.referralCode, codeData.branchName)}
                      className="px-3 py-2 bg-[#2D1B4E] text-white rounded-lg hover:bg-[#3d2a5f] transition-colors flex items-center gap-2"
                    >
                      {copiedCode === codeData.referralCode ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
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
      </Card>

      {/* Service History */}
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Service History</h2>
          </div>
          <div className="space-y-3">
            {serviceHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No service history yet</p>
            ) : (
              serviceHistory.map((entry) => (
                <div key={entry.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{entry.serviceName}</div>
                    <div className="text-sm text-gray-500">
                      {entry.date?.toLocaleDateString()} • {entry.branchName} • {entry.stylistName}
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    ₱{entry.price?.toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Loyalty Points History */}
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Loyalty Points History</h2>
          </div>
          <div className="space-y-3">
            {loyaltyHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No loyalty points history yet</p>
            ) : (
              loyaltyHistory.map((entry) => (
                <div key={entry.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{entry.description}</div>
                    <div className="text-sm text-gray-500">
                      {entry.createdAt?.toLocaleDateString()}
                    </div>
                  </div>
                  <div className={`text-lg font-semibold ${entry.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {entry.points > 0 ? '+' : ''}{entry.points} pts
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ClientProfile;

