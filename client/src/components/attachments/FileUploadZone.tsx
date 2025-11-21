/**
 * FileUploadZone Component
 * Drag-and-drop file upload zone with file validation
 */

import { useCallback, useState } from 'react';
import { Upload, File, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  acceptedTypes?: string[];
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

export function FileUploadZone({
  onFilesSelected,
  maxFiles = 5,
  maxSize = 25 * 1024 * 1024, // 25MB default
  acceptedTypes = ['image/*', '.pdf', 'audio/*', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'],
  disabled = false,
  className = '',
  compact = false,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFiles = useCallback((files: File[]): { valid: File[]; errors: string[] } => {
    const valid: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      // Check file size
      if (file.size > maxSize) {
        errors.push(`${file.name} exceeds maximum size of ${formatFileSize(maxSize)}`);
        continue;
      }

      // Check file type if acceptedTypes is specified
      if (acceptedTypes && acceptedTypes.length > 0) {
        const fileType = file.type;
        const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

        const isAccepted = acceptedTypes.some(type => {
          if (type.startsWith('.')) {
            return fileExt === type.toLowerCase();
          }
          if (type.endsWith('/*')) {
            const category = type.split('/')[0];
            return fileType.startsWith(category + '/');
          }
          return fileType === type;
        });

        if (!isAccepted) {
          errors.push(`${file.name} has an unsupported file type`);
          continue;
        }
      }

      valid.push(file);
    }

    // Check total count
    if (valid.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} files allowed`);
      return { valid: valid.slice(0, maxFiles), errors };
    }

    return { valid, errors };
  }, [maxFiles, maxSize, acceptedTypes]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const { valid, errors } = validateFiles(fileArray);

    if (errors.length > 0) {
      setError(errors.join('. '));
      setTimeout(() => setError(null), 5000);
    } else {
      setError(null);
    }

    if (valid.length > 0) {
      onFilesSelected(valid);
    }
  }, [onFilesSelected, validateFiles]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    handleFiles(files);
  }, [disabled, handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    handleFiles(files);
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [handleFiles]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className={className}>
      <div
        className={`
          relative border-2 border-dashed rounded-lg text-center transition-colors
          ${compact ? 'p-3' : 'p-8'}
          ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 dark:border-gray-600'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}
        `}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />

        {compact ? (
          <div className="flex items-center gap-2">
            <div className={`
              rounded-full p-1.5
              ${isDragging ? 'bg-primary/10' : 'bg-gray-100 dark:bg-gray-800'}
            `}>
              <Upload className={`h-4 w-4 ${isDragging ? 'text-primary' : 'text-gray-400'}`} />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">
                {isDragging ? 'Drop files here' : 'Click or drag files to attach'}
              </p>
              <p className="text-xs text-muted-foreground">
                Max {maxFiles} files • {formatFileSize(maxSize)} each
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className={`
              rounded-full p-4
              ${isDragging ? 'bg-primary/10' : 'bg-gray-100 dark:bg-gray-800'}
            `}>
              <Upload className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-gray-400'}`} />
            </div>

            <div>
              <p className="text-lg font-medium">
                {isDragging ? 'Drop files here' : 'Drag and drop files here'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse
              </p>
            </div>

            <div className="text-xs text-muted-foreground">
              <p>Maximum {maxFiles} files • {formatFileSize(maxSize)} per file</p>
              <p className="mt-1">Supported: Images, PDFs, Documents, Audio</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-start gap-2">
            <X className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-destructive flex-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
