import type { Express } from "express";
import { storage } from "../storage";
import { z } from "zod";
import {
  insertProjectTypeNotificationSchema,
  updateProjectTypeNotificationSchema,
  insertClientRequestReminderSchema,
  updateClientRequestReminderSchema,
  type ScheduledNotification,
  type Client,
  type Project,
  type ProjectType,
  type Service,
  type ClientService,
  type CompanySettings,
} from "@shared/schema";
import { scheduleServiceStartDateNotifications, scheduleProjectDueDateNotifications } from "../notification-scheduler";
import type { NotificationVariableContext } from "../notification-variables";

// Parameter validation schemas
const paramNotificationIdSchema = z.object({
  notificationId: z.string().min(1, "Notification ID is required").uuid("Invalid notification ID format")
});

const paramReminderIdSchema = z.object({
  reminderId: z.string().min(1, "Reminder ID is required").uuid("Invalid reminder ID format")
});

const paramScheduledNotificationIdSchema = z.object({
  scheduledNotificationId: z.string().min(1, "Scheduled notification ID is required").uuid("Invalid scheduled notification ID format")
});

const paramProjectTypeIdSchema = z.object({
  projectTypeId: z.string().min(1, "Project type ID is required").uuid("Invalid project type ID format")
});

// Helper function for parameter validation
const validateParams = <T>(schema: z.ZodSchema<T>, params: any): { success: true; data: T } | { success: false; errors: any[] } => {
  const result = schema.safeParse(params);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: result.error.issues };
};

// Helper function to build notification variable context from database models
function buildNotificationContext(params: {
  client: Client;
  project: Project;
  projectType: ProjectType;
  service?: Service;
  clientService?: ClientService;
  companySettings?: CompanySettings;
}): NotificationVariableContext {
  const { client, project, projectType, service, clientService, companySettings } = params;
  
  return {
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      clientType: client.clientType,
      financialYearEnd: null, // Not present in schema
    },
    project: {
      id: project.id,
      description: project.description || "",
      projectTypeName: projectType.name,
      currentStatus: project.currentStatus || "in_progress",
      startDate: null, // Not present in schema
      dueDate: project.dueDate,
    },
    service: service && clientService ? {
      name: service.name,
      description: service.description,
      frequency: clientService.frequency,
      nextStartDate: clientService.nextStartDate,
      nextDueDate: clientService.nextDueDate,
    } : undefined,
    firmSettings: companySettings ? {
      firmName: companySettings.firmName || "",
      firmPhone: companySettings.firmPhone,
      firmEmail: companySettings.firmEmail,
      portalUrl: companySettings.portalUrl,
    } : undefined,
  };
}

export function registerNotificationRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
): void {
  
  // ==================== Project Type Notifications ====================
  
  // CRITICAL MIGRATION: Fix legacy due_date notifications
  // This endpoint cancels all scheduled due_date notifications with projectId=null
  // and recreates them properly linked to projects
  // MUST BE RUN ONCE BEFORE DEPLOYING THE NEW NOTIFICATION SYSTEM
  // SAFE TO RUN MULTIPLE TIMES (idempotent)
  app.post("/api/admin/migrate-due-date-notifications", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const dryRun = req.query.dryRun === 'true';
      console.log(`[Migration] Starting due_date notification migration... ${dryRun ? '(DRY RUN)' : ''}`);
      
      // Step 1: Find all due_date notifications with projectId=null (both scheduled AND cancelled for retry safety)
      const db = (await import("../db")).db;
      const { scheduledNotifications: snTable, projectTypeNotifications: ptnTable } = await import("@shared/schema");
      const { eq, and, isNull, or } = await import("drizzle-orm");
      
      const legacyNotifications = await db
        .select({
          scheduledNotification: snTable,
          projectTypeNotification: ptnTable,
        })
        .from(snTable)
        .innerJoin(ptnTable, eq(snTable.projectTypeNotificationId, ptnTable.id))
        .where(
          and(
            isNull(snTable.projectId),
            eq(ptnTable.dateReference, "due_date"),
            eq(ptnTable.category, "project"),
            or(
              eq(snTable.status, "scheduled"),
              and(
                eq(snTable.status, "cancelled"),
                eq(snTable.cancelReason, "Legacy due_date notification migrated to project-based system")
              )
            )
          )
        );
      
      console.log(`[Migration] Found ${legacyNotifications.length} legacy due_date notification(s) to migrate`);
      
      if (legacyNotifications.length === 0) {
        return res.json({
          success: true,
          message: "No legacy due_date notifications found. Migration not needed or already complete.",
          legacyCount: 0,
          cancelledCount: 0,
          rescheduledCount: 0,
          errors: 0,
          dryRun
        });
      }
      
      if (dryRun) {
        // Just return what would be done
        const activeProjects = (await storage.getAllProjects()).filter(p => p.dueDate && !p.archived && !p.inactive);
        return res.json({
          success: true,
          message: `DRY RUN: Would cancel ${legacyNotifications.length} legacy notification(s) and reschedule ${activeProjects.length} project(s)`,
          legacyCount: legacyNotifications.length,
          cancelledCount: 0,
          rescheduledCount: 0,
          errors: 0,
          dryRun: true
        });
      }
      
      // Step 2: Get all active projects FIRST (before cancelling) so we can reschedule even if cancellation fails
      const allProjects = await storage.getAllProjects();
      const activeProjects = allProjects.filter(p => p.dueDate && !p.archived && !p.inactive);
      
      console.log(`[Migration] Found ${activeProjects.length} active project(s) to reschedule`);
      
      // Build reschedule plan
      const rescheduleplan: Array<{ project: any; clientService: any }> = [];
      for (const project of activeProjects) {
        const service = await storage.getServiceByProjectTypeId(project.projectTypeId);
        if (!service) {
          console.warn(`[Migration] No service found for project type ${project.projectTypeId}, skipping project ${project.id}`);
          continue;
        }
        
        const clientServices = await storage.getClientServicesByServiceId(service.id);
        const clientService = clientServices.find(cs => cs.clientId === project.clientId);
        
        if (!clientService) {
          console.warn(`[Migration] No client service found for project ${project.id}, skipping`);
          continue;
        }
        
        rescheduleplan.push({
          project,
          clientService
        });
      }
      
      console.log(`[Migration] Prepared reschedule plan for ${rescheduleplan.length} project(s)`);
      
      // Step 3: Reschedule FIRST (idempotent - scheduleProjectDueDateNotifications deletes old ones)
      // This ensures we don't lose notifications if migration fails
      let rescheduled = 0;
      let errors = 0;
      const rescheduledProjectIds = new Set<string>();
      
      // Cache peopleIds per client to avoid redundant DB queries
      const clientPeopleCache = new Map<string, string[]>();
      
      for (const { project, clientService } of rescheduleplan) {
        try {
          // Fetch peopleIds for this client (with caching)
          let peopleIds = clientPeopleCache.get(project.clientId);
          if (!peopleIds) {
            const allRelatedPeople = await storage.getClientPeopleByClientId(project.clientId);
            peopleIds = allRelatedPeople.map(p => p.person.id);
            clientPeopleCache.set(project.clientId, peopleIds);
          }
          
          await scheduleProjectDueDateNotifications({
            projectId: project.id,
            clientServiceId: clientService.id,
            clientId: project.clientId,
            projectTypeId: project.projectTypeId,
            dueDate: project.dueDate!,
            relatedPeople: peopleIds,
          });
          
          rescheduledProjectIds.add(project.id);
          rescheduled++;
          console.log(`[Migration] Rescheduled project ${project.id}`);
        } catch (error) {
          console.error(`[Migration] Error rescheduling project ${project.id}:`, error);
          errors++;
          // Continue with other projects even if one fails
        }
      }
      
      console.log(`[Migration] Rescheduled ${rescheduled} project(s), ${errors} error(s)`);
      
      // Build set of clientServiceIds that were successfully rescheduled
      const rescheduledClientServiceIds = new Set(
        Array.from(rescheduledProjectIds).flatMap(projectId => {
          const plan = rescheduleplan.find(item => item.project.id === projectId);
          return plan ? [plan.clientService.id] : [];
        })
      );
      
      console.log(`[Migration] Successfully rescheduled ${rescheduledClientServiceIds.size} unique client service(s)`);
      
      // Step 4: Cancel ONLY legacy notifications for successfully rescheduled projects
      // This prevents data loss for projects that were skipped during reschedule
      let cancelledCount = 0;
      let skippedCount = 0;
      const adminUser = await storage.getUserByEmail('admin@example.com');
      const cancelledBy = adminUser?.id || req.user?.id || 'system';
      
      for (const legacyNotif of legacyNotifications) {
        const clientServiceId = legacyNotif.scheduledNotification.clientServiceId;
        
        // Cancel if: (1) orphaned (no clientServiceId), OR (2) clientService was successfully rescheduled
        const shouldCancel = !clientServiceId || rescheduledClientServiceIds.has(clientServiceId);
        
        if (shouldCancel) {
          try {
            await db
              .update(snTable)
              .set({
                status: 'cancelled',
                cancelledBy,
                cancelledAt: new Date(),
                cancelReason: 'Legacy due_date notification migrated to project-based system',
                updatedAt: new Date(),
              })
              .where(eq(snTable.id, legacyNotif.scheduledNotification.id));
            cancelledCount++;
          } catch (error) {
            console.error(`[Migration] Error cancelling legacy notification ${legacyNotif.scheduledNotification.id}:`, error);
          }
        } else {
          // Keep legacy notification because project couldn't be rescheduled
          console.warn(`[Migration] Keeping legacy notification ${legacyNotif.scheduledNotification.id} - project not rescheduled`);
          skippedCount++;
        }
      }
      
      console.log(`[Migration] Cancelled ${cancelledCount} legacy due_date notification(s), kept ${skippedCount} (project not rescheduled)`);
      
      const totalLegacy = legacyNotifications.length;
      const message = `Migration complete! Rescheduled ${rescheduled}/${rescheduleplan.length} project(s), cancelled ${cancelledCount}/${totalLegacy} legacy notification(s), kept ${skippedCount}. ${errors} error(s).`;
      console.log(`[Migration] ${message}`);
      
      // Check for any remaining duplicates
      const remainingLegacy = skippedCount;
      const warningMessage = remainingLegacy > 0 
        ? `WARNING: ${remainingLegacy} legacy notification(s) could not be cancelled. Rerun migration to complete cleanup.`
        : 'Migration fully complete - no legacy notifications remaining.';
      
      console.log(`[Migration] ${warningMessage}`);
      
      res.json({
        success: true,
        message,
        warningMessage: remainingLegacy > 0 ? warningMessage : undefined,
        legacyCount: legacyNotifications.length,
        cancelledCount,
        remainingLegacy,
        rescheduledCount: rescheduled,
        plannedReschedules: rescheduleplan.length,
        errors,
        dryRun: false
      });
    } catch (error) {
      console.error("Error during due_date notification migration:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Migration failed - all changes rolled back", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });
  
  // Manually trigger re-scheduling of all notifications for a project type
  app.post("/api/project-types/:projectTypeId/reschedule-notifications", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramProjectTypeIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid project type ID", errors: validation.errors });
      }

      const { projectTypeId } = validation.data;
      
      // Verify project type exists
      const projectType = await storage.getProjectTypeById(projectTypeId);
      if (!projectType) {
        return res.status(404).json({ message: "Project type not found" });
      }

      console.log(`[Notifications] Manual re-scheduling triggered for project type ${projectTypeId}`);
      
      // Get the service for this project type
      const service = await storage.getServiceByProjectTypeId(projectTypeId);
      if (!service) {
        return res.status(404).json({ message: "No service found for this project type" });
      }

      // Get all client services
      const clientServices = await storage.getClientServicesByServiceId(service.id);
      console.log(`[Notifications] Found ${clientServices.length} client service(s) to re-schedule`);
      
      // Cache peopleIds per client to avoid redundant DB queries
      const clientPeopleCache = new Map<string, string[]>();
      
      let serviceScheduled = 0;
      let serviceSkipped = 0;
      let serviceErrors = 0;
      
      // Schedule start_date notifications for services
      for (const clientService of clientServices) {
        if (clientService.nextStartDate) {
          try {
            // Fetch peopleIds for this client (with caching)
            let peopleIds = clientPeopleCache.get(clientService.clientId);
            if (!peopleIds) {
              const allRelatedPeople = await storage.getClientPeopleByClientId(clientService.clientId);
              peopleIds = allRelatedPeople.map(p => p.person.id);
              clientPeopleCache.set(clientService.clientId, peopleIds);
            }
            
            await scheduleServiceStartDateNotifications({
              clientServiceId: clientService.id,
              clientId: clientService.clientId,
              projectTypeId: projectTypeId,
              nextStartDate: clientService.nextStartDate,
              relatedPeople: peopleIds,
            });
            serviceScheduled++;
          } catch (scheduleError) {
            console.error(`[Notifications] Error scheduling for client service ${clientService.id}:`, scheduleError);
            serviceErrors++;
          }
        } else {
          serviceSkipped++;
        }
      }
      
      // Schedule due_date notifications for existing projects
      const allProjects = await storage.getAllProjects();
      const projectsForType = allProjects.filter(
        p => p.projectTypeId === projectTypeId && p.dueDate && !p.archived && !p.inactive
      );
      console.log(`[Notifications] Found ${projectsForType.length} active project(s) to re-schedule due_date notifications`);
      
      let projectScheduled = 0;
      let projectSkipped = 0;
      let projectErrors = 0;
      
      for (const project of projectsForType) {
        try {
          // Find the client service for this project
          const clientService = clientServices.find(cs => cs.clientId === project.clientId);
          if (clientService) {
            // Fetch peopleIds for this client (with caching)
            let peopleIds = clientPeopleCache.get(project.clientId);
            if (!peopleIds) {
              const allRelatedPeople = await storage.getClientPeopleByClientId(project.clientId);
              peopleIds = allRelatedPeople.map(p => p.person.id);
              clientPeopleCache.set(project.clientId, peopleIds);
            }
            
            await scheduleProjectDueDateNotifications({
              projectId: project.id,
              clientServiceId: clientService.id,
              clientId: project.clientId,
              projectTypeId: projectTypeId,
              dueDate: project.dueDate!,
              relatedPeople: peopleIds,
            });
            projectScheduled++;
          } else {
            projectSkipped++;
          }
        } catch (scheduleError) {
          console.error(`[Notifications] Error scheduling for project ${project.id}:`, scheduleError);
          projectErrors++;
        }
      }
      
      const message = `Re-scheduled start_date notifications for ${serviceScheduled} service(s) (${serviceSkipped} skipped, ${serviceErrors} errors). Re-scheduled due_date notifications for ${projectScheduled} project(s) (${projectSkipped} skipped, ${projectErrors} errors).`;
      console.log(`[Notifications] ${message}`);
      
      res.json({ 
        success: true, 
        message,
        serviceScheduled,
        serviceSkipped,
        serviceErrors,
        projectScheduled,
        projectSkipped,
        projectErrors,
        totalServices: clientServices.length,
        totalProjects: projectsForType.length
      });
    } catch (error) {
      console.error("Error manually re-scheduling notifications:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to re-schedule notifications" });
    }
  });
  
  // Get all notifications for a project type
  app.get("/api/project-types/:projectTypeId/notifications", isAuthenticated, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramProjectTypeIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid project type ID", errors: validation.errors });
      }

      const { projectTypeId } = validation.data;
      const notifications = await storage.getProjectTypeNotificationsByProjectTypeId(projectTypeId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching project type notifications:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });
  
  // Get a single notification by ID
  app.get("/api/project-types/:projectTypeId/notifications/:notificationId", isAuthenticated, async (req: any, res: any) => {
    try {
      const projectTypeValidation = validateParams(paramProjectTypeIdSchema, req.params);
      if (!projectTypeValidation.success) {
        return res.status(400).json({ message: "Invalid project type ID", errors: projectTypeValidation.errors });
      }
      
      const notificationValidation = validateParams(paramNotificationIdSchema, req.params);
      if (!notificationValidation.success) {
        return res.status(400).json({ message: "Invalid notification ID", errors: notificationValidation.errors });
      }

      const { projectTypeId } = projectTypeValidation.data;
      const { notificationId } = notificationValidation.data;
      
      const notification = await storage.getProjectTypeNotificationById(notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      // Verify notification belongs to the specified project type
      if (notification.projectTypeId !== projectTypeId) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      res.json(notification);
    } catch (error) {
      console.error("Error fetching notification:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch notification" });
    }
  });
  
  // Get preview candidates (clients/people with active projects for previewing notifications)
  app.get("/api/project-types/:projectTypeId/preview-candidates", isAuthenticated, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramProjectTypeIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid project type ID", errors: validation.errors });
      }

      const { projectTypeId } = validation.data;
      
      // Parse query parameters
      const channel = req.query.channel as 'email' | 'sms' | 'push' | undefined;
      const search = req.query.search as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      
      // Validate channel if provided
      if (channel && !['email', 'sms', 'push'].includes(channel)) {
        return res.status(400).json({ message: "Invalid channel. Must be 'email', 'sms', or 'push'" });
      }
      
      console.log(`[Preview Candidates] Fetching for projectTypeId=${projectTypeId}, channel=${channel}, search=${search}`);
      
      // Get preview candidates from storage
      const result = await storage.getPreviewCandidates({
        projectTypeId,
        channel,
        search,
        limit,
        offset,
      });
      
      console.log(`[Preview Candidates] Found ${result.candidates.length} candidates, total=${result.total}`);
      res.json(result);
    } catch (error) {
      console.error("Error fetching preview candidates:", error instanceof Error ? error.message : error);
      console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: "Failed to fetch preview candidates" });
    }
  });
  
  // Preview a notification with variable replacements
  app.get("/api/project-types/:projectTypeId/notifications/:notificationId/preview", isAuthenticated, async (req: any, res: any) => {
    try {
      const projectTypeValidation = validateParams(paramProjectTypeIdSchema, req.params);
      if (!projectTypeValidation.success) {
        return res.status(400).json({ message: "Invalid project type ID", errors: projectTypeValidation.errors });
      }
      
      const notificationValidation = validateParams(paramNotificationIdSchema, req.params);
      if (!notificationValidation.success) {
        return res.status(400).json({ message: "Invalid notification ID", errors: notificationValidation.errors });
      }

      const { projectTypeId } = projectTypeValidation.data;
      const { notificationId } = notificationValidation.data;
      
      // Parse query parameters for two-step preview flow
      const personId = req.query.personId as string | undefined;
      const mode = req.query.mode as 'dummy' | undefined;
      
      // Get the notification
      const notification = await storage.getProjectTypeNotificationById(notificationId);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      // Verify notification belongs to project type
      if (notification.projectTypeId !== projectTypeId) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      // Validate stage ownership for stage-scoped notifications
      if (notification.category === 'stage' && notification.stageId) {
        const stage = await storage.getStageById(notification.stageId);
        if (!stage) {
          return res.status(404).json({ message: "Stage not found" });
        }
        
        // Validate stage belongs to the project type
        if (stage.projectTypeId !== projectTypeId) {
          return res.status(400).json({ message: "Stage does not belong to this project type" });
        }
      }
      
      // MODE 1: Dummy data preview
      if (mode === 'dummy') {
        const { generateDummyVariableContext, processNotificationVariables } = await import("../notification-variables");
        const dummyContext = generateDummyVariableContext();
        
        // Process content with dummy data
        let processedContent: any = {};
        
        if (notification.notificationType === 'email') {
          processedContent = {
            type: 'email',
            emailTitle: processNotificationVariables(notification.emailTitle || '', dummyContext),
            emailBody: processNotificationVariables(notification.emailBody || '', dummyContext)
          };
        } else if (notification.notificationType === 'sms') {
          processedContent = {
            type: 'sms',
            smsContent: processNotificationVariables(notification.smsContent || '', dummyContext)
          };
        } else if (notification.notificationType === 'push') {
          processedContent = {
            type: 'push',
            pushTitle: processNotificationVariables(notification.pushTitle || '', dummyContext),
            pushBody: processNotificationVariables(notification.pushBody || '', dummyContext)
          };
        }
        
        return res.json({
          hasData: true,
          mode: 'dummy',
          processedContent
        });
      }
      
      // MODE 2: Preview with specific person data
      if (personId) {
        // Get person data
        const person = await storage.getPersonById(personId);
        if (!person) {
          return res.status(404).json({ message: "Person not found" });
        }
        
        // Find a project for this person and project type
        // Get all projects for this project type
        const allProjects = await storage.getAllProjects();
        let matchingProject: Project | undefined;
        
        // Find projects that match the project type and have this person linked via clientPeople
        for (const project of allProjects) {
          if (project.projectTypeId !== projectTypeId || project.archived || project.inactive) {
            continue;
          }
          
          // Check if this person is linked to the project's client
          const clientPeople = await storage.getClientPeopleByClientId(project.clientId);
          if (clientPeople.some(cp => cp.personId === personId)) {
            matchingProject = project;
            
            // For stage notifications, prefer a project in the correct stage
            if (notification.category === 'stage' && notification.stageId) {
              const stage = await storage.getStageById(notification.stageId);
              if (stage && project.currentStatus === stage.name) {
                break; // Found perfect match
              }
            } else {
              break; // Found match for project notification
            }
          }
        }
        
        if (!matchingProject) {
          return res.json({
            hasData: false,
            message: `No active projects found for this person and project type.`
          });
        }
        
        // Get client data
        const client = await storage.getClientById(matchingProject.clientId);
        if (!client) {
          return res.json({
            hasData: false,
            message: "Client data not found."
          });
        }
        
        // Get project type
        const projectType = await storage.getProjectTypeById(projectTypeId);
        if (!projectType) {
          return res.json({
            hasData: false,
            message: "Project type not found."
          });
        }
        
        // Get service data
        const service = await storage.getServiceByProjectTypeId(projectTypeId);
        const clientService = service ? 
          (await storage.getClientServicesByServiceId(service.id)).find(cs => cs.clientId === client.id) : 
          undefined;
        
        // Get company settings
        const companySettings = await storage.getCompanySettings();
        
        // Build notification context
        const context = buildNotificationContext({
          client,
          project: matchingProject,
          projectType,
          service,
          clientService,
          companySettings,
        });
        
        // Add person-specific data to context
        const personContext = {
          ...context,
          person: {
            id: person.id,
            fullName: person.fullName,
            firstName: person.firstName || '',
            lastName: person.lastName || '',
            email: person.primaryEmail,
            phone: person.primaryPhone,
          }
        };
        
        // Process variables
        const { processNotificationVariables } = await import("../notification-variables");
        
        let processedContent: any = {};
        
        if (notification.notificationType === 'email') {
          processedContent = {
            type: 'email',
            emailTitle: processNotificationVariables(notification.emailTitle || '', personContext),
            emailBody: processNotificationVariables(notification.emailBody || '', personContext)
          };
        } else if (notification.notificationType === 'sms') {
          processedContent = {
            type: 'sms',
            smsContent: processNotificationVariables(notification.smsContent || '', personContext)
          };
        } else if (notification.notificationType === 'push') {
          processedContent = {
            type: 'push',
            pushTitle: processNotificationVariables(notification.pushTitle || '', personContext),
            pushBody: processNotificationVariables(notification.pushBody || '', personContext)
          };
        }
        
        return res.json({
          hasData: true,
          mode: 'real',
          personId: person.id,
          personName: person.fullName,
          projectId: matchingProject.id,
          projectDescription: matchingProject.description || "",
          clientName: client.name,
          processedContent
        });
      }
      
      // Find a sample active project for this project type
      const allProjects = await storage.getAllProjects();
      let sampleProject: Project | undefined;
      
      if (notification.category === 'stage' && notification.stageId) {
        // For stage notifications, find a project currently in the specified stage
        // Get the stage name to match against currentStatus
        const stage = await storage.getStageById(notification.stageId);
        if (!stage) {
          return res.json({
            hasData: false,
            message: "Stage not found."
          });
        }
        
        sampleProject = allProjects.find(p => 
          p.projectTypeId === projectTypeId && 
          p.currentStatus === stage.name &&
          !p.archived && 
          !p.inactive
        );
        
        if (!sampleProject) {
          return res.json({
            hasData: false,
            message: `No active projects found in stage "${stage.name}". Preview is not available.`
          });
        }
      } else {
        // For project notifications, find any active project of this type
        sampleProject = allProjects.find(p => 
          p.projectTypeId === projectTypeId && 
          !p.archived && 
          !p.inactive
        );
        
        if (!sampleProject) {
          return res.json({
            hasData: false,
            message: "No active projects found for this project type. Preview is not available."
          });
        }
      }
      
      // Get client data
      const client = await storage.getClientById(sampleProject.clientId);
      if (!client) {
        return res.json({
          hasData: false,
          message: "Client data not found for sample project."
        });
      }
      
      // Get project type
      const projectType = await storage.getProjectTypeById(projectTypeId);
      if (!projectType) {
        return res.json({
          hasData: false,
          message: "Project type not found."
        });
      }
      
      // Get service data
      const service = await storage.getServiceByProjectTypeId(projectTypeId);
      const clientService = service ? 
        (await storage.getClientServicesByServiceId(service.id)).find(cs => cs.clientId === client.id) : 
        undefined;
      
      // Get company settings
      const companySettings = await storage.getCompanySettings();
      
      // Build notification context using helper
      const context = buildNotificationContext({
        client,
        project: sampleProject,
        projectType,
        service,
        clientService,
        companySettings,
      });
      
      // Process variables using the notification processor
      const { processNotificationVariables } = await import("../notification-variables");
      
      // Process content based on notification type
      let processedContent: any = {};
      
      if (notification.notificationType === 'email') {
        processedContent = {
          type: 'email',
          emailTitle: processNotificationVariables(notification.emailTitle || '', context),
          emailBody: processNotificationVariables(notification.emailBody || '', context)
        };
      } else if (notification.notificationType === 'sms') {
        processedContent = {
          type: 'sms',
          smsContent: processNotificationVariables(notification.smsContent || '', context)
        };
      } else if (notification.notificationType === 'push') {
        processedContent = {
          type: 'push',
          pushTitle: processNotificationVariables(notification.pushTitle || '', context),
          pushBody: processNotificationVariables(notification.pushBody || '', context)
        };
      }
      
      res.json({
        hasData: true,
        projectId: sampleProject.id,
        projectDescription: sampleProject.description || "",
        clientName: client.name,
        processedContent
      });
    } catch (error) {
      console.error("Error previewing notification:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to preview notification" });
    }
  });

  // Preview a scheduled notification with variable replacements
  app.get("/api/scheduled-notifications/:scheduledNotificationId/preview", isAuthenticated, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramScheduledNotificationIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid scheduled notification ID", errors: validation.errors });
      }

      const { scheduledNotificationId } = validation.data;
      
      // Get the scheduled notification
      const scheduledNotification = await storage.getScheduledNotificationById(scheduledNotificationId);
      if (!scheduledNotification) {
        return res.status(404).json({ message: "Scheduled notification not found" });
      }
      
      // Get client data
      const client = await storage.getClientById(scheduledNotification.clientId);
      if (!client) {
        return res.json({
          hasData: false,
          message: "Client data not found for this notification."
        });
      }
      
      // Get project data if available
      let project: Project | null = null;
      let projectType: ProjectType | null = null;
      if (scheduledNotification.projectId) {
        const projectData = await storage.getProject(scheduledNotification.projectId);
        if (projectData) {
          project = projectData as Project;
          projectType = await storage.getProjectTypeById(projectData.projectTypeId);
        }
      } else if (scheduledNotification.clientServiceId) {
        // If no project but has clientServiceId, get projectType from service
        const clientService = await storage.getClientServiceById(scheduledNotification.clientServiceId);
        if (clientService) {
          const service = await storage.getServiceById(clientService.serviceId);
          if (service && service.projectTypeId) {
            projectType = await storage.getProjectTypeById(service.projectTypeId);
            // Find any active project for this client and project type as fallback
            const allProjects = await storage.getAllProjects();
            project = allProjects.find(p => 
              p.projectTypeId === service.projectTypeId && 
              p.clientId === client.id &&
              !p.archived && 
              !p.inactive
            ) || null;
          }
        }
      }
      
      // Create a fallback project if none found
      if (!project) {
        const now = new Date();
        project = {
          id: 'preview-project',
          description: 'Sample Project',
          projectTypeId: projectType?.id || 'unknown',
          clientId: client.id,
          dueDate: now,
          currentStatus: 'in_progress',
          archived: false,
          inactive: false,
          createdAt: now,
          updatedAt: now
        } as Project;
      }
      
      if (!projectType) {
        projectType = {
          id: 'preview-project-type',
          name: 'Sample Service',
          description: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
          notificationsActive: true
        } as ProjectType;
      }
      
      // Get service data
      let service: Service | undefined;
      let clientService: ClientService | undefined;
      if (scheduledNotification.clientServiceId) {
        clientService = await storage.getClientServiceById(scheduledNotification.clientServiceId);
        if (clientService) {
          service = await storage.getServiceById(clientService.serviceId);
        }
      } else if (projectType && projectType.id !== 'preview-project-type') {
        service = await storage.getServiceByProjectTypeId(projectType.id);
        if (service) {
          const allClientServices = await storage.getClientServicesByServiceId(service.id);
          clientService = allClientServices.find(cs => cs.clientId === client.id);
        }
      }
      
      // Get company settings
      const companySettings = await storage.getCompanySettings();
      
      // Build notification context
      const context = buildNotificationContext({
        client,
        project,
        projectType,
        service,
        clientService,
        companySettings,
      });
      
      // Process variables
      const { processNotificationVariables } = await import("../notification-variables");
      
      // Process content based on notification type
      let processedContent: any = {};
      
      if (scheduledNotification.notificationType === 'email') {
        processedContent = {
          type: 'email',
          emailTitle: processNotificationVariables(scheduledNotification.emailTitle || '', context),
          emailBody: processNotificationVariables(scheduledNotification.emailBody || '', context)
        };
      } else if (scheduledNotification.notificationType === 'sms') {
        processedContent = {
          type: 'sms',
          smsContent: processNotificationVariables(scheduledNotification.smsContent || '', context)
        };
      } else if (scheduledNotification.notificationType === 'push') {
        processedContent = {
          type: 'push',
          pushTitle: processNotificationVariables(scheduledNotification.pushTitle || '', context),
          pushBody: processNotificationVariables(scheduledNotification.pushBody || '', context)
        };
      }
      
      res.json({
        hasData: true,
        projectId: project.id,
        projectName: project.description || projectType.name,
        clientName: client.name,
        processedContent
      });
    } catch (error) {
      console.error("Error previewing scheduled notification:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to preview scheduled notification" });
    }
  });

  // Create a new project type notification
  app.post("/api/project-types/:projectTypeId/notifications", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramProjectTypeIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid project type ID", errors: validation.errors });
      }

      const { projectTypeId } = validation.data;
      const notificationData = insertProjectTypeNotificationSchema.parse({
        ...req.body,
        projectTypeId
      });

      // Validate project type exists
      const projectType = await storage.getProjectTypeById(projectTypeId);
      if (!projectType) {
        return res.status(404).json({ message: "Project type not found" });
      }

      // If stage notification, validate stage exists and belongs to project type
      if (notificationData.stageId) {
        const stage = await storage.getStageById(notificationData.stageId);
        if (!stage) {
          return res.status(404).json({ message: "Stage not found" });
        }
        if (stage.projectTypeId !== projectTypeId) {
          return res.status(400).json({ message: "Stage does not belong to this project type" });
        }
      }

      // If linked to client request template, validate it exists
      if (notificationData.clientRequestTemplateId) {
        const template = await storage.getClientRequestTemplateById(notificationData.clientRequestTemplateId);
        if (!template) {
          return res.status(404).json({ message: "Client request template not found" });
        }
        
        // Only email and push notifications can be linked to client request templates
        if (notificationData.notificationType === 'sms') {
          return res.status(400).json({ 
            message: "SMS notifications cannot be linked to client request templates. Only email and push notifications are supported." 
          });
        }
      }

      const notification = await storage.createProjectTypeNotification(notificationData);
      
      // Schedule notifications retroactively for all existing services and projects
      try {
        // Only schedule for project notifications (not stage notifications)
        if (notification.category === 'project') {
          console.log(`[Notifications] Scheduling notifications retroactively for new notification ${notification.id}`);
          
          // Get the service for this project type
          const service = await storage.getServiceByProjectTypeId(projectTypeId);
          if (service) {
            // Get all client services
            const clientServices = await storage.getClientServicesByServiceId(service.id);
            console.log(`[Notifications] Found ${clientServices.length} client service(s) to schedule`);
            
            // Cache peopleIds per client to avoid redundant DB queries
            const clientPeopleCache = new Map<string, string[]>();
            
            // Schedule start_date notifications for services
            if (notification.dateReference === 'start_date') {
              for (const clientService of clientServices) {
                if (clientService.nextStartDate) {
                  // Fetch peopleIds for this client (with caching)
                  let peopleIds = clientPeopleCache.get(clientService.clientId);
                  if (!peopleIds) {
                    const allRelatedPeople = await storage.getClientPeopleByClientId(clientService.clientId);
                    peopleIds = allRelatedPeople.map(p => p.person.id);
                    clientPeopleCache.set(clientService.clientId, peopleIds);
                  }
                  
                  await scheduleServiceStartDateNotifications({
                    clientServiceId: clientService.id,
                    clientId: clientService.clientId,
                    projectTypeId: projectTypeId,
                    nextStartDate: clientService.nextStartDate,
                    relatedPeople: peopleIds,
                  });
                }
              }
            }
            
            // Schedule due_date notifications for existing projects
            if (notification.dateReference === 'due_date') {
              const allProjects = await storage.getAllProjects();
              const projectsForType = allProjects.filter(
                p => p.projectTypeId === projectTypeId && p.dueDate && !p.archived && !p.inactive
              );
              console.log(`[Notifications] Found ${projectsForType.length} active project(s) to schedule due_date notifications`);
              
              for (const project of projectsForType) {
                const clientService = clientServices.find(cs => cs.clientId === project.clientId);
                if (clientService) {
                  // Fetch peopleIds for this client (with caching)
                  let peopleIds = clientPeopleCache.get(project.clientId);
                  if (!peopleIds) {
                    const allRelatedPeople = await storage.getClientPeopleByClientId(project.clientId);
                    peopleIds = allRelatedPeople.map(p => p.person.id);
                    clientPeopleCache.set(project.clientId, peopleIds);
                  }
                  
                  await scheduleProjectDueDateNotifications({
                    projectId: project.id,
                    clientServiceId: clientService.id,
                    clientId: project.clientId,
                    projectTypeId: projectTypeId,
                    dueDate: project.dueDate!,
                    relatedPeople: peopleIds,
                  });
                }
              }
            }
            
            // Note: People services are not yet fully implemented in the notification system
            // and are skipped for now (consistent with main project scheduler)
          }
        }
      } catch (scheduleError) {
        console.error('[Notifications] Error scheduling notifications retroactively:', scheduleError);
        // Don't fail the request if retroactive scheduling fails
      }
      
      res.json(notification);
    } catch (error) {
      console.error("Error creating project type notification:", error instanceof Error ? error.message : error);

      if (error instanceof Error && error.name === 'ZodError') {
        console.error("Validation errors:", (error as any).issues);
        return res.status(400).json({
          message: "Validation failed",
          errors: (error as any).issues
        });
      }

      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  // Update a project type notification
  app.patch("/api/notifications/:notificationId", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramNotificationIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid notification ID", errors: validation.errors });
      }

      const { notificationId } = validation.data;
      const updateData = updateProjectTypeNotificationSchema.parse(req.body);

      // Verify notification exists
      const existingNotification = await storage.getProjectTypeNotificationById(notificationId);
      if (!existingNotification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      // If stage is being updated, validate it exists and belongs to project type
      if (updateData.stageId) {
        const stage = await storage.getStageById(updateData.stageId);
        if (!stage) {
          return res.status(404).json({ message: "Stage not found" });
        }
        if (stage.projectTypeId !== existingNotification.projectTypeId) {
          return res.status(400).json({ message: "Stage does not belong to this project type" });
        }
      }

      // If linked to client request template, validate it exists
      if (updateData.clientRequestTemplateId) {
        const template = await storage.getClientRequestTemplateById(updateData.clientRequestTemplateId);
        if (!template) {
          return res.status(404).json({ message: "Client request template not found" });
        }
        
        // Only email and push notifications can be linked to client request templates
        const notificationType = updateData.notificationType || existingNotification.notificationType;
        if (notificationType === 'sms') {
          return res.status(400).json({ 
            message: "SMS notifications cannot be linked to client request templates. Only email and push notifications are supported." 
          });
        }
      }

      const updated = await storage.updateProjectTypeNotification(notificationId, updateData);
      
      // Schedule notifications retroactively for all existing services and projects
      try {
        // Only schedule for project notifications (not stage notifications)
        if (updated.category === 'project') {
          console.log(`[Notifications] Re-scheduling notifications retroactively for updated notification ${updated.id}`);
          
          // Get the service for this project type
          const service = await storage.getServiceByProjectTypeId(updated.projectTypeId);
          if (service) {
            // Get all client services
            const clientServices = await storage.getClientServicesByServiceId(service.id);
            console.log(`[Notifications] Found ${clientServices.length} client service(s) to re-schedule`);
            
            // Cache peopleIds per client to avoid redundant DB queries
            const clientPeopleCache = new Map<string, string[]>();
            
            // Schedule start_date notifications for services
            if (updated.dateReference === 'start_date') {
              for (const clientService of clientServices) {
                if (clientService.nextStartDate) {
                  // Fetch peopleIds for this client (with caching)
                  let peopleIds = clientPeopleCache.get(clientService.clientId);
                  if (!peopleIds) {
                    const allRelatedPeople = await storage.getClientPeopleByClientId(clientService.clientId);
                    peopleIds = allRelatedPeople.map(p => p.person.id);
                    clientPeopleCache.set(clientService.clientId, peopleIds);
                  }
                  
                  await scheduleServiceStartDateNotifications({
                    clientServiceId: clientService.id,
                    clientId: clientService.clientId,
                    projectTypeId: updated.projectTypeId,
                    nextStartDate: clientService.nextStartDate,
                    relatedPeople: peopleIds,
                  });
                }
              }
            }
            
            // Schedule due_date notifications for existing projects
            if (updated.dateReference === 'due_date') {
              const allProjects = await storage.getAllProjects();
              const projectsForType = allProjects.filter(
                p => p.projectTypeId === updated.projectTypeId && p.dueDate && !p.archived && !p.inactive
              );
              console.log(`[Notifications] Found ${projectsForType.length} active project(s) to re-schedule due_date notifications`);
              
              for (const project of projectsForType) {
                const clientService = clientServices.find(cs => cs.clientId === project.clientId);
                if (clientService) {
                  // Fetch peopleIds for this client (with caching)
                  let peopleIds = clientPeopleCache.get(project.clientId);
                  if (!peopleIds) {
                    const allRelatedPeople = await storage.getClientPeopleByClientId(project.clientId);
                    peopleIds = allRelatedPeople.map(p => p.person.id);
                    clientPeopleCache.set(project.clientId, peopleIds);
                  }
                  
                  await scheduleProjectDueDateNotifications({
                    projectId: project.id,
                    clientServiceId: clientService.id,
                    clientId: project.clientId,
                    projectTypeId: updated.projectTypeId,
                    dueDate: project.dueDate!,
                    relatedPeople: peopleIds,
                  });
                }
              }
            }
            
            // Note: People services are not yet fully implemented in the notification system
            // and are skipped for now (consistent with main project scheduler)
          }
        }
      } catch (scheduleError) {
        console.error('[Notifications] Error re-scheduling notifications retroactively:', scheduleError);
        // Don't fail the request if retroactive scheduling fails
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating project type notification:", error instanceof Error ? error.message : error);

      if (error instanceof Error && error.name === 'ZodError') {
        console.error("Validation errors:", (error as any).issues);
        return res.status(400).json({
          message: "Validation failed",
          errors: (error as any).issues
        });
      }

      res.status(500).json({ message: "Failed to update notification" });
    }
  });

  // Delete a project type notification
  app.delete("/api/notifications/:notificationId", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramNotificationIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid notification ID", errors: validation.errors });
      }

      const { notificationId } = validation.data;

      // Verify notification exists
      const notification = await storage.getProjectTypeNotificationById(notificationId);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      // Delete associated reminders if this is linked to a client request template
      if (notification.clientRequestTemplateId) {
        const reminders = await storage.getClientRequestRemindersByNotificationId(notificationId);
        for (const reminder of reminders) {
          await storage.deleteClientRequestReminder(reminder.id);
        }
      }

      await storage.deleteProjectTypeNotification(notificationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting project type notification:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // ==================== Client Request Reminders ====================

  // Get all reminders for a project type notification
  app.get("/api/notifications/:notificationId/reminders", isAuthenticated, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramNotificationIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid notification ID", errors: validation.errors });
      }

      const { notificationId } = validation.data;
      const reminders = await storage.getClientRequestRemindersByNotificationId(notificationId);
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching client request reminders:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch reminders" });
    }
  });

  // Create a new client request reminder
  app.post("/api/notifications/:notificationId/reminders", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramNotificationIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid notification ID", errors: validation.errors });
      }

      const { notificationId } = validation.data;
      
      // Verify notification exists and is linked to a client request template
      const notification = await storage.getProjectTypeNotificationById(notificationId);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      if (!notification.clientRequestTemplateId) {
        return res.status(400).json({ 
          message: "Reminders can only be added to notifications linked to client request templates" 
        });
      }

      const reminderData = insertClientRequestReminderSchema.parse({
        ...req.body,
        projectTypeNotificationId: notificationId
      });

      // Only email and push notifications are supported for reminders
      if (reminderData.notificationType === 'sms') {
        return res.status(400).json({ 
          message: "SMS reminders are not supported. Only email and push notifications are supported." 
        });
      }

      const reminder = await storage.createClientRequestReminder(reminderData);
      res.json(reminder);
    } catch (error) {
      console.error("Error creating client request reminder:", error instanceof Error ? error.message : error);

      if (error instanceof Error && error.name === 'ZodError') {
        console.error("Validation errors:", (error as any).issues);
        return res.status(400).json({
          message: "Validation failed",
          errors: (error as any).issues
        });
      }

      res.status(500).json({ message: "Failed to create reminder" });
    }
  });

  // Update a client request reminder
  app.patch("/api/reminders/:reminderId", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramReminderIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid reminder ID", errors: validation.errors });
      }

      const { reminderId } = validation.data;
      const updateData = updateClientRequestReminderSchema.parse(req.body);

      // Verify reminder exists
      const existingReminder = await storage.getClientRequestReminderById(reminderId);
      if (!existingReminder) {
        return res.status(404).json({ message: "Reminder not found" });
      }

      // Only email and push notifications are supported for reminders
      if (updateData.notificationType === 'sms') {
        return res.status(400).json({ 
          message: "SMS reminders are not supported. Only email and push notifications are supported." 
        });
      }

      const updated = await storage.updateClientRequestReminder(reminderId, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating client request reminder:", error instanceof Error ? error.message : error);

      if (error instanceof Error && error.name === 'ZodError') {
        console.error("Validation errors:", (error as any).issues);
        return res.status(400).json({
          message: "Validation failed",
          errors: (error as any).issues
        });
      }

      res.status(500).json({ message: "Failed to update reminder" });
    }
  });

  // Delete a client request reminder
  app.delete("/api/reminders/:reminderId", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const validation = validateParams(paramReminderIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid reminder ID", errors: validation.errors });
      }

      const { reminderId } = validation.data;

      // Verify reminder exists
      const reminder = await storage.getClientRequestReminderById(reminderId);
      if (!reminder) {
        return res.status(404).json({ message: "Reminder not found" });
      }

      await storage.deleteClientRequestReminder(reminderId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting client request reminder:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to delete reminder" });
    }
  });

  // ==================== Scheduled Notifications ====================

  // Get all scheduled notifications (with filtering)
  app.get("/api/scheduled-notifications", isAuthenticated, async (req: any, res: any) => {
    try {
      const { status, clientId, projectId, dateReference, startDate, endDate } = req.query;
      
      let notifications = await storage.getAllScheduledNotifications();

      // Apply filters
      if (status) {
        notifications = notifications.filter((n: ScheduledNotification) => n.status === status);
      }
      if (clientId) {
        notifications = notifications.filter((n: ScheduledNotification) => n.clientId === clientId);
      }
      if (projectId) {
        notifications = notifications.filter((n: ScheduledNotification) => n.projectId === projectId);
      }
      if (dateReference) {
        notifications = notifications.filter((n: ScheduledNotification) => n.dateReference === dateReference);
      }
      if (startDate) {
        const start = new Date(startDate as string);
        notifications = notifications.filter((n: ScheduledNotification) => 
          new Date(n.scheduledFor) >= start
        );
      }
      if (endDate) {
        const end = new Date(endDate as string);
        notifications = notifications.filter((n: ScheduledNotification) => 
          new Date(n.scheduledFor) <= end
        );
      }

      res.json(notifications);
    } catch (error) {
      console.error("Error fetching scheduled notifications:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch scheduled notifications" });
    }
  });

  // Get a specific scheduled notification
  app.get("/api/scheduled-notifications/:scheduledNotificationId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { scheduledNotificationId } = req.params;
      const validation = validateParams(paramScheduledNotificationIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid scheduled notification ID", errors: validation.errors });
      }

      const notification = await storage.getScheduledNotificationById(scheduledNotificationId);
      if (!notification) {
        return res.status(404).json({ message: "Scheduled notification not found" });
      }

      res.json(notification);
    } catch (error) {
      console.error("Error fetching scheduled notification:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch scheduled notification" });
    }
  });

  // Cancel a scheduled notification
  app.post("/api/scheduled-notifications/:scheduledNotificationId/cancel", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      const { scheduledNotificationId } = req.params;
      const validation = validateParams(paramScheduledNotificationIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid scheduled notification ID", errors: validation.errors });
      }

      const notification = await storage.getScheduledNotificationById(scheduledNotificationId);
      if (!notification) {
        return res.status(404).json({ message: "Scheduled notification not found" });
      }

      if (notification.status !== 'scheduled') {
        return res.status(400).json({ message: "Only scheduled notifications can be cancelled" });
      }

      const updated = await storage.updateScheduledNotification(scheduledNotificationId, {
        status: 'cancelled',
        cancelledBy: req.user.id,
        cancelledAt: new Date(),
        cancelReason: 'Manually cancelled by staff'
      });
      res.json(updated);
    } catch (error) {
      console.error("Error cancelling scheduled notification:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to cancel notification" });
    }
  });

  // Bulk cancel scheduled notifications
  app.post("/api/scheduled-notifications/bulk-cancel", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      const schema = z.object({
        notificationIds: z.array(z.string().uuid())
      });
      const { notificationIds } = schema.parse(req.body);

      const results = {
        cancelled: 0,
        failed: 0,
        errors: [] as string[]
      };

      for (const id of notificationIds) {
        try {
          const notification = await storage.getScheduledNotificationById(id);
          if (!notification) {
            results.failed++;
            results.errors.push(`Notification ${id} not found`);
            continue;
          }

          if (notification.status !== 'scheduled') {
            results.failed++;
            results.errors.push(`Notification ${id} is not scheduled (status: ${notification.status})`);
            continue;
          }

          await storage.updateScheduledNotification(id, { 
            status: 'cancelled',
            cancelledBy: req.user.id,
            cancelledAt: new Date(),
            cancelReason: 'Bulk cancelled by staff'
          });
          results.cancelled++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Error cancelling ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Error bulk cancelling notifications:", error instanceof Error ? error.message : error);

      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({
          message: "Validation failed",
          errors: (error as any).issues
        });
      }

      res.status(500).json({ message: "Failed to cancel notifications" });
    }
  });

  // Get scheduled notifications for a specific client (with filtering)
  app.get("/api/scheduled-notifications/client/:clientId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;
      const { category, type, recipientId, dateFrom, dateTo, status } = req.query;
      
      const filters = {
        category,
        type,
        recipientId,
        dateFrom,
        dateTo,
        status
      };

      const notifications = await storage.getScheduledNotificationsForClient(clientId, filters);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching client scheduled notifications:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Reactivate a cancelled scheduled notification
  app.patch("/api/scheduled-notifications/:scheduledNotificationId/reactivate", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      const { scheduledNotificationId } = req.params;
      const validation = validateParams(paramScheduledNotificationIdSchema, req.params);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid scheduled notification ID", errors: validation.errors });
      }

      const notification = await storage.getScheduledNotificationById(scheduledNotificationId);
      if (!notification) {
        return res.status(404).json({ message: "Scheduled notification not found" });
      }

      if (notification.status !== 'cancelled') {
        return res.status(400).json({ message: "Only cancelled notifications can be reactivated" });
      }

      // Check if the scheduled date is in the future
      if (new Date(notification.scheduledFor) < new Date()) {
        return res.status(400).json({ message: "Cannot reactivate notifications scheduled in the past" });
      }

      const updated = await storage.updateScheduledNotification(scheduledNotificationId, {
        status: 'scheduled',
        cancelledBy: null,
        cancelledAt: null,
        cancelReason: null
      });
      res.json(updated);
    } catch (error) {
      console.error("Error reactivating scheduled notification:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to reactivate notification" });
    }
  });

  // Get notification history for a client
  app.get("/api/clients/:clientId/notification-history", isAuthenticated, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;
      const history = await storage.getNotificationHistoryByClientId(clientId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching notification history:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch notification history" });
    }
  });

  // Get notification history for a project
  app.get("/api/projects/:projectId/notification-history", isAuthenticated, async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const history = await storage.getNotificationHistoryByProjectId(projectId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching notification history:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch notification history" });
    }
  });
}
