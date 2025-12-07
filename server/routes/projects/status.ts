import type { Express } from "express";
import { storage } from "../../storage/index";
import { updateProjectStatusSchema } from "@shared/schema";

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
      
      const enhancedStages = stages.map(stage => ({
        ...stage,
        validReasonIds: Array.from(stageReasonMap.get(stage.id) || []),
      }));
      
      const enhancedReasons = allReasons.map(reason => ({
        ...reason,
        customFields: reasonCustomFieldsMap.get(reason.id) || [],
      }));
      
      const approvalIds = new Set(stageApprovals.map(a => a.id));
      const relevantApprovalFields = allApprovalFields.filter(
        field => approvalIds.has(field.stageApprovalId)
      );
      
      res.json({
        projectTypeId,
        currentStatus: project.currentStatus,
        stages: enhancedStages,
        reasons: enhancedReasons,
        stageApprovals,
        stageApprovalFields: relevantApprovalFields,
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
        const [stage, reason, mappingValidation, fieldValidation] = await Promise.all([
          storage.getStageById(updateData.stageId),
          storage.getChangeReasonById(updateData.reasonId),
          storage.validateStageReasonMapping(updateData.stageId, updateData.reasonId),
          storage.validateRequiredFields(updateData.reasonId, updateData.fieldResponses),
        ]);

        if (!stage || stage.projectTypeId !== project.projectTypeId) {
          return res.status(400).json({ message: "Invalid project status for this project type" });
        }
        if (stage.name !== updateData.newStatus) {
          return res.status(400).json({ message: "Stage configuration has changed. Please refresh and try again." });
        }
        if (!reason || reason.projectTypeId !== project.projectTypeId) {
          return res.status(400).json({ message: "Invalid change reason" });
        }
        if (reason.reason !== updateData.changeReason) {
          return res.status(400).json({ message: "Change reason configuration has changed. Please refresh and try again." });
        }
        if (!mappingValidation.isValid) {
          return res.status(400).json({ message: mappingValidation.reason || "Invalid change reason for this stage" });
        }
        if (!fieldValidation.isValid) {
          return res.status(400).json({
            message: fieldValidation.reason || "Required fields are missing",
            missingFields: fieldValidation.missingFields
          });
        }

        targetStage = stage;
        changeReason = reason;
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

      setImmediate(async () => {
        try {
          const { sendStageChangeNotificationEmail } = await import("../../emailService");
          
          const newStage = await storage.getStageById(targetStage.id);
          if (!newStage) {
            console.warn(`[Stage Change Email] Stage ${targetStage.id} not found`);
          } else {
            let usersToNotify: any[] = [];
            
            if (newStage.assignedUserId) {
              const assignedUser = await storage.getUser(newStage.assignedUserId);
              if (assignedUser) {
                usersToNotify = [assignedUser];
              }
            } else if (newStage.assignedWorkRoleId) {
              const workRole = await storage.getWorkRoleById(newStage.assignedWorkRoleId);
              if (workRole) {
                const roleAssignment = await storage.resolveRoleAssigneeForClient(
                  project.clientId,
                  project.projectTypeId,
                  workRole.name
                );
                if (roleAssignment) {
                  usersToNotify = [roleAssignment];
                }
              }
            }

            const previousAssigneeId = project.currentAssigneeId;
            
            for (const user of usersToNotify) {
              if (user.id === previousAssigneeId) {
                console.log(`[Stage Change Email] User ${user.email} is same as previous assignee, skipping email notification`);
                continue;
              }
              
              const preferences = await storage.getUserNotificationPreferences(user.id);
              const notifyStageChanges = preferences?.notifyStageChanges ?? true;

              if (!notifyStageChanges) {
                console.log(`[Stage Change Email] User ${user.email} has stage change notifications disabled, skipping`);
                continue;
              }

              if (!user.email) {
                console.warn(`[Stage Change Email] User ${user.id} has no email address`);
                continue;
              }

              const projectWithDetails = await storage.getProject(updatedProject.id);
              if (!projectWithDetails) {
                console.warn(`[Stage Change Email] Project ${updatedProject.id} not found`);
                continue;
              }

              const userName = user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user.email;

              const stageConfig = newStage.maxInstanceTime ? { maxInstanceTime: newStage.maxInstanceTime } : undefined;
              const chronology = await storage.getProjectChronology(updatedProject.id);
              const notesForEmail = updateData.notesHtml || updateData.notes;
              
              const emailSent = await sendStageChangeNotificationEmail(
                user.email,
                userName,
                projectWithDetails.description || 'Untitled Project',
                projectWithDetails.client?.name || 'Unknown Client',
                updateData.newStatus,
                project.currentStatus,
                updatedProject.id,
                stageConfig,
                chronology
                  .filter(c => c.timestamp !== null)
                  .map(c => ({ 
                    toStatus: c.toStatus, 
                    timestamp: c.timestamp!.toISOString() 
                  })),
                projectWithDetails.createdAt?.toISOString(),
                updateData.changeReason,
                notesForEmail,
                undefined,
                updateData.attachments
              );

              if (emailSent) {
                console.log(`[Stage Change Email] Sent to ${user.email} for project ${updatedProject.id}`);
              } else {
                console.warn(`[Stage Change Email] Failed to send to ${user.email} for project ${updatedProject.id}`);
              }
            }
          }
        } catch (emailError) {
          console.error("[Stage Change Email] Error sending automatic notifications:", emailError);
        }

        try {
          const { handleProjectStageChangeForNotifications, getStageIdByName } = await import("../../notification-scheduler");
          const newStageId = await getStageIdByName(project.projectTypeId, updateData.newStatus);
          if (newStageId) {
            const { suppressed, reactivated } = await handleProjectStageChangeForNotifications(
              updatedProject.id,
              newStageId
            );
            if (suppressed > 0 || reactivated > 0) {
              console.log(`[Stage Change Notifications] Project ${updatedProject.id}: ${suppressed} suppressed, ${reactivated} reactivated`);
            }
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
}
