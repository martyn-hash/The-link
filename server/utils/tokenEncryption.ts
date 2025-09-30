import crypto from 'crypto';

// Encryption key from environment (should be 32 bytes for AES-256)
const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;

if (!TOKEN_ENCRYPTION_KEY) {
  if (process.env.NODE_ENV === 'production') {
    console.error('TOKEN_ENCRYPTION_KEY environment variable is not set in production!');
    console.error('Available environment variables:', Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY')).join(', '));
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required in production. Please add it to Account Secrets or Deployment Secrets.');
  }
  console.warn('TOKEN_ENCRYPTION_KEY not set, using development key. This is not secure for production.');
}

// Use a consistent development key for local development
const ENCRYPTION_KEY = TOKEN_ENCRYPTION_KEY || 'dev-key-32-chars-long-for-testing';
const ALGORITHM = 'aes-256-gcm';

// Convert key to buffer - ensure it's exactly 32 bytes for AES-256
const getKeyBuffer = (): Buffer => {
  // If it's a hex string, convert it
  if (ENCRYPTION_KEY.length === 64 && /^[0-9a-f]+$/i.test(ENCRYPTION_KEY)) {
    return Buffer.from(ENCRYPTION_KEY, 'hex');
  }
  // Otherwise, pad/truncate to 32 bytes
  return Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32), 'utf8');
};

export interface EncryptedData {
  encryptedData: string;
  iv: string;
  authTag: string;
}

export function encryptToken(token: string): EncryptedData {
  try {
    const key = getKeyBuffer();
    const iv = crypto.randomBytes(16); // 128-bit IV for GCM
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(Buffer.from('outlook-token', 'utf8')); // Additional authenticated data
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    console.error('Error encrypting token:', error);
    throw new Error('Failed to encrypt token');
  }
}

export function decryptToken(encryptedData: EncryptedData): string {
  try {
    const key = getKeyBuffer();
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(Buffer.from('outlook-token', 'utf8')); // Same AAD as encryption
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error decrypting token:', error);
    throw new Error('Failed to decrypt token');
  }
}

// Helper function to encrypt token for database storage
export function encryptTokenForStorage(token: string): string {
  const encrypted = encryptToken(token);
  return JSON.stringify(encrypted);
}

// Helper function to decrypt token from database storage
export function decryptTokenFromStorage(encryptedString: string): string {
  const encrypted = JSON.parse(encryptedString) as EncryptedData;
  return decryptToken(encrypted);
}