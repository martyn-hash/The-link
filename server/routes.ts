import type { Express, Response, NextFunction, RequestHandler } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import Papa from "papaparse";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, type AuthenticatedRequest } from "./auth";
import { sendTaskAssignmentEmail } from "./emailService";
import fetch from 'node-fetch';
import { companiesHouseService } from "./companies-house-service";
import { runChSync } from "./ch-sync-service";
import { runProjectScheduling, runProjectSchedulingEnhanced, getOverdueServicesAnalysis, seedTestServices, resetTestData, buildSchedulingPreview, type SchedulingRunResult } from "./project-scheduler";
import { z } from "zod";
import {
  insertUserSchema,
  insertPersonSchema,
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
  insertServiceSchema,
  updateServiceSchema,
  insertWorkRoleSchema,
  insertServiceRoleSchema,
  insertClientSchema,
  insertClientServiceSchema,
  insertClientServiceRoleAssignmentSchema,
  insertClientTagSchema,
  insertPeopleTagSchema,
  insertClientTagAssignmentSchema,
  insertPeopleTagAssignmentSchema,
  insertPeopleServiceSchema,
  type User,
} from "@shared/schema";

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

const paramClientIdSchema = z.object({ 
  clientId: z.string().min(1, "Client ID is required").uuid("Invalid client ID format") 
});

const paramServiceIdSchema = z.object({ 
  serviceId: z.string().min(1, "Service ID is required").uuid("Invalid service ID format") 
});

const paramProjectTypeIdSchema = z.object({ 
  projectTypeId: z.string().min(1, "Project type ID is required").uuid("Invalid project type ID format") 
});

const paramClientServiceIdSchema = z.object({ 
  clientServiceId: z.string().min(1, "Client service ID is required").uuid("Invalid client service ID format") 
});

const paramPeopleServiceIdSchema = z.object({ 
  peopleServiceId: z.string().min(1, "People service ID is required").uuid("Invalid people service ID format") 
});

const paramPersonIdSchema = z.object({ 
  personId: z.string().min(1, "Person ID is required") // Note: People IDs are text, not UUID in existing database
});

const paramApprovalIdSchema = z.object({ 
  approvalId: z.string().min(1, "Approval ID is required").uuid("Invalid approval ID format") 
});

// Company number validation schema
const paramCompanyNumberSchema = z.object({
  companyNumber: z.string().min(1, "Company number is required").regex(/^[A-Z0-9]{6,8}$/, "Invalid UK company number format")
});

// Helper function for parameter validation
const validateParams = <T>(schema: z.ZodSchema<T>, params: any): { success: true; data: T } | { success: false; errors: any[] } => {
  const result = schema.safeParse(params);
  return result.success 
    ? { success: true, data: result.data }
    : { success: false, errors: result.error.issues };
};

// Name parsing utilities for duplicate detection
interface ParsedName {
  firstName: string;
  lastName: string;
  fullName: string;
}

const parseFullName = (fullName: string): ParsedName => {
  const normalizedName = fullName.trim().replace(/\s+/g, ' ');
  
  // Remove common honorifics
  const cleanName = normalizedName
    .replace(/^(Mr|Mrs|Ms|Miss|Dr|Prof|Sir|Dame|Lord|Lady)\.?\s+/i, '');
  
  // Handle "LASTNAME, Firstname Middlename" format (common from Companies House)
  if (cleanName.includes(',')) {
    const parts = cleanName.split(',', 2);
    const lastName = parts[0].trim();
    const remainingNames = parts[1].trim();
    const firstName = remainingNames.split(' ')[0]; // Take first token as first name
    
    return {
      firstName: firstName,
      lastName: lastName,
      fullName: normalizedName
    };
  }
  
  // Handle "Firstname Middlename LASTNAME" format
  const nameParts = cleanName.split(' ');
  if (nameParts.length === 1) {
    // Single name - treat as first name
    return {
      firstName: nameParts[0],
      lastName: '',
      fullName: normalizedName
    };
  }
  
  // Multiple parts - last is surname, first is given name
  const lastName = nameParts[nameParts.length - 1];
  const firstName = nameParts[0];
  
  return {
    firstName: firstName,
    lastName: lastName,
    fullName: normalizedName
  };
};

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
        
        if (originalUser && originalUser.isAdmin) {
          const effectiveUser = await storage.getEffectiveUser(originalUserId);
          if (effectiveUser && effectiveUser.id !== originalUserId) {
            // Replace user context with impersonated user
            req.user.effectiveUser = effectiveUser;
            req.user.effectiveUserId = effectiveUser.id;
            req.user.effectiveIsAdmin = effectiveUser.isAdmin;
            req.user.isImpersonating = true;
          } else {
            // No impersonation, use original user
            req.user.effectiveUser = originalUser;
            req.user.effectiveUserId = originalUserId;
            req.user.effectiveIsAdmin = originalUser.isAdmin;
            req.user.isImpersonating = false;
          }
        } else if (originalUser) {
          // Non-admin user, no impersonation possible
          req.user.effectiveUser = originalUser;
          req.user.effectiveUserId = originalUserId;
          req.user.effectiveIsAdmin = originalUser.isAdmin;
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
      if (!originalUser || !originalUser.isAdmin) {
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
      const effectiveUser = req.user!.effectiveUser;
      if (!effectiveUser || (!effectiveUser.isAdmin && !effectiveUser.canSeeAdminMenu)) {
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
      const search = req.query.search as string | undefined;
      const clients = await storage.getAllClients(search);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  // GET /api/clients/:id - Get single client by ID
  app.get("/api/clients/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Validate path parameters - accept both UUID and string IDs for clients
      const clientIdSchema = z.object({ 
        id: z.string().min(1, "Client ID is required")
      });
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const { id } = paramValidation.data;
      const client = await storage.getClientById(id);
      
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  // POST /api/clients - Create new client (admin only)
  app.post("/api/clients", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const validationResult = insertClientSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid client data", 
          errors: validationResult.error.issues 
        });
      }
      
      const clientData = validationResult.data;
      const client = await storage.createClient(clientData);
      res.status(201).json(client);
    } catch (error) {
      console.error("Error creating client:", error instanceof Error ? error.message : error);
      
      // Handle duplicate name case
      if (error instanceof Error && (error.message.includes("duplicate") || error.message.includes("unique"))) {
        return res.status(409).json({ 
          message: "A client with this name already exists" 
        });
      }
      
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  // PUT /api/clients/:id - Update client (admin only)
  app.put("/api/clients/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      // Validate path parameters - accept both UUID and string IDs for clients
      const clientIdSchema = z.object({ 
        id: z.string().min(1, "Client ID is required")
      });
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const validationResult = insertClientSchema.partial().safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid client data", 
          errors: validationResult.error.issues 
        });
      }
      
      const { id } = req.params;
      const clientData = validationResult.data;
      
      // CRITICAL FIX: Check role completeness BEFORE updating client
      try {
        // Get all client services for this client
        const clientServices = await storage.getClientServicesByClientId(id);
        
        // Check role completeness for each service
        const completenessResults = [];
        for (const clientService of clientServices) {
          const completeness = await storage.validateClientServiceRoleCompleteness(
            id, 
            clientService.service.id
          );
          
          completenessResults.push({
            clientServiceId: clientService.id,
            serviceName: clientService.service.name,
            serviceId: clientService.service.id,
            isComplete: completeness.isComplete,
            missingRoles: completeness.missingRoles,
            assignedRoles: completeness.assignedRoles
          });
        }
        
        // Check if all services have complete role assignments
        const incompleteServices = completenessResults.filter(result => !result.isComplete);
        if (incompleteServices.length > 0) {
          return res.status(409).json({ 
            message: `Cannot update client: ${incompleteServices.length} service(s) have incomplete role assignments`,
            code: "INCOMPLETE_ROLE_ASSIGNMENTS",
            incompleteServices: incompleteServices.map(service => ({
              serviceName: service.serviceName,
              missingRoles: service.missingRoles.map((role: any) => role.name)
            }))
          });
        }
      } catch (completenessError) {
        console.error("Error checking role completeness:", completenessError instanceof Error ? completenessError.message : completenessError);
        // If completeness check fails, don't allow the update for safety
        return res.status(500).json({ 
          message: "Could not verify role completeness before update" 
        });
      }
      
      // Only update client AFTER validation passes
      const client = await storage.updateClient(id, clientData);
      res.json(client);
    } catch (error) {
      console.error("Error updating client:", error instanceof Error ? error.message : error);
      
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      // Handle duplicate name case
      if (error instanceof Error && (error.message.includes("duplicate") || error.message.includes("unique"))) {
        return res.status(409).json({ 
          message: "A client with this name already exists" 
        });
      }
      
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  // DELETE /api/clients/:id - Delete client (admin only)
  app.delete("/api/clients/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      // Validate path parameters - accept both UUID and string IDs for clients
      const clientIdSchema = z.object({ 
        id: z.string().min(1, "Client ID is required")
      });
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const { id } = req.params;
      await storage.deleteClient(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting client:", error instanceof Error ? error.message : error);
      
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ message: "Client not found" });
        }
        if (error.message.includes("has existing projects")) {
          return res.status(409).json({ 
            message: "Cannot delete client with existing projects",
            code: "CLIENT_HAS_PROJECTS"
          });
        }
      }
      
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Person-Company many-to-many relationship API routes
  
  // GET /api/people/:personId/companies - List all companies for a person
  app.get("/api/people/:personId/companies", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramPersonIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }

      const { personId } = paramValidation.data;
      
      // Verify person exists
      const person = await storage.getPersonById(personId);
      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }

      // Get all client relationships for the person
      const allClientRelationships = await storage.getClientPeopleByPersonId(personId);
      
      // Filter to only include company clients (not individuals)
      const companyRelationships = allClientRelationships.filter(
        relationship => relationship.client.clientType === 'company'
      );
      
      res.json(companyRelationships);
    } catch (error) {
      console.error("Error fetching person companies:", error instanceof Error ? error.message : error);
      
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ message: error.message });
        }
      }
      
      res.status(500).json({ message: "Failed to fetch person companies" });
    }
  });

  // POST /api/people/:personId/companies - Link person to a company
  app.post("/api/people/:personId/companies", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramPersonIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }

      const linkCompanySchema = z.object({
        clientId: z.string().min(1, "Client ID is required").uuid("Invalid client ID format"),
        officerRole: z.string().optional(),
        isPrimaryContact: z.boolean().optional()
      });
      const bodyValidation = linkCompanySchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: bodyValidation.error.issues 
        });
      }

      const { personId } = paramValidation.data;
      const { clientId, officerRole, isPrimaryContact } = bodyValidation.data;

      // Verify person exists
      const person = await storage.getPersonById(personId);
      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }

      // Verify client exists and is a company
      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Company client not found" });
      }
      if (client.clientType !== 'company') {
        return res.status(400).json({ message: "Target client must be a company" });
      }

      const clientPerson = await storage.linkPersonToClient(clientId, personId, officerRole, isPrimaryContact);
      res.status(201).json(clientPerson);
    } catch (error) {
      console.error("Error linking person to company:", error instanceof Error ? error.message : error);
      
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes("duplicate key") || error.message.includes("already linked")) {
          return res.status(409).json({ message: "Person is already linked to this company" });
        }
        if (error.message.includes("not a company") || error.message.includes("must be")) {
          return res.status(400).json({ message: error.message });
        }
      }
      
      res.status(500).json({ message: "Failed to link person to company" });
    }
  });

  // DELETE /api/people/:personId/companies/:clientId - Unlink person from a company
  app.delete("/api/people/:personId/companies/:clientId", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(
        paramPersonIdSchema.merge(paramClientIdSchema), 
        req.params
      );
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }

      const { personId, clientId } = paramValidation.data;
      
      // Verify person exists
      const person = await storage.getPersonById(personId);
      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }

      // Verify client exists
      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Company client not found" });
      }

      await storage.unlinkPersonFromClient(clientId, personId);
      res.status(204).send();
    } catch (error) {
      console.error("Error unlinking person from company:", error instanceof Error ? error.message : error);
      
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes("not linked") || error.message.includes("no relationship")) {
          return res.status(404).json({ message: "Person is not linked to this company" });
        }
      }
      
      res.status(500).json({ message: "Failed to unlink person from company" });
    }
  });

  // POST /api/people/:personId/convert-to-company-client - Convert individual client to company client
  app.post("/api/people/:personId/convert-to-company-client", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramPersonIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }

      const conversionSchema = z.object({
        companyData: insertClientSchema.partial(),
        oldIndividualClientId: z.string().uuid().optional()
      });
      const bodyValidation = conversionSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: bodyValidation.error.issues 
        });
      }

      const { personId } = paramValidation.data;
      const { companyData, oldIndividualClientId } = bodyValidation.data;

      const result = await storage.convertIndividualToCompanyClient(personId, companyData, oldIndividualClientId);
      res.json(result);
    } catch (error) {
      console.error("Error converting individual to company client:", error instanceof Error ? error.message : error);
      
      if (error instanceof Error) {
        if (error.message.includes("not found") || error.message.includes("required")) {
          return res.status(400).json({ message: error.message });
        }
        if (error.message.includes("duplicate") || error.message.includes("already exists") || error.message.includes("unique")) {
          return res.status(409).json({ message: "Company with this name or number already exists" });
        }
      }
      
      res.status(500).json({ message: "Failed to convert individual to company client" });
    }
  });

  // Companies House API routes
  
  // GET /api/companies-house/search - Search for companies
  app.get("/api/companies-house/search", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { q: query, itemsPerPage = 20 } = req.query;
      
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ message: "Search query 'q' is required" });
      }
      
      const parsedItemsPerPage = typeof itemsPerPage === 'string' ? parseInt(itemsPerPage, 10) : itemsPerPage;
      if (isNaN(parsedItemsPerPage) || parsedItemsPerPage < 1 || parsedItemsPerPage > 100) {
        return res.status(400).json({ message: "itemsPerPage must be between 1 and 100" });
      }
      
      const companyData = await companiesHouseService.searchCompanies(query.trim(), parsedItemsPerPage);
      res.json({
        items: companyData,
        total_results: companyData.length,
        items_per_page: parsedItemsPerPage
      });
    } catch (error) {
      console.error("Error searching Companies House:", error instanceof Error ? error.message : error);
      
      if (error instanceof Error) {
        if (error.message.includes("404") || error.message.includes("not found")) {
          return res.status(404).json({ message: "No companies found" });
        }
        if (error.message.includes("API key")) {
          return res.status(500).json({ message: "Companies House service unavailable" });
        }
      }
      
      res.status(500).json({ message: "Failed to search companies" });
    }
  });

  // GET /api/companies-house/company/:companyNumber - Get full company profile
  app.get("/api/companies-house/company/:companyNumber", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramCompanyNumberSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const { companyNumber } = paramValidation.data;
      const companyData = await companiesHouseService.getCompanyProfile(companyNumber);
      res.json(companyData);
    } catch (error) {
      console.error("Error fetching company profile:", error instanceof Error ? error.message : error);
      
      if (error instanceof Error) {
        if (error.message.includes("404") || error.message.includes("not found")) {
          return res.status(404).json({ message: "Company not found" });
        }
        if (error.message.includes("API key")) {
          return res.status(500).json({ message: "Companies House service unavailable" });
        }
      }
      
      res.status(500).json({ message: "Failed to fetch company profile" });
    }
  });

  // GET /api/companies-house/company/:companyNumber/officers - Get company officers
  app.get("/api/companies-house/company/:companyNumber/officers", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramCompanyNumberSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const { companyNumber } = paramValidation.data;
      const allOfficersData = await companiesHouseService.getCompanyOfficers(companyNumber);
      
      // Filter for directors only (not resigned officers) - same logic as client creation
      const activeDirectors = (allOfficersData || []).filter((officer: any) => 
        officer.officer_role && 
        officer.officer_role.toLowerCase().includes('director') &&
        !officer.resigned_on // Only active directors
      );
      
      // Return in expected format { officers: [...] }
      res.json({ officers: activeDirectors });
    } catch (error) {
      console.error("Error fetching company officers:", error instanceof Error ? error.message : error);
      
      if (error instanceof Error) {
        if (error.message.includes("404") || error.message.includes("not found")) {
          return res.status(404).json({ message: "Company officers not found" });
        }
        if (error.message.includes("API key")) {
          return res.status(500).json({ message: "Companies House service unavailable" });
        }
      }
      
      res.status(500).json({ message: "Failed to fetch company officers" });
    }
  });

  // POST /api/clients/from-companies-house - Create client from Companies House data
  app.post("/api/clients/from-companies-house", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      // Validate request body
      const bodySchema = z.object({
        companyNumber: z.string().min(1, "Company number is required").regex(/^[A-Z0-9]{6,8}$/, "Invalid UK company number format"),
        selectedOfficers: z.array(z.number().int().min(0)).optional().default([]),
        officerDecisions: z.record(z.object({
          action: z.enum(['create', 'link']),
          personId: z.string().optional()
        })).optional()
      });
      
      const bodyValidation = bodySchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: bodyValidation.error.issues 
        });
      }
      
      const { companyNumber, selectedOfficers, officerDecisions } = bodyValidation.data;
      
      // Fetch company data from Companies House
      const companyData = await companiesHouseService.getCompanyProfile(companyNumber);
      
      // Always fetch all officers to save directors automatically
      const allOfficersData = await companiesHouseService.getCompanyOfficers(companyNumber);
      console.log(`Fetched ${allOfficersData?.length || 0} officers for company ${companyNumber}`);
      
      // Filter for directors only (not resigned officers)
      const directors = (allOfficersData || []).filter((officer: any) => 
        officer.officer_role && 
        officer.officer_role.toLowerCase().includes('director') &&
        !officer.resigned_on // Only active directors
      );
      console.log(`Found ${directors.length} active directors to save`);
      
      // Transform CH data to internal client format
      const clientData = companiesHouseService.transformCompanyToClient(companyData);
      
      // Create or update client with CH data
      const client = await storage.upsertClientFromCH(clientData);
      
      // Process officers based on user decisions or fallback to selected officers
      const createdPeople = [];
      
      if (officerDecisions && Object.keys(officerDecisions).length > 0) {
        // User made decisions - process each decision
        for (const [indexStr, decision] of Object.entries(officerDecisions)) {
          const index = parseInt(indexStr);
          const officer = directors[index];
          
          if (!officer) {
            console.warn(`Officer at index ${index} not found`);
            continue;
          }
          
          try {
            let person;
            
            if (decision.action === 'link' && decision.personId) {
              // Link to existing person
              const existingPerson = await storage.getPersonById(decision.personId);
              if (!existingPerson) {
                console.warn(`Person ${decision.personId} not found, creating new person instead`);
                const personData = companiesHouseService.transformOfficerToPerson(officer, companyNumber);
                person = await storage.createPerson(personData);
              } else {
                person = existingPerson;
              }
            } else {
              // Create new person
              const personData = companiesHouseService.transformOfficerToPerson(officer, companyNumber);
              person = await storage.createPerson(personData);
            }
            
            // Link person to client with officer role
            await storage.linkPersonToClient(
              client.id, 
              person.id, 
              officer.officer_role,
              false // Not primary contact by default
            );
            
            createdPeople.push({
              ...person,
              officerRole: officer.officer_role
            });
          } catch (personError) {
            console.warn(`Failed to process officer ${officer.name}:`, personError);
            // Continue with other officers
          }
        }
      } else {
        // Fallback: automatic processing for backward compatibility
        for (const officer of directors) {
          try {
            const personData = companiesHouseService.transformOfficerToPerson(officer, companyNumber);
            
            // Create or update person using automatic upsert
            const person = await storage.upsertPersonFromCH(personData);
            
            // Link person to client with officer role
            await storage.linkPersonToClient(
              client.id, 
              person.id, 
              officer.officer_role,
              false // Not primary contact by default
            );
            
            createdPeople.push({
              ...person,
              officerRole: officer.officer_role
            });
          } catch (personError) {
            console.warn(`Failed to create person for officer ${officer.name}:`, personError);
            // Continue with other officers
          }
        }
      }
      
      // Return client with related people
      const clientWithPeople = await storage.getClientWithPeople(client.id);
      
      res.status(201).json({
        client: clientWithPeople,
        message: `Created client "${client.name}" with ${createdPeople.length} associated person(s)`
      });
      
    } catch (error) {
      console.error("Error creating client from Companies House:", error instanceof Error ? error.message : error);
      
      if (error instanceof Error) {
        if (error.message.includes("404") || error.message.includes("not found")) {
          return res.status(404).json({ message: "Company not found" });
        }
        if (error.message.includes("API key")) {
          return res.status(500).json({ message: "Companies House service unavailable" });
        }
        if (error.message.includes("duplicate") || error.message.includes("unique")) {
          return res.status(409).json({ message: "Client with this company number already exists" });
        }
      }
      
      res.status(500).json({ message: "Failed to create client from Companies House data" });
    }
  });

  // POST /api/clients/individual - Create individual client with person
  app.post("/api/clients/individual", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      // Validate request body
      const bodySchema = z.object({
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
        email: z.string().email("Valid email address is required"),
        address: z.object({
          line1: z.string().min(1, "Address line 1 is required"),
          line2: z.string().optional(),
          city: z.string().min(1, "Town/City is required"),
          county: z.string().optional(),
          postcode: z.string().min(1, "Postcode is required"),
          country: z.string().default("United Kingdom"),
        }),
      });
      
      const bodyValidation = bodySchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: bodyValidation.error.issues 
        });
      }
      
      const { firstName, lastName, email, address } = bodyValidation.data;
      
      // Create client data with formatted name and address
      const clientName = `${firstName} ${lastName} - Personal Tax Client`;
      const clientData = {
        name: clientName,
        email: email,
        clientType: 'individual' as const,
        registeredAddress1: address.line1,
        registeredAddress2: address.line2 || null,
        registeredPostcode: address.postcode,
      };
      
      // Create client
      const client = await storage.createClient(clientData);
      
      // Create person data with generated ID and address
      const personId = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const personData = {
        id: personId,
        fullName: `${firstName} ${lastName}`,
        firstName: firstName,
        lastName: lastName,
        email: email,
        addressLine1: address.line1,
        addressLine2: address.line2 || null,
        isMainContact: true,
      };
      
      // Create person
      const person = await storage.createPerson(personData);
      
      // Link person to client as main contact
      await storage.linkPersonToClient(
        client.id, 
        person.id, 
        'Personal Tax Client', // Role description
        true // Is primary contact
      );
      
      // Return client and person data
      res.status(201).json({
        client: client,
        person: person,
        message: `Created individual client "${clientName}" with associated person`
      });
      
    } catch (error) {
      console.error("Error creating individual client:", error instanceof Error ? error.message : error);
      
      // Handle duplicate name case
      if (error instanceof Error && (error.message.includes("duplicate") || error.message.includes("unique"))) {
        return res.status(409).json({ 
          message: "A client with this name already exists" 
        });
      }
      
      res.status(500).json({ message: "Failed to create individual client" });
    }
  });

  // GET /api/clients/:id/services - Get all services for a client (alias for /api/client-services/client/:clientId)
  app.get("/api/clients/:id/services", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Validate client ID parameter - accept both UUID and string IDs for clients
      const paramValidation = z.object({
        id: z.string().min(1, "Client ID is required")
      }).safeParse(req.params);
      
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.error.errors 
        });
      }
      
      const { id: clientId } = paramValidation.data;

      const clientServices = await storage.getClientServicesByClientId(clientId);
      res.json(clientServices);
    } catch (error) {
      console.error("Error fetching client services:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client services" });
    }
  });

  // GET /api/clients/:id/people - Get people related to a specific client
  app.get("/api/clients/:id/people", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Validate client ID parameter - accept both UUID and string IDs for clients
      const paramValidation = z.object({
        id: z.string().min(1, "Client ID is required")
      }).safeParse(req.params);
      
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid client ID format", 
          errors: paramValidation.error.issues 
        });
      }
      
      const { id } = paramValidation.data;
      
      // Check if client exists
      const client = await storage.getClientById(id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      // Get related people with their roles, ordered by primary contact and name
      const clientPeople = await storage.getClientPeopleByClientId(id);
      
      // Sort by primary contact first, then by name
      const sortedPeople = clientPeople.sort((a, b) => {
        if (a.isPrimaryContact !== b.isPrimaryContact) {
          return b.isPrimaryContact ? 1 : -1;
        }
        return a.person.fullName.localeCompare(b.person.fullName);
      });
      
      res.status(200).json(sortedPeople);
      
    } catch (error) {
      console.error("Error fetching client people:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client people" });
    }
  });

  // POST /api/clients/:id/people - Add a new person to a client
  app.post("/api/clients/:id/people", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Validate client ID parameter
      const paramValidation = z.object({
        id: z.string().min(1, "Client ID is required")
      }).safeParse(req.params);
      
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid client ID format", 
          errors: paramValidation.error.issues 
        });
      }
      
      const { id: clientId } = paramValidation.data;
      
      // Check if client exists
      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      // Validate request body
      const validationResult = insertPersonSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid person data", 
          errors: validationResult.error.issues 
        });
      }
      
      const personData = validationResult.data;
      
      // Generate unique ID for the person
      const personId = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const personWithId = { ...personData, id: personId };
      
      // Create the person
      const newPerson = await storage.createPerson(personWithId);
      
      // Associate the person with the client
      const relationshipId = `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const clientPersonData = {
        id: relationshipId,
        clientId: clientId,
        personId: newPerson.id,
        isPrimaryContact: false, // Default to false, can be updated later
        officerRole: null, // Default null, can be set if needed
      };
      
      const clientPerson = await storage.createClientPerson(clientPersonData);
      
      // Return the full ClientPersonWithPerson object for consistency
      const result = {
        ...clientPerson,
        person: newPerson
      };
      
      res.status(201).json(result);
      
    } catch (error) {
      console.error("Error creating person for client:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to create person" });
    }
  });

  // PATCH /api/people/:id - Update person details
  app.patch("/api/people/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = z.object({
        id: z.string().min(1, "Person ID is required")
      }).safeParse(req.params);
      
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid person ID format", 
          errors: paramValidation.error.issues 
        });
      }
      
      const { id } = paramValidation.data;
      
      // Check if person exists
      const existingPerson = await storage.getPersonById(id);
      if (!existingPerson) {
        return res.status(404).json({ message: "Person not found" });
      }
      
      // Validate request body using the insert schema as partial for updates
      const validationResult = insertPersonSchema.partial().safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid person data", 
          errors: validationResult.error.issues 
        });
      }
      
      // Update the person
      const updatedPerson = await storage.updatePerson(id, validationResult.data);
      
      res.status(200).json(updatedPerson);
      
    } catch (error) {
      console.error("Error updating person:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to update person" });
    }
  });

  // POST /api/people/match - Find potential duplicate people by name and birth date
  app.post("/api/people/match", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      // Define the schema for officer matching request
      const officerMatchSchema = z.object({
        officers: z.array(z.object({
          fullName: z.string().min(1, "Full name is required"),
          dateOfBirth: z.object({
            year: z.number().min(1900).max(new Date().getFullYear()),
            month: z.number().min(1).max(12)
          })
        }))
      });
      
      const validationResult = officerMatchSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid officer matching data", 
          errors: validationResult.error.issues 
        });
      }
      
      const { officers } = validationResult.data;
      
      // Process each officer and find potential matches
      const matches = await Promise.all(
        officers.map(async (officer, index) => {
          const parsedName = parseFullName(officer.fullName);
          
          // Only search if we have both first and last names
          if (!parsedName.firstName || !parsedName.lastName) {
            return {
              index,
              officer,
              matches: []
            };
          }
          
          const matchingPeople = await storage.findPeopleByNameAndBirthDate(
            parsedName.firstName,
            parsedName.lastName,
            officer.dateOfBirth.year,
            officer.dateOfBirth.month
          );
          
          // For each matched person, get their company connections
          const matchesWithCompanies = await Promise.all(
            matchingPeople.map(async (person) => {
              const clientConnections = await storage.getClientPeopleByPersonId(person.id);
              // Filter to company clients only and include useful identifiers for UI
              const companyConnections = clientConnections.filter(c => c.client.clientType === 'company');
              const companies = companyConnections.map(connection => ({
                id: connection.client.id,
                name: connection.client.name,
                number: connection.client.companyNumber,
                role: connection.officerRole
              }));
              
              return {
                ...person,
                companies
              };
            })
          );
          
          return {
            index,
            officer: {
              ...officer,
              parsedFirstName: parsedName.firstName,
              parsedLastName: parsedName.lastName
            },
            matches: matchesWithCompanies
          };
        })
      );
      
      res.status(200).json({ matches });
      
    } catch (error) {
      console.error("Error finding people matches:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to find people matches" });
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

  // Tag management routes (admin only)
  app.get("/api/client-tags", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const tags = await storage.getAllClientTags();
      res.json(tags);
    } catch (error) {
      console.error("Error fetching client tags:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client tags" });
    }
  });

  app.post("/api/client-tags", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const validatedData = insertClientTagSchema.parse(req.body);
      const tag = await storage.createClientTag(validatedData);
      res.status(201).json(tag);
    } catch (error) {
      console.error("Error creating client tag:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to create client tag" });
    }
  });

  app.delete("/api/client-tags/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      await storage.deleteClientTag(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting client tag:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to delete client tag" });
    }
  });

  app.get("/api/people-tags", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const tags = await storage.getAllPeopleTags();
      res.json(tags);
    } catch (error) {
      console.error("Error fetching people tags:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch people tags" });
    }
  });

  app.post("/api/people-tags", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const validatedData = insertPeopleTagSchema.parse(req.body);
      const tag = await storage.createPeopleTag(validatedData);
      res.status(201).json(tag);
    } catch (error) {
      console.error("Error creating people tag:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to create people tag" });
    }
  });

  app.delete("/api/people-tags/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      await storage.deletePeopleTag(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting people tag:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to delete people tag" });
    }
  });

  // Tag assignment routes (admin and manager)
  app.get("/api/clients/:clientId/tags", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramClientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const tags = await storage.getClientTags(req.params.clientId);
      res.json(tags);
    } catch (error) {
      console.error("Error fetching client tags:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client tags" });
    }
  });

  app.post("/api/clients/:clientId/tags", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramClientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const assignmentData = {
        ...req.body,
        clientId: req.params.clientId,
        assignedBy: effectiveUserId,
      };
      
      const validatedData = insertClientTagAssignmentSchema.parse(assignmentData);
      const assignment = await storage.assignClientTag(validatedData);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error assigning client tag:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to assign client tag" });
    }
  });

  app.delete("/api/clients/:clientId/tags/:tagId", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const clientValidation = validateParams(paramClientIdSchema, req.params);
      const tagValidation = validateParams({ tagId: z.string().uuid() }, req.params);
      
      if (!clientValidation.success) {
        return res.status(400).json({ 
          message: "Invalid client ID", 
          errors: clientValidation.errors 
        });
      }
      
      if (!tagValidation.success) {
        return res.status(400).json({ 
          message: "Invalid tag ID", 
          errors: tagValidation.errors 
        });
      }
      
      await storage.unassignClientTag(req.params.clientId, req.params.tagId);
      res.status(204).send();
    } catch (error) {
      console.error("Error unassigning client tag:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to unassign client tag" });
    }
  });

  app.get("/api/people/:personId/tags", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams({ personId: z.string().uuid() }, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const tags = await storage.getPersonTags(req.params.personId);
      res.json(tags);
    } catch (error) {
      console.error("Error fetching person tags:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch person tags" });
    }
  });

  app.post("/api/people/:personId/tags", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams({ personId: z.string().uuid() }, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const assignmentData = {
        ...req.body,
        personId: req.params.personId,
        assignedBy: effectiveUserId,
      };
      
      const validatedData = insertPeopleTagAssignmentSchema.parse(assignmentData);
      const assignment = await storage.assignPersonTag(validatedData);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error assigning person tag:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to assign person tag" });
    }
  });

  app.delete("/api/people/:personId/tags/:tagId", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const personValidation = validateParams({ personId: z.string().uuid() }, req.params);
      const tagValidation = validateParams({ tagId: z.string().uuid() }, req.params);
      
      if (!personValidation.success) {
        return res.status(400).json({ 
          message: "Invalid person ID", 
          errors: personValidation.errors 
        });
      }
      
      if (!tagValidation.success) {
        return res.status(400).json({ 
          message: "Invalid tag ID", 
          errors: tagValidation.errors 
        });
      }
      
      await storage.unassignPersonTag(req.params.personId, req.params.tagId);
      res.status(204).send();
    } catch (error) {
      console.error("Error unassigning person tag:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to unassign person tag" });
    }
  });

  // Project routes
  app.get("/api/projects", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;
      
      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Extract query parameters for filtering
      const filters = {
        month: req.query.month as string | undefined,
        archived: req.query.archived === 'true' ? true : req.query.archived === 'false' ? false : undefined,
        inactive: req.query.inactive === 'true' ? true : req.query.inactive === 'false' ? false : undefined,
      };

      const projects = await storage.getProjectsByUser(effectiveUserId, effectiveUser.isAdmin ? 'admin' : 'user', filters);
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

  app.get("/api/clients/:clientId/projects", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;
      
      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const clientId = req.params.clientId;

      // Extract query parameters for filtering
      const filters = {
        month: req.query.month as string | undefined,
        archived: req.query.archived === 'true' ? true : req.query.archived === 'false' ? false : undefined,
        inactive: req.query.inactive === 'true' ? true : req.query.inactive === 'false' ? false : undefined,
        serviceId: req.query.serviceId as string | undefined,
      };

      const projects = await storage.getProjectsByClient(clientId, filters);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching client projects:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(500).json({ message: "Failed to fetch client projects" });
    }
  });

  app.patch("/api/projects/:id/status", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;
      
      if (!effectiveUserId || !effectiveUser) {
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
        effectiveUser.isAdmin ||
        project.currentAssigneeId === effectiveUserId ||
        project.clientManagerId === effectiveUserId ||
        project.bookkeeperId === effectiveUserId;

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
      const effectiveUser = req.user?.effectiveUser;
      
      if (!effectiveUserId || !effectiveUser) {
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
        effectiveUser.isAdmin ||
        project.currentAssigneeId === effectiveUserId ||
        project.clientManagerId === effectiveUserId ||
        project.bookkeeperId === effectiveUserId;

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

  // Service roles endpoint
  app.get("/api/config/services/:serviceId/roles", isAuthenticated, async (req: any, res: any) => {
    try {
      const workRoles = await storage.getWorkRolesByServiceId(req.params.serviceId);
      res.json(workRoles);
    } catch (error) {
      console.error("Error fetching service roles:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(500).json({ message: "Failed to fetch service roles" });
    }
  });

  app.post("/api/config/stages", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const stageData = insertKanbanStageSchema.parse(req.body);
      
      // Get project type to validate assignment method
      const projectType = await storage.getProjectTypeById(stageData.projectTypeId);
      if (!projectType) {
        return res.status(404).json({ message: "Project type not found" });
      }
      
      // Conditional validation based on service linkage
      if (projectType.serviceId) {
        // Service-linked project type: require assignedWorkRoleId
        if (!stageData.assignedWorkRoleId) {
          return res.status(400).json({ 
            message: "Service-linked project types require a work role assignment",
            code: "WORK_ROLE_REQUIRED"
          });
        }
        
        // Validate work role belongs to the service
        const serviceRoles = await storage.getServiceRolesByServiceId(projectType.serviceId);
        const isValidRole = serviceRoles.some((sr: any) => sr.roleId === stageData.assignedWorkRoleId);
        if (!isValidRole) {
          return res.status(400).json({ 
            message: "Work role does not belong to the project type's service",
            code: "INVALID_SERVICE_ROLE"
          });
        }
        
        // Clear other assignment fields
        stageData.assignedUserId = null;
      } else {
        // Non-service project type: require assignedUserId
        if (!stageData.assignedUserId) {
          return res.status(400).json({ 
            message: "Non-service project types require a user assignment",
            code: "USER_REQUIRED"
          });
        }
        
        // Validate user exists and is active
        const user = await storage.getUser(stageData.assignedUserId);
        if (!user) {
          return res.status(400).json({ 
            message: "Assigned user not found",
            code: "USER_NOT_FOUND"
          });
        }
        
        // Clear other assignment fields
        stageData.assignedWorkRoleId = null;
      }
      
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
      
      // Get existing stage to check project type
      const existingStage = await storage.getStageById(req.params.id);
      if (!existingStage) {
        return res.status(404).json({ message: "Stage not found" });
      }
      
      // If assignment fields are being updated, validate them
      if (updateData.assignedWorkRoleId !== undefined || updateData.assignedUserId !== undefined) {
        const projectType = await storage.getProjectTypeById(existingStage.projectTypeId);
        if (!projectType) {
          return res.status(404).json({ message: "Project type not found" });
        }
        
        // Conditional validation based on service linkage
        if (projectType.serviceId) {
          // Service-linked project type: require assignedWorkRoleId
          const workRoleId = updateData.assignedWorkRoleId ?? existingStage.assignedWorkRoleId;
          if (!workRoleId) {
            return res.status(400).json({ 
              message: "Service-linked project types require a work role assignment",
              code: "WORK_ROLE_REQUIRED"
            });
          }
          
          // Validate work role belongs to the service
          const serviceRoles = await storage.getServiceRolesByServiceId(projectType.serviceId);
          const isValidRole = serviceRoles.some((sr: any) => sr.roleId === workRoleId);
          if (!isValidRole) {
            return res.status(400).json({ 
              message: "Work role does not belong to the project type's service",
              code: "INVALID_SERVICE_ROLE"
            });
          }
          
          // Clear other assignment fields
          updateData.assignedUserId = null;
        } else {
          // Non-service project type: require assignedUserId
          const userId = updateData.assignedUserId ?? existingStage.assignedUserId;
          if (!userId) {
            return res.status(400).json({ 
              message: "Non-service project types require a user assignment",
              code: "USER_REQUIRED"
            });
          }
          
          // Validate user exists and is active
          const user = await storage.getUser(userId);
          if (!user) {
            return res.status(400).json({ 
              message: "Assigned user not found",
              code: "USER_NOT_FOUND"
            });
          }
          
          // Clear other assignment fields
          updateData.assignedWorkRoleId = null;
        }
      }
      
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
      res.status(204).send();
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
      res.status(204).send();
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
      res.status(204).send();
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
      res.status(204).send();
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
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project description:", error);
      
      if (error instanceof Error && error.message && error.message.includes("Project type not found")) {
        return res.status(404).json({ message: "Project type not found" });
      } else if (error instanceof Error && error.message && error.message.includes("Cannot delete project type")) {
        // Return the specific error message from storage layer which explains exactly what's preventing deletion
        return res.status(409).json({ message: error.message });
      }
      
      res.status(400).json({ message: "Failed to delete project type" });
    }
  });

  // Project type management routes
  app.get("/api/config/project-types", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      // Extract query parameters for filtering
      const filters = {
        inactive: req.query.inactive === 'true' ? true : req.query.inactive === 'false' ? false : undefined,
      };

      const projectTypes = await storage.getAllProjectTypes();
      
      // Apply inactive filter if specified
      const filteredProjectTypes = filters.inactive === true 
        ? projectTypes // Show all project types (both active and inactive)
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
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project type:", error);
      
      if (error instanceof Error && error.message && error.message.includes("Project type not found")) {
        res.status(404).json({ message: "Project type not found" });
      } else if (error instanceof Error && error.message && error.message.includes("Cannot delete project type")) {
        // Return the specific error message from storage layer which explains exactly what's preventing deletion
        res.status(409).json({ message: error.message });
      } else {
        res.status(400).json({ message: "Failed to delete project type" });
      }
    }
  });

  // Get dependency summary for project type (dry run for force delete)
  app.get("/api/config/project-types/:id/dependency-summary", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const summary = await storage.getProjectTypeDependencySummary(req.params.id);
      res.json(summary);
    } catch (error) {
      console.error("Error getting project type dependency summary:", error);
      res.status(500).json({ message: "Failed to get dependency summary" });
    }
  });

  // Force delete project type with all dependencies
  app.post("/api/config/project-types/:id/force-delete", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { confirmName } = req.body;
      
      if (!confirmName || typeof confirmName !== 'string') {
        return res.status(400).json({ message: "Confirmation name is required" });
      }

      const result = await storage.forceDeleteProjectType(req.params.id, confirmName);
      res.json(result);
    } catch (error) {
      console.error("Error force deleting project type:", error);
      
      if (error instanceof Error && error.message && error.message.includes("Project type not found")) {
        res.status(404).json({ message: "Project type not found" });
      } else if (error instanceof Error && error.message && error.message.includes("name confirmation does not match")) {
        res.status(400).json({ message: "Project type name confirmation does not match" });
      } else {
        res.status(500).json({ message: "Failed to force delete project type" });
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

  // Get roles for a specific project type (service-specific roles if mapped, empty array if not)
  app.get("/api/config/project-types/:projectTypeId/roles", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramProjectTypeIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid request parameters",
          errors: paramValidation.errors
        });
      }

      const { projectTypeId } = paramValidation.data;

      // Find the service mapped to this project type
      const service = await storage.getServiceByProjectTypeId(projectTypeId);
      
      if (!service) {
        // No service mapped to this project type, return empty array for backward compatibility
        return res.json([]);
      }

      // Get work roles for this service
      const workRoles = await storage.getWorkRolesByServiceId(service.id);
      res.json(workRoles);
    } catch (error) {
      console.error("Error fetching project type roles:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch project type roles" });
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
      res.status(204).send();
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
      res.status(204).send();
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
      const effectiveUser = req.user?.effectiveUser;
      
      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify user has permission to view this project
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if effective user is authorized to view this project
      const canView = 
        effectiveUser.isAdmin ||
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

  // ==================================================
  // SERVICES API ROUTES
  // ==================================================
  
  // GET /api/services - Get all services (supports ?active=true filter)
  app.get("/api/services", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { active } = req.query;
      const services = active === 'true' 
        ? await storage.getActiveServices()
        : await storage.getAllServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  // GET /api/services/active - Get active services (public endpoint for authenticated users)
  app.get("/api/services/active", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const services = await storage.getActiveServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching active services:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch active services" });
    }
  });

  // GET /api/services/client-assignable - Get services that can be assigned to clients (excludes personal services)
  app.get("/api/services/client-assignable", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const services = await storage.getClientAssignableServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching client-assignable services:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client-assignable services" });
    }
  });

  // GET /api/services/:id - Get service by ID
  app.get("/api/services/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const service = await storage.getServiceById(id);
      
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      
      res.json(service);
    } catch (error) {
      console.error("Error fetching service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch service" });
    }
  });

  // POST /api/services - Create new service
  app.post("/api/services", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const validServiceData = insertServiceSchema.parse(req.body);
      const service = await storage.createService(validServiceData);
      res.status(201).json(service);
    } catch (error) {
      console.error("Error creating service:", error instanceof Error ? error.message : error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid service data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  // PATCH /api/services/:id - Update service
  app.patch("/api/services/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      // Check if service exists
      const existingService = await storage.getServiceById(id);
      if (!existingService) {
        return res.status(404).json({ message: "Service not found" });
      }

      const validUpdateData = updateServiceSchema.parse(req.body);
      
      // Check if there's actually data to update
      if (Object.keys(validUpdateData).length === 0) {
        return res.status(400).json({ message: "No data provided for update" });
      }
      
      const service = await storage.updateService(id, validUpdateData);
      res.json(service);
    } catch (error) {
      console.error("Error updating service:", error instanceof Error ? error.message : error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid service data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  // DELETE /api/services/:id - Delete service
  app.delete("/api/services/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      // Check if service exists
      const existingService = await storage.getServiceById(id);
      if (!existingService) {
        return res.status(404).json({ message: "Service not found" });
      }

      await storage.deleteService(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  // GET /api/services/by-project-type/:projectTypeId - Get service by project type ID
  app.get("/api/services/by-project-type/:projectTypeId", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { projectTypeId } = req.params;
      const service = await storage.getServiceByProjectTypeId(projectTypeId);
      
      if (!service) {
        return res.status(404).json({ message: "Service not found for this project type" });
      }
      
      res.json(service);
    } catch (error) {
      console.error("Error fetching service by project type:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch service by project type" });
    }
  });

  // ==================================================
  // WORK ROLES API ROUTES
  // ==================================================

  // GET /api/work-roles - Get all work roles
  app.get("/api/work-roles", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const workRoles = await storage.getAllWorkRoles();
      res.json(workRoles);
    } catch (error) {
      console.error("Error fetching work roles:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch work roles" });
    }
  });

  // GET /api/work-roles/:id - Get work role by ID
  app.get("/api/work-roles/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const workRole = await storage.getWorkRoleById(id);
      
      if (!workRole) {
        return res.status(404).json({ message: "Work role not found" });
      }
      
      res.json(workRole);
    } catch (error) {
      console.error("Error fetching work role:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch work role" });
    }
  });

  // POST /api/work-roles - Create new work role
  app.post("/api/work-roles", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const validWorkRoleData = insertWorkRoleSchema.parse(req.body);
      const workRole = await storage.createWorkRole(validWorkRoleData);
      res.status(201).json(workRole);
    } catch (error) {
      console.error("Error creating work role:", error instanceof Error ? error.message : error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid work role data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create work role" });
    }
  });

  // PATCH /api/work-roles/:id - Update work role
  app.patch("/api/work-roles/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      // Check if work role exists
      const existingWorkRole = await storage.getWorkRoleById(id);
      if (!existingWorkRole) {
        return res.status(404).json({ message: "Work role not found" });
      }

      const validUpdateData = insertWorkRoleSchema.partial().parse(req.body);
      const workRole = await storage.updateWorkRole(id, validUpdateData);
      res.json(workRole);
    } catch (error) {
      console.error("Error updating work role:", error instanceof Error ? error.message : error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid work role data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update work role" });
    }
  });

  // DELETE /api/work-roles/:id - Delete work role
  app.delete("/api/work-roles/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      // Check if work role exists
      const existingWorkRole = await storage.getWorkRoleById(id);
      if (!existingWorkRole) {
        return res.status(404).json({ message: "Work role not found" });
      }

      await storage.deleteWorkRole(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting work role:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to delete work role" });
    }
  });

  // ==================================================
  // SERVICE-ROLE MAPPING API ROUTES
  // ==================================================

  // GET /api/services/:serviceId/roles - Get roles for a service
  app.get("/api/services/:serviceId/roles", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { serviceId } = req.params;
      
      // Check if service exists
      const existingService = await storage.getServiceById(serviceId);
      if (!existingService) {
        return res.status(404).json({ message: "Service not found" });
      }

      // Get service-role mappings and then fetch the actual work roles
      const serviceRoleMappings = await storage.getServiceRolesByServiceId(serviceId);
      const workRoles = await Promise.all(
        serviceRoleMappings.map(async (mapping) => {
          const workRole = await storage.getWorkRoleById(mapping.roleId);
          return workRole;
        })
      );
      
      // Filter out any null results (in case some roles were deleted)
      const validWorkRoles = workRoles.filter(role => role !== undefined);
      
      res.json(validWorkRoles);
    } catch (error) {
      console.error("Error fetching service roles:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch service roles" });
    }
  });

  // POST /api/services/:serviceId/roles - Add role to service
  app.post("/api/services/:serviceId/roles", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { serviceId } = req.params;
      
      // Explicitly enforce z.object({ roleId: z.string() }) validation
      const roleValidationSchema = z.object({ roleId: z.string() });
      const validationResult = roleValidationSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.issues 
        });
      }
      
      const { roleId } = validationResult.data;

      // Check if service exists
      const existingService = await storage.getServiceById(serviceId);
      if (!existingService) {
        return res.status(404).json({ message: "Service not found" });
      }

      // Check if work role exists
      const existingWorkRole = await storage.getWorkRoleById(roleId);
      if (!existingWorkRole) {
        return res.status(404).json({ message: "Work role not found" });
      }

      const serviceRole = await storage.addRoleToService(serviceId, roleId);
      res.status(201).json(serviceRole);
    } catch (error) {
      console.error("Error adding role to service:", error instanceof Error ? error.message : error);
      
      // Handle duplicate mapping case (unique constraint violation)
      if (error instanceof Error && (error as any).code === '23505' && (error as any).constraint_name === 'unique_service_role') {
        return res.status(409).json({ 
          message: "This role is already mapped to this service",
          code: "DUPLICATE_SERVICE_ROLE_MAPPING"
        });
      }
      
      // Check for duplicate key error (alternative constraint format)
      if (error instanceof Error && error.message && error.message.includes('duplicate key value violates unique constraint')) {
        if (error.message.includes('unique_service_role')) {
          return res.status(409).json({ 
            message: "This role is already mapped to this service",
            code: "DUPLICATE_SERVICE_ROLE_MAPPING"
          });
        }
      }
      
      res.status(500).json({ message: "Failed to add role to service" });
    }
  });

  // DELETE /api/services/:serviceId/roles/:roleId - Remove role from service
  app.delete("/api/services/:serviceId/roles/:roleId", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { serviceId, roleId } = req.params;
      
      // Check if service exists
      const existingService = await storage.getServiceById(serviceId);
      if (!existingService) {
        return res.status(404).json({ message: "Service not found" });
      }

      // Check if work role exists
      const existingWorkRole = await storage.getWorkRoleById(roleId);
      if (!existingWorkRole) {
        return res.status(404).json({ message: "Work role not found" });
      }

      await storage.removeRoleFromService(serviceId, roleId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing role from service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to remove role from service" });
    }
  });

  // ==================================================
  // CLIENT SERVICES API ROUTES  
  // ==================================================

  // GET /api/client-services - Get all client services (admin only)
  app.get("/api/client-services", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const clientServices = await storage.getAllClientServices();
      res.json(clientServices);
    } catch (error) {
      console.error("Error fetching client services:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client services" });
    }
  });

  // GET /api/client-services/client/:clientId - Get services for a specific client
  app.get("/api/client-services/client/:clientId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Validate path parameters - accept both UUID and string IDs for clients
      const clientIdSchema = z.object({ 
        clientId: z.string().min(1, "Client ID is required")
      });
      const paramValidation = validateParams(clientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const { clientId } = req.params;

      const clientServices = await storage.getClientServicesByClientId(clientId);
      res.json(clientServices);
    } catch (error) {
      console.error("Error fetching client services by client:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client services" });
    }
  });

  // GET /api/client-services/service/:serviceId - Get clients for a specific service
  app.get("/api/client-services/service/:serviceId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramServiceIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const { serviceId } = req.params;

      const clientServices = await storage.getClientServicesByServiceId(serviceId);
      res.json(clientServices);
    } catch (error) {
      console.error("Error fetching client services by service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client services" });
    }
  });

  // POST /api/client-services - Create new client-service mapping (admin only)
  app.post("/api/client-services", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const validationResult = insertClientServiceSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid client service data", 
          errors: validationResult.error.issues 
        });
      }
      
      const clientServiceData = validationResult.data;
      
      // Check if service is Companies House connected and auto-populate dates
      const service = await storage.getServiceById(clientServiceData.serviceId);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      
      // Prevent personal services from being assigned to clients
      if (service.isPersonalService) {
        return res.status(400).json({ 
          message: "Personal services cannot be assigned to clients",
          serviceId: service.id,
          serviceName: service.name
        });
      }
      
      let finalClientServiceData = { ...clientServiceData };
      
      if (service.isCompaniesHouseConnected) {
        // Force annual frequency for CH services (always set for consistency)
        finalClientServiceData.frequency = 'annually' as const;
        
        // Get client to read CH field values
        const client = await storage.getClientById(clientServiceData.clientId);
        if (!client) {
          return res.status(404).json({ message: "Client not found" });
        }
        
        // Whitelist allowed CH date fields for security
        const allowedDateFields = ['nextAccountsPeriodEnd', 'nextAccountsDue', 'confirmationStatementNextDue', 'confirmationStatementNextMadeUpTo'];
        
        if (!service.chStartDateField || !service.chDueDateField) {
          return res.status(400).json({ 
            message: "Companies House service must specify both start and due date field mappings"
          });
        }
        
        if (!allowedDateFields.includes(service.chStartDateField) || !allowedDateFields.includes(service.chDueDateField)) {
          return res.status(400).json({ 
            message: "Invalid CH date field mapping",
            details: { allowedFields: allowedDateFields }
          });
        }
        
        // Get and validate date values
        const startDateField = service.chStartDateField as keyof typeof client;
        const dueDateField = service.chDueDateField as keyof typeof client;
        
        const startDateValue = client[startDateField];
        const dueDateValue = client[dueDateField];
        
        // Coerce and validate dates safely
        const startDate = startDateValue ? new Date(startDateValue as any) : null;
        const dueDate = dueDateValue ? new Date(dueDateValue as any) : null;
        
        if (!startDate || !dueDate || isNaN(startDate.getTime()) || isNaN(dueDate.getTime())) {
          return res.status(400).json({ 
            message: "Companies House service requires client to have valid CH date fields",
            details: {
              startDateField: service.chStartDateField,
              dueDateField: service.chDueDateField,
              startDateValid: startDate && !isNaN(startDate.getTime()),
              dueDateValid: dueDate && !isNaN(dueDate.getTime()),
            }
          });
        }
        
        // Auto-populate with validated dates
        finalClientServiceData = {
          ...finalClientServiceData,
          nextStartDate: startDate.toISOString(),
          nextDueDate: dueDate.toISOString(),
        };
      }
      
      // Convert ISO string dates to Date objects for database insertion
      const dataForStorage = {
        ...finalClientServiceData,
        nextStartDate: finalClientServiceData.nextStartDate ? new Date(finalClientServiceData.nextStartDate) : null,
        nextDueDate: finalClientServiceData.nextDueDate ? new Date(finalClientServiceData.nextDueDate) : null,
      };
      
      // Check if client-service mapping already exists
      const mappingExists = await storage.checkClientServiceMappingExists(
        clientServiceData.clientId, 
        clientServiceData.serviceId
      );
      
      if (mappingExists) {
        return res.status(409).json({ 
          message: "Client service mapping already exists",
          code: "DUPLICATE_CLIENT_SERVICE_MAPPING"
        });
      }

      const clientService = await storage.createClientService(dataForStorage);
      res.status(201).json(clientService);
    } catch (error) {
      console.error("Error creating client service:", error instanceof Error ? error.message : error);
      
      // Handle duplicate mapping case (unique constraint violation)
      if (error instanceof Error && (error as any).code === '23505') {
        return res.status(409).json({ 
          message: "Client service mapping already exists",
          code: "DUPLICATE_CLIENT_SERVICE_MAPPING"
        });
      }
      
      res.status(500).json({ message: "Failed to create client service" });
    }
  });

  // PUT /api/client-services/:id - Update client service (admin only)
  app.put("/api/client-services/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const { id } = req.params;

      // Check if client service exists
      const existingClientService = await storage.getClientServiceById(id);
      if (!existingClientService) {
        return res.status(404).json({ message: "Client service not found" });
      }

      const validationResult = insertClientServiceSchema.partial().safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid client service data", 
          errors: validationResult.error.issues 
        });
      }
      
      // If serviceId is being updated, prevent personal services from being assigned to clients
      if (validationResult.data.serviceId) {
        const service = await storage.getServiceById(validationResult.data.serviceId);
        if (!service) {
          return res.status(404).json({ message: "Service not found" });
        }
        
        if (service.isPersonalService) {
          return res.status(400).json({ 
            message: "Personal services cannot be assigned to clients",
            serviceId: service.id,
            serviceName: service.name
          });
        }
      }

      const clientService = await storage.updateClientService(id, validationResult.data);
      res.json(clientService);
    } catch (error) {
      console.error("Error updating client service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to update client service" });
    }
  });

  // DELETE /api/client-services/:id - Delete client service (admin only)
  app.delete("/api/client-services/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const { id } = req.params;

      // Check if client service exists
      const existingClientService = await storage.getClientServiceById(id);
      if (!existingClientService) {
        return res.status(404).json({ message: "Client service not found" });
      }

      await storage.deleteClientService(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting client service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to delete client service" });
    }
  });

  // ==================================================
  // PEOPLE SERVICES API ROUTES  
  // ==================================================

  // GET /api/people-services - Get all people services (admin only)
  app.get("/api/people-services", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const peopleServices = await storage.getAllPeopleServices();
      res.json(peopleServices);
    } catch (error) {
      console.error("Error fetching people services:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch people services" });
    }
  });

  // GET /api/people-services/person/:personId - Get services for a specific person
  app.get("/api/people-services/person/:personId", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const validation = validateParams(paramPersonIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid person ID", errors: validation.errors });
      }

      const { personId } = validation.data;
      const peopleServices = await storage.getPeopleServicesByPersonId(personId);
      res.json(peopleServices);
    } catch (error) {
      console.error("Error fetching people services by person:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch people services" });
    }
  });

  // GET /api/people-services/service/:serviceId - Get people for a specific service
  app.get("/api/people-services/service/:serviceId", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const validation = validateParams(paramServiceIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid service ID", errors: validation.errors });
      }

      const { serviceId } = validation.data;
      const peopleServices = await storage.getPeopleServicesByServiceId(serviceId);
      res.json(peopleServices);
    } catch (error) {
      console.error("Error fetching people services by service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch people services" });
    }
  });

  // GET /api/people-services/client/:clientId - Get all personal services for people related to a client
  app.get("/api/people-services/client/:clientId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const validation = validateParams(paramClientIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid client ID", errors: validation.errors });
      }

      const { clientId } = validation.data;
      
      // Check if client exists
      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Get all personal services for people related to this client
      const allPeopleServices = await storage.getPeopleServicesByClientId(clientId);
      
      res.json(allPeopleServices);
    } catch (error) {
      console.error("Error fetching client people services:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client people services" });
    }
  });

  // POST /api/people-services - Create a new people service
  app.post("/api/people-services", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      // Validate request body using Zod schema
      const validation = insertPeopleServiceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid people service data", 
          errors: validation.error.issues 
        });
      }

      const peopleServiceData = validation.data;

      // Convert ISO string dates to Date objects for database insertion
      const dataForStorage = {
        ...peopleServiceData,
        nextStartDate: peopleServiceData.nextStartDate ? new Date(peopleServiceData.nextStartDate) : null,
        nextDueDate: peopleServiceData.nextDueDate ? new Date(peopleServiceData.nextDueDate) : null,
      };

      // Verify the service is a personal service before creation
      const service = await storage.getServiceById(dataForStorage.serviceId);
      if (!service) {
        return res.status(404).json({ message: `Service with ID '${dataForStorage.serviceId}' not found` });
      }
      if (!service.isPersonalService) {
        return res.status(400).json({ message: `Service '${service.name}' is not a personal service and cannot be assigned to people` });
      }

      // Create the people service
      const newPeopleService = await storage.createPeopleService(dataForStorage);
      
      // Fetch the complete people service with relations
      const completePeopleService = await storage.getPeopleServiceById(newPeopleService.id);
      
      res.status(201).json(completePeopleService);
    } catch (error) {
      console.error("Error creating people service:", error instanceof Error ? error.message : error);
      
      // Handle specific validation errors
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('not a personal service')) {
          return res.status(400).json({ message: error.message });
        }
        if (error.message.includes('mapping already exists')) {
          return res.status(409).json({ message: error.message });
        }
      }
      
      res.status(500).json({ message: "Failed to create people service" });
    }
  });

  // PUT /api/people-services/:peopleServiceId - Update a people service
  app.put("/api/people-services/:peopleServiceId", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramPeopleServiceIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ message: "Invalid people service ID", errors: paramValidation.errors });
      }

      // Validate request body - partial update
      const validation = insertPeopleServiceSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid people service data", 
          errors: validation.error.issues 
        });
      }

      const { peopleServiceId } = paramValidation.data;
      const peopleServiceData = validation.data;

      // If serviceId is being changed, verify it's a personal service
      if (peopleServiceData.serviceId) {
        const service = await storage.getServiceById(peopleServiceData.serviceId);
        if (!service) {
          return res.status(404).json({ message: `Service with ID '${peopleServiceData.serviceId}' not found` });
        }
        if (!service.isPersonalService) {
          return res.status(400).json({ message: `Service '${service.name}' is not a personal service and cannot be assigned to people` });
        }
      }

      // Update the people service
      const updatedPeopleService = await storage.updatePeopleService(peopleServiceId, peopleServiceData);
      
      // Fetch the complete people service with relations
      const completePeopleService = await storage.getPeopleServiceById(updatedPeopleService.id);
      
      res.json(completePeopleService);
    } catch (error) {
      console.error("Error updating people service:", error instanceof Error ? error.message : error);
      
      // Handle specific validation errors
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('not a personal service')) {
          return res.status(400).json({ message: error.message });
        }
        if (error.message.includes('mapping already exists')) {
          return res.status(409).json({ message: error.message });
        }
      }
      
      res.status(500).json({ message: "Failed to update people service" });
    }
  });

  // DELETE /api/people-services/:peopleServiceId - Delete a people service
  app.delete("/api/people-services/:peopleServiceId", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const validation = validateParams(paramPeopleServiceIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid people service ID", errors: validation.errors });
      }

      const { peopleServiceId } = validation.data;

      // Delete the people service
      await storage.deletePeopleService(peopleServiceId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting people service:", error instanceof Error ? error.message : error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to delete people service" });
    }
  });

  // ==================================================
  // CLIENT SERVICE ROLE ASSIGNMENT API ROUTES
  // ==================================================

  // GET /api/client-services/:clientServiceId/role-assignments - Get role assignments for client service
  app.get("/api/client-services/:clientServiceId/role-assignments", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramClientServiceIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const { clientServiceId } = req.params;

      // Check if client service exists
      const existingClientService = await storage.getClientServiceById(clientServiceId);
      if (!existingClientService) {
        return res.status(404).json({ message: "Client service not found" });
      }

      const roleAssignments = await storage.getClientServiceRoleAssignments(clientServiceId);
      res.json(roleAssignments);
    } catch (error) {
      console.error("Error fetching role assignments:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch role assignments" });
    }
  });

  // POST /api/client-services/:clientServiceId/role-assignments - Create role assignment
  app.post("/api/client-services/:clientServiceId/role-assignments", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramClientServiceIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const { clientServiceId } = req.params;

      // Check if client service exists
      const existingClientService = await storage.getClientServiceById(clientServiceId);
      if (!existingClientService) {
        return res.status(404).json({ message: "Client service not found" });
      }

      const validationResult = insertClientServiceRoleAssignmentSchema.safeParse({
        ...req.body,
        clientServiceId
      });
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid role assignment data", 
          errors: validationResult.error.issues 
        });
      }

      const roleAssignment = await storage.createClientServiceRoleAssignment(validationResult.data);
      res.status(201).json(roleAssignment);
    } catch (error) {
      console.error("Error creating role assignment:", error instanceof Error ? error.message : error);
      
      // Handle duplicate assignment case (unique constraint violation)
      if (error instanceof Error && (error as any).code === '23505') {
        return res.status(409).json({ 
          message: "Role assignment already exists for this client service and work role",
          code: "DUPLICATE_ROLE_ASSIGNMENT"
        });
      }
      
      res.status(500).json({ message: "Failed to create role assignment" });
    }
  });

  // PUT /api/role-assignments/:id - Update role assignment
  app.put("/api/role-assignments/:id", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const { id } = req.params;

      const validationResult = insertClientServiceRoleAssignmentSchema.partial().safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid role assignment data", 
          errors: validationResult.error.issues 
        });
      }

      const roleAssignment = await storage.updateClientServiceRoleAssignment(id, validationResult.data);
      res.json(roleAssignment);
    } catch (error) {
      console.error("Error updating role assignment:", error instanceof Error ? error.message : error);
      
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: "Role assignment not found" });
      }
      
      res.status(500).json({ message: "Failed to update role assignment" });
    }
  });

  // DELETE /api/role-assignments/:id - Delete role assignment
  app.delete("/api/role-assignments/:id", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const { id } = req.params;

      await storage.deleteClientServiceRoleAssignment(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting role assignment:", error instanceof Error ? error.message : error);
      
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: "Role assignment not found" });
      }
      
      res.status(500).json({ message: "Failed to delete role assignment" });
    }
  });

  // POST /api/role-assignments/:id/deactivate - Deactivate role assignment
  app.post("/api/role-assignments/:id/deactivate", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }
      
      const { id } = req.params;

      const roleAssignment = await storage.deactivateClientServiceRoleAssignment(id);
      res.json(roleAssignment);
    } catch (error) {
      console.error("Error deactivating role assignment:", error instanceof Error ? error.message : error);
      
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: "Role assignment not found" });
      }
      
      res.status(500).json({ message: "Failed to deactivate role assignment" });
    }
  });

  // ==================================================
  // VALIDATION AND HELPER API ROUTES
  // ==================================================

  // GET /api/clients/:clientId/service-role-completeness - Check if client has complete role assignments
  app.get("/api/clients/:clientId/service-role-completeness", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;
      
      if (!clientId || typeof clientId !== 'string') {
        return res.status(400).json({ message: "Valid client ID is required" });
      }

      // Get all client services for this client
      const clientServices = await storage.getClientServicesByClientId(clientId);
      
      const completenessResults = [];
      
      for (const clientService of clientServices) {
        const completeness = await storage.validateClientServiceRoleCompleteness(
          clientId, 
          clientService.service.id
        );
        
        completenessResults.push({
          clientServiceId: clientService.id,
          serviceName: clientService.service.name,
          serviceId: clientService.service.id,
          isComplete: completeness.isComplete,
          missingRoles: completeness.missingRoles,
          assignedRoles: completeness.assignedRoles
        });
      }
      
      const overallComplete = completenessResults.every(result => result.isComplete);
      
      res.json({
        clientId,
        overallComplete,
        services: completenessResults
      });
    } catch (error) {
      console.error("Error checking service role completeness:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to check service role completeness" });
    }
  });

  // POST /api/clients/:clientId/validate-service-roles - Validate client's service role assignments
  app.post("/api/clients/:clientId/validate-service-roles", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;
      
      if (!clientId || typeof clientId !== 'string') {
        return res.status(400).json({ message: "Valid client ID is required" });
      }

      const validationSchema = z.object({
        serviceId: z.string(),
        roleIds: z.array(z.string())
      });

      const validationResult = validationSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid validation request data", 
          errors: validationResult.error.issues 
        });
      }

      const { serviceId, roleIds } = validationResult.data;

      // Check if client service mapping exists
      const mappingExists = await storage.checkClientServiceMappingExists(clientId, serviceId);
      if (!mappingExists) {
        return res.status(404).json({ 
          message: "Client service mapping not found",
          code: "CLIENT_SERVICE_NOT_MAPPED"
        });
      }

      // Validate assigned roles against service requirements
      const roleValidation = await storage.validateAssignedRolesAgainstService(serviceId, roleIds);

      res.json({
        clientId,
        serviceId,
        isValid: roleValidation.isValid,
        invalidRoles: roleValidation.invalidRoles,
        allowedRoles: roleValidation.allowedRoles
      });
    } catch (error) {
      console.error("Error validating service roles:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to validate service roles" });
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

  // Configuration endpoints for fallback user management
  
  // GET /api/config/fallback-user - Get current fallback user (admin only)
  app.get("/api/config/fallback-user", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
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

  // POST /api/config/fallback-user - Set fallback user (admin only, with userId in body)
  app.post("/api/config/fallback-user", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      // Validate request body with Zod schema
      const fallbackUserBodySchema = z.object({
        userId: z.string().min(1, "User ID is required")
      });

      const bodyValidation = fallbackUserBodySchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid request body",
          errors: bodyValidation.error.issues
        });
      }

      const { userId } = bodyValidation.data;

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

  // GET /api/projects/:projectId/role-assignee - Get the user assigned to the current stage's role for a project
  app.get("/api/projects/:projectId/role-assignee", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      
      if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({ message: "Valid project ID is required" });
      }

      // Get the project with its current stage and client information
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get the current stage configuration to find the assigned role
      const stages = await storage.getKanbanStagesByProjectTypeId(project.projectTypeId);
      const currentStage = stages.find(stage => stage.name === project.currentStatus);
      
      if (!currentStage || !currentStage.assignedRole) {
        // If no stage found or no role assigned to stage, fallback to client manager or current assignee
        const assignee = project.currentAssignee || project.clientManager;
        if (assignee) {
          const { passwordHash, ...sanitizedUser } = assignee;
          return res.json({ 
            user: sanitizedUser, 
            roleUsed: null,
            usedFallback: false,
            source: 'direct_assignment'
          });
        } else {
          // No direct assignee found, try fallback user
          const fallbackUser = await storage.getFallbackUser();
          if (fallbackUser) {
            const { passwordHash, ...sanitizedUser } = fallbackUser;
            return res.json({ 
              user: sanitizedUser, 
              roleUsed: null,
              usedFallback: true,
              source: 'fallback_user'
            });
          } else {
            // CRITICAL FIX: Return 200 with null user instead of 404
            return res.json({ 
              user: null, 
              roleUsed: null,
              usedFallback: false,
              source: 'none'
            });
          }
        }
      }

      // Try to resolve the user assigned to this role for this client
      let resolvedUser = await storage.resolveRoleAssigneeForClient(
        project.clientId, 
        project.projectTypeId, 
        currentStage.assignedRole
      );

      let usedFallback = false;
      let source = 'role_assignment';

      // If no role assignment found, use fallback user
      if (!resolvedUser) {
        resolvedUser = await storage.getFallbackUser();
        usedFallback = true;
        source = 'fallback_user';
        
        if (!resolvedUser) {
          // CRITICAL FIX: Return 200 with null user instead of 404
          return res.json({ 
            user: null, 
            roleUsed: currentStage.assignedRole,
            usedFallback: false,
            source: 'none'
          });
        }
      }

      // Strip password hash from response for security
      const { passwordHash, ...sanitizedUser } = resolvedUser;
      
      res.json({
        user: sanitizedUser,
        roleUsed: currentStage.assignedRole,
        usedFallback,
        source
      });
    } catch (error) {
      console.error("Error resolving project role assignee:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to resolve project role assignee" });
    }
  });

  // ===== COMPANIES HOUSE CHANGE REQUESTS API =====

  // GET /api/ch-change-requests - List all pending CH change requests (admin only)
  app.get("/api/ch-change-requests", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const changeRequests = await storage.getPendingChChangeRequests();
      res.json(changeRequests);
    } catch (error) {
      console.error("Error fetching CH change requests:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch CH change requests" });
    }
  });

  // GET /api/ch-change-requests/client/:clientId - Get CH change requests by client (admin only)
  app.get("/api/ch-change-requests/client/:clientId", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramClientIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }

      const { clientId } = req.params;

      const changeRequests = await storage.getChChangeRequestsByClientId(clientId);
      res.json(changeRequests);
    } catch (error) {
      console.error("Error fetching CH change requests by client:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch CH change requests" });
    }
  });

  // POST /api/ch-change-requests/:id/approve - Approve a CH change request (admin only)
  app.post("/api/ch-change-requests/:id/approve", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }

      const { id } = req.params;
      const { notes } = req.body;

      // Check if request exists and is still pending
      const existingRequest = await storage.getChChangeRequestById(id);
      if (!existingRequest) {
        return res.status(404).json({ message: "Change request not found" });
      }
      if (existingRequest.status !== 'pending') {
        return res.status(409).json({ message: "Change request has already been processed" });
      }

      // Get current user ID for approvedBy field
      const currentUser = req.user;
      if (!currentUser?.id) {
        return res.status(401).json({ message: "User identification required" });
      }

      const approvedRequest = await storage.approveChChangeRequest(id, currentUser.id, notes);
      res.json(approvedRequest);
    } catch (error) {
      console.error("Error approving CH change request:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to approve CH change request" });
    }
  });

  // POST /api/ch-change-requests/:id/reject - Reject a CH change request (admin only)
  app.post("/api/ch-change-requests/:id/reject", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      // Validate path parameters
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({ 
          message: "Invalid path parameters", 
          errors: paramValidation.errors 
        });
      }

      const { id } = req.params;
      const { notes } = req.body;

      // Check if request exists and is still pending
      const existingRequest = await storage.getChChangeRequestById(id);
      if (!existingRequest) {
        return res.status(404).json({ message: "Change request not found" });
      }
      if (existingRequest.status !== 'pending') {
        return res.status(409).json({ message: "Change request has already been processed" });
      }

      // Get current user ID for approvedBy field
      const currentUser = req.user;
      if (!currentUser?.id) {
        return res.status(401).json({ message: "User identification required" });
      }

      const rejectedRequest = await storage.rejectChChangeRequest(id, currentUser.id, notes);
      res.json(rejectedRequest);
    } catch (error) {
      console.error("Error rejecting CH change request:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to reject CH change request" });
    }
  });

  // POST /api/ch-sync - Trigger manual Companies House data synchronization (admin only)
  app.post("/api/ch-sync", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      console.log(`[API] Manual CH sync triggered by admin: ${req.user?.email}`);
      
      const result = await runChSync();
      
      res.json({
        message: "Companies House synchronization completed",
        processedClients: result.processedClients,
        createdRequests: result.createdRequests,
        errors: result.errors,
      });
    } catch (error) {
      console.error("Error running CH sync:", error instanceof Error ? error.message : error);
      res.status(500).json({ 
        message: "Failed to run Companies House synchronization",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Project Scheduling API routes

  // POST /api/project-scheduling/run - Enhanced manual project scheduling with advanced testing options (admin only)
  app.post("/api/project-scheduling/run", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      console.log(`[API] Enhanced project scheduling triggered by admin: ${req.user?.email}`);
      
      // Enhanced parameters for testing
      const { 
        targetDate, 
        serviceIds, 
        clientIds, 
        startDate, 
        endDate 
      } = req.body || {};
      
      // Parse target date if provided
      let schedulingDate = new Date();
      if (targetDate) {
        schedulingDate = new Date(targetDate);
        console.log(`[API] Using custom target date: ${schedulingDate.toISOString()}`);
      }
      
      // Handle date range scheduling
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        console.log(`[API] Running scheduling for date range: ${start.toISOString()} to ${end.toISOString()}`);
        
        const results = [];
        const currentDate = new Date(start);
        
        while (currentDate <= end) {
          console.log(`[API] Processing date: ${currentDate.toISOString().split('T')[0]}`);
          const result = await runProjectSchedulingEnhanced('manual', new Date(currentDate), { serviceIds, clientIds });
          results.push({
            date: currentDate.toISOString().split('T')[0],
            ...result
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        const totalProjectsCreated = results.reduce((sum, r) => sum + r.projectsCreated, 0);
        const totalServicesRescheduled = results.reduce((sum, r) => sum + r.servicesRescheduled, 0);
        const totalErrors = results.reduce((sum, r) => sum + r.errorsEncountered, 0);
        
        res.json({
          message: "Date range project scheduling completed",
          status: totalErrors > 0 ? "partial_failure" : "success",
          dateRange: { startDate, endDate },
          totalProjectsCreated,
          totalServicesRescheduled,
          totalErrorsEncountered: totalErrors,
          dailyResults: results,
          summary: `Processed ${results.length} days from ${startDate} to ${endDate}`
        });
      } else {
        // Single date scheduling (enhanced)
        const result = await runProjectSchedulingEnhanced('manual', schedulingDate, { serviceIds, clientIds });
        
        res.json({
          message: "Project scheduling completed",
          status: result.status,
          projectsCreated: result.projectsCreated,
          servicesRescheduled: result.servicesRescheduled,
          errorsEncountered: result.errorsEncountered,
          errors: result.errors,
          summary: result.summary,
          executionTimeMs: result.executionTimeMs,
          filters: { serviceIds, clientIds, targetDate: targetDate || 'current' }
        });
      }
    } catch (error) {
      console.error("Error running project scheduling:", error instanceof Error ? error.message : error);
      res.status(500).json({ 
        message: "Failed to run project scheduling",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // POST /api/project-scheduling/preview - Get detailed scheduling preview without making changes (admin only)
  app.post("/api/project-scheduling/preview", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      console.log(`[API] Scheduling preview triggered by admin: ${req.user?.email}`);
      
      const { 
        targetDate, 
        serviceIds, 
        clientIds 
      } = req.body || {};
      
      // Parse target date if provided
      let schedulingDate = new Date();
      if (targetDate) {
        schedulingDate = new Date(targetDate);
        console.log(`[API] Using custom target date for preview: ${schedulingDate.toISOString()}`);
      }
      
      const result = await buildSchedulingPreview(schedulingDate, { serviceIds, clientIds });
      
      res.json({
        message: "Scheduling preview completed",
        status: result.status,
        targetDate: result.targetDate,
        totalServicesChecked: result.totalServicesChecked,
        servicesFoundDue: result.servicesFoundDue,
        previewItems: result.previewItems,
        configurationErrors: result.configurationErrors,
        summary: result.summary,
        filters: { serviceIds, clientIds, targetDate: targetDate || 'current' }
      });
    } catch (error) {
      console.error("Error building scheduling preview:", error instanceof Error ? error.message : error);
      res.status(500).json({ 
        message: "Failed to build scheduling preview",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // GET /api/project-scheduling/analysis - Get overdue services analysis (admin only)
  app.get("/api/project-scheduling/analysis", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const analysis = await getOverdueServicesAnalysis();
      
      res.json({
        message: "Overdue services analysis completed",
        ...analysis
      });
    } catch (error) {
      console.error("Error getting overdue services analysis:", error instanceof Error ? error.message : error);
      res.status(500).json({ 
        message: "Failed to get overdue services analysis",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // GET /api/project-scheduling/monitoring - Get scheduling system monitoring data (admin only)
  app.get("/api/project-scheduling/monitoring", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const [runLogs, latestRun] = await Promise.all([
        storage.getSchedulingRunLogs(10), // Get last 10 runs
        storage.getLatestSchedulingRunLog()
      ]);
      
      // Calculate statistics from recent runs
      const stats = {
        totalRuns: runLogs.length,
        successfulRuns: runLogs.filter(run => run.status === 'success').length,
        failedRuns: runLogs.filter(run => run.status === 'failure').length,
        partialFailureRuns: runLogs.filter(run => run.status === 'partial_failure').length,
        totalProjectsCreated: runLogs.reduce((sum, run) => sum + (run.projectsCreated || 0), 0),
        totalServicesRescheduled: runLogs.reduce((sum, run) => sum + (run.servicesRescheduled || 0), 0),
        totalErrorsEncountered: runLogs.reduce((sum, run) => sum + (run.errorsEncountered || 0), 0),
        totalChServicesSkipped: runLogs.reduce((sum, run) => sum + (run.chServicesSkipped || 0), 0),
        averageExecutionTime: runLogs.length > 0 
          ? Math.round(runLogs.reduce((sum, run) => sum + (run.executionTimeMs || 0), 0) / runLogs.length)
          : 0
      };

      res.json({
        message: "Scheduling monitoring data retrieved",
        latestRun,
        recentRuns: runLogs,
        statistics: stats,
        systemStatus: latestRun?.status || 'unknown'
      });
    } catch (error) {
      console.error("Error getting scheduling monitoring data:", error instanceof Error ? error.message : error);
      res.status(500).json({ 
        message: "Failed to get scheduling monitoring data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // POST /api/project-scheduling/test-dry-run - Enhanced test scheduling without creating projects (admin only)
  app.post("/api/project-scheduling/test-dry-run", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      console.log(`[API] Enhanced test dry-run project scheduling triggered by admin: ${req.user?.email}`);
      
      // Enhanced parameters for testing
      const { 
        targetDate, 
        serviceIds, 
        clientIds 
      } = req.body || {};
      
      // Parse target date if provided
      let schedulingDate = new Date();
      if (targetDate) {
        schedulingDate = new Date(targetDate);
        console.log(`[API] Using custom target date for dry-run: ${schedulingDate.toISOString()}`);
      }
      
      const result = await runProjectSchedulingEnhanced('test', schedulingDate, { serviceIds, clientIds });
      
      res.json({
        message: "Test dry-run project scheduling completed",
        status: result.status,
        projectsCreated: result.projectsCreated, // Should be 0 for test runs
        servicesRescheduled: result.servicesRescheduled, // Should be 0 for test runs
        errorsEncountered: result.errorsEncountered,
        errors: result.errors,
        summary: result.summary,
        executionTimeMs: result.executionTimeMs,
        filters: { serviceIds, clientIds, targetDate: targetDate || 'current' },
        dryRun: true
      });
    } catch (error) {
      console.error("Error running test project scheduling:", error instanceof Error ? error.message : error);
      res.status(500).json({ 
        message: "Failed to run test project scheduling",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // POST /api/project-scheduling/seed-test-data - Seed test data with today's dates (admin only)
  app.post("/api/project-scheduling/seed-test-data", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      console.log(`[API] Test data seeding triggered by admin: ${req.user?.email}`);
      
      // Extract enhanced options from request body
      const { 
        clientIds, 
        serviceIds, 
        dryRun 
      } = req.body || {};
      
      const result = await seedTestServices({
        clientIds,
        serviceIds,
        dryRun: dryRun || false
      });
      
      res.json({
        message: "Test data seeding completed",
        status: result.status,
        clientServicesUpdated: result.clientServicesUpdated,
        errors: result.errors,
        summary: result.summary,
        dryRun: result.dryRun || false,
        options: { clientIds, serviceIds, dryRun }
      });
    } catch (error) {
      console.error("Error seeding test data:", error instanceof Error ? error.message : error);
      res.status(500).json({ 
        message: "Failed to seed test data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // POST /api/project-scheduling/reset-test-data - Reset test data (admin only)
  app.post("/api/project-scheduling/reset-test-data", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      console.log(`[API] Test data reset triggered by admin: ${req.user?.email}`);
      
      const result = await resetTestData();
      
      res.json({
        message: "Test data reset completed",
        status: result.status,
        info: result.message
      });
    } catch (error) {
      console.error("Error resetting test data:", error instanceof Error ? error.message : error);
      res.status(500).json({ 
        message: "Failed to reset test data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // POST /api/project-scheduling/mock-time-progression - Run mock time progression (admin only)
  app.post("/api/project-scheduling/mock-time-progression", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      console.log(`[API] Mock time progression triggered by admin: ${req.user?.email}`);
      
      const { 
        startDate, 
        endDate, 
        stepSize, 
        dryRun,
        serviceIds,
        clientIds 
      } = req.body || {};
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          message: "startDate and endDate are required" 
        });
      }
      
      const result = await runMockTimeProgression({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        stepSize: stepSize || 'daily',
        dryRun: dryRun || false,
        filters: {
          serviceIds,
          clientIds
        }
      });
      
      res.json({
        message: "Mock time progression completed",
        status: result.status,
        totalDaysSimulated: result.totalDaysSimulated,
        schedulingRuns: result.schedulingRuns,
        summary: result.summary,
        errors: result.errors,
        options: { startDate, endDate, stepSize, dryRun, serviceIds, clientIds }
      });
    } catch (error) {
      console.error("Error running mock time progression:", error instanceof Error ? error.message : error);
      res.status(500).json({ 
        message: "Failed to run mock time progression",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // POST /api/project-scheduling/generate-test-scenario - Generate test scenario (admin only)
  app.post("/api/project-scheduling/generate-test-scenario", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      console.log(`[API] Test scenario generation triggered by admin: ${req.user?.email}`);
      
      const { name, type, dryRun } = req.body || {};
      
      if (!name || !type) {
        return res.status(400).json({ 
          message: "name and type are required" 
        });
      }
      
      const result = await generateTestScenario({
        name,
        type,
        dryRun: dryRun || false
      });
      
      res.json({
        message: "Test scenario generated",
        status: result.status,
        scenarioName: result.scenarioName,
        description: result.description,
        servicesAffected: result.servicesAffected,
        recommendedTests: result.recommendedTests,
        summary: result.summary
      });
    } catch (error) {
      console.error("Error generating test scenario:", error instanceof Error ? error.message : error);
      res.status(500).json({ 
        message: "Failed to generate test scenario",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

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

      const data = await response.json();
      
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
      console.log(`Admin user ${effectiveUserId} initiated delete-test-data operation`);
      
      // Execute the deletion
      const deletionCounts = await storage.clearTestData();
      
      // Calculate total deleted records
      const totalDeleted = Object.values(deletionCounts).reduce((sum: number, count: number) => sum + count, 0);
      
      console.log(`Delete-test-data completed by user ${effectiveUserId}:`, {
        totalDeleted,
        details: deletionCounts
      });
      
      res.json({ 
        message: "Test data deleted successfully",
        totalDeleted,
        deletionCounts
      });
    } catch (error) {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      console.error(`Delete-test-data failed for user ${effectiveUserId}:`, error instanceof Error ? error.message : error);
      
      res.status(500).json({ 
        message: "Failed to delete test data",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
