import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { storage } from './storage';

const JWT_SECRET = process.env.JWT_SECRET || 'portal-jwt-secret-change-in-production';
const MAGIC_LINK_EXPIRY = 15 * 60 * 1000; // 15 minutes
const JWT_EXPIRY = '7d'; // 7 days

interface PortalUser {
  id: string;
  clientId: string;
  email: string;
  name: string;
}

interface PortalJWTPayload {
  userId: string;
  clientId: string;
  email: string;
  type: 'portal';
}

export function generateMagicToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function createJWT(portalUser: PortalUser): string {
  const payload: PortalJWTPayload = {
    userId: portalUser.id,
    clientId: portalUser.clientId,
    email: portalUser.email,
    type: 'portal'
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyJWT(token: string): PortalJWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as PortalJWTPayload;
    if (decoded.type !== 'portal') {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
}

export interface AuthenticatedPortalRequest extends Request {
  portalUser?: {
    id: string;
    clientId: string;
    email: string;
  };
}

export async function authenticatePortal(
  req: AuthenticatedPortalRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    if (!token) {
      return res.status(401).json({ message: 'No authentication token provided' });
    }
    
    const payload = verifyJWT(token);
    if (!payload) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    
    // Verify the portal user still exists
    const portalUser = await storage.getClientPortalUserById(payload.userId);
    if (!portalUser) {
      return res.status(401).json({ message: 'Portal user not found' });
    }
    
    // Verify client match for extra security
    if (portalUser.clientId !== payload.clientId) {
      return res.status(401).json({ message: 'Invalid client association' });
    }
    
    req.portalUser = {
      id: portalUser.id,
      clientId: portalUser.clientId,
      email: portalUser.email
    };
    
    next();
  } catch (error) {
    console.error('Portal authentication error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  }
}

export async function sendMagicLink(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Find existing portal user - do NOT create new users
    const portalUser = await storage.getClientPortalUserByEmail(email);
    
    if (!portalUser) {
      // Security: Do not reveal whether email exists or not
      return { success: true }; // Return success but don't send email
    }
    
    // Generate magic token and store in database
    const magicToken = generateMagicToken();
    const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY);
    
    await storage.createClientPortalSession({
      clientPortalUserId: portalUser.id,
      token: magicToken,
      expiresAt
    });
    
    // Import SendGrid email service
    const { sendEmail } = await import('./emailService');
    
    // Generate magic link URL
    const magicLink = `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/portal/verify?token=${magicToken}`;
    
    // Send email
    await sendEmail({
      to: email,
      subject: 'Your Portal Login Link',
      html: `
        <h2>Welcome to the Client Portal</h2>
        <p>Click the link below to log in to your client portal:</p>
        <p><a href="${magicLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Log In to Portal</a></p>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't request this login link, please ignore this email.</p>
      `
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error sending magic link:', error);
    return { success: false, error: 'Failed to send magic link' };
  }
}

export async function verifyMagicLink(token: string): Promise<{ success: boolean; jwt?: string; error?: string }> {
  try {
    console.log('[Portal Auth] Verifying magic link, token:', token.substring(0, 10) + '...');
    
    // Try to find session by token (email magic link flow)
    const session = await storage.getClientPortalSessionByToken(token);
    
    if (session) {
      console.log('[Portal Auth] Found session for token');
      // Check if expired
      if (new Date() > new Date(session.expiresAt)) {
        await storage.deleteClientPortalSession(session.id);
        return { success: false, error: 'Link has expired' };
      }
      
      // Get portal user
      const portalUser = await storage.getClientPortalUserById(session.clientPortalUserId);
      if (!portalUser) {
        return { success: false, error: 'Portal user not found' };
      }
      
      // Update last login
      await storage.updateClientPortalUser(portalUser.id, {
        lastLogin: new Date()
      });
      
      // Delete the used session token
      await storage.deleteClientPortalSession(session.id);
      
      // Create JWT for ongoing authentication
      const jwtToken = createJWT({
        id: portalUser.id,
        clientId: portalUser.clientId,
        email: portalUser.email,
        name: portalUser.name || 'Portal User'
      });
      
      return { success: true, jwt: jwtToken };
    }
    
    // If no session found, try to find portal user by magicLinkToken (QR code/invitation flow)
    const portalUser = await storage.getClientPortalUserByMagicLinkToken(token);
    
    if (!portalUser) {
      return { success: false, error: 'Invalid or expired link' };
    }
    
    // Check if token expired
    if (portalUser.tokenExpiry && new Date() > new Date(portalUser.tokenExpiry)) {
      return { success: false, error: 'Link has expired' };
    }
    
    // Allow token reuse until expiry - makes endpoint fully idempotent
    // Update last login each time for tracking, but don't fail on duplicates
    await storage.updateClientPortalUser(portalUser.id, {
      lastLogin: new Date()
    });
    // Note: Token remains valid until tokenExpiry (24 hours) to allow idempotent requests
    
    // Create JWT for ongoing authentication (works for both first use and duplicate requests)
    const jwtToken = createJWT({
      id: portalUser.id,
      clientId: portalUser.clientId,
      email: portalUser.email,
      name: portalUser.name || 'Portal User'
    });
    
    return { success: true, jwt: jwtToken };
  } catch (error) {
    console.error('Error verifying magic link:', error);
    return { success: false, error: 'Verification failed' };
  }
}
