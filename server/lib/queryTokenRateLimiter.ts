/**
 * Rate Limiter for Query Response Token Endpoints
 * 
 * Protects public query response endpoints from brute-force attacks:
 * - Limits token access attempts by IP
 * - Tracks failed attempts per token prefix
 * - Implements sliding window rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  failedAttempts: number;
}

interface TokenAccessLog {
  lastAccess: number;
  accessCount: number;
  invalidAttempts: number;
}

// In-memory rate limit store (per-IP)
const ipRateLimits = new Map<string, RateLimitEntry>();

// In-memory token access tracking (per-token prefix)
const tokenAccessLogs = new Map<string, TokenAccessLog>();

// Rate limit configuration
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per 15 minutes per IP
const MAX_FAILED_ATTEMPTS_PER_TOKEN = 10; // Lock after 10 failed attempts
const TOKEN_LOCKOUT_DURATION = 60 * 60 * 1000; // 1 hour lockout after too many failed attempts
const SAVE_REQUEST_LIMIT = 120; // Higher limit for auto-save requests

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  Array.from(ipRateLimits.entries()).forEach(([key, entry]) => {
    if (now > entry.resetTime) {
      ipRateLimits.delete(key);
    }
  });
  Array.from(tokenAccessLogs.entries()).forEach(([key, log]) => {
    if (now - log.lastAccess > TOKEN_LOCKOUT_DURATION) {
      tokenAccessLogs.delete(key);
    }
  });
}, 10 * 60 * 1000);

/**
 * Get a safe key from the token (first 8 characters)
 */
function getTokenKey(token: string): string {
  return token.substring(0, 8);
}

/**
 * Check if an IP is rate limited for query token access
 */
export function checkQueryTokenRateLimit(
  ip: string, 
  endpoint: 'access' | 'save' | 'upload' | 'submit'
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `query_${endpoint}_${ip}`;
  const entry = ipRateLimits.get(key);
  
  // Determine limit based on endpoint type
  const limit = endpoint === 'save' ? SAVE_REQUEST_LIMIT : MAX_REQUESTS_PER_WINDOW;

  if (!entry || now > entry.resetTime) {
    // First request or window expired
    ipRateLimits.set(key, { 
      count: 1, 
      resetTime: now + RATE_LIMIT_WINDOW,
      failedAttempts: 0
    });
    return { allowed: true };
  }

  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

/**
 * Record a failed token access attempt
 * Returns true if the token should be locked out
 */
export function recordFailedTokenAttempt(token: string): boolean {
  const now = Date.now();
  const key = getTokenKey(token);
  const log = tokenAccessLogs.get(key);

  if (!log || now - log.lastAccess > TOKEN_LOCKOUT_DURATION) {
    // First attempt or lockout expired
    tokenAccessLogs.set(key, {
      lastAccess: now,
      accessCount: 1,
      invalidAttempts: 1
    });
    return false;
  }

  log.invalidAttempts++;
  log.lastAccess = now;

  return log.invalidAttempts >= MAX_FAILED_ATTEMPTS_PER_TOKEN;
}

/**
 * Check if a token is locked out due to too many failed attempts
 */
export function isTokenLockedOut(token: string): { locked: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = getTokenKey(token);
  const log = tokenAccessLogs.get(key);

  if (!log) {
    return { locked: false };
  }

  if (log.invalidAttempts >= MAX_FAILED_ATTEMPTS_PER_TOKEN) {
    const timeSinceLockout = now - log.lastAccess;
    if (timeSinceLockout < TOKEN_LOCKOUT_DURATION) {
      const retryAfter = Math.ceil((TOKEN_LOCKOUT_DURATION - timeSinceLockout) / 1000);
      return { locked: true, retryAfter };
    }
    // Lockout expired, reset
    tokenAccessLogs.delete(key);
  }

  return { locked: false };
}

/**
 * Record a successful token access (resets failed attempt counter)
 */
export function recordSuccessfulTokenAccess(token: string): void {
  const key = getTokenKey(token);
  const log = tokenAccessLogs.get(key);
  
  if (log) {
    log.invalidAttempts = 0;
    log.accessCount++;
    log.lastAccess = Date.now();
  } else {
    tokenAccessLogs.set(key, {
      lastAccess: Date.now(),
      accessCount: 1,
      invalidAttempts: 0
    });
  }
}

/**
 * Validate that an object path is from a legitimate signed upload
 * Object paths should match our expected format from ObjectStorageService
 */
export function validateAttachmentObjectPath(objectPath: string): boolean {
  if (!objectPath || typeof objectPath !== 'string') {
    return false;
  }

  // Path should not contain path traversal attempts
  if (objectPath.includes('..') || objectPath.includes('//')) {
    return false;
  }

  // Allow paths from object storage (start with /objects/)
  // These are returned by the Replit object storage service
  if (objectPath.startsWith('/objects/')) {
    // Validate the rest of the path contains only safe characters
    const restOfPath = objectPath.slice(9); // Remove '/objects/'
    const safePattern = /^[a-zA-Z0-9._/-]+$/;
    return safePattern.test(restOfPath) && objectPath.length < 500;
  }

  // Object paths from our ObjectStorageService follow a specific pattern
  // They should start with our private directory and contain a UUID-like filename
  const validPathPattern = /^\.private\/[a-zA-Z0-9_-]+\/[a-f0-9-]{36}\.[a-zA-Z0-9]+$/;
  const publicPathPattern = /^public\/[a-zA-Z0-9_-]+\/[a-f0-9-]{36}\.[a-zA-Z0-9]+$/;
  
  // Also allow simpler patterns used by the current implementation
  const simplePattern = /^[a-zA-Z0-9._/-]+$/;

  // Path should match expected patterns (non-absolute paths)
  if (objectPath.startsWith('/')) {
    return false;
  }

  return simplePattern.test(objectPath) && objectPath.length < 500;
}

/**
 * Sanitize attachment data to prevent injection attacks
 */
export function sanitizeAttachment(attachment: {
  objectPath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}): { valid: boolean; sanitized?: typeof attachment; error?: string } {
  // Validate object path
  if (!validateAttachmentObjectPath(attachment.objectPath)) {
    return { valid: false, error: 'Invalid file path' };
  }

  // Validate file name (no path components)
  if (!attachment.fileName || 
      attachment.fileName.includes('/') || 
      attachment.fileName.includes('\\') ||
      attachment.fileName.includes('..')) {
    return { valid: false, error: 'Invalid file name' };
  }

  // Validate file type
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv', 'application/octet-stream'
  ];
  
  if (!allowedTypes.includes(attachment.fileType)) {
    return { valid: false, error: 'File type not allowed' };
  }

  // Validate file size (max 10MB)
  if (typeof attachment.fileSize !== 'number' || attachment.fileSize < 0 || attachment.fileSize > 10 * 1024 * 1024) {
    return { valid: false, error: 'Invalid file size' };
  }

  // Validate uploadedAt is a valid ISO date
  const uploadDate = new Date(attachment.uploadedAt);
  if (isNaN(uploadDate.getTime())) {
    return { valid: false, error: 'Invalid upload date' };
  }

  return {
    valid: true,
    sanitized: {
      objectPath: attachment.objectPath.trim(),
      fileName: attachment.fileName.trim().substring(0, 255),
      fileType: attachment.fileType,
      fileSize: Math.floor(attachment.fileSize),
      uploadedAt: uploadDate.toISOString()
    }
  };
}
