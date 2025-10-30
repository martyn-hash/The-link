import type { Express } from "express";
import Papa from "papaparse";
import { storage } from "../storage";
import { z } from "zod";
import {
  insertProjectViewSchema,
  updateProjectStatusSchema,
  completeProjectSchema,
  csvProjectSchema,
  insertStageApprovalResponseSchema,
} from "@shared/schema";
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
  // PROJECTS API ROUTES
  // ==================================================

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
      };

      const projects = await storage.getProjectsByUser(effectiveUserId, effectiveUser.isAdmin ? 'admin' : 'user', filters);
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

      // Send stage change notification to role assignee
      await storage.sendStageChangeNotifications(
        updatedProject.id,
        updateData.newStatus,
        project.currentStatus
      );

      res.json(updatedProject);
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

      // Resolve current role assignments for this client and service
      let bookkeeper = null;
      let clientManager = null;
      let serviceOwner = null;

      // Try to resolve bookkeeper role (correct case-sensitive name)
      if (project.projectTypeId) {
        const bookkeeperUser = await storage.resolveRoleAssigneeForClient(
          project.clientId,
          project.projectTypeId,
          'Bookkeeper'  // Correct capitalization
        );
        if (bookkeeperUser) {
          const { passwordHash, ...sanitizedBookkeeper } = bookkeeperUser;
          bookkeeper = sanitizedBookkeeper;
        }

        // Try to resolve client manager role (correct case-sensitive name with space)
        const clientManagerUser = await storage.resolveRoleAssigneeForClient(
          project.clientId,
          project.projectTypeId,
          'Client Manager'  // Correct capitalization with space
        );
        if (clientManagerUser) {
          const { passwordHash, ...sanitizedClientManager } = clientManagerUser;
          clientManager = sanitizedClientManager;
        }

        // Try to resolve service owner
        const serviceOwnerUser = await storage.resolveServiceOwner(
          project.clientId,
          project.projectTypeId
        );
        if (serviceOwnerUser) {
          const { passwordHash, ...sanitizedServiceOwner } = serviceOwnerUser;
          serviceOwner = sanitizedServiceOwner;
        }
      }

      // Fallback to project fields if role resolution fails
      if (!bookkeeper && project.bookkeeper) {
        const { passwordHash, ...sanitizedBookkeeper } = project.bookkeeper;
        bookkeeper = sanitizedBookkeeper;
      }
      if (!clientManager && project.clientManager) {
        const { passwordHash, ...sanitizedClientManager } = project.clientManager;
        clientManager = sanitizedClientManager;
      }
      if (!serviceOwner && project.projectOwner) {
        const { passwordHash, ...sanitizedServiceOwner } = project.projectOwner;
        serviceOwner = sanitizedServiceOwner;
      }

      res.json({
        bookkeeper,
        clientManager,
        serviceOwner
      });
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
}
