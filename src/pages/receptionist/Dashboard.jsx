/**
 * Receptionist Dashboard
 * Central hub for today's operations - appointments, arrivals queue, and billing
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  Clock, 
  Play, 
  Receipt, 
  UserPlus,
  ArrowRight,
  Timer,
  Banknote
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../utils/constants';
import { 
  getAppointmentsByDateRange, 
  APPOINTMENT_STATUS 
} from '../../services/appointmentService';
import { 
  getArrivalsByBranch, 
  ARRIVAL_STATUS 
} from '../../services/arrivalsService';
import { getDailySalesSummary } from '../../services/billingService';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const ReceptionistDashboard = () => {
  const navigate = useNavigate();
  const { userBranch, userBranchData } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    upcomingAppointments: 0,
    arrivedClients: 0,
    inServiceClients: 0,
    completedToday: 0,
    todaysRevenue: 0,
    totalTransactions: 0
  });
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [arrivedQueue, setArrivedQueue] = useState([]);
  const [inServiceQueue, setInServiceQueue] = useState([]);

  useEffect(() => {
    if (userBranch) {
      fetchDashboardData();
    }
  }, [userBranch]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch today's appointments
      const appointmentsData = await getAppointmentsByDateRange(userBranch, today, tomorrow);
      
      // Filter upcoming confirmed appointments (not checked in yet)
      const arrivalsData = await getArrivalsByBranch(userBranch, today, tomorrow);
      
      // Get checked-in appointment IDs
      const checkedInAppointmentIds = new Set(
        arrivalsData
          .filter(arr => !arr.isWalkIn && arr.appointmentId)
          .map(arr => arr.appointmentId)
      );

      // Upcoming appointments (confirmed, not checked in)
      const upcoming = appointmentsData
        .filter(apt => 
          apt.status === APPOINTMENT_STATUS.CONFIRMED &&
          !checkedInAppointmentIds.has(apt.id)
        )
        .sort((a, b) => {
          const dateA = a.appointmentDate?.toDate ? a.appointmentDate.toDate() : new Date(a.appointmentDate);
          const dateB = b.appointmentDate?.toDate ? b.appointmentDate.toDate() : new Date(b.appointmentDate);
          return dateA - dateB;
        })
        .slice(0, 5); // Show top 5

      // Active arrivals
      const arrived = arrivalsData
        .filter(arr => arr.status === ARRIVAL_STATUS.ARRIVED)
        .sort((a, b) => {
          const dateA = a.arrivedAt?.toDate ? a.arrivedAt.toDate() : new Date(a.arrivedAt);
          const dateB = b.arrivedAt?.toDate ? b.arrivedAt.toDate() : new Date(b.arrivedAt);
          return dateA - dateB;
        });

      const inService = arrivalsData
        .filter(arr => arr.status === ARRIVAL_STATUS.IN_SERVICE)
        .sort((a, b) => {
          const dateA = a.startedAt?.toDate ? a.startedAt.toDate() : new Date(a.startedAt || a.arrivedAt);
          const dateB = b.startedAt?.toDate ? b.startedAt.toDate() : new Date(b.startedAt || b.arrivedAt);
          return dateA - dateB;
        });

      const completed = arrivalsData.filter(arr => arr.status === ARRIVAL_STATUS.COMPLETED);

      // Fetch billing summary
      let dailySummary = { netRevenue: 0, totalTransactions: 0 };
      try {
        dailySummary = await getDailySalesSummary(userBranch) || { netRevenue: 0, totalTransactions: 0 };
      } catch (error) {
        console.error('Error fetching daily summary:', error);
      }

      setStats({
        upcomingAppointments: upcoming.length,
        arrivedClients: arrived.length,
        inServiceClients: inService.length,
        completedToday: completed.length,
        todaysRevenue: dailySummary.netRevenue || 0,
        totalTransactions: dailySummary.totalTransactions || 0
      });

      setUpcomingAppointments(upcoming);
      setArrivedQueue(arrived.slice(0, 5));
      setInServiceQueue(inService.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeUntil = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffMs = date - now;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 0) {
      return `${Math.abs(diffMins)}m late`;
    } else if (diffMins < 60) {
      return `in ${diffMins}m`;
    } else {
      const hours = Math.floor(diffMins / 60);
      return `in ${hours}h`;
    }
  };

  const getWaitTime = (arrivedAt) => {
    if (!arrivedAt) return 0;
    const now = new Date();
    const arrived = arrivedAt.toDate ? arrivedAt.toDate() : new Date(arrivedAt);
    return Math.floor((now - arrived) / 60000);
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm md:text-base text-gray-600">Overview of today's operations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate(ROUTES.RECEPTIONIST_ARRIVALS)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700"
          >
            <UserPlus className="w-4 h-4" />
            Add Walk-in
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card 
          className="p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate(ROUTES.RECEPTIONIST_ARRIVALS)}
        >
          <div className="flex items-center">
            <Users className="h-8 w-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Waiting</p>
              <p className="text-xl font-bold text-gray-900">{stats.arrivedClients}</p>
            </div>
          </div>
        </Card>

        <Card 
          className="p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate(ROUTES.RECEPTIONIST_ARRIVALS)}
        >
          <div className="flex items-center">
            <Play className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">In Service</p>
              <p className="text-xl font-bold text-gray-900">{stats.inServiceClients}</p>
            </div>
          </div>
        </Card>

        <Card 
          className="p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate(ROUTES.RECEPTIONIST_ARRIVALS)}
        >
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Upcoming</p>
              <p className="text-xl font-bold text-gray-900">{stats.upcomingAppointments}</p>
            </div>
          </div>
        </Card>

        <Card 
          className="p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate(ROUTES.RECEPTIONIST_BILLING)}
        >
          <div className="flex items-center">
            <Banknote className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
              <p className="text-xl font-bold text-gray-900">₱{stats.todaysRevenue?.toLocaleString() || '0'}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content - Two Columns (Prioritize Active Operations) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Waiting Queue - Priority */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
            <h2 className="font-semibold text-gray-900">Waiting Queue</h2>
            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
              {stats.arrivedClients}
            </span>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {arrivedQueue.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No clients waiting</p>
              </div>
            ) : (
              arrivedQueue.map((arrival) => {
                const waitTime = getWaitTime(arrival.arrivedAt);
                const isLongWait = waitTime > 15;
                
                return (
                  <div 
                    key={arrival.id} 
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(ROUTES.RECEPTIONIST_ARRIVALS)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900">{arrival.clientName}</p>
                          {arrival.isWalkIn && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Walk-in
                            </span>
                          )}
                          {waitTime > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <Timer className="h-3 w-3" />
                              {waitTime} min
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">{arrival.serviceName || 'Multiple services'}</p>
                      </div>
                      <Button
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(ROUTES.RECEPTIONIST_ARRIVALS);
                        }}
                      >
                        <Play className="w-4 h-4 mr-1.5" />
                        Start
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {stats.arrivedClients > 5 && (
            <div className="p-3 border-t bg-gray-50">
              <button 
                onClick={() => navigate(ROUTES.RECEPTIONIST_ARRIVALS)}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium w-full text-center"
              >
                View all {stats.arrivedClients} waiting →
              </button>
            </div>
          )}
        </Card>

        {/* In Service - Priority */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
            <h2 className="font-semibold text-gray-900">In Service</h2>
            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
              {stats.inServiceClients}
            </span>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {inServiceQueue.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Play className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No clients in service</p>
              </div>
            ) : (
              inServiceQueue.map((arrival) => {
                const serviceTime = getWaitTime(arrival.startedAt || arrival.arrivedAt);
                
                return (
                  <div 
                    key={arrival.id} 
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(ROUTES.RECEPTIONIST_ARRIVALS)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 mb-1">{arrival.clientName}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-600 mb-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {serviceTime}m
                          </span>
                          <span className="truncate">{arrival.serviceName || 'Multiple services'}</span>
                        </div>
                        {arrival.stylistName && (
                          <p className="text-xs text-purple-600 font-medium">{arrival.stylistName}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(ROUTES.RECEPTIONIST_ARRIVALS);
                        }}
                      >
                        <Receipt className="w-4 h-4 mr-1.5" />
                        Checkout
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {stats.inServiceClients > 5 && (
            <div className="p-3 border-t bg-gray-50">
              <button 
                onClick={() => navigate(ROUTES.RECEPTIONIST_ARRIVALS)}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium w-full text-center"
              >
                View all {stats.inServiceClients} in service →
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* Upcoming Appointments - Simplified */}
      {upcomingAppointments.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Upcoming Appointments</h2>
            </div>
            <button 
              onClick={() => navigate(ROUTES.RECEPTIONIST_APPOINTMENTS)}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              View All →
            </button>
          </div>
          <div className="divide-y">
            {upcomingAppointments.slice(0, 3).map((apt) => {
              const timeUntil = getTimeUntil(apt.appointmentDate);
              const isLate = timeUntil.includes('late');
              
              return (
                <div 
                  key={apt.id} 
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(ROUTES.RECEPTIONIST_ARRIVALS)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 mb-1">{apt.clientName}</p>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatTime(apt.appointmentDate)}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          isLate ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {timeUntil}
                        </span>
                        <span className="truncate">{apt.serviceName || 'Multiple services'}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

export default ReceptionistDashboard;
