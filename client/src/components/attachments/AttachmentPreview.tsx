/**
 * AttachmentPreview Component
 * Displays previews for different file types (images, PDFs, audio, documents, Excel spreadsheets)
 */

import { useState, useEffect } from 'react';
import { X, FileText, Download, File as FileIcon, Loader2, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface AttachmentData {
  fileName: string;
  fileType: string;
  fileSize: number;
  objectPath: string;
  url?: string; // The actual URL to access the file
  threadId?: string; // Thread ID for authorization
}

interface ExcelSheet {
  name: string;
  data: any[][];
  rowCount: number;
  colCount: number;
}

interface ExcelPreviewData {
  fileName: string;
  sheetCount: number;
  sheets: ExcelSheet[];
  maxRowsPerSheet: number;
}

interface AttachmentPreviewProps {
  attachment: AttachmentData;
  onClose: () => void;
  open: boolean;
}

export function AttachmentPreview({ attachment, onClose, open }: AttachmentPreviewProps) {
  const [imageError, setImageError] = useState(false);
  const [convertedPdfUrl, setConvertedPdfUrl] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [excelData, setExcelData] = useState<ExcelPreviewData | null>(null);
  const [isLoadingExcel, setIsLoadingExcel] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);

  const isImage = attachment.fileType.startsWith('image/');
  const isPDF = attachment.fileType === 'application/pdf';
  const isAudio = attachment.fileType.startsWith('audio/');
  const isExcel = isExcelFile(attachment.fileName);
  const isWordDoc = isWordFile(attachment.fileName);
  const isOfficeDoc = isExcel || isWordDoc;
  const url = attachment.url || attachment.objectPath;
  // Excel preview is only available for message attachments with threadId
  // For other contexts (documents tab, general attachments), fall back to download
  const canPreviewExcel = isExcel && !!attachment.threadId;

  // Helper function to check if file is an Excel spreadsheet
  function isExcelFile(fileName: string): boolean {
    const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    return ['.xlsx', '.xls', '.xlsm', '.xlsb'].includes(extension);
  }

  // Helper function to check if file is a Word document
  function isWordFile(fileName: string): boolean {
    const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    return ['.docx', '.doc'].includes(extension);
  }

  // Load Excel preview when dialog opens (only for message attachments with threadId)
  useEffect(() => {
    if (open && canPreviewExcel && !excelData && !isLoadingExcel && !excelError) {
      loadExcelPreview();
    }
  }, [open, canPreviewExcel]);

  // Convert Word document to PDF when preview opens
  useEffect(() => {
    if (open && isWordDoc && !convertedPdfUrl && !isConverting && !conversionError) {
      convertDocumentToPDF();
    }
  }, [open, isWordDoc]);

  const loadExcelPreview = async () => {
    setIsLoadingExcel(true);
    setExcelError(null);

    try {
      const response = await apiRequest('POST', '/api/internal/attachments/excel-preview', {
        objectPath: attachment.objectPath,
        fileName: attachment.fileName,
        threadId: attachment.threadId,
        url: attachment.url,
      });

      setExcelData(response);
    } catch (error: any) {
      console.error('Failed to load Excel preview:', error);
      setExcelError(error.message || 'Failed to load spreadsheet preview');
    } finally {
      setIsLoadingExcel(false);
    }
  };

  const convertDocumentToPDF = async () => {
    setIsConverting(true);
    setConversionError(null);

    try {
      const response = await apiRequest('POST', '/api/internal/project-messages/convert-to-pdf', {
        objectPath: attachment.objectPath,
        fileName: attachment.fileName,
        threadId: attachment.threadId,
      });

      setConvertedPdfUrl(response.pdfUrl);
    } catch (error: any) {
      console.error('Failed to convert document:', error);
      setConversionError(error.message || 'Failed to convert document to PDF');
    } finally {
      setIsConverting(false);
    }
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setConvertedPdfUrl(null);
      setIsConverting(false);
      setConversionError(null);
      setExcelData(null);
      setIsLoadingExcel(false);
      setExcelError(null);
    }
  }, [open]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate pr-4">{attachment.fileName}</DialogTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                asChild
              >
                <a href={url} download={attachment.fileName}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {attachment.fileType} • {formatFileSize(attachment.fileSize)}
          </p>
        </DialogHeader>

        <div className="mt-4">
          {/* Image Preview */}
          {isImage && !imageError && (
            <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
              <img
                src={url}
                alt={attachment.fileName}
                className="max-w-full max-h-[70vh] object-contain"
                onError={() => setImageError(true)}
              />
            </div>
          )}

          {/* Image Error Fallback */}
          {isImage && imageError && (
            <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg p-12 text-center">
              <FileIcon className="h-16 w-16 text-gray-400 mb-4" />
              <p className="text-muted-foreground">Unable to load image preview</p>
              <Button
                className="mt-4"
                variant="outline"
                asChild
              >
                <a href={url} download={attachment.fileName}>
                  Download File
                </a>
              </Button>
            </div>
          )}

          {/* PDF Preview */}
          {isPDF && (
            <div className="w-full h-[70vh] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
              <iframe
                src={url}
                className="w-full h-full"
                title={attachment.fileName}
              />
            </div>
          )}

          {/* Audio Preview */}
          {isAudio && (
            <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg p-12">
              <FileIcon className="h-16 w-16 text-gray-400 mb-4" />
              <p className="text-lg font-medium mb-4">{attachment.fileName}</p>
              <audio
                src={url}
                controls
                className="w-full max-w-md"
                preload="metadata"
              />
            </div>
          )}

          {/* Excel Spreadsheet Preview */}
          {isExcel && (
            <div>
              {isLoadingExcel && (
                <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg p-12 text-center">
                  <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                  <p className="text-lg font-medium mb-2">Loading spreadsheet...</p>
                  <p className="text-sm text-muted-foreground">
                    Please wait while we parse your Excel file
                  </p>
                </div>
              )}

              {excelError && (
                <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg p-12 text-center">
                  <Table className="h-16 w-16 text-gray-400 mb-4" />
                  <p className="text-lg font-medium mb-2">{attachment.fileName}</p>
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{excelError}</AlertDescription>
                  </Alert>
                  <p className="text-muted-foreground mb-4">
                    Unable to generate preview. You can still download the original file.
                  </p>
                  <Button
                    variant="default"
                    asChild
                  >
                    <a href={url} download={attachment.fileName}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Original File
                    </a>
                  </Button>
                </div>
              )}

              {excelData && !isLoadingExcel && !excelError && (
                <div className="w-full h-[70vh] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  {excelData.sheets.length === 1 ? (
                    <ExcelSheetTable sheet={excelData.sheets[0]} maxRows={excelData.maxRowsPerSheet} />
                  ) : (
                    <Tabs defaultValue={excelData.sheets[0]?.name} className="h-full flex flex-col">
                      <TabsList className="flex-shrink-0 w-full justify-start overflow-x-auto">
                        {excelData.sheets.map((sheet) => (
                          <TabsTrigger key={sheet.name} value={sheet.name} className="text-sm">
                            {sheet.name}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {excelData.sheets.map((sheet) => (
                        <TabsContent key={sheet.name} value={sheet.name} className="flex-1 mt-0 overflow-hidden">
                          <ExcelSheetTable sheet={sheet} maxRows={excelData.maxRowsPerSheet} />
                        </TabsContent>
                      ))}
                    </Tabs>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Word Document (converted to PDF) */}
          {isWordDoc && (
            <div>
              {isConverting && (
                <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg p-12 text-center">
                  <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                  <p className="text-lg font-medium mb-2">Converting document...</p>
                  <p className="text-sm text-muted-foreground">
                    Please wait while we convert your document to PDF for preview
                  </p>
                </div>
              )}

              {conversionError && (
                <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg p-12 text-center">
                  <FileText className="h-16 w-16 text-gray-400 mb-4" />
                  <p className="text-lg font-medium mb-2">{attachment.fileName}</p>
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{conversionError}</AlertDescription>
                  </Alert>
                  <p className="text-muted-foreground mb-4">
                    Unable to generate preview. You can still download the original file.
                  </p>
                  <Button
                    variant="default"
                    asChild
                  >
                    <a href={url} download={attachment.fileName}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Original File
                    </a>
                  </Button>
                </div>
              )}

              {convertedPdfUrl && !isConverting && !conversionError && (
                <div className="w-full h-[70vh] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  <iframe
                    src={convertedPdfUrl}
                    className="w-full h-full"
                    title={`${attachment.fileName} (PDF Preview)`}
                  />
                </div>
              )}
            </div>
          )}

          {/* Generic File (not image, PDF, audio, or Office doc) */}
          {!isImage && !isPDF && !isAudio && !isOfficeDoc && (
            <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg p-12 text-center">
              <FileText className="h-16 w-16 text-gray-400 mb-4" />
              <p className="text-lg font-medium mb-2">{attachment.fileName}</p>
              <p className="text-sm text-muted-foreground mb-6">
                {attachment.fileType} • {formatFileSize(attachment.fileSize)}
              </p>
              <p className="text-muted-foreground mb-4">
                Preview not available for this file type
              </p>
              <Button
                variant="default"
                asChild
              >
                <a href={url} download={attachment.fileName}>
                  <Download className="h-4 w-4 mr-2" />
                  Download File
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Excel Sheet Table Component with pagination
function ExcelSheetTable({ sheet, maxRows }: { sheet: ExcelSheet; maxRows: number }) {
  const [currentPage, setCurrentPage] = useState(0);
  const ROWS_PER_PAGE = 50;
  
  const isTruncated = sheet.rowCount > maxRows;
  const hasHeader = sheet.data.length > 0;
  const headerRow = hasHeader ? sheet.data[0] : [];
  const dataRows = hasHeader ? sheet.data.slice(1) : [];
  
  const totalPages = Math.ceil(dataRows.length / ROWS_PER_PAGE);
  const startIndex = currentPage * ROWS_PER_PAGE;
  const endIndex = Math.min(startIndex + ROWS_PER_PAGE, dataRows.length);
  const currentRows = dataRows.slice(startIndex, endIndex);
  
  return (
    <div className="h-full flex flex-col">
      {isTruncated && (
        <div className="flex-shrink-0 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Showing first {maxRows} of {sheet.rowCount} total rows. Download the file to see all data.
          </p>
        </div>
      )}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <table className="w-full border-collapse text-sm" data-testid="excel-preview-table">
            {hasHeader && (
              <thead className="sticky top-0">
                <tr className="bg-gray-200 dark:bg-gray-700">
                  {headerRow.map((cell, cellIndex) => (
                    <th
                      key={cellIndex}
                      className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left whitespace-nowrap font-semibold"
                    >
                      {cell !== null && cell !== undefined ? String(cell) : ''}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {currentRows.map((row, rowIndex) => (
                <tr 
                  key={startIndex + rowIndex} 
                  className={rowIndex % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-850'}
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left whitespace-nowrap max-w-xs truncate"
                      title={cell !== null && cell !== undefined ? String(cell) : ''}
                    >
                      {cell !== null && cell !== undefined ? String(cell) : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>
      <div className="flex-shrink-0 px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {sheet.rowCount} rows × {sheet.colCount} columns
          {isTruncated && ` (preview limited to ${maxRows} rows)`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              data-testid="excel-prev-page"
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {currentPage + 1} of {totalPages} (rows {startIndex + 1}-{endIndex} of {dataRows.length})
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              data-testid="excel-next-page"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
