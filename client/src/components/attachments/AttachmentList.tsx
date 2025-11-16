/**
 * AttachmentList Component
 * Displays a list of file attachments with actions
 */

import { useState } from 'react';
import { File as FileIcon, Image as ImageIcon, FileAudio, FileText, X, Eye, Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AttachmentPreview, type AttachmentData } from './AttachmentPreview';

interface Attachment {
  fileName: string;
  fileType: string;
  fileSize: number;
  objectPath?: string;
  url?: string;
}

interface AttachmentListProps {
  attachments: Attachment[] | File[];
  onRemove?: (index: number) => void;
  onPreview?: (attachment: Attachment, index: number) => void;
  readonly?: boolean;
  className?: string;
  threadId?: string; // For project message attachments
}

export function AttachmentList({
  attachments,
  onRemove,
  onPreview,
  readonly = false,
  className = '',
  threadId,
}: AttachmentListProps) {
  const [previewFile, setPreviewFile] = useState<{ attachment: Attachment; url: string } | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5" />;
    }
    if (fileType.startsWith('audio/')) {
      return <FileAudio className="h-5 w-5" />;
    }
    if (fileType === 'application/pdf') {
      return <FileText className="h-5 w-5" />;
    }
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) {
      return <FileSpreadsheet className="h-5 w-5" />;
    }
    if (fileType.includes('word') || fileType.includes('document')) {
      return <FileText className="h-5 w-5" />;
    }
    return <FileIcon className="h-5 w-5" />;
  };

  const getAttachmentData = (item: Attachment | File, index: number): Attachment => {
    if (item instanceof File) {
      return {
        fileName: item.name,
        fileType: item.type,
        fileSize: item.size,
      };
    }
    return item;
  };

  const getAttachmentUrl = (attachment: Attachment): string | null => {
    if (attachment.url) return attachment.url;
    if (attachment.objectPath && threadId) {
      return `/api/internal/project-messages/attachments${attachment.objectPath}?threadId=${threadId}`;
    }
    return null;
  };

  const handleDownload = (attachment: Attachment) => {
    const url = getAttachmentUrl(attachment);
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.fileName;
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreview = (attachment: Attachment) => {
    const url = getAttachmentUrl(attachment);
    if (!url) return;
    setPreviewFile({ attachment, url });
  };

  const canPreview = (fileType: string): boolean => {
    return (
      fileType.startsWith('image/') || 
      fileType === 'application/pdf' ||
      fileType.includes('word') ||
      fileType.includes('document') ||
      fileType.includes('spreadsheet') ||
      fileType.includes('excel')
    );
  };

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {attachments.map((item, index) => {
        const attachment = getAttachmentData(item, index);
        const isImage = attachment.fileType.startsWith('image/');

        return (
          <div
            key={index}
            className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            {/* File Icon */}
            <div className="flex-shrink-0 text-muted-foreground">
              {getFileIcon(attachment.fileType)}
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{attachment.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {attachment.fileType} • {formatFileSize(attachment.fileSize)}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Preview button (for images and PDFs in readonly mode) */}
              {readonly && canPreview(attachment.fileType) && getAttachmentUrl(attachment) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handlePreview(attachment)}
                  title="Preview"
                  data-testid={`button-preview-${index}`}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}

              {/* Download button (for readonly mode) */}
              {readonly && getAttachmentUrl(attachment) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownload(attachment)}
                  title="Download"
                  data-testid={`button-download-${index}`}
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}

              {/* Remove button (for edit mode) */}
              {!readonly && onRemove && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(index)}
                  title="Remove"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        );
      })}

      {/* Preview Dialog - Use unified AttachmentPreview for all file types */}
      {previewFile && (
        <AttachmentPreview
          attachment={{
            ...previewFile.attachment,
            url: previewFile.url, // Pass the resolved URL for previews/downloads
            threadId,
          } as AttachmentData}
          onClose={() => setPreviewFile(null)}
          open={!!previewFile}
        />
      )}
    </div>
  );
}
