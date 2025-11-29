import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Eye, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { VoiceNotePlayer } from "@/components/attachments/VoiceNotePlayer";
import { showFriendlyError } from "@/lib/friendlyErrors";

interface DocumentPreviewDialogProps {
  document: {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    objectPath: string;
  };
  trigger: React.ReactNode;
}

export function DocumentPreviewDialog({ document, trigger }: DocumentPreviewDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const isPreviewable = (fileType: string): boolean => {
    const type = fileType.toLowerCase();
    return (
      type.includes('image') ||
      type.includes('pdf') ||
      type === 'application/pdf' ||
      type.includes('audio')
    );
  };

  useEffect(() => {
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  const handleOpenChange = async (open: boolean) => {
    if (open) {
      setIsOpen(true);
      setIsLoading(true);
      setError(null);

      try {
        const fileType = document.fileType.toLowerCase();

        // For PDFs, use direct URL (like portal) - blob URLs have rendering issues in iframes
        if (fileType.includes('pdf') || fileType === 'application/pdf') {
          const directUrl = `/api/documents/${document.id}/file`;
          console.log('Using direct URL for PDF:', directUrl);
          setBlobUrl(directUrl);
          setIsLoading(false);
        } else {
          // For images and audio, use blob URLs
          const response = await fetch(`/api/documents/${document.id}/file`, {
            credentials: 'include',
          });

          if (!response.ok) {
            throw new Error('Failed to fetch document');
          }

          const blob = await response.blob();
          console.log('Blob created:', {
            type: blob.type,
            size: blob.size,
            fileName: document.fileName,
            expectedType: document.fileType
          });

          const url = URL.createObjectURL(blob);
          console.log('Blob URL created:', url);
          setBlobUrl(url);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error loading preview:', err);
        setError('Failed to load document preview');
        showFriendlyError({ error: err });
        setIsLoading(false);
      }
    } else {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
      setBlobUrl(null);
      setIsOpen(false);
      setError(null);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/documents/${document.id}/file`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to download document');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.fileName;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
      toast({
        title: 'Success',
        description: 'Document downloaded successfully',
      });
    } catch (error) {
      showFriendlyError({ error });
    }
  };

  const renderPreview = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading preview...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }

    if (!blobUrl) {
      return null;
    }

    const fileType = document.fileType.toLowerCase();

    if (fileType.includes('image')) {
      return (
        <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg p-4 min-h-[400px]">
          <img
            src={blobUrl}
            alt={document.fileName}
            className="max-w-full max-h-[70vh] object-contain rounded"
            data-testid="preview-image"
            onError={(e) => {
              console.error('Image failed to load:', e);
              setError('Failed to load image preview');
            }}
            onLoad={() => {
              console.log('Image loaded successfully:', blobUrl);
            }}
          />
        </div>
      );
    }

    if (fileType.includes('pdf') || fileType === 'application/pdf') {
      return (
        <iframe
          src={blobUrl}
          className="w-full h-[70vh] border-0 rounded-lg"
          title={document.fileName}
          data-testid="preview-pdf"
        />
      );
    }

    if (fileType.includes('audio')) {
      return (
        <div className="flex items-center justify-center py-8">
          <VoiceNotePlayer
            audioUrl={blobUrl}
            fileName={document.fileName}
            className="w-full max-w-2xl"
          />
        </div>
      );
    }

    return (
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          Preview not available for this file type. Please download to view.
        </AlertDescription>
      </Alert>
    );
  };

  if (!isPreviewable(document.fileType)) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild data-testid={`button-preview-${document.id}`}>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Eye className="w-5 h-5" />
              {document.fileName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                data-testid="button-download-from-preview"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
          <DialogDescription>
            {(document.fileSize / 1024).toFixed(1)} KB
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {renderPreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
