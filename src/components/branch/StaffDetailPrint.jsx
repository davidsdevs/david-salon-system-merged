/**
 * Staff Detail Print Component
 * Resume-style printable format for individual staff member
 */

import { useRef, useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { getBranchServices } from '../../services/branchServicesService';
import { getUserRoles, getInitials } from '../../utils/helpers';
import { ROLE_LABELS } from '../../utils/constants';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../ui/LoadingSpinner';
import PDFPreviewModal from '../ui/PDFPreviewModal';

const StaffDetailPrint = ({ staff, branchName, branchId, onClose, autoOpen = true }) => {
  const printRef = useRef();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPDFPreview, setShowPDFPreview] = useState(autoOpen); // Open immediately if autoOpen is true
  const [imagesLoaded, setImagesLoaded] = useState(false);

  useEffect(() => {
    const fetchServices = async () => {
      if (staff?.service_id && staff.service_id.length > 0 && branchId) {
        try {
          setLoading(true);
          const branchServices = await getBranchServices(branchId);
          const staffServices = branchServices.filter(service => 
            staff.service_id.includes(service.id) || staff.service_id.includes(service.serviceId)
          );
          setServices(staffServices);
        } catch (error) {
          console.error('Error fetching services:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchServices();
  }, [staff, branchId]);

  // Wait for images to load before allowing PDF generation
  useEffect(() => {
    if (!printRef.current) return;

    const images = printRef.current.querySelectorAll('img');
    if (images.length === 0) {
      setImagesLoaded(true);
      return;
    }

    let loadedCount = 0;
    const totalImages = images.length;

    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount === totalImages) {
        setImagesLoaded(true);
      }
    };

    images.forEach((img) => {
      // Ensure image has crossOrigin for CORS
      if (img.src && !img.crossOrigin) {
        img.crossOrigin = 'anonymous';
      }
      if (img.complete && img.naturalHeight !== 0) {
        checkAllLoaded();
      } else {
        img.onload = checkAllLoaded;
        img.onerror = checkAllLoaded; // Continue even if image fails
      }
    });
  }, [staff, services, loading]);

  if (!staff) return null;

  const staffRoles = getUserRoles(staff);
  const certificates = staff.certificates || [];
  const certificateArray = Array.isArray(certificates) 
    ? certificates 
    : Object.values(certificates || {});

  return (
    <>
      {/* PDF Preview Modal - Opens immediately */}
      <PDFPreviewModal
        isOpen={showPDFPreview && imagesLoaded && !loading}
        onClose={() => {
          setShowPDFPreview(false);
          if (onClose) onClose();
        }}
        contentRef={printRef}
        title={`Staff Detail - ${staff?.firstName} ${staff?.lastName}`}
        fileName={`Staff_Detail_${staff?.firstName}_${staff?.lastName}_${new Date().toISOString().split('T')[0]}`}
      />

      {/* Printable Content - Rendered off-screen for PDF generation */}
      <div ref={printRef} className="bg-white p-8 max-w-4xl mx-auto" style={{ position: 'fixed', left: '-200%', top: 0, width: '8.5in', zIndex: -1 }}>
        <style>{`
          @media print {
            @page {
              margin-top: 2.5cm;
              margin-right: 1.5cm;
              margin-bottom: 4cm;
              margin-left: 1.5cm;
              size: letter;
            }
            @page :first {
              margin-top: 2.5cm;
              margin-bottom: 4cm;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              word-wrap: break-word;
              overflow-wrap: break-word;
              word-break: keep-all;
              hyphens: none;
            }
            .no-print {
              display: none !important;
            }
            .print-break {
              page-break-after: always;
            }
            .print-avoid-break {
              page-break-inside: avoid;
            }
            .resume-footer {
              position: relative;
              margin-top: 80px;
              padding-top: 30px;
              padding-bottom: 40px;
              border-top: 1px solid #e5e7eb;
              page-break-inside: avoid;
              break-inside: avoid;
              orphans: 3;
              widows: 3;
            }
            .resume-content-wrapper {
              padding-top: 20px;
              padding-bottom: 60px;
            }
          }
          @media screen {
            .no-print {
              display: block;
            }
          }
          .resume-header {
            border-bottom: 3px solid #160B53;
            padding-bottom: 20px;
            margin-bottom: 40px;
            margin-top: 20px;
          }
          .resume-section {
            margin-bottom: 35px;
            page-break-inside: avoid;
            break-inside: avoid;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: keep-all;
            hyphens: none;
          }
          .certifications-section {
            page-break-before: always;
            break-before: page;
            margin-top: 20px;
          }
          .resume-content-wrapper {
            page-break-after: auto;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: keep-all;
          }
          .resume-header {
            page-break-after: avoid;
            break-after: avoid;
          }
          .resume-item {
            page-break-inside: avoid;
            break-inside: avoid;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: keep-all;
          }
          .certificate-item {
            page-break-inside: avoid;
            break-inside: avoid;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: keep-all;
          }
          .service-badge {
            page-break-inside: avoid;
            break-inside: avoid;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: keep-all;
          }
          .resume-section-title {
            color: #160B53;
            font-size: 18px;
            font-weight: bold;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 8px;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .resume-item {
            margin-bottom: 12px;
          }
          .resume-label {
            font-weight: 600;
            color: #374151;
            display: inline-block;
            min-width: 140px;
          }
          .resume-value {
            color: #6b7280;
          }
          .service-item {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #e5e7eb;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .service-item:last-child {
            border-bottom: none;
          }
          .service-name {
            font-size: 16px;
            font-weight: 600;
            color: #111827;
            margin-bottom: 6px;
          }
          .service-description {
            font-size: 13px;
            color: #6b7280;
            margin-bottom: 8px;
            line-height: 1.5;
          }
          .service-details {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            font-size: 12px;
            color: #374151;
          }
          .service-detail-item {
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .service-detail-label {
            font-weight: 600;
            color: #4b5563;
          }
          .service-badge {
            display: inline-block;
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            padding: 6px 12px;
            margin: 4px;
            border-radius: 6px;
            font-size: 13px;
          }
          .certificate-item {
            border-left: 3px solid #160B53;
            padding-left: 15px;
            margin-bottom: 15px;
            padding-top: 8px;
            padding-bottom: 8px;
            background-color: transparent;
            border-top: none;
            border-right: none;
            border-bottom: none;
          }
          .photo-container {
            width: 150px;
            height: 150px;
            border-radius: 8px;
            overflow: hidden;
            border: 3px solid #160B53;
            flex-shrink: 0;
          }
          .photo-container img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .photo-placeholder {
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #160B53 0%, #12094A 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 48px;
            font-weight: bold;
          }
          @media print {
            .photo-container {
              width: 120px;
              height: 120px;
            }
            .photo-placeholder {
              font-size: 36px;
            }
          }
        `}</style>

        {/* Content Wrapper */}
        <div className="resume-content-wrapper">
        {/* Header with Photo */}
        <div className="resume-header">
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {staff.firstName} {staff.middleName ? staff.middleName + ' ' : ''}{staff.lastName}
              </h1>
              <div className="flex flex-wrap gap-4 text-gray-600">
            {staff.email && (
              <div>
                <span className="font-semibold">Email:</span> {staff.email}
              </div>
            )}
            {staff.phone && (
              <div>
                <span className="font-semibold">Phone:</span> {staff.phone}
              </div>
            )}
            {staff.address && (
              <div>
                <span className="font-semibold">Address:</span> {staff.address}
              </div>
            )}
              </div>
            </div>
            {/* Profile Photo */}
            <div className="photo-container">
              {(staff.imageURL || staff.photoURL) ? (
                <img 
                  src={staff.imageURL || staff.photoURL} 
                  alt={`${staff.firstName} ${staff.lastName}`}
                  crossOrigin="anonymous"
                  style={{ display: 'block' }}
                  onError={(e) => {
                    // Fallback to initials if image fails to load
                    e.target.style.display = 'none';
                    const placeholder = e.target.parentElement.querySelector('.photo-placeholder');
                    if (placeholder) placeholder.style.display = 'flex';
                  }}
                  onLoad={() => {
                    // Hide placeholder when image loads
                    const placeholder = document.querySelector('.photo-placeholder');
                    if (placeholder && (staff.imageURL || staff.photoURL)) {
                      placeholder.style.display = 'none';
                    }
                  }}
                />
              ) : null}
              <div className="photo-placeholder" style={{ display: (staff.imageURL || staff.photoURL) ? 'none' : 'flex' }}>
                {getInitials(staff)}
              </div>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="resume-section">
          <h2 className="resume-section-title">Personal Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="resume-item">
              <span className="resume-label">Full Name:</span>
              <span className="resume-value">
                {staff.firstName} {staff.middleName ? staff.middleName + ' ' : ''}{staff.lastName}
              </span>
            </div>
            <div className="resume-item">
              <span className="resume-label">Email:</span>
              <span className="resume-value">{staff.email || 'N/A'}</span>
            </div>
            <div className="resume-item">
              <span className="resume-label">Phone:</span>
              <span className="resume-value">{staff.phone || 'N/A'}</span>
            </div>
            <div className="resume-item">
              <span className="resume-label">Address:</span>
              <span className="resume-value">{staff.address || 'N/A'}</span>
            </div>
            <div className="resume-item">
              <span className="resume-label">Branch:</span>
              <span className="resume-value">{branchName || staff.branchId || 'N/A'}</span>
            </div>
            <div className="resume-item">
              <span className="resume-label">Status:</span>
              <span className="resume-value">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  staff.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {staff.isActive ? 'Active' : 'Inactive'}
                </span>
              </span>
            </div>
            <div className="resume-item">
              <span className="resume-label">Joined Date:</span>
              <span className="resume-value">
                {staff.createdAt ? formatDate(staff.createdAt) : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Roles */}
        {staffRoles.length > 0 && (
          <div className="resume-section">
            <h2 className="resume-section-title">Roles & Responsibilities</h2>
            <div className="flex flex-wrap gap-2">
              {staffRoles.map(role => (
                <span key={role} className="service-badge bg-blue-100 text-blue-800 border-blue-300">
                  {ROLE_LABELS[role] || role}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Services */}
        {loading ? (
          <div className="resume-section">
            <h2 className="resume-section-title">Services Offered</h2>
            <LoadingSpinner size="sm" />
          </div>
        ) : services.length > 0 ? (
          <div className="resume-section">
            <h2 className="resume-section-title">Services Offered</h2>
            <div className="space-y-4">
              {services.map((service, index) => (
                <div key={service.id || index} className="service-item print-avoid-break">
                  <div className="service-name">{service.name}</div>
                  {service.description && (
                    <div className="service-description">{service.description}</div>
                  )}
                  <div className="service-details">
                    {service.category && (
                      <div className="service-detail-item">
                        <span className="service-detail-label">Category:</span>
                        <span>{service.category}</span>
                      </div>
                    )}
                    {service.duration && (
                      <div className="service-detail-item">
                        <span className="service-detail-label">Duration:</span>
                        <span>{service.duration} min</span>
                      </div>
                    )}
                    {service.price && (
                      <div className="service-detail-item">
                        <span className="service-detail-label">Price:</span>
                        <span>₱{parseFloat(service.price).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <strong>Total Services:</strong> {services.length}
            </div>
          </div>
        ) : (
          <div className="resume-section">
            <h2 className="resume-section-title">Services Offered</h2>
            <p className="text-gray-500 italic">No services assigned</p>
          </div>
        )}

        {/* Certificates */}
        {certificateArray.length > 0 ? (
          <div className="resume-section certifications-section">
            <h2 className="resume-section-title">Certifications & Qualifications</h2>
            <div className="space-y-3">
              {certificateArray.map((cert, index) => (
                <div key={cert.id || index} className="certificate-item print-avoid-break">
                  <div className="font-semibold text-gray-900">{cert.name || 'Certificate'}</div>
                  {cert.issuer && (
                    <div className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">Issued by:</span> {cert.issuer}
                    </div>
                  )}
                  {cert.date && (
                    <div className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">Date:</span> {formatDate(cert.date)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="resume-section certifications-section">
            <h2 className="resume-section-title">Certifications & Qualifications</h2>
            <p className="text-gray-500 italic">No certificates on record</p>
          </div>
        )}
        </div>

        {/* Footer - Moves to next page if content is too long */}
        <div className="resume-footer text-xs text-gray-500 text-center">
          <p>Generated on {formatDate(new Date())} | {branchName || 'Branch Staff Detail'}</p>
          <p className="mt-1">This is a computer-generated document.</p>
        </div>
      </div>
    </>
  );
};

export default StaffDetailPrint;

