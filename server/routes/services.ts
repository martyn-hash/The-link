import type { Express } from "express";
import { storage } from "../storage/index";
import { z } from "zod";
import {
  insertServiceSchema,
  updateServiceSchema,
  insertWorkRoleSchema,
  insertServiceRoleSchema,
  insertClientServiceRoleAssignmentSchema,
} from "@shared/schema";
import { 
  validateVatNumber, 
  isHmrcConfigured,
  isVatValidationEnabled,
  VAT_NUMBER_REGEX,
  VAT_NUMBER_REGEX_ERROR,
  VAT_UDF_FIELD_ID,
  VAT_UDF_FIELD_NAME,
  VAT_ADDRESS_UDF_FIELD_ID,
  VAT_ADDRESS_UDF_FIELD_NAME
} from "../hmrc-vat-service";

// Parameter validation schemas
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

export function registerServiceRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
): void {
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

  // GET /api/services/with-active-clients - Get services that have active client services
  app.get("/api/services/with-active-clients", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const services = await storage.getServicesWithActiveClients();
      res.json(services);
    } catch (error) {
      console.error("Error fetching services with active clients:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch services with active clients" });
    }
  });

  // GET /api/services/:serviceId/kanban-stages - Get kanban stages for a service
  app.get("/api/services/:serviceId/kanban-stages", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { serviceId } = req.params;
      const stages = await storage.getKanbanStagesByServiceId(serviceId);
      res.json(stages);
    } catch (error) {
      console.error("Error fetching kanban stages for service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch kanban stages" });
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

  // GET /api/services/project-type-assignable - Get services that can be mapped to project types (excludes personal and static services)
  app.get("/api/services/project-type-assignable", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const services = await storage.getProjectTypeAssignableServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching project-type-assignable services:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch project-type-assignable services" });
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

  // GET /api/work-roles - Get all work roles (admin only for management)
  app.get("/api/work-roles", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const workRoles = await storage.getAllWorkRoles();
      res.json(workRoles);
    } catch (error) {
      console.error("Error fetching work roles:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch work roles" });
    }
  });

  // GET /api/work-roles/active - Get work roles (read-only for all authenticated users)
  app.get("/api/work-roles/active", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
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
  // ROLE ASSIGNMENTS API ROUTES
  // ==================================================

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
  // HMRC VAT VALIDATION ROUTES
  // ==================================================

  // GET /api/vat/status - Check if HMRC VAT validation is configured
  app.get("/api/vat/status", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    res.json({ 
      configured: isHmrcConfigured(),
      validationEnabled: isVatValidationEnabled(),
      vatUdfFieldId: VAT_UDF_FIELD_ID,
      vatUdfFieldName: VAT_UDF_FIELD_NAME,
      vatAddressUdfFieldId: VAT_ADDRESS_UDF_FIELD_ID,
      vatAddressUdfFieldName: VAT_ADDRESS_UDF_FIELD_NAME,
      vatNumberRegex: VAT_NUMBER_REGEX,
      vatNumberRegexError: VAT_NUMBER_REGEX_ERROR,
    });
  });

  // POST /api/vat/validate - Validate a UK VAT number
  app.post("/api/vat/validate", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { vatNumber } = req.body;
      
      if (!vatNumber) {
        return res.status(400).json({ message: "VAT number is required" });
      }

      const result = await validateVatNumber(vatNumber);
      res.json(result);
    } catch (error) {
      console.error("Error validating VAT number:", error instanceof Error ? error.message : error);
      res.status(500).json({ 
        isValid: false,
        error: "Failed to validate VAT number",
        errorCode: "SERVER_ERROR"
      });
    }
  });

  // POST /api/client-services/:clientServiceId/validate-vat - Validate VAT for a client service and store result
  app.post("/api/client-services/:clientServiceId/validate-vat", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clientServiceId } = req.params;
      
      // Get the client service
      const clientService = await storage.getClientServiceById(clientServiceId);
      if (!clientService) {
        return res.status(404).json({ message: "Client service not found" });
      }

      // Get the service to check if it's a VAT service
      const service = await storage.getServiceById(clientService.serviceId);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }

      if (!service.isVatService) {
        return res.status(400).json({ message: "This service is not configured as a VAT service" });
      }

      // Get the VAT number from UDF values
      const udfValues = (clientService.udfValues || {}) as Record<string, any>;
      const vatNumber = udfValues[VAT_UDF_FIELD_ID];
      
      if (!vatNumber) {
        return res.status(400).json({ message: "No VAT number found for this client service" });
      }

      // Validate with HMRC
      const result = await validateVatNumber(vatNumber);

      // Format the full address with postcode for multi-line display
      let fullAddress = '';
      if (result.isValid && result.address) {
        fullAddress = result.address;
        if (result.postcode) {
          fullAddress += '\n' + result.postcode;
        }
      }

      // Update the UDF values with validation metadata and address
      const updatedUdfValues = {
        ...udfValues,
        [`${VAT_UDF_FIELD_ID}_validation`]: {
          isValid: result.isValid,
          bypassed: result.bypassed,
          validatedAt: result.validatedAt || new Date().toISOString(),
          companyName: result.companyName,
          address: result.address,
          postcode: result.postcode,
          error: result.error,
          errorCode: result.errorCode,
        },
        [VAT_ADDRESS_UDF_FIELD_ID]: result.isValid && !result.bypassed ? fullAddress : (udfValues[VAT_ADDRESS_UDF_FIELD_ID] || ''),
      };

      // Update the client service with validation results
      await storage.updateClientService(clientServiceId, { udfValues: updatedUdfValues });

      res.json({
        ...result,
        clientServiceId,
        vatNumber,
      });
    } catch (error) {
      console.error("Error validating VAT for client service:", error instanceof Error ? error.message : error);
      res.status(500).json({ 
        isValid: false,
        error: "Failed to validate VAT number",
        errorCode: "SERVER_ERROR"
      });
    }
  });

  // ==================================================
  // SERVICE ASSIGNMENTS API ROUTES
  // ==================================================

  // GET /api/service-assignments/client - Get client service assignments with filters
  app.get("/api/service-assignments/client", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { serviceId, roleId, userId, serviceOwnerId, showInactive } = req.query;
      
      const filters = {
        serviceId: serviceId && serviceId !== 'all' ? serviceId : undefined,
        roleId: roleId && roleId !== 'all' ? roleId : undefined,
        userId: userId && userId !== 'all' ? userId : undefined,
        serviceOwnerId: serviceOwnerId && serviceOwnerId !== 'all' ? serviceOwnerId : undefined,
        showInactive: showInactive === 'true',
      };

      const assignments = await storage.getServiceAssignmentsWithFilters(filters);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching client service assignments:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client service assignments" });
    }
  });

  // GET /api/service-assignments/personal - Get personal service assignments with filters
  app.get("/api/service-assignments/personal", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { serviceId, serviceOwnerId, showInactive } = req.query;
      
      const filters = {
        serviceId: serviceId && serviceId !== 'all' ? serviceId : undefined,
        serviceOwnerId: serviceOwnerId && serviceOwnerId !== 'all' ? serviceOwnerId : undefined,
        showInactive: showInactive === 'true',
      };

      const assignments = await storage.getPersonalServiceAssignmentsWithFilters(filters);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching personal service assignments:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch personal service assignments" });
    }
  });

  // ==================================================
  // SERVICE ASSIGNMENT VIEWS API ROUTES
  // ==================================================

  // GET /api/service-assignment-views - Get user's saved views
  app.get("/api/service-assignment-views", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user?.effectiveUserId || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const views = await storage.getServiceAssignmentViewsByUserId(userId);
      res.json(views);
    } catch (error) {
      console.error("Error fetching service assignment views:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch service assignment views" });
    }
  });

  // POST /api/service-assignment-views - Create a new saved view
  app.post("/api/service-assignment-views", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user?.effectiveUserId || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { name, filters } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }

      // Validate filters using Zod schema
      const { serviceAssignmentViewFiltersSchema } = await import('@shared/schema');
      const validatedFilters = serviceAssignmentViewFiltersSchema.safeParse(filters || {});
      
      if (!validatedFilters.success) {
        return res.status(400).json({ 
          message: "Invalid filter format",
          errors: validatedFilters.error.errors
        });
      }

      const view = await storage.createServiceAssignmentView({
        userId,
        name,
        filters: validatedFilters.data,
      });

      res.status(201).json(view);
    } catch (error) {
      console.error("Error creating service assignment view:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to create service assignment view" });
    }
  });

  // DELETE /api/service-assignment-views/:id - Delete a saved view
  app.delete("/api/service-assignment-views/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user?.effectiveUserId || req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify ownership
      const view = await storage.getServiceAssignmentViewById(id);
      if (!view) {
        return res.status(404).json({ message: "View not found" });
      }
      
      if (view.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this view" });
      }

      await storage.deleteServiceAssignmentView(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting service assignment view:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to delete service assignment view" });
    }
  });

  // ==================================================
  // BULK ROLE REASSIGNMENT API ROUTES
  // ==================================================

  // POST /api/service-assignments/bulk-reassign - Bulk reassign roles (admin only)
  app.post("/api/service-assignments/bulk-reassign", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const userId = req.user?.effectiveUserId || req.user?.id;
      const { clientServiceIds, fromRoleId, toUserId } = req.body;

      if (!clientServiceIds || !Array.isArray(clientServiceIds) || clientServiceIds.length === 0) {
        return res.status(400).json({ message: "Client service IDs are required" });
      }

      if (!fromRoleId) {
        return res.status(400).json({ message: "Role ID is required" });
      }

      if (!toUserId) {
        return res.status(400).json({ message: "Target user ID is required" });
      }

      const result = await storage.bulkReassignRole({
        clientServiceIds,
        fromRoleId,
        toUserId,
        performedByUserId: userId,
      });

      res.json(result);
    } catch (error) {
      console.error("Error in bulk role reassignment:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to complete bulk role reassignment" });
    }
  });

  // ==================================================
  // BULK DATE UPDATE API ROUTES
  // ==================================================

  // POST /api/service-assignments/bulk-update-dates - Bulk update service dates (admin only)
  app.post("/api/service-assignments/bulk-update-dates", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { serviceIds, serviceType, mode, shiftDays, startDate, dueDate, targetDate, target } = req.body;

      if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
        return res.status(400).json({ message: "Service IDs are required" });
      }

      if (!serviceType || !['client', 'personal'].includes(serviceType)) {
        return res.status(400).json({ message: "Valid service type is required (client or personal)" });
      }

      if (!mode || !['shift', 'set'].includes(mode)) {
        return res.status(400).json({ message: "Valid mode is required (shift or set)" });
      }

      if (!target || !['start', 'due', 'target', 'both', 'all'].includes(target)) {
        return res.status(400).json({ message: "Valid target is required (start, due, target, both, or all)" });
      }

      if (mode === 'shift' && (typeof shiftDays !== 'number' || shiftDays === 0)) {
        return res.status(400).json({ message: "Shift days must be a non-zero number" });
      }

      if (mode === 'set') {
        if (target === 'start' && !startDate) {
          return res.status(400).json({ message: "Start date is required" });
        }
        if (target === 'due' && !dueDate) {
          return res.status(400).json({ message: "Due date is required" });
        }
        if (target === 'target' && !targetDate) {
          return res.status(400).json({ message: "Target delivery date is required" });
        }
        if (target === 'both' && (!startDate || !dueDate)) {
          return res.status(400).json({ message: "Both start and due dates are required" });
        }
        if (target === 'all' && (!startDate || !dueDate || !targetDate)) {
          return res.status(400).json({ message: "All dates (start, due, and target) are required" });
        }
      }

      const result = await storage.bulkUpdateServiceDates({
        serviceIds,
        serviceType,
        mode,
        shiftDays,
        startDate,
        dueDate,
        targetDate,
        target,
      });

      res.json(result);
    } catch (error) {
      console.error("Error in bulk date update:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to complete bulk date update" });
    }
  });
}
