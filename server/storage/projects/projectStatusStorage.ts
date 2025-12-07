import { db } from '../../db.js';
import {
  projects,
  projectChronology,
  kanbanStages,
  changeReasons,
  reasonCustomFields,
  reasonFieldResponses,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type {
  Project,
  UpdateProjectStatus,
  ProjectWithRelations,
} from '@shared/schema';
import { calculateBusinessHours } from '@shared/businessTime';
import type { ProjectStorageHelpers } from './types.js';

/**
 * Storage class for project status update operations.
 * 
 * Handles:
 * - Status transitions with validation
 * - Chronology entry creation
 * - Field response handling
 * - Assignee determination based on kanban stages
 * - Notification dispatching
 * - Message thread creation for stage changes
 */
export class ProjectStatusStorage {
  constructor(
    private projectHelpers: ProjectStorageHelpers,
    private getProject: (id: string) => Promise<ProjectWithRelations | undefined>
  ) {}

  async updateProjectStatus(update: UpdateProjectStatus, userId: string): Promise<Project> {
    const project = await this.getProject(update.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const oldStatus = project.currentStatus;
    const previousAssigneeId = project.currentAssigneeId;

    if (!this.projectHelpers.validateProjectStatus) {
      throw new Error('Helper validateProjectStatus not registered');
    }
    const validation = await this.projectHelpers.validateProjectStatus(update.newStatus);
    if (!validation.isValid) {
      throw new Error(validation.reason || "Invalid project status");
    }

    const [stage] = await db.select().from(kanbanStages).where(
      and(
        eq(kanbanStages.name, update.newStatus),
        eq(kanbanStages.projectTypeId, project.projectTypeId)
      )
    );
    if (!stage) {
      throw new Error(`Kanban stage '${update.newStatus}' not found for this project type`);
    }

    const [reason] = await db.select().from(changeReasons).where(
      and(
        eq(changeReasons.reason, update.changeReason as string),
        eq(changeReasons.projectTypeId, project.projectTypeId)
      )
    );
    if (!reason) {
      throw new Error(`Change reason '${update.changeReason}' not found`);
    }

    if (!this.projectHelpers.validateStageReasonMapping) {
      throw new Error('Helper validateStageReasonMapping not registered');
    }
    const stageReasonValidation = await this.projectHelpers.validateStageReasonMapping(stage.id, reason.id);
    if (!stageReasonValidation.isValid) {
      throw new Error(stageReasonValidation.reason || "Invalid stage-reason mapping");
    }

    if (update.fieldResponses && update.fieldResponses.length > 0) {
      for (const fieldResponse of update.fieldResponses) {
        const [customField] = await db.select().from(reasonCustomFields).where(eq(reasonCustomFields.id, fieldResponse.customFieldId));
        if (!customField) {
          throw new Error(`Custom field with ID '${fieldResponse.customFieldId}' not found`);
        }

        const { fieldType, options } = customField;
        
        const hasNumber = fieldResponse.valueNumber !== undefined && fieldResponse.valueNumber !== null;
        const hasShortText = fieldResponse.valueShortText !== undefined && fieldResponse.valueShortText !== null && fieldResponse.valueShortText !== '';
        const hasLongText = fieldResponse.valueLongText !== undefined && fieldResponse.valueLongText !== null && fieldResponse.valueLongText !== '';
        const hasMultiSelect = fieldResponse.valueMultiSelect !== undefined && fieldResponse.valueMultiSelect !== null && fieldResponse.valueMultiSelect.length > 0;
        
        let validFieldMatch = false;
        if (fieldType === 'number') {
          validFieldMatch = hasNumber && !hasShortText && !hasLongText && !hasMultiSelect;
        } else if (fieldType === 'short_text') {
          validFieldMatch = !hasNumber && hasShortText && !hasLongText && !hasMultiSelect;
        } else if (fieldType === 'long_text') {
          validFieldMatch = !hasNumber && !hasShortText && hasLongText && !hasMultiSelect;
        } else if (fieldType === 'multi_select') {
          validFieldMatch = !hasNumber && !hasShortText && !hasLongText && hasMultiSelect;
          
          if (validFieldMatch && fieldResponse.valueMultiSelect) {
            if (!options || options.length === 0) {
              throw new Error(`Multi-select field '${customField.fieldName}' has no configured options`);
            }
            
            const invalidOptions = fieldResponse.valueMultiSelect.filter(value => !options.includes(value));
            if (invalidOptions.length > 0) {
              throw new Error(`Invalid options for multi-select field '${customField.fieldName}': ${invalidOptions.join(', ')}. Valid options are: ${options.join(', ')}`);
            }
          }
        }
        
        if (!validFieldMatch) {
          throw new Error(`Invalid field data for '${customField.fieldName}': field type '${fieldType}' requires exactly one matching value field`);
        }
      }
    }

    if (!this.projectHelpers.validateRequiredFields) {
      throw new Error('Helper validateRequiredFields not registered');
    }
    const requiredFieldsValidation = await this.projectHelpers.validateRequiredFields(reason.id, update.fieldResponses || []);
    if (!requiredFieldsValidation.isValid) {
      throw new Error(requiredFieldsValidation.reason || "Required fields validation failed");
    }

    let newAssigneeId: string;
    if (stage.assignedUserId) {
      newAssigneeId = stage.assignedUserId;
    } else if (stage.assignedWorkRoleId) {
      if (!this.projectHelpers.getWorkRoleById || !this.projectHelpers.resolveRoleAssigneeForClient) {
        throw new Error('Helper methods not registered');
      }
      const workRole = await this.projectHelpers.getWorkRoleById(stage.assignedWorkRoleId);
      if (workRole) {
        const roleAssignment = await this.projectHelpers.resolveRoleAssigneeForClient(project.clientId, project.projectTypeId, workRole.name);
        newAssigneeId = roleAssignment?.id || project.clientManagerId;
      } else {
        console.warn(`Work role ${stage.assignedWorkRoleId} not found, using client manager`);
        newAssigneeId = project.clientManagerId;
      }
    } else {
      newAssigneeId = project.currentAssigneeId || project.clientManagerId;
    }

    const lastChronology = project.chronology[0];
    let timeInPreviousStage: number;
    let businessHoursInPreviousStage: number;
    
    if (lastChronology && lastChronology.timestamp) {
      timeInPreviousStage = Math.floor((Date.now() - new Date(lastChronology.timestamp).getTime()) / (1000 * 60));
      
      try {
        const businessHours = calculateBusinessHours(
          new Date(lastChronology.timestamp).toISOString(), 
          new Date().toISOString()
        );
        businessHoursInPreviousStage = Math.round(businessHours * 60);
      } catch (error) {
        console.error("Error calculating business hours:", error);
        businessHoursInPreviousStage = 0;
      }
    } else {
      if (project.createdAt) {
        timeInPreviousStage = Math.floor((Date.now() - new Date(project.createdAt).getTime()) / (1000 * 60));
        
        try {
          const businessHours = calculateBusinessHours(
            new Date(project.createdAt).toISOString(), 
            new Date().toISOString()
          );
          businessHoursInPreviousStage = Math.round(businessHours * 60);
        } catch (error) {
          console.error("Error calculating business hours from project creation:", error);
          businessHoursInPreviousStage = 0;
        }
      } else {
        timeInPreviousStage = 0;
        businessHoursInPreviousStage = 0;
      }
    }

    let chronologyEntryId: string | undefined;
    
    const updatedProject = await db.transaction(async (tx) => {
      let notesText = update.notes;
      if (!notesText && update.notesHtml) {
        notesText = update.notesHtml
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();
      }
      
      const [chronologyEntry] = await tx.insert(projectChronology).values({
        projectId: update.projectId,
        fromStatus: project.currentStatus,
        toStatus: update.newStatus,
        assigneeId: newAssigneeId,
        changedById: userId,
        changeReason: update.changeReason,
        notes: notesText,
        notesHtml: update.notesHtml,
        attachments: update.attachments,
        timeInPreviousStage,
        businessHoursInPreviousStage,
      }).returning();

      chronologyEntryId = chronologyEntry.id;

      if (update.fieldResponses && update.fieldResponses.length > 0) {
        for (const fieldResponse of update.fieldResponses) {
          const [customField] = await tx.select().from(reasonCustomFields).where(eq(reasonCustomFields.id, fieldResponse.customFieldId));
          if (!customField) {
            throw new Error(`Custom field with ID '${fieldResponse.customFieldId}' not found`);
          }
          
          await tx.insert(reasonFieldResponses).values({
            chronologyId: chronologyEntry.id,
            customFieldId: fieldResponse.customFieldId,
            fieldType: customField.fieldType,
            valueNumber: fieldResponse.valueNumber,
            valueShortText: fieldResponse.valueShortText,
            valueLongText: fieldResponse.valueLongText,
            valueMultiSelect: fieldResponse.valueMultiSelect,
          });
        }
      }

      const [updatedProject] = await tx
        .update(projects)
        .set({
          currentStatus: update.newStatus,
          currentAssigneeId: newAssigneeId,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, update.projectId))
        .returning();

      return updatedProject;
    });

    if (this.projectHelpers.sendStageChangeNotifications) {
      await this.projectHelpers.sendStageChangeNotifications(update.projectId, update.newStatus, oldStatus);
    }

    if (chronologyEntryId) {
      try {
        if (!this.projectHelpers.createProjectMessageThread || !this.projectHelpers.createProjectMessageParticipant || !this.projectHelpers.createProjectMessage) {
          console.warn('Message thread helpers not registered, skipping thread creation');
        } else {
          const timestamp = new Date().toLocaleString('en-GB', { 
            day: '2-digit', 
            month: 'short', 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          const shortId = chronologyEntryId.substring(0, 8);
          const threadTopic = `${oldStatus} to ${update.newStatus} - ${timestamp} (${shortId})`;
          
          const newThread = await this.projectHelpers.createProjectMessageThread({
            projectId: update.projectId,
            topic: threadTopic,
            createdByUserId: userId,
          });
          
          const addedParticipants = new Set<string>();
          
          if (previousAssigneeId) {
            await this.projectHelpers.createProjectMessageParticipant({
              threadId: newThread.id,
              userId: previousAssigneeId,
            });
            addedParticipants.add(previousAssigneeId);
          }
          
          if (newAssigneeId && !addedParticipants.has(newAssigneeId)) {
            await this.projectHelpers.createProjectMessageParticipant({
              threadId: newThread.id,
              userId: newAssigneeId,
            });
            addedParticipants.add(newAssigneeId);
          }
          
          if (!addedParticipants.has(userId)) {
            await this.projectHelpers.createProjectMessageParticipant({
              threadId: newThread.id,
              userId: userId,
            });
            addedParticipants.add(userId);
          }
          
          const hasCustomContent = (update.notesHtml && update.notesHtml.trim()) || (update.attachments && update.attachments.length > 0);
          
          const messageAttachments = update.attachments?.map(att => ({
            ...att,
            url: `/api/projects/${update.projectId}/stage-change-attachments${att.objectPath}`,
          }));
          
          let messageContent: string;
          if (update.notesHtml && update.notesHtml.trim()) {
            messageContent = update.notesHtml.trim();
          } else if (update.attachments && update.attachments.length > 0) {
            messageContent = `<p>Stage changed from <strong>${oldStatus}</strong> to <strong>${update.newStatus}</strong></p><p>Reason: ${update.changeReason}</p><p><em>Attachments included below.</em></p>`;
          } else {
            messageContent = `<p>Stage changed from <strong>${oldStatus}</strong> to <strong>${update.newStatus}</strong></p><p>Reason: ${update.changeReason}</p>`;
          }
          
          await this.projectHelpers.createProjectMessage({
            threadId: newThread.id,
            content: messageContent,
            userId: userId,
            attachments: hasCustomContent ? messageAttachments : undefined,
          });
          
          const isHandoff = previousAssigneeId && newAssigneeId && previousAssigneeId !== newAssigneeId;
          console.log(`[Storage] Created message thread "${threadTopic}" for project ${update.projectId}${isHandoff ? ` (handoff from ${previousAssigneeId} to ${newAssigneeId})` : ' (same assignee)'}`);
        }
      } catch (error) {
        console.error(`[Storage] Failed to create message thread for project ${update.projectId}:`, error);
      }
    }

    if (stage.canBeFinalStage && oldStatus !== update.newStatus) {
      console.log(`[Storage] Project ${update.projectId} moved to final stage '${update.newStatus}', cancelling all remaining notifications`);
      
      try {
        if (this.projectHelpers.cancelScheduledNotificationsForProject) {
          await this.projectHelpers.cancelScheduledNotificationsForProject(update.projectId, `Project moved to final stage: ${update.newStatus}`);
        }
      } catch (error) {
        console.error(`[Storage] Failed to cancel notifications for project ${update.projectId}:`, error);
      }

      try {
        let totalArchived = 0;
        if (this.projectHelpers.autoArchiveMessageThreadsByProjectId) {
          const clientThreadsArchived = await this.projectHelpers.autoArchiveMessageThreadsByProjectId(update.projectId, userId);
          totalArchived += clientThreadsArchived;
        }
        if (this.projectHelpers.autoArchiveProjectMessageThreadsByProjectId) {
          const projectThreadsArchived = await this.projectHelpers.autoArchiveProjectMessageThreadsByProjectId(update.projectId, userId);
          totalArchived += projectThreadsArchived;
        }
        if (totalArchived > 0) {
          console.log(`[Storage] Auto-archived ${totalArchived} message thread(s) for completed project ${update.projectId}`);
        }
      } catch (error) {
        console.error(`[Storage] Failed to auto-archive message threads for project ${update.projectId}:`, error);
      }
    }

    return updatedProject;
  }
}
