/**
 * PDF Preview Modal Component
 * Generates and displays PDF preview with download/print options
 */

import { useState, useRef, useEffect } from 'react';
import { X, Download, Printer, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';

const PDFPreviewModal = ({ isOpen, onClose, contentRef, title = 'Document Preview', fileName = 'document' }) => {
  const [generating, setGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (isOpen && contentRef?.current) {
      generatePDF();
    } else {
      // Clean up PDF URL when modal closes
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
    }
  }, [isOpen]);

  const generatePDF = async () => {
    if (!contentRef?.current) {
      toast.error('No content to generate PDF');
      return;
    }

    setGenerating(true);
    try {
      // Wait for all images to load with proper CORS handling
      const images = contentRef.current.querySelectorAll('img');
      const imagePromises = Array.from(images).map((img) => {
        if (img.complete && img.naturalHeight !== 0) {
          return Promise.resolve();
        }
        return new Promise((resolve) => {
          // Set crossOrigin for CORS
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
          
          // Force reload if image is already loaded but might have CORS issues
          if (img.complete && img.naturalHeight === 0) {
            const src = img.src;
            img.src = '';
            img.src = src;
          }
          
          // Timeout after 5 seconds
          setTimeout(() => {
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
            resolve();
          }, 5000);
        });
      });
      
      await Promise.all(imagePromises);
      
      // Additional wait to ensure images are rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture the content as canvas
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: contentRef.current.scrollWidth,
        windowHeight: contentRef.current.scrollHeight,
        removeContainer: true,
        onclone: (clonedDoc) => {
          // Ensure images are visible in cloned document
          const clonedImages = clonedDoc.querySelectorAll('img');
          clonedImages.forEach((img) => {
            if (img.src && !img.complete) {
              // Force image to load
              const newImg = new Image();
              newImg.crossOrigin = 'anonymous';
              newImg.src = img.src;
            }
          });
          // Fix any border rendering issues
          const certificateItems = clonedDoc.querySelectorAll('.certificate-item');
          certificateItems.forEach((item) => {
            // Ensure only left border is applied
            item.style.borderTop = 'none';
            item.style.borderRight = 'none';
            item.style.borderBottom = 'none';
            item.style.borderLeft = '3px solid #160B53';
          });
        },
      });

      // Calculate PDF dimensions (Letter size: 8.5" x 11" = 215.9mm x 279.4mm)
      // Account for margins: top 2.5cm (25mm), bottom 4cm (40mm), left/right 1.5cm (15mm)
      const pageWidth = 215.9; // Letter width in mm
      const pageHeight = 279.4; // Letter height in mm
      const topMargin = 25; // 2.5cm in mm
      const bottomMargin = 40; // 4cm in mm
      const sideMargin = 15; // 1.5cm in mm
      const contentWidth = pageWidth - (sideMargin * 2); // 185.9mm
      const contentHeight = pageHeight - topMargin - bottomMargin; // 214.4mm
      
      // Calculate image dimensions
      const imgWidth = contentWidth; // Use content width
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Convert content height to pixels for canvas slicing
      const pixelsPerMM = canvas.width / imgWidth;
      const contentHeightPx = contentHeight * pixelsPerMM;

      // Create PDF in Letter size
      const pdf = new jsPDF('p', 'mm', 'letter');
      let sourceY = 0; // Source Y position in canvas pixels
      let pageNumber = 0;

      // Slice content across pages
      while (sourceY < canvas.height) {
        if (pageNumber > 0) {
          pdf.addPage();
        }

        // Calculate how much content fits on this page
        const remainingHeight = canvas.height - sourceY;
        const sliceHeight = Math.min(contentHeightPx, remainingHeight);
        
        // Calculate the height in mm for this slice
        const sliceHeightMM = (sliceHeight / pixelsPerMM);

        // Create a temporary canvas for this page slice
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const pageCtx = pageCanvas.getContext('2d');
        
        // Draw the slice from the original canvas
        pageCtx.drawImage(
          canvas,
          0, sourceY, canvas.width, sliceHeight, // Source rectangle
          0, 0, canvas.width, sliceHeight // Destination rectangle
        );

        // Add the slice to PDF
        pdf.addImage(
          pageCanvas.toDataURL('image/png'),
          'PNG',
          sideMargin,
          topMargin,
          imgWidth,
          sliceHeightMM
        );

        sourceY += sliceHeight;
        pageNumber++;
      }

      // Generate blob URL for preview
      const pdfBlob = pdf.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);

      toast.success('PDF generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;

    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `${fileName}_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('PDF downloaded');
  };

  const handlePrint = () => {
    if (!pdfUrl) return;

    // Open PDF in new window for printing
    const printWindow = window.open(pdfUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    } else {
      toast.error('Please allow pop-ups to print PDF');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center gap-2">
            {pdfUrl && (
              <>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  title="Download PDF"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  title="Print PDF"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          {generating ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Generating PDF preview...</p>
              </div>
            </div>
          ) : pdfUrl ? (
            <iframe
              ref={iframeRef}
              src={pdfUrl}
              className="w-full h-full border-0"
              title="PDF Preview"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <p className="text-gray-500">No preview available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFPreviewModal;

