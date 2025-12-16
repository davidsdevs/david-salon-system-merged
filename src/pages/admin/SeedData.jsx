/**
 * Seed Data Page
 * Preview stylists and services before seeding
 */

import { useState, useEffect } from 'react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { ChevronDown, ChevronUp, User, Scissors } from 'lucide-react';

const BRANCH_ID = 'KYiL9JprSX3LBOYzrF6e';

const SeedData = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stylistsData, setStylistsData] = useState([]);
  const [servicesData, setServicesData] = useState([]);
  const [branchData, setBranchData] = useState(null);
  const [error, setError] = useState(null);
  const [expandedStylists, setExpandedStylists] = useState(new Set());
  const [seeding, setSeeding] = useState(false);
  const [seedResults, setSeedResults] = useState(null);

  // Fetch stylists and services data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch branch data
        const branchRef = doc(db, 'branches', BRANCH_ID);
        const branchSnap = await getDoc(branchRef);
        if (branchSnap.exists()) {
          setBranchData({
            id: branchSnap.id,
            ...branchSnap.data()
          });
        } else {
          throw new Error('Branch not found');
        }
        
        // Fetch stylists
        const usersRef = collection(db, 'users');
        const stylistsQuery = query(
          usersRef,
          where('branchId', '==', BRANCH_ID),
          where('role', '==', 'stylist')
        );
        const stylistsSnapshot = await getDocs(stylistsQuery);
        const stylists = stylistsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Fetch services
        const servicesRef = collection(db, 'services');
        const servicesQuery = query(servicesRef, where('isActive', '==', true));
        const servicesSnapshot = await getDocs(servicesQuery);
        const allServices = servicesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Filter to only those offered by this branch
        const branchServices = allServices.filter(service => {
          const branchPricing = service.branchPricing || {};
          return branchPricing[BRANCH_ID] !== undefined;
        });
        
        setServicesData(branchServices);
        
        // Enrich stylists with service names
        const enrichedStylists = stylists.map(stylist => {
          const serviceIds = stylist.service_id || stylist.serviceId || [];
          const services = serviceIds.map(serviceId => {
            const service = branchServices.find(s => s.id === serviceId);
            return service ? {
              id: service.id,
              name: service.name || service.serviceName,
              price: service.branchPricing?.[BRANCH_ID] || service.price || 0,
              duration: service.duration || 60
            } : null;
          }).filter(Boolean);
          
          return {
            ...stylist,
            services: services,
            serviceCount: services.length,
            serviceIds: serviceIds
          };
        });
        
        setStylistsData(enrichedStylists);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error.message || 'Failed to load data');
        toast.error('Failed to load data: ' + error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const toggleStylist = (stylistId) => {
    const newExpanded = new Set(expandedStylists);
    if (newExpanded.has(stylistId)) {
      newExpanded.delete(stylistId);
    } else {
      newExpanded.add(stylistId);
    }
    setExpandedStylists(newExpanded);
  };

  const handleSeedAppointments = async () => {
    if (!window.confirm('This will create test appointments. Are you sure you want to continue?')) {
      return;
    }

    try {
      setSeeding(true);
      setSeedResults(null);
      
      // Dynamically import and run the seed function
      const { seedAppointments } = await import('../../utils/seedAppointments');
      const appointments = await seedAppointments();
      
      setSeedResults({
        success: true,
        message: `Successfully created ${appointments.length} appointments`,
        count: appointments.length
      });
      
      toast.success(`Created ${appointments.length} appointments successfully!`);
      
      // Refresh data after seeding
      window.location.reload();
    } catch (error) {
      console.error('Error seeding appointments:', error);
      setSeedResults({
        success: false,
        message: error.message || 'Failed to seed appointments',
        count: 0
      });
      toast.error('Failed to seed appointments: ' + error.message);
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-gray-600">Loading stylists and services...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Error loading data:</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Preview Stylists & Services</h1>
        
        {/* Branch Info */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 mb-1">Branch:</p>
              <p className="font-semibold text-blue-900 text-lg">
                {branchData?.name || branchData?.branchName || 'Unknown Branch'}
              </p>
              <p className="text-xs text-blue-500 mt-1">ID: {BRANCH_ID}</p>
            </div>
            <div className="text-right">
              <div className="bg-white rounded-lg px-4 py-2 border border-blue-300">
                <p className="text-xs text-blue-600 mb-1">Total Stylists</p>
                <p className="text-2xl font-bold text-blue-900">{stylistsData.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Total Services</p>
            <p className="text-2xl font-bold text-gray-900">{servicesData.length}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-600 mb-1">Stylists with Services</p>
            <p className="text-2xl font-bold text-green-900">
              {stylistsData.filter(s => s.serviceCount > 0).length}
            </p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-600 mb-1">Stylists without Services</p>
            <p className="text-2xl font-bold text-yellow-900">
              {stylistsData.filter(s => s.serviceCount === 0).length}
            </p>
          </div>
        </div>

        {/* Stylists List */}
        {stylistsData.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">⚠️ No stylists found in this branch</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Stylists ({stylistsData.length})
            </h2>
            
            {stylistsData.map((stylist) => {
              const isExpanded = expandedStylists.has(stylist.id);
              const hasServices = stylist.serviceCount > 0;
              
              return (
                <div
                  key={stylist.id}
                  className={`border rounded-lg transition-all ${
                    hasServices
                      ? 'border-green-200 bg-green-50'
                      : 'border-yellow-200 bg-yellow-50'
                  }`}
                >
                  <button
                    onClick={() => toggleStylist(stylist.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-opacity-80 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 text-left">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        hasServices ? 'bg-green-200' : 'bg-yellow-200'
                      }`}>
                        <User className={`w-5 h-5 ${
                          hasServices ? 'text-green-700' : 'text-yellow-700'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {stylist.firstName} {stylist.lastName}
                        </p>
                        <p className="text-xs text-gray-500">ID: {stylist.id}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 text-sm rounded-full font-medium ${
                          hasServices
                            ? 'bg-green-200 text-green-700'
                            : 'bg-yellow-200 text-yellow-700'
                        }`}>
                          {stylist.serviceCount} service{stylist.serviceCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-200 pt-4">
                      {stylist.services.length > 0 ? (
                        <div>
                          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                            <Scissors className="w-4 h-4" />
                            Services Offered:
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {stylist.services.map((service) => (
                              <div
                                key={service.id}
                                className="bg-white border border-gray-200 rounded-lg p-3"
                              >
                                <p className="font-medium text-gray-900 text-sm mb-1">
                                  {service.name}
                                </p>
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                  <span>₱{service.price.toLocaleString()}</span>
                                  <span>{service.duration} min</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">ID: {service.id}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-yellow-800 text-sm">
                            ⚠️ No services assigned - will be auto-assigned during seeding
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* All Services List */}
        {servicesData.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Scissors className="w-5 h-5" />
              All Available Services ({servicesData.length})
            </h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {servicesData.map((service) => {
                  const hasStylist = stylistsData.some(stylist => {
                    const serviceIds = stylist.service_id || stylist.serviceId || [];
                    return serviceIds.includes(service.id);
                  });
                  
                  return (
                    <div
                      key={service.id}
                      className={`p-3 rounded-lg border ${
                        hasStylist
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <p className={`text-sm font-medium ${
                          hasStylist ? 'text-green-900' : 'text-red-900'
                        }`}>
                          {service.name || service.serviceName}
                        </p>
                        {!hasStylist && (
                          <span className="text-red-600 text-xs">⚠️</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        ₱{(service.branchPricing?.[BRANCH_ID] || service.price || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {hasStylist ? '✓ Has stylist' : 'No stylist - will be auto-assigned'}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-300 flex items-center gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 bg-green-200 border border-green-300 rounded"></span>
                  <span>Has stylist</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 bg-red-200 border border-red-300 rounded"></span>
                  <span>No stylist (will be auto-assigned)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Seed Appointments Section */}
        <div className="mt-8 border-2 border-primary-500 rounded-lg p-6 bg-primary-50">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Seed Appointments</h2>
          <p className="text-gray-600 mb-4">
            This will create test appointments for branch <code className="bg-white px-2 py-1 rounded">{BRANCH_ID}</code>:
          </p>
          <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
            <li>15 past appointments (7-30 days ago) - completed, cancelled, no-show</li>
            <li>10 recent past appointments (1-6 days ago) - mostly completed</li>
            <li>8 today's appointments - pending, confirmed, in_service</li>
            <li>20 future appointments (1-30 days ahead) - pending and confirmed</li>
            <li>5 multi-service appointments</li>
          </ul>
          <p className="text-sm text-gray-500 mb-4">
            All appointments will be created as guest clients. Stylists will be automatically assigned based on their <code className="bg-white px-1 rounded">service_id</code> array. Services will be automatically assigned to stylists if needed.
          </p>
          
          <button
            onClick={handleSeedAppointments}
            disabled={seeding || loading}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {seeding && <LoadingSpinner size="sm" />}
            {seeding ? 'Seeding Appointments...' : 'Seed Appointments'}
          </button>

          {seedResults && (
            <div className={`mt-4 p-4 rounded-lg ${
              seedResults.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <p className={`font-medium ${
                seedResults.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {seedResults.message}
              </p>
              {seedResults.success && (
                <p className="text-sm text-green-600 mt-2">
                  Check the appointments page to see the seeded data.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Information:</h3>
          <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
            <li>This page shows all stylists in branch <code className="bg-blue-100 px-1 rounded">{BRANCH_ID}</code></li>
            <li>Click on a stylist to view their assigned services</li>
            <li>Services without stylists will be automatically assigned during seeding</li>
            <li>Stylists without services will be automatically assigned 2-3 random services during seeding</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SeedData;
