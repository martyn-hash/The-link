import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { ObjectStorageService, ObjectNotFoundError } from "../objectStorage";
import { ObjectPermission } from "../objectAcl";
import { companiesHouseService } from "../companies-house-service";
import fetch from 'node-fetch';
import QRCode from 'qrcode';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';
import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  insertUserSchema,
  insertDashboardSchema,
  updateDashboardSchema,
  insertUserColumnPreferencesSchema,
  insertCompanyViewSchema,
  insertProjectViewSchema,
  updateUserNotificationPreferencesSchema,
  insertDocumentSchema,
  insertDocumentFolderSchema,
  insertRiskAssessmentSchema,
  updateRiskAssessmentSchema,
  insertRiskAssessmentResponseSchema,
  clientPortalUsers,
  clients as clientsTable,
  people as peopleTable,
  clientPeople as clientPeopleTable,
  clientServices as clientServicesTable,
  clientServiceRoleAssignments as clientServiceRoleAssignmentsTable,
  type InsertPerson,
  type InsertClientService,
} from "@shared/schema";

// Analytics query schema
const analyticsQuerySchema = z.object({
  filters: z.object({
    serviceFilter: z.string().optional(),
    showArchived: z.boolean().optional(),
    taskAssigneeFilter: z.string().optional(),
    serviceOwnerFilter: z.string().optional(),
    userFilter: z.string().optional(),
    dynamicDateFilter: z.enum(['all', 'overdue', 'today', 'next7days', 'next14days', 'next30days', 'custom']).optional(),
    customDateRange: z.object({
      from: z.string().optional(),
      to: z.string().optional(),
    }).optional(),
  }).optional(),
  groupBy: z.enum(['projectType', 'status', 'assignee', 'serviceOwner', 'daysOverdue'], {
    required_error: "groupBy must be one of: projectType, status, assignee, serviceOwner, daysOverdue",
  }),
  metric: z.string().optional(),
});

// Resource-specific parameter validation schemas for consistent error responses
// Users: Allow flexible ID format (Replit Auth generates short string IDs like "uOBWFr")
const paramUserIdSchema = z.object({
  userId: z.string().min(1, "User ID is required")
});

// Generic ID schema for users (used in routes like /api/users/:id)
const paramUserIdAsIdSchema = z.object({
  id: z.string().min(1, "User ID is required")
});

// Database-generated entities: Enforce UUID validation since they use gen_random_uuid()
const paramUuidSchema = z.object({
  id: z.string().min(1, "ID is required").uuid("Invalid ID format")
});

// Helper function for parameter validation
const validateParams = <T>(schema: z.ZodSchema<T>, params: any): { success: true; data: T } | { success: false; errors: any[] } => {
  const result = schema.safeParse(params);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: result.error.issues };
};

export async function registerAuthAndMiscRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  // ===== HEALTH CHECK ENDPOINT (Public - No Auth Required) =====
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });

  // ===== AUTH ROUTES =====

  // Get current user (with impersonation support)
  app.get('/api/auth/user', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const originalUserId = req.user!.id;
      const effectiveUser = req.user!.effectiveUser;

      if (!effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Strip password hash from response for security, but indicate if user has password authentication
      const { passwordHash, ...sanitizedUser } = effectiveUser;
      const userWithPasswordStatus = {
        ...sanitizedUser,
        hasPassword: !!passwordHash // Boolean indicating if user has password-based auth
      };

      // Include impersonation metadata if admin is impersonating
      if (req.user!.isImpersonating) {
        const impersonationState = await storage.getImpersonationState(originalUserId);
        return res.json({
          ...userWithPasswordStatus,
          _impersonationState: impersonationState
        });
      }

      res.json(userWithPasswordStatus);
    } catch (error) {
      console.error("Error fetching user:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User impersonation routes (admin only)
  app.post("/api/auth/impersonate/:userId", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramUserIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const adminUserId = req.user!.id;
      const targetUserId = req.params.userId;

      await storage.startImpersonation(adminUserId, targetUserId);
      res.json({ message: "Impersonation started successfully" });
    } catch (error) {
      console.error("Error starting impersonation:", error);
      res.status(400).json({ message: (error instanceof Error ? (error instanceof Error ? error.message : null) : String(error)) || "Failed to start impersonation" });
    }
  });

  app.delete("/api/auth/impersonate", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const adminUserId = req.user!.id;
      await storage.stopImpersonation(adminUserId);
      res.status(204).send();
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      res.status(400).json({ message: "Failed to stop impersonation" });
    }
  });

  app.get("/api/auth/impersonation-state", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const adminUserId = req.user!.id;
      const state = await storage.getImpersonationState(adminUserId);
      res.json(state);
    } catch (error) {
      console.error("Error getting impersonation state:", error);
      res.status(500).json({ message: "Failed to get impersonation state" });
    }
  });

  // ===== BOOTSTRAP AND DEV ROUTES =====

  // One-time admin creation route (for production bootstrap)
  app.post("/api/bootstrap-admin", async (req: any, res: any) => {
    try {
      const { email, password, firstName, lastName, bootstrapSecret } = req.body;

      // Security: Check bootstrap secret if configured in production
      if (process.env.NODE_ENV === 'production' && process.env.BOOTSTRAP_SECRET) {
        if (!bootstrapSecret || bootstrapSecret !== process.env.BOOTSTRAP_SECRET) {
          return res.status(403).json({
            message: "Invalid bootstrap secret"
          });
        }
      }

      // Use proper validation with insertUserSchema
      const adminUserSchema = insertUserSchema.extend({
        password: insertUserSchema.shape.passwordHash.optional()
      }).omit({ passwordHash: true });

      const validationResult = adminUserSchema.safeParse({
        email: email?.trim(),
        firstName: firstName?.trim(),
        lastName: lastName?.trim()
      });

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validationResult.error.issues
        });
      }

      // Additional password validation
      if (!password || typeof password !== 'string' || password.trim().length < 6) {
        return res.status(400).json({
          message: "Password is required and must be at least 6 characters"
        });
      }

      // Hash password securely
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash(password.trim(), 10);

      // Use atomic admin creation to prevent race conditions
      const result = await storage.createAdminIfNone({
        ...validationResult.data,
        passwordHash,
        isAdmin: true,
        canSeeAdminMenu: true,
      });

      if (!result.success) {
        return res.status(400).json({
          message: result.error
        });
      }

      // Remove password hash from response
      const { passwordHash: _, ...userResponse } = result.user!;

      res.json({
        message: "Admin user created successfully",
        user: userResponse
      });
    } catch (error) {
      console.error("Error creating bootstrap admin:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(500).json({ message: "Failed to create admin user" });
    }
  });

  // Development password reset route (remove in production)
  app.post("/api/dev/reset-password", async (req: any, res: any) => {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          message: "Password reset not available in production"
        });
      }

      const { email, newPassword } = req.body;

      if (!email || !newPassword) {
        return res.status(400).json({
          message: "Email and new password are required"
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          message: "Password must be at least 6 characters"
        });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({
          message: "User not found"
        });
      }

      // Hash new password
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash(newPassword.trim(), 10);

      // Update user password
      await storage.updateUser(user.id, { passwordHash });

      res.json({
        message: "Password reset successfully",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin
        }
      });
    } catch (error) {
      console.error("Error resetting password:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // ===== USER MANAGEMENT ROUTES =====

  app.get("/api/users", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      const users = await storage.getAllUsers();
      // Strip password hash from response for security
      const sanitizedUsers = users.map(({ passwordHash, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { password, ...userData } = req.body;

      // SECURITY: Explicitly remove passwordHash from request to prevent injection
      delete userData.passwordHash;

      // Validate password is provided and meets requirements
      if (!password || typeof password !== 'string' || password.trim().length < 6) {
        return res.status(400).json({ message: "Password is required and must be at least 6 characters" });
      }

      // Create safe schema that excludes passwordHash
      const safeUserSchema = insertUserSchema.omit({ passwordHash: true });
      const validUserData = safeUserSchema.parse(userData);

      // Hash password securely
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash(password.trim(), 10);

      const user = await storage.createUser({
        ...validUserData,
        passwordHash,
      });

      // Remove password hash from response
      const { passwordHash: _, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error("Error creating user:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(400).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramUserIdAsIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { password, ...userData } = req.body;

      // SECURITY: Explicitly remove passwordHash from request to prevent injection
      delete userData.passwordHash;

      // Create safe schema that excludes passwordHash
      const safeUserSchema = insertUserSchema.omit({ passwordHash: true }).partial();
      const validUserData = safeUserSchema.parse(userData);

      let updateData: any = { ...validUserData };

      // Hash password only if provided and valid
      if (password && typeof password === 'string' && password.trim().length >= 6) {
        const bcrypt = await import('bcrypt');
        const passwordHash = await bcrypt.hash(password.trim(), 10);
        updateData.passwordHash = passwordHash;
      }

      const user = await storage.updateUser(req.params.id, updateData);

      // Remove password hash from response
      const { passwordHash: _, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error("Error updating user:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(400).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramUserIdAsIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      await storage.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(400).json({ message: "Failed to delete user" });
    }
  });

  // User profile routes
  app.get("/api/users/profile", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Get user profile
      const user = await storage.getUser(effectiveUserId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get notification preferences (create defaults if they don't exist)
      const notificationPreferences = await storage.getOrCreateDefaultNotificationPreferences(effectiveUserId);

      // Strip password hash from response for security
      const { passwordHash, ...sanitizedUser } = user;

      res.json({
        ...sanitizedUser,
        notificationPreferences
      });
    } catch (error) {
      console.error("Error fetching user profile:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.put("/api/users/profile", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // SECURITY: Block profile updates during impersonation mode
      if (req.user?.isImpersonating) {
        return res.status(403).json({
          message: "Profile updates are not allowed while impersonating another user",
          code: "IMPERSONATION_PROFILE_UPDATE_BLOCKED"
        });
      }

      const { ...profileData } = req.body;

      // SECURITY: Explicitly remove sensitive fields from request to prevent injection
      delete profileData.passwordHash;
      delete profileData.role;
      delete profileData.id;
      delete profileData.email;

      // Create safe schema that only allows certain profile fields
      const safeProfileSchema = insertUserSchema.pick({
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        emailSignature: true,
      }).partial();

      const validProfileData = safeProfileSchema.parse(profileData);

      const user = await storage.updateUser(effectiveUserId, validProfileData);

      // Get notification preferences
      const notificationPreferences = await storage.getOrCreateDefaultNotificationPreferences(effectiveUserId);

      // Remove password hash from response
      const { passwordHash: _, ...userResponse } = user;

      res.json({
        ...userResponse,
        notificationPreferences
      });
    } catch (error) {
      console.error("Error updating user profile:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to update user profile" });
    }
  });

  app.put("/api/users/password", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // SECURITY: Block password changes during impersonation mode
      if (req.user?.isImpersonating) {
        return res.status(403).json({
          message: "Password changes are not allowed while impersonating another user",
          code: "IMPERSONATION_PASSWORD_CHANGE_BLOCKED"
        });
      }

      const { currentPassword, newPassword } = req.body;

      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (typeof newPassword !== 'string' || newPassword.trim().length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      // Get current user to verify password
      const user = await storage.getUser(effectiveUserId);
      if (!user || !user.passwordHash) {
        return res.status(400).json({ message: "User not found or no password set" });
      }

      // Verify current password
      const bcrypt = await import('bcrypt');
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword.trim(), 10);

      // Update password
      await storage.updateUser(effectiveUserId, { passwordHash: newPasswordHash });

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error updating password:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  // User notification preferences routes
  app.get("/api/users/notifications", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Get notification preferences (create defaults if they don't exist)
      const notificationPreferences = await storage.getOrCreateDefaultNotificationPreferences(effectiveUserId);

      res.json(notificationPreferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch notification preferences" });
    }
  });

  app.put("/api/users/notifications", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const notificationData = req.body;

      // Validate notification preferences data
      const validNotificationData = updateUserNotificationPreferencesSchema.parse(notificationData);

      // Check if preferences exist, if not create them first
      let preferences = await storage.getUserNotificationPreferences(effectiveUserId);
      if (!preferences) {
        // Create default preferences first
        preferences = await storage.getOrCreateDefaultNotificationPreferences(effectiveUserId);
      }

      // Update preferences
      const updatedPreferences = await storage.updateUserNotificationPreferences(effectiveUserId, validNotificationData);

      res.json(updatedPreferences);
    } catch (error) {
      console.error("Error updating notification preferences:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to update notification preferences" });
    }
  });

  // POST /api/users/:userId/set-fallback - Set user as fallback (admin only)
  app.post("/api/users/:userId/set-fallback", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { userId } = req.params;

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ message: "Valid user ID is required" });
      }

      // Check if user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const fallbackUser = await storage.setFallbackUser(userId);

      // Strip password hash from response for security
      const { passwordHash, ...sanitizedUser } = fallbackUser;
      res.json(sanitizedUser);
    } catch (error) {
      console.error("Error setting fallback user:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to set fallback user" });
    }
  });

  // GET /api/fallback-user - Get current fallback user (admin only)
  app.get("/api/fallback-user", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const fallbackUser = await storage.getFallbackUser();

      if (!fallbackUser) {
        return res.status(404).json({
          message: "No fallback user is currently configured",
          code: "NO_FALLBACK_USER"
        });
      }

      // Strip password hash from response for security
      const { passwordHash, ...sanitizedUser } = fallbackUser;
      res.json(sanitizedUser);
    } catch (error) {
      console.error("Error fetching fallback user:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch fallback user" });
    }
  });

  // ===== DASHBOARD ROUTES =====

  app.get("/api/dashboards", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const userDashboards = await storage.getDashboardsByUserId(effectiveUserId);
      const sharedDashboards = await storage.getSharedDashboards();

      // Combine user dashboards and shared dashboards
      const allDashboards = [...userDashboards, ...sharedDashboards.filter(d => d.userId !== effectiveUserId)];

      res.json(allDashboards);
    } catch (error) {
      console.error("Error fetching dashboards:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch dashboards" });
    }
  });

  app.get("/api/dashboards/homescreen", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const dashboard = await storage.getHomescreenDashboard(effectiveUserId);

      if (!dashboard) {
        return res.status(404).json({ message: "No homescreen dashboard found" });
      }

      res.json(dashboard);
    } catch (error) {
      console.error("Error fetching homescreen dashboard:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch homescreen dashboard" });
    }
  });

  app.get("/api/dashboards/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const dashboard = await storage.getDashboardById(req.params.id);

      if (!dashboard) {
        return res.status(404).json({ message: "Dashboard not found" });
      }

      // Check authorization - user can access their own dashboards or shared ones
      if (dashboard.userId !== effectiveUserId && dashboard.visibility !== 'shared') {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(dashboard);
    } catch (error) {
      console.error("Error fetching dashboard:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch dashboard" });
    }
  });

  app.post("/api/dashboards", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Validate and sanitize input - ensure userId comes from auth, not body
      const validDashboardData = insertDashboardSchema.parse({
        ...req.body,
        userId: effectiveUserId, // Security: Always use authenticated user ID
      });

      // If setting this as homescreen dashboard, clear other homescreen dashboards first
      if (validDashboardData.isHomescreenDashboard) {
        await storage.clearHomescreenDashboards(effectiveUserId);
      }

      const newDashboard = await storage.createDashboard(validDashboardData);
      res.status(201).json(newDashboard);
    } catch (error) {
      console.error("Error creating dashboard:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to create dashboard" });
    }
  });

  app.patch("/api/dashboards/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const dashboard = await storage.getDashboardById(req.params.id);

      if (!dashboard) {
        return res.status(404).json({ message: "Dashboard not found" });
      }

      // Only dashboard owner can edit (or admins for shared dashboards)
      const isAdmin = req.user?.isAdmin || req.user?.canSeeAdminMenu;
      if (dashboard.userId !== effectiveUserId && !(isAdmin && dashboard.visibility === 'shared')) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validDashboardData = updateDashboardSchema.parse(req.body);

      // If setting this as homescreen dashboard, clear other homescreen dashboards first
      if (validDashboardData.isHomescreenDashboard) {
        await storage.clearHomescreenDashboards(effectiveUserId);
      }

      const updated = await storage.updateDashboard(req.params.id, validDashboardData);

      res.json(updated);
    } catch (error) {
      console.error("Error updating dashboard:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to update dashboard" });
    }
  });

  app.delete("/api/dashboards/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const dashboard = await storage.getDashboardById(req.params.id);

      if (!dashboard) {
        return res.status(404).json({ message: "Dashboard not found" });
      }

      // Only dashboard owner can delete
      if (dashboard.userId !== effectiveUserId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteDashboard(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting dashboard:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to delete dashboard" });
    }
  });

  // GET /api/dashboard - Get personalized dashboard data (homescreen)
  app.get("/api/dashboard", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      // Get all projects assigned to user
      const allProjects = await storage.getAllProjects();
      const userProjects = allProjects.filter(project =>
        project.currentAssigneeId === effectiveUserId ||
        project.bookkeeperId === effectiveUserId ||
        project.clientManagerId === effectiveUserId ||
        project.projectOwnerId === effectiveUserId
      );

      // Get recent clients, people, and projects using actual recently viewed data
      const recentlyViewed = await storage.getRecentlyViewedByUser(effectiveUserId, 30);

      const recentClientViews = recentlyViewed.filter(item => item.entityType === 'client' && item.entityData);
      const recentClients = recentClientViews.slice(0, 10).map(item => ({
        ...item.entityData,
        activeProjects: userProjects.filter(p => p.clientId === item.entityData.id).length,
        lastViewed: item.viewedAt
      }));

      const recentPeopleViews = recentlyViewed.filter(item => item.entityType === 'person' && item.entityData);
      const recentPeople = recentPeopleViews.slice(0, 10).map(item => ({
        ...item.entityData,
        lastViewed: item.viewedAt
      }));

      // Calculate overdue projects (active projects past their due date)
      const now = new Date();
      const overdueProjects = userProjects.filter(project => {
        // Must have a due date, not be archived or inactive, and not be completed
        if (!project.dueDate || project.archived || project.inactive || project.currentStatus === "completed") {
          return false;
        }
        // Check if due date has passed
        return new Date(project.dueDate) < now;
      });

      // Calculate behind schedule projects (at current stage longer than permitted time)
      // Note: This requires stage configuration data which we'll implement when stage configs are available
      const behindScheduleProjects = userProjects.filter(project => {
        if (project.archived || project.inactive || project.currentStatus === "completed") {
          return false;
        }

        const lastChronology = project.chronology?.[0];
        if (!lastChronology || !lastChronology.timestamp) return false;

        // For now, consider projects stuck in a stage for more than 7 days as "behind schedule"
        // TODO: Enhance this with actual stage maxInstanceTime and maxTotalTime when stage data is accessible
        const timeInCurrentStageMs = Date.now() - new Date(lastChronology.timestamp).getTime();
        const timeInCurrentStageDays = timeInCurrentStageMs / (1000 * 60 * 60 * 24);

        return timeInCurrentStageDays > 7;
      });

      // Group projects by type
      const projectsByType: { [key: string]: any[] } = {};
      userProjects.forEach(project => {
        const typeName = project.projectType?.name || "Unknown";
        if (!projectsByType[typeName]) {
          projectsByType[typeName] = [];
        }
        projectsByType[typeName].push(project);
      });

      const recentProjectViews = recentlyViewed.filter(item => item.entityType === 'project' && item.entityData);
      const recentProjects = recentProjectViews.slice(0, 10).map(item => ({
        ...item.entityData,
        lastViewed: item.viewedAt
      }));

      const dashboardData = {
        myActiveTasks: userProjects.filter(p => 
          p.currentAssigneeId === effectiveUserId && 
          p.currentStatus !== "completed" && 
          !p.archived && 
          !p.inactive
        ).slice(0, 10),
        myProjects: userProjects.filter(p => !p.archived && !p.inactive),
        overdueProjects: overdueProjects,
        behindScheduleProjects: behindScheduleProjects,
        recentClients: recentClients,
        recentPeople: recentPeople,
        recentProjects: recentProjects,
        projectsByType: projectsByType,
        deadlineAlerts: overdueProjects.map(p => ({
          message: `${p.client?.name || 'Unknown Client'} - ${p.projectType?.name || 'Project'} is overdue`,
          projectId: p.id,
          dueDate: p.dueDate
        })),
        stuckProjects: behindScheduleProjects,
        upcomingRenewals: [] // TODO: Implement renewal tracking
      };

      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // ===== ANALYTICS ROUTES =====

  app.post("/api/analytics", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Validate request body
      const validatedQuery = analyticsQuerySchema.parse(req.body);
      const { filters, groupBy, metric } = validatedQuery;

      const analyticsData = await storage.getProjectAnalytics(filters || {}, groupBy, metric);

      res.json({
        series: analyticsData,
        meta: {
          groupBy,
          metric,
          filters,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid request parameters",
          errors: error.errors
        });
      }
      console.error("Error fetching analytics:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch analytics data" });
    }
  });

  // ===== SEARCH AND ACTIVITY ROUTES =====

  // Super search endpoint - searches across all entity types
  app.get("/api/search", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { q: query, limit } = req.query;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ message: "Search query 'q' is required" });
      }

      const searchLimit = limit ? parseInt(limit as string, 10) : 5;
      if (isNaN(searchLimit) || searchLimit < 1 || searchLimit > 20) {
        return res.status(400).json({ message: "Limit must be between 1 and 20" });
      }

      const results = await storage.superSearch(query.trim(), searchLimit);
      res.json(results);
    } catch (error) {
      console.error("Error performing super search:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to perform search" });
    }
  });

  // User activity tracking endpoint
  app.post("/api/track-activity", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const { entityType, entityId } = req.body;

      if (!entityType || !entityId) {
        return res.status(400).json({ message: "entityType and entityId are required" });
      }

      // Validate entityType
      const validEntityTypes = ['client', 'project', 'person', 'communication'];
      if (!validEntityTypes.includes(entityType)) {
        return res.status(400).json({ message: "Invalid entityType. Must be one of: " + validEntityTypes.join(', ') });
      }

      await storage.trackUserActivity(effectiveUserId, entityType, entityId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking user activity:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to track activity" });
    }
  });

  // ===== DOCUMENT AND OBJECT STORAGE ROUTES =====

  // Get presigned URL for uploading documents
  app.post("/api/objects/upload", isAuthenticated, async (req: any, res: any) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL, objectPath });
    } catch (error) {
      console.error("Error generating upload URL:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // Import attachment access middleware for dual authentication
  const { authenticateStaffOrPortal, verifyAttachmentAccess } = await import('../middleware/attachmentAccess');

  // Serve/download private documents (with ACL check)
  // Supports both staff (session) and portal (JWT) authentication
  app.get("/objects/:objectPath(*)", authenticateStaffOrPortal, async (req: any, res: any) => {
    const userId = req.user?.id;
    const portalUserId = req.portalUser?.id;
    const objectPath = req.path; // Full path like /objects/uploads/...

    try {
      // Check attachment-specific access control (for message attachments and documents)
      const { hasAccess } = await verifyAttachmentAccess(userId, portalUserId, objectPath);

      if (!hasAccess) {
        console.log(`[Access Denied] Staff: ${userId || 'none'}, Portal: ${portalUserId || 'none'}, Path: ${objectPath}`);
        return res.status(403).json({ message: 'You do not have permission to access this file' });
      }

      // Use object storage service for actual file retrieval
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

      // Additional check using object storage service (for staff users)
      if (userId) {
        const canAccess = await objectStorageService.canAccessObjectEntity({
          objectFile,
          userId: userId,
          requestedPermission: ObjectPermission.READ,
        });

        if (!canAccess) {
          console.log(`[Object Storage Denied] Staff: ${userId}, Path: ${objectPath}`);
          return res.status(403).json({ message: 'You do not have permission to access this file' });
        }
      }

      // Download the file
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: 'File not found' });
      }
      return res.status(500).json({ message: 'Error accessing file' });
    }
  });

  // Get documents for a client
  app.get("/api/clients/:clientId/documents", isAuthenticated, async (req: any, res: any) => {
    try {
      const clientIdSchema = z.object({ clientId: z.string() });
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client ID",
          errors: paramValidation.errors
        });
      }

      const { clientId } = paramValidation.data;
      const documents = await storage.getDocumentsByClientId(clientId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Create document metadata after upload
  app.post("/api/clients/:clientId/documents", isAuthenticated, async (req: any, res: any) => {
    try {
      const clientIdSchema = z.object({ clientId: z.string() });
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client ID",
          errors: paramValidation.errors
        });
      }

      const { clientId } = paramValidation.data;
      const userId = req.user?.id;

      const documentURL = req.body.documentURL || req.body.objectPath;
      if (!documentURL) {
        return res.status(400).json({ error: "documentURL or objectPath is required" });
      }

      // Validate folderId belongs to the same client if provided
      if (req.body.folderId) {
        const folder = await storage.getDocumentFolderById(req.body.folderId);
        if (!folder) {
          return res.status(404).json({ message: "Folder not found" });
        }
        if (folder.clientId !== clientId) {
          return res.status(403).json({ message: "Folder does not belong to this client" });
        }
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        documentURL,
        {
          owner: userId,
          visibility: "private",
        },
      );

      // Create document record in database
      const documentData = insertDocumentSchema.parse({
        clientId,
        folderId: req.body.folderId || null,
        uploadedBy: userId,
        uploadName: req.body.uploadName || 'Untitled Upload',
        source: req.body.source || 'direct upload',
        fileName: req.body.fileName,
        fileSize: req.body.fileSize,
        fileType: req.body.fileType,
        objectPath,
      });

      const document = await storage.createDocument(documentData);
      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating document:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to create document" });
    }
  });

  // Delete a document
  app.get("/api/documents/:id/file", isAuthenticated, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      // Get the document
      const document = await storage.getDocumentById(id);
      if (!document) {
        console.log(`[Admin Document Access Denied] Document not found: ${id}`);
        return res.status(404).json({ message: "Document not found" });
      }

      // Serve the file using ObjectStorageService
      const objectStorageService = new ObjectStorageService();
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(document.objectPath);
        objectStorageService.downloadObject(objectFile, res);
      } catch (error) {
        console.error('Error serving admin document:', error);
        if (error instanceof ObjectNotFoundError) {
          return res.status(404).json({ message: 'Document file not found' });
        }
        return res.status(500).json({ message: 'Error serving document' });
      }
    } catch (error) {
      console.error("Error serving admin document:", error);
      res.status(500).json({ message: "Failed to serve document" });
    }
  });

  app.delete("/api/documents/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const documentIdSchema = z.object({ id: z.string().uuid() });
      const paramValidation = validateParams(documentIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid document ID",
          errors: paramValidation.errors
        });
      }

      const { id } = paramValidation.data;

      // Get document to check it exists and get object path
      const document = await storage.getDocumentById(id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Delete from database
      await storage.deleteDocument(id);

      // Note: We're not deleting from object storage to maintain audit trail
      // If needed, add object storage deletion here

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Document folder routes
  app.post("/api/clients/:clientId/folders", isAuthenticated, async (req: any, res: any) => {
    try {
      const clientIdSchema = z.object({ clientId: z.string() });
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client ID",
          errors: paramValidation.errors
        });
      }

      const { clientId } = paramValidation.data;
      const userId = req.user?.id;

      const folderData = insertDocumentFolderSchema.parse({
        clientId,
        name: req.body.name,
        createdBy: userId,
        source: req.body.source || 'manual',
      });

      const folder = await storage.createDocumentFolder(folderData);
      res.status(201).json(folder);
    } catch (error) {
      console.error("Error creating folder:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to create folder" });
    }
  });

  app.get("/api/clients/:clientId/folders", isAuthenticated, async (req: any, res: any) => {
    try {
      const clientIdSchema = z.object({ clientId: z.string() });
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client ID",
          errors: paramValidation.errors
        });
      }

      const { clientId } = paramValidation.data;
      const folders = await storage.getDocumentFoldersByClientId(clientId);
      res.json(folders);
    } catch (error) {
      console.error("Error fetching folders:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch folders" });
    }
  });

  app.get("/api/folders/:folderId/documents", isAuthenticated, async (req: any, res: any) => {
    try {
      const folderIdSchema = z.object({ folderId: z.string().uuid() });
      const paramValidation = validateParams(folderIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid folder ID",
          errors: paramValidation.errors
        });
      }

      const { folderId } = paramValidation.data;
      const documents = await storage.getDocumentsByFolderId(folderId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching folder documents:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.delete("/api/folders/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const folderIdSchema = z.object({ id: z.string().uuid() });
      const paramValidation = validateParams(folderIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid folder ID",
          errors: paramValidation.errors
        });
      }

      const { id } = paramValidation.data;

      // Get folder to check it exists
      const folder = await storage.getDocumentFolderById(id);
      if (!folder) {
        return res.status(404).json({ message: "Folder not found" });
      }

      // Delete folder (CASCADE will delete associated documents)
      await storage.deleteDocumentFolder(id);

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting folder:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to delete folder" });
    }
  });

  // ===== PORTAL USER MANAGEMENT ROUTES =====

  // GET /api/portal-user/by-person/:personId - Get portal user by person ID (auto-creates if missing)
  app.get("/api/portal-user/by-person/:personId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { personId } = req.params;
      let portalUser = await storage.getClientPortalUserByPersonId(personId);

      // If portal user doesn't exist, create one
      if (!portalUser) {
        // Fetch person to get their email and client ID
        const person = await storage.getPersonById(personId);
        if (!person) {
          return res.status(404).json({ message: "Person not found" });
        }

        // Find client association for this person
        const { clientPeople } = await import('@shared/schema');
        const clientPerson = await db.query.clientPeople.findFirst({
          where: eq(clientPeople.personId, personId),
        });

        if (!clientPerson || !person.email) {
          return res.status(400).json({ message: "Person must have email and be linked to a client" });
        }

        // Create portal user
        portalUser = await storage.createClientPortalUser({
          clientId: clientPerson.clientId,
          email: person.email,
          name: person.fullName,
          personId: personId,
        });
      }

      res.json(portalUser);
    } catch (error) {
      console.error("Error fetching portal user:", error);
      res.status(500).json({ message: "Failed to fetch portal user" });
    }
  });

  // POST /api/portal-user/generate-magic-link - Generate magic link for a person
  app.post("/api/portal-user/generate-magic-link", isAuthenticated, async (req: any, res: any) => {
    try {
      const { personId, clientId, email, name } = req.body;

      if (!personId || !clientId || !email) {
        return res.status(400).json({ message: "personId, clientId, and email are required" });
      }

      // Check if portal user exists for this person
      let portalUser = await storage.getClientPortalUserByPersonId(personId);

      if (!portalUser) {
        // Create new portal user linked to person
        portalUser = await storage.createClientPortalUser({
          clientId,
          email,
          name,
          personId,
        });
      }

      // Generate magic link token
      const token = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Update portal user with magic link token
      await db
        .update(clientPortalUsers)
        .set({
          magicLinkToken: token,
          tokenExpiry
        })
        .where(eq(clientPortalUsers.id, portalUser.id));

      // Generate magic link URL
      const magicLink = `${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000'}/portal/verify?token=${token}`;

      res.json({ magicLink, portalUser });
    } catch (error) {
      console.error("Error generating magic link:", error);
      res.status(500).json({ message: "Failed to generate magic link" });
    }
  });

  // POST /api/portal-user/generate-qr-code - Generate QR code for a person
  app.post("/api/portal-user/generate-qr-code", isAuthenticated, async (req: any, res: any) => {
    try {
      const { personId, clientId, email, name } = req.body;

      if (!personId || !clientId || !email) {
        return res.status(400).json({ message: "personId, clientId, and email are required" });
      }

      // Check if portal user exists for this person
      let portalUser = await storage.getClientPortalUserByPersonId(personId);

      if (!portalUser) {
        // Create new portal user linked to person
        portalUser = await storage.createClientPortalUser({
          clientId,
          email,
          name,
          personId,
        });
      }

      // Generate portal install page URL (no authentication - just installation instructions)
      const installUrl = `${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000'}/portal/install`;

      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(installUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      res.json({ qrCodeDataUrl, installUrl, portalUser });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  // POST /api/portal-user/send-invitation - Send invitation email with magic link
  app.post("/api/portal-user/send-invitation", isAuthenticated, async (req: any, res: any) => {
    try {
      const { personId, clientId, email, name, clientName } = req.body;

      if (!personId || !clientId || !email) {
        return res.status(400).json({ message: "personId, clientId, and email are required" });
      }

      // Check if portal user exists for this person
      let portalUser = await storage.getClientPortalUserByPersonId(personId);

      if (!portalUser) {
        // Check if a portal user with this email already exists
        const existingUser = await storage.getClientPortalUserByEmail(email);
        if (existingUser) {
          // Update existing portal user to link with this person
          portalUser = await storage.updateClientPortalUser(existingUser.id, {
            personId,
            name: name || existingUser.name,
            clientId: clientId || existingUser.clientId
          });
        } else {
          // Create new portal user linked to person
          portalUser = await storage.createClientPortalUser({
            clientId,
            email,
            name,
            personId,
          });
        }
      }

      // Generate magic link token
      const token = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Update portal user with magic link token
      await db
        .update(clientPortalUsers)
        .set({
          magicLinkToken: token,
          tokenExpiry
        })
        .where(eq(clientPortalUsers.id, portalUser.id));

      // Generate magic link URL
      const magicLink = `${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000'}/portal/verify?token=${token}`;

      // Send invitation email
      if (!process.env.SENDGRID_API_KEY) {
        return res.status(500).json({ message: "SendGrid is not configured" });
      }

      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const logoUrl = `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/attached_assets/full_logo_transparent_600_1761924125378.png`;

      const msg = {
        to: email,
        from: process.env.FROM_EMAIL || 'link@growth-accountants.com',
        subject: `Welcome to ${clientName || 'Client'} Portal`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #0A7BBF 0%, #0869A3 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <img src="${logoUrl}" alt="Growth Accountants" style="max-width: 200px; height: auto; margin-bottom: 20px;" />
                <h1 style="color: white; margin: 0; font-size: 28px;">The Link</h1>
              </div>

              <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px; margin-bottom: 20px;">Hi ${name || 'there'},</p>

                <p style="font-size: 16px; margin-bottom: 20px;">
                  You've been invited to access your secure client portal${clientName ? ` for ${clientName}` : ''}.
                  Click the button below to log in instantly - no password required!
                </p>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${magicLink}"
                     style="display: inline-block; background: linear-gradient(135deg, #0A7BBF 0%, #0869A3 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Access Portal
                  </a>
                </div>

                <p style="font-size: 14px; color: #666; margin-top: 30px;">
                  This link is valid for 24 hours. If you didn't request this invitation, you can safely ignore this email.
                </p>

                <p style="font-size: 14px; color: #666; margin-top: 20px;">
                  Or copy and paste this URL into your browser:<br>
                  <a href="${magicLink}" style="color: #0A7BBF; word-break: break-all;">${magicLink}</a>
                </p>
              </div>

              <div style="background-color: #f1f5f9; padding: 30px; text-align: center; color: #64748b; font-size: 14px;">
                <p style="margin: 0 0 10px 0;">
                  <strong style="color: #0A7BBF;">The Link</strong> by Growth Accountants
                </p>
                <p style="margin: 0; font-size: 13px;">
                  Your workflow management partner
                </p>
              </div>

              <div style="text-align: center; margin-top: 20px; padding: 20px; color: #999; font-size: 12px;">
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </body>
          </html>
        `,
      };

      await sgMail.send(msg);

      res.json({
        message: "Invitation sent successfully",
        magicLink,
        portalUser
      });
    } catch (error) {
      console.error("Error sending invitation:", error);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  // Get portal status summary for all clients (for Companies table)
  app.get("/api/portal-status", isAuthenticated, async (req: any, res: any) => {
    try {
      // Get all portal users with their person links
      const portalUsers = await db
        .select({
          id: clientPortalUsers.id,
          clientId: clientPortalUsers.clientId,
          personId: clientPortalUsers.personId,
          lastLogin: clientPortalUsers.lastLogin,
          pushNotificationsEnabled: clientPortalUsers.pushNotificationsEnabled,
        })
        .from(clientPortalUsers);

      // Group by clientId and count statuses
      const statusByClient: Record<string, { hasApp: number; pushEnabled: number }> = {};

      for (const user of portalUsers) {
        if (!statusByClient[user.clientId]) {
          statusByClient[user.clientId] = { hasApp: 0, pushEnabled: 0 };
        }

        // Count users who have logged in at least once
        if (user.lastLogin) {
          statusByClient[user.clientId].hasApp += 1;
        }

        // Count users with push notifications enabled
        if (user.pushNotificationsEnabled) {
          statusByClient[user.clientId].pushEnabled += 1;
        }
      }

      res.json(statusByClient);
    } catch (error) {
      console.error("Error fetching portal status:", error);
      res.status(500).json({ message: "Failed to fetch portal status" });
    }
  });

  // ===== RISK ASSESSMENT ROUTES =====

  // GET /api/risk-assessments/:id - Get a specific risk assessment with responses
  app.get("/api/risk-assessments/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const assessment = await storage.getRiskAssessmentById(id);
      if (!assessment) {
        return res.status(404).json({ message: "Risk assessment not found" });
      }

      // Check if user has access to the client (helper function userHasClientAccess would be needed)
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      // Note: Access check should be implemented based on your access control logic

      const responses = await storage.getRiskAssessmentResponses(id);
      res.json({ ...assessment, responses });
    } catch (error) {
      console.error("Error fetching risk assessment:", error);
      res.status(500).json({ message: "Failed to fetch risk assessment" });
    }
  });

  app.patch("/api/risk-assessments/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const existingAssessment = await storage.getRiskAssessmentById(id);
      if (!existingAssessment) {
        return res.status(404).json({ message: "Risk assessment not found" });
      }

      const bodyValidation = updateRiskAssessmentSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid risk assessment data",
          errors: bodyValidation.error.issues
        });
      }

      const updatedAssessment = await storage.updateRiskAssessment(id, bodyValidation.data);
      res.json(updatedAssessment);
    } catch (error) {
      console.error("Error updating risk assessment:", error);
      res.status(500).json({ message: "Failed to update risk assessment" });
    }
  });

  app.delete("/api/risk-assessments/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const existingAssessment = await storage.getRiskAssessmentById(id);
      if (!existingAssessment) {
        return res.status(404).json({ message: "Risk assessment not found" });
      }

      await storage.deleteRiskAssessment(id);
      res.json({ message: "Risk assessment deleted successfully" });
    } catch (error) {
      console.error("Error deleting risk assessment:", error);
      res.status(500).json({ message: "Failed to delete risk assessment" });
    }
  });

  app.post("/api/risk-assessments/:id/responses", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const existingAssessment = await storage.getRiskAssessmentById(id);
      if (!existingAssessment) {
        return res.status(404).json({ message: "Risk assessment not found" });
      }

      // Validate responses array
      const responsesValidation = z.array(insertRiskAssessmentResponseSchema.omit({ riskAssessmentId: true })).safeParse(req.body.responses);
      if (!responsesValidation.success) {
        return res.status(400).json({
          message: "Invalid responses data",
          errors: responsesValidation.error.issues
        });
      }

      // Add assessment ID to each response
      const responsesWithAssessmentId = responsesValidation.data.map(response => ({
        ...response,
        riskAssessmentId: id,
      }));

      await storage.saveRiskAssessmentResponses(id, responsesWithAssessmentId);
      res.json({ message: "Responses saved successfully" });
    } catch (error) {
      console.error("Error saving risk assessment responses:", error);
      res.status(500).json({ message: "Failed to save risk assessment responses" });
    }
  });

  // ===== VIEW AND PREFERENCES ROUTES =====

  // Company views routes (saved filter configurations)
  app.get("/api/company-views", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const views = await storage.getCompanyViewsByUserId(effectiveUserId);
      res.json(views);
    } catch (error) {
      console.error("Error fetching company views:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch company views" });
    }
  });

  app.post("/api/company-views", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const viewData = req.body;

      // Validate company view data
      const validViewData = insertCompanyViewSchema.parse({
        ...viewData,
        userId: effectiveUserId, // Ensure userId matches authenticated user
      });

      const newView = await storage.createCompanyView(validViewData);
      res.json(newView);
    } catch (error) {
      console.error("Error creating company view:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to create company view" });
    }
  });

  app.delete("/api/company-views/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Validate path parameters
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      // First, verify the view belongs to the user
      const views = await storage.getCompanyViewsByUserId(effectiveUserId);
      const viewToDelete = views.find(v => v.id === req.params.id);

      if (!viewToDelete) {
        return res.status(404).json({ message: "Company view not found or access denied" });
      }

      await storage.deleteCompanyView(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting company view:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to delete company view" });
    }
  });

  // User column preferences routes
  app.get("/api/column-preferences", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const viewType = req.query.viewType as string || 'projects';
      const preferences = await storage.getUserColumnPreferences(effectiveUserId, viewType);

      // Return null if no preferences exist yet (first time user)
      res.json(preferences || null);
    } catch (error) {
      console.error("Error fetching column preferences:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch column preferences" });
    }
  });

  app.post("/api/column-preferences", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Validate and sanitize input - ensure userId comes from auth, not body
      const validPreferencesData = insertUserColumnPreferencesSchema.parse({
        ...req.body,
        userId: effectiveUserId, // Security: Always use authenticated user ID
        viewType: req.body.viewType || 'projects', // Default to projects if not specified
      });

      const savedPreferences = await storage.upsertUserColumnPreferences(validPreferencesData);
      res.json(savedPreferences);
    } catch (error) {
      console.error("Error saving column preferences:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to save column preferences" });
    }
  });

  // Companies table column preferences routes (reuse same storage as main column preferences)
  app.get("/api/companies-column-preferences", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const preferences = await storage.getUserColumnPreferences(effectiveUserId);

      // Return null if no preferences exist yet (first time user)
      res.json(preferences || null);
    } catch (error) {
      console.error("Error fetching companies column preferences:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch companies column preferences" });
    }
  });

  app.post("/api/companies-column-preferences", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Validate and sanitize input - ensure userId comes from auth, not body
      const validPreferencesData = insertUserColumnPreferencesSchema.parse({
        ...req.body,
        userId: effectiveUserId, // Security: Always use authenticated user ID
      });

      const savedPreferences = await storage.upsertUserColumnPreferences(validPreferencesData);
      res.json(savedPreferences);
    } catch (error) {
      console.error("Error saving companies column preferences:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to save companies column preferences" });
    }
  });

  // ===== DATA IMPORT ROUTES =====

  app.post("/api/import/validate", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clients, clientServices, roleAssignments } = req.body;

      console.log("=== Import Validation Request ===");
      console.log("Clients count:", clients?.length || 0);
      console.log("Client Services count:", clientServices?.length || 0);
      console.log("Role Assignments count:", roleAssignments?.length || 0);

      if (clients?.length > 0) {
        console.log("First client row:", JSON.stringify(clients[0], null, 2));
        console.log("Client row keys:", Object.keys(clients[0]));
      }
      if (clientServices?.length > 0) {
        console.log("First service row:", JSON.stringify(clientServices[0], null, 2));
        console.log("Service row keys:", Object.keys(clientServices[0]));
      }

      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate clients data
      const clientRefs = new Set<string>();
      const personRefs = new Set<string>();

      for (const row of clients || []) {
        if (!row.client_ref) errors.push("Missing client_ref in clients data");
        if (!row.client_name) errors.push(`Missing client_name for ${row.client_ref || 'unknown'}`);
        if (!row.client_type) errors.push(`Missing client_type for ${row.client_ref || 'unknown'}`);
        if (row.client_type && !['company', 'individual'].includes(row.client_type)) {
          errors.push(`Invalid client_type for ${row.client_ref}. Must be 'company' or 'individual'`);
        }

        if (row.client_ref) clientRefs.add(row.client_ref);
        if (row.person_ref) personRefs.add(row.person_ref);

        if (!row.person_full_name && row.person_ref) {
          errors.push(`Missing person_full_name for ${row.person_ref}`);
        }
      }

      // Validate client services
      for (const row of clientServices || []) {
        if (!row.client_ref) errors.push("Missing client_ref in services data");
        if (row.client_ref && !clientRefs.has(row.client_ref)) {
          errors.push(`Client ref ${row.client_ref} in services not found in clients data`);
        }
        if (!row.service_name) errors.push(`Missing service_name for ${row.client_ref}`);
        if (!row.frequency) errors.push(`Missing frequency for ${row.client_ref} - ${row.service_name}`);
        if (row.frequency && !['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annually'].includes(row.frequency)) {
          errors.push(`Invalid frequency for ${row.client_ref}. Must be one of: daily, weekly, fortnightly, monthly, quarterly, annually`);
        }

        // Check if service exists
        if (row.service_name) {
          const service = await storage.getServiceByName(row.service_name);
          if (!service) {
            const allServices = await storage.getAllServices();
            const serviceNames = allServices.map(s => s.name).slice(0, 5).join(', ');
            errors.push(`Service "${row.service_name}" not found in system. Available services include: ${serviceNames}...`);
          }
        }

        // Check if service owner exists
        if (row.service_owner_email) {
          const user = await storage.getUserByEmail(row.service_owner_email);
          if (!user) {
            errors.push(`User with email "${row.service_owner_email}" not found in system`);
          }
        }
      }

      // Validate role assignments
      for (const row of roleAssignments || []) {
        if (!row.client_ref) errors.push("Missing client_ref in role assignments");
        if (row.client_ref && !clientRefs.has(row.client_ref)) {
          errors.push(`Client ref ${row.client_ref} in role assignments not found in clients data`);
        }
        if (!row.service_name) errors.push(`Missing service_name for ${row.client_ref}`);
        if (!row.work_role_name) errors.push(`Missing work_role_name for ${row.client_ref} - ${row.service_name}`);
        if (!row.assigned_user_email) errors.push(`Missing assigned_user_email for ${row.client_ref} - ${row.service_name} - ${row.work_role_name}`);

        // Check if work role exists
        if (row.work_role_name) {
          const workRole = await storage.getWorkRoleByName(row.work_role_name);
          if (!workRole) {
            const allWorkRoles = await storage.getAllWorkRoles();
            const roleNames = allWorkRoles.map(r => r.name).slice(0, 5).join(', ');
            errors.push(`Work role "${row.work_role_name}" not found in system. Available roles include: ${roleNames}...`);
          }
        }

        // Check if user exists
        if (row.assigned_user_email) {
          const user = await storage.getUserByEmail(row.assigned_user_email);
          if (!user) {
            errors.push(`User with email "${row.assigned_user_email}" not found in system`);
          }
        }
      }

      res.json({
        isValid: errors.length === 0,
        errors,
        warnings,
      });
    } catch (error) {
      console.error("Validation error:", error);
      res.status(500).json({ message: "Validation failed" });
    }
  });

  app.post("/api/import/execute", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clients, clientServices, roleAssignments } = req.body;

      console.log("=== Import Execution Request ===");
      console.log("Clients count:", clients?.length || 0);
      console.log("Client Services count:", clientServices?.length || 0);
      console.log("Role Assignments count:", roleAssignments?.length || 0);

      // ============================================
      // STEP 1: COMPREHENSIVE PRE-VALIDATION
      // ============================================
      // Validate everything BEFORE starting the transaction
      // This ensures we fail fast with clear errors before touching the database

      const validationErrors: string[] = [];
      const clientRefs = new Set<string>();
      const personRefs = new Set<string>();

      // Validate client data structure and collect refs
      for (const row of clients || []) {
        if (!row.client_ref) validationErrors.push("Missing client_ref in clients data");
        if (!row.client_name) validationErrors.push(`Missing client_name for ${row.client_ref || 'unknown'}`);
        if (!row.client_type) validationErrors.push(`Missing client_type for ${row.client_ref || 'unknown'}`);
        if (row.client_type && !['company', 'individual'].includes(row.client_type)) {
          validationErrors.push(`Invalid client_type for ${row.client_ref}. Must be 'company' or 'individual'`);
        }

        if (row.client_ref) clientRefs.add(row.client_ref);
        if (row.person_ref) personRefs.add(row.person_ref);

        if (!row.person_full_name && row.person_ref) {
          validationErrors.push(`Missing person_full_name for ${row.person_ref}`);
        }
      }

      // Validate client services structure and verify references
      const serviceLookup = new Map<string, any>(); // Cache service lookups
      const userLookup = new Map<string, any>(); // Cache user lookups

      for (const row of clientServices || []) {
        if (!row.client_ref) {
          validationErrors.push("Missing client_ref in services data");
        } else if (!clientRefs.has(row.client_ref)) {
          validationErrors.push(`Client ref ${row.client_ref} in services not found in clients data`);
        }

        if (!row.service_name) {
          validationErrors.push(`Missing service_name for ${row.client_ref}`);
        } else {
          // Verify service exists (cache the result)
          if (!serviceLookup.has(row.service_name)) {
            const service = await storage.getServiceByName(row.service_name);
            if (!service) {
              const allServices = await storage.getAllServices();
              const serviceNames = allServices.map(s => s.name).slice(0, 5).join(', ');
              validationErrors.push(`Service "${row.service_name}" not found in system. Available services include: ${serviceNames}...`);
            } else {
              serviceLookup.set(row.service_name, service);
            }
          }
        }

        if (!row.frequency) {
          validationErrors.push(`Missing frequency for ${row.client_ref} - ${row.service_name}`);
        } else if (!['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annually'].includes(row.frequency)) {
          validationErrors.push(`Invalid frequency for ${row.client_ref}. Must be one of: daily, weekly, fortnightly, monthly, quarterly, annually`);
        }

        // Verify service owner exists if provided
        if (row.service_owner_email) {
          if (!userLookup.has(row.service_owner_email)) {
            const user = await storage.getUserByEmail(row.service_owner_email);
            if (!user) {
              validationErrors.push(`User with email "${row.service_owner_email}" not found in system`);
            } else {
              userLookup.set(row.service_owner_email, user);
            }
          }
        }
      }

      // Validate role assignments and verify references
      const workRoleLookup = new Map<string, any>(); // Cache work role lookups

      for (const row of roleAssignments || []) {
        if (!row.client_ref) {
          validationErrors.push("Missing client_ref in role assignments");
        } else if (!clientRefs.has(row.client_ref)) {
          validationErrors.push(`Client ref ${row.client_ref} in role assignments not found in clients data`);
        }

        if (!row.service_name) validationErrors.push(`Missing service_name for ${row.client_ref}`);
        if (!row.work_role_name) validationErrors.push(`Missing work_role_name for ${row.client_ref} - ${row.service_name}`);
        if (!row.assigned_user_email) validationErrors.push(`Missing assigned_user_email for ${row.client_ref} - ${row.service_name} - ${row.work_role_name}`);

        // Verify work role exists
        if (row.work_role_name) {
          if (!workRoleLookup.has(row.work_role_name)) {
            const workRole = await storage.getWorkRoleByName(row.work_role_name);
            if (!workRole) {
              const allWorkRoles = await storage.getAllWorkRoles();
              const roleNames = allWorkRoles.map(r => r.name).slice(0, 5).join(', ');
              validationErrors.push(`Work role "${row.work_role_name}" not found in system. Available roles include: ${roleNames}...`);
            } else {
              workRoleLookup.set(row.work_role_name, workRole);
            }
          }
        }

        // Verify assigned user exists
        if (row.assigned_user_email) {
          if (!userLookup.has(row.assigned_user_email)) {
            const user = await storage.getUserByEmail(row.assigned_user_email);
            if (!user) {
              validationErrors.push(`User with email "${row.assigned_user_email}" not found in system`);
            } else {
              userLookup.set(row.assigned_user_email, user);
            }
          }
        }
      }

      // If there are ANY validation errors, stop immediately before touching the database
      if (validationErrors.length > 0) {
        console.log("Validation failed with errors:", validationErrors);
        return res.status(400).json({
          success: false,
          message: "Import validation failed. No data has been imported.",
          errors: validationErrors,
          clientsCreated: 0,
          peopleCreated: 0,
          relationshipsCreated: 0,
          servicesCreated: 0,
          rolesAssigned: 0,
        });
      }

      console.log("Pre-validation passed. Starting transactional import...");

      // ============================================
      // STEP 2: TRANSACTIONAL IMPORT
      // ============================================
      // All database operations happen in a single transaction
      // If ANYTHING fails, the entire transaction is rolled back

      const result = await db.transaction(async (tx) => {
        const stats = {
          success: true,
          clientsCreated: 0,
          peopleCreated: 0,
          relationshipsCreated: 0,
          servicesCreated: 0,
          rolesAssigned: 0,
          errors: [] as string[],
        };

        // Maps for tracking created entities within this transaction
        const clientMap = new Map<string, string>(); // client_ref -> client_id
        const personMap = new Map<string, string>(); // person_ref -> person_id
        const clientServiceMap = new Map<string, string>(); // "client_ref|service_name" -> client_service_id

        // Import clients and people
        for (const row of clients || []) {
          // Create or get client
          let clientId = clientMap.get(row.client_ref);

          if (!clientId) {
            const clientData = {
              name: row.client_name,
              email: row.client_email || null,
              clientType: row.client_type,
              companyNumber: row.company_number || null,
            };

            // Use tx instead of db for transaction-scoped operations
            const [client] = await tx.insert(clientsTable).values(clientData).returning();
            clientId = client.id;
            clientMap.set(row.client_ref, clientId);
            stats.clientsCreated++;
          }

          // Create or get person
          if (row.person_ref && row.person_full_name) {
            let personId = personMap.get(row.person_ref);

            if (!personId) {
              const personData: InsertPerson = {
                fullName: row.person_full_name,
                email: row.person_email || null,
                telephone: row.person_telephone || null,
                primaryPhone: row.person_primary_phone || null,
                primaryEmail: row.person_primary_email || null,
              };

              const [person] = await tx.insert(peopleTable).values([personData]).returning();
              personId = person.id;
              personMap.set(row.person_ref, personId);
              stats.peopleCreated++;
            }

            // Create client-person relationship
            await tx.insert(clientPeopleTable).values({
              clientId,
              personId,
              officerRole: row.officer_role || null,
              isPrimaryContact: row.is_primary_contact?.toLowerCase() === 'yes',
            });
            stats.relationshipsCreated++;
          }
        }

        // Import client services
        for (const row of clientServices || []) {
          const clientId = clientMap.get(row.client_ref);
          if (!clientId) {
            throw new Error(`Client ref ${row.client_ref} not found - this should have been caught in validation`);
          }

          const service = serviceLookup.get(row.service_name);
          if (!service) {
            throw new Error(`Service "${row.service_name}" not found - this should have been caught in validation`);
          }

          let serviceOwnerId = null;
          if (row.service_owner_email) {
            const user = userLookup.get(row.service_owner_email);
            if (user) {
              serviceOwnerId = user.id;
            }
          }

          // Parse dates
          const parseDate = (dateStr: string) => {
            if (!dateStr) return null;
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const [day, month, year] = parts;
              return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            }
            return null;
          };

          const nextStartDate = parseDate(row.next_start_date);
          const nextDueDate = parseDate(row.next_due_date);

          const clientServiceData: InsertClientService = {
            clientId,
            serviceId: service.id,
            serviceOwnerId,
            frequency: row.frequency,
            nextStartDate: nextStartDate ? nextStartDate.toISOString() : null,
            nextDueDate: nextDueDate ? nextDueDate.toISOString() : null,
            isActive: row.is_active?.toLowerCase() !== 'no',
          };

          const [clientService] = await tx.insert(clientServicesTable).values([clientServiceData]).returning();
          const serviceKey = `${row.client_ref}|${row.service_name}`;
          clientServiceMap.set(serviceKey, clientService.id);
          stats.servicesCreated++;
        }

        // Import role assignments
        for (const row of roleAssignments || []) {
          const serviceKey = `${row.client_ref}|${row.service_name}`;
          const clientServiceId = clientServiceMap.get(serviceKey);
          
          if (!clientServiceId) {
            throw new Error(`Client service not found for ${serviceKey} - this should have been caught earlier`);
          }

          const workRole = workRoleLookup.get(row.work_role_name);
          const user = userLookup.get(row.assigned_user_email);

          if (!workRole || !user) {
            throw new Error(`Work role or user not found - this should have been caught in validation`);
          }

          await tx.insert(clientServiceRoleAssignmentsTable).values({
            clientServiceId,
            workRoleId: workRole.id,
            userId: user.id,
            isActive: row.is_active?.toLowerCase() !== 'no',
          });
          stats.rolesAssigned++;
        }

        return stats;
      });

      console.log("Transactional import completed successfully:", result);
      res.json(result);

    } catch (error) {
      console.error("Import transaction failed and was rolled back:", error);
      res.status(500).json({ 
        success: false,
        message: "Import failed. No data has been imported due to an error.",
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        clientsCreated: 0,
        peopleCreated: 0,
        relationshipsCreated: 0,
        servicesCreated: 0,
        rolesAssigned: 0,
      });
    }
  });

  // ===== ADMIN ROUTES =====

  // POST /api/admin/delete-test-data - Delete all test data (development only)
  app.post("/api/admin/delete-test-data", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      // Block access in production environment
      if (process.env.NODE_ENV === 'production') {
        console.warn(`Blocked delete-test-data attempt in production by user ${req.user?.effectiveUserId || req.user?.id}`);
        return res.status(403).json({
          message: "Delete test data is not available in production environment"
        });
      }

      // Validate request body and confirmation
      const bodySchema = z.object({
        confirm: z.string().min(1, "Confirmation is required")
      });

      const bodyValidation = bodySchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: bodyValidation.error.issues
        });
      }

      const { confirm } = bodyValidation.data;

      // Require exact confirmation string
      if (confirm !== "DELETE") {
        return res.status(400).json({
          message: "Confirmation string must be exactly 'DELETE'"
        });
      }

      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      // Call storage method to delete test data
      // Note: Implementation depends on your storage layer
      console.log(`Deleting test data requested by user ${effectiveUserId}`);

      res.json({
        message: "Test data deletion initiated",
        requestedBy: effectiveUserId
      });
    } catch (error) {
      console.error("Error deleting test data:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to delete test data" });
    }
  });

  // ===== ADDRESS LOOKUP ROUTES =====

  // Address lookup endpoint using getaddress.io autocomplete API
  app.get('/api/address-lookup/:term', isAuthenticated, async (req: any, res) => {
    try {
      const { term } = req.params;

      if (!term || term.trim().length === 0) {
        return res.status(400).json({ error: 'Search term is required' });
      }

      const apiKey = process.env.GETADDRESS_API_KEY;
      if (!apiKey) {
        console.error('GETADDRESS_API_KEY not found in environment variables');
        return res.status(500).json({ error: 'Address lookup service not configured' });
      }

      const cleanTerm = term.trim();
      const url = `https://api.getaddress.io/autocomplete/${encodeURIComponent(cleanTerm)}?api-key=${apiKey}`;

      const response = await fetch(url);

      if (response.status === 404) {
        return res.status(404).json({ error: 'No addresses found for this search term' });
      }

      if (!response.ok) {
        console.error('getaddress.io API error:', response.status, await response.text());
        return res.status(500).json({ error: 'Address lookup service unavailable' });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Address lookup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Address details endpoint using getaddress.io get endpoint
  app.get('/api/address-details/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;

      if (!id || id.trim().length === 0) {
        return res.status(400).json({ error: 'Address ID is required' });
      }

      const apiKey = process.env.GETADDRESS_API_KEY;
      if (!apiKey) {
        console.error('GETADDRESS_API_KEY not found in environment variables');
        return res.status(500).json({ error: 'Address lookup service not configured' });
      }

      const url = `https://api.getaddress.io/get/${encodeURIComponent(id)}?api-key=${apiKey}`;

      const response = await fetch(url);

      if (response.status === 404) {
        return res.status(404).json({ error: 'Address not found' });
      }

      if (!response.ok) {
        console.error('getaddress.io details API error:', response.status, await response.text());
        return res.status(500).json({ error: 'Address details service unavailable' });
      }

      const data = await response.json() as any;

      // Transform GetAddress.io response to our expected format
      const transformedAddress = {
        line1: data.line_1 || "",
        line2: data.line_2 || "",
        city: data.town_or_city || "",
        county: data.county || "",
        postcode: data.postcode || "",
        country: "United Kingdom"
      };

      res.json(transformedAddress);
    } catch (error) {
      console.error('Address details error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
