/**
 * Receptionist Clients Management Page
 * Module: M06 - CRM
 * Allows receptionists to view, search, and manage client profiles
 */

import { useState, useEffect } from 'react';
import { Search, UserPlus, Edit, Eye, History, Star } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getClients, searchClients, getClientProfile, updateClientProfile } from '../../services/clientService';
import { getLoyaltyPoints, getLoyaltyHistory } from '../../services/loyaltyService';
import { getServiceHistory } from '../../services/clientService';
import { getReferralCode } from '../../services/referralService';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SearchInput } from '../../components/ui/SearchInput';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';

const ReceptionistClients = () => {
  const { currentUser, userBranch } = useAuth();
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [clientProfile, setClientProfile] = useState(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [serviceHistory, setServiceHistory] = useState([]);
  const [loyaltyHistory, setLoyaltyHistory] = useState([]);
  const [referralCode, setReferralCode] = useState(null); // Branch-specific referral code
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (searchTerm.trim()) {
      handleSearch(searchTerm);
    } else {
      setFilteredClients(clients);
    }
  }, [searchTerm, clients]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const data = await getClients();
      setClients(data);
      setFilteredClients(data);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (term) => {
    try {
      const results = await searchClients(term);
      setFilteredClients(results);
    } catch (error) {
      console.error('Error searching clients:', error);
    }
  };

  const handleViewProfile = async (client) => {
    try {
      setLoadingProfile(true);
      setSelectedClient(client);
      setShowProfileModal(true);
      
      // Fetch CRM profile
      const profile = await getClientProfile(client.id);
      setClientProfile(profile);
      
      // Fetch loyalty points
      // Get loyalty points for current branch
      if (userBranch) {
        const points = await getLoyaltyPoints(client.id, userBranch);
        setLoyaltyPoints(points);
      } else {
        setLoyaltyPoints(0);
      }
      
      // Fetch service history
      const history = await getServiceHistory(client.id, 10);
      setServiceHistory(history);
      
      // Fetch loyalty history
      const loyalty = await getLoyaltyHistory(client.id, userBranch, 10);
      setLoyaltyHistory(loyalty);
      
      // Fetch referral code for current branch
      if (userBranch) {
        const code = await getReferralCode(client.id, userBranch);
        setReferralCode(code);
      } else {
        setReferralCode(null);
      }
    } catch (error) {
      console.error('Error loading client profile:', error);
      toast.error('Failed to load client profile');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleViewHistory = async (client) => {
    try {
      setLoadingProfile(true);
      setSelectedClient(client);
      setShowHistoryModal(true);
      
      const history = await getServiceHistory(client.id, 50);
      setServiceHistory(history);
      
      const loyalty = await getLoyaltyHistory(client.id, 50);
      setLoyaltyHistory(loyalty);
    } catch (error) {
      console.error('Error loading history:', error);
      toast.error('Failed to load history');
    } finally {
      setLoadingProfile(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Management</h1>
          <p className="text-gray-600">View and manage client profiles</p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <div className="p-4">
          <SearchInput
            placeholder="Search clients by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </Card>

      {/* Clients List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-6 py-4 text-center text-gray-500">
                    No clients found
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#2D1B4E] flex items-center justify-center text-white font-medium">
                          {client.firstName?.[0]?.toUpperCase() || 'C'}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {client.firstName} {client.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{client.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{client.phoneNumber || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewProfile(client)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Profile
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewHistory(client)}
                        >
                          <History className="h-4 w-4 mr-1" />
                          History
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Client Profile Modal */}
      <Modal
        isOpen={showProfileModal}
        onClose={() => {
          setShowProfileModal(false);
          setSelectedClient(null);
          setClientProfile(null);
        }}
        title={`Client Profile: ${selectedClient?.firstName} ${selectedClient?.lastName}`}
        size="lg"
      >
        {loadingProfile ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : clientProfile ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loyalty Points
                </label>
                <div className="text-2xl font-bold text-[#2D1B4E]">{loyaltyPoints}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Visits
                </label>
                <div className="text-2xl font-bold text-gray-900">{clientProfile.visitCount || 0}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Spent
                </label>
                <div className="text-lg font-semibold text-gray-900">
                  ₱{clientProfile.totalSpent?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referral Code {userBranch && <span className="text-xs text-gray-500">(for this branch)</span>}
                </label>
                <div className="text-sm font-mono text-gray-900">
                  {referralCode ? (
                    referralCode
                  ) : (
                    <span className="text-gray-400 italic">
                      {userBranch 
                        ? 'No referral code yet (client must visit this branch first)' 
                        : 'Branch not specified'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {clientProfile.allergies && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Allergies/Notes
                </label>
                <p className="text-sm text-gray-600">{clientProfile.allergies}</p>
              </div>
            )}
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Service History</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {serviceHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">No service history</p>
                ) : (
                  serviceHistory.map((entry) => (
                    <div key={entry.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <div className="text-sm font-medium">{entry.serviceName}</div>
                        <div className="text-xs text-gray-500">
                          {entry.date?.toLocaleDateString()} - {entry.stylistName}
                        </div>
                      </div>
                      <div className="text-sm font-semibold">₱{entry.price?.toFixed(2)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Profile not found
          </div>
        )}
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => {
          setShowHistoryModal(false);
          setSelectedClient(null);
        }}
        title={`History: ${selectedClient?.firstName} ${selectedClient?.lastName}`}
        size="lg"
      >
        {loadingProfile ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Service History</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {serviceHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">No service history</p>
                ) : (
                  serviceHistory.map((entry) => (
                    <div key={entry.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <div className="text-sm font-medium">{entry.serviceName}</div>
                        <div className="text-xs text-gray-500">
                          {entry.date?.toLocaleDateString()} - {entry.branchName} - {entry.stylistName}
                        </div>
                      </div>
                      <div className="text-sm font-semibold">₱{entry.price?.toFixed(2)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Loyalty Points History</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {loyaltyHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">No loyalty history</p>
                ) : (
                  loyaltyHistory.map((entry) => (
                    <div key={entry.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <div className="text-sm font-medium">{entry.description}</div>
                        <div className="text-xs text-gray-500">
                          {entry.createdAt?.toLocaleDateString()}
                        </div>
                      </div>
                      <div className={`text-sm font-semibold ${entry.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {entry.points > 0 ? '+' : ''}{entry.points} pts
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReceptionistClients;

