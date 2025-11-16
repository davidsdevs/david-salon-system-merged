/**
 * Walk-in Billing Modal Component
 * For processing payments for walk-in customers without prior appointment
 */

import { useState, useEffect } from 'react';
import { X, DollarSign, Tag, Percent, CreditCard, Wallet, Gift, Receipt, Plus, Trash2, Scissors, Package, Star } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import { PAYMENT_METHODS, calculateBillTotals } from '../../services/billingService';
import { getLoyaltyPoints } from '../../services/loyaltyService';

const WalkInBillingModal = ({
  isOpen,
  onClose,
  onSubmit,
  loading,
  services,
  stylists,
  clients,
  branchId,
  branchName,
  taxRate = 0,
  serviceChargeRate = 0
}) => {
  const [formData, setFormData] = useState({
    clientId: '',
    clientName: '',
    clientPhone: '',
    items: [],
    discountType: 'fixed',
    discount: 0,
    discountCode: '',
    loyaltyPointsUsed: 0,
    paymentMethod: PAYMENT_METHODS.CASH,
    paymentReference: '',
    notes: ''
  });

  const [totals, setTotals] = useState({
    subtotal: 0,
    discount: 0,
    serviceCharge: 0,
    tax: 0,
    total: 0
  });

  const [isNewClient, setIsNewClient] = useState(false);
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
    if (isOpen) {
      // Reset form when modal opens
      setFormData({
        clientId: '',
        clientName: '',
        clientPhone: '',
        items: [],
        discountType: 'fixed',
        discount: 0,
        discountCode: '',
        loyaltyPointsUsed: 0,
        paymentMethod: PAYMENT_METHODS.CASH,
        paymentReference: '',
        notes: ''
      });
      setIsNewClient(false);
    }
  }, [isOpen]);

  useEffect(() => {
    // Recalculate totals whenever items or discounts change
    const calculated = calculateBillTotals({
      items: formData.items,
      discount: formData.discount,
      discountType: formData.discountType,
      taxRate,
      serviceChargeRate,
      loyaltyPointsUsed: formData.loyaltyPointsUsed
    });

    setTotals(calculated);
  }, [formData.items, formData.discount, formData.discountType, formData.loyaltyPointsUsed, taxRate, serviceChargeRate]);

  const handleClientChange = async (e) => {
    const clientId = e.target.value;
    
    if (clientId === 'new') {
      setIsNewClient(true);
      setFormData(prev => ({
        ...prev,
        clientId: '',
        clientName: '',
        clientPhone: '',
        loyaltyPointsUsed: 0
      }));
      setClientLoyaltyPoints(0);
    } else if (clientId) {
      const client = clients.find(c => c.id === clientId);
      setIsNewClient(false);
      setFormData(prev => ({
        ...prev,
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName}`,
        clientPhone: client.phoneNumber || '',
        loyaltyPointsUsed: 0
      }));
      
      // Fetch loyalty points for selected client (branch-specific)
      try {
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
    } else {
      setIsNewClient(false);
      setFormData(prev => ({
        ...prev,
        clientId: '',
        clientName: '',
        clientPhone: '',
        loyaltyPointsUsed: 0
      }));
      setClientLoyaltyPoints(0);
    }
  };

  const handleAddService = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        type: 'service',
        id: '',
        name: '',
        price: 0,
        quantity: 1,
        stylistId: '',
        stylistName: ''
      }]
    }));
  };

  const handleAddProduct = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        type: 'product',
        id: '',
        name: '',
        basePrice: 0,
        price: 0,
        quantity: 1,
        stock: 0
      }]
    }));
  };

  const handleServiceChange = (index, field, value) => {
    const updatedItems = [...formData.items];
    
    if (field === 'id') {
      if (updatedItems[index].type === 'service') {
        const service = services.find(s => s.id === value);
        updatedItems[index] = {
          ...updatedItems[index],
          id: value,
          name: service?.name || service?.serviceName || '',
          price: service?.price || 0
        };
      } else if (updatedItems[index].type === 'product') {
        const product = availableProducts.find(p => p.id === value);
        updatedItems[index] = {
          ...updatedItems[index],
          id: value,
          name: product?.name || '',
          basePrice: product?.price || 0,
          price: product?.price || 0,
          stock: product?.stock || 0
        };
      }
    } else if (field === 'stylistId') {
      const stylist = stylists.find(s => s.id === value);
      updatedItems[index] = {
        ...updatedItems[index],
        stylistId: value,
        stylistName: stylist ? `${stylist.firstName} ${stylist.lastName}` : ''
      };
    } else if (field === 'quantity' && updatedItems[index].type === 'product') {
      const quantity = parseInt(value) || 1;
      updatedItems[index].quantity = quantity;
      updatedItems[index].price = updatedItems[index].basePrice * quantity;
    } else {
      updatedItems[index][field] = value;
    }
    
    setFormData(prev => ({ ...prev, items: updatedItems }));
  };

  const handleRemoveService = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleDiscountChange = (value) => {
    const numValue = parseFloat(value) || 0;
    
    if (formData.discountType === 'percentage' && numValue > 100) {
      return;
    }
    
    if (formData.discountType === 'fixed' && numValue > totals.subtotal) {
      return;
    }

    setFormData(prev => ({ ...prev, discount: numValue }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.clientName.trim()) {
      alert('Please enter client name');
      return;
    }

    if (formData.items.length === 0) {
      alert('Please add at least one service or product');
      return;
    }

    // Check if all services have valid data
    const hasInvalidItem = formData.items.some(item => {
      if (!item.id) return true;
      if (item.type === 'service' && !item.stylistId) return true;
      if (item.type === 'product' && (!item.quantity || item.quantity < 1)) return true;
      return false;
    });
    if (hasInvalidItem) {
      alert('Please complete all item details (service requires stylist, product requires quantity)');
      return;
    }

    const billData = {
      appointmentId: `walkin-${Date.now()}`, // Temporary ID for walk-in
      clientId: formData.clientId || `guest-${Date.now()}`,
      clientName: formData.clientName,
      clientPhone: formData.clientPhone,
      branchId,
      branchName,
      stylistId: formData.items[0]?.stylistId,
      stylistName: formData.items[0]?.stylistName,
      items: formData.items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      discountType: formData.discountType,
      discountCode: formData.discountCode,
      loyaltyPointsUsed: formData.loyaltyPointsUsed,
      tax: totals.tax,
      taxRate,
      serviceCharge: totals.serviceCharge,
      serviceChargeRate,
      total: totals.total,
      paymentMethod: formData.paymentMethod,
      paymentReference: formData.paymentReference,
      notes: `Walk-in customer. ${formData.notes}`.trim()
    };

    onSubmit(billData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Walk-in Customer Billing</h2>
              <p className="text-sm text-gray-600">Process payment for walk-in customer</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Client Selection */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Client Information</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Client
                  </label>
                  <select
                    value={isNewClient ? 'new' : formData.clientId}
                    onChange={handleClientChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select existing client or add new</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.firstName} {client.lastName} - {client.phoneNumber}
                      </option>
                    ))}
                    <option value="new">+ New Walk-in Client</option>
                  </select>
                </div>

                {(isNewClient || !formData.clientId) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Client Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.clientName}
                        onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="Enter client name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number (Optional)
                      </label>
                      <input
                        type="tel"
                        value={formData.clientPhone}
                        onChange={(e) => setFormData(prev => ({ ...prev, clientPhone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="09XX XXX XXXX"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Services/Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">Services & Products</h3>
                  <p className="text-xs text-blue-600 italic">💡 Adjust prices based on client assessment</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddService}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <Scissors className="w-4 h-4" />
                    Add Service
                  </button>
                  <button
                    type="button"
                    onClick={handleAddProduct}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Package className="w-4 h-4" />
                    Add Product
                  </button>
                </div>
              </div>

              {formData.items.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-500 text-sm">No items added yet. Click "Add Service" or "Add Product" to begin.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        {item.type === 'product' ? (
                          <Package className="w-4 h-4 text-green-600" />
                        ) : (
                          <Scissors className="w-4 h-4 text-blue-600" />
                        )}
                        <span className="text-xs font-medium text-gray-600">
                          {item.type === 'product' ? 'Product' : 'Service'}
                        </span>
                      </div>
                      <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-4">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            {item.type === 'product' ? 'Product *' : 'Service *'}
                          </label>
                          <select
                            value={item.id}
                            onChange={(e) => handleServiceChange(index, 'id', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            required
                          >
                            <option value="">Select {item.type === 'product' ? 'product' : 'service'}</option>
                            {item.type === 'product' ? (
                              availableProducts.map(product => (
                                <option key={product.id} value={product.id}>
                                  {product.name} - ₱{product.price}
                                </option>
                              ))
                            ) : (
                              services.map(service => (
                                <option key={service.id} value={service.id}>
                                  {service.name || service.serviceName}
                                </option>
                              ))
                            )}
                          </select>
                        </div>

                        {item.type === 'service' && (
                          <div className="col-span-4">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Stylist (Optional)</label>
                            <select
                              value={item.stylistId}
                              onChange={(e) => handleServiceChange(index, 'stylistId', e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            >
                              <option value="">Any Available Stylist</option>
                              {stylists.map(stylist => (
                                <option key={stylist.id} value={stylist.id}>
                                  {stylist.firstName} {stylist.lastName}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {item.type === 'product' && (
                          <div className="col-span-4">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Quantity *</label>
                            <input
                              type="number"
                              min="1"
                              max={item.stock || 999}
                              value={item.quantity || 1}
                              onChange={(e) => handleServiceChange(index, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                              required
                            />
                            {item.stock && (
                              <p className="text-xs text-gray-400 mt-1">Available: {item.stock}</p>
                            )}
                          </div>
                        )}

                        <div className={item.type === 'product' ? 'col-span-3' : 'col-span-3'}>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Final Price *</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₱</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.price}
                              onChange={(e) => handleServiceChange(index, 'price', parseFloat(e.target.value) || 0)}
                              className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-semibold"
                              required
                              readOnly={item.type === 'product'} // Products price is calculated from quantity
                            />
                          </div>
                        </div>

                        <div className="col-span-1 flex items-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveService(index)}
                            className="w-full p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Discount Section */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Discounts & Loyalty
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount Type</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData(prev => ({ ...prev, discountType: e.target.value, discount: 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="fixed">Fixed Amount (₱)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount {formData.discountType === 'percentage' ? '(%)' : '(₱)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={formData.discountType === 'percentage' ? 100 : totals.subtotal}
                    step="0.01"
                    value={formData.discount}
                    onChange={(e) => handleDiscountChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount Code (Optional)</label>
                  <input
                    type="text"
                    value={formData.discountCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, discountCode: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter code"
                  />
                </div>

                {/* Loyalty Points (only for registered clients) */}
                {formData.clientId && !isNewClient && clientLoyaltyPoints > 0 && (
                  <div className="col-span-2">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-600 fill-yellow-600" />
                          <label className="block text-sm font-medium text-gray-700">
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
                        value={formData.loyaltyPointsUsed}
                        onChange={(e) => {
                          const points = parseInt(e.target.value) || 0;
                          if (points <= clientLoyaltyPoints) {
                            setFormData(prev => ({ ...prev, loyaltyPointsUsed: points }));
                          }
                        }}
                        className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        placeholder="Enter points to redeem"
                      />
                      {formData.loyaltyPointsUsed > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          Discount: ₱{formData.loyaltyPointsUsed}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Method */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Payment Method
              </h3>
              
              <div className="space-y-2 mb-3">
                {[
                  { value: PAYMENT_METHODS.CASH, label: 'Cash' },
                  { value: PAYMENT_METHODS.CARD, label: 'Card' },
                  { value: PAYMENT_METHODS.VOUCHER, label: 'Voucher' },
                  { value: PAYMENT_METHODS.GIFT_CARD, label: 'Gift Card' }
                ].map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={value}
                      checked={formData.paymentMethod === value}
                      onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500 cursor-pointer"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>

              {formData.paymentMethod !== PAYMENT_METHODS.CASH && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Reference (Optional)</label>
                  <input
                    type="text"
                    value={formData.paymentReference}
                    onChange={(e) => setFormData(prev => ({ ...prev, paymentReference: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Transaction ID, Card number, etc."
                  />
                </div>
              )}
            </div>

            {/* Bill Summary */}
            <div className="border-t border-gray-200 pt-4 bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Bill Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₱{totals.subtotal.toFixed(2)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-₱{totals.discount.toFixed(2)}</span>
                  </div>
                )}
                {serviceChargeRate > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Service Charge ({serviceChargeRate}%)</span>
                    <span className="font-medium">₱{totals.serviceCharge.toFixed(2)}</span>
                  </div>
                )}
                {taxRate > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax ({taxRate}%)</span>
                    <span className="font-medium">₱{totals.tax.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-gray-300 pt-2 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary-600">₱{totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Additional notes..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || totals.total <= 0 || formData.items.length === 0}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <DollarSign className="w-5 h-5" />
                  <span>Process Payment - ₱{totals.total.toFixed(2)}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WalkInBillingModal;
