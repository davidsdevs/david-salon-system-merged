/**
 * Client Dashboard
 * Shows upcoming appointments, loyalty points, referrals, and quick actions
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Star, Users, Gift, ChevronRight, Plus, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getAppointmentsByClient,
  APPOINTMENT_STATUS 
} from '../../services/appointmentService';
import { getAllBranchLoyaltyPoints } from '../../services/loyaltyService';
import { getAllReferralCodes, getReferralStats } from '../../services/referralService';
import { formatDate, formatTime, getFullName } from '../../utils/helpers';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { ROUTES } from '../../utils/constants';

const ClientDashboard = () => {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [referralCount, setReferralCount] = useState(0);
  const [nextAppointment, setNextAppointment] = useState(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);

  useEffect(() => {
    if (currentUser?.uid) {
      fetchDashboardData();
    }
  }, [currentUser]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [appointmentsData, pointsData, codesData] = await Promise.all([
        getAppointmentsByClient(currentUser.uid),
        getAllBranchLoyaltyPoints(currentUser.uid),
        getAllReferralCodes(currentUser.uid)
      ]);

      setAppointments(appointmentsData);

      // Calculate total loyalty points
      const total = pointsData.reduce((sum, item) => sum + (item.loyaltyPoints || 0), 0);
      setTotalPoints(total);

      // Get referral count
      setReferralCount(codesData.length);

      // Find next appointment
      const now = new Date();
      const upcoming = appointmentsData
        .filter(apt => {
          const aptDate = new Date(apt.appointmentDate);
          return aptDate >= now && 
                 apt.status !== APPOINTMENT_STATUS.COMPLETED && 
                 apt.status !== APPOINTMENT_STATUS.CANCELLED;
        })
        .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));

      setNextAppointment(upcoming[0] || null);
      setUpcomingAppointments(upcoming.slice(0, 3));

      // Fetch referral stats
      try {
        const stats = await getReferralStats(currentUser.uid);
        setReferralCount(stats?.totalReferrals || codesData.length);
      } catch (error) {
        console.error('Error fetching referral stats:', error);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case APPOINTMENT_STATUS.PENDING:
      case APPOINTMENT_STATUS.CONFIRMED:
        return 'bg-blue-100 text-blue-700';
      case APPOINTMENT_STATUS.IN_SERVICE:
        return 'bg-purple-100 text-purple-700';
      case APPOINTMENT_STATUS.COMPLETED:
        return 'bg-green-100 text-green-700';
      case APPOINTMENT_STATUS.CANCELLED:
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status) => {
    return status?.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'Unknown';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
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
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">
          {getGreeting()}, {userData?.firstName || 'Client'}!
        </h1>
        <p className="text-primary-100">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Loyalty Points</p>
              <p className="text-2xl font-bold text-gray-900">{totalPoints.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">{membershipTier.icon} {membershipTier.name}</p>
            </div>
            <div className="p-3 bg-primary-100 rounded-full">
              <Star className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Upcoming</p>
              <p className="text-2xl font-bold text-blue-600">{upcomingAppointments.length}</p>
              <p className="text-xs text-gray-500 mt-1">appointments</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Referrals</p>
              <p className="text-2xl font-bold text-green-600">{referralCount}</p>
              <p className="text-xs text-gray-500 mt-1">codes shared</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Visits</p>
              <p className="text-2xl font-bold text-purple-600">
                {appointments.filter(apt => apt.status === APPOINTMENT_STATUS.COMPLETED).length}
              </p>
              <p className="text-xs text-gray-500 mt-1">completed</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Gift className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Next Appointment Card */}
      {nextAppointment && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-600" />
            Next Appointment
          </h2>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="font-medium text-gray-900 text-lg">
                {nextAppointment.branchName || 'Salon'}
              </p>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(nextAppointment.appointmentDate)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatTime(nextAppointment.appointmentDate)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {nextAppointment.services?.map((service, idx) => (
                  <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                    {service.serviceName}
                  </span>
                )) || (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                    {nextAppointment.serviceName || 'Service'}
                  </span>
                )}
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(nextAppointment.status)}`}>
              {getStatusLabel(nextAppointment.status)}
            </span>
          </div>
        </div>
      )}

      {/* Upcoming Appointments */}
      {upcomingAppointments.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h2>
            <button
              onClick={() => navigate('/client/appointments')}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
            >
              View All
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="divide-y divide-gray-100">
            {upcomingAppointments.map((appointment) => (
              <div key={appointment.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[60px]">
                      <p className="text-lg font-semibold text-gray-900">
                        {formatTime(appointment.appointmentDate)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(appointment.appointmentDate)}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {appointment.branchName || 'Salon'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {appointment.services?.map(s => s.serviceName).join(', ') || appointment.serviceName || 'Service'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                    {getStatusLabel(appointment.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/client/appointments')}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:border-primary-300 hover:shadow transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Plus className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Book Appointment</p>
              <p className="text-sm text-gray-500">Schedule your next visit</p>
            </div>
          </div>
        </button>
        
        <button
          onClick={() => navigate('/client/products')}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:border-primary-300 hover:shadow transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Browse Products</p>
              <p className="text-sm text-gray-500">View our product catalog</p>
            </div>
          </div>
        </button>
        
        <button
          onClick={() => navigate('/client/rewards')}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:border-primary-300 hover:shadow transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Gift className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">View Rewards</p>
              <p className="text-sm text-gray-500">Check your points & referrals</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default ClientDashboard;
