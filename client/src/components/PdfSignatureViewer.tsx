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
  renderOverlay?: (pageNumber: number, pageWidth: number, pageHeight: number) => React.ReactNode;
  className?: string;
  clickable?: boolean;
}

export function PdfSignatureViewer({
  pdfUrl,
  onPageClick,
  renderOverlay,
  className = "",
  clickable = false,
}: PdfSignatureViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [pageHeight, setPageHeight] = useState<number>(0);
  const overlayRef = useRef<HTMLDivElement>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  function onPageLoadSuccess(page: any) {
    const { width, height } = page;
    setPageWidth(width);
    setPageHeight(height);
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!clickable || !onPageClick || !overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const xPercent = Math.min(Math.max((x / rect.width) * 100, 0), 100);
    const yPercent = Math.min(Math.max((y / rect.height) * 100, 0), 100);

    const xPercentRounded = Math.round(xPercent * 100) / 100;
    const yPercentRounded = Math.round(yPercent * 100) / 100;

    onPageClick(currentPage, xPercentRounded, yPercentRounded);
  };

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, numPages));
  };

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="relative border border-border rounded-lg overflow-hidden bg-white">
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          className="flex items-center justify-center"
        >
          <Page
            pageNumber={currentPage}
            onRenderSuccess={onPageLoadSuccess}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="max-w-full"
          />
        </Document>

        <div
          ref={overlayRef}
          onClick={handleOverlayClick}
          className={`absolute inset-0 ${clickable ? "cursor-crosshair" : ""}`}
          data-testid="pdf-overlay"
        >
          {renderOverlay && renderOverlay(currentPage, pageWidth, pageHeight)}
        </div>
      </div>

      {numPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            data-testid="button-previous-page"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          <span className="text-sm text-muted-foreground" data-testid="text-page-indicator">
            Page {currentPage} of {numPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={currentPage === numPages}
            data-testid="button-next-page"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
