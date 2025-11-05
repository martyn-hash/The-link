import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { storage } from './storage';

const JWT_SECRET = process.env.JWT_SECRET || 'portal-jwt-secret-change-in-production';
const MAGIC_LINK_EXPIRY = 15 * 60 * 1000; // 15 minutes
const VERIFICATION_CODE_EXPIRY = 10 * 60 * 1000; // 10 minutes
const JWT_EXPIRY = '180d'; // 6 months (180 days)

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

export function generateVerificationCode(): string {
  // Generate a random 6-digit code
  return Math.floor(100000 + Math.random() * 900000).toString();
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
    // Try to get token from Authorization header first
    const authHeader = req.headers.authorization;
    let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    // If no header token, try query parameter (for image/audio src attributes)
    if (!token && req.query.token) {
      token = req.query.token as string;
    }

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

    // Use the clientId from the JWT payload (supports company switching)
    // The clientId in the database is the default/primary company, but users
    // can switch to other companies they're connected to via JWT claims
    req.portalUser = {
      id: portalUser.id,
      clientId: payload.clientId, // Use JWT's clientId, not database's
      email: portalUser.email,
      relatedPersonId: portalUser.personId || null
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
    const baseUrl = 'https://flow.growth.accountants';
    const magicLink = `${baseUrl}/portal/verify?token=${magicToken}`;
    
    // Send branded email
    const logoUrl = `${baseUrl}/attached_assets/full_logo_transparent_600_1761924125378.png`;
    
    await sendEmail({
      to: email,
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
                <strong class="accent">The Link by Growth Accountants</strong>
              </p>
              <p style="margin: 0 0 10px 0; font-size: 13px; color: #64748b;">
                Your workflow management partner
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

export async function sendVerificationCode(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Find existing portal user - do NOT create new users
    const portalUser = await storage.getClientPortalUserByEmail(email);
    
    if (!portalUser) {
      // Security: Do not reveal whether email exists or not
      return { success: true }; // Return success but don't send email
    }
    
    // Generate 6-digit verification code
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY);
    
    // Log code in development for testing
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Portal Auth] Verification code for ${email}: ${verificationCode}`);
    }
    
    // Update portal user with verification code
    await storage.updateClientPortalUser(portalUser.id, {
      verificationCode,
      codeExpiry: expiresAt
    });
    
    // Import SendGrid email service
    const { sendEmail } = await import('./emailService');
    
    // Send branded email with verification code
    const baseUrl = 'https://flow.growth.accountants';
    const logoUrl = `${baseUrl}/attached_assets/full_logo_transparent_600_1761924125378.png`;
    
    await sendEmail({
      to: email,
      subject: 'Your Portal Login Code - The Link',
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
            .code-box { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #0A7BBF; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
            .code { font-size: 48px; font-weight: bold; color: #0A7BBF; letter-spacing: 8px; font-family: 'Courier New', monospace; }
            .footer { background-color: #f1f5f9; padding: 30px; text-align: center; color: #64748b; font-size: 14px; }
            .accent { color: #0A7BBF; font-weight: 600; }
            .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="${logoUrl}" alt="The Link" class="logo" />
              <h1 style="color: white; margin: 0; font-size: 24px;">Client Portal Login</h1>
            </div>
            <div class="content">
              <h2 style="color: #1e293b; margin-top: 0;">Your Login Code</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                Use this code to access your secure client portal:
              </p>
              <div class="code-box">
                <div class="code">${verificationCode}</div>
              </div>
              <div class="warning">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  <strong>⏰ Important:</strong> This code will expire in <strong>10 minutes</strong> for your security.
                </p>
              </div>
              <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                Enter this code in your portal login page to access your account.
              </p>
            </div>
            <div class="footer">
              <p style="margin: 0 0 10px 0;">
                <strong class="accent">The Link by Growth Accountants</strong>
              </p>
              <p style="margin: 0 0 10px 0; font-size: 13px; color: #64748b;">
                Your workflow management partner
              </p>
              <p style="margin: 0; font-size: 13px;">
                If you didn't request this code, please ignore this email and your account will remain secure.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error sending verification code:', error);
    return { success: false, error: 'Failed to send verification code' };
  }
}

export async function verifyCode(email: string, code: string): Promise<{ success: boolean; jwt?: string; error?: string }> {
  try {
    // Find portal user by email
    const portalUser = await storage.getClientPortalUserByEmail(email);
    
    if (!portalUser) {
      return { success: false, error: 'Invalid email or code' };
    }
    
    // Check if code matches
    if (portalUser.verificationCode !== code) {
      return { success: false, error: 'Invalid email or code' };
    }
    
    // Check if code expired
    if (!portalUser.codeExpiry || new Date() > new Date(portalUser.codeExpiry)) {
      return { success: false, error: 'Code has expired. Please request a new code.' };
    }
    
    // Clear the verification code (one-time use)
    await storage.updateClientPortalUser(portalUser.id, {
      verificationCode: null,
      codeExpiry: null,
      lastLogin: new Date()
    });
    
    // Create JWT for ongoing authentication
    const jwtToken = createJWT({
      id: portalUser.id,
      clientId: portalUser.clientId,
      email: portalUser.email,
      name: portalUser.name || 'Portal User'
    });
    
    return { success: true, jwt: jwtToken };
  } catch (error) {
    console.error('Error verifying code:', error);
    return { success: false, error: 'Verification failed' };
  }
}
