import type { Express } from "express";
import { z } from "zod";
import { storage } from "../../storage/index";
import { invalidateAllViewCaches } from "../../view-cache-service";

const bulkMoveValidationSchema = z.object({
  projectTypeId: z.string().uuid(),
  targetStageName: z.string().min(1),
});

const bulkUpdateStatusSchema = z.object({
  projectIds: z.array(z.string().uuid()).min(1, "At least one project is required"),
  newStatus: z.string().min(1, "New status is required"),
  changeReason: z.string().min(1, "Change reason is required"),
  notesHtml: z.string().optional(),
});

export function registerProjectBulkRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
): void {
  app.post("/api/projects/bulk-move-eligibility", isAuthenticated, async (req: any, res: any) => {
    try {
      const { projectTypeId, targetStageName } = bulkMoveValidationSchema.parse(req.body);

      const stages = await storage.getAllKanbanStages();
      const targetStage = stages.find(stage => 
        stage.name === targetStageName && 
        stage.projectTypeId === projectTypeId
      );

      if (!targetStage) {
        return res.status(404).json({ 
          eligible: false,
          blockingReason: "stage_not_found",
          message: "Stage not found for this project type."
        });
      }

      const restrictions: string[] = [];

      if (targetStage.stageApprovalId) {
        restrictions.push("stage_approval");
      }

      const projectTypeNotifications = await storage.getProjectTypeNotificationsByProjectTypeId(projectTypeId);
      const activeStageNotifications = projectTypeNotifications.filter(
        (n: any) => n.isActive && n.category === 'stage' && n.stageId === targetStage.id
      );
      if (activeStageNotifications.length > 0) {
        restrictions.push("client_notifications");
      }

      const allReasons = await storage.getChangeReasonsByProjectTypeId(projectTypeId);
      
      const stageReasonMappings = await storage.getAllStageReasonMaps();
      const validReasonIdsForStage = new Set(
        stageReasonMappings
          .filter((m: any) => m.stageId === targetStage.id)
          .map((m: any) => m.reasonId)
      );

      const reasonsForStage = allReasons.filter((r: any) => validReasonIdsForStage.has(r.id));

      const validReasonsForBulk: any[] = [];
      for (const reason of reasonsForStage) {
        if (reason.stageApprovalId) {
          continue;
        }

        const customFields = await storage.getReasonCustomFieldsByReasonId(reason.id);
        if (customFields.length > 0) {
          continue;
        }

        validReasonsForBulk.push({
          id: reason.id,
          reason: reason.reason,
        });
      }

      if (validReasonsForBulk.length === 0 && reasonsForStage.length > 0) {
        restrictions.push("all_reasons_have_requirements");
      }

      const blockingRestrictions = restrictions.filter(r => 
        r === "stage_approval" || r === "client_notifications"
      );

      const eligible = blockingRestrictions.length === 0 && validReasonsForBulk.length > 0;

      res.json({
        eligible,
        restrictions,
        validReasons: eligible ? validReasonsForBulk : [],
        stageId: targetStage.id,
        stageName: targetStage.name,
      });

    } catch (error) {
      console.error("[POST /api/projects/bulk-move-eligibility] Error:", error instanceof Error ? error.message : error);
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else {
        res.status(500).json({ message: "Failed to validate bulk move eligibility" });
      }
    }
  });

  app.post("/api/projects/bulk-status", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const { projectIds, newStatus, changeReason, notesHtml } = bulkUpdateStatusSchema.parse(req.body);

      const projects = await Promise.all(
        projectIds.map(id => storage.getProject(id))
      );

      const missingProjects = projectIds.filter((id, index) => !projects[index]);
      if (missingProjects.length > 0) {
        return res.status(404).json({ 
          message: `Projects not found: ${missingProjects.join(', ')}` 
        });
      }

      const projectTypeId = projects[0]!.projectTypeId;
      const mixedTypes = projects.some(p => p!.projectTypeId !== projectTypeId);
      if (mixedTypes) {
        return res.status(400).json({ 
          message: "All projects must be of the same type for bulk status update" 
        });
      }

      const completedProjects = projects.filter(p => p!.completionStatus);
      if (completedProjects.length > 0) {
        return res.status(400).json({ 
          message: "Cannot update status of completed projects" 
        });
      }

      const stages = await storage.getAllKanbanStages();
      const targetStage = stages.find(stage => 
        stage.name === newStatus && 
        stage.projectTypeId === projectTypeId
      );
      if (!targetStage) {
        return res.status(400).json({ message: "Invalid project status for this project type" });
      }

      if (targetStage.stageApprovalId) {
        return res.status(400).json({ 
          message: "This stage requires approval fields. Projects must be moved individually.",
          blockingReason: "stage_approval"
        });
      }

      const reasons = await storage.getChangeReasonsByProjectTypeId(projectTypeId);
      const reason = reasons.find(r => r.reason === changeReason);
      if (!reason) {
        return res.status(400).json({ message: "Invalid change reason" });
      }

      if (reason.stageApprovalId) {
        return res.status(400).json({ 
          message: "This change reason requires approval fields. Projects must be moved individually.",
          blockingReason: "reason_approval"
        });
      }

      const mappingValidation = await storage.validateStageReasonMapping(targetStage.id, reason.id);
      if (!mappingValidation.isValid) {
        return res.status(400).json({ message: mappingValidation.reason || "Invalid change reason for this stage" });
      }

      const customFields = await storage.getReasonCustomFieldsByReasonId(reason.id);
      if (customFields.length > 0) {
        return res.status(400).json({ 
          message: "This change reason requires custom fields. Projects must be moved individually.",
          blockingReason: "custom_fields"
        });
      }

      const projectTypeNotifications = await storage.getProjectTypeNotificationsByProjectTypeId(projectTypeId);
      const activeStageNotifications = projectTypeNotifications.filter(
        (n: any) => n.isActive && n.category === 'stage' && n.stageId === targetStage.id
      );
      if (activeStageNotifications.length > 0) {
        return res.status(400).json({ 
          message: "This stage has client notification templates configured. Projects must be moved individually.",
          blockingReason: "client_notifications"
        });
      }

      const sharedTimestamp = new Date();
      const updatedProjects: any[] = [];
      const errors: { projectId: string; error: string }[] = [];

      for (const project of projects) {
        try {
          const updateData = {
            projectId: project!.id,
            newStatus,
            changeReason,
            notesHtml: notesHtml || undefined,
            notes: undefined,
            fieldResponses: [],
            attachments: [],
          };

          const updatedProject = await storage.updateProjectStatus(updateData, effectiveUserId);
          updatedProjects.push(updatedProject);
        } catch (error) {
          errors.push({
            projectId: project!.id,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }

      if (errors.length > 0) {
        console.error("[POST /api/projects/bulk-status] Partial failure:", errors);
        return res.status(207).json({
          message: `${updatedProjects.length} of ${projectIds.length} projects updated successfully`,
          updatedProjects,
          errors,
          partialSuccess: true
        });
      }

      console.log(`[POST /api/projects/bulk-status] Successfully updated ${updatedProjects.length} projects to ${newStatus}`);

      if (updatedProjects.length > 0) {
        setImmediate(async () => {
          try {
            await invalidateAllViewCaches();
          } catch (cacheError) {
            console.error("[View Cache] Error invalidating caches:", cacheError);
          }
        });
      }

      res.json({
        message: `Successfully moved ${updatedProjects.length} project${updatedProjects.length !== 1 ? 's' : ''} to ${newStatus}`,
        updatedProjects,
        count: updatedProjects.length
      });
    } catch (error) {
      console.error("[POST /api/projects/bulk-status] Error:", error instanceof Error ? error.message : error);
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else if (error instanceof Error && error.message) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to update project statuses" });
      }
    }
  });
}
