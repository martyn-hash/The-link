import type { Express } from "express";
import { z } from "zod";
import { storage } from "../../storage/index";
import { completeProjectSchema } from "@shared/schema";
import { validateParams, paramUuidSchema } from "../routeHelpers";

export function registerProjectCoreRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
): void {
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

      const normalize = (v: any) => (v && v !== 'all' ? v : undefined);

      const filters = {
        month: normalize(req.query.month),
        archived: req.query.archived === 'true' ? true : req.query.archived === 'false' ? false : undefined,
        showArchived: req.query.showArchived === 'true' ? true : req.query.showArchived === 'false' ? false : undefined,
        showCompletedRegardless: req.query.showCompletedRegardless === 'true' ? true : req.query.showCompletedRegardless === 'false' ? false : undefined,
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

      const filters = {
        month: req.query.month as string | undefined,
        archived: req.query.archived === 'true' ? true : req.query.archived === 'false' ? false : undefined,
        inactive: req.query.inactive === 'true' ? true : req.query.inactive === 'false' ? false : undefined,
        serviceId: req.query.serviceId as string | undefined,
      };

      const projects = await storage.getProjectsByClient(clientId);
      let filtered = projects;
      if (filters.archived !== undefined) {
        filtered = filtered.filter(p => p.archived === filters.archived);
      }
      if (filters.inactive !== undefined) {
        filtered = filtered.filter(p => p.inactive === filters.inactive);
      }
      if (filters.month) {
        filtered = filtered.filter(p => p.projectMonth === filters.month);
      }
      if (filters.serviceId) {
        filtered = filtered.filter((p: any) => p.service?.id === filters.serviceId);
      }
      res.json(filtered);
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

      const progressMetrics = await storage.getProjectProgressMetrics(req.params.id);

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
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const stageChangeData = await storage.getMostRecentStageChange(projectId);
      
      if (!stageChangeData) {
        return res.status(404).json({ message: "No stage changes found for this project" });
      }
      
      res.json(stageChangeData);
    } catch (error) {
      console.error("Error fetching most recent stage change:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch most recent stage change" });
    }
  });

  app.patch("/api/projects/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const inactiveUpdateSchema = z.object({
        inactive: z.boolean(),
        inactiveReason: z.enum(["created_in_error", "no_longer_required", "client_doing_work_themselves"]).optional()
      }).refine((data) => {
        if (data.inactive && !data.inactiveReason) {
          return false;
        }
        if (!data.inactive && data.inactiveReason) {
          return false;
        }
        return true;
      }, {
        message: "When marking inactive, inactiveReason is required. When reactivating, inactiveReason should not be provided.",
      });
      
      const updateData = inactiveUpdateSchema.parse(req.body);

      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const canUpdate =
        effectiveUser.isAdmin ||
        project.currentAssigneeId === effectiveUserId ||
        project.clientManagerId === effectiveUserId ||
        project.bookkeeperId === effectiveUserId;

      if (!canUpdate) {
        return res.status(403).json({ message: "Not authorized to update this project" });
      }
      
      if (updateData.inactive && !project.inactive && !effectiveUser.canMakeProjectsInactive) {
        return res.status(403).json({ message: "You do not have permission to make projects inactive" });
      }

      const finalUpdateData: any = { inactive: updateData.inactive };
      
      if (updateData.inactive && !project.inactive) {
        finalUpdateData.inactiveReason = updateData.inactiveReason;
        finalUpdateData.inactiveAt = new Date();
        finalUpdateData.inactiveByUserId = effectiveUserId;
        finalUpdateData.dueDate = null;
        
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
        finalUpdateData.inactiveReason = null;
        finalUpdateData.inactiveAt = null;
        finalUpdateData.inactiveByUserId = null;
        
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

  // GET /api/projects/:id/voice-ai-status - Get voice AI availability for a project
  app.get("/api/projects/:id/voice-ai-status", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const projectType = await storage.getProjectTypeById(project.projectTypeId);
      const dialoraSettings = projectType?.dialoraSettings as any;
      const hasWebhooksConfigured = dialoraSettings?.outboundWebhooks?.some((w: any) => w.active) ?? false;

      res.json({
        useVoiceAiForQueries: project.useVoiceAiForQueries ?? false,
        hasWebhooksConfigured,
        isVoiceAvailable: (project.useVoiceAiForQueries ?? false) && hasWebhooksConfigured,
      });
    } catch (error) {
      console.error("Error fetching voice AI status:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch voice AI status" });
    }
  });

  // PATCH /api/projects/:id/voice-ai-settings - Update voice AI settings for a project
  app.patch("/api/projects/:id/voice-ai-settings", isAuthenticated, resolveEffectiveUser, requireManager, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const voiceAiSettingsSchema = z.object({
        useVoiceAiForQueries: z.boolean(),
      });
      
      const { useVoiceAiForQueries } = voiceAiSettingsSchema.parse(req.body);

      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get project type to check webhooks
      const projectType = await storage.getProjectTypeById(project.projectTypeId);
      const dialoraSettings = projectType?.dialoraSettings as any;
      const hasWebhooksConfigured = dialoraSettings?.outboundWebhooks?.some((w: any) => w.active) ?? false;

      // If enabling voice AI, check that project type has webhooks configured
      if (useVoiceAiForQueries && !hasWebhooksConfigured) {
        return res.status(400).json({ 
          message: "Cannot enable Voice AI: No active webhooks configured for this project type. Please configure webhooks in the project type settings first.",
          code: "NO_WEBHOOKS_CONFIGURED"
        });
      }

      const updatedProject = await storage.updateProject(req.params.id, {
        useVoiceAiForQueries,
      });

      // Return the full status payload to match GET endpoint structure
      const updatedUseVoiceAi = updatedProject.useVoiceAiForQueries ?? false;
      res.json({
        useVoiceAiForQueries: updatedUseVoiceAi,
        hasWebhooksConfigured,
        isVoiceAvailable: updatedUseVoiceAi && hasWebhooksConfigured,
        message: useVoiceAiForQueries 
          ? "Voice AI enabled for queries" 
          : "Voice AI disabled for queries"
      });
    } catch (error) {
      console.error("Error updating voice AI settings:", error instanceof Error ? error.message : error);
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else {
        res.status(500).json({ message: "Failed to update voice AI settings" });
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

      const { completionStatus, chronologyNotes } = completeProjectSchema.parse(req.body);

      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const canComplete =
        effectiveUser.isAdmin ||
        project.currentAssigneeId === effectiveUserId ||
        project.clientManagerId === effectiveUserId ||
        project.bookkeeperId === effectiveUserId;

      if (!canComplete) {
        return res.status(403).json({ message: "Not authorized to complete this project" });
      }

      if (project.projectTypeId && project.currentStatus) {
        const stages = await storage.getKanbanStagesByProjectTypeId(project.projectTypeId);
        const currentStage = stages.find(stage => stage.name === project.currentStatus);

        if (!currentStage) {
          console.warn(`Project ${project.id} has currentStatus '${project.currentStatus}' which doesn't match any stage in project type ${project.projectTypeId}`);
          return res.status(400).json({
            message: `Cannot complete project: the current stage '${project.currentStatus}' is not configured in the project type. Please update the project to a valid stage before completing.`,
            code: "INVALID_STAGE_CONFIGURATION"
          });
        }

        if (!currentStage.canBeFinalStage) {
          return res.status(400).json({
            message: `This project cannot be completed at the current stage ('${currentStage.name}'). Please move the project to an appropriate final stage before marking it as complete.`,
            code: "INVALID_COMPLETION_STAGE",
            currentStage: currentStage.name
          });
        }
      }

      const updatedProject = await storage.updateProject(req.params.id, {
        completionStatus,
        currentStatus: 'Archived',
        archived: true,
        inactive: true
      });

      const completionNotes = completionStatus === 'completed_successfully'
        ? 'Manual completion - successful'
        : 'Manual completion - unsuccessful';

      await storage.createChronologyEntry({
        projectId: req.params.id,
        fromStatus: project.currentStatus,
        toStatus: 'Archived',
        assigneeId: effectiveUserId,
        changeReason: completionNotes,
        notes: chronologyNotes || `Project manually marked as ${completionStatus === 'completed_successfully' ? 'successfully completed' : 'unsuccessfully completed'} by ${effectiveUser.name}. Completion status: ${completionStatus}`
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
}
