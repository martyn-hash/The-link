import type { Express } from "express";
import { storage } from "../storage/index";
import { z } from "zod";
import {
  insertKanbanStageSchema,
  updateKanbanStageSchema,
  insertChangeReasonSchema,
  updateChangeReasonSchema,
  insertProjectTypeSchema,
  updateProjectTypeSchema,
  insertStageReasonMapSchema,
  insertReasonCustomFieldSchema,
  updateReasonCustomFieldSchema,
  insertStageApprovalSchema,
  updateStageApprovalSchema,
  insertStageApprovalFieldSchema,
  updateStageApprovalFieldSchema,
  insertStageApprovalResponseSchema,
} from "@shared/schema";

// Parameter validation schemas
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

export function registerConfigRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
): void {
  // Configuration routes

  // Kanban Stages
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

  // Change Reasons
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

      // Check if we're trying to activate the project type
      if ('active' in updateData && typeof updateData.active === 'boolean' && updateData.active === true) {
        // Verify that at least one stage has canBeFinalStage = true
        const stages = await storage.getKanbanStagesByProjectTypeId(req.params.id);
        const hasFinalStage = stages.some(stage => stage.canBeFinalStage === true);

        if (!hasFinalStage) {
          return res.status(400).json({
            message: "Cannot activate project type without at least one final stage. Please mark at least one stage as 'Can be final Stage' before activating.",
            code: "NO_FINAL_STAGE"
          });
        }
      }

      // Check if we're trying to deactivate the project type
      if ('active' in updateData && typeof updateData.active === 'boolean' && updateData.active === false) {
        // Get the current project type to check if it's currently active
        const allProjectTypes = await storage.getAllProjectTypes();
        const projectType = allProjectTypes.find(pt => pt.id === req.params.id);

        if (!projectType) {
          return res.status(404).json({ message: "Project type not found" });
        }

        // Only check for active projects if we're changing from active to inactive
        if (projectType.active === true) {
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
}
