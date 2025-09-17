import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import Papa from "papaparse";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, type AuthenticatedRequest } from "./auth";
import { sendTaskAssignmentEmail } from "./emailService";
import {
  insertUserSchema,
  insertKanbanStageSchema,
  insertChangeReasonSchema,
  updateProjectStatusSchema,
  csvProjectSchema,
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
  const resolveEffectiveUser = async (req: AuthenticatedRequest, res: any, next: any) => {
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
      console.error("Error resolving effective user:", error);
      next();
    }
  };

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, resolveEffectiveUser, async (req: AuthenticatedRequest, res) => {
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
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Helper function to check admin role (must be real admin, not impersonated)
  const requireAdmin = async (req: AuthenticatedRequest, res: any, next: any) => {
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
  const requireManager = async (req: AuthenticatedRequest, res: any, next: any) => {
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
  app.post("/api/bootstrap-admin", async (req, res) => {
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
      console.error("Error creating bootstrap admin:", error);
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
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // User management routes
  app.get("/api/users", isAuthenticated, resolveEffectiveUser, requireManager, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Strip password hash from response for security
      const sanitizedUsers = users.map(({ passwordHash, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req, res) => {
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
      console.error("Error creating user:", error);
      res.status(400).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req, res) => {
    try {
      const { password, ...userData } = req.body;
      
      // SECURITY: Explicitly remove passwordHash from request to prevent injection
      delete userData.passwordHash;
      
      // Create safe schema that excludes passwordHash
      const safeUserSchema = insertUserSchema.omit({ passwordHash: true }).partial();
      const validUserData = safeUserSchema.parse(userData);
      
      let updateData = { ...validUserData };
      
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
      console.error("Error updating user:", error);
      res.status(400).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(400).json({ message: "Failed to delete user" });
    }
  });

  // User impersonation routes (admin only)
  app.post("/api/auth/impersonate/:userId", isAuthenticated, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const adminUserId = req.user!.id;
      const targetUserId = req.params.userId;

      await storage.startImpersonation(adminUserId, targetUserId);
      res.json({ message: "Impersonation started successfully" });
    } catch (error) {
      console.error("Error starting impersonation:", error);
      res.status(400).json({ message: error.message || "Failed to start impersonation" });
    }
  });

  app.delete("/api/auth/impersonate", isAuthenticated, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const adminUserId = req.user!.id;
      await storage.stopImpersonation(adminUserId);
      res.json({ message: "Impersonation stopped successfully" });
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      res.status(400).json({ message: "Failed to stop impersonation" });
    }
  });

  app.get("/api/auth/impersonation-state", isAuthenticated, requireAdmin, async (req: AuthenticatedRequest, res) => {
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
  app.get("/api/projects", isAuthenticated, resolveEffectiveUser, async (req: AuthenticatedRequest, res) => {
    try {
      const effectiveUserId = req.user.effectiveUserId;
      const effectiveRole = req.user.effectiveRole;
      
      if (!effectiveUserId || !effectiveRole) {
        return res.status(404).json({ message: "User not found" });
      }

      const projects = await storage.getProjectsByUser(effectiveUserId, effectiveRole);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, resolveEffectiveUser, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.patch("/api/projects/:id/status", isAuthenticated, resolveEffectiveUser, async (req: AuthenticatedRequest, res) => {
    try {
      const effectiveUserId = req.user.effectiveUserId;
      const effectiveRole = req.user.effectiveRole;
      
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
      console.error("Error updating project status:", error);
      if (error.name === 'ZodError') {
        console.error("Validation errors:", error.issues);
        res.status(400).json({ message: "Validation failed", errors: error.issues });
      } else if (error.message && (error.message.includes("Invalid project status") || error.message.includes("not found"))) {
        // Handle validation errors from validateProjectStatus and stage lookup errors
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to update project status" });
      }
    }
  });

  // CSV upload route
  app.post("/api/projects/upload", isAuthenticated, requireAdmin, upload.single('csvFile'), async (req: AuthenticatedRequest, res) => {
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
          });
          validatedProjects.push(projectData);
        } catch (error) {
          errors.push(`Row ${i + 2}: ${error.message}`);
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
      
      res.json({ 
        message: `Successfully processed CSV upload`,
        summary: result.summary,
        createdProjects: result.createdProjects,
        archivedProjects: result.archivedProjects,
        details: {
          totalRows: result.summary.totalRows,
          newProjectsCreated: result.summary.newProjectsCreated,
          existingProjectsArchived: result.summary.existingProjectsArchived,
          clientsProcessed: result.summary.clientsProcessed
        }
      });
    } catch (error) {
      console.error("Error uploading CSV:", error);
      res.status(500).json({ message: "Failed to upload CSV" });
    }
  });

  // Configuration routes
  app.get("/api/config/stages", isAuthenticated, async (req, res) => {
    try {
      const stages = await storage.getAllKanbanStages();
      res.json(stages);
    } catch (error) {
      console.error("Error fetching stages:", error);
      res.status(500).json({ message: "Failed to fetch stages" });
    }
  });

  app.post("/api/config/stages", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const stageData = insertKanbanStageSchema.parse(req.body);
      const stage = await storage.createKanbanStage(stageData);
      res.json(stage);
    } catch (error) {
      console.error("Error creating stage:", error);
      res.status(400).json({ message: "Failed to create stage" });
    }
  });

  app.patch("/api/config/stages/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const stage = await storage.updateKanbanStage(req.params.id, req.body);
      res.json(stage);
    } catch (error) {
      console.error("Error updating stage:", error);
      
      // Check if this is a validation error about projects using the stage
      if (error instanceof Error && error.message.includes("Cannot rename stage")) {
        return res.status(409).json({ 
          message: error.message,
          code: "STAGE_IN_USE"
        });
      }
      
      if (error instanceof Error && error.message.includes("Stage not found")) {
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
      if (error instanceof Error && error.message.includes("Cannot delete stage")) {
        return res.status(409).json({ 
          message: error.message,
          code: "STAGE_IN_USE"
        });
      }
      
      if (error instanceof Error && error.message.includes("Stage not found")) {
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
      res.status(400).json({ message: "Failed to create change reason" });
    }
  });

  app.patch("/api/config/reasons/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const reason = await storage.updateChangeReason(req.params.id, req.body);
      res.json(reason);
    } catch (error) {
      console.error("Error updating change reason:", error);
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
