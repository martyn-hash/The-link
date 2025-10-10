/**
 * AttachmentPreview Component
 * Displays previews for different file types (images, PDFs, audio, documents)
 */

import { useState } from 'react';
import { X, FileText, Download, File as FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface AttachmentData {
  fileName: string;
  fileType: string;
  fileSize: number;
  objectPath: string;
  url?: string; // The actual URL to access the file
}

interface AttachmentPreviewProps {
  attachment: AttachmentData;
  onClose: () => void;
  open: boolean;
}

export function AttachmentPreview({ attachment, onClose, open }: AttachmentPreviewProps) {
  const [imageError, setImageError] = useState(false);

  const isImage = attachment.fileType.startsWith('image/');
  const isPDF = attachment.fileType === 'application/pdf';
  const isAudio = attachment.fileType.startsWith('audio/');
  const url = attachment.url || attachment.objectPath;

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

          {/* Generic File (not image, PDF, or audio) */}
          {!isImage && !isPDF && !isAudio && (
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
