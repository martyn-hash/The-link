/**
 * DocumentPreviewDialog Component
 * Displays a preview of Word and Excel documents using Microsoft Office Online viewer
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  fileUrl: string;
  fileType: string;
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  fileName,
  fileUrl,
  fileType,
}: DocumentPreviewDialogProps) {
  const isWord = fileType.includes('word') || fileType.includes('document');
  const isExcel = fileType.includes('spreadsheet') || fileType.includes('excel');

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(fileUrl, '_blank');
  };

  // Encode the file URL for Microsoft Office Online viewer
  const encodedUrl = encodeURIComponent(fileUrl);
  const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex-1 truncate pr-4">{fileName}</DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInNewTab}
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                title="Download file"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 mt-4">
          {(isWord || isExcel) ? (
            <>
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Document preview is provided by Microsoft Office Online. If the preview doesn't load,
                  you can download the file or open it in a new tab.
                </AlertDescription>
              </Alert>
              <iframe
                src={viewerUrl}
                className="w-full h-[calc(90vh-200px)] border-0 rounded-lg bg-muted"
                title={fileName}
              />
            </>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This file type cannot be previewed. Please download the file to view it.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
