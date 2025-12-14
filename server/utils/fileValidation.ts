/**
 * File Validation Utilities
 * Server-side validation for file uploads to ensure security and compliance
 */

// Allowed file types for different categories
export const ALLOWED_FILE_TYPES = {
  images: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ],
  documents: [
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'text/plain',
    'text/csv',
    'application/zip', // .zip
    'application/x-zip-compressed', // .zip (Windows)
  ],
  audio: [
    'audio/webm',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',      // MP4 audio (Safari, Chrome, Firefox, Edge)
    'audio/aac',      // AAC audio (Safari fallback)
    'audio/wav',
    'audio/ogg',
  ],
};

// Flatten all allowed types
export const ALL_ALLOWED_FILE_TYPES = [
  ...ALLOWED_FILE_TYPES.images,
  ...ALLOWED_FILE_TYPES.documents,
  ...ALLOWED_FILE_TYPES.audio,
];

// File size limits (in bytes)
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB for attachments
export const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25MB for documents
export const MAX_VOICE_NOTE_SIZE = 10 * 1024 * 1024; // 10MB for voice notes

// Upload limits
export const MAX_FILES_PER_MESSAGE = 5;
export const MAX_FILES_PER_UPLOAD = 10;

/**
 * Validates if a file type is allowed
 * @param mimeType - The MIME type of the file
 * @param allowedTypes - Optional custom list of allowed types
 * @returns true if file type is allowed, false otherwise
 */
export function validateFileType(
  mimeType: string,
  allowedTypes: string[] = ALL_ALLOWED_FILE_TYPES
): boolean {
  if (!mimeType || typeof mimeType !== 'string') {
    return false;
  }

  // Normalize MIME type (lowercase and trim)
  const normalizedType = mimeType.toLowerCase().trim();

  return allowedTypes.some(allowed =>
    allowed.toLowerCase() === normalizedType
  );
}

/**
 * Validates if a file size is within allowed limits
 * @param size - The file size in bytes
 * @param maxSize - Optional custom max size
 * @returns true if file size is valid, false otherwise
 */
export function validateFileSize(
  size: number,
  maxSize: number = MAX_FILE_SIZE
): boolean {
  if (typeof size !== 'number' || size < 0) {
    return false;
  }

  return size <= maxSize;
}

/**
 * Validates if a filename is safe (no path traversal, etc.)
 * @param fileName - The filename to validate
 * @returns true if filename is safe, false otherwise
 */
export function validateFileName(fileName: string): boolean {
  if (!fileName || typeof fileName !== 'string') {
    return false;
  }

  // Check for path traversal attempts
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return false;
  }

  // Check for null bytes
  if (fileName.includes('\0')) {
    return false;
  }

  // Check for reasonable length (max 255 characters)
  if (fileName.length > 255) {
    return false;
  }

  // Must have at least one character before extension
  const parts = fileName.split('.');
  if (parts.length < 2 || parts[0].length === 0) {
    return false;
  }

  return true;
}

/**
 * Sanitizes a filename by removing unsafe characters
 * @param fileName - The filename to sanitize
 * @returns Sanitized filename
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName) return 'unnamed';

  // Remove path components
  let sanitized = fileName.replace(/^.*[\\\/]/, '');

  // Remove or replace unsafe characters
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop();
    const nameWithoutExt = sanitized.substring(0, 255 - (ext?.length || 0) - 1);
    sanitized = `${nameWithoutExt}.${ext}`;
  }

  return sanitized;
}

/**
 * Gets the file category based on MIME type
 * @param mimeType - The MIME type
 * @returns The category ('image', 'document', 'audio', or 'other')
 */
export function getFileCategory(mimeType: string): 'image' | 'document' | 'audio' | 'other' {
  if (!mimeType) return 'other';

  const normalizedType = mimeType.toLowerCase().trim();

  if (ALLOWED_FILE_TYPES.images.some(t => t.toLowerCase() === normalizedType)) {
    return 'image';
  }
  if (ALLOWED_FILE_TYPES.documents.some(t => t.toLowerCase() === normalizedType)) {
    return 'document';
  }
  if (ALLOWED_FILE_TYPES.audio.some(t => t.toLowerCase() === normalizedType)) {
    return 'audio';
  }

  return 'other';
}

/**
 * Formats file size in human-readable format
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validates an entire file upload request
 * @param fileName - The filename
 * @param fileType - The MIME type
 * @param fileSize - The file size in bytes
 * @param maxSize - Optional max size override
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateFileUpload(
  fileName: string,
  fileType: string,
  fileSize: number,
  maxSize: number = MAX_FILE_SIZE
): { isValid: boolean; error?: string } {
  // Validate filename
  if (!validateFileName(fileName)) {
    return {
      isValid: false,
      error: `Invalid filename: ${fileName}. Filenames cannot contain path separators or special characters.`
    };
  }

  // Validate file type
  if (!validateFileType(fileType)) {
    return {
      isValid: false,
      error: `File type not allowed: ${fileType}. Allowed types: images, PDFs, documents, audio files, and ZIP archives.`
    };
  }

  // Validate file size
  if (!validateFileSize(fileSize, maxSize)) {
    return {
      isValid: false,
      error: `File size ${formatFileSize(fileSize)} exceeds maximum allowed size of ${formatFileSize(maxSize)}.`
    };
  }

  return { isValid: true };
}

/**
 * Checks if a file is an image
 * @param mimeType - The MIME type
 * @returns true if image, false otherwise
 */
export function isImageFile(mimeType: string): boolean {
  return getFileCategory(mimeType) === 'image';
}

/**
 * Checks if a file is audio
 * @param mimeType - The MIME type
 * @returns true if audio, false otherwise
 */
export function isAudioFile(mimeType: string): boolean {
  return getFileCategory(mimeType) === 'audio';
}

/**
 * Checks if a file is a document
 * @param mimeType - The MIME type
 * @returns true if document, false otherwise
 */
export function isDocumentFile(mimeType: string): boolean {
  return getFileCategory(mimeType) === 'document';
}
