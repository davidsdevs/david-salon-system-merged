/**
 * Services Management Page
 * For Branch Managers to configure which global services to offer and set prices
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Package, ArrowLeft, Printer, Download, FileText, Palette, Sparkles, X, GripVertical, Image as ImageIcon, Eye, Save, Edit2, Upload, Grid3x3, Columns, Rows, Minus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  getBranchServices, 
  getAllServicesWithBranchConfig,
  setBranchPrice,
  disableBranchService,
  getServiceCategories
} from '../../services/branchServicesService';
import { getBranchById } from '../../services/branchService';
import { getAppointments, APPOINTMENT_STATUS } from '../../services/appointmentService';
import { getCatalogConfig, saveCatalogConfig } from '../../services/catalogService';
import { uploadToCloudinary } from '../../services/imageService';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import BranchServicePriceModal from '../../components/branch/BranchServicePriceModal';
import Button from '../../components/ui/Button';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import toast from 'react-hot-toast';

// Sortable Category Component
const SortableCategory = ({ category, isEditMode, onServiceDragEnd, onIconUpload, catalogStyle, fontSizes, currentTheme, serviceSensors }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const serviceIds = category.services.map(s => s.id);

  return (
    <div ref={setNodeRef} style={style} className="mb-10">
      {/* Category Header */}
      <div className="mb-6 flex items-center gap-3">
        {isEditMode && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
            <GripVertical className="h-5 w-5" />
          </div>
        )}
        <h2 className={`${fontSizes.category} font-bold ${currentTheme.accent} uppercase tracking-wide border-b-2 ${currentTheme.border} pb-2 flex-1`}>
          {category.name}
        </h2>
      </div>

      {/* Services List */}
      {isEditMode ? (
        <DndContext
          sensors={serviceSensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => onServiceDragEnd(category.id, e)}
        >
          <SortableContext items={serviceIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {category.services.map((service) => (
                <SortableServiceItem
                  key={service.id}
                  service={service}
                  categoryId={category.id}
                  isEditMode={isEditMode}
                  onIconUpload={onIconUpload}
                  catalogStyle={catalogStyle}
                  fontSizes={fontSizes}
                  currentTheme={currentTheme}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-4">
          {category.services.map((service) => (
            <div
              key={service.id}
              className="flex justify-between items-start py-3 border-b border-gray-200 last:border-b-0"
            >
              <div className="flex-1 pr-4 flex items-center gap-3">
                {service.catalogIcon && (
                  <img
                    src={service.catalogIcon}
                    alt={service.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className={`font-semibold ${fontSizes.service} text-gray-900`}>
                      {service.name}
                    </h3>
                    {catalogStyle.showDuration && service.duration && (
                      <span className={`${fontSizes.description} text-gray-500 font-normal`}>
                        ({service.duration} min)
                      </span>
                    )}
                  </div>
                  {catalogStyle.showDescriptions && service.description && (
                    <p className={`${fontSizes.description} text-gray-600 mt-1 italic`}>
                      {service.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className={`font-bold ${fontSizes.price} ${currentTheme.accent} whitespace-nowrap`}>
                  ₱{service.price?.toLocaleString() || '0'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Sortable Service Item Component
const SortableServiceItem = ({ service, categoryId, isEditMode, onIconUpload, catalogStyle, fontSizes, currentTheme }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: service.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onIconUpload(service.id, categoryId, file);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex justify-between items-start py-3 border-b border-gray-200 last:border-b-0"
    >
      <div className="flex-1 pr-4 flex items-start gap-3">
        {isEditMode && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 mt-1">
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <div className="flex items-center gap-3 flex-1">
          {/* Icon */}
          <div className="relative group">
            {service.catalogIcon ? (
              <img
                src={service.catalogIcon}
                alt={service.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-gray-400" />
              </div>
            )}
            {isEditMode && (
              <label className="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                <Upload className="w-4 h-4 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h3 className={`font-semibold ${fontSizes.service} text-gray-900`}>
                {service.name}
              </h3>
              {catalogStyle.showDuration && service.duration && (
                <span className={`${fontSizes.description} text-gray-500 font-normal`}>
                  ({service.duration} min)
                </span>
              )}
            </div>
            {catalogStyle.showDescriptions && service.description && (
              <p className={`${fontSizes.description} text-gray-600 mt-1 italic`}>
                {service.description}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        <span className={`font-bold ${fontSizes.price} ${currentTheme.accent} whitespace-nowrap`}>
          ₱{service.price?.toLocaleString() || '0'}
        </span>
      </div>
    </div>
  );
};

const ServicesManagement = () => {
  const { currentUser, userBranch } = useAuth();
  const navigate = useNavigate();
  const [allServices, setAllServices] = useState([]);
  const [offeredServices, setOfferedServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [serviceToDisable, setServiceToDisable] = useState(null);
  const [filterMode, setFilterMode] = useState('all'); // 'all' or 'offered'
  
  // Service Catalog states
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [branch, setBranch] = useState(null);
  const printRef = useRef();
  const mockupPrintRef = useRef();
  const [catalogStyle, setCatalogStyle] = useState({
    theme: 'elegant', // 'elegant', 'modern', 'classic'
    showDescriptions: true,
    showDuration: true,
    fontSize: 'medium', // 'small', 'medium', 'large'
    gridColumns: 2, // Number of columns in grid layout
    gridRows: null // Auto-calculated based on categories
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [showMockup, setShowMockup] = useState(false);
  const [catalogData, setCatalogData] = useState(null); // Stores ordered categories and services with icons
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [gridLayout, setGridLayout] = useState(null); // Stores grid positions: { categoryId: { row, col } }
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (userBranch) {
      fetchServices();
    }
  }, [userBranch]);

  useEffect(() => {
    applyFilters();
  }, [allServices, offeredServices, searchTerm, categoryFilter, filterMode]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      // Get all services with branch config
      const allData = await getAllServicesWithBranchConfig(userBranch);
      setAllServices(allData);
      
      // Get only offered services
      const offeredData = await getBranchServices(userBranch);
      setOfferedServices(offeredData);
      
      // Fetch branch info for catalog
      if (userBranch && !branch) {
        try {
          const branchData = await getBranchById(userBranch);
          setBranch(branchData);
        } catch (err) {
          console.error('Error fetching branch:', err);
        }
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    // Start with all or offered based on filter mode
    let filtered;
    if (filterMode === 'offered') {
      // My Services: only show services offered by this branch
      filtered = [...offeredServices];
    } else {
      // All Available: only show services NOT offered by this branch
      filtered = allServices.filter(service => !service.isOfferedByBranch);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(service =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(service => service.category === categoryFilter);
    }

    setFilteredServices(filtered);
  };

  const handleSetPrice = (service) => {
    setSelectedService(service);
    setShowPriceModal(true);
  };

  const handlePriceSubmit = async (price) => {
    if (!selectedService) return;
    
    try {
      setSaving(true);
      await setBranchPrice(selectedService.id, userBranch, price, currentUser);
      setShowPriceModal(false);
      await fetchServices();
    } catch (error) {
      console.error('Error setting price:', error);
    } finally {
      setSaving(false);
    }
  };


  const checkServiceInConfirmedAppointments = async (serviceId) => {
    try {
      // Get all appointments for this branch
      const { appointments } = await getAppointments(
        { branchId: userBranch, status: APPOINTMENT_STATUS.CONFIRMED },
        'branch_manager',
        currentUser?.uid,
        1000 // Get up to 1000 appointments to check
      );

      // Convert serviceId to string for consistent comparison
      const serviceIdStr = String(serviceId).trim();

      // Check if any confirmed appointment uses this service
      const matchingAppointments = [];
      const hasConfirmedAppointments = appointments.some(appointment => {
        let matches = false;
        
        // Check serviceStylistPairs array
        if (appointment.serviceStylistPairs && Array.isArray(appointment.serviceStylistPairs)) {
          const found = appointment.serviceStylistPairs.some(pair => {
            const pairServiceId = pair?.serviceId ? String(pair.serviceId).trim() : null;
            return pairServiceId === serviceIdStr;
          });
          if (found) {
            matches = true;
            matchingAppointments.push({
              id: appointment.id,
              format: 'serviceStylistPairs',
              pairs: appointment.serviceStylistPairs
            });
          }
        }
        
        // Check services array (newer format)
        if (appointment.services && Array.isArray(appointment.services)) {
          const found = appointment.services.some(svc => {
            const svcServiceId = svc?.serviceId ? String(svc.serviceId).trim() : null;
            return svcServiceId === serviceIdStr;
          });
          if (found) {
            matches = true;
            matchingAppointments.push({
              id: appointment.id,
              format: 'services',
              services: appointment.services
            });
          }
        }
        
        // Check serviceId field (older format)
        if (appointment.serviceId) {
          const aptServiceId = String(appointment.serviceId).trim();
          if (aptServiceId === serviceIdStr) {
            matches = true;
            matchingAppointments.push({
              id: appointment.id,
              format: 'serviceId',
              serviceId: appointment.serviceId
            });
          }
        }
        
        // Check serviceIds array (older format)
        if (appointment.serviceIds && Array.isArray(appointment.serviceIds)) {
          const found = appointment.serviceIds.some(id => {
            const idStr = String(id).trim();
            return idStr === serviceIdStr;
          });
          if (found) {
            matches = true;
            matchingAppointments.push({
              id: appointment.id,
              format: 'serviceIds',
              serviceIds: appointment.serviceIds
            });
          }
        }
        
        return matches;
      });

      // Log for debugging
      if (hasConfirmedAppointments) {
        console.log(`Service ${serviceId} found in confirmed appointments:`, matchingAppointments);
      } else {
        console.log(`Service ${serviceId} NOT found in any confirmed appointments. Total appointments checked: ${appointments.length}`);
      }

      return hasConfirmedAppointments;
    } catch (error) {
      console.error('Error checking appointments:', error);
      // If there's an error, be safe and prevent deletion
      return true;
    }
  };

  const handleDisableService = async (service) => {
    try {
      // Check if service is used in confirmed appointments
      const hasConfirmedAppointments = await checkServiceInConfirmedAppointments(service.id);
      
      if (hasConfirmedAppointments) {
        toast.error(
          `Cannot remove "${service.name}". This service is used in confirmed appointments. Please cancel or complete those appointments first.`,
          { duration: 5000 }
        );
        return;
      }

      // If no confirmed appointments, proceed with removal
      setServiceToDisable(service);
      setShowDisableModal(true);
    } catch (error) {
      console.error('Error checking appointments:', error);
      toast.error('Failed to check appointments. Please try again.');
    }
  };

  const confirmDisable = async () => {
    if (!serviceToDisable) return;
    
    try {
      setSaving(true);
      
      // Double-check before removing (in case appointments were confirmed between modal open and confirm)
      const hasConfirmedAppointments = await checkServiceInConfirmedAppointments(serviceToDisable.id);
      
      if (hasConfirmedAppointments) {
        toast.error(
          `Cannot remove "${serviceToDisable.name}". This service is used in confirmed appointments. Please cancel or complete those appointments first.`,
          { duration: 5000 }
        );
        setShowDisableModal(false);
        setServiceToDisable(null);
        return;
      }

      await disableBranchService(serviceToDisable.id, userBranch, currentUser);
      await fetchServices();
      setShowDisableModal(false);
      toast.success(`"${serviceToDisable.name}" has been removed from your branch services.`);
    } catch (error) {
      console.error('Error disabling service:', error);
      toast.error('Failed to remove service. Please try again.');
    } finally {
      setSaving(false);
      setServiceToDisable(null);
    }
  };

  // Service Catalog functions
  const handleOpenCatalog = async () => {
    setShowCatalogModal(true);
    // Load saved catalog configuration
    if (userBranch && offeredServices.length > 0) {
      try {
        const savedConfig = await getCatalogConfig(userBranch);
        if (savedConfig && savedConfig.catalogData && savedConfig.catalogData.length > 0) {
          setCatalogData(savedConfig.catalogData);
          if (savedConfig.style) {
            // Ensure gridColumns is always set
            setCatalogStyle({
              ...savedConfig.style,
              gridColumns: savedConfig.style.gridColumns ?? 2
            });
          }
          if (savedConfig.gridLayout) {
            setGridLayout(savedConfig.gridLayout);
          } else {
            // Initialize grid layout from catalog data
            const layout = {};
            const columns = savedConfig.style?.gridColumns ?? 2;
            savedConfig.catalogData.forEach((cat, index) => {
              layout[cat.id] = {
                row: cat.gridRow ?? Math.floor(index / columns),
                col: cat.gridCol ?? (index % columns)
              };
            });
            setGridLayout(layout);
          }
        } else {
          // Initialize with default grouping
          initializeCatalogData();
        }
      } catch (error) {
        console.error('Error loading catalog config:', error);
        initializeCatalogData();
      }
    } else if (offeredServices.length > 0) {
      initializeCatalogData();
    }
  };

  const initializeCatalogData = () => {
    const grouped = offeredServices.reduce((acc, service) => {
      const category = service.category || 'Other Services';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({
        ...service,
        catalogIcon: service.imageURL || null // Use existing imageURL as icon
      });
      return acc;
    }, {});
    
    // Ensure gridColumns is set
    const columns = catalogStyle.gridColumns || 2;
    
    // Convert to array format for drag and drop
    const categoriesArray = Object.keys(grouped).map((category, index) => ({
      id: `category-${category}`,
      name: category,
      services: grouped[category],
      gridRow: Math.floor(index / columns),
      gridCol: index % columns
    }));
    
    setCatalogData(categoriesArray);
    
    // Initialize grid layout
    const layout = {};
    categoriesArray.forEach((cat, index) => {
      layout[cat.id] = {
        row: Math.floor(index / columns),
        col: index % columns
      };
    });
    setGridLayout(layout);
    
    // Ensure gridColumns is set in catalogStyle
    if (!catalogStyle.gridColumns) {
      setCatalogStyle(prev => ({
        ...prev,
        gridColumns: 2
      }));
    }
  };

  const handleSaveCatalog = async () => {
    if (!userBranch || !catalogData) return;
    
    try {
      setSavingCatalog(true);
      // Merge grid positions into catalog data
      const catalogDataWithGrid = catalogData.map(cat => ({
        ...cat,
        gridRow: gridLayout?.[cat.id]?.row ?? cat.gridRow ?? 0,
        gridCol: gridLayout?.[cat.id]?.col ?? cat.gridCol ?? 0
      }));
      
      await saveCatalogConfig(userBranch, {
        catalogData: catalogDataWithGrid,
        style: catalogStyle,
        gridLayout
      }, currentUser);
      toast.success('Catalog configuration saved!');
    } catch (error) {
      console.error('Error saving catalog:', error);
    } finally {
      setSavingCatalog(false);
    }
  };

  const handleCategoryDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !catalogData) return;

    if (isEditMode && gridLayout) {
      // In grid mode, we need to find which grid cell the item was dropped into
      // For now, we'll swap positions if dragging to another category
      const draggedCategory = catalogData.find(cat => cat.id === active.id);
      const targetCategory = catalogData.find(cat => cat.id === over.id);
      
      if (draggedCategory && targetCategory) {
        const updatedLayout = { ...gridLayout };
        const draggedPos = updatedLayout[draggedCategory.id];
        const targetPos = updatedLayout[targetCategory.id];
        
        // Swap positions
        updatedLayout[draggedCategory.id] = targetPos;
        updatedLayout[targetCategory.id] = draggedPos;
        
        setGridLayout(updatedLayout);
      }
    } else {
      // Regular list reordering
      const oldIndex = catalogData.findIndex(cat => cat.id === active.id);
      const newIndex = catalogData.findIndex(cat => cat.id === over.id);

      setCatalogData(arrayMove(catalogData, oldIndex, newIndex));
    }
  };

  const handleServiceDragEnd = (categoryId, event) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !catalogData) return;

    const categoryIndex = catalogData.findIndex(cat => cat.id === categoryId);
    if (categoryIndex === -1) return;

    const category = catalogData[categoryIndex];
    const oldIndex = category.services.findIndex(s => s.id === active.id);
    const newIndex = category.services.findIndex(s => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const updatedCategory = {
      ...category,
      services: arrayMove(category.services, oldIndex, newIndex)
    };

    const updatedCatalogData = [...catalogData];
    updatedCatalogData[categoryIndex] = updatedCategory;
    setCatalogData(updatedCatalogData);
  };

  const handleIconUpload = async (serviceId, categoryId, file) => {
    if (!file || !catalogData) return;

    try {
      const iconUrl = await uploadToCloudinary(file, 'service-icons');
      
      const categoryIndex = catalogData.findIndex(cat => cat.id === categoryId);
      if (categoryIndex === -1) return;

      const serviceIndex = catalogData[categoryIndex].services.findIndex(s => s.id === serviceId);
      if (serviceIndex === -1) return;

      const updatedCatalogData = [...catalogData];
      updatedCatalogData[categoryIndex].services[serviceIndex].catalogIcon = iconUrl;
      
      setCatalogData(updatedCatalogData);
      toast.success('Icon uploaded successfully!');
    } catch (error) {
      console.error('Error uploading icon:', error);
      toast.error('Failed to upload icon');
    }
  };

  const handlePrint = () => {
    if (!printRef.current) {
      toast.error('Print content not ready. Please try again.');
      return;
    }

    // Wait a moment to ensure content is fully rendered
    setTimeout(() => {
      if (!printRef.current) {
        toast.error('Print content not ready. Please try again.');
        return;
      }

      // Get the inner HTML of the print content
      const printContentHTML = printRef.current.innerHTML;
      
      // Get all computed styles from the document
      let styles = '';
      try {
        styles = Array.from(document.styleSheets)
          .map((sheet) => {
            try {
              return Array.from(sheet.cssRules || [])
                .map((rule) => rule.cssText)
                .join('\n');
            } catch (e) {
              // Cross-origin stylesheets will throw an error, skip them
              // Try to get href if available
              if (sheet.href) {
                return `@import url('${sheet.href}');`;
              }
              return '';
            }
          })
          .join('\n');
      } catch (e) {
        console.warn('Could not extract all styles:', e);
      }

      // Create print window
      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      if (!printWindow) {
        toast.error('Please allow pop-ups to print the catalog');
        return;
      }

      const catalogTitle = `${branch?.name || branch?.branchName || 'David Salon'} - Service Catalog`;

      // Write HTML content
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${catalogTitle}</title>
          <meta charset="utf-8">
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            ${styles}
            /* Fallback styles to ensure content is visible */
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 20px;
              background: white !important;
              color: #000 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              visibility: visible !important;
            }
            body * {
              visibility: visible !important;
            }
            /* Ensure all elements are visible */
            div, p, h1, h2, h3, h4, h5, h6, span, img, table, tr, td, th {
              display: block;
              visibility: visible !important;
            }
            /* Basic layout styles */
            .flex {
              display: flex;
            }
            .grid {
              display: grid;
            }
            .text-center {
              text-align: center;
            }
            .mb-12 {
              margin-bottom: 3rem;
            }
            .mb-4 {
              margin-bottom: 1rem;
            }
            .mb-3 {
              margin-bottom: 0.75rem;
            }
            .mt-1 {
              margin-top: 0.25rem;
            }
            .mt-4 {
              margin-top: 1rem;
            }
            .p-12 {
              padding: 3rem;
            }
            .pb-8 {
              padding-bottom: 2rem;
            }
            .pt-8 {
              padding-top: 2rem;
            }
            .border-b-2 {
              border-bottom-width: 2px;
            }
            .border-t-2 {
              border-top-width: 2px;
            }
            .border-gray-300 {
              border-color: #d1d5db;
            }
            .font-bold {
              font-weight: 700;
            }
            .font-semibold {
              font-weight: 600;
            }
            .text-gray-900 {
              color: #111827;
            }
            .text-gray-600 {
              color: #4b5563;
            }
            .text-gray-500 {
              color: #6b7280;
            }
            .text-sm {
              font-size: 0.875rem;
            }
            .italic {
              font-style: italic;
            }
            .uppercase {
              text-transform: uppercase;
            }
            .tracking-wide {
              letter-spacing: 0.025em;
            }
            img {
              max-width: 100%;
              height: auto;
              display: inline-block;
            }
            @media print {
              @page {
                size: A4;
                margin: 1cm;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          ${printContentHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                // Close window after print dialog is closed
                window.onafterprint = function() {
                  setTimeout(function() {
                    window.close();
                  }, 100);
                };
                // Fallback: close after 30 seconds if print dialog doesn't trigger onafterprint
                setTimeout(function() {
                  if (!window.closed) {
                    window.close();
                  }
                }, 30000);
              }, 1000);
            };
          </script>
        </body>
        </html>
      `);
      
      printWindow.document.close();
    }, 500);
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) {
      toast.error('PDF content not ready. Please try again.');
      return;
    }

    try {
      toast.loading('Generating PDF...', { id: 'pdf-generating' });
      
      // Wait for images to load
      const images = printRef.current.querySelectorAll('img');
      if (images.length > 0) {
        await Promise.all(
          Array.from(images).map((img) => {
            if (img.complete && img.naturalHeight !== 0) {
              return Promise.resolve();
            }
            return new Promise((resolve) => {
              if (img.src && !img.crossOrigin) {
                img.crossOrigin = 'anonymous';
              }
              const onLoad = () => {
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                resolve();
              };
              const onError = () => {
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                resolve(); // Continue even if image fails
              };
              img.addEventListener('load', onLoad);
              img.addEventListener('error', onError);
              setTimeout(() => {
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                resolve();
              }, 3000);
            });
          })
        );
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Get the actual dimensions of the content
      const element = printRef.current;
      
      // Ensure element is visible and not clipped
      const originalStyle = {
        position: element.style.position,
        left: element.style.left,
        top: element.style.top,
        visibility: element.style.visibility,
        overflow: element.style.overflow,
      };
      
      // Temporarily make element fully visible for capture
      element.style.position = 'absolute';
      element.style.left = '0px';
      element.style.top = '0px';
      element.style.visibility = 'visible';
      element.style.overflow = 'visible';
      
      // Wait a bit for styles to apply
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const scrollWidth = element.scrollWidth || element.offsetWidth;
      const scrollHeight = element.scrollHeight || element.offsetHeight;

      // Capture the content as canvas with full height
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        width: scrollWidth,
        height: scrollHeight,
        windowWidth: scrollWidth,
        windowHeight: scrollHeight,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
      });
      
      // Restore original styles
      element.style.position = originalStyle.position;
      element.style.left = originalStyle.left;
      element.style.top = originalStyle.top;
      element.style.visibility = originalStyle.visibility;
      element.style.overflow = originalStyle.overflow;

      // Calculate PDF dimensions (A4: 210mm x 297mm)
      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const margin = 10; // 1cm margin
      const contentWidth = pageWidth - (margin * 2); // 190mm
      const contentHeight = pageHeight - (margin * 2); // 277mm
      
      // Calculate image dimensions
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Convert content height to pixels for canvas slicing
      const pixelsPerMM = canvas.width / imgWidth;
      const contentHeightPx = contentHeight * pixelsPerMM;

      // Create PDF in A4 size
      const pdf = new jsPDF('p', 'mm', 'a4');
      let sourceY = 0;
      let pageNumber = 0;

      // Slice content across pages with overlap to avoid cutting content
      while (sourceY < canvas.height) {
        if (pageNumber > 0) {
          pdf.addPage();
        }

        const remainingHeight = canvas.height - sourceY;
        const sliceHeight = Math.min(contentHeightPx, remainingHeight);
        const sliceHeightMM = (sliceHeight / pixelsPerMM);

        // Create a temporary canvas for this page slice
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const pageCtx = pageCanvas.getContext('2d');
        
        // Draw the slice from the original canvas
        pageCtx.drawImage(
          canvas,
          0, sourceY, canvas.width, sliceHeight,
          0, 0, canvas.width, sliceHeight
        );

        // Add the slice to PDF
        pdf.addImage(
          pageCanvas.toDataURL('image/png', 1.0),
          'PNG',
          margin,
          margin,
          imgWidth,
          sliceHeightMM
        );

        sourceY += sliceHeight;
        pageNumber++;
      }

      // Download PDF
      const fileName = `${branch?.name || branch?.branchName || 'David_Salon'}_Service_Catalog_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      toast.success('PDF downloaded successfully', { id: 'pdf-generating' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.', { id: 'pdf-generating' });
    }
  };

  const handleAddRow = () => {
    if (!gridLayout || !catalogData) return;
    
    const maxRow = Math.max(...Object.values(gridLayout).map(pos => pos.row), -1);
    const newRow = maxRow + 1;
    
    // Add empty cells for the new row
    const updatedLayout = { ...gridLayout };
    for (let col = 0; col < catalogStyle.gridColumns; col++) {
      // Create a placeholder ID for empty cells
      const placeholderId = `empty-${newRow}-${col}`;
      updatedLayout[placeholderId] = { row: newRow, col };
    }
    
    setGridLayout(updatedLayout);
  };

  const handleAddColumn = () => {
    setCatalogStyle(prev => ({
      ...prev,
      gridColumns: (prev.gridColumns || 2) + 1
    }));
    
    // Recalculate grid positions for all categories
    if (catalogData && gridLayout) {
      const updatedLayout = {};
      catalogData.forEach((cat, index) => {
        const currentPos = gridLayout[cat.id] || { row: 0, col: 0 };
        updatedLayout[cat.id] = {
          row: currentPos.row,
          col: currentPos.col
        };
      });
      setGridLayout(updatedLayout);
    }
  };

  const handleRemoveColumn = () => {
    const currentColumns = catalogStyle.gridColumns || 2;
    if (currentColumns <= 1) return;
    
    setCatalogStyle(prev => ({
      ...prev,
      gridColumns: (prev.gridColumns || 2) - 1
    }));
    
    // Move categories that are in the removed column
    if (catalogData && gridLayout) {
      const updatedLayout = { ...gridLayout };
      const maxCol = currentColumns - 1;
      
      catalogData.forEach(cat => {
        const pos = updatedLayout[cat.id];
        if (pos && pos.col >= maxCol) {
          // Move to previous column or wrap to next row
          updatedLayout[cat.id] = {
            row: pos.row + 1,
            col: 0
          };
        }
      });
      
      setGridLayout(updatedLayout);
    }
  };

  const handleCategoryPositionChange = (categoryId, newRow, newCol) => {
    if (!gridLayout) return;
    
    const updatedLayout = { ...gridLayout };
    
    // Check if target position is occupied
    const occupiedBy = Object.keys(updatedLayout).find(id => {
      const pos = updatedLayout[id];
      return pos.row === newRow && pos.col === newCol && id !== categoryId;
    });
    
    if (occupiedBy) {
      // Swap positions
      const tempPos = updatedLayout[categoryId];
      updatedLayout[categoryId] = { row: newRow, col: newCol };
      updatedLayout[occupiedBy] = tempPos;
    } else {
      updatedLayout[categoryId] = { row: newRow, col: newCol };
    }
    
    setGridLayout(updatedLayout);
  };

  // Group services by category for catalog (fallback if catalogData not available)
  const groupedServicesForCatalog = catalogData 
    ? catalogData.reduce((acc, cat) => {
        acc[cat.name] = cat.services;
        return acc;
      }, {})
    : offeredServices.reduce((acc, service) => {
        const category = service.category || 'Other Services';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(service);
        return acc;
      }, {});

  // Get category IDs for drag and drop
  const categoryIds = catalogData ? catalogData.map(cat => cat.id) : [];

  // Theme styles
  const themeStyles = {
    elegant: {
      primary: 'bg-gradient-to-r from-purple-600 to-indigo-600',
      secondary: 'bg-purple-50',
      text: 'text-purple-900',
      accent: 'text-purple-600',
      border: 'border-purple-200'
    },
    modern: {
      primary: 'bg-gradient-to-r from-blue-600 to-cyan-600',
      secondary: 'bg-blue-50',
      text: 'text-blue-900',
      accent: 'text-blue-600',
      border: 'border-blue-200'
    },
    classic: {
      primary: 'bg-gradient-to-r from-amber-600 to-orange-600',
      secondary: 'bg-amber-50',
      text: 'text-amber-900',
      accent: 'text-amber-600',
      border: 'border-amber-200'
    }
  };

  const currentTheme = themeStyles[catalogStyle.theme];

  // Font size classes
  const fontSizeClasses = {
    small: {
      header: 'text-2xl',
      category: 'text-xl',
      service: 'text-base',
      price: 'text-lg',
      description: 'text-sm'
    },
    medium: {
      header: 'text-4xl',
      category: 'text-2xl',
      service: 'text-lg',
      price: 'text-xl',
      description: 'text-sm'
    },
    large: {
      header: 'text-5xl',
      category: 'text-3xl',
      service: 'text-xl',
      price: 'text-2xl',
      description: 'text-base'
    }
  };

  const fontSizes = fontSizeClasses[catalogStyle.fontSize];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const categories = getServiceCategories();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/manager/settings')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Branch Services</h1>
            <p className="text-gray-600">Configure which services to offer and set branch pricing</p>
          </div>
        </div>
        {offeredServices.length > 0 && (
          <Button
            onClick={handleOpenCatalog}
            className="flex items-center gap-2 bg-[#160B53] hover:bg-[#1a0f6b]"
          >
            <FileText className="h-4 w-4" />
            Generate Service Catalog
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        {/* Filter Mode Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterMode === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Available ({allServices.filter(s => !s.isOfferedByBranch).length})
          </button>
          <button
            onClick={() => setFilterMode('offered')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterMode === 'offered'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            My Services ({offeredServices.length})
          </button>
        </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              categoryFilter === 'all'
                ? 'bg-primary-100 text-primary-700 border border-primary-300'
                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
            }`}
          >
            All
          </button>
            {categories.map(category => (
            <button
              key={category}
              onClick={() => setCategoryFilter(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                categoryFilter === category
                  ? 'bg-primary-100 text-primary-700 border border-primary-300'
                  : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
            ))}
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Branch Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
        {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
              {filterMode === 'offered' 
                      ? 'You haven\'t offered any services yet. Switch to "All Available" to add services.' 
                : filterMode === 'all'
                  ? 'All available services have been added to your branch.'
                  : 'No services found'}
                  </td>
                </tr>
        ) : (
          filteredServices.map((service) => (
                  <tr key={service.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {service.imageURL && (
                          <img 
                            src={service.imageURL} 
                            alt={service.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                    {service.name}
                          </div>
                          {service.description && (
                            <div className="text-sm text-gray-500 line-clamp-1">
                              {service.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {service.category}
                      </span>
                    {service.isChemical && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            Chemical
                      </span>
                    )}
                  </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {service.duration} min
                    </td>
                    <td className="px-6 py-4">
                      {service.isOfferedByBranch ? (
                        <span className="text-sm font-semibold text-gray-900">
                          ₱{service.price?.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">
                          Not set
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {service.isOfferedByBranch ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Offered
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Available
                        </span>
                )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                {filterMode === 'offered' ? (
                  // My Services: All services here are offered, so show Edit Price and Remove
                  <>
                    <button
                      onClick={() => handleSetPrice(service)}
                      disabled={saving}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Update Price"
                    >
                      <Edit className="w-4 h-4" />
                      Update Price
                    </button>
                    <button
                      onClick={() => handleDisableService(service)}
                      disabled={saving}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Remove from Branch"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  </>
                ) : (
                  // All Available: Only services not offered, so show Add to Branch
                  <button
                    onClick={() => handleSetPrice(service)}
                    disabled={saving}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    Add to Branch
                  </button>
                )}
              </div>
                    </td>
                  </tr>
          ))
        )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            Showing {filteredServices.length} {filterMode === 'offered' ? 'services offered' : 'available services'}
          </span>
          <span className="text-gray-600">
            {offeredServices.length} of {allServices.length} services configured
          </span>
        </div>
      </div>

      {/* Price Modal */}
      <BranchServicePriceModal
        isOpen={showPriceModal}
        service={selectedService}
        onClose={() => setShowPriceModal(false)}
        onSubmit={handlePriceSubmit}
        loading={saving}
      />

      {/* Disable Confirmation Modal */}
      <ConfirmModal
        isOpen={showDisableModal}
        onClose={() => {
          if (!saving) {
            setShowDisableModal(false);
            setServiceToDisable(null);
          }
        }}
        onConfirm={confirmDisable}
        title="Remove Service"
        message={`Do you want to remove "${serviceToDisable?.name}" from your branch? This will stop offering this service at your branch.`}
        confirmText="Remove"
        cancelText="Cancel"
        type="danger"
        loading={saving}
      />

      {/* Service Catalog Modal */}
      {showCatalogModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCatalogModal(false);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#160B53] to-[#1a0f6b] text-white p-6 rounded-t-xl flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Service Catalog Generator</h2>
                <p className="text-white/80 text-sm mt-1">Create a printable menu/poster for your branch</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isEditMode 
                      ? 'bg-white text-[#160B53]' 
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {isEditMode ? <Save className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                  {isEditMode ? 'Save Changes' : 'Edit Mode'}
                </button>
                <button
                  onClick={() => setShowMockup(!showMockup)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    showMockup 
                      ? 'bg-white text-[#160B53]' 
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  {showMockup ? 'Hide Mockup' : 'Show Mockup'}
                </button>
                <button
                  onClick={() => setShowCatalogModal(false)}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Catalog Controls */}
            <div className="p-6 border-b border-gray-200">
              {/* Grid Layout Controls (Edit Mode Only) */}
              {isEditMode && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Grid3x3 className="w-5 h-5 text-gray-600" />
                      <h3 className="font-semibold text-gray-900">Grid Layout</h3>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Columns: {catalogStyle.gridColumns || 2}</span>
                      {gridLayout && catalogData && (
                        <span>Rows: {Math.max(...Object.values(gridLayout).map(pos => pos.row), -1) + 1 || 1}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAddColumn}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      title="Add Column"
                    >
                      <Plus className="w-4 h-4" />
                      <Columns className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleRemoveColumn}
                      disabled={(catalogStyle.gridColumns || 2) <= 1}
                      className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      title="Remove Column"
                    >
                      <Minus className="w-4 h-4" />
                      <Columns className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleAddRow}
                      className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                      title="Add Row"
                    >
                      <Plus className="w-4 h-4" />
                      <Rows className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Drag categories to reposition them in the grid. Use buttons above to adjust grid size.
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Theme */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Palette className="inline h-4 w-4 mr-1" />
                    Color Theme
                  </label>
                  <select
                    value={catalogStyle.theme}
                    onChange={(e) => setCatalogStyle({ ...catalogStyle, theme: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                  >
                    <option value="elegant">Elegant (Purple)</option>
                    <option value="modern">Modern (Blue)</option>
                    <option value="classic">Classic (Amber)</option>
                  </select>
                </div>

                {/* Font Size */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FileText className="inline h-4 w-4 mr-1" />
                    Font Size
                  </label>
                  <select
                    value={catalogStyle.fontSize}
                    onChange={(e) => setCatalogStyle({ ...catalogStyle, fontSize: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53]"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>

                {/* Options */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Sparkles className="inline h-4 w-4 mr-1" />
                    Display Options
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={catalogStyle.showDescriptions}
                        onChange={(e) => setCatalogStyle({ ...catalogStyle, showDescriptions: e.target.checked })}
                        className="rounded border-gray-300 text-[#160B53] focus:ring-[#160B53]"
                      />
                      <span>Show Descriptions</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={catalogStyle.showDuration}
                        onChange={(e) => setCatalogStyle({ ...catalogStyle, showDuration: e.target.checked })}
                        className="rounded border-gray-300 text-[#160B53] focus:ring-[#160B53]"
                      />
                      <span>Show Duration</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                {isEditMode && (
                  <Button
                    onClick={handleSaveCatalog}
                    disabled={savingCatalog}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <Save className="h-4 w-4" />
                    {savingCatalog ? 'Saving...' : 'Save Configuration'}
                  </Button>
                )}
                <Button
                  onClick={handlePrint}
                  className="flex items-center gap-2 bg-[#160B53] hover:bg-[#1a0f6b]"
                >
                  <Printer className="h-4 w-4" />
                  Print Catalog
                </Button>
                <Button
                  onClick={handleDownloadPDF}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </div>

            {/* Catalog Preview */}
            <div className="p-6 overflow-y-auto flex-1 min-h-0">
              {/* Always render regular preview for printing (hidden when mockup is shown) */}
              <div className={showMockup ? 'hidden' : ''}>
                <div className="bg-white rounded-lg shadow-lg p-12 print-content" ref={printRef} key="regular-preview">
                  {/* Header - Salon Name and Branch */}
                  <div className="text-center mb-12 border-b-2 border-gray-300 pb-8">
                    <h1 className={`${fontSizes.header} font-bold text-gray-900 mb-3`}>
                      David Salon
                    </h1>
                    <h2 className={`${fontSizes.category} font-semibold ${currentTheme.accent} mb-4`}>
                      {branch?.name || branch?.branchName || 'Branch'}
                    </h2>
                    {(branch?.address || branch?.contact) && (
                      <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600 mt-4">
                        {branch?.address && (
                          <span>{branch.address}</span>
                        )}
                        {branch?.contact && (
                          <span>{branch.contact}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Services by Category */}
                  {!catalogData || catalogData.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500 text-lg">No services available. Please add services first.</p>
                    </div>
                  ) : (isEditMode && gridLayout) || (gridLayout && (catalogStyle.gridColumns || 2) > 1) ? (
                    /* Grid Layout (Edit Mode or if grid is configured) */
                    isEditMode ? (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleCategoryDragEnd}
                      >
                        <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
                          <div 
                            className="grid gap-6"
                            style={{ 
                              gridTemplateColumns: `repeat(${catalogStyle.gridColumns || 2}, 1fr)`,
                              gridAutoRows: 'min-content'
                            }}
                          >
                            {catalogData.map((category) => {
                              const pos = gridLayout[category.id] || { row: 0, col: 0 };
                              return (
                                <div
                                  key={category.id}
                                  style={{
                                    gridRow: pos.row + 1,
                                    gridColumn: pos.col + 1
                                  }}
                                >
                                  <SortableCategory
                                    category={category}
                                    isEditMode={isEditMode}
                                    onServiceDragEnd={handleServiceDragEnd}
                                    onIconUpload={handleIconUpload}
                                    catalogStyle={catalogStyle}
                                    fontSizes={fontSizes}
                                    currentTheme={currentTheme}
                                    serviceSensors={sensors}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </SortableContext>
                      </DndContext>
                    ) : (
                      /* Grid Layout (View Mode - for printing) */
                      <div 
                        className="grid gap-6"
                        style={{ 
                          gridTemplateColumns: `repeat(${catalogStyle.gridColumns || 2}, 1fr)`,
                          gridAutoRows: 'min-content'
                        }}
                      >
                        {catalogData.map((category) => {
                          const pos = gridLayout[category.id] || { row: 0, col: 0 };
                          return (
                            <div
                              key={category.id}
                              style={{
                                gridRow: pos.row + 1,
                                gridColumn: pos.col + 1
                              }}
                            >
                              <SortableCategory
                                category={category}
                                isEditMode={false}
                                onServiceDragEnd={handleServiceDragEnd}
                                onIconUpload={handleIconUpload}
                                catalogStyle={catalogStyle}
                                fontSizes={fontSizes}
                                currentTheme={currentTheme}
                                serviceSensors={sensors}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    /* Regular List Layout */
                    isEditMode ? (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleCategoryDragEnd}
                      >
                        <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
                          <div className="space-y-10">
                            {catalogData.map((category) => (
                              <SortableCategory
                                key={category.id}
                                category={category}
                                isEditMode={isEditMode}
                                onServiceDragEnd={handleServiceDragEnd}
                                onIconUpload={handleIconUpload}
                                catalogStyle={catalogStyle}
                                fontSizes={fontSizes}
                                currentTheme={currentTheme}
                                serviceSensors={sensors}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    ) : (
                      <div className="space-y-10">
                        {catalogData.map((category) => (
                          <SortableCategory
                            key={category.id}
                            category={category}
                            isEditMode={false}
                            onServiceDragEnd={handleServiceDragEnd}
                            onIconUpload={handleIconUpload}
                            catalogStyle={catalogStyle}
                            fontSizes={fontSizes}
                            currentTheme={currentTheme}
                            serviceSensors={sensors}
                          />
                        ))}
                      </div>
                    )
                  )}

                  {/* Footer - Optional */}
                  {catalogStyle.showDescriptions && (
                    <div className="mt-12 pt-8 border-t-2 border-gray-300 text-center">
                      <p className="text-sm text-gray-600 italic">
                        For inquiries, please contact us at {branch?.contact || 'our branch'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {showMockup ? (
                /* Mockup Frame Preview */
                <div className="flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 p-12 rounded-lg">
                  <div className="relative">
                    {/* Frame */}
                    <div className="bg-amber-900 rounded-lg p-4 shadow-2xl">
                      <div className="bg-amber-800 rounded p-2">
                        <div className="bg-white rounded-lg shadow-inner p-8" style={{ width: '21cm', minHeight: '29.7cm' }}>
                          {/* Header - Salon Name and Branch */}
                          <div className="text-center mb-12 border-b-2 border-gray-300 pb-8">
                            <h1 className={`${fontSizes.header} font-bold text-gray-900 mb-3`}>
                              David Salon
                            </h1>
                            <h2 className={`${fontSizes.category} font-semibold ${currentTheme.accent} mb-4`}>
                              {branch?.name || branch?.branchName || 'Branch'}
                            </h2>
                            {(branch?.address || branch?.contact) && (
                              <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600 mt-4">
                                {branch?.address && (
                                  <span>{branch.address}</span>
                                )}
                                {branch?.contact && (
                                  <span>{branch.contact}</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Services by Category */}
                          {!catalogData || catalogData.length === 0 ? (
                            <div className="text-center py-12">
                              <p className="text-gray-500 text-lg">No services available. Please add services first.</p>
                            </div>
                          ) : (isEditMode && gridLayout) || (gridLayout && (catalogStyle.gridColumns || 2) > 1) ? (
                            /* Grid Layout (Edit Mode or if grid is configured) */
                            isEditMode ? (
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleCategoryDragEnd}
                              >
                                <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
                                  <div 
                                  className="grid gap-6"
                                  style={{ 
                                    gridTemplateColumns: `repeat(${catalogStyle.gridColumns || 2}, 1fr)`,
                                    gridAutoRows: 'min-content'
                                  }}
                                  >
                                    {catalogData.map((category) => {
                                      const pos = gridLayout[category.id] || { row: 0, col: 0 };
                                      return (
                                        <div
                                          key={category.id}
                                          style={{
                                            gridRow: pos.row + 1,
                                            gridColumn: pos.col + 1
                                          }}
                                        >
                                          <SortableCategory
                                            category={category}
                                            isEditMode={isEditMode}
                                            onServiceDragEnd={handleServiceDragEnd}
                                            onIconUpload={handleIconUpload}
                                            catalogStyle={catalogStyle}
                                            fontSizes={fontSizes}
                                            currentTheme={currentTheme}
                                            serviceSensors={sensors}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </SortableContext>
                              </DndContext>
                            ) : (
                              /* Grid Layout (View Mode - for mockup) */
                              <div 
                                  className="grid gap-6"
                                  style={{ 
                                    gridTemplateColumns: `repeat(${catalogStyle.gridColumns || 2}, 1fr)`,
                                    gridAutoRows: 'min-content'
                                  }}
                              >
                                {catalogData.map((category) => {
                                  const pos = gridLayout[category.id] || { row: 0, col: 0 };
                                  return (
                                    <div
                                      key={category.id}
                                      style={{
                                        gridRow: pos.row + 1,
                                        gridColumn: pos.col + 1
                                      }}
                                    >
                                      <SortableCategory
                                        category={category}
                                        isEditMode={false}
                                        onServiceDragEnd={handleServiceDragEnd}
                                        onIconUpload={handleIconUpload}
                                        catalogStyle={catalogStyle}
                                        fontSizes={fontSizes}
                                        currentTheme={currentTheme}
                                        serviceSensors={sensors}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )
                          ) : (
                            /* Regular List Layout */
                            isEditMode ? (
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleCategoryDragEnd}
                              >
                                <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
                                  <div className="space-y-10">
                                    {catalogData.map((category) => (
                                      <SortableCategory
                                        key={category.id}
                                        category={category}
                                        isEditMode={isEditMode}
                                        onServiceDragEnd={handleServiceDragEnd}
                                        onIconUpload={handleIconUpload}
                                        catalogStyle={catalogStyle}
                                        fontSizes={fontSizes}
                                        currentTheme={currentTheme}
                                        serviceSensors={sensors}
                                      />
                                    ))}
                                  </div>
                                </SortableContext>
                              </DndContext>
                            ) : (
                              <div className="space-y-10">
                                {catalogData.map((category) => (
                                  <SortableCategory
                                    key={category.id}
                                    category={category}
                                    isEditMode={false}
                                    onServiceDragEnd={handleServiceDragEnd}
                                    onIconUpload={handleIconUpload}
                                    catalogStyle={catalogStyle}
                                    fontSizes={fontSizes}
                                    currentTheme={currentTheme}
                                    serviceSensors={sensors}
                                  />
                                ))}
                              </div>
                            )
                          )}

                          {/* Footer - Optional */}
                          {catalogStyle.showDescriptions && (
                            <div className="mt-12 pt-8 border-t-2 border-gray-300 text-center">
                              <p className="text-sm text-gray-600 italic">
                                For inquiries, please contact us at {branch?.contact || 'our branch'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
          }
          @page {
            size: A4;
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  );
};

export default ServicesManagement;
