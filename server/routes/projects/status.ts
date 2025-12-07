import type { Express } from "express";
import { storage } from "../../storage/index";
import { updateProjectStatusSchema } from "@shared/schema";
import { sendStageChangeNotificationEmail } from "../../emailService";
import { handleProjectStageChangeForNotifications } from "../../notification-scheduler";
import { stageConfigCache } from "../../utils/ttlCache";

interface StageConfigCacheEntry {
  stages: any[];
  reasons: any[];
  stageApprovals: any[];
  stageApprovalFields: any[];
  stageReasonMap: Map<string, Set<string>>;
  reasonCustomFieldsMap: Map<string, any[]>;
}

async function getStageConfigForProjectType(projectTypeId: string): Promise<StageConfigCacheEntry> {
  const cacheKey = `projectType:${projectTypeId}`;
  const cached = stageConfigCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const [stages, allReasons, stageApprovals, allApprovalFields, allStageReasonMaps, allCustomFields] = await Promise.all([
    storage.getKanbanStagesByProjectTypeId(projectTypeId),
    storage.getChangeReasonsByProjectTypeId(projectTypeId),
    storage.getStageApprovalsByProjectTypeId(projectTypeId),
    storage.getAllStageApprovalFields(),
    storage.getAllStageReasonMaps(),
    storage.getAllReasonCustomFields(),
  ]);

  const stageIds = new Set(stages.map(s => s.id));
  const reasonIds = new Set(allReasons.map(r => r.id));

  const stageReasonMap = new Map<string, Set<string>>();
  for (const stage of stages) {
    stageReasonMap.set(stage.id, new Set());
  }
  for (const mapping of allStageReasonMaps) {
    if (stageIds.has(mapping.stageId) && reasonIds.has(mapping.reasonId)) {
      stageReasonMap.get(mapping.stageId)?.add(mapping.reasonId);
    }
  }

  const reasonCustomFieldsMap = new Map<string, any[]>();
  for (const field of allCustomFields) {
    if (reasonIds.has(field.reasonId)) {
      if (!reasonCustomFieldsMap.has(field.reasonId)) {
        reasonCustomFieldsMap.set(field.reasonId, []);
      }
      reasonCustomFieldsMap.get(field.reasonId)!.push(field);
    }
  }

  const approvalIds = new Set(stageApprovals.map(a => a.id));
  const relevantApprovalFields = allApprovalFields.filter(
    field => approvalIds.has(field.stageApprovalId)
  );

  const config: StageConfigCacheEntry = {
    stages,
    reasons: allReasons,
    stageApprovals,
    stageApprovalFields: relevantApprovalFields,
    stageReasonMap,
    reasonCustomFieldsMap,
  };

  stageConfigCache.set(cacheKey, config);
  return config;
}

export function registerProjectStatusRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
): void {
  // GET /api/projects/:id/stage-change-config - Combined endpoint for all stage change configuration
  app.get("/api/projects/:id/stage-change-config", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const projectId = req.params.id;
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const projectTypeId = project.projectTypeId;
      
      const config = await getStageConfigForProjectType(projectTypeId);
      
      const enhancedStages = config.stages.map(stage => ({
        ...stage,
        validReasonIds: Array.from(config.stageReasonMap.get(stage.id) || []),
      }));
      
      const enhancedReasons = config.reasons.map(reason => ({
        ...reason,
        customFields: config.reasonCustomFieldsMap.get(reason.id) || [],
      }));
      
      res.json({
        projectTypeId,
        currentStatus: project.currentStatus,
        stages: enhancedStages,
        reasons: enhancedReasons,
        stageApprovals: config.stageApprovals,
        stageApprovalFields: config.stageApprovalFields,
      });
    } catch (error) {
      console.error("Error fetching stage change config:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to fetch stage change config" });
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

      const project = await storage.getProject(updateData.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (project.completionStatus) {
        return res.status(400).json({
          message: "Cannot update status of a completed project"
        });
      }

      let targetStage: any;
      let changeReason: any;

      if (updateData.stageId && updateData.reasonId) {
        const [validationData, fieldValidation] = await Promise.all([
          storage.getStageChangeValidationData(updateData.stageId, updateData.reasonId, project.projectTypeId),
          storage.validateRequiredFields(updateData.reasonId, updateData.fieldResponses),
        ]);

        if (!validationData.isValid) {
          return res.status(400).json({ message: validationData.validationError || "Validation failed" });
        }
        if (validationData.stage!.name !== updateData.newStatus) {
          return res.status(400).json({ message: "Stage configuration has changed. Please refresh and try again." });
        }
        if (validationData.reason!.reason !== updateData.changeReason) {
          return res.status(400).json({ message: "Change reason configuration has changed. Please refresh and try again." });
        }
        if (!fieldValidation.isValid) {
          return res.status(400).json({
            message: fieldValidation.reason || "Required fields are missing",
            missingFields: fieldValidation.missingFields
          });
        }

        targetStage = validationData.stage;
        changeReason = validationData.reason;
      } else {
        const stageValidation = await storage.validateProjectStatus(updateData.newStatus);
        if (!stageValidation.isValid) {
          return res.status(400).json({ message: stageValidation.reason || "Invalid project status" });
        }

        const stages = await storage.getAllKanbanStages();
        targetStage = stages.find(stage => 
          stage.name === updateData.newStatus && 
          stage.projectTypeId === project.projectTypeId
        );
        if (!targetStage) {
          return res.status(400).json({ message: "Invalid project status for this project type" });
        }

        const reasons = await storage.getChangeReasonsByProjectTypeId(project.projectTypeId);
        changeReason = reasons.find(reason => reason.reason === updateData.changeReason);
        if (!changeReason) {
          return res.status(400).json({ message: "Invalid change reason" });
        }

        const mappingValidation = await storage.validateStageReasonMapping(targetStage.id, changeReason.id);
        if (!mappingValidation.isValid) {
          return res.status(400).json({ message: mappingValidation.reason || "Invalid change reason for this stage" });
        }

        const fieldValidation = await storage.validateRequiredFields(changeReason.id, updateData.fieldResponses);
        if (!fieldValidation.isValid) {
          return res.status(400).json({
            message: fieldValidation.reason || "Required fields are missing",
            missingFields: fieldValidation.missingFields
          });
        }
      }

      const effectiveApprovalId = changeReason.stageApprovalId || targetStage.stageApprovalId;
      
      if (effectiveApprovalId) {
        const existingResponses = await storage.getStageApprovalResponsesByProjectId(updateData.projectId);
        const approvalFields = await storage.getStageApprovalFieldsByApprovalId(effectiveApprovalId);
        const fieldIds = new Set(approvalFields.map(f => f.id));
        const stageApprovalResponses = existingResponses.filter(r => fieldIds.has(r.fieldId));

        if (approvalFields.length > 0) {
          const responsesForValidation = stageApprovalResponses.map(response => ({
            fieldId: response.fieldId,
            projectId: response.projectId,
            valueBoolean: response.valueBoolean,
            valueNumber: response.valueNumber,
            valueLongText: response.valueLongText,
            valueMultiSelect: response.valueMultiSelect,
          }));

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

      const clientNotificationPreview = await storage.prepareClientValueNotification(
        updatedProject.id,
        updateData.newStatus,
        effectiveUserId,
        project.currentStatus
      );

      console.log(`[Stage Change] Project ${updatedProject.id}: clientNotificationPreview ${clientNotificationPreview ? 'created with ' + clientNotificationPreview.recipients.length + ' recipients' : 'is null'}`);

      res.json({ 
        project: updatedProject, 
        clientNotificationPreview,
        notificationType: 'client' as const
      });

      const backgroundContext = {
        stageId: targetStage.id,
        stageName: targetStage.name,
        stageAssignedUserId: targetStage.assignedUserId,
        stageAssignedWorkRoleId: targetStage.assignedWorkRoleId,
        stageMaxInstanceTime: targetStage.maxInstanceTime,
        projectId: updatedProject.id,
        projectDescription: project.description,
        projectClientId: project.clientId,
        projectClientName: project.client?.name || 'Unknown Client',
        projectTypeId: project.projectTypeId,
        projectCreatedAt: project.createdAt?.toISOString(),
        previousStatus: project.currentStatus,
        previousAssigneeId: project.currentAssigneeId,
        newStatus: updateData.newStatus,
        changeReason: updateData.changeReason,
        notes: updateData.notesHtml || updateData.notes,
        attachments: updateData.attachments,
      };

      setImmediate(async () => {
        try {
          let usersToNotify: any[] = [];
          
          if (backgroundContext.stageAssignedUserId) {
            const assignedUser = await storage.getUser(backgroundContext.stageAssignedUserId);
            if (assignedUser) {
              usersToNotify = [assignedUser];
            }
          } else if (backgroundContext.stageAssignedWorkRoleId) {
            const workRole = await storage.getWorkRoleById(backgroundContext.stageAssignedWorkRoleId);
            if (workRole) {
              const roleAssignment = await storage.resolveRoleAssigneeForClient(
                backgroundContext.projectClientId,
                backgroundContext.projectTypeId,
                workRole.name
              );
              if (roleAssignment) {
                usersToNotify = [roleAssignment];
              }
            }
          }

          if (usersToNotify.length === 0) {
            console.log(`[Stage Change Email] No users to notify for stage ${backgroundContext.stageName}`);
          } else {
            const userIds = usersToNotify.map(u => u.id);
            const allPreferences = await storage.getUserNotificationPreferencesForUsers(userIds);
            
            let chronology: any[] | null = null;
            
            for (const user of usersToNotify) {
              if (user.id === backgroundContext.previousAssigneeId) {
                console.log(`[Stage Change Email] User ${user.email} is same as previous assignee, skipping email notification`);
                continue;
              }
              
              const preferences = allPreferences.get(user.id);
              const notifyStageChanges = preferences?.notifyStageChanges ?? true;

              if (!notifyStageChanges) {
                console.log(`[Stage Change Email] User ${user.email} has stage change notifications disabled, skipping`);
                continue;
              }

              if (!user.email) {
                console.warn(`[Stage Change Email] User ${user.id} has no email address`);
                continue;
              }

              const userName = user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user.email;

              const stageConfig = backgroundContext.stageMaxInstanceTime 
                ? { maxInstanceTime: backgroundContext.stageMaxInstanceTime } 
                : undefined;
              
              if (!chronology) {
                chronology = await storage.getProjectChronology(backgroundContext.projectId);
              }
              
              const emailSent = await sendStageChangeNotificationEmail(
                user.email,
                userName,
                backgroundContext.projectDescription || 'Untitled Project',
                backgroundContext.projectClientName,
                backgroundContext.newStatus,
                backgroundContext.previousStatus,
                backgroundContext.projectId,
                stageConfig,
                chronology
                  .filter((c: any) => c.timestamp !== null)
                  .map((c: any) => ({ 
                    toStatus: c.toStatus, 
                    timestamp: c.timestamp!.toISOString() 
                  })),
                backgroundContext.projectCreatedAt,
                backgroundContext.changeReason,
                backgroundContext.notes,
                undefined,
                backgroundContext.attachments
              );

              if (emailSent) {
                console.log(`[Stage Change Email] Sent to ${user.email} for project ${backgroundContext.projectId}`);
              } else {
                console.warn(`[Stage Change Email] Failed to send to ${user.email} for project ${backgroundContext.projectId}`);
              }
            }
          }
        } catch (emailError) {
          console.error("[Stage Change Email] Error sending automatic notifications:", emailError);
        }

        try {
          const { suppressed, reactivated } = await handleProjectStageChangeForNotifications(
            backgroundContext.projectId,
            backgroundContext.stageId
          );
          if (suppressed > 0 || reactivated > 0) {
            console.log(`[Stage Change Notifications] Project ${backgroundContext.projectId}: ${suppressed} suppressed, ${reactivated} reactivated`);
          }
        } catch (notificationError) {
          console.error("[Stage Change Notifications] Error handling notification suppression/reactivation:", notificationError);
        }
      });
    } catch (error) {
      console.error("[PATCH /api/projects/:id/status] Error updating project status:", error instanceof Error ? error.message : error);
      console.error("[PATCH /api/projects/:id/status] Full error stack:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        console.error("[PATCH /api/projects/:id/status] Validation errors:", (error as any).issues);
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else if (error instanceof Error && error.message) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to update project status" });
      }
    }
  });

  app.get("/api/admin/cache-stats", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const stats = stageConfigCache.getStats();
      const hitRate = stageConfigCache.getHitRate();
      
      res.json({
        stageConfigCache: {
          ...stats,
          hitRatePercent: (hitRate * 100).toFixed(1) + '%',
        },
      });
    } catch (error) {
      console.error("Error fetching cache stats:", error);
      res.status(500).json({ message: "Failed to fetch cache stats" });
    }
  });

  app.post("/api/admin/cache-invalidate", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const { projectTypeId } = req.body;
      
      if (projectTypeId) {
        stageConfigCache.invalidate(`projectType:${projectTypeId}`);
        res.json({ message: `Cache invalidated for projectType: ${projectTypeId}` });
      } else {
        stageConfigCache.invalidateAll();
        res.json({ message: "All caches invalidated" });
      }
    } catch (error) {
      console.error("Error invalidating cache:", error);
      res.status(500).json({ message: "Failed to invalidate cache" });
    }
  });
}
