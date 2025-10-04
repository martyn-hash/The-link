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
    
    // Send branded email
    const baseUrl = process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000';
    const logoUrl = `${baseUrl}/attached_assets/full_logo_transparent_600_1759469504917.png`;
    
    await sendEmail({
      to: email,
      from: `The Link <${process.env.FROM_EMAIL || 'link@growth-accountants.com'}>`,
      subject: 'Your Client Portal Login Link - The Link',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, #0A7BBF 0%, #0869A3 100%); padding: 40px 20px; text-align: center; }
            .logo { max-width: 200px; height: auto; margin-bottom: 20px; }
            .content { padding: 40px 30px; }
            .button { display: inline-block; background: linear-gradient(135deg, #0A7BBF 0%, #0869A3 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 30px 0; box-shadow: 0 4px 12px rgba(10, 123, 191, 0.3); }
            .button:hover { background: linear-gradient(135deg, #0869A3 0%, #065580 100%); }
            .footer { background-color: #f1f5f9; padding: 30px; text-align: center; color: #64748b; font-size: 14px; }
            .accent { color: #0A7BBF; font-weight: 600; }
            .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="${logoUrl}" alt="The Link" class="logo" />
              <h1 style="color: white; margin: 0; font-size: 24px;">Client Portal Access</h1>
            </div>
            <div class="content">
              <h2 style="color: #1e293b; margin-top: 0;">Welcome to Your Client Portal</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                You've requested access to your secure client portal. Click the button below to log in instantly:
              </p>
              <div style="text-align: center;">
                <a href="${magicLink}" class="button">Access Portal Now</a>
              </div>
              <div class="warning">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  <strong>⏰ Important:</strong> This secure link will expire in <strong>15 minutes</strong> for your security.
                </p>
              </div>
              <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <span style="word-break: break-all; font-family: monospace; background-color: #f1f5f9; padding: 8px; border-radius: 4px; display: inline-block; margin-top: 8px; font-size: 12px;">${magicLink}</span>
              </p>
            </div>
            <div class="footer">
              <p style="margin: 0 0 10px 0;">
                <strong class="accent">The Link</strong> - Your Financial Partner
              </p>
              <p style="margin: 0; font-size: 13px;">
                If you didn't request this login link, please ignore this email and your account will remain secure.
              </p>
            </div>
          </div>
        </body>
        </html>
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
