import bcrypt from "bcrypt";
import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";

// Extend express-session to include our custom session properties
declare module "express-session" {
  interface SessionData {
    userId?: string;
    userEmail?: string | null;
    userRole?: string;
  }
}

// Type for authenticated middleware - compatible with Express RequestHandler
type AuthMiddleware = RequestHandler;

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
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
    role: string;
    effectiveUser?: User;
    effectiveUserId?: string;
    effectiveRole?: string;
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

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await authenticateUser(email, password);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Set user session
      req.session.userId = user.id;
      req.session.userEmail = user.email;
      req.session.userRole = user.role;

      // Remove password hash from response
      const { passwordHash, ...userResponse } = user;
      res.json({ message: "Login successful", user: userResponse });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout route
  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logout successful" });
    });
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
      role: user.role as string, // Convert enum to string
    };

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
};