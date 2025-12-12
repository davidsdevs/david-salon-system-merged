/**
 * Branch Manager Client Analytics Page
 * Module: M06 - CRM
 * Provides client segmentation, satisfaction ratings, and loyalty analytics
 */

import { useState, useEffect } from 'react';
import { TrendingUp, Users, Star, Banknote, Award } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getClients, getServiceHistory } from '../../services/clientService';
import { getBranchFeedbackStats } from '../../services/feedbackService';
import { Card } from '../../components/ui/Card';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const ClientAnalytics = () => {
  const { userBranch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [segmentation, setSegmentation] = useState({
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0
  });
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [topClients, setTopClients] = useState([]);
  const [avgMetrics, setAvgMetrics] = useState({
    avgSpend: 0,
    avgVisits: 0,
    totalRevenue: 0
  });

  useEffect(() => {
    if (userBranch) {
      fetchAnalytics();
    }
  }, [userBranch]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch all clients
      const allClients = await getClients();
      
      // Filter clients who have visited this branch (based on service history)
      const branchClients = [];
      const clientSegments = [];
      const segCounts = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
      let totalSpent = 0;
      let totalVisits = 0;
      
      // Check each client's service history to see if they've visited this branch
      for (const client of allClients) {
        const history = await getServiceHistory(client.id, 1000); // Get all history
        const branchHistory = history.filter(h => h.branchId === userBranch);
        
        // Only include clients who have visited this branch
        if (branchHistory.length > 0) {
          branchClients.push(client);
          
          // Calculate segmentation based on this branch's visits only
          const branchSpent = branchHistory.reduce((sum, h) => sum + (h.price || 0), 0);
          const branchVisits = branchHistory.length;
          
          // Determine tier based on branch-specific data
          let tier = 'Bronze';
          if (branchVisits >= 20 || branchSpent >= 50000) {
            tier = 'Platinum';
          } else if (branchVisits >= 10 || branchSpent >= 25000) {
            tier = 'Gold';
          } else if (branchVisits >= 5 || branchSpent >= 10000) {
            tier = 'Silver';
          }
          
          const seg = {
            tier,
            visitFrequency: branchVisits,
            avgSpend: branchVisits > 0 ? branchSpent / branchVisits : 0,
            totalSpent: branchSpent,
            preferredServices: [],
            lastVisit: branchHistory[0]?.date
          };
          
          clientSegments.push({ client, segmentation: seg });
          segCounts[tier.toLowerCase()]++;
          totalSpent += branchSpent;
          totalVisits += branchVisits;
        }
      }
      
      setClients(branchClients);
      
      setSegmentation(segCounts);
      
      // Get top clients by spending
      const sortedClients = clientSegments
        .sort((a, b) => (b.segmentation.totalSpent || 0) - (a.segmentation.totalSpent || 0))
        .slice(0, 10);
      setTopClients(sortedClients);
      
      // Calculate averages
      const clientCount = branchClients.length || 1;
      setAvgMetrics({
        avgSpend: totalSpent / clientCount,
        avgVisits: totalVisits / clientCount,
        totalRevenue: totalSpent
      });
      
      // Fetch feedback stats
      const stats = await getBranchFeedbackStats(userBranch);
      setFeedbackStats(stats);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
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
        <h1 className="text-2xl font-bold text-gray-900">Client Analytics</h1>
        <p className="text-gray-600">Client segmentation, satisfaction, and loyalty insights</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Clients</p>
                <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
              </div>
              <Users className="h-8 w-8 text-[#2D1B4E] opacity-50" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₱{avgMetrics.totalRevenue.toFixed(2)}
                </p>
              </div>
              <Banknote className="h-8 w-8 text-green-600 opacity-50" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg. Spend</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₱{avgMetrics.avgSpend.toFixed(2)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600 opacity-50" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg. Visits</p>
                <p className="text-2xl font-bold text-gray-900">
                  {avgMetrics.avgVisits.toFixed(1)}
                </p>
              </div>
              <Award className="h-8 w-8 text-yellow-600 opacity-50" />
            </div>
          </div>
        </Card>
      </div>

      {/* Client Segmentation */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Client Segmentation</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-amber-50 rounded-lg">
              <div className="text-3xl font-bold text-amber-700">{segmentation.bronze}</div>
              <div className="text-sm text-amber-600 mt-1">Bronze</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-gray-700">{segmentation.silver}</div>
              <div className="text-sm text-gray-600 mt-1">Silver</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-3xl font-bold text-yellow-700">{segmentation.gold}</div>
              <div className="text-sm text-yellow-600 mt-1">Gold</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-700">{segmentation.platinum}</div>
              <div className="text-sm text-purple-600 mt-1">Platinum</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Feedback Statistics */}
      {feedbackStats && feedbackStats.totalFeedback > 0 && (
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-5 w-5 text-yellow-500" />
              <h2 className="text-lg font-semibold text-gray-900">Client Satisfaction</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Overall Rating</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900">
                    {feedbackStats.averageOverallRating}
                  </span>
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Stylist Rating</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900">
                    {feedbackStats.averageStylistRating}
                  </span>
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Service Rating</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900">
                    {feedbackStats.averageServiceRating}
                  </span>
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Recommendation Rate</p>
                <div className="mt-1">
                  <span className="text-2xl font-bold text-gray-900">
                    {feedbackStats.recommendationRate}%
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              Based on {feedbackStats.totalFeedback} feedback submissions
            </div>
          </div>
        </Card>
      )}

      {/* Top Clients */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Clients by Spending</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Visits
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total Spent
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topClients.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-4 text-center text-gray-500">
                      No client data available
                    </td>
                  </tr>
                ) : (
                  topClients.map(({ client, segmentation: seg }, index) => (
                    <tr key={client.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[#2D1B4E] flex items-center justify-center text-white text-xs font-medium">
                            {index + 1}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {client.firstName} {client.lastName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                          seg.tier === 'Platinum' ? 'bg-purple-100 text-purple-700' :
                          seg.tier === 'Gold' ? 'bg-yellow-100 text-yellow-700' :
                          seg.tier === 'Silver' ? 'bg-gray-100 text-gray-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {seg.tier}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {seg.visitFrequency}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ₱{seg.totalSpent?.toFixed(2) || '0.00'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ClientAnalytics;

