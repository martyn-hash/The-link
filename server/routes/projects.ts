import type { Express } from "express";
import Papa from "papaparse";
import { storage } from "../storage";
import { z } from "zod";
import {
  insertProjectViewSchema,
  insertUserProjectPreferencesSchema,
  updateProjectStatusSchema,
  completeProjectSchema,
  csvProjectSchema,
  insertStageApprovalResponseSchema,
  dashboardCache,
} from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  runProjectSchedulingEnhanced,
  getOverdueServicesAnalysis,
  seedTestServices,
  resetTestData,
  buildSchedulingPreview,
} from "../project-scheduler";

// Parameter validation schema
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

export function registerProjectRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any,
  upload: any
): void {
  // ==================================================
  // PROJECT VIEWS API ROUTES
  // ==================================================

  app.get("/api/project-views", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const views = await storage.getProjectViewsByUserId(effectiveUserId);
      res.json(views);
    } catch (error) {
      console.error("Error fetching project views:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch project views" });
    }
  });

  app.post("/api/project-views", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const viewData = req.body;

      // Validate project view data
      const validViewData = insertProjectViewSchema.parse({
        ...viewData,
        userId: effectiveUserId, // Ensure userId matches authenticated user
      });

      const newView = await storage.createProjectView(validViewData);
      res.json(newView);
    } catch (error) {
      console.error("Error creating project view:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to create project view" });
    }
  });

  app.delete("/api/project-views/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
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
      const views = await storage.getProjectViewsByUserId(effectiveUserId);
      const viewToDelete = views.find(v => v.id === req.params.id);

      if (!viewToDelete) {
        return res.status(404).json({ message: "Project view not found or access denied" });
      }

      await storage.deleteProjectView(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project view:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to delete project view" });
    }
  });

  // ==================================================
  // USER PROJECT PREFERENCES API ROUTES
  // ==================================================

  app.get("/api/user-project-preferences", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const preferences = await storage.getUserProjectPreferences(effectiveUserId);
      res.json(preferences || {});
    } catch (error) {
      console.error("Error fetching user project preferences:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch user project preferences" });
    }
  });

  app.post("/api/user-project-preferences", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const preferencesData = insertUserProjectPreferencesSchema.parse({
        ...req.body,
        userId: effectiveUserId, // Ensure userId matches authenticated user
      });

      const preferences = await storage.upsertUserProjectPreferences(preferencesData);
      res.json(preferences);
    } catch (error) {
      console.error("Error saving user project preferences:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to save user project preferences" });
    }
  });

  app.delete("/api/user-project-preferences", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      await storage.deleteUserProjectPreferences(effectiveUserId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user project preferences:", error instanceof Error ? error.message : error);
      res.status(400).json({ message: "Failed to delete user project preferences" });
    }
  });

  // ==================================================
  // PROJECTS API ROUTES
  // ==================================================

  // GET /api/services/:serviceId/due-dates - Get unique due dates for a service
  app.get("/api/services/:serviceId/due-dates", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      if (!effectiveUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const serviceId = req.params.serviceId;
      const dueDates = await storage.getUniqueDueDatesForService(serviceId);
      res.json(dueDates);
    } catch (error) {
      console.error("Error fetching service due dates:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch service due dates" });
    }
  });

  app.get("/api/projects", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Helper to normalize filter values (treat 'all' and empty strings as undefined)
      const normalize = (v: any) => (v && v !== 'all' ? v : undefined);

      // Extract query parameters for filtering
      const filters = {
        month: normalize(req.query.month),
        archived: req.query.archived === 'true' ? true : req.query.archived === 'false' ? false : undefined,
        showArchived: req.query.showArchived === 'true' ? true : req.query.showArchived === 'false' ? false : undefined,
        inactive: req.query.inactive === 'true' ? true : req.query.inactive === 'false' ? false : undefined,
        serviceId: normalize(req.query.serviceId),
        assigneeId: normalize(req.query.assigneeId),
        serviceOwnerId: normalize(req.query.serviceOwnerId),
        userId: normalize(req.query.userId),
        dynamicDateFilter: normalize(req.query.dynamicDateFilter),
        dateFrom: normalize(req.query.dateFrom),
        dateTo: normalize(req.query.dateTo),
        dueDate: normalize(req.query.dueDate),
      };

      // All authenticated users can see all projects
      const projects = await storage.getAllProjects(filters);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error instanceof Error ? (error instanceof Error ? error.message : null) : error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // GET /api/clients/:clientId/projects - Get all projects for a specific client
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

  // GET /api/projects/:id/communications - Get all communications (progress notes) for a specific project
  app.get("/api/projects/:id/communications", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const projectId = req.params.id;
      const communications = await storage.getCommunicationsByProjectId(projectId);
      res.json(communications);
    } catch (error) {
      console.error("Error fetching project communications:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch project communications" });
    }
  });

  // GET /api/projects/:id/most-recent-stage-change - Get the most recent stage change chronology entry for a project
  app.get("/api/projects/:id/most-recent-stage-change", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const projectId = req.params.id;
      
      // Validate user has access to this project
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Fetch the most recent stage change with approval responses
      const stageChangeData = await storage.getMostRecentStageChange(projectId);
      
      if (!stageChangeData) {
        return res.status(404).json({ message: "No stage changes found for this project" });
      }
      
      // Return the entry and stage approval responses separately
      // Client-side modal will filter approvals based on the change reason/stage
      res.json(stageChangeData);
    } catch (error) {
      console.error("Error fetching most recent stage change:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch most recent stage change" });
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

      // Prevent status updates on completed projects
      if (project.completionStatus) {
        return res.status(400).json({
          message: "Cannot update status of a completed project"
        });
      }

      // Allow any authenticated user to update project status
      // Note: Removed role-based restrictions to allow all users to update project status

      // Validate stage-reason mapping is valid
      const stageValidation = await storage.validateProjectStatus(updateData.newStatus);
      if (!stageValidation.isValid) {
        return res.status(400).json({ message: stageValidation.reason || "Invalid project status" });
      }

      // Get the stage for this specific project type - MUST scope by project type to avoid name collisions
      const stages = await storage.getAllKanbanStages();
      const targetStage = stages.find(stage => 
        stage.name === updateData.newStatus && 
        stage.projectTypeId === project.projectTypeId
      );
      if (!targetStage) {
        return res.status(400).json({ message: "Invalid project status for this project type" });
      }

      // Get the change reason by name, scoped to the project's project type
      const reasons = await storage.getChangeReasonsByProjectTypeId(project.projectTypeId);
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
      // Check reason-level approval first, then fall back to stage-level approval
      const effectiveApprovalId = changeReason.stageApprovalId || targetStage.stageApprovalId;
      
      if (effectiveApprovalId) {
        // This stage/reason requires approval - validate approval responses exist and are valid
        const existingResponses = await storage.getStageApprovalResponsesByProjectId(updateData.projectId);

        // Get the stage approval fields to understand what's required
        const approvalFields = await storage.getStageApprovalFieldsByApprovalId(effectiveApprovalId);

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
            valueMultiSelect: response.valueMultiSelect,
          }));

          // Validate the approval responses
          const approvalValidation = await storage.validateStageApprovalResponses(
            effectiveApprovalId,
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

      // Prepare stage change notification preview instead of sending immediately
      const notificationPreview = await storage.prepareStageChangeNotification(
        updatedProject.id,
        updateData.newStatus,
        project.currentStatus
      );

      res.json({ 
        project: updatedProject, 
        notificationPreview 
      });
    } catch (error) {
      console.error("[PATCH /api/projects/:id/status] Error updating project status:", error instanceof Error ? error.message : error);
      console.error("[PATCH /api/projects/:id/status] Full error stack:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        console.error("[PATCH /api/projects/:id/status] Validation errors:", (error as any).issues);
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else if (error instanceof Error && error.message) {
        // Return all error messages to help debug
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to update project status" });
      }
    }
  });

  // Send stage change notification after user approval
  app.post("/api/projects/:id/send-stage-change-notification", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const projectId = req.params.id;
      
      // Validate request body
      const { sendStageChangeNotificationSchema } = await import("@shared/schema");
      const notificationData = sendStageChangeNotificationSchema.parse({
        ...req.body,
        projectId,
      });

      // Verify user has permission to send notifications for this project
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // If suppress flag is true, don't send the notification
      if (notificationData.suppress) {
        console.log(`[Notification] User suppressed stage change notification for project ${projectId} with dedupe key ${notificationData.dedupeKey}`);
        return res.json({ 
          success: true, 
          message: "Notification suppressed",
          sent: false 
        });
      }

      // Get the notification preview to find recipients
      const preview = await storage.prepareStageChangeNotification(
        projectId,
        project.currentStatus
      );

      if (!preview) {
        return res.status(400).json({ message: "No notification preview available" });
      }

      // Verify dedupe key matches (security check)
      if (preview.dedupeKey !== notificationData.dedupeKey) {
        return res.status(400).json({ message: "Invalid dedupe key - notification may have already been processed" });
      }

      // Send emails to all recipients with user-edited content
      const { sendEmail } = await import("../emailService");
      
      const emailPromises = preview.recipients.map(async (recipient) => {
        try {
          const emailSent = await sendEmail({
            to: recipient.email,
            subject: notificationData.emailSubject,  // Use edited subject
            html: notificationData.emailBody,        // Use edited body (as HTML)
          });

          if (emailSent) {
            console.log(`Stage change notification sent to ${recipient.email} for project ${projectId}`);
            return { success: true, email: recipient.email };
          } else {
            console.warn(`Failed to send stage change notification to ${recipient.email} for project ${projectId}`);
            return { success: false, email: recipient.email, error: 'Email sending failed' };
          }
        } catch (error) {
          console.error(`Error sending stage change notification to ${recipient.email}:`, error);
          return { success: false, email: recipient.email, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      const results = await Promise.allSettled(emailPromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      // Send push notifications if provided
      if (notificationData.pushTitle && notificationData.pushBody) {
        try {
          const { sendProjectStageChangeNotification } = await import('../notification-template-service');
          
          for (const recipient of preview.recipients) {
            try {
              await sendProjectStageChangeNotification(
                projectId,
                notificationData.pushTitle,
                notificationData.pushBody,
                preview.oldStageName || 'Unknown',
                preview.newStageName,
                recipient.userId,
                recipient.name,
                preview.metadata.dueDate
              );
            } catch (pushError) {
              console.error(`Failed to send push notification to user ${recipient.userId}:`, pushError);
            }
          }
        } catch (error) {
          console.error(`Error sending push notifications for project ${projectId}:`, error);
        }
      }

      res.json({ 
        success: true, 
        message: `Notifications sent: ${successful} successful, ${failed} failed`,
        sent: true,
        stats: { successful, failed }
      });
    } catch (error) {
      console.error("[POST /api/projects/:id/send-stage-change-notification] Error:", error instanceof Error ? error.message : error);
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else if (error instanceof Error && error.message) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to send stage change notification" });
      }
    }
  });

  app.patch("/api/projects/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Schema that allows inactive field and inactiveReason updates
      const inactiveUpdateSchema = z.object({
        inactive: z.boolean(),
        inactiveReason: z.enum(["created_in_error", "no_longer_required", "client_doing_work_themselves"]).optional()
      }).refine((data) => {
        // If marking inactive (false -> true), inactiveReason is required
        if (data.inactive && !data.inactiveReason) {
          return false;
        }
        // If marking active (true -> false), inactiveReason should not be provided
        if (!data.inactive && data.inactiveReason) {
          return false;
        }
        return true;
      }, {
        message: "When marking inactive, inactiveReason is required. When reactivating, inactiveReason should not be provided.",
      });
      
      const updateData = inactiveUpdateSchema.parse(req.body);

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
      
      // Check permission to make projects inactive
      if (updateData.inactive && !project.inactive && !effectiveUser.canMakeProjectsInactive) {
        return res.status(403).json({ message: "You do not have permission to make projects inactive" });
      }

      // Prepare update data with auto-populated fields
      const finalUpdateData: any = { inactive: updateData.inactive };
      
      if (updateData.inactive && !project.inactive) {
        // Marking as inactive
        finalUpdateData.inactiveReason = updateData.inactiveReason;
        finalUpdateData.inactiveAt = new Date();
        finalUpdateData.inactiveByUserId = effectiveUserId;
        finalUpdateData.dueDate = null; // Clear due date
        
        // Log to project chronology
        const reasonLabel = updateData.inactiveReason
          ?.split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        await storage.createChronologyEntry({
          projectId: project.id,
          fromStatus: project.currentStatus,
          toStatus: project.currentStatus,
          assigneeId: project.currentAssigneeId,
          changedById: effectiveUserId,
          changeReason: 'project_inactive',
          notes: `Project was marked inactive - Reason: ${reasonLabel}`,
          timestamp: new Date()
        });
      } else if (!updateData.inactive && project.inactive) {
        // Reactivating - clear all inactive metadata
        finalUpdateData.inactiveReason = null;
        finalUpdateData.inactiveAt = null;
        finalUpdateData.inactiveByUserId = null;
        
        // Log to project chronology
        await storage.createChronologyEntry({
          projectId: project.id,
          fromStatus: project.currentStatus,
          toStatus: project.currentStatus,
          assigneeId: project.currentAssigneeId,
          changedById: effectiveUserId,
          changeReason: 'project_reactivated',
          notes: `Project was reactivated`,
          timestamp: new Date()
        });
      }

      // Update the project
      const updatedProject = await storage.updateProject(req.params.id, finalUpdateData);
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

  app.patch("/api/projects/:id/complete", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate request body
      const { completionStatus, notes } = completeProjectSchema.parse(req.body);

      // Verify project exists
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check authorization
      const canComplete =
        effectiveUser.isAdmin ||
        project.currentAssigneeId === effectiveUserId ||
        project.clientManagerId === effectiveUserId ||
        project.bookkeeperId === effectiveUserId;

      if (!canComplete) {
        return res.status(403).json({ message: "Not authorized to complete this project" });
      }

      // Verify that the current stage allows project completion
      if (project.projectTypeId && project.currentStatus) {
        const stages = await storage.getKanbanStagesByProjectTypeId(project.projectTypeId);
        const currentStage = stages.find(stage => stage.name === project.currentStatus);

        // If current stage not found, it may have been deleted or renamed - prevent completion
        if (!currentStage) {
          console.warn(`Project ${project.id} has currentStatus '${project.currentStatus}' which doesn't match any stage in project type ${project.projectTypeId}`);
          return res.status(400).json({
            message: `Cannot complete project: the current stage '${project.currentStatus}' is not configured in the project type. Please update the project to a valid stage before completing.`,
            code: "INVALID_STAGE_CONFIGURATION"
          });
        }

        // If stage exists but doesn't allow completion, prevent it
        if (!currentStage.canBeFinalStage) {
          return res.status(400).json({
            message: `This project cannot be completed at the current stage ('${currentStage.name}'). Please move the project to an appropriate final stage before marking it as complete.`,
            code: "INVALID_COMPLETION_STAGE",
            currentStage: currentStage.name
          });
        }
      }

      // Update the project: mark as completed, archived, and inactive
      // Set currentStatus to "Archived" to maintain consistency
      const updatedProject = await storage.updateProject(req.params.id, {
        completionStatus,
        currentStatus: 'Archived',
        archived: true,
        inactive: true
      });

      // Create chronology entry with canonical stage name "Archived"
      const completionNotes = completionStatus === 'completed_successfully'
        ? 'Manual completion - successful'
        : 'Manual completion - unsuccessful';

      await storage.createChronologyEntry({
        projectId: req.params.id,
        fromStatus: project.currentStatus,
        toStatus: 'Archived',
        assigneeId: effectiveUserId,
        changeReason: completionNotes,
        notes: notes || `Project manually marked as ${completionStatus === 'completed_successfully' ? 'successfully completed' : 'unsuccessfully completed'} by ${effectiveUser.name}. Completion status: ${completionStatus}`
      });

      res.json(updatedProject);
    } catch (error) {
      console.error("Error completing project:", error instanceof Error ? error.message : error);
      if (error instanceof Error && error.name === 'ZodError') {
        console.error("Validation errors:", (error as any).issues);
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else if (error instanceof Error && error.message && error.message.includes("not found")) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to complete project" });
      }
    }
  });

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

  app.get("/api/projects/:projectId/role-assignee", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const { stageName } = req.query;

      console.log(`[role-assignee] Request for project ${projectId}, stageName: ${stageName || 'current'}`);

      if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({ message: "Valid project ID is required" });
      }

      // Get the project with its current stage and client information
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get the stage configuration to find the assigned role
      // Use provided stageName or fall back to project's current status
      const stages = await storage.getKanbanStagesByProjectTypeId(project.projectTypeId);
      const targetStageName = stageName || project.currentStatus;
      const currentStage = stages.find(stage => stage.name === targetStageName);

      console.log(`[role-assignee] Target stage: ${targetStageName}, found stage: ${currentStage ? 'yes' : 'no'}, assigned role ID: ${currentStage?.assignedWorkRoleId || 'none'}`);

      if (!currentStage || !currentStage.assignedWorkRoleId) {
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
      let resolvedUser = await storage.resolveRoleAssigneeForClientByRoleId(
        project.clientId,
        project.projectTypeId,
        currentStage.assignedWorkRoleId
      );

      console.log(`[role-assignee] Resolved user for role ID ${currentStage.assignedWorkRoleId}: ${resolvedUser ? `${resolvedUser.firstName} ${resolvedUser.lastName}` : 'none'}`);

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
            roleUsed: currentStage.assignedWorkRoleId,
            usedFallback: false,
            source: 'none'
          });
        }
      }

      // Strip password hash from response for security
      const { passwordHash, ...sanitizedUser } = resolvedUser;

      res.json({
        user: sanitizedUser,
        roleUsed: currentStage.assignedWorkRoleId,
        usedFallback,
        source
      });
    } catch (error) {
      console.error("Error resolving project role assignee:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to resolve project role assignee" });
    }
  });

  app.get("/api/projects/:projectId/service-roles", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { projectId } = req.params;

      if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({ message: "Valid project ID is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if project has a project type
      if (!project.projectTypeId) {
        return res.json({ roles: [] });
      }

      // Find the client service mapping
      const clientService = await storage.getClientServiceByClientAndProjectType(
        project.clientId,
        project.projectTypeId
      );

      if (!clientService) {
        return res.json({ roles: [] });
      }

      // Get all active role assignments for this client service
      const roleAssignments = await storage.getActiveClientServiceRoleAssignments(clientService.id);

      // Transform to response format with sanitized user data
      const roles = roleAssignments.map(assignment => ({
        roleName: assignment.workRole.name,
        user: assignment.user ? {
          id: assignment.user.id,
          email: assignment.user.email,
          firstName: assignment.user.firstName,
          lastName: assignment.user.lastName,
          isAdmin: assignment.user.isAdmin,
          canSeeAdminMenu: assignment.user.canSeeAdminMenu
        } : null
      }));

      res.json({ roles });
    } catch (error) {
      console.error("Error resolving project service roles:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to resolve project service roles" });
    }
  });

  // ==================================================
  // SCHEDULED SERVICES API ROUTES
  // ==================================================

  app.get("/api/scheduled-services", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const scheduledServices = await storage.getScheduledServices();
      res.json(scheduledServices);
    } catch (error) {
      console.error("Error fetching scheduled services:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch scheduled services" });
    }
  });

  // ==================================================
  // PROJECT SCHEDULING API ROUTES
  // ==================================================

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

      // runMockTimeProgression is not yet implemented
      return res.status(501).json({
        message: "Mock time progression feature is not yet implemented",
        error: "NOT_IMPLEMENTED"
      });
    } catch (error) {
      console.error("Error running mock time progression:", error instanceof Error ? error.message : error);
      res.status(500).json({
        message: "Failed to run mock time progression",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/project-scheduling/generate-test-scenario", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      console.log(`[API] Test scenario generation triggered by admin: ${req.user?.email}`);

      const { name, type, dryRun } = req.body || {};

      if (!name || !type) {
        return res.status(400).json({
          message: "name and type are required"
        });
      }

      // generateTestScenario is not yet implemented
      return res.status(501).json({
        message: "Test scenario generation feature is not yet implemented",
        error: "NOT_IMPLEMENTED"
      });
    } catch (error) {
      console.error("Error generating test scenario:", error instanceof Error ? error.message : error);
      res.status(500).json({
        message: "Failed to generate test scenario",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ==================================================
  // DASHBOARD API ROUTES
  // ==================================================

  // Get dashboard metrics for the current user
  app.get("/api/dashboard/metrics", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get all active projects (not archived)
      const allProjects = await storage.getProjectsByUser(effectiveUserId, effectiveUser.isAdmin ? 'admin' : 'user', { archived: false });

      // Filter projects where user is the service owner
      const myProjects = allProjects.filter(p => p.projectOwnerId === effectiveUserId);

      // Filter projects where user is the current assignee
      const myTasks = allProjects.filter(p => p.currentAssigneeId === effectiveUserId);

      // Create union of user's relevant projects (owned OR assigned)
      const myRelevantProjects = allProjects.filter(p => 
        p.projectOwnerId === effectiveUserId || p.currentAssigneeId === effectiveUserId
      );

      // PERFORMANCE FIX: Batch load all stages for unique project types (fix N+1 query)
      const uniqueProjectTypeIds = [...new Set(myRelevantProjects.map(p => p.projectTypeId))];
      const stagesByProjectType = new Map<string, any[]>();
      
      // Load all stages in parallel
      await Promise.all(
        uniqueProjectTypeIds.map(async (projectTypeId) => {
          const stages = await storage.getKanbanStagesByProjectTypeId(projectTypeId);
          stagesByProjectType.set(projectTypeId, stages);
        })
      );

      // Calculate behind schedule count (time in current stage > maxInstanceTime)
      // Only count from user's relevant projects
      let behindScheduleCount = 0;
      for (const project of myRelevantProjects) {
        // Get stage config from cached map
        const stages = stagesByProjectType.get(project.projectTypeId) || [];
        const currentStageConfig = stages.find(s => s.name === project.currentStatus);
        
        if (currentStageConfig?.maxInstanceTime && currentStageConfig.maxInstanceTime > 0) {
          // Calculate current business hours in stage
          const chronology = project.chronology || [];
          const sortedChronology = [...chronology].sort((a, b) => 
            new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
          );
          
          const lastEntry = sortedChronology.find(entry => entry.toStatus === project.currentStatus);
          const startTime = lastEntry?.timestamp || project.createdAt;
          
          if (startTime) {
            const { calculateBusinessHours } = await import("@shared/businessTime");
            const currentHours = calculateBusinessHours(
              typeof startTime === 'string' ? startTime : new Date(startTime).toISOString(),
              new Date().toISOString()
            );
            
            if (currentHours >= currentStageConfig.maxInstanceTime) {
              behindScheduleCount++;
            }
          }
        }
      }

      // Calculate late count (current date > due date)
      // Only count from user's relevant projects
      const now = new Date();
      const lateCount = myRelevantProjects.filter(p => {
        if (!p.dueDate) return false;
        const dueDate = new Date(p.dueDate);
        return now > dueDate;
      }).length;

      res.json({
        myProjectsCount: myProjects.length,
        myTasksCount: myTasks.length,
        behindScheduleCount,
        lateCount
      });
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Get projects where user is the service owner
  app.get("/api/dashboard/my-projects", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get all projects and filter by service owner
      const allProjects = await storage.getProjectsByUser(effectiveUserId, effectiveUser.isAdmin ? 'admin' : 'user', { archived: false });
      const myProjects = allProjects.filter(p => p.projectOwnerId === effectiveUserId);

      res.json(myProjects);
    } catch (error) {
      console.error("Error fetching my projects:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch my projects" });
    }
  });

  // Get projects where user is the current assignee
  app.get("/api/dashboard/my-tasks", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get all projects and filter by current assignee
      const allProjects = await storage.getProjectsByUser(effectiveUserId, effectiveUser.isAdmin ? 'admin' : 'user', { archived: false });
      const myTasks = allProjects.filter(p => p.currentAssigneeId === effectiveUserId);

      res.json(myTasks);
    } catch (error) {
      console.error("Error fetching my tasks:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch my tasks" });
    }
  });

  // ==================================================
  // DASHBOARD CACHE API ROUTES
  // ==================================================

  // Get cached dashboard statistics for current user
  app.get("/api/dashboard/cache", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;

      if (!effectiveUserId) {
        return res.status(404).json({ message: "User not found" });
      }

      const cacheData = await db.select().from(dashboardCache).where(eq(dashboardCache.userId, effectiveUserId));

      if (cacheData.length === 0) {
        // No cache exists yet, trigger an update and return zeros
        const { updateDashboardCache } = await import("../dashboard-cache-service");
        await updateDashboardCache(effectiveUserId);
        
        // Fetch the newly created cache
        const newCacheData = await db.select().from(dashboardCache).where(eq(dashboardCache.userId, effectiveUserId));
        return res.json(newCacheData[0] || {
          myTasksCount: 0,
          myProjectsCount: 0,
          overdueTasksCount: 0,
          behindScheduleCount: 0,
          lastUpdated: new Date(),
        });
      }

      res.json(cacheData[0]);
    } catch (error) {
      console.error("Error fetching dashboard cache:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch dashboard cache" });
    }
  });

  // Manually refresh dashboard cache for current user
  app.post("/api/dashboard/cache/refresh", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;

      if (!effectiveUserId) {
        return res.status(404).json({ message: "User not found" });
      }

      const { updateDashboardCache } = await import("../dashboard-cache-service");
      const result = await updateDashboardCache(effectiveUserId);

      if (result.status === 'error') {
        return res.status(500).json({ 
          message: "Failed to refresh dashboard cache",
          errors: result.errors 
        });
      }

      // Fetch the updated cache
      const cacheData = await db.select().from(dashboardCache).where(eq(dashboardCache.userId, effectiveUserId));

      res.json({
        success: true,
        cache: cacheData[0],
        message: "Dashboard cache refreshed successfully"
      });
    } catch (error) {
      console.error("Error refreshing dashboard cache:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to refresh dashboard cache" });
    }
  });
}
