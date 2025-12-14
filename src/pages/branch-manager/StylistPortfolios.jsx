import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { Card } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { db } from "../../config/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import {
  Home,
  Calendar,
  Users,
  Package,
  Receipt,
  Settings,
  BarChart3,
  UserCog,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Eye,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  User,
  Tag,
  Calendar as CalendarIcon,
  AlertCircle,
  Search,
} from "lucide-react";

const StylistPortfolios = () => {
  const { userData } = useAuth();
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stylists, setStylists] = useState({});
  const [selectedStylist, setSelectedStylist] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // Changed default to "all"
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [previewImage, setPreviewImage] = useState(null);

  // Set page title with role prefix
  useEffect(() => {
    document.title = 'Branch Manager - Stylist Portfolios | DSMS';
    return () => {
      document.title = 'DSMS - David\'s Salon Management System';
    };
  }, []);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lastVisible, setLastVisible] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [portfolioToReject, setPortfolioToReject] = useState(null);
  const [rejectionRemark, setRejectionRemark] = useState("");
  const itemsPerPage = 12;

  // Get unique categories from all portfolios
  const availableCategories = useMemo(() => {
    const categories = new Set();
    portfolios.forEach(p => {
      if (p.category) {
        categories.add(p.category);
      }
    });
    return Array.from(categories).sort();
  }, [portfolios]);

  // Filter portfolios based on search term and category
  const filteredPortfolios = portfolios.filter((portfolio) => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const title = portfolio.title?.toLowerCase() || "";
      const category = portfolio.category?.toLowerCase() || "";
      const stylistName = stylists[portfolio.stylistId]?.fullName?.toLowerCase() || "";
      
      if (!title.includes(search) && !category.includes(search) && !stylistName.includes(search)) {
        return false;
      }
    }
    
    // Category filter
    if (categoryFilter !== "all" && portfolio.category !== categoryFilter) {
      return false;
    }
    
    return true;
  });

  // Calculate summary stats
  const summaryStats = {
    total: portfolios.length,
    pending: portfolios.filter(p => p.status === "pending").length,
    approved: portfolios.filter(p => p.status === "active").length,
    rejected: portfolios.filter(p => p.status === "rejected").length,
  };

  // Fetch stylists for the branch
  useEffect(() => {
    const fetchStylists = async () => {
      if (!userData?.branchId) return;

      try {
        const usersRef = collection(db, "users");
        const q = query(
          usersRef,
          where("branchId", "==", userData.branchId),
          where("roles", "array-contains", "stylist")
        );
        const snapshot = await getDocs(q);
        
        const stylistsMap = {};
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          stylistsMap[doc.id] = {
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            fullName: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
          };
        });
        
        setStylists(stylistsMap);
      } catch (error) {
        console.error("Error fetching stylists:", error);
        setError("Failed to load stylists");
      }
    };

    fetchStylists();
  }, [userData]);

  // Fetch portfolios
  const fetchPortfolios = async (pageNum = 1) => {
    if (!userData?.branchId) {
      console.log("❌ No branchId found in userData");
      return;
    }

    console.log("🔍 Fetching portfolios for branch:", userData.branchId);
    console.log("📊 Status filter:", statusFilter);
    console.log("👤 Selected stylist:", selectedStylist);

    try {
      setLoading(true);
      
      // Get all stylists in the branch first
      const usersRef = collection(db, "users");
      const usersQuery = query(
        usersRef,
        where("branchId", "==", userData.branchId),
        where("roles", "array-contains", "stylist")
      );
      const usersSnapshot = await getDocs(usersQuery);
      const stylistIds = usersSnapshot.docs.map((doc) => doc.id);

      console.log("✅ Found stylists in branch:", stylistIds.length, stylistIds);

      if (stylistIds.length === 0) {
        console.log("⚠️ No stylists found in this branch");
        setPortfolios([]);
        setLoading(false);
        return;
      }

      // Filter by stylist if selected
      const targetStylistIds = selectedStylist === "all" 
        ? stylistIds 
        : [selectedStylist];

      console.log("🎯 Target stylist IDs:", targetStylistIds.length, targetStylistIds);

      // Fetch all portfolios for the target stylists (no index required)
      // Firestore has a limit of 10 items for 'in' queries, so we'll batch if needed
      const batchSize = 10;
      let allPortfolios = [];

      for (let i = 0; i < targetStylistIds.length; i += batchSize) {
        const batch = targetStylistIds.slice(i, i + batchSize);
        
        console.log(`📦 Fetching batch ${i / batchSize + 1}:`, batch);
        
        // Simple query - only filter by stylistId (no composite index needed)
        const q = query(
          collection(db, "portfolio"),
          where("stylistId", "in", batch)
        );

        const snapshot = await getDocs(q);
        console.log(`✅ Batch ${i / batchSize + 1} returned:`, snapshot.docs.length, "portfolios");
        
        const portfolioData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        // Log each portfolio's details
        portfolioData.forEach(p => {
          console.log(`  📄 Portfolio: ${p.id} | Status: ${p.status} | Stylist: ${p.stylistId} | Title: ${p.title}`);
        });
        
        allPortfolios = [...allPortfolios, ...portfolioData];
      }

      console.log("📊 Total portfolios fetched:", allPortfolios.length);
      console.log("🔍 Before filtering - Portfolio statuses:", allPortfolios.map(p => p.status));

      // Manual filtering by status AND verify stylist belongs to branch
      const beforeFilterCount = allPortfolios.length;
      allPortfolios = allPortfolios.filter((portfolio) => {
        // Verify the stylist ID belongs to this branch
        if (!stylistIds.includes(portfolio.stylistId)) {
          console.log(`  ❌ Portfolio ${portfolio.id} rejected: stylist ${portfolio.stylistId} not in branch`);
          return false;
        }
        
        // Status filtering logic
        if (statusFilter === "all") {
          // Show all portfolios EXCEPT rejected (rejected only shown when filter is explicitly set)
          if (portfolio.status === "rejected") {
            console.log(`  ❌ Portfolio ${portfolio.id} rejected: status is "rejected" and filter is "all"`);
            return false;
          }
        } else {
          // Filter by specific status
          if (portfolio.status !== statusFilter) {
            console.log(`  ❌ Portfolio ${portfolio.id} rejected: status "${portfolio.status}" !== "${statusFilter}"`);
            return false;
          }
        }
        
        console.log(`  ✅ Portfolio ${portfolio.id} passed all filters`);
        return true;
      });

      console.log(`🔄 After filtering: ${allPortfolios.length} of ${beforeFilterCount} portfolios remain`);

      // Custom sorting: pending first, then approved, then rejected, then by createdAt (newest first)
      const statusOrder = { pending: 1, active: 2, approved: 2, rejected: 3 };
      allPortfolios.sort((a, b) => {
        // First, sort by status priority
        const aStatusOrder = statusOrder[a.status] || 99;
        const bStatusOrder = statusOrder[b.status] || 99;
        
        if (aStatusOrder !== bStatusOrder) {
          return aStatusOrder - bStatusOrder;
        }
        
        // If same status priority, sort by createdAt (newest first)
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });

      console.log("📅 Sorted portfolios: pending → approved → rejected, then by createdAt (newest first)");

      // Paginate
      const startIndex = (pageNum - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginatedPortfolios = allPortfolios.slice(startIndex, endIndex);

      console.log(`📄 Page ${pageNum}: Showing ${paginatedPortfolios.length} portfolios (${startIndex}-${endIndex} of ${allPortfolios.length})`);
      console.log("✅ Final portfolios to display:", paginatedPortfolios.map(p => ({ id: p.id, title: p.title, status: p.status })));

      setPortfolios(paginatedPortfolios);
      setTotalPages(Math.ceil(allPortfolios.length / itemsPerPage));
      setCurrentPage(pageNum);
    } catch (error) {
      console.error("❌ ERROR fetching portfolios:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      setError("Failed to load portfolios: " + error.message);
    } finally {
      console.log("🏁 Fetch complete. Loading set to false.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolios(1);
  }, [userData, selectedStylist, statusFilter, categoryFilter]);

  const handleApprove = async (portfolioId) => {
    try {
      setProcessingId(portfolioId);
      setError(null);
      setSuccessMessage(null);
      const portfolioRef = doc(db, "portfolio", portfolioId);
      await updateDoc(portfolioRef, {
        status: "active",
        approvedAt: Timestamp.now(),
        approvedBy: userData.uid,
      });
      
      setSuccessMessage("Portfolio approved successfully!");
      fetchPortfolios(currentPage);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error("Error approving portfolio:", error);
      setError("Failed to approve portfolio: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectClick = (portfolioId) => {
    setPortfolioToReject(portfolioId);
    setRejectionRemark("");
    setRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!portfolioToReject) return;
    
    if (!rejectionRemark.trim()) {
      setError("Please provide a rejection remark");
      return;
    }

    try {
      setProcessingId(portfolioToReject);
      setError(null);
      setSuccessMessage(null);
      const portfolioRef = doc(db, "portfolio", portfolioToReject);
      await updateDoc(portfolioRef, {
        status: "rejected",
        rejectedAt: Timestamp.now(),
        rejectedBy: userData.uid,
        rejectionRemark: rejectionRemark.trim(),
      });
      
      setSuccessMessage("Portfolio rejected successfully");
      setRejectModalOpen(false);
      setPortfolioToReject(null);
      setRejectionRemark("");
      fetchPortfolios(currentPage);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error("Error rejecting portfolio:", error);
      setError("Failed to reject portfolio: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-full">
            <ImageIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Portfolios</p>
            <p className="text-2xl font-semibold text-center">{summaryStats.total}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-yellow-50 rounded-full">
            <Clock className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Pending Approval</p>
            <p className="text-2xl font-semibold text-center">{summaryStats.pending}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-full">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Approved</p>
            <p className="text-2xl font-semibold text-center">{summaryStats.approved}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-red-50 rounded-full">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Rejected</p>
            <p className="text-2xl font-semibold text-center">{summaryStats.rejected}</p>
          </div>
        </Card>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-green-800 font-medium">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 hover:text-green-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800 font-medium">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Filter + Actions */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Left Side: Filter Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search portfolios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] w-full sm:w-64"
              />
            </div>

            {/* Stylist Filter */}
            <select
              value={selectedStylist}
              onChange={(e) => setSelectedStylist(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] whitespace-nowrap"
            >
              <option value="all">All Stylists</option>
              {Object.entries(stylists).map(([id, stylist]) => (
                <option key={id} value={id}>
                  {stylist.fullName}
                </option>
              ))}
            </select>
              
            {/* Status Filter Dropdown */}
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] whitespace-nowrap"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All (Pending + Approved)</option>
              <option value="pending">Pending</option>
              <option value="active">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
              
            {/* Category Filter Dropdown */}
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#160B53] focus:border-[#160B53] whitespace-nowrap min-w-[150px]"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Services</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Right Side: Status Info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg whitespace-nowrap">
              Showing <span className="font-semibold text-gray-900">{filteredPortfolios.length}</span> of <span className="font-semibold text-gray-900">{portfolios.length}</span> portfolios
            </div>
          </div>
        </div>
      </Card>

      {/* Portfolio Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#160B53]"></div>
        </div>
      ) : filteredPortfolios.length === 0 ? (
        <Card className="p-12 text-center">
          <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No portfolios found</h3>
          <p className="text-gray-600">
            {searchTerm 
              ? `No portfolios match "${searchTerm}"`
              : statusFilter === "all"
                ? "There are no portfolios to display."
                : statusFilter === "pending" 
                  ? "There are no pending portfolios waiting for approval."
                  : `No ${statusFilter === "active" ? "approved" : statusFilter} portfolios found.`}
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPortfolios.map((portfolio) => (
              <Card 
                key={portfolio.id} 
                className="overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Image Preview */}
                <div className="relative aspect-square bg-gray-100">
                  <img
                    src={portfolio.thumbnailUrl || portfolio.imageUrl}
                    alt={portfolio.title}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setPreviewImage(portfolio)}
                  />
                  <button
                    onClick={() => setPreviewImage(portfolio)}
                    className="absolute top-2 right-2 bg-white/90 p-2 rounded-full hover:bg-white transition-colors"
                  >
                    <Eye className="h-4 w-4 text-gray-700" />
                  </button>
                    
                  {/* Status Badge */}
                  <div className="absolute top-2 left-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        portfolio.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : portfolio.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {portfolio.status.charAt(0).toUpperCase() + portfolio.status.slice(1)}
                    </span>
                  </div>
                </div>

                {/* Portfolio Info */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 line-clamp-1">
                      {portfolio.title || "Untitled"}
                    </h3>
                    <p className="text-sm text-gray-600 flex items-center mt-1">
                      <User className="h-4 w-4 mr-1" />
                      {stylists[portfolio.stylistId]?.fullName || "Unknown Stylist"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Tag className="h-3 w-3" />
                    <span className="px-2 py-1 bg-gray-100 rounded">
                      {portfolio.category || "Uncategorized"}
                    </span>
                  </div>

                  {portfolio.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {portfolio.description}
                    </p>
                  )}

                  {portfolio.status === "rejected" && portfolio.rejectionRemark && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                      <p className="font-semibold text-red-800 mb-1">Rejection Reason:</p>
                      <p className="text-red-700">{portfolio.rejectionRemark}</p>
                    </div>
                  )}

                  <div className="flex items-center text-xs text-gray-500">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {formatDate(portfolio.createdAt)}
                  </div>

                  {/* Action Buttons */}
                  {portfolio.status === "pending" && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => handleApprove(portfolio.id)}
                        disabled={processingId === portfolio.id}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleRejectClick(portfolio.id)}
                        disabled={processingId === portfolio.id}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Card className="p-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => fetchPortfolios(currentPage - 1)}
                    disabled={currentPage === 1}
                    variant="outline"
                    className="flex items-center"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    onClick={() => fetchPortfolios(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    variant="outline"
                    className="flex items-center"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col transform transition-all duration-300 scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#160B53] to-[#12094A] text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{previewImage.title || "Untitled Portfolio"}</h2>
                    <p className="text-white/80 text-sm mt-1">
                      {stylists[previewImage.stylistId]?.fullName || "Unknown Stylist"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setPreviewImage(null)}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Image */}
              <div className="max-h-[70vh] overflow-auto">
                <img
                  src={previewImage.imageUrl}
                  alt={previewImage.title}
                  className="w-full h-auto"
                />
              </div>

              {/* Info */}
              <div className="p-6 space-y-4 border-t border-gray-200">
                {previewImage.description && (
                  <div>
                    <p className="text-gray-700">{previewImage.description}</p>
                  </div>
                )}

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Tag className="h-4 w-4 mr-1" />
                    {previewImage.category || "Uncategorized"}
                  </div>
                  <div className="flex items-center">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    {formatDate(previewImage.createdAt)}
                  </div>
                  <div className="flex items-center">
                    <ImageIcon className="h-4 w-4 mr-1" />
                    {previewImage.width} × {previewImage.height}
                  </div>
                </div>

                {previewImage.status === "rejected" && previewImage.rejectionRemark && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="font-semibold text-red-800 mb-1">Rejection Reason:</p>
                    <p className="text-red-700 text-sm">{previewImage.rejectionRemark}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            {previewImage.status === "pending" && (
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      handleApprove(previewImage.id);
                      setPreviewImage(null);
                    }}
                    disabled={processingId === previewImage.id}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white transition-colors"
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Approve Portfolio
                  </Button>
                  <Button
                    onClick={() => {
                      handleRejectClick(previewImage.id);
                      setPreviewImage(null);
                    }}
                    disabled={processingId === previewImage.id}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white transition-colors"
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    Reject Portfolio
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rejection Remark Modal */}
      {rejectModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4"
          onClick={() => {
            setRejectModalOpen(false);
            setPortfolioToReject(null);
            setRejectionRemark("");
          }}
        >
          <div
            className="relative max-w-md w-full bg-white rounded-xl shadow-2xl overflow-hidden transform transition-all duration-300 scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <XCircle className="h-6 w-6" />
                  <h2 className="text-xl font-bold">Reject Portfolio</h2>
                </div>
                <button
                  onClick={() => {
                    setRejectModalOpen(false);
                    setPortfolioToReject(null);
                    setRejectionRemark("");
                  }}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <p className="text-gray-700">
                Please provide a reason for rejecting this portfolio. The stylist will see this remark.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionRemark}
                  onChange={(e) => setRejectionRemark(e.target.value)}
                  placeholder="Enter the reason for rejection..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setRejectModalOpen(false);
                    setPortfolioToReject(null);
                    setRejectionRemark("");
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={!rejectionRemark.trim() || processingId === portfolioToReject}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Portfolio
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    
  );
};

export default StylistPortfolios;
