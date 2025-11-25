import type { Express } from "express";
import { storage } from "../../storage/index";
import { z } from "zod";
import {
  insertClientServiceSchema,
  insertClientServiceRoleAssignmentSchema,
  insertClientTagSchema,
  insertClientTagAssignmentSchema,
} from "@shared/schema";
import {
  validateParams,
  paramUuidSchema,
  paramClientIdSchema,
  paramClientServiceIdSchema,
  paramServiceIdSchema,
} from "../routeHelpers";
import * as serviceMapper from "../../core/service-mapper";
import { scheduleServiceStartDateNotifications, cancelClientServiceNotifications } from "../../notification-scheduler";

export function registerClientServicesRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  // ==================================================
  // CLIENT SERVICES API ROUTES
  // ==================================================

  // GET /api/clients/:id/services - Get all services for a client
  app.get("/api/clients/:id/services", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
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

      try {
        const clientService = await serviceMapper.createClientServiceMapping(clientServiceData);

        console.log(`[Routes] Successfully created client service mapping: ${clientService.id}`);

        try {
          const fullClientService = await storage.getClientServiceById(clientService.id);
          
          if (fullClientService && fullClientService.nextStartDate) {
            const service = await storage.getServiceById(fullClientService.serviceId);
            
            if (!service || !service.projectTypeId) {
              console.warn(`[Notifications] Cannot schedule notifications - service ${fullClientService.serviceId} has no project type mapped`);
            } else {
              const allRelatedPeople = await storage.getClientPeopleByClientId(fullClientService.clientId);
              const peopleIds = allRelatedPeople.map(p => p.person.id);
              
              await scheduleServiceStartDateNotifications({
                clientServiceId: fullClientService.id,
                clientId: fullClientService.clientId,
                projectTypeId: service.projectTypeId,
                nextStartDate: fullClientService.nextStartDate,
                relatedPeople: peopleIds,
              });
              console.log(`[Notifications] Scheduled start_date notifications for client service ${fullClientService.id} (project type: ${service.projectTypeId}) with ${peopleIds.length} related people`);
            }
          }
        } catch (notifError) {
          console.error('[Notifications] Error scheduling notifications for client service:', notifError);
        }

        return res.status(201).json(clientService);
      } catch (mapperError: any) {
        console.error('[Routes] Service mapper error:', mapperError);

        if (mapperError.message?.includes('not found')) {
          return res.status(404).json({ message: mapperError.message });
        }
        if (mapperError.message?.includes('already exists')) {
          return res.status(409).json({
            message: mapperError.message,
            code: "DUPLICATE_CLIENT_SERVICE_MAPPING"
          });
        }
        if (mapperError.message?.includes('cannot be assigned') ||
            mapperError.message?.includes('Personal service')) {
          return res.status(400).json({ message: mapperError.message });
        }
        if (mapperError.message?.includes('CH') ||
            mapperError.message?.includes('Companies House')) {
          return res.status(400).json({ message: mapperError.message });
        }

        throw mapperError;
      }

    } catch (error: any) {
      console.error('[Routes] POST /api/client-services error:', error);

      if (error instanceof Error && (error as any).code === '23505') {
        return res.status(409).json({
          message: "Client service mapping already exists",
          code: "DUPLICATE_CLIENT_SERVICE_MAPPING"
        });
      }

      return res.status(500).json({
        message: "Failed to create client service",
        error: error.message || "An unexpected error occurred"
      });
    }
  });

  // GET /api/client-services/:id - Get single client service by ID
  app.get("/api/client-services/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = z.object({
        id: z.string().min(1, "Client service ID is required").uuid("Invalid client service ID format")
      }).safeParse(req.params);

      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client service ID format",
          errors: paramValidation.error.issues
        });
      }

      const { id } = paramValidation.data;

      const clientService = await storage.getClientServiceById(id);
      if (!clientService) {
        return res.status(404).json({ message: "Client service not found" });
      }

      res.status(200).json(clientService);

    } catch (error) {
      console.error("Error fetching client service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client service" });
    }
  });

  // PUT /api/client-services/:id - Update client service (manager or admin)
  app.put("/api/client-services/:id", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;

      const existingClientService = await storage.getClientServiceById(id);
      if (!existingClientService) {
        return res.status(404).json({ message: "Client service not found" });
      }

      console.log('[DEBUG] PUT /api/client-services/:id - Request body:', JSON.stringify(req.body, null, 2));

      const validationResult = insertClientServiceSchema.partial().passthrough().safeParse(req.body);

      console.log('[DEBUG] Validation result:', validationResult.success ? 'SUCCESS' : 'FAILED');
      if (validationResult.success) {
        console.log('[DEBUG] Validated data:', JSON.stringify(validationResult.data, null, 2));
      }

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid client service data",
          errors: validationResult.error.issues
        });
      }

      if (validationResult.data.inactiveReason && validationResult.data.isActive !== false) {
        return res.status(400).json({
          message: "Inactive reason can only be set when marking a service as inactive",
          errors: [{ field: "inactiveReason", message: "Cannot set inactive reason on an active service" }]
        });
      }

      if (validationResult.data.isActive === false && existingClientService.isActive !== false) {
        if (!validationResult.data.inactiveReason) {
          return res.status(400).json({
            message: "Inactive reason is required when marking a service as inactive",
            errors: [{ field: "inactiveReason", message: "This field is required when deactivating a service" }]
          });
        }

        validationResult.data.inactiveAt = new Date() as any;
        validationResult.data.inactiveByUserId = req.user?.effectiveUserId || req.user?.id;
        
        validationResult.data.nextStartDate = null as any;
        validationResult.data.nextDueDate = null as any;
        
        console.log(`[Routes] Service being marked inactive with reason: ${validationResult.data.inactiveReason}`);
      }

      if (validationResult.data.isActive === true && existingClientService.isActive === false) {
        validationResult.data.inactiveReason = null as any;
        validationResult.data.inactiveAt = null as any;
        validationResult.data.inactiveByUserId = null as any;
        
        console.log(`[Routes] Service being reactivated - clearing inactive metadata`);
      }

      if (validationResult.data.isActive === true || (validationResult.data.isActive === undefined && existingClientService.isActive !== false)) {
        if (!validationResult.data.inactiveReason) {
          validationResult.data.inactiveReason = null as any;
          validationResult.data.inactiveAt = null as any;
          validationResult.data.inactiveByUserId = null as any;
        }
      }

      try {
        const clientService = await serviceMapper.updateClientServiceMapping(id, validationResult.data);

        console.log(`[Routes] Successfully updated client service mapping: ${id}`);

        if (validationResult.data.isActive !== undefined && validationResult.data.isActive !== null &&
            validationResult.data.isActive !== existingClientService.isActive) {
          const service = await storage.getServiceById(clientService.serviceId);
          const eventType = validationResult.data.isActive ? 'service_activated' : 'service_deactivated';
          const fromValue = existingClientService.isActive?.toString() || 'true';
          const toValue = validationResult.data.isActive.toString();

          let changeReason: string;
          if (validationResult.data.isActive) {
            changeReason = `Service "${service?.name || 'Unknown'}" was reactivated`;
          } else {
            const inactiveReasonDisplay = validationResult.data.inactiveReason 
              ? validationResult.data.inactiveReason.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
              : 'No reason specified';
            changeReason = `Service "${service?.name || 'Unknown'}" was marked inactive - Reason: ${inactiveReasonDisplay}`;
          }

          await storage.createClientChronologyEntry({
            clientId: clientService.clientId,
            eventType,
            entityType: 'client_service',
            entityId: clientService.id,
            fromValue,
            toValue,
            userId: req.user?.effectiveUserId || req.user?.id,
            changeReason,
            notes: null,
          });
        }

        if (validationResult.data.serviceOwnerId !== undefined &&
            validationResult.data.serviceOwnerId !== existingClientService.serviceOwnerId) {
          console.log(`[Routes] Service owner changed from ${existingClientService.serviceOwnerId || 'null'} to ${validationResult.data.serviceOwnerId || 'null'}`);
          
          const projects = await storage.getProjectsByClientServiceId(id);
          const activeProjects = projects.filter(p => !p.inactive && !p.archived);
          
          console.log(`[Routes] Updating projectOwnerId on ${activeProjects.length} active projects`);
          
          for (const project of activeProjects) {
            await storage.updateProject(project.id, {
              projectOwnerId: validationResult.data.serviceOwnerId || null,
            });
            console.log(`[Routes] Updated project ${project.id} owner to ${validationResult.data.serviceOwnerId || 'null'}`);
          }
        }

        if (req.body.roleAssignments && Array.isArray(req.body.roleAssignments)) {
          console.log(`[Routes] Processing ${req.body.roleAssignments.length} role assignment updates`);
          
          for (const roleUpdate of req.body.roleAssignments) {
            const { id: assignmentId, userId: newUserId } = roleUpdate;
            
            const currentAssignment = await storage.getClientServiceRoleAssignmentById(assignmentId);
            
            if (!currentAssignment) {
              console.error(`[Routes] Invalid role assignment ID: ${assignmentId}`);
              continue;
            }
            
            const authoritativeOldUserId = currentAssignment.userId;
            
            if (newUserId !== authoritativeOldUserId) {
              console.log(`[Routes] Updating role assignment ${assignmentId}: ${authoritativeOldUserId || 'null'} -> ${newUserId || 'null'}`);
              
              await storage.updateClientServiceRoleAssignment(assignmentId, {
                userId: newUserId === null ? null : newUserId,
              });

              const projects = await storage.getProjectsByClientServiceId(id);
              const activeProjects = projects.filter(p => !p.inactive && !p.archived);

              console.log(`[Routes] Found ${activeProjects.length} active projects for task reassignment`);

              for (const project of activeProjects) {
                if (project.projectType?.id && project.currentStatus) {
                  const stages = await storage.getKanbanStagesByProjectTypeId(project.projectType.id);
                  const currentStage = stages.find(s => s.name === project.currentStatus);
                  
                  if (currentStage && currentStage.assignedWorkRoleId === currentAssignment.workRoleId) {
                    console.log(`[Routes] Project ${project.id} current stage "${project.currentStatus}" uses changed role - updating currentAssigneeId`);
                    
                    await storage.updateProject(project.id, {
                      currentAssigneeId: newUserId || null,
                    });
                    console.log(`[Routes] Updated project ${project.id} currentAssigneeId to ${newUserId || 'null'}`);
                  }
                }

                if (authoritativeOldUserId) {
                  const tasks = await storage.getInternalTasksByAssignee(authoritativeOldUserId);
                  
                  const projectTasks: any[] = [];
                  for (const task of tasks) {
                    const taskConnections = await storage.getTaskConnectionsByTaskId(task.id);
                    const hasProjectConnection = taskConnections.some(
                      conn => conn.entityType === 'project' && conn.entityId === project.id
                    );
                    if (hasProjectConnection) {
                      projectTasks.push(task);
                    }
                  }

                  console.log(`[Routes] Found ${projectTasks.length} tasks to reassign from ${authoritativeOldUserId} for project ${project.id}`);

                  for (const task of projectTasks) {
                    await storage.updateInternalTask(task.id, {
                      assignedTo: newUserId || null,
                    });
                    console.log(`[Routes] ${newUserId ? `Reassigned task ${task.id} to ${newUserId}` : `Unassigned task ${task.id}`}`);
                  }
                }
              }
            }
          }
        }

        try {
          const fullClientService = await storage.getClientServiceById(id);
          
          if (fullClientService && fullClientService.nextStartDate) {
            const service = await storage.getServiceById(fullClientService.serviceId);
            
            if (!service || !service.projectTypeId) {
              console.warn(`[Notifications] Cannot update notifications - service ${fullClientService.serviceId} has no project type mapped`);
            } else {
              const allRelatedPeople = await storage.getClientPeopleByClientId(fullClientService.clientId);
              const peopleIds = allRelatedPeople.map(p => p.person.id);
              
              await scheduleServiceStartDateNotifications({
                clientServiceId: fullClientService.id,
                clientId: fullClientService.clientId,
                projectTypeId: service.projectTypeId,
                nextStartDate: fullClientService.nextStartDate,
                relatedPeople: peopleIds,
              });
              console.log(`[Notifications] Updated start_date scheduled notifications for client service ${fullClientService.id} (project type: ${service.projectTypeId}) with ${peopleIds.length} related people`);
            }
          }
        } catch (notifError) {
          console.error('[Notifications] Error updating notifications for client service:', notifError);
        }

        const updatedClientService = await storage.getClientServiceById(id);
        return res.json(updatedClientService);
      } catch (mapperError: any) {
        console.error('[Routes] Service mapper error:', mapperError);

        if (mapperError.message?.includes('not found')) {
          return res.status(404).json({ message: mapperError.message });
        }
        if (mapperError.message?.includes('already exists')) {
          return res.status(409).json({ message: mapperError.message });
        }
        if (mapperError.message?.includes('cannot be assigned') ||
            mapperError.message?.includes('Personal service')) {
          return res.status(400).json({ message: mapperError.message });
        }

        throw mapperError;
      }
    } catch (error) {
      console.error("Error updating client service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to update client service" });
    }
  });

  // DELETE /api/client-services/:id - Delete client service (admin only)
  app.delete("/api/client-services/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramUuidSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { id } = req.params;

      const existingClientService = await storage.getClientServiceById(id);
      if (!existingClientService) {
        return res.status(404).json({ message: "Client service not found" });
      }

      try {
        await cancelClientServiceNotifications(
          id,
          req.user?.effectiveUserId || req.user?.id || 'system',
          'Client service deleted'
        );
        console.log(`[Notifications] Cancelled notifications for client service ${id}`);
      } catch (cleanupError) {
        console.error('[Notifications] Error cleaning up notifications:', cleanupError);
      }

      await storage.deleteClientService(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting client service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to delete client service" });
    }
  });

  // GET /api/client-services/:id/projects - Get all projects for a client service
  app.get("/api/client-services/:id/projects", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = z.object({
        id: z.string().min(1, "Client service ID is required").uuid("Invalid client service ID format")
      }).safeParse(req.params);

      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid client service ID format",
          errors: paramValidation.error.issues
        });
      }

      const { id } = paramValidation.data;

      const clientService = await storage.getClientServiceById(id);
      if (!clientService) {
        return res.status(404).json({ message: "Client service not found" });
      }

      const projects = await storage.getProjectsByClientServiceId(id);

      res.status(200).json(projects);

    } catch (error) {
      console.error("Error fetching projects for client service:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // GET /api/client-services/:clientServiceId/role-assignments - Get role assignments for client service
  app.get("/api/client-services/:clientServiceId/role-assignments", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramValidation = validateParams(paramClientServiceIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { clientServiceId } = req.params;

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
      const paramValidation = validateParams(paramClientServiceIdSchema, req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: "Invalid path parameters",
          errors: paramValidation.errors
        });
      }

      const { clientServiceId } = req.params;

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

      if (error instanceof Error && (error as any).code === '23505') {
        return res.status(409).json({
          message: "Role assignment already exists for this client service and work role",
          code: "DUPLICATE_ROLE_ASSIGNMENT"
        });
      }

      res.status(500).json({ message: "Failed to create role assignment" });
    }
  });

  // GET /api/clients/:clientId/service-role-completeness - Check if client has complete role assignments
  app.get("/api/clients/:clientId/service-role-completeness", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;

      if (!clientId || typeof clientId !== 'string') {
        return res.status(400).json({ message: "Valid client ID is required" });
      }

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

      const mappingExists = await storage.checkClientServiceMappingExists(clientId, serviceId);
      if (!mappingExists) {
        return res.status(404).json({
          message: "Client service mapping not found",
          code: "CLIENT_SERVICE_NOT_MAPPED"
        });
      }

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

  // ==================================================
  // CLIENT TAGS API ROUTES
  // ==================================================

  // GET /api/client-tags - Get all client tags (admin only)
  app.get("/api/client-tags", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const tags = await storage.getAllClientTags();
      res.json(tags);
    } catch (error) {
      console.error("Error fetching client tags:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client tags" });
    }
  });

  // POST /api/client-tags - Create client tag (admin only)
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

  // DELETE /api/client-tags/:id - Delete client tag (admin only)
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

  // GET /api/client-tag-assignments - Get all client tag assignments
  app.get("/api/client-tag-assignments", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const assignments = await storage.getAllClientTagAssignments();
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching client tag assignments:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch client tag assignments" });
    }
  });

  // GET /api/clients/:clientId/tags - Get tags for a specific client
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

  // POST /api/clients/:clientId/tags - Assign tag to client (admin only)
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

  // DELETE /api/clients/:clientId/tags/:tagId - Remove tag from client (admin only)
  app.delete("/api/clients/:clientId/tags/:tagId", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const clientValidation = validateParams(paramClientIdSchema, req.params);
      const tagValidation = validateParams(z.object({ tagId: z.string().uuid() }), req.params);

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
}
