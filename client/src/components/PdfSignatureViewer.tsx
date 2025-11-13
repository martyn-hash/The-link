import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfSignatureViewerProps {
  pdfUrl: string;
  onPageClick?: (pageNumber: number, xPercent: number, yPercent: number) => void;
  renderOverlay?: (pageNumber: number, renderedWidth: number, renderedHeight: number) => React.ReactNode;
  onPageDimensionsChange?: (pageNumber: number, width: number, height: number) => void;
  onDocumentLoad?: (numPages: number) => void;
  className?: string;
  clickable?: boolean;
}

export function PdfSignatureViewer({
  pdfUrl,
  onPageClick,
  renderOverlay,
  onPageDimensionsChange,
  onDocumentLoad,
  className = "",
  clickable = false,
}: PdfSignatureViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageDimensions, setPageDimensions] = useState<Map<number, { width: number; height: number }>>(new Map());
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    if (onDocumentLoad) {
      onDocumentLoad(numPages);
    }
  }

  function createPageRenderHandler(pageNumber: number) {
    return (page: any) => {
      const { width, height } = page;
      
      // Store dimensions for this page
      setPageDimensions(prev => {
        const currentDims = prev.get(pageNumber);
        if (!currentDims || currentDims.width !== width || currentDims.height !== height) {
          const next = new Map(prev);
          next.set(pageNumber, { width, height });
          return next;
        }
        return prev;
      });
      
      // Notify parent of dimension changes (outside render cycle)
      if (onPageDimensionsChange) {
        onPageDimensionsChange(pageNumber, width, height);
      }
    };
  }

  function createOverlayClickHandler(pageNumber: number) {
    return (e: React.MouseEvent<HTMLDivElement>) => {
      if (!clickable || !onPageClick) {
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const xPercent = Math.min(Math.max((x / rect.width) * 100, 0), 100);
      const yPercent = Math.min(Math.max((y / rect.height) * 100, 0), 100);

      const xPercentRounded = Math.round(xPercent * 100) / 100;
      const yPercentRounded = Math.round(yPercent * 100) / 100;

      onPageClick(pageNumber, xPercentRounded, yPercentRounded);
    };
  }

  // Generate array of page numbers
  const pageNumbers = numPages > 0 ? Array.from({ length: numPages }, (_, i) => i + 1) : [];

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex-1 overflow-auto border border-border rounded-lg bg-white">
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
        >
          <div className="flex flex-col gap-4 p-4">
            {pageNumbers.map((pageNumber) => (
              <div key={pageNumber} className="relative inline-block" id={`page-${pageNumber}`}>
                <Page
                  pageNumber={pageNumber}
                  onRenderSuccess={createPageRenderHandler(pageNumber)}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="max-w-full shadow-lg"
                />
                <div
                  ref={(el) => {
                    if (el) {
                      pageRefs.current.set(pageNumber, el);
                    } else {
                      pageRefs.current.delete(pageNumber);
                    }
                  }}
                  onClick={createOverlayClickHandler(pageNumber)}
                  className={`absolute inset-0 ${clickable ? "cursor-crosshair" : ""}`}
                  data-testid="pdf-overlay"
                  data-page={pageNumber}
                >
                  {renderOverlay && pageDimensions.get(pageNumber) && renderOverlay(
                    pageNumber, 
                    pageDimensions.get(pageNumber)!.width, 
                    pageDimensions.get(pageNumber)!.height
                  )}
                </div>
                {/* Page label */}
                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  Page {pageNumber} of {numPages}
                </div>
              </div>
            ))}
          </div>
        </Document>
      </div>
    </div>
  );
}
