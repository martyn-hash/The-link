import crypto from 'crypto';

// Encryption key from environment (should be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

// Convert hex key to buffer if it's a string
const getKeyBuffer = (): Buffer => {
  if (typeof ENCRYPTION_KEY === 'string') {
    return Buffer.from(ENCRYPTION_KEY, 'hex');
  }
  return ENCRYPTION_KEY;
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
    
    const cipher = crypto.createCipher(ALGORITHM, key);
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
    
    const decipher = crypto.createDecipher(ALGORITHM, key);
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