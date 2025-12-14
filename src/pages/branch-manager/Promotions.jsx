// src/pages/04_BranchManager/Promotions.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';

import { getClients, getClientsByBranch } from '../../services/clientService';
import { sendPromotionEmail } from '../../services/emailService';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  Megaphone,
  Plus,
  Mail,
  Edit,
  Trash2,
  Eye,
  Calendar,
  Percent,
  Tag,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Filter,
  AlertTriangle,
  Home,
  Settings,
  BarChart3,
  UserCog,
  Receipt,
  Package,
  ShoppingCart,
  Banknote,
  Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { getBranchServices } from '../../services/branchServicesService';
import { productService } from '../../services/productService';
import { openaiService } from '../../services/openaiService';
import { Sparkles, Loader2 as Loader2Icon } from 'lucide-react';

const Promotions = () => {
  const { userData } = useAuth();

  // Data states
  const [promotions, setPromotions] = useState([]);
  const [clients, setClients] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'upcoming', 'expired'
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isConfirmSendModalOpen, setIsConfirmSendModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState('');
  const [selectedPromotion, setSelectedPromotion] = useState(null);
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [isSending, setIsSending] = useState(false);
  
  // AI Insights for Promotions
  const [promotionRecommendations, setPromotionRecommendations] = useState(null);
  const [loadingPromotionAI, setLoadingPromotionAI] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    promotionCode: '',
    autoGenerateCode: true,
    discountType: 'percentage', // 'percentage' or 'fixed'
    discountValue: '',
    applicableTo: 'all', // 'all', 'services', 'products', 'specific'
    specificServices: [], // Array of service IDs
    specificProducts: [], // Array of product IDs
    usageType: 'repeating', // 'one-time' or 'repeating'
    maxUses: '', // For repeating promotions
    startDate: '',
    endDate: '',
    isActive: true,
    emailToClients: false // Checkbox to email clients when creating
  });

  // Load promotions
  const loadPromotions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!userData?.branchId) {
        setError('Branch ID not found');
        setLoading(false);
        return;
      }

      const promotionsRef = collection(db, 'promotions');
      const q = query(promotionsRef, where('branchId', '==', userData.branchId));
      const snapshot = await getDocs(q);
      const promotionsList = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        promotionsList.push({
          id: doc.id,
          title: data.title || '',
          description: data.description || '',
          discountType: data.discountType || 'percentage',
          discountValue: data.discountValue || 0,
          applicableTo: data.applicableTo || 'all',
          specificServices: data.specificServices || [],
          specificProducts: data.specificProducts || [],
          startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.startDate ? new Date(data.startDate) : new Date()),
          endDate: data.endDate?.toDate ? data.endDate.toDate() : (data.endDate ? new Date(data.endDate) : new Date()),
          isActive: data.isActive !== false,
          promotionCode: data.promotionCode || '',
          usageType: data.usageType || 'repeating',
          maxUses: data.maxUses || null,
          usedBy: data.usedBy || [], // Array of client IDs who used it (for one-time use)
          usageCount: data.usageCount || 0, // Total usage count (for repeating)
          sentTo: data.sentTo || [],
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date())
        });
      });
      
      // Sort by createdAt descending
      promotionsList.sort((a, b) => b.createdAt - a.createdAt);
      
      setPromotions(promotionsList);
    } catch (err) {
      console.error('Error loading promotions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load clients - Get ALL clients, not just those who visited this branch
  const loadClients = async () => {
    try {
      // Use getClients() to get all clients regardless of branch visits
      const clientsList = await getClients();
      setClients(clientsList);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  };

  // Load services and products for selection
  const loadServicesAndProducts = async () => {
    try {
      if (!userData?.branchId) return;
      
      // Load services for this branch using branchServicesService
      const services = await getBranchServices(userData.branchId);
      setAvailableServices(services);
      
      // Load products
      const productsResult = await productService.getAllProducts();
      if (productsResult.success) {
        setAvailableProducts(productsResult.products);
      }
    } catch (err) {
      console.error('Error loading services/products:', err);
    }
  };

  // Generate unique promotion code in format: DS-{first3BranchId}-{random}
  const generatePromotionCode = () => {
    if (!userData?.branchId) {
      // Fallback if no branch ID
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let random = '';
      for (let i = 0; i < 5; i++) {
        random += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return `DS-XXX-${random}`;
    }
    
    // Get first 3 characters of branch ID (uppercase)
    const branchPrefix = userData.branchId.substring(0, 3).toUpperCase();
    
    // Generate random 5-character suffix
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars
    let random = '';
    for (let i = 0; i < 5; i++) {
      random += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return `DS-${branchPrefix}-${random}`;
  };

  // Check if promotion code is unique
  const checkCodeUniqueness = async (code, excludeId = null) => {
    try {
      const promotionsRef = collection(db, 'promotions');
      const q = query(promotionsRef, where('promotionCode', '==', code.toUpperCase()));
      const snapshot = await getDocs(q);
      
      // Check if code exists and is not the current promotion being edited
      const exists = snapshot.docs.some(doc => doc.id !== excludeId);
      return !exists;
    } catch (err) {
      console.error('Error checking code uniqueness:', err);
      return false;
    }
  };

  // Load data on mount
  useEffect(() => {
    loadPromotions();
    loadClients();
    loadServicesAndProducts();
  }, [userData?.branchId]);

  // Load AI promotion recommendations when data is available
  useEffect(() => {
    if (promotions.length > 0 && clients.length > 0 && openaiService.isConfigured()) {
      loadPromotionAIRecommendations();
    }
  }, [promotions, clients]);

  // Load AI promotion recommendations
  const loadPromotionAIRecommendations = async () => {
    if (!openaiService.isConfigured() || promotions.length === 0 || clients.length === 0) return;
    
    try {
      setLoadingPromotionAI(true);
      
      // Calculate client metrics
      const clientMetrics = {
        totalClients: clients.length,
        avgSpending: 0, // Would need transaction data
        avgVisits: 0 // Would need transaction data
      };
      
      const recommendations = await openaiService.generatePromotionRecommendations(
        clientMetrics,
        [] // Product sales data would go here if available
      );
      
      if (recommendations) {
        setPromotionRecommendations(recommendations);
      }
    } catch (error) {
      console.error('Error loading promotion AI recommendations:', error);
    } finally {
      setLoadingPromotionAI(false);
    }
  };

  // Auto-generate code when autoGenerateCode is true or when modal opens
  useEffect(() => {
    if (isCreateModalOpen && formData.autoGenerateCode && !formData.promotionCode) {
      setFormData(prev => ({ ...prev, promotionCode: generatePromotionCode() }));
    }
  }, [isCreateModalOpen, formData.autoGenerateCode, userData?.branchId]);

  // Get promotion status
  const getPromotionStatus = (promotion) => {
    const now = new Date();
    const startDate = new Date(promotion.startDate);
    const endDate = new Date(promotion.endDate);
    
    if (!promotion.isActive) {
      return { status: 'inactive', label: 'Inactive', color: 'text-gray-600 bg-gray-100 border-gray-200' };
    }
    
    if (now < startDate) {
      return { status: 'upcoming', label: 'Upcoming', color: 'text-blue-600 bg-blue-100 border-blue-200' };
    }
    
    if (now > endDate) {
      return { status: 'expired', label: 'Expired', color: 'text-red-600 bg-red-100 border-red-200' };
    }
    
    return { status: 'active', label: 'Active', color: 'text-green-600 bg-green-100 border-green-200' };
  };

  // Filter promotions
  const filteredPromotions = promotions.filter(promotion => {
    const matchesSearch = 
      promotion.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      promotion.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const promotionStatus = getPromotionStatus(promotion);
    const matchesStatus = statusFilter === 'all' || promotionStatus.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Handle create promotion
  const handleCreatePromotion = async (e) => {
    e.preventDefault();
    
    try {
      setError(null);
      
      // Validations
      if (!userData?.branchId) {
        setError('Branch ID not found');
        return;
      }

      if (!formData.title.trim()) {
        setError('Promotion title is required');
        return;
      }

      if (!formData.description.trim()) {
        setError('Promotion description is required');
        return;
      }

      // Validate promotion code
      const code = formData.promotionCode.trim().toUpperCase();
      if (!code) {
        setError('Promotion code is required');
        return;
      }

      if (code.length < 4 || code.length > 20) {
        setError('Promotion code must be between 4 and 20 characters');
        return;
      }

      // Check code uniqueness
      const isUnique = await checkCodeUniqueness(code);
      if (!isUnique) {
        setError('This promotion code already exists. Please use a different code.');
        return;
      }

      // Validate discount value
      const discountValue = parseFloat(formData.discountValue);
      if (isNaN(discountValue) || discountValue <= 0) {
        setError('Discount value must be greater than 0');
        return;
      }

      if (formData.discountType === 'percentage' && discountValue > 100) {
        setError('Percentage discount cannot exceed 100%');
        return;
      }

      // Validate dates
      if (!formData.startDate || !formData.endDate) {
        setError('Start date and end date are required');
        return;
      }

      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      const now = new Date();

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        setError('Invalid date format');
        return;
      }

      if (endDate <= startDate) {
        setError('End date must be after start date');
        return;
      }

      // Validate usage type and max uses
      if (formData.usageType === 'repeating' && formData.maxUses) {
        const maxUses = parseInt(formData.maxUses);
        if (isNaN(maxUses) || maxUses <= 0) {
          setError('Max uses must be a positive number');
          return;
        }
      }

      // Validate specific services/products if applicableTo is 'specific'
      if (formData.applicableTo === 'specific') {
        if (formData.specificServices.length === 0 && formData.specificProducts.length === 0) {
          setError('Please select at least one service or product');
          return;
        }
      }

      const promotionData = {
        branchId: userData.branchId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        promotionCode: code,
        discountType: formData.discountType,
        discountValue: discountValue,
        applicableTo: formData.applicableTo,
        specificServices: formData.specificServices || [],
        specificProducts: formData.specificProducts || [],
        usageType: formData.usageType,
        maxUses: formData.usageType === 'repeating' && formData.maxUses ? parseInt(formData.maxUses) : null,
        usedBy: [], // For one-time use tracking
        usageCount: 0, // For repeating use tracking
        startDate: startDate,
        endDate: endDate,
        isActive: formData.isActive,
        sentTo: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userData.uid || userData.id,
        createdByName: (userData.firstName && userData.lastName
          ? `${userData.firstName} ${userData.lastName}`.trim()
          : (userData.email || 'Unknown'))
      };

      const promotionRef = await addDoc(collection(db, 'promotions'), promotionData);
      const newPromotion = { id: promotionRef.id, ...promotionData };
      
      // If email to clients is checked, send emails
      if (formData.emailToClients) {
        console.log('📧 EMAIL TO CLIENTS ENABLED - Starting email sending process...');
        console.log('📧 Total clients loaded:', clients.length);
        
        try {
          setError(null);
          const clientsWithEmail = clients.filter(c => c.email);
          console.log('📧 Clients with email addresses:', clientsWithEmail.length);
          console.log('📧 Clients with emails:', clientsWithEmail.map(c => ({ id: c.id, name: c.firstName + ' ' + c.lastName, email: c.email })));
          
          if (clientsWithEmail.length === 0) {
            console.warn('⚠️ No clients with email addresses found');
            setError('No clients with email addresses found. Promotion created but no emails sent.');
          } else {
            console.log(`📧 Starting to send emails to ${clientsWithEmail.length} client(s)...`);
            let successCount = 0;
            let failCount = 0;
            const sentToIds = [];

            for (let i = 0; i < clientsWithEmail.length; i++) {
              const client = clientsWithEmail[i];
              console.log(`📧 [${i + 1}/${clientsWithEmail.length}] Processing email for client:`, {
                id: client.id,
                name: `${client.firstName} ${client.lastName}`,
                email: client.email
              });
              
              try {
                console.log(`📧 Calling sendPromotionEmail for ${client.email}...`);
                const result = await sendPromotionEmail(newPromotion, client);
                console.log(`📧 Email result for ${client.email}:`, result);
                
                if (result.success) {
                  console.log(`✅ Successfully sent email to ${client.email}`);
                  successCount++;
                  sentToIds.push(client.id);
                } else {
                  console.error(`❌ Failed to send email to ${client.email}:`, result.message || 'Unknown error');
                  failCount++;
                }
              } catch (err) {
                console.error(`❌ Exception sending email to ${client.email}:`, err);
                console.error('Error details:', {
                  message: err.message,
                  stack: err.stack,
                  name: err.name
                });
                failCount++;
              }
            }

            console.log('📧 Email sending summary:', {
              total: clientsWithEmail.length,
              success: successCount,
              failed: failCount,
              sentToIds: sentToIds
            });

            // Update promotion with sentTo list
            if (sentToIds.length > 0) {
              console.log('📧 Updating promotion with sentTo list:', sentToIds);
              await updateDoc(promotionRef, {
                sentTo: sentToIds,
                updatedAt: serverTimestamp()
              });
              console.log('✅ Promotion updated with sentTo list');
            } else {
              console.warn('⚠️ No emails were successfully sent, not updating sentTo list');
            }

            if (successCount > 0) {
              const message = `Promotion created and sent to ${successCount} client(s)${failCount > 0 ? ` (${failCount} failed)` : ''}!`;
              console.log('✅ SUCCESS:', message);
              setSendSuccessMessage(message);
              setIsSuccessModalOpen(true);
            } else {
              console.error('❌ All emails failed to send');
              setError('Promotion created but failed to send emails to clients.');
            }
          }
        } catch (err) {
          console.error('❌ CRITICAL ERROR in email sending process:', err);
          console.error('Error details:', {
            message: err.message,
            stack: err.stack,
            name: err.name,
            code: err.code
          });
          setError('Promotion created but failed to send emails. You can send them manually later.');
        }
      } else {
        console.log('📧 Email to clients is DISABLED - skipping email sending');
      }
      
      setIsCreateModalOpen(false);
      setFormData({
        title: '',
        description: '',
        promotionCode: '',
        autoGenerateCode: true,
        discountType: 'percentage',
        discountValue: '',
        applicableTo: 'all',
        specificServices: [],
        specificProducts: [],
        usageType: 'repeating',
        maxUses: '',
        startDate: '',
        endDate: '',
        isActive: true,
        emailToClients: false
      });
      
      await loadPromotions();
    } catch (err) {
      console.error('Error creating promotion:', err);
      setError(err.message || 'Failed to create promotion');
    }
  };

  // Handle send promotion confirmation
  const handleSendPromotionConfirm = () => {
    if (!selectedPromotion || selectedClients.size === 0) {
      setError('Please select at least one client');
      return;
    }
    setIsConfirmSendModalOpen(true);
  };

  // Handle send promotion emails
  const handleSendPromotion = async () => {
    if (!selectedPromotion || selectedClients.size === 0) {
      setError('Please select at least one client');
      setIsConfirmSendModalOpen(false);
      return;
    }

    try {
      setIsSending(true);
      setError(null);
      setIsConfirmSendModalOpen(false);

      const selectedClientsList = Array.from(selectedClients);
      const clientsToEmail = clients.filter(c => selectedClientsList.includes(c.id));
      
      // Send emails to selected clients
      const emailResults = [];
      for (const client of clientsToEmail) {
        if (client.email) {
          try {
            // Create promotion email content
            const emailContent = {
              subject: `🎉 Special Promotion: ${selectedPromotion.title}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #160B53;">${selectedPromotion.title}</h2>
                  <p>${selectedPromotion.description}</p>
                  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #160B53; margin-top: 0;">Discount Details</h3>
                    <p style="font-size: 24px; font-weight: bold; color: #10b981;">
                      ${selectedPromotion.discountType === 'percentage' 
                        ? `${selectedPromotion.discountValue}% OFF`
                        : `₱${selectedPromotion.discountValue} OFF`}
                    </p>
                    <p><strong>Valid from:</strong> ${format(new Date(selectedPromotion.startDate), 'MMM dd, yyyy')}</p>
                    <p><strong>Valid until:</strong> ${format(new Date(selectedPromotion.endDate), 'MMM dd, yyyy')}</p>
                  </div>
                  <p style="color: #6b7280; font-size: 14px;">
                    Don't miss out on this amazing offer! Visit us soon to take advantage of this promotion.
                  </p>
                </div>
              `
            };

            // Actually send email using emailService
            console.log(`📧 Calling sendPromotionEmail for ${client.email}...`);
            const result = await sendPromotionEmail(selectedPromotion, client);
            console.log(`📧 Email result for ${client.email}:`, result);
            
            if (result.success) {
              console.log(`✅ Successfully sent email to ${client.email}`);
              emailResults.push({ clientId: client.id, email: client.email, success: true });
            } else {
              console.error(`❌ Failed to send email to ${client.email}:`, result.message || 'Unknown error');
              emailResults.push({ clientId: client.id, email: client.email, success: false, error: result.message });
            }
          } catch (err) {
            console.error(`Error sending email to ${client.email}:`, err);
            emailResults.push({ clientId: client.id, email: client.email, success: false, error: err.message });
          }
        }
      }

      // Update promotion with sentTo list
      const promotionRef = doc(db, 'promotions', selectedPromotion.id);
      const currentSentTo = selectedPromotion.sentTo || [];
      const updatedSentTo = [...new Set([...currentSentTo, ...selectedClientsList])];
      
      await updateDoc(promotionRef, {
        sentTo: updatedSentTo,
        updatedAt: serverTimestamp()
      });

      setIsSendModalOpen(false);
      setSelectedClients(new Set());
      setSelectedPromotion(null);
      
      await loadPromotions();
      
      // Show success modal instead of alert
      const successCount = emailResults.filter(r => r.success).length;
      const failCount = emailResults.filter(r => !r.success).length;
      let message = `Promotion sent to ${successCount} client(s) successfully!`;
      if (failCount > 0) {
        message += ` (${failCount} failed)`;
      }
      setSendSuccessMessage(message);
      setIsSuccessModalOpen(true);
    } catch (err) {
      console.error('Error sending promotion:', err);
      setError(err.message || 'Failed to send promotion');
      setIsConfirmSendModalOpen(false);
    } finally {
      setIsSending(false);
    }
  };

  // Handle delete promotion
  const handleDeletePromotion = async (promotionId) => {
    if (!window.confirm('Are you sure you want to delete this promotion?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'promotions', promotionId));
      await loadPromotions();
    } catch (err) {
      console.error('Error deleting promotion:', err);
      setError(err.message || 'Failed to delete promotion');
    }
  };

  // Toggle client selection
  const toggleClientSelection = (clientId) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClients(newSelected);
  };

  // Select all clients
  const selectAllClients = () => {
    const allClientIds = clients.filter(c => c.email).map(c => c.id);
    setSelectedClients(new Set(allClientIds));
  };

  // Deselect all clients
  const deselectAllClients = () => {
    setSelectedClients(new Set());
  };

  if (loading) {
    return (
      
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-[#160B53]" />
        <span className="ml-2 text-gray-600">Loading promotions...</span>
      </div>
      
    );
  }

  return (
    
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
          <p className="text-gray-600">Create and manage promotional offers for your clients</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              setIsCreateModalOpen(true);
              // Generate code when opening modal
              setFormData(prev => ({
                ...prev,
                promotionCode: generatePromotionCode()
              }));
            }}
            className="flex items-center gap-2 bg-[#160B53] text-white hover:bg-[#12094A]"
          >
            <Plus className="h-4 w-4" />
            Create Promotion
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        </Card>
      )}

      {/* AI Promotion Recommendations */}
      {openaiService.isConfigured() && (
        <Card className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">AI-Powered Promotion Strategies</h3>
                <p className="text-sm text-gray-600">Smart recommendations to boost your marketing</p>
              </div>
            </div>
            {loadingPromotionAI && (
              <Loader2Icon className="h-5 w-5 animate-spin text-purple-600" />
            )}
          </div>
            
          {promotionRecommendations && !loadingPromotionAI ? (
            <div className="space-y-4">
              {promotionRecommendations.promotions && promotionRecommendations.promotions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Promotion Ideas</h4>
                  <ul className="space-y-1">
                    {promotionRecommendations.promotions.map((promo, idx) => (
                      <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-purple-600 mt-1">•</span>
                        <span>{typeof promo === 'string' ? promo : promo}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
                
              {promotionRecommendations.targetAudience && promotionRecommendations.targetAudience.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Target Audience</h4>
                  <ul className="space-y-1">
                    {promotionRecommendations.targetAudience.map((audience, idx) => (
                      <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-blue-600 mt-1">→</span>
                        <span>{typeof audience === 'string' ? audience : audience}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
                
              {promotionRecommendations.discountStrategy && promotionRecommendations.discountStrategy.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Discount Strategies</h4>
                  <ul className="space-y-1">
                    {promotionRecommendations.discountStrategy.map((strategy, idx) => (
                      <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-green-600 mt-1">★</span>
                        <span>{typeof strategy === 'string' ? strategy : strategy}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : !loadingPromotionAI && (
            <Button
              onClick={loadPromotionAIRecommendations}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Generate AI Recommendations
            </Button>
          )}
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <Megaphone className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Promotions</p>
              <p className="text-xl font-bold text-gray-900">{promotions.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-xl font-bold text-gray-900">
                {promotions.filter(p => getPromotionStatus(p).status === 'active').length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Upcoming</p>
              <p className="text-xl font-bold text-gray-900">
                {promotions.filter(p => getPromotionStatus(p).status === 'upcoming').length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Clients</p>
              <p className="text-xl font-bold text-gray-900">{clients.filter(c => c.email).length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search promotions by title or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="upcoming">Upcoming</option>
              <option value="expired">Expired</option>
              <option value="inactive">Inactive</option>
            </select>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {/* Promotions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPromotions.map((promotion) => {
          const status = getPromotionStatus(promotion);
          return (
            <Card key={promotion.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{promotion.title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{promotion.description}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                    {status.status === 'active' && <CheckCircle className="h-3 w-3" />}
                    {status.status === 'upcoming' && <Clock className="h-3 w-3" />}
                    {status.status === 'expired' && <XCircle className="h-3 w-3" />}
                    {status.status === 'inactive' && <XCircle className="h-3 w-3" />}
                    {status.label}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-4 w-4 text-green-600" />
                    <span className="text-lg font-bold text-green-600">
                      {promotion.discountType === 'percentage' 
                        ? `${promotion.discountValue}% OFF`
                        : `₱${promotion.discountValue} OFF`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>{format(new Date(promotion.startDate), 'MMM dd')} - {format(new Date(promotion.endDate), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                    <Users className="h-4 w-4" />
                    <span>Sent to {promotion.sentTo?.length || 0} client(s)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                    <Tag className="h-4 w-4" />
                    <span className="font-mono font-semibold text-[#160B53]">{promotion.promotionCode || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                    {promotion.usageType === 'one-time' ? (
                      <>
                        <span>One-time use</span>
                        <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                          {promotion.usedBy?.length || 0} used
                        </span>
                      </>
                    ) : (
                      <>
                        <span>Repeating</span>
                        {promotion.maxUses && (
                          <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                            {promotion.usageCount || 0}/{promotion.maxUses} uses
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedPromotion(promotion);
                      setIsDetailsModalOpen(true);
                    }}
                    className="flex-1 flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedPromotion(promotion);
                      setSelectedClients(new Set());
                      setIsSendModalOpen(true);
                    }}
                    className="flex-1 flex items-center gap-2"
                    disabled={status.status === 'expired' || status.status === 'inactive'}
                  >
                    <Mail className="h-4 w-4" />
                    Send
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeletePromotion(promotion.id)}
                    className="flex items-center gap-2 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredPromotions.length === 0 && (
        <Card className="p-12 text-center">
          <Megaphone className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Promotions Found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first promotion to attract more clients'}
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 mx-auto">
            <Plus className="h-4 w-4" />
            Create Promotion
          </Button>
        </Card>
      )}

      {/* Create Promotion Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setFormData({
              title: '',
              description: '',
              promotionCode: '',
              autoGenerateCode: true,
              discountType: 'percentage',
              discountValue: '',
              applicableTo: 'all',
              specificServices: [],
              specificProducts: [],
              usageType: 'repeating',
              maxUses: '',
              startDate: '',
              endDate: '',
              isActive: true,
              emailToClients: false
            });
          }}
          title="Create Promotion"
          size="lg"
        >
          <form onSubmit={handleCreatePromotion} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Promotion Title <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., 10% Off Haircut Special"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your promotion..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Promotion Code <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="text"
                  value={formData.promotionCode}
                  placeholder="DS-XXX-XXXXX"
                  className="flex-1 font-mono"
                  required
                  readOnly
                />
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, promotionCode: generatePromotionCode() }));
                  }}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  title="Generate new code"
                >
                  🔄
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Format: DS-{userData?.branchId ? userData.branchId.substring(0, 3).toUpperCase() : 'XXX'}-XXXXX (auto-generated)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.discountType}
                  onChange={(e) => setFormData(prev => ({ ...prev, discountType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                  required
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₱)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Value <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => setFormData(prev => ({ ...prev, discountValue: e.target.value }))}
                  placeholder={formData.discountType === 'percentage' ? '10' : '100'}
                  min="0"
                  step={formData.discountType === 'percentage' ? '1' : '0.01'}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Applicable To <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.applicableTo}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  applicableTo: e.target.value,
                  specificServices: e.target.value !== 'specific' ? [] : prev.specificServices,
                  specificProducts: e.target.value !== 'specific' ? [] : prev.specificProducts
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                required
              >
                <option value="all">All Services & Products</option>
                <option value="services">All Services</option>
                <option value="products">All Products</option>
                <option value="specific">Specific Services/Products</option>
              </select>
            </div>

            {formData.applicableTo === 'specific' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Services
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
                    {availableServices.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No services available</p>
                    ) : (
                      <div className="space-y-2">
                        {availableServices.map(service => (
                          <label key={service.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.specificServices.includes(service.id)}
                              onChange={(e) => {
                                const serviceId = service.id;
                                if (e.target.checked) {
                                  setFormData(prev => ({
                                    ...prev,
                                    specificServices: [...prev.specificServices, serviceId]
                                  }));
                                } else {
                                  setFormData(prev => ({
                                    ...prev,
                                    specificServices: prev.specificServices.filter(id => id !== serviceId)
                                  }));
                                }
                              }}
                              className="w-4 h-4 text-[#160B53] border-gray-300 rounded focus:ring-[#160B53]"
                            />
                            <span className="text-sm text-gray-900">{service.name || service.serviceName}</span>
                            <span className="text-xs text-gray-500 ml-auto">
                              ₱{service.price || (service.branchPricing?.[userData?.branchId]) || 0}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {formData.specificServices.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.specificServices.length} service(s) selected
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Products
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
                    {availableProducts.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No products available</p>
                    ) : (
                      <div className="space-y-2">
                        {availableProducts.map(product => (
                          <label key={product.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.specificProducts.includes(product.id)}
                              onChange={(e) => {
                                const productId = product.id;
                                if (e.target.checked) {
                                  setFormData(prev => ({
                                    ...prev,
                                    specificProducts: [...prev.specificProducts, productId]
                                  }));
                                } else {
                                  setFormData(prev => ({
                                    ...prev,
                                    specificProducts: prev.specificProducts.filter(id => id !== productId)
                                  }));
                                }
                              }}
                              className="w-4 h-4 text-[#160B53] border-gray-300 rounded focus:ring-[#160B53]"
                            />
                            <span className="text-sm text-gray-900">{product.name}</span>
                            <span className="text-xs text-gray-500 ml-auto">
                              ₱{product.otcPrice || product.unitCost || 0}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {formData.specificProducts.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.specificProducts.length} product(s) selected
                    </p>
                  )}
                </div>

                {(formData.specificServices.length === 0 && formData.specificProducts.length === 0) && (
                  <p className="text-xs text-red-500">
                    Please select at least one service or product
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Usage Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.usageType}
                onChange={(e) => setFormData(prev => ({ ...prev, usageType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                required
              >
                <option value="repeating">Repeating (can be used multiple times)</option>
                <option value="one-time">One-time use (per client)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {formData.usageType === 'one-time' 
                  ? 'Each client can only use this promotion once.'
                  : 'This promotion can be used multiple times by any client.'}
              </p>
            </div>

            {formData.usageType === 'repeating' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Uses (Optional)
                </label>
                <Input
                  type="number"
                  value={formData.maxUses}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxUses: e.target.value }))}
                  placeholder="Leave empty for unlimited"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum number of times this promotion can be used. Leave empty for unlimited.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-[#160B53] border-gray-300 rounded focus:ring-[#160B53]"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Active (promotion will be visible to clients)
                </label>
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <input
                  type="checkbox"
                  id="emailToClients"
                  checked={formData.emailToClients}
                  onChange={(e) => setFormData(prev => ({ ...prev, emailToClients: e.target.checked }))}
                  className="w-4 h-4 text-[#160B53] border-gray-300 rounded focus:ring-[#160B53]"
                />
                <label htmlFor="emailToClients" className="text-sm font-medium text-gray-900 cursor-pointer">
                  📧 Email this promotion to all clients
                </label>
              </div>
              {formData.emailToClients && (
                <p className="text-xs text-gray-600 ml-6 -mt-2">
                  All clients with email addresses will receive this promotion via email when you create it.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setFormData({
                    title: '',
                    description: '',
                    promotionCode: '',
                    autoGenerateCode: true,
                    discountType: 'percentage',
                    discountValue: '',
                    applicableTo: 'all',
                    specificServices: [],
                    specificProducts: [],
                    usageType: 'repeating',
                    maxUses: '',
                    startDate: '',
                    endDate: '',
                    isActive: true
                  });
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-[#160B53] text-white hover:bg-[#12094A]">
                Create Promotion
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Promotion Details Modal */}
      {isDetailsModalOpen && selectedPromotion && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedPromotion(null);
          }}
          title="Promotion Details"
          size="lg"
        >
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedPromotion.title}</h2>
              <p className="text-gray-600">{selectedPromotion.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Discount</label>
                <p className="text-lg font-semibold text-green-600">
                  {selectedPromotion.discountType === 'percentage' 
                    ? `${selectedPromotion.discountValue}% OFF`
                    : `₱${selectedPromotion.discountValue} OFF`}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Applicable To</label>
                <p className="text-gray-900 capitalize">{selectedPromotion.applicableTo}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Start Date</label>
                <p className="text-gray-900">{format(new Date(selectedPromotion.startDate), 'MMM dd, yyyy HH:mm')}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">End Date</label>
                <p className="text-gray-900">{format(new Date(selectedPromotion.endDate), 'MMM dd, yyyy HH:mm')}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Promotion Code</label>
              <p className="text-gray-900 font-mono font-semibold text-lg">{selectedPromotion.promotionCode || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Usage Type</label>
              <p className="text-gray-900 capitalize">
                {selectedPromotion.usageType === 'one-time' ? 'One-time use' : 'Repeating'}
              </p>
            </div>
            {selectedPromotion.usageType === 'one-time' && (
              <div>
                <label className="text-sm font-medium text-gray-500">Used By</label>
                <p className="text-gray-900">
                  {selectedPromotion.usedBy?.length || 0} client(s)
                </p>
              </div>
            )}
            {selectedPromotion.usageType === 'repeating' && selectedPromotion.maxUses && (
              <div>
                <label className="text-sm font-medium text-gray-500">Usage Count</label>
                <p className="text-gray-900">
                  {selectedPromotion.usageCount || 0} / {selectedPromotion.maxUses} uses
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500">Sent To</label>
              <p className="text-gray-900">
                {selectedPromotion.sentTo?.length || 0} client(s)
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Send Promotion Modal */}
      {isSendModalOpen && selectedPromotion && (
        <Modal
          isOpen={isSendModalOpen}
          onClose={() => {
            setIsSendModalOpen(false);
            setSelectedClients(new Set());
            setSelectedPromotion(null);
          }}
          title="Send Promotion to Clients"
          size="lg"
        >
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-1">{selectedPromotion.title}</h3>
              <p className="text-sm text-blue-700">
                {selectedPromotion.discountType === 'percentage' 
                  ? `${selectedPromotion.discountValue}% OFF`
                  : `₱${selectedPromotion.discountValue} OFF`}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Select clients to send this promotion to ({selectedClients.size} selected)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllClients}
                  className="text-xs"
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deselectAllClients}
                  className="text-xs"
                >
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              {clients.filter(c => c.email).length > 0 ? (
                <div className="divide-y">
                  {clients.filter(c => c.email).map((client) => (
                    <div
                      key={client.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer flex items-center gap-3"
                      onClick={() => toggleClientSelection(client.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedClients.has(client.id)}
                        onChange={() => toggleClientSelection(client.id)}
                        className="w-4 h-4 text-[#160B53] border-gray-300 rounded focus:ring-[#160B53]"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {client.firstName && client.lastName
                            ? `${client.firstName} ${client.lastName}`.trim()
                            : client.name || 'Unknown Client'}
                        </p>
                        <p className="text-xs text-gray-500">{client.email}</p>
                      </div>
                      {selectedPromotion.sentTo?.includes(client.id) && (
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                          Already Sent
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No clients with email addresses found</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsSendModalOpen(false);
                  setSelectedClients(new Set());
                  setSelectedPromotion(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendPromotionConfirm}
                disabled={selectedClients.size === 0 || isSending}
                className="bg-[#160B53] text-white hover:bg-[#12094A]"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send to {selectedClients.size} Client(s)
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Send Promotion Modal */}
      {isConfirmSendModalOpen && selectedPromotion && (
        <Modal
          isOpen={isConfirmSendModalOpen}
          onClose={() => setIsConfirmSendModalOpen(false)}
          title="Confirm Send Promotion"
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">{selectedPromotion.title}</h3>
              <p className="text-sm text-blue-700">
                {selectedPromotion.discountType === 'percentage' 
                  ? `${selectedPromotion.discountValue}% OFF`
                  : `₱${selectedPromotion.discountValue} OFF`}
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Are you sure you want to send this promotion to {selectedClients.size} selected client(s)?</strong>
              </p>
              <p className="text-xs text-yellow-700 mt-2">
                This will send promotional emails to all selected clients. This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsConfirmSendModalOpen(false)}
                disabled={isSending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendPromotion}
                disabled={isSending}
                className="bg-[#160B53] text-white hover:bg-[#12094A]"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Confirm & Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Success Modal */}
      {isSuccessModalOpen && (
        <Modal
          isOpen={isSuccessModalOpen}
          onClose={() => setIsSuccessModalOpen(false)}
          title="Promotion Sent Successfully"
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <p className="text-green-800 font-medium">{sendSuccessMessage}</p>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => setIsSuccessModalOpen(false)}
                className="bg-[#160B53] text-white hover:bg-[#12094A]"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
    
  );
};

export default Promotions;

