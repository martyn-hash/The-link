import bcrypt from "bcrypt";
import crypto from "crypto";
import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler, Request, Response, NextFunction } from "express";
import { storage } from "./storage/index";
import { sendMagicLinkEmail } from "./emailService";
import type { User } from "@shared/schema";
import { extractSessionMetadata } from "./utils/session-tracker";
import { pool } from "./db";

// Extend express-session to include our custom session properties
declare module "express-session" {
  interface SessionData {
    userId?: string;
    userEmail?: string | null;
    isAdmin?: boolean;
    canSeeAdminMenu?: boolean;
  }
}

// Type for authenticated middleware - compatible with Express RequestHandler
type AuthMiddleware = RequestHandler;

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool: pool,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  console.log('[Session Store] Using shared database pool for session management');
  
  return session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string | null;
    isAdmin: boolean;
    canSeeAdminMenu: boolean;
    effectiveUser?: User;
    effectiveUserId?: string;
    effectiveIsAdmin?: boolean;
    isImpersonating?: boolean;
  };
  session: any;
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  try {
    const user = await storage.getUserByEmail(email);
    if (!user || !user.passwordHash) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("Authentication error:", error);
    return null;
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Login route
  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const metadata = extractSessionMetadata(req);

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await authenticateUser(email, password);
      
      // Log login attempt (successful or failed)
      await storage.createLoginAttempt({
        email: email.trim().toLowerCase(),
        ipAddress: metadata.ipAddress,
        success: !!user,
        failureReason: user ? null : "invalid_credentials",
        browser: metadata.browser,
        os: metadata.os,
      });

      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Check if maintenance mode is active and user is not a super admin
      const companySettings = await storage.getCompanySettings();
      if (companySettings?.maintenanceMode && !user.superAdmin) {
        return res.status(503).json({ 
          message: "System is currently in maintenance mode",
          maintenanceMode: true,
          maintenanceMessage: companySettings.maintenanceMessage || "The system is currently undergoing maintenance. Please try again later."
        });
      }

      // Update last login timestamp
      await storage.updateUser(user.id, { lastLoginAt: new Date() } as any);

      // Create session record
      await storage.createUserSession({
        userId: user.id,
        ipAddress: metadata.ipAddress,
        city: metadata.city,
        country: metadata.country,
        browser: metadata.browser,
        device: metadata.device,
        os: metadata.os,
        platformType: metadata.platformType,
        pushEnabled: user.pushNotificationsEnabled || false,
      });

      // Set user session
      req.session.userId = user.id;
      req.session.userEmail = user.email;
      req.session.isAdmin = user.isAdmin || false;
      req.session.canSeeAdminMenu = user.canSeeAdminMenu || false;

      // Remove password hash from response
      const { passwordHash, ...userResponse } = user;
      res.json({ message: "Login successful", user: userResponse });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout routes (both GET and POST for flexibility)
  const logoutHandler = (req: any, res: any) => {
    req.session.destroy((err: any) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie('connect.sid');
      
      // For GET requests, redirect to login page. For POST requests, return JSON.
      if (req.method === 'GET') {
        res.redirect('/');
      } else {
        res.json({ message: "Logout successful" });
      }
    });
  };

  app.post("/api/logout", logoutHandler);
  app.get("/api/auth/logout", logoutHandler);

  // Basic rate limiting for magic link requests (in-memory store)
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  const REQUEST_LIMIT = 5; // Max 5 requests per email per hour
  const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

  // Helper function to check rate limit
  const checkRateLimit = (email: string): boolean => {
    const now = Date.now();
    const key = email.toLowerCase();
    const existing = requestCounts.get(key);
    
    if (!existing || now > existing.resetTime) {
      // First request or window expired
      requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      return true;
    }
    
    if (existing.count >= REQUEST_LIMIT) {
      return false; // Rate limited
    }
    
    // Increment count
    existing.count += 1;
    return true;
  };

  // Magic link request route
  app.post("/api/magic-link/request", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check rate limiting
      if (!checkRateLimit(normalizedEmail)) {
        // Always return 200 to prevent enumeration, but don't process the request
        return res.json({ 
          message: "Magic link request created successfully",
          expiresIn: "10 minutes"
        });
      }

      // Clean up expired tokens first
      await storage.cleanupExpiredMagicLinkTokens();

      // Check if user exists (but don't reveal this in response)
      const user = await storage.getUserByEmail(normalizedEmail);
      
      if (user) {
        // Check for existing valid tokens for this user
        const existingTokens = await storage.getValidMagicLinkTokensForUser(user.id);
        if (existingTokens.length === 0) {
          // Generate cryptographically secure 4-digit code (0000-9999)
          const code = crypto.randomInt(0, 10000).toString().padStart(4, '0');
          
          // Generate secure random token
          const token = crypto.randomBytes(32).toString('hex');

          // Hash the token and code before storing
          const saltRounds = 12;
          const tokenHash = await bcrypt.hash(token, saltRounds);
          const codeHash = await bcrypt.hash(code, saltRounds);

          // Create magic link token in database with hashed values
          await storage.createMagicLinkToken({
            userId: user.id,
            tokenHash,
            codeHash,
            email: normalizedEmail,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          });

          // Send magic link email with plain token and code values
          try {
            const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
            const host = req.get('host') || 'localhost:5000';
            const baseUrl = `${protocol}://${host}`;
            
            const recipientName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || normalizedEmail;
            
            await sendMagicLinkEmail(
              normalizedEmail,
              recipientName,
              token, // plain token for email link
              code,  // plain code for email display
              baseUrl
            );
            
            console.log(`Magic link email sent to ${normalizedEmail}`);
          } catch (emailError) {
            // Don't fail the entire request if email fails
            // This prevents attackers from using email failures to enumerate users
            console.error('Failed to send magic link email:', emailError);
          }
        }
      }
      
      // Always return success response to prevent user enumeration
      res.json({ 
        message: "Magic link request created successfully",
        expiresIn: "10 minutes"
      });
    } catch (error) {
      console.error("Magic link request error:", error);
      res.status(500).json({ message: "Failed to create magic link request" });
    }
  });

  // Basic rate limiting for magic link verification (in-memory store)
  const verifyCounts = new Map<string, { count: number; resetTime: number }>();
  const VERIFY_LIMIT = 15; // Max 15 verification attempts per hour (higher than request since brute force is harder)
  const VERIFY_RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

  // Helper function to check verification rate limit
  const checkVerifyRateLimit = (key: string): boolean => {
    const now = Date.now();
    const existing = verifyCounts.get(key);
    
    if (!existing || now > existing.resetTime) {
      // First attempt or window expired
      verifyCounts.set(key, { count: 1, resetTime: now + VERIFY_RATE_LIMIT_WINDOW });
      return true;
    }
    
    if (existing.count >= VERIFY_LIMIT) {
      return false; // Rate limited
    }
    
    // Increment count
    existing.count += 1;
    return true;
  };

  // Magic link verify route
  app.post("/api/magic-link/verify", async (req, res) => {
    try {
      const { token, code, email } = req.body;
      const metadata = extractSessionMetadata(req);
      const attemptEmail = email ? email.trim().toLowerCase() : '';

      // Rate limiting to prevent brute force attacks
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      let rateLimitKey: string;
      
      if (token) {
        rateLimitKey = `verify_${clientIP}_token_${token.substring(0, 8)}`;
      } else if (code && email) {
        rateLimitKey = `verify_${clientIP}_code_${email.toLowerCase()}`;
      } else {
        return res.status(400).json({ message: "Either token or both code and email are required" });
      }

      // Check rate limiting
      if (!checkVerifyRateLimit(rateLimitKey)) {
        return res.status(429).json({ 
          message: "Too many verification attempts. Please try again later.",
          retryAfter: "1 hour"
        });
      }

      let magicLinkToken;

      if (token) {
        // Verify using token
        magicLinkToken = await storage.getMagicLinkTokenByToken(token);
        if (!magicLinkToken) {
          // Log failed login attempt
          if (attemptEmail) {
            await storage.createLoginAttempt({
              email: attemptEmail,
              ipAddress: metadata.ipAddress,
              success: false,
              failureReason: "invalid_magic_link_token",
              browser: metadata.browser,
              os: metadata.os,
            });
          }
          return res.status(401).json({ message: "Invalid or expired magic link" });
        }
      } else if (code && email) {
        // Verify using code and email
        magicLinkToken = await storage.getMagicLinkTokenByCodeAndEmail(code, email.trim().toLowerCase());
        if (!magicLinkToken) {
          // Log failed login attempt
          await storage.createLoginAttempt({
            email: attemptEmail,
            ipAddress: metadata.ipAddress,
            success: false,
            failureReason: "invalid_magic_link_code",
            browser: metadata.browser,
            os: metadata.os,
          });
          return res.status(401).json({ message: "Invalid or expired verification code" });
        }
      }

      // Ensure we have a valid magic link token
      if (!magicLinkToken) {
        if (attemptEmail) {
          await storage.createLoginAttempt({
            email: attemptEmail,
            ipAddress: metadata.ipAddress,
            success: false,
            failureReason: "missing_magic_link_token",
            browser: metadata.browser,
            os: metadata.os,
          });
        }
        return res.status(401).json({ message: "Invalid or expired magic link" });
      }

      // Get user from database
      const user = await storage.getUser(magicLinkToken.userId);
      if (!user) {
        await storage.createLoginAttempt({
          email: magicLinkToken.email,
          ipAddress: metadata.ipAddress,
          success: false,
          failureReason: "user_not_found",
          browser: metadata.browser,
          os: metadata.os,
        });
        return res.status(404).json({ message: "User not found" });
      }

      // Check if maintenance mode is active and user is not a super admin
      const companySettings = await storage.getCompanySettings();
      if (companySettings?.maintenanceMode && !user.superAdmin) {
        return res.status(503).json({ 
          message: "System is currently in maintenance mode",
          maintenanceMode: true,
          maintenanceMessage: companySettings.maintenanceMessage || "The system is currently undergoing maintenance. Please try again later."
        });
      }

      // Update last login timestamp
      await storage.updateUser(user.id, { lastLoginAt: new Date() } as any);

      // Mark token as used (atomic operation that will fail if already used)
      try {
        await storage.markMagicLinkTokenAsUsed(magicLinkToken.id);
      } catch (error) {
        // Token was already used or doesn't exist
        await storage.createLoginAttempt({
          email: user.email || magicLinkToken.email,
          ipAddress: metadata.ipAddress,
          success: false,
          failureReason: "magic_link_already_used",
          browser: metadata.browser,
          os: metadata.os,
        });
        return res.status(401).json({ message: "Magic link has already been used or is invalid" });
      }

      // Log successful login attempt
      await storage.createLoginAttempt({
        email: user.email || magicLinkToken.email,
        ipAddress: metadata.ipAddress,
        success: true,
        failureReason: null,
        browser: metadata.browser,
        os: metadata.os,
      });

      // Create session record
      await storage.createUserSession({
        userId: user.id,
        ipAddress: metadata.ipAddress,
        city: metadata.city,
        country: metadata.country,
        browser: metadata.browser,
        device: metadata.device,
        os: metadata.os,
        platformType: metadata.platformType,
        pushEnabled: user.pushNotificationsEnabled || false,
      });

      // Set user session (same as login route)
      req.session.userId = user.id;
      req.session.userEmail = user.email;
      req.session.isAdmin = user.isAdmin || false;
      req.session.canSeeAdminMenu = user.canSeeAdminMenu || false;

      // Remove password hash from response
      const { passwordHash, ...userResponse } = user;
      res.json({ 
        message: "Magic link authentication successful", 
        user: userResponse 
      });
    } catch (error) {
      console.error("Magic link verify error:", error);
      res.status(500).json({ message: "Magic link verification failed" });
    }
  });

  // Check if user should be prompted to set up password
  app.get("/api/auth/should-setup-password", async (req, res) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // User should set up password if:
      // 1. They don't have a password set (!passwordHash)
      // OR
      // 2. This is their first login (lastLoginAt is null) and they logged in via magic link
      const shouldSetupPassword = !user.passwordHash;
      const isFirstLogin = !user.lastLoginAt;

      res.json({
        shouldSetupPassword,
        isFirstLogin,
        hasPassword: !!user.passwordHash
      });
    } catch (error) {
      console.error("Error checking password setup status:", error);
      res.status(500).json({ message: "Failed to check password setup status" });
    }
  });
}

export const isAuthenticated: AuthMiddleware = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Get user from database
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    // Set user context (cast req to AuthenticatedRequest)
    (req as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin || false,
      canSeeAdminMenu: user.canSeeAdminMenu || false,
    };

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
};