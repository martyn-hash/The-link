import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage/index";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import {
  insertUserSchema,
  updateUserNotificationPreferencesSchema,
  sessions,
} from "@shared/schema";
import { validateParams, paramUserIdAsIdSchema } from "./routeHelpers";

export function registerUsersRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  // ===== USER MANAGEMENT ROUTES =====

  app.get("/api/users", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      const users = await storage.getAllUsers();
      
      // Query active sessions to determine who's online
      const activeSessions = await db
        .select({ userId: sql<string>`(sess->>'userId')::text` })
        .from(sessions)
        .where(sql`expire > NOW()`);
      
      const onlineUserIds = new Set(activeSessions.map(s => s.userId).filter(Boolean));
      
      // Strip password hash from response and add online status
      const sanitizedUsers = users.map(({ passwordHash, ...user }) => ({
        ...user,
        isOnline: onlineUserIds.has(user.id),
      }));
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get users for messaging - accessible to all authenticated users
  // IMPORTANT: This route MUST come before /api/users/:id to avoid "for-messaging" being matched as an ID
  app.get("/api/users/for-messaging", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const users = await storage.getAllUsers();
      
      // Strip password hash and sensitive fields from response
      const sanitizedUsers = users.map(({ passwordHash, ...user }) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      }));
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users for messaging:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get a single user by ID
  app.get("/api/users/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramUserIdAsIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Strip password hash from response
      const { passwordHash, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error("Error fetching user:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch user" });
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

      // Send welcome email to new staff user
      try {
        const { sendWelcomeEmail } = await import('../emailService');
        const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'there';
        await sendWelcomeEmail(
          user.email || '',
          userFullName,
          'https://flow.growth.accountants'
        );
        console.log(`Welcome email sent to ${user.email}`);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }

      // Remove password hash from response
      const { passwordHash: _, ...userResponse } = user;
      res.json(userResponse);
    } catch (error: any) {
      console.error("Error creating user:", error instanceof Error ? error.message : error);
      
      let errorMessage = "Failed to create user";
      let statusCode = 400;
      
      if (error?.message?.includes('unique constraint') || error?.message?.includes('duplicate key')) {
        if (error.message.includes('email')) {
          errorMessage = "That email address is already registered. Please use a different email.";
          statusCode = 409;
        } else {
          errorMessage = "A user with these details already exists.";
          statusCode = 409;
        }
      } else if (error?.message?.includes('validation')) {
        errorMessage = error.message;
      }
      
      res.status(statusCode).json({ message: errorMessage });
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
      console.error("Error updating user:", error instanceof Error ? error.message : error);
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
      console.error("Error deleting user:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to delete user" });
    }
  });

  // ===== USER PROFILE ROUTES =====

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
        calendlyLink: true,
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

  // ===== USER NOTIFICATION PREFERENCES ROUTES =====

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

  // ===== FALLBACK USER ROUTES =====

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

      await storage.setFallbackUser(userId);
      
      // Refetch the user to get the updated fallback status
      const fallbackUser = await storage.getUser(userId);
      if (!fallbackUser) {
        return res.status(404).json({ message: "User not found after update" });
      }

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
}
