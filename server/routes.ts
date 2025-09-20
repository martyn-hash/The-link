import type { Express, Response, NextFunction, RequestHandler } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import Papa from "papaparse";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, type AuthenticatedRequest } from "./auth";
import { sendTaskAssignmentEmail } from "./emailService";
import { z } from "zod";
import {
  insertUserSchema,
  insertKanbanStageSchema,
  updateKanbanStageSchema,
  insertChangeReasonSchema,
  updateChangeReasonSchema,
  insertProjectTypeSchema,
  updateProjectTypeSchema,
  insertStageReasonMapSchema,
  insertReasonCustomFieldSchema,
  updateReasonCustomFieldSchema,
  insertReasonFieldResponseSchema,
  insertStageApprovalSchema,
  updateStageApprovalSchema,
  insertStageApprovalFieldSchema,
  updateStageApprovalFieldSchema,
  insertStageApprovalResponseSchema,
  updateProjectStatusSchema,
  updateProjectSchema,
  csvProjectSchema,
  insertUserNotificationPreferencesSchema,
  updateUserNotificationPreferencesSchema,
  type User,
} from "@shared/schema";

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Middleware to resolve effective user (for impersonation)
  const resolveEffectiveUser = async (req: any, res: any, next: any) => {
    try {
      if (req.user && req.user.id) {
        const originalUserId = req.user.id;
        const originalUser = await storage.getUser(originalUserId);
        
        if (originalUser && originalUser.role === 'admin') {
          const effectiveUser = await storage.getEffectiveUser(originalUserId);
          if (effectiveUser && effectiveUser.id !== originalUserId) {
            // Replace user context with impersonated user
            req.user.effectiveUser = effectiveUser;
            req.user.effectiveUserId = effectiveUser.id;
            req.user.effectiveRole = effectiveUser.role;
            req.user.isImpersonating = true;
          } else {
            // No impersonation, use original user
            req.user.effectiveUser = originalUser;
            req.user.effectiveUserId = originalUserId;
            req.user.effectiveRole = originalUser.role;
            req.user.isImpersonating = false;
          }
        } else if (originalUser) {
          // Non-admin user, no impersonation possible
          req.user.effectiveUser = originalUser;
          req.user.effectiveUserId = originalUserId;
          req.user.effectiveRole = originalUser.role;
          req.user.isImpersonating = false;
        }
      }
      next();
    } catch (error) {
      console.error("Error resolving effective user:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      next();
    }
  };

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const originalUserId = req.user!.id;
      const effectiveUser = req.user!.effectiveUser;
      
      if (!effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Strip password hash from response for security
      const { passwordHash, ...sanitizedUser } = effectiveUser;

      // Include impersonation metadata if admin is impersonating
      if (req.user!.isImpersonating) {
        const impersonationState = await storage.getImpersonationState(originalUserId);
        return res.json({
          ...sanitizedUser,
          _impersonationState: impersonationState
        });
      }

      res.json(sanitizedUser);
    } catch (error) {
      console.error("Error fetching user:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Helper function to check admin role (must be real admin, not impersonated)
  const requireAdmin = async (req: any, res: any, next: any) => {
    try {
      const originalUserId = req.user!.id;
      const originalUser = await storage.getUser(originalUserId);
      if (!originalUser || originalUser.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      next();
    } catch (error) {
      return res.status(500).json({ message: "Authorization error" });
    }
  };

  // Helper function to check manager+ role (uses effective user for proper testing)
  const requireManager = async (req: any, res: any, next: any) => {
    try {
      const effectiveRole = req.user!.effectiveRole;
      if (!effectiveRole || !['admin', 'manager'].includes(effectiveRole)) {
        return res.status(403).json({ message: "Manager access required" });
      }
      next();
    } catch (error) {
      return res.status(500).json({ message: "Authorization error" });
    }
  };

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
        lastName: lastName?.trim(),
        role: 'admin'
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
          role: user.role
        }
      });
    } catch (error) {
      console.error("Error resetting password:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // User management routes
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

  // Client management routes
  app.get("/api/clients", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const clients = await storage.getAllClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(500).json({ message: "Failed to fetch clients" });
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
      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted successfully" });
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

  // User impersonation routes (admin only)
  app.post("/api/auth/impersonate/:userId", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
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
      res.json({ message: "Impersonation stopped successfully" });
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

  // Project routes
  app.get("/api/projects", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveRole = req.user?.effectiveRole;
      
      if (!effectiveUserId || !effectiveRole) {
        return res.status(404).json({ message: "User not found" });
      }

      // Extract query parameters for filtering
      const filters = {
        month: req.query.month as string | undefined,
        archived: req.query.archived === 'true' ? true : req.query.archived === 'false' ? false : undefined,
        inactive: req.query.inactive === 'true' ? true : req.query.inactive === 'false' ? false : undefined,
      };

      const projects = await storage.getProjectsByUser(effectiveUserId, effectiveRole, filters);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Fetch progress metrics for the project
      const progressMetrics = await storage.getProjectProgressMetrics(req.params.id);

      // Return project data with progress metrics included
      res.json({
        ...project,
        progressMetrics,
      });
    } catch (error) {
      console.error("Error fetching project:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.patch("/api/projects/:id/status", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveRole = req.user?.effectiveRole;
      
      if (!effectiveUserId || !effectiveRole) {
        return res.status(404).json({ message: "User not found" });
      }

      const updateData = updateProjectStatusSchema.parse({
        ...req.body,
        projectId: req.params.id,
      });

      // Verify user has permission to update this project
      const project = await storage.getProject(updateData.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if effective user is authorized to move this project
      const canUpdate = 
        effectiveRole === 'admin' ||
        effectiveRole === 'manager' ||
        project.currentAssigneeId === effectiveUserId ||
        (effectiveRole === 'client_manager' && project.clientManagerId === effectiveUserId) ||
        (effectiveRole === 'bookkeeper' && project.bookkeeperId === effectiveUserId);

      if (!canUpdate) {
        return res.status(403).json({ message: "Not authorized to update this project" });
      }

      // Validate stage-reason mapping is valid
      const stageValidation = await storage.validateProjectStatus(updateData.newStatus);
      if (!stageValidation.isValid) {
        return res.status(400).json({ message: stageValidation.reason || "Invalid project status" });
      }

      // Get the stage to find change reason
      const stages = await storage.getAllKanbanStages();
      const targetStage = stages.find(stage => stage.name === updateData.newStatus);
      if (!targetStage) {
        return res.status(400).json({ message: "Invalid project status" });
      }

      // Get the change reason by name first
      const reasons = await storage.getAllChangeReasons();
      const changeReason = reasons.find(reason => reason.reason === updateData.changeReason);
      if (!changeReason) {
        return res.status(400).json({ message: "Invalid change reason" });
      }

      // Validate stage-reason mapping using reasonId
      const mappingValidation = await storage.validateStageReasonMapping(targetStage.id, changeReason.id);
      if (!mappingValidation.isValid) {
        return res.status(400).json({ message: mappingValidation.reason || "Invalid change reason for this stage" });
      }

      // Validate required fields for this change reason
      const fieldValidation = await storage.validateRequiredFields(changeReason.id, updateData.fieldResponses);
      if (!fieldValidation.isValid) {
        return res.status(400).json({ 
          message: fieldValidation.reason || "Required fields are missing",
          missingFields: fieldValidation.missingFields 
        });
      }

      // SECURITY: Stage approval validation before allowing status change
      if (targetStage.stageApprovalId) {
        // This stage requires approval - validate approval responses exist and are valid
        const existingResponses = await storage.getStageApprovalResponsesByProjectId(updateData.projectId);
        
        // Get the stage approval fields to understand what's required
        const approvalFields = await storage.getStageApprovalFieldsByApprovalId(targetStage.stageApprovalId);

        // Filter responses that belong to this specific stage approval by fieldId
        const fieldIds = new Set(approvalFields.map(f => f.id));
        const stageApprovalResponses = existingResponses.filter(r => fieldIds.has(r.fieldId));
        
        if (approvalFields.length === 0) {
          // No fields configured for this approval, proceed normally
        } else {
          // Convert to format expected by validation method
          const responsesForValidation = stageApprovalResponses.map(response => ({
            fieldId: response.fieldId,
            projectId: response.projectId,
            valueBoolean: response.valueBoolean,
            valueNumber: response.valueNumber,
            valueLongText: response.valueLongText,
          }));

          // Validate the approval responses
          const approvalValidation = await storage.validateStageApprovalResponses(
            targetStage.stageApprovalId,
            responsesForValidation
          );

          if (!approvalValidation.isValid) {
            return res.status(400).json({
              message: `Stage approval validation failed: ${approvalValidation.reason}`,
              failedFields: approvalValidation.failedFields,
              stageApprovalRequired: true
            });
          }
        }
      }

      const updatedProject = await storage.updateProjectStatus(updateData, effectiveUserId);

      // Send email notification to new assignee
      const newAssigneeId = updatedProject.currentAssigneeId;
      if (newAssigneeId && newAssigneeId !== effectiveUserId) {
        const assignee = await storage.getUser(newAssigneeId);
        if (assignee?.email) {
          await sendTaskAssignmentEmail(
            assignee.email,
            `${assignee.firstName} ${assignee.lastName}`,
            project.description,
            project.client.name,
            updateData.newStatus
          );
        }
      }

      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating project status:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      if (error instanceof Error && error.name === 'ZodError') {
        console.error("Validation errors:", (error as any).issues);
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else if (error instanceof Error && error.message && (error.message.includes("Invalid project status") || error.message.includes("not found"))) {
        // Handle validation errors from validateProjectStatus and stage lookup errors
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to update project status" });
      }
    }
  });

  // General project update route
  app.patch("/api/projects/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveRole = req.user?.effectiveRole;
      
      if (!effectiveUserId || !effectiveRole) {
        return res.status(404).json({ message: "User not found" });
      }

      // SECURITY FIX: Only allow updating the inactive field to prevent privilege escalation
      // Create constrained schema that only allows inactive field updates
      const inactiveOnlyUpdateSchema = z.object({ 
        inactive: z.boolean() 
      });
      const updateData = inactiveOnlyUpdateSchema.parse(req.body);
      
      // Verify user has permission to update this project
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if effective user is authorized to update this project
      const canUpdate = 
        effectiveRole === 'admin' ||
        effectiveRole === 'manager' ||
        project.currentAssigneeId === effectiveUserId ||
        (effectiveRole === 'client_manager' && project.clientManagerId === effectiveUserId) ||
        (effectiveRole === 'bookkeeper' && project.bookkeeperId === effectiveUserId);

      if (!canUpdate) {
        return res.status(403).json({ message: "Not authorized to update this project" });
      }

      // Update the project
      const updatedProject = await storage.updateProject(req.params.id, updateData);
      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating project:", error instanceof Error ? error.message : error);
      if (error instanceof Error && error.name === 'ZodError') {
        console.error("Validation errors:", (error as any).issues);
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else if (error instanceof Error && error.message && error.message.includes("not found")) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to update project" });
      }
    }
  });

  // CSV upload route
  app.post("/api/projects/upload", isAuthenticated, requireAdmin, upload.single('csvFile'), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No CSV file uploaded" });
      }

      const csvText = req.file.buffer.toString('utf-8');
      const parseResult = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
      });

      if (parseResult.errors.length > 0) {
        return res.status(400).json({ 
          message: "CSV parsing errors", 
          errors: parseResult.errors 
        });
      }

      // Validate and transform CSV data
      const validatedProjects = [];
      const errors = [];

      for (let i = 0; i < parseResult.data.length; i++) {
        try {
          const row = parseResult.data[i] as any;
          const projectData = csvProjectSchema.parse({
            clientName: row['Client Name'] || row.clientName,
            projectDescription: row['Project Description'] || row.projectDescription,
            bookkeeperEmail: row['Bookkeeper Email'] || row.bookkeeperEmail,
            clientManagerEmail: row['Client Manager Email'] || row.clientManagerEmail,
            priority: row['Priority'] || row.priority || 'medium',
            dueDate: row['Due Date'] || row.dueDate,
            projectMonth: row['Project Month'] || row.projectMonth,
          });
          validatedProjects.push(projectData);
        } catch (error) {
          errors.push(`Row ${i + 2}: ${error instanceof Error ? (error instanceof Error ? error.message : null) : String(error)}`);
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({ 
          message: "Validation errors in CSV", 
          errors 
        });
      }

      const result = await storage.createProjectsFromCSV(validatedProjects);
      
      if (!result.success) {
        return res.status(400).json({ 
          message: "Failed to process CSV upload",
          errors: result.errors
        });
      }
      
      // Send bulk project assignment notifications if projects were created
      if (result.createdProjects && result.createdProjects.length > 0) {
        try {
          await storage.sendBulkProjectAssignmentNotifications(result.createdProjects);
          console.log(`Sent bulk project notifications for ${result.createdProjects.length} newly created projects`);
        } catch (notificationError) {
          console.error("Failed to send bulk project notifications:", notificationError);
          // Don't fail the entire upload if notifications fail - projects were successfully created
        }
      }
      
      res.json({ 
        message: `Successfully processed CSV upload`,
        summary: result.summary,
        createdProjects: result.createdProjects,
        archivedProjects: result.archivedProjects,
        alreadyExistsCount: result.summary.alreadyExistsCount,
        details: {
          totalRows: result.summary.totalRows,
          newProjectsCreated: result.summary.newProjectsCreated,
          existingProjectsArchived: result.summary.existingProjectsArchived,
          alreadyExistsCount: result.summary.alreadyExistsCount,
          clientsProcessed: result.summary.clientsProcessed
        }
      });
    } catch (error) {
      console.error("Error uploading CSV:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(500).json({ message: "Failed to upload CSV" });
    }
  });

  // Configuration routes
  app.get("/api/config/stages", isAuthenticated, async (req: any, res: any) => {
    try {
      const stages = await storage.getAllKanbanStages();
      res.json(stages);
    } catch (error) {
      console.error("Error fetching stages:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(500).json({ message: "Failed to fetch stages" });
    }
  });

  app.post("/api/config/stages", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const stageData = insertKanbanStageSchema.parse(req.body);
      const stage = await storage.createKanbanStage(stageData);
      res.json(stage);
    } catch (error) {
      console.error("Error creating stage:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      
      // Handle Zod validation errors with proper error details
      if (error instanceof Error && error.name === 'ZodError') {
        console.error("Validation errors:", (error as any).issues);
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: (error as any).issues 
        });
      }
      
      res.status(400).json({ message: "Failed to create stage" });
    }
  });

  app.patch("/api/config/stages/:id", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const updateData = updateKanbanStageSchema.parse(req.body);
      const stage = await storage.updateKanbanStage(req.params.id, updateData);
      res.json(stage);
    } catch (error) {
      console.error("Error updating stage:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      
      // Check if this is a validation error about projects using the stage
      if (error instanceof Error && error instanceof Error && error.message && error.message.includes("Cannot rename stage")) {
        return res.status(409).json({ 
          message: (error instanceof Error ? error.message : null),
          code: "STAGE_IN_USE"
        });
      }
      
      if (error instanceof Error && error instanceof Error && error.message && error.message.includes("Stage not found")) {
        return res.status(404).json({ message: "Stage not found" });
      }
      
      res.status(400).json({ message: "Failed to update stage" });
    }
  });

  app.delete("/api/config/stages/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await storage.deleteKanbanStage(req.params.id);
      res.json({ message: "Stage deleted successfully" });
    } catch (error) {
      console.error("Error deleting stage:", error);
      
      // Check if this is a validation error about projects using the stage
      if (error instanceof Error && error instanceof Error && error.message && error.message.includes("Cannot delete stage")) {
        return res.status(409).json({ 
          message: (error instanceof Error ? error.message : null),
          code: "STAGE_IN_USE"
        });
      }
      
      if (error instanceof Error && error instanceof Error && error.message && error.message.includes("Stage not found")) {
        return res.status(404).json({ message: "Stage not found" });
      }
      
      res.status(400).json({ message: "Failed to delete stage" });
    }
  });

  app.get("/api/config/reasons", isAuthenticated, async (req, res) => {
    try {
      const reasons = await storage.getAllChangeReasons();
      res.json(reasons);
    } catch (error) {
      console.error("Error fetching change reasons:", error);
      res.status(500).json({ message: "Failed to fetch change reasons" });
    }
  });

  app.post("/api/config/reasons", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const reasonData = insertChangeReasonSchema.parse(req.body);
      const reason = await storage.createChangeReason(reasonData);
      res.json(reason);
    } catch (error) {
      console.error("Error creating change reason:", error);
      
      // Check for Zod validation errors
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      }
      
      // Check for unique constraint violation
      if (error instanceof Error && (error as any).code === '23505' && (error as any).constraint_name === 'unique_reason') {
        return res.status(409).json({ 
          message: `A reason with the name "${req.body.reason}" already exists. Please choose a different name.`,
          code: "DUPLICATE_REASON_NAME"
        });
      }
      
      // Check for duplicate key error (alternative constraint format)
      if (error instanceof Error && error.message && error.message.includes('duplicate key value violates unique constraint')) {
        if (error.message.includes('unique_reason') || error.message.includes('reason_unique')) {
          return res.status(409).json({ 
            message: `A reason with the name "${req.body.reason}" already exists. Please choose a different name.`,
            code: "DUPLICATE_REASON_NAME"
          });
        }
      }
      
      res.status(400).json({ message: "Failed to create change reason" });
    }
  });

  app.patch("/api/config/reasons/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const reasonData = updateChangeReasonSchema.parse(req.body);
      const reason = await storage.updateChangeReason(req.params.id, reasonData);
      res.json(reason);
    } catch (error) {
      console.error("Error updating change reason:", error);
      
      // Check for unique constraint violation
      if (error instanceof Error && (error as any).code === '23505' && (error as any).constraint_name === 'unique_reason') {
        return res.status(409).json({ 
          message: `A reason with the name "${req.body.reason}" already exists. Please choose a different name.`,
          code: "DUPLICATE_REASON_NAME"
        });
      }
      
      // Check for duplicate key error (alternative constraint format)
      if (error instanceof Error && error.message && error.message.includes('duplicate key value violates unique constraint')) {
        if (error.message.includes('unique_reason') || error.message.includes('reason_unique')) {
          return res.status(409).json({ 
            message: `A reason with the name "${req.body.reason}" already exists. Please choose a different name.`,
            code: "DUPLICATE_REASON_NAME"
          });
        }
      }
      
      // Check for not found error
      if (error instanceof Error && error.message && error.message.includes('not found')) {
        return res.status(404).json({ message: "Change reason not found" });
      }
      
      res.status(400).json({ message: "Failed to update change reason" });
    }
  });

  app.delete("/api/config/reasons/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await storage.deleteChangeReason(req.params.id);
      res.json({ message: "Change reason deleted successfully" });
    } catch (error) {
      console.error("Error deleting change reason:", error);
      res.status(400).json({ message: "Failed to delete change reason" });
    }
  });

  // Stage Approvals configuration routes
  app.get("/api/config/stage-approvals", isAuthenticated, async (req, res) => {
    try {
      const approvals = await storage.getAllStageApprovals();
      res.json(approvals);
    } catch (error) {
      console.error("Error fetching stage approvals:", error);
      res.status(500).json({ message: "Failed to fetch stage approvals" });
    }
  });

  app.post("/api/config/stage-approvals", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const approvalData = insertStageApprovalSchema.parse(req.body);
      const approval = await storage.createStageApproval(approvalData);
      res.json(approval);
    } catch (error) {
      console.error("Error creating stage approval:", error);
      
      // Check for Zod validation errors
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: (error as any).issues 
        });
      }
      
      // Check for unique constraint violation
      if (error instanceof Error && (error as any).code === '23505' && (error as any).constraint_name === 'unique_name') {
        return res.status(409).json({ 
          message: `A stage approval with the name "${req.body.name}" already exists. Please choose a different name.`,
          code: "DUPLICATE_APPROVAL_NAME"
        });
      }
      
      // Check for duplicate key error (alternative constraint format)
      if (error instanceof Error && error.message && error.message.includes('duplicate key value violates unique constraint')) {
        if (error.message.includes('unique_name') || error.message.includes('name_unique')) {
          return res.status(409).json({ 
            message: `A stage approval with the name "${req.body.name}" already exists. Please choose a different name.`,
            code: "DUPLICATE_APPROVAL_NAME"
          });
        }
      }
      
      // Check for specific storage error message
      if (error instanceof Error && error.message && error.message.includes('already exists')) {
        return res.status(409).json({ 
          message: error.message,
          code: "DUPLICATE_APPROVAL_NAME"
        });
      }
      
      res.status(400).json({ message: "Failed to create stage approval" });
    }
  });

  app.patch("/api/config/stage-approvals/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const approvalData = updateStageApprovalSchema.parse(req.body);
      const approval = await storage.updateStageApproval(req.params.id, approvalData);
      res.json(approval);
    } catch (error) {
      console.error("Error updating stage approval:", error);
      
      // Check for Zod validation errors
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: (error as any).issues 
        });
      }
      
      // Check for unique constraint violation
      if (error instanceof Error && (error as any).code === '23505' && (error as any).constraint_name === 'unique_name') {
        return res.status(409).json({ 
          message: `A stage approval with the name "${req.body.name}" already exists. Please choose a different name.`,
          code: "DUPLICATE_APPROVAL_NAME"
        });
      }
      
      // Check for duplicate key error (alternative constraint format)
      if (error instanceof Error && error.message && error.message.includes('duplicate key value violates unique constraint')) {
        if (error.message.includes('unique_name') || error.message.includes('name_unique')) {
          return res.status(409).json({ 
            message: `A stage approval with the name "${req.body.name}" already exists. Please choose a different name.`,
            code: "DUPLICATE_APPROVAL_NAME"
          });
        }
      }
      
      // Check for not found error
      if (error instanceof Error && error.message && error.message.includes('not found')) {
        return res.status(404).json({ message: "Stage approval not found" });
      }
      
      res.status(400).json({ message: "Failed to update stage approval" });
    }
  });

  app.delete("/api/config/stage-approvals/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await storage.deleteStageApproval(req.params.id);
      res.json({ message: "Stage approval deleted successfully" });
    } catch (error) {
      console.error("Error deleting stage approval:", error);
      
      // Check for not found error
      if (error instanceof Error && error.message && error.message.includes('not found')) {
        return res.status(404).json({ message: "Stage approval not found" });
      }
      
      res.status(400).json({ message: "Failed to delete stage approval" });
    }
  });

  // Stage Approval Fields configuration routes
  app.get("/api/config/stage-approval-fields", isAuthenticated, async (req, res) => {
    try {
      const fields = await storage.getAllStageApprovalFields();
      res.json(fields);
    } catch (error) {
      console.error("Error fetching stage approval fields:", error);
      res.status(500).json({ message: "Failed to fetch stage approval fields" });
    }
  });

  app.get("/api/config/stage-approvals/:approvalId/fields", isAuthenticated, async (req, res) => {
    try {
      const fields = await storage.getStageApprovalFieldsByApprovalId(req.params.approvalId);
      res.json(fields);
    } catch (error) {
      console.error("Error fetching stage approval fields for approval:", error);
      res.status(500).json({ message: "Failed to fetch stage approval fields" });
    }
  });

  app.post("/api/config/stage-approval-fields", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const fieldData = insertStageApprovalFieldSchema.parse(req.body);
      const field = await storage.createStageApprovalField(fieldData);
      res.json(field);
    } catch (error) {
      console.error("Error creating stage approval field:", error);
      
      // Check for Zod validation errors
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: (error as any).issues 
        });
      }
      
      res.status(400).json({ message: "Failed to create stage approval field" });
    }
  });

  app.patch("/api/config/stage-approval-fields/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const fieldData = updateStageApprovalFieldSchema.parse(req.body);
      const field = await storage.updateStageApprovalField(req.params.id, fieldData);
      res.json(field);
    } catch (error) {
      console.error("Error updating stage approval field:", error);
      
      // Check for Zod validation errors
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: (error as any).issues 
        });
      }
      
      // Check for not found error
      if (error instanceof Error && error.message && error.message.includes('not found')) {
        return res.status(404).json({ message: "Stage approval field not found" });
      }
      
      res.status(400).json({ message: "Failed to update stage approval field" });
    }
  });

  app.delete("/api/config/stage-approval-fields/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await storage.deleteStageApprovalField(req.params.id);
      res.json({ message: "Stage approval field deleted successfully" });
    } catch (error) {
      console.error("Error deleting stage approval field:", error);
      
      // Check for not found error
      if (error instanceof Error && error.message && error.message.includes('not found')) {
        return res.status(404).json({ message: "Stage approval field not found" });
      }
      
      res.status(400).json({ message: "Failed to delete stage approval field" });
    }
  });

  // Stage Approval Validation endpoint
  app.post("/api/config/stage-approvals/:approvalId/validate", isAuthenticated, async (req, res) => {
    try {
      // Parse request body as array of InsertStageApprovalResponse
      const responses = Array.isArray(req.body) ? req.body : [req.body];
      const validatedResponses = responses.map(response => insertStageApprovalResponseSchema.parse(response));
      
      // Call storage validation method
      const validationResult = await storage.validateStageApprovalResponses(req.params.approvalId, validatedResponses);
      
      res.json(validationResult);
    } catch (error) {
      console.error("Error validating stage approval responses:", error);
      
      // Check for Zod validation errors
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: (error as any).issues 
        });
      }
      
      res.status(400).json({ message: "Failed to validate stage approval responses" });
    }
  });

  // Stage approval responses endpoint
  app.post("/api/projects/:id/stage-approval-responses", isAuthenticated, async (req, res) => {
    try {
      const projectId = req.params.id;
      const { responses } = req.body;
      
      // Validate request body structure
      if (!responses || !Array.isArray(responses)) {
        return res.status(400).json({ message: "Invalid request: responses array required" });
      }
      
      // Validate each response with Zod schema
      const validatedResponses = responses.map(response => 
        insertStageApprovalResponseSchema.parse({
          ...response,
          projectId // Ensure projectId is set
        })
      );
      
      // Save responses to database using storage interface
      const savedResponses = [];
      for (const response of validatedResponses) {
        const saved = await storage.createStageApprovalResponse(response);
        savedResponses.push(saved);
      }
      
      res.status(200).json({ 
        message: "Stage approval responses saved successfully",
        responses: savedResponses 
      });
    } catch (error) {
      console.error("Error saving stage approval responses:", error);
      
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: (error as any).issues 
        });
      }
      
      res.status(500).json({ message: "Failed to save stage approval responses" });
    }
  });

  // Project descriptions configuration routes
  app.get("/api/config/project-descriptions", isAuthenticated, async (req, res) => {
    try {
      const descriptions = await storage.getAllProjectTypes();
      res.json(descriptions);
    } catch (error) {
      console.error("Error fetching project descriptions:", error);
      res.status(500).json({ message: "Failed to fetch project descriptions" });
    }
  });

  app.post("/api/config/project-descriptions", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const descriptionData = insertProjectTypeSchema.parse(req.body);
      const description = await storage.createProjectType(descriptionData);
      res.json(description);
    } catch (error) {
      console.error("Error creating project description:", error);
      res.status(400).json({ message: "Failed to create project description" });
    }
  });

  app.patch("/api/config/project-descriptions/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const description = await storage.updateProjectType(req.params.id, req.body);
      res.json(description);
    } catch (error) {
      console.error("Error updating project description:", error);
      
      if (error instanceof Error && error instanceof Error && error.message && error.message.includes("Project description not found")) {
        return res.status(404).json({ message: "Project description not found" });
      }
      
      res.status(400).json({ message: "Failed to update project description" });
    }
  });

  app.delete("/api/config/project-descriptions/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await storage.deleteProjectType(req.params.id);
      res.json({ message: "Project description deleted successfully" });
    } catch (error) {
      console.error("Error deleting project description:", error);
      
      if (error instanceof Error && error instanceof Error && error.message && error.message.includes("Project description not found")) {
        return res.status(404).json({ message: "Project description not found" });
      }
      
      res.status(400).json({ message: "Failed to delete project description" });
    }
  });

  // Project type management routes
  app.get("/api/config/project-types", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Extract query parameters for filtering
      const filters = {
        inactive: req.query.inactive === 'true' ? true : req.query.inactive === 'false' ? false : undefined,
      };

      const projectTypes = await storage.getAllProjectTypes();
      
      // Apply inactive filter if specified
      const filteredProjectTypes = filters.inactive !== undefined 
        ? projectTypes.filter(pt => filters.inactive ? !pt.active : pt.active)
        : projectTypes.filter(pt => pt.active); // By default, only show active project types

      res.json(filteredProjectTypes);
    } catch (error) {
      console.error("Error fetching project types:", error);
      res.status(500).json({ message: "Failed to fetch project types" });
    }
  });

  app.post("/api/config/project-types", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const projectTypeData = insertProjectTypeSchema.parse(req.body);
      const projectType = await storage.createProjectType(projectTypeData);
      res.json(projectType);
    } catch (error) {
      console.error("Error creating project type:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else if (error instanceof Error && error.message && error.message.includes("unique constraint")) {
        res.status(409).json({ message: "Project type with this name already exists" });
      } else {
        res.status(400).json({ message: "Failed to create project type" });
      }
    }
  });

  app.patch("/api/config/project-types/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const updateData = updateProjectTypeSchema.parse(req.body);
      
      // Check if we're trying to deactivate the project type
      if (updateData.active === false) {
        // Get the current project type to check if it's currently active
        const allProjectTypes = await storage.getAllProjectTypes();
        const projectType = allProjectTypes.find(pt => pt.id === req.params.id);
        
        if (!projectType) {
          return res.status(404).json({ message: "Project type not found" });
        }
        
        // Only check for active projects if we're changing from active to inactive
        if (projectType.active !== false) {
          const activeProjectCount = await storage.countActiveProjectsUsingProjectType(req.params.id);
          
          if (activeProjectCount > 0) {
            return res.status(409).json({ 
              message: `Cannot deactivate project type "${projectType.name}" because ${activeProjectCount} active project${activeProjectCount === 1 ? '' : 's'} ${activeProjectCount === 1 ? 'is' : 'are'} currently using this template. Please complete, archive, or reassign these projects before deactivating the project type.`,
              code: "PROJECTS_USING_TYPE",
              activeProjectCount,
              projectTypeName: projectType.name
            });
          }
        }
      }
      
      const updatedProjectType = await storage.updateProjectType(req.params.id, updateData);
      res.json(updatedProjectType);
    } catch (error) {
      console.error("Error updating project type:", error);
      
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else if (error instanceof Error && error.message && error.message.includes("Project type not found")) {
        res.status(404).json({ message: "Project type not found" });
      } else if (error instanceof Error && error.message && error.message.includes("unique constraint")) {
        res.status(409).json({ message: "Project type with this name already exists" });
      } else {
        res.status(400).json({ message: "Failed to update project type" });
      }
    }
  });

  app.delete("/api/config/project-types/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      await storage.deleteProjectType(req.params.id);
      res.json({ message: "Project type deleted successfully" });
    } catch (error) {
      console.error("Error deleting project type:", error);
      
      if (error instanceof Error && error.message && error.message.includes("Project type not found")) {
        res.status(404).json({ message: "Project type not found" });
      } else if (error instanceof Error && error.message && error.message.includes("cannot delete")) {
        res.status(409).json({ message: "Cannot delete project type: it is being used by existing projects" });
      } else {
        res.status(400).json({ message: "Failed to delete project type" });
      }
    }
  });

  // Project-scoped configuration routes
  app.get("/api/config/project-types/:projectTypeId/stages", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { projectTypeId } = req.params;
      const stages = await storage.getKanbanStagesByProjectTypeId(projectTypeId);
      res.json(stages);
    } catch (error) {
      console.error("Error fetching stages for project type:", error);
      res.status(500).json({ message: "Failed to fetch stages for project type" });
    }
  });

  app.get("/api/config/project-types/:projectTypeId/reasons", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { projectTypeId } = req.params;
      const reasons = await storage.getChangeReasonsByProjectTypeId(projectTypeId);
      res.json(reasons);
    } catch (error) {
      console.error("Error fetching change reasons for project type:", error);
      res.status(500).json({ message: "Failed to fetch change reasons for project type" });
    }
  });

  app.get("/api/config/project-types/:projectTypeId/stage-approvals", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { projectTypeId } = req.params;
      const stageApprovals = await storage.getStageApprovalsByProjectTypeId(projectTypeId);
      res.json(stageApprovals);
    } catch (error) {
      console.error("Error fetching stage approvals for project type:", error);
      res.status(500).json({ message: "Failed to fetch stage approvals for project type" });
    }
  });

  // Stage-Reason Mapping Routes
  app.get("/api/config/stage-reason-maps", isAuthenticated, async (req, res) => {
    try {
      const mappings = await storage.getAllStageReasonMaps();
      res.json(mappings);
    } catch (error) {
      console.error("Error fetching stage-reason mappings:", error);
      res.status(500).json({ message: "Failed to fetch stage-reason mappings" });
    }
  });

  app.post("/api/config/stage-reason-maps", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const mappingData = insertStageReasonMapSchema.parse(req.body);
      
      // Validate that the stage exists
      const stage = await storage.getStageById(mappingData.stageId);
      if (!stage) {
        return res.status(400).json({ message: "Stage not found" });
      }

      // Validate that the reason exists
      const reasons = await storage.getAllChangeReasons();
      const reason = reasons.find(r => r.id === mappingData.reasonId);
      if (!reason) {
        return res.status(400).json({ message: "Change reason not found" });
      }

      const mapping = await storage.createStageReasonMap(mappingData);
      res.json(mapping);
    } catch (error) {
      console.error("Error creating stage-reason mapping:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else if ((error instanceof Error ? error.message : null) && error instanceof Error && error.message && error.message.includes("unique constraint")) {
        res.status(409).json({ message: "Stage-reason mapping already exists" });
      } else {
        res.status(400).json({ message: "Failed to create stage-reason mapping" });
      }
    }
  });

  app.get("/api/config/stages/:stageId/reasons", isAuthenticated, async (req, res) => {
    try {
      const reasons = await storage.getValidChangeReasonsForStage(req.params.stageId);
      res.json(reasons);
    } catch (error) {
      console.error("Error fetching valid reasons for stage:", error);
      res.status(500).json({ message: "Failed to fetch valid reasons for stage" });
    }
  });

  app.delete("/api/config/stage-reason-maps/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await storage.deleteStageReasonMap(req.params.id);
      res.json({ message: "Stage-reason mapping deleted successfully" });
    } catch (error) {
      console.error("Error deleting stage-reason mapping:", error);
      if ((error instanceof Error ? error.message : null) && error instanceof Error && error.message && error.message.includes("not found")) {
        return res.status(404).json({ message: "Stage-reason mapping not found" });
      }
      res.status(400).json({ message: "Failed to delete stage-reason mapping" });
    }
  });

  // Custom Fields Routes
  app.get("/api/config/custom-fields", isAuthenticated, async (req, res) => {
    try {
      const customFields = await storage.getAllReasonCustomFields();
      res.json(customFields);
    } catch (error) {
      console.error("Error fetching custom fields:", error);
      res.status(500).json({ message: "Failed to fetch custom fields" });
    }
  });

  app.get("/api/config/reasons/:reasonId/custom-fields", isAuthenticated, async (req, res) => {
    try {
      const customFields = await storage.getReasonCustomFieldsByReasonId(req.params.reasonId);
      res.json(customFields);
    } catch (error) {
      console.error("Error fetching custom fields for reason:", error);
      res.status(500).json({ message: "Failed to fetch custom fields for reason" });
    }
  });

  app.post("/api/config/custom-fields", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const fieldData = insertReasonCustomFieldSchema.parse(req.body);
      const customField = await storage.createReasonCustomField(fieldData);
      res.json(customField);
    } catch (error) {
      console.error("Error creating custom field:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else {
        res.status(400).json({ message: "Failed to create custom field" });
      }
    }
  });

  app.patch("/api/config/custom-fields/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const fieldData = updateReasonCustomFieldSchema.parse(req.body);
      const customField = await storage.updateReasonCustomField(req.params.id, fieldData);
      res.json(customField);
    } catch (error) {
      console.error("Error updating custom field:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else if ((error instanceof Error ? error.message : null) && error instanceof Error && error.message && error.message.includes("not found")) {
        return res.status(404).json({ message: "Custom field not found" });
      } else {
        res.status(400).json({ message: "Failed to update custom field" });
      }
    }
  });

  app.delete("/api/config/custom-fields/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await storage.deleteReasonCustomField(req.params.id);
      res.json({ message: "Custom field deleted successfully" });
    } catch (error) {
      console.error("Error deleting custom field:", error);
      if ((error instanceof Error ? error.message : null) && error instanceof Error && error.message && error.message.includes("not found")) {
        return res.status(404).json({ message: "Custom field not found" });
      }
      res.status(400).json({ message: "Failed to delete custom field" });
    }
  });

  // Field Responses Routes (read-only for reports)
  app.get("/api/projects/:projectId/field-responses", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveRole = req.user?.effectiveRole;
      
      if (!effectiveUserId || !effectiveRole) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify user has permission to view this project
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if effective user is authorized to view this project
      const canView = 
        effectiveRole === 'admin' ||
        effectiveRole === 'manager' ||
        project.currentAssigneeId === effectiveUserId ||
        project.clientManagerId === effectiveUserId ||
        project.bookkeeperId === effectiveUserId;

      if (!canView) {
        return res.status(403).json({ message: "Not authorized to view this project" });
      }

      // Get project chronology to retrieve field responses
      const chronology = await storage.getProjectChronology(req.params.projectId);
      
      // For each chronology entry, get its field responses
      const chronologyWithResponses = await Promise.all(
        chronology.map(async (entry) => {
          const fieldResponses = await storage.getReasonFieldResponsesByChronologyId(entry.id);
          return {
            ...entry,
            fieldResponses
          };
        })
      );

      res.json(chronologyWithResponses);
    } catch (error) {
      console.error("Error fetching field responses for project:", error);
      res.status(500).json({ message: "Failed to fetch field responses for project" });
    }
  });

  // Test email endpoint (development only)
  if (process.env.NODE_ENV === 'development') {
    app.post("/api/test-email", isAuthenticated, requireAdmin, async (req: any, res) => {
      try {
        const { to, subject, message } = req.body;
        
        if (!to || !subject || !message) {
          return res.status(400).json({ message: "Missing required fields: to, subject, message" });
        }

        const success = await sendTaskAssignmentEmail(
          to,
          "Test User",
          message,
          "Test Client", 
          "bookkeeping_work_required"
        );

        if (success) {
          res.json({ message: "Test email sent successfully" });
        } else {
          res.status(500).json({ message: "Failed to send test email" });
        }
      } catch (error) {
        console.error("Error sending test email:", error);
        res.status(500).json({ message: "Failed to send test email" });
      }
    });
  }

  const httpServer = createServer(app);
  return httpServer;
}
