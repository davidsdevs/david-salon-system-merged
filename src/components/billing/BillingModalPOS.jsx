/**
 * POS-Style Billing Modal Component
 * Design matches modern POS interface
 */

import { useState, useEffect } from 'react';
import { X, DollarSign, Tag, Search, CreditCard, Wallet, Gift, Scissors, Package, Banknote, Smartphone, Star } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import { PAYMENT_METHODS, calculateBillTotals } from '../../services/billingService';
import { getLoyaltyPoints } from '../../services/loyaltyService';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const BillingModalPOS = ({
  isOpen,
  appointment,
  onClose,
  onSubmit,
  loading,
  services = [],
  stylists = [],
  clients = [],
  mode = 'billing' // 'billing' or 'start-service'
}) => {
  const { userBranch } = useAuth();
  const [formData, setFormData] = useState({
    items: [], // Each item will have: { id, name, price, basePrice, stylistId, stylistName, clientType, adjustment, adjustmentReason }
    discountType: 'fixed',
    discount: '',
    loyaltyPointsUsed: '',
    paymentMethod: PAYMENT_METHODS.CASH,
    paymentReference: '',
    notes: '',
    amountReceived: '',
    tax: '',
    // Client info for walk-in customers
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    clientId: ''
  });

  const [totals, setTotals] = useState({
    subtotal: 0,
    discount: 0,
    serviceCharge: 0,
    tax: 0,
    total: 0
  });

  const [serviceSearch, setServiceSearch] = useState('');
  const [salePanelWidth, setSalePanelWidth] = useState(384); // 384px = w-96
  const [isResizing, setIsResizing] = useState(false);
  const [matchedClient, setMatchedClient] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientList, setShowClientList] = useState(false);
  const [activeTab, setActiveTab] = useState('service'); // 'service' or 'product'
  const [clientLoyaltyPoints, setClientLoyaltyPoints] = useState(0);
  
  // Mock products data (similar to old project)
  const [availableProducts] = useState([
    { id: 'prod-1', name: 'Shampoo', price: 200, stock: 50 },
    { id: 'prod-2', name: 'Conditioner', price: 250, stock: 30 },
    { id: 'prod-3', name: 'Hair Oil', price: 300, stock: 25 },
    { id: 'prod-4', name: 'Styling Gel', price: 180, stock: 40 },
    { id: 'prod-5', name: 'Hair Mask', price: 350, stock: 20 },
    { id: 'prod-6', name: 'Hair Serum', price: 400, stock: 15 },
    { id: 'prod-7', name: 'Dry Shampoo', price: 220, stock: 35 },
    { id: 'prod-8', name: 'Hair Spray', price: 190, stock: 45 }
  ]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      const modalRect = document.querySelector('.billing-modal-content')?.getBoundingClientRect();
      if (!modalRect) return;
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const newWidth = modalRect.right - clientX;
      const minWidth = 300;
      const maxWidth = 800;
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setSalePanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove);
      document.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isResizing]);

  // Fetch client loyalty points when appointment/client changes
  useEffect(() => {
    const fetchLoyaltyPoints = async () => {
      // Priority: appointment.clientId (from appointment) > formData.clientId (from walk-in selection)
      const clientId = appointment?.clientId || formData.clientId;
      // Get branchId from appointment or userBranch
      const branchId = appointment?.branchId || userBranch;
      
      if (clientId && branchId && isOpen) {
        try {
          console.log('🔍 Fetching loyalty points for client:', clientId, 'at branch:', branchId);
          const points = await getLoyaltyPoints(clientId, branchId);
          setClientLoyaltyPoints(points);
          console.log('✅ Fetched loyalty points:', points, 'for client:', clientId, 'at branch:', branchId);
        } catch (error) {
          console.error('❌ Error fetching loyalty points:', error);
          setClientLoyaltyPoints(0);
        }
      } else {
        setClientLoyaltyPoints(0);
      }
    };

    if (isOpen) {
      fetchLoyaltyPoints();
    }
  }, [isOpen, appointment?.clientId, appointment?.branchId, formData.clientId, userBranch]);

  useEffect(() => {
    if (isOpen) {
      // Initialize client info (for walk-in or from appointment)
      const isWalkIn = appointment?.isWalkIn || !appointment?.clientId;
      
      if (isWalkIn) {
        // For walk-in, start with empty fields
        setFormData(prev => ({
          ...prev,
          clientName: '',
          clientPhone: '',
          clientEmail: '',
          clientId: '',
          items: []
        }));
        setMatchedClient(null);
        setClientSearch('');
        setShowClientList(false);
      } else {
        // Sync clientSearch with formData.clientName for appointment-based billing
        setClientSearch(appointment?.clientName || '');
        // For appointment, use appointment client data
        setFormData(prev => ({
          ...prev,
          clientName: appointment?.clientName || '',
          clientPhone: appointment?.clientPhone || '',
          clientEmail: appointment?.clientEmail || '',
          clientId: appointment?.clientId || '',
          items: []
        }));
        setMatchedClient(null);
      }

      // If appointment exists and has services/products, load them
      if (appointment && !isWalkIn) {
        // Load services
        const serviceItems = appointment.services && appointment.services.length > 0
          ? appointment.services.map(svc => {
              // Read client type and adjustments from appointment if they exist
              // These should be set when confirming/starting the appointment
              const basePrice = svc.price || svc.basePrice || 0;
              const adjustment = svc.adjustment || 0;
              const adjustedPrice = svc.adjustedPrice || (basePrice + adjustment);
              
              return {
                type: 'service',
                id: svc.serviceId,
                name: svc.serviceName,
                basePrice: basePrice,
                price: adjustedPrice, // Use adjusted price if available
                quantity: 1,
                stylistId: svc.stylistId,
                stylistName: svc.stylistName,
                clientType: svc.clientType || 'R', // Read from appointment
                adjustment: adjustment, // Read from appointment
                adjustmentReason: svc.adjustmentReason || '' // Read from appointment
              };
            })
          : appointment.serviceName
          ? [{
              type: 'service',
              id: appointment.serviceId || '',
              name: appointment.serviceName,
              basePrice: appointment.servicePrice || appointment.basePrice || 0,
              price: appointment.adjustedPrice || appointment.servicePrice || 0,
              quantity: 1,
              stylistId: appointment.stylistId,
              stylistName: appointment.stylistName,
              clientType: appointment.clientType || 'R',
              adjustment: appointment.adjustment || 0,
              adjustmentReason: appointment.adjustmentReason || ''
            }]
          : [];

        // Load products
        const productItems = appointment.products && appointment.products.length > 0
          ? appointment.products.map(prod => ({
              type: 'product',
              id: prod.productId,
              name: prod.productName,
              basePrice: prod.price,
              price: prod.total || (prod.price * (prod.quantity || 1)),
              quantity: prod.quantity || 1
            }))
          : [];

        // Combine services and products
        const items = [...serviceItems, ...productItems];

        // Load billing fields (discount, tax rate, etc.) if they exist
        setFormData(prev => ({
          ...prev,
          items,
          discount: appointment.discount !== undefined ? String(appointment.discount) : prev.discount,
          discountType: appointment.discountType || prev.discountType,
          tax: appointment.taxRate !== undefined ? String(appointment.taxRate) : (appointment.tax !== undefined ? String(appointment.tax) : prev.tax) // Support both taxRate and tax for backward compatibility
        }));
      }
    } else {
      // Reset form when modal closes
      setFormData({
        items: [],
        discountType: 'fixed',
        discount: '',
        loyaltyPointsUsed: '',
        paymentMethod: PAYMENT_METHODS.CASH,
        paymentReference: '',
        notes: '',
        amountReceived: '',
        tax: '',
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        clientId: ''
      });
    }
  }, [appointment, isOpen]);

  useEffect(() => {
    const calculated = calculateBillTotals({
      items: formData.items,
      discount: parseFloat(formData.discount) || 0,
      discountType: formData.discountType,
      taxRate: parseFloat(formData.tax) || 0,
      serviceChargeRate: 0,
      loyaltyPointsUsed: parseInt(formData.loyaltyPointsUsed) || 0
    });
    setTotals(calculated);
  }, [formData.items, formData.discount, formData.discountType, formData.loyaltyPointsUsed, formData.tax]);

  const handleToggleService = (service) => {
    const existing = formData.items.find(item => item.id === service.id && item.type === 'service');
    if (existing) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter(item => !(item.id === service.id && item.type === 'service'))
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, {
          type: 'service',
          id: service.id,
          name: service.serviceName || service.name || 'Unknown Service',
          basePrice: service.price || 0,
          price: service.price || 0,
          quantity: 1,
          stylistId: '',
          stylistName: '',
          clientType: 'R',
          adjustment: 0,
          adjustmentReason: ''
        }]
      }));
    }
  };

  const handleToggleProduct = (product) => {
    const existing = formData.items.find(item => item.id === product.id && item.type === 'product');
    if (existing) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter(item => !(item.id === product.id && item.type === 'product'))
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, {
          type: 'product',
          id: product.id,
          name: product.name || 'Unknown Product',
          basePrice: product.price || 0,
          price: product.price || 0,
          quantity: 1,
          stock: product.stock || 0
        }]
      }));
    }
  };

  const handleUpdateItem = (index, field, value) => {
    const updatedItems = [...formData.items];
    const currentItem = updatedItems[index];
    
    if (field === 'stylistId') {
      const stylist = stylists.find(s => s.id === value);
      updatedItems[index].stylistId = value;
      updatedItems[index].stylistName = stylist ? `${stylist.firstName} ${stylist.lastName}` : '';
    } else if (field === 'clientType') {
      // When changing clientType from TR to X or R, clear stylist selection
      const wasTR = currentItem.clientType === 'TR' || currentItem.clientType === 'TR-Transfer';
      const isNowXorR = value === 'X' || value === 'R';
      
      updatedItems[index][field] = value;
      
      // If changing from TR to X/R, clear stylist (stylist should only be changeable for TR)
      if (wasTR && isNowXorR && currentItem.type === 'service') {
        updatedItems[index].stylistId = '';
        updatedItems[index].stylistName = '';
      }
    } else if (field === 'adjustment') {
      updatedItems[index].adjustment = parseFloat(value) || 0;
      // Recalculate final price: basePrice + adjustment
      updatedItems[index].price = updatedItems[index].basePrice + (parseFloat(value) || 0);
    } else if (field === 'quantity') {
      // For products, update quantity and recalculate price
      const quantity = parseInt(value) || 1;
      updatedItems[index].quantity = quantity;
      if (updatedItems[index].type === 'product') {
        updatedItems[index].price = updatedItems[index].basePrice * quantity;
      }
    } else {
      updatedItems[index][field] = value;
    }
    setFormData(prev => ({ ...prev, items: updatedItems }));
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Filter clients based on search (use formData.clientName as primary source)
  const searchTerm = (clientSearch || formData.clientName || '').trim().toLowerCase();
  const filteredClients = (clients || []).filter(client => {
    if (!client || !client.firstName || !client.lastName) return false;
    if (!searchTerm || searchTerm.length === 0) return false;
    
    const clientName = `${client.firstName || ''} ${client.lastName || ''}`.trim().toLowerCase();
    const clientPhone = (client.phoneNumber || client.phone || '').toString().trim();
    
    return clientName.includes(searchTerm) || clientPhone.includes(searchTerm);
  });

  // Handle client selection from search list
  const handleSelectClient = async (client) => {
    setMatchedClient(client);
    setClientSearch(`${client.firstName} ${client.lastName}`);
    setShowClientList(false);
    setFormData(prev => ({
      ...prev,
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      clientPhone: client.phoneNumber || client.phone || '',
      clientEmail: client.email || ''
    }));
    
    // Fetch loyalty points for selected client (branch-specific)
    if (client.id) {
      try {
        const branchId = appointment?.branchId || userBranch;
        if (branchId) {
          const points = await getLoyaltyPoints(client.id, branchId);
          setClientLoyaltyPoints(points);
        } else {
          setClientLoyaltyPoints(0);
        }
      } catch (error) {
        console.error('Error fetching loyalty points:', error);
        setClientLoyaltyPoints(0);
      }
    }
  };

  // Handle client name input change
  const handleClientNameChange = (e) => {
    const value = e.target.value;
    setClientSearch(value);
    setFormData(prev => ({ ...prev, clientName: value }));
    
    // Show client list if there's input and it's walk-in
    const isWalkIn = appointment?.isWalkIn || !appointment?.clientId;
    if (isWalkIn && value.trim().length >= 1 && clients && Array.isArray(clients) && clients.length > 0) {
      setShowClientList(true);
      // Clear matched client if user is typing a different name
      if (matchedClient && `${matchedClient.firstName} ${matchedClient.lastName}` !== value) {
        setMatchedClient(null);
        setFormData(prev => ({ ...prev, clientId: '' }));
      }
    } else {
      setShowClientList(false);
      if (value.trim().length === 0) {
        setMatchedClient(null);
        setFormData(prev => ({ ...prev, clientId: '' }));
      }
    }
  };

  // Handle client phone change
  const handleClientPhoneChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, clientPhone: value }));
    
    // Update search and show list if typing in name field is empty
    if (!clientSearch) {
      setClientSearch(value);
      const isWalkIn = appointment?.isWalkIn || !appointment?.clientId;
      if (isWalkIn && value.trim().length >= 1 && clients.length > 0) {
        setShowClientList(true);
      }
    }
  };

  // Close client list when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showClientList && !event.target.closest('.client-search-container')) {
        setShowClientList(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showClientList]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate client name for service transactions
    if (formData.items.length > 0 && !formData.clientName.trim()) {
      toast.error('Client name is required for service transactions');
      return;
    }

    if (formData.items.length === 0) {
      toast.error('Please add at least one service or product');
      return;
    }

    // Validate stylist selection for TR (Transfer) client type
    const transferServices = formData.items.filter(item => item.type === 'service' && item.clientType === 'TR');
    for (const service of transferServices) {
      if (!service.stylistId || service.stylistId.trim() === '') {
        toast.error(`Stylist is required for Transfer (TR) client type. Please select a stylist for "${service.name}".`);
        return;
      }
    }

    // Validate amount received for cash payments (only in billing mode)
    if (mode === 'billing' && formData.paymentMethod === PAYMENT_METHODS.CASH) {
      const amountReceived = parseFloat(formData.amountReceived) || 0;
      if (!formData.amountReceived || amountReceived < totals.total) {
        toast.error(`Insufficient amount received! Required: ₱${totals.total.toFixed(2)}`);
        return;
      }
    }

    const isWalkIn = appointment?.isWalkIn || !appointment?.clientId;

    const billData = {
      appointmentId: isWalkIn ? null : appointment?.id,
      clientId: formData.clientId || null,
      clientName: formData.clientName,
      clientPhone: formData.clientPhone || '',
      clientEmail: formData.clientEmail || '',
      branchId: appointment?.branchId,
      branchName: appointment?.branchName,
      stylistId: appointment?.stylistId || formData.items[0]?.stylistId,
      stylistName: appointment?.stylistName || formData.items[0]?.stylistName,
      items: formData.items,
      subtotal: totals.subtotal,
      discount: parseFloat(formData.discount) || 0, // Store discount amount/percentage (not computed)
      discountType: formData.discountType,
      loyaltyPointsUsed: parseInt(formData.loyaltyPointsUsed) || 0,
      tax: totals.tax, // Computed tax amount (for billing)
      taxRate: parseFloat(formData.tax) || 0, // Tax rate (for storing in appointment)
      total: totals.total,
      paymentMethod: formData.paymentMethod,
      paymentReference: formData.paymentReference,
      amountReceived: formData.paymentMethod === PAYMENT_METHODS.CASH ? (parseFloat(formData.amountReceived) || 0) : totals.total,
      notes: formData.notes || (isWalkIn ? 'Walk-in customer' : '')
    };

    onSubmit(billData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[1600px] h-[95vh] flex flex-col overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header - Dark Purple like Appointment Form */}
          <div className="bg-[#2D1B4E] px-8 py-5 relative">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="absolute top-4 right-4 p-1 text-white/80 hover:text-white transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-white mb-1">
              {mode === 'start-service' 
                ? 'Start Service' 
                : appointment?.isWalkIn || !appointment?.clientId 
                  ? 'Walk-in Customer' 
                  : 'Process Payment'}
            </h2>
            <p className="text-white/70 text-sm">
              {mode === 'start-service'
                ? 'Add services/products and adjust prices before starting service'
                : appointment?.isWalkIn || !appointment?.clientId 
                  ? 'Create new transaction for walk-in customer'
                  : `Complete payment for pending invoice • Transaction #${appointment?.id?.slice(-8).toUpperCase() || 'Pending'}`
              }
            </p>
          </div>

          {/* Main Content - Two Columns */}
          <div className="flex-1 flex overflow-hidden billing-modal-content">
            {/* LEFT SIDE - Services Selection */}
            <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
              {/* Client Info */}
              <div className="bg-white p-6 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-[#2D1B4E]">
                  <div className="w-7 h-7 bg-[#2D1B4E] text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <h3 className="text-base font-bold text-gray-900">Client Information</h3>
                </div>
                {(appointment?.isWalkIn || !appointment?.clientId) ? (
                  // Walk-in: Editable fields with searchable client list
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="relative client-search-container">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Client Name *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.clientName}
                            onChange={handleClientNameChange}
                            onFocus={() => {
                              const isWalkIn = appointment?.isWalkIn || !appointment?.clientId;
                              if (isWalkIn && clients && Array.isArray(clients) && clients.length > 0) {
                                const currentSearch = (clientSearch || formData.clientName || '').trim();
                                if (currentSearch.length >= 1) {
                                  setShowClientList(true);
                                }
                              }
                            }}
                            className={`w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent text-sm ${
                              matchedClient ? 'bg-green-50 border-green-300' : ''
                            }`}
                            placeholder="Search or enter client name"
                            required
                          />
                          {/* Profile Picture next to input */}
                          {matchedClient && (
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-gray-200 border border-green-300">
                              {matchedClient.photoURL ? (
                                <img 
                                  src={matchedClient.photoURL} 
                                  alt={`${matchedClient.firstName} ${matchedClient.lastName}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-primary-600 flex items-center justify-center text-white text-xs font-semibold">
                                  {matchedClient.firstName?.[0]?.toUpperCase() || ''}
                                  {matchedClient.lastName?.[0]?.toUpperCase() || ''}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Searchable Client List */}
                        {showClientList && searchTerm.length >= 1 && (
                          <>
                            {filteredClients.length > 0 ? (
                              <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {filteredClients.map(client => (
                                  <button
                                    key={client.id}
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleSelectClient(client);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      {/* Profile Picture */}
                                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                                        {client.photoURL ? (
                                          <img 
                                            src={client.photoURL} 
                                            alt={`${client.firstName} ${client.lastName}`}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full bg-primary-600 flex items-center justify-center text-white text-xs font-semibold">
                                            {client.firstName?.[0]?.toUpperCase() || ''}
                                            {client.lastName?.[0]?.toUpperCase() || ''}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900">
                                          {client.firstName} {client.lastName}
                                        </p>
                                        <p className="text-xs text-gray-500 truncate">
                                          {(client.phoneNumber || client.phone) && `${client.phoneNumber || client.phone}`}
                                          {client.email && ` • ${client.email}`}
                                        </p>
                                      </div>
                                      {matchedClient?.id === client.id && (
                                        <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
                                <p className="text-xs text-gray-500">No matching clients found</p>
                              </div>
                            )}
                          </>
                        )}
                        
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
                        <input
                          type="tel"
                          value={formData.clientPhone}
                          onChange={handleClientPhoneChange}
                          className={`w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent text-sm ${
                            matchedClient ? 'bg-green-50 border-green-300' : ''
                          }`}
                          placeholder="Enter phone number"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
                        <input
                          type="email"
                          value={formData.clientEmail}
                          onChange={(e) => setFormData(prev => ({ ...prev, clientEmail: e.target.value }))}
                          className={`w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent text-sm ${
                            matchedClient ? 'bg-green-50 border-green-300' : ''
                          }`}
                          placeholder="Enter email address"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  // Appointment: Read-only fields
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Client Name *</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm font-medium">
                      {appointment?.clientName}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm">
                      {appointment?.clientPhone || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm">
                      {appointment?.clientEmail || '-'}
                    </div>
                  </div>
                </div>
                )}
              </div>

              {/* Services & Products Grid */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-[#2D1B4E]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-[#2D1B4E] text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                    <h3 className="text-base font-bold text-gray-900">Services & Products</h3>
                  </div>
                  
                  {/* Tab Buttons */}
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('service')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                        activeTab === 'service'
                          ? 'bg-[#2D1B4E] text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Scissors className="w-4 h-4" />
                      <span className="text-sm font-medium">Services</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('product')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                        activeTab === 'product'
                          ? 'bg-[#2D1B4E] text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Package className="w-4 h-4" />
                      <span className="text-sm font-medium">Products</span>
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder={activeTab === 'service' ? 'Search services...' : 'Search products...'}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent text-sm"
                  />
                </div>

                <div className="grid grid-cols-5 gap-3">
                  {/* Services Tab */}
                  {activeTab === 'service' && services
                    .filter(service => 
                      service?.serviceName?.toLowerCase().includes(serviceSearch.toLowerCase()) ||
                      service?.name?.toLowerCase().includes(serviceSearch.toLowerCase())
                    )
                    .map((service) => {
                    const isSelected = formData.items.some(item => item.id === service.id && item.type === 'service');
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => handleToggleService(service)}
                        className={`px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
                          isSelected
                            ? 'border-[#2D1B4E] bg-purple-50 shadow-md'
                            : 'border-gray-300 bg-white hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          <Scissors className="w-3 h-3 text-blue-600" />
                          <p className={`font-semibold text-sm ${isSelected ? 'text-[#2D1B4E]' : 'text-gray-900'}`}>
                            {service.serviceName || service.name || 'Unknown Service'}
                          </p>
                        </div>
                        <p className={`text-base font-bold mb-0.5 ${isSelected ? 'text-purple-700' : 'text-gray-900'}`}>
                          ₱{service.price}
                        </p>
                        <p className="text-xs text-gray-500">{service.duration || '30'} m</p>
                      </button>
                    );
                  })}
                  
                  {/* Products Tab */}
                  {activeTab === 'product' && availableProducts
                    .filter(product => 
                      product?.name?.toLowerCase().includes(serviceSearch.toLowerCase())
                    )
                    .map((product) => {
                    const isSelected = formData.items.some(item => item.id === product.id && item.type === 'product');
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleToggleProduct(product)}
                        className={`px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
                          isSelected
                            ? 'border-[#2D1B4E] bg-purple-50 shadow-md'
                            : 'border-gray-300 bg-white hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          <Package className="w-3 h-3 text-green-600" />
                          <p className={`font-semibold text-sm ${isSelected ? 'text-[#2D1B4E]' : 'text-gray-900'}`}>
                            {product.name || 'Unknown Product'}
                          </p>
                        </div>
                        <p className={`text-base font-bold mb-0.5 ${isSelected ? 'text-purple-700' : 'text-gray-900'}`}>
                          ₱{product.price}
                        </p>
                        <p className="text-xs text-gray-500">Stock: {product.stock}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT SIDE - Current Sale */}
            <div 
              className="flex flex-col bg-gray-50 border-l border-gray-300 relative"
              style={{ width: `${salePanelWidth}px` }}
            >
              {/* Resize Handle */}
              <div
                onMouseDown={() => setIsResizing(true)}
                onTouchStart={() => setIsResizing(true)}
                className={`absolute left-0 top-0 bottom-0 w-4 cursor-col-resize hover:bg-[#2D1B4E]/20 active:bg-[#2D1B4E]/30 transition-colors z-20 ${
                  isResizing ? 'bg-[#2D1B4E]/30' : 'bg-transparent'
                }`}
                title="Drag to resize"
              >
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-16 bg-gray-400 rounded-full" />
              </div>

              {/* Sale Header */}
              <div className="flex-1 p-4 overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-[#2D1B4E]">
                  <div className="w-7 h-7 bg-[#2D1B4E] text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  <h3 className="text-base font-bold text-gray-900">Current Sale</h3>
                </div>
                {!appointment?.isWalkIn && appointment?.clientId && (
                  <div className="text-xs text-gray-500 mb-4">
                    Transaction #: {appointment?.id?.slice(-8).toUpperCase() || 'Pending'}
              </div>
                )}

              {/* Scrollable Content */}
                <div className="space-y-2 flex-1 overflow-y-auto">
                    {formData.items.map((item, index) => (
                    <div key={index} className="bg-white p-3 rounded border">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {item.type === 'product' ? (
                              <Package className="h-3 w-3 text-green-600" />
                            ) : (
                              <Scissors className="h-3 w-3 text-blue-600" />
                            )}
                            <h5 className="font-medium text-gray-900 text-sm">{item.name}</h5>
                            {item.type === 'product' && (
                              <span className="text-xs text-gray-500">(Product)</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {item.type === 'product' ? (
                              <>
                                <span>₱{item.basePrice} x {item.quantity}</span>
                                <span className="ml-2 font-semibold text-green-600">
                                  = ₱{item.price}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className={item.adjustment !== 0 ? 'line-through text-gray-400' : ''}>
                                  ₱{item.basePrice}
                                </span>
                                {item.adjustment !== 0 && (
                                  <span className="ml-2 font-semibold text-green-600">
                                    ₱{item.price}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                          className="text-red-500 hover:text-red-700 text-sm ml-2"
                          >
                          <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Quantity Input (for products) */}
                        {item.type === 'product' && (
                          <div className="mb-2">
                            <label className="text-xs text-gray-500 mb-1 block">Quantity:</label>
                            <input
                              type="number"
                              min="1"
                              max={item.stock || 999}
                              value={item.quantity || 1}
                              onChange={(e) => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent"
                            />
                            {item.stock && (
                              <p className="text-xs text-gray-400 mt-1">Available: {item.stock}</p>
                            )}
                          </div>
                        )}

                        {/* Stylist Selection (only for services, and only changeable for TR) */}
                        {item.type === 'service' && (
                          <div className="mb-2">
                            <label className="text-xs text-gray-500 mb-1 block">
                              Stylist {item.clientType === 'TR' && <span className="text-red-500">*</span>}
                            </label>
                            {item.clientType === 'TR' ? (
                              // TR: Allow stylist change
                              <>
                                <select
                                  value={item.stylistId || ''}
                                  onChange={(e) => {
                                    const stylist = stylists.find(s => s.id === e.target.value);
                                    handleUpdateItem(index, 'stylistId', e.target.value);
                                    if (stylist) {
                                      handleUpdateItem(index, 'stylistName', `${stylist.firstName} ${stylist.lastName}`);
                                    } else {
                                      handleUpdateItem(index, 'stylistName', '');
                                    }
                                  }}
                                  required
                                  className={`w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent ${
                                    !item.stylistId 
                                      ? 'border-red-300 bg-red-50' 
                                      : 'border-gray-300'
                                  }`}
                                >
                                  <option value="">Select Stylist</option>
                                  {stylists.map(stylist => (
                                    <option key={stylist.id} value={stylist.id}>
                                      {stylist.firstName} {stylist.lastName}
                                    </option>
                                  ))}
                                </select>
                                {!item.stylistId && (
                                  <p className="text-xs text-red-500 mt-1">Stylist is required for Transfer</p>
                                )}
                              </>
                            ) : (
                              // X or R: Show stylist as read-only (from appointment)
                              <input
                                type="text"
                                value={item.stylistName || 'Any available'}
                                readOnly
                                disabled
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600 cursor-not-allowed"
                              />
                            )}
                          </div>
                        )}

                        {/* Client Type (only for services) */}
                        {item.type === 'service' && (
                          <div className="space-y-1">
                            <label className="text-xs text-gray-500">Client Type:</label>
                            <div className="flex space-x-2">
                              <label className="flex items-center space-x-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`clientType-${index}`}
                                  value="X"
                                  checked={item.clientType === 'X' || item.clientType === 'X-New'}
                                  onChange={(e) => handleUpdateItem(index, 'clientType', e.target.value)}
                                  className="text-green-600 focus:ring-green-500"
                                />
                                <span className="text-xs text-gray-700">X-New</span>
                              </label>
                              <label className="flex items-center space-x-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`clientType-${index}`}
                                  value="R"
                                  checked={item.clientType === 'R' || item.clientType === 'R-Regular'}
                                  onChange={(e) => handleUpdateItem(index, 'clientType', e.target.value)}
                                  className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs text-gray-700">R-Regular</span>
                              </label>
                              <label className="flex items-center space-x-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`clientType-${index}`}
                                  value="TR"
                                  checked={item.clientType === 'TR' || item.clientType === 'TR-Transfer'}
                              onChange={(e) => handleUpdateItem(index, 'clientType', e.target.value)}
                              className="text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-xs text-gray-700">TR-Transfer</span>
                          </label>
                        </div>
                      </div>
                      )}

                      {/* Price Adjustment (only for services) */}
                      {item.type === 'service' && (
                        <div className="space-y-2 mt-2 pt-2 border-t border-gray-200">
                          <label className="text-xs text-gray-500">Price Adjustment:</label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="number"
                              placeholder="Adjustment (₱)"
                              value={item.adjustment || ''}
                              onChange={(e) => {
                                const adjustment = parseFloat(e.target.value) || 0;
                                const newPrice = item.basePrice + adjustment;
                                handleUpdateItem(index, 'adjustment', adjustment);
                                handleUpdateItem(index, 'price', newPrice);
                              }}
                              className="w-full sm:w-32 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent"
                            />
                          <input
                            type="text"
                            placeholder="Reason (e.g., Long hair)"
                            value={item.adjustmentReason || ''}
                            onChange={(e) => handleUpdateItem(index, 'adjustmentReason', e.target.value)}
                            className="flex-1 min-w-0 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent"
                          />
                        </div>
                        {item.adjustment !== 0 && (
                          <div className="text-xs text-gray-600 mt-2">
                            <span className="text-gray-400">Base: ₱{item.basePrice}</span>
                            <span className="mx-2">+</span>
                            <span className={item.adjustment > 0 ? 'text-green-600' : 'text-red-600'}>
                              ₱{item.adjustment}
                            </span>
                            <span className="mx-2">=</span>
                            <span className="font-semibold text-green-600">₱{item.price}</span>
                          </div>
                        )}
                        </div>
                      )}
                    </div>
                  ))}

                  {formData.items.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">No items selected</p>
                      <p className="text-xs">Add services or products to start a sale</p>
                    </div>
                  )}
                      </div>
                    </div>

              {/* Fixed Bottom Section */}
              <div className="border-t bg-white p-3 flex-shrink-0">
                <div className="space-y-2 mb-3">
                  {/* Loyalty Points (only for registered clients) */}
                  {(appointment?.clientId || formData.clientId) && clientLoyaltyPoints > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-600 fill-yellow-600" />
                          <label className="block text-xs font-medium text-gray-700">
                            Loyalty Points Available: <span className="font-bold text-yellow-700">{clientLoyaltyPoints}</span>
                          </label>
                        </div>
                        <span className="text-xs text-gray-500">1 pt = ₱1</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={clientLoyaltyPoints}
                        step="1"
                        value={formData.loyaltyPointsUsed || ''}
                        onChange={(e) => {
                          const points = parseInt(e.target.value) || 0;
                          if (points <= clientLoyaltyPoints) {
                            setFormData(prev => ({ ...prev, loyaltyPointsUsed: points.toString() }));
                          }
                        }}
                        className="w-full px-2 py-1 text-sm border border-yellow-300 rounded focus:ring-1 focus:ring-yellow-500 focus:border-transparent"
                        placeholder="Enter points to redeem"
                      />
                      {formData.loyaltyPointsUsed && parseInt(formData.loyaltyPointsUsed) > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          Discount: ₱{parseInt(formData.loyaltyPointsUsed) || 0}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Discount and Tax - Always editable */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Discount (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={formData.discount}
                        onChange={(e) => setFormData(prev => ({ ...prev, discount: e.target.value, discountType: 'percentage' }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tax (₱)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.tax}
                        onChange={(e) => setFormData(prev => ({ ...prev, tax: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-[#2D1B4E] focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                  </div>

                {/* Payment Method - Only show in billing mode */}
                {mode === 'billing' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Method *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={PAYMENT_METHODS.CASH}
                          checked={formData.paymentMethod === PAYMENT_METHODS.CASH}
                          onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                          className="text-blue-600"
                        />
                        <Banknote className="h-4 w-4 text-green-600" />
                        <span className="text-xs">Cash</span>
                      </label>
                      
                      <label className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={PAYMENT_METHODS.CARD}
                          checked={formData.paymentMethod === PAYMENT_METHODS.CARD}
                          onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                          className="text-blue-600"
                        />
                        <CreditCard className="h-4 w-4 text-blue-600" />
                        <span className="text-xs">Card</span>
                      </label>
                      
                      <label className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={PAYMENT_METHODS.VOUCHER}
                          checked={formData.paymentMethod === PAYMENT_METHODS.VOUCHER || formData.paymentMethod === PAYMENT_METHODS.GIFT_CARD}
                          onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: PAYMENT_METHODS.VOUCHER }))}
                          className="text-blue-600"
                        />
                        <Smartphone className="h-4 w-4 text-purple-600" />
                        <span className="text-xs">Digital</span>
                      </label>
                    </div>

                    {formData.paymentMethod === PAYMENT_METHODS.CASH && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received (₱) *</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.amountReceived}
                          onChange={(e) => setFormData(prev => ({ ...prev, amountReceived: e.target.value }))}
                          className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[#2D1B4E] focus:border-transparent ${
                            formData.amountReceived && parseFloat(formData.amountReceived) < totals.total
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-300'
                          }`}
                          placeholder="Enter amount received"
                          required
                        />
                        {formData.amountReceived && parseFloat(formData.amountReceived) >= totals.total && (
                          <p className="mt-2 text-sm text-green-600 font-medium">
                            Change: ₱{Math.max(0, parseFloat(formData.amountReceived) - totals.total).toFixed(2)}
                          </p>
                        )}
                        {formData.amountReceived && parseFloat(formData.amountReceived) < totals.total && (
                          <p className="mt-2 text-sm text-red-600 font-medium">
                            Insufficient amount! Required: ₱{totals.total.toFixed(2)} | Short: ₱{(totals.total - parseFloat(formData.amountReceived)).toFixed(2)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Payment Reference for non-cash */}
                    {formData.paymentMethod !== PAYMENT_METHODS.CASH && (
                      <input
                        type="text"
                        value={formData.paymentReference}
                        onChange={(e) => setFormData(prev => ({ ...prev, paymentReference: e.target.value }))}
                        className="w-full mt-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D1B4E]"
                        placeholder="Reference number (optional)"
                      />
                    )}
                  </div>
                )}

                {/* Bill Summary */}
                <div className="space-y-1 text-xs mb-3">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₱{totals.subtotal.toFixed(2)}</span>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between">
                      <span>Discount ({formData.discount || 0}%):</span>
                      <span>-₱{totals.discount.toFixed(2)}</span>
                      </div>
                    )}
                  {totals.tax > 0 && (
                      <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>₱{totals.tax.toFixed(2)}</span>
                      </div>
                    )}
                  <hr />
                  <div className="flex justify-between font-bold text-base">
                    <span>TOTAL:</span>
                    <span className="text-[#2D1B4E]">₱{totals.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                <button
                  type="submit"
                  disabled={
                    loading || 
                    formData.items.length === 0 || 
                    (mode === 'billing' && formData.paymentMethod === PAYMENT_METHODS.CASH && 
                     (!formData.amountReceived || parseFloat(formData.amountReceived) < totals.total))
                  }
                    className="flex-1 bg-[#2D1B4E] hover:bg-[#3d2a5f] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 px-4 py-2 text-sm"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Processing...</span>
                    </>
                  ) : (
                      <span>{mode === 'start-service' ? 'Start Service' : 'Process Payment'}</span>
                  )}
                </button>
                </div>
              </div>
            </div>
          </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BillingModalPOS;
