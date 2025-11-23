import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage/index";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

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
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

// Valid user roles from schema
const VALID_ROLES = ["admin", "manager", "client_manager", "bookkeeper"] as const;
type ValidRole = typeof VALID_ROLES[number];

// Admin bootstrap emails (for environments without role claims)
// SECURITY: Only enabled in development with explicit opt-in
const ADMIN_EMAILS = process.env.NODE_ENV === 'production' 
  ? (process.env.ADMIN_EMAILS || "").split(",").map(email => email.trim()).filter(Boolean)
  : [
      ...(process.env.ADMIN_EMAILS || "").split(",").map(email => email.trim()).filter(Boolean),
      ...(process.env.ADMIN_BOOTSTRAP_ENABLED === 'true' ? ["admin@bookflow.com"] : [])
    ];

function extractAndValidateRole(claims: any): ValidRole {
  // Only log in development
  if (process.env.NODE_ENV !== 'production') {
    console.log("🔍 [DEBUG] OIDC Claims received:", JSON.stringify(claims, null, 2));
    console.log("🔍 [DEBUG] ADMIN_EMAILS array:", ADMIN_EMAILS);
    console.log("🔍 [DEBUG] ADMIN_BOOTSTRAP_ENABLED:", process.env.ADMIN_BOOTSTRAP_ENABLED);
  }
  
  // Try multiple claim paths for role
  const roleValue = claims["role"] || claims["user_role"] || claims["custom:role"] || claims["https://bookflow.com/role"];
  
  if (process.env.NODE_ENV !== 'production') {
    console.log("🔍 [DEBUG] Extracted raw role:", roleValue);
  }
  
  // Validate against allowed roles
  if (roleValue && VALID_ROLES.includes(roleValue)) {
    if (process.env.NODE_ENV !== 'production') {
      console.log("🔍 [DEBUG] Valid role found:", roleValue);
    }
    return roleValue;
  }
  
  // Check if email is in admin bootstrap list (development only)
  const email = claims["email"];
  if (process.env.NODE_ENV !== 'production') {
    console.log("🔍 [DEBUG] Checking email for admin access:", email);
    console.log("🔍 [DEBUG] Is email in ADMIN_EMAILS?", ADMIN_EMAILS.includes(email));
  }
  
  if (email && ADMIN_EMAILS.includes(email)) {
    if (process.env.NODE_ENV !== 'production') {
      console.log("🔍 [DEBUG] Admin email detected, assigning admin role:", email);
    }
    return "admin";
  }
  
  // Default fallback
  if (process.env.NODE_ENV !== 'production') {
    console.log("🔍 [DEBUG] No valid role found, defaulting to bookkeeper");
  }
  return "bookkeeper";
}

async function upsertUser(
  claims: any,
) {
  const newRole = extractAndValidateRole(claims);
  
  // Check if user already exists and has admin role
  let finalRole = newRole;
  try {
    const existingUser = await storage.getUser(claims["sub"]);
    if (existingUser && existingUser.isAdmin && newRole !== 'admin') {
      // Preserve existing admin status unless explicitly overridden by auth system
      finalRole = 'admin';
      if (process.env.NODE_ENV !== 'production') {
        console.log("🔍 [DEBUG] Preserving existing admin status for user:", existingUser.email);
      }
    }
  } catch (error) {
    // User doesn't exist yet, continue with new role
    if (process.env.NODE_ENV !== 'production') {
      console.log("🔍 [DEBUG] User doesn't exist yet, will create with role:", newRole);
    }
  }
  
  const userData = {
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
    role: finalRole,
  };
  
  // Only log in development
  if (process.env.NODE_ENV !== 'production') {
    console.log("🔍 [DEBUG] User data to upsert:", JSON.stringify(userData, null, 2));
  }
  
  try {
    await storage.upsertUser(userData);
    if (process.env.NODE_ENV !== 'production') {
      console.log("🔍 [DEBUG] User upsert successful");
    }
  } catch (error) {
    console.error("🚨 [ERROR] User upsert failed:", error);
    throw error;
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
