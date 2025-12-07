import { db } from "../../db";
import { eq, inArray, and } from "drizzle-orm";
import {
  users,
  projects,
  projectTypes,
  kanbanStages,
  userNotificationPreferences,
  pushSubscriptions,
  people,
  clientPeople,
  projectTypeNotifications,
  stageApprovals,
  stageApprovalFields,
  stageApprovalResponses,
  type User,
  type Project,
  type StageChangeNotificationPreview,
  type UserNotificationPreferences,
} from "@shared/schema";
import { sendStageChangeNotificationEmail, sendBulkProjectAssignmentSummaryEmail } from "../../emailService";
import { z } from "zod";
import { clientValueNotificationPreviewSchema, clientValueNotificationRecipientSchema } from "@shared/schema/notifications/schemas";
import { processNotificationVariables, type NotificationVariableContext, type StageApprovalData } from "../../notification-variables";
import { addBusinessHours } from "@shared/businessTime";
import { isApplicationGraphConfigured } from "../../utils/applicationGraphClient";
import { sendProjectStageChangeNotification } from "../../notification-template-service";

export type ClientValueNotificationPreview = z.infer<typeof clientValueNotificationPreviewSchema>;
export type ClientValueNotificationRecipient = z.infer<typeof clientValueNotificationRecipientSchema>;

type GetUserFn = (id: string) => Promise<User | undefined>;
type GetProjectFn = (id: string) => Promise<Project | undefined>;
type GetWorkRoleByIdFn = (id: string) => Promise<{ name: string } | undefined>;
type ResolveRoleAssigneeFn = (clientId: string, projectTypeId: string, roleName: string) => Promise<User | undefined>;

export class StageChangeNotificationStorage {
  private getUser: GetUserFn;
  private getProject: GetProjectFn;
  private getWorkRoleById: GetWorkRoleByIdFn;
  private resolveRoleAssigneeForClient: ResolveRoleAssigneeFn;
  private recentNotifications = new Map<string, number>();

  constructor(helpers: {
    getUser: GetUserFn;
    getProject: GetProjectFn;
    getWorkRoleById: GetWorkRoleByIdFn;
    resolveRoleAssigneeForClient: ResolveRoleAssigneeFn;
  }) {
    this.getUser = helpers.getUser;
    this.getProject = helpers.getProject;
    this.getWorkRoleById = helpers.getWorkRoleById;
    this.resolveRoleAssigneeForClient = helpers.resolveRoleAssigneeForClient;
  }

  /**
   * Consolidated method to fetch all data needed for client notification preview in 2 queries.
   * Replaces 5-6 separate queries with optimized batch fetches.
   */
  async getClientNotificationPreviewData(
    projectId: string,
    newStageName: string,
    sendingUserId: string
  ): Promise<{
    project: any;
    projectType: { notificationsActive: boolean } | null;
    client: any;
    clientContacts: Array<{
      personId: string;
      fullName: string;
      email: string | null;
      telephone: string | null;
      officerRole: string | null;
      isPrimaryContact: boolean;
      receiveNotifications: boolean;
    }>;
    stage: any;
    sendingUser: User | null;
    chronologyEntries: any[];
    stageTemplate: any;
  } | null> {
    const projectWithRelations = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      with: {
        client: true,
        projectType: {
          columns: {
            notificationsActive: true,
          },
        },
        chronology: {
          orderBy: (chronology: any, { desc }: { desc: any }) => [desc(chronology.timestamp)],
          with: {
            fieldResponses: {
              with: {
                customField: true,
              },
            },
          },
        },
      },
    });

    if (!projectWithRelations || !projectWithRelations.client) {
      return null;
    }

    const projectTypeId = projectWithRelations.projectTypeId;

    const [clientContactsResult, stageResult, sendingUser, stageTemplateResult] = await Promise.all([
      db
        .select({
          personId: people.id,
          fullName: people.fullName,
          email: people.email,
          primaryEmail: people.primaryEmail,
          telephone: people.telephone,
          primaryPhone: people.primaryPhone,
          receiveNotifications: people.receiveNotifications,
          officerRole: clientPeople.officerRole,
          isPrimaryContact: clientPeople.isPrimaryContact,
        })
        .from(clientPeople)
        .innerJoin(people, eq(clientPeople.personId, people.id))
        .where(eq(clientPeople.clientId, projectWithRelations.clientId)),
      
      db
        .select()
        .from(kanbanStages)
        .where(
          and(
            eq(kanbanStages.name, newStageName),
            eq(kanbanStages.projectTypeId, projectTypeId)
          )
        )
        .limit(1),
      
      this.getUser(sendingUserId),
      
      db
        .select()
        .from(projectTypeNotifications)
        .innerJoin(kanbanStages, and(
          eq(projectTypeNotifications.stageId, kanbanStages.id),
          eq(kanbanStages.name, newStageName),
          eq(kanbanStages.projectTypeId, projectTypeId)
        ))
        .where(
          and(
            eq(projectTypeNotifications.projectTypeId, projectTypeId),
            eq(projectTypeNotifications.stageTrigger, 'entry'),
            eq(projectTypeNotifications.isActive, true)
          )
        )
        .limit(1),
    ]);

    const clientContacts = clientContactsResult.map(contact => ({
      personId: contact.personId,
      fullName: contact.fullName,
      email: contact.email || contact.primaryEmail || null,
      telephone: contact.telephone || contact.primaryPhone || null,
      officerRole: contact.officerRole || null,
      isPrimaryContact: contact.isPrimaryContact || false,
      receiveNotifications: contact.receiveNotifications !== false,
    }));

    return {
      project: projectWithRelations,
      projectType: projectWithRelations.projectType || null,
      client: projectWithRelations.client,
      clientContacts,
      stage: stageResult[0] || null,
      sendingUser: sendingUser || null,
      chronologyEntries: projectWithRelations.chronology || [],
      stageTemplate: stageTemplateResult[0]?.project_type_notifications || null,
    };
  }

  async prepareStageChangeNotification(
    projectId: string, 
    newStageName: string, 
    oldStageName?: string
  ): Promise<StageChangeNotificationPreview | null> {
    try {
      if (oldStageName && oldStageName === newStageName) {
        return null;
      }

      const project = await this.getProject(projectId);
      if (!project) {
        console.warn(`Project ${projectId} not found for stage change notification preview`);
        return null;
      }

      const [projectType] = await db
        .select({ notificationsActive: projectTypes.notificationsActive })
        .from(projectTypes)
        .where(eq(projectTypes.id, project.projectTypeId));

      if (projectType && projectType.notificationsActive === false) {
        console.log(`Notifications disabled for project type ${project.projectTypeId}, skipping notification preview`);
        return null;
      }

      const [newStage] = await db
        .select()
        .from(kanbanStages)
        .where(eq(kanbanStages.name, newStageName));

      if (!newStage) {
        console.warn(`Kanban stage '${newStageName}' not found for notification preview`);
        return null;
      }

      let usersToNotify: User[] = [];
      
      if (newStage.assignedUserId) {
        const assignedUser = await this.getUser(newStage.assignedUserId);
        if (assignedUser) {
          usersToNotify = [assignedUser];
        }
      } else if (newStage.assignedWorkRoleId) {
        const workRole = await this.getWorkRoleById(newStage.assignedWorkRoleId);
        if (workRole) {
          const roleAssignment = await this.resolveRoleAssigneeForClient(
            project.clientId, 
            project.projectTypeId, 
            workRole.name
          );
          if (roleAssignment) {
            usersToNotify = [roleAssignment];
          }
        }
      }

      if (usersToNotify.length === 0) {
        console.log(`No users to notify for stage '${newStageName}', skipping notification preview`);
        return null;
      }

      const projectWithClient = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        with: {
          client: true,
          chronology: {
            orderBy: (chronology: any, { desc }: { desc: any }) => [desc(chronology.timestamp)],
            with: {
              fieldResponses: {
                with: {
                  customField: true,
                },
              },
            },
          },
        },
      });

      if (!projectWithClient) {
        console.warn(`Project with client data not found for ${projectId}`);
        return null;
      }
      
      const chronologyEntries = (projectWithClient.chronology || []) as any[];
      const mostRecentChronologyEntry = chronologyEntries.length > 0 
        ? chronologyEntries[0] 
        : null;
      
      const changeReason = mostRecentChronologyEntry?.changeReason || undefined;
      const notes = mostRecentChronologyEntry?.notes || undefined;

      const userIds = usersToNotify.map(user => user.id);
      const allPreferences = await db
        .select()
        .from(userNotificationPreferences)
        .where(inArray(userNotificationPreferences.userId, userIds));
      
      const preferencesMap = new Map<string, UserNotificationPreferences>();
      allPreferences.forEach(pref => {
        preferencesMap.set(pref.userId, pref);
      });

      const finalUsersToNotify = usersToNotify.filter(user => {
        const preferences = preferencesMap.get(user.id);
        const notifyStageChanges = preferences?.notifyStageChanges ?? true;
        
        if (!notifyStageChanges) {
          console.log(`User ${user.email} has stage change notifications disabled, skipping`);
          return false;
        }

        if (!user.email || !user.firstName) {
          console.warn(`User ${user.id} missing email or name, skipping notification`);
          return false;
        }

        return true;
      });

      if (finalUsersToNotify.length === 0) {
        console.log(`No eligible users to notify for project ${projectId} stage change to ${newStageName}`);
        return null;
      }

      const chronologyForEmail = chronologyEntries.map((entry: any) => ({
        toStatus: entry.toStatus,
        timestamp: entry.timestamp instanceof Date ? entry.timestamp.toISOString() : entry.timestamp,
      }));

      const stageConfigForEmail = {
        maxInstanceTime: newStage.maxInstanceTime,
      };

      let formattedDueDate: string | undefined = undefined;
      
      if (chronologyForEmail && chronologyForEmail.length > 0 && stageConfigForEmail.maxInstanceTime) {
        const sortedChronology = [...chronologyForEmail].sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const stageEntry = sortedChronology.find(entry => entry.toStatus === newStageName);
        
        let assignedTimestamp: string | null = null;
        if (stageEntry) {
          assignedTimestamp = stageEntry.timestamp;
        } else if (projectWithClient.createdAt) {
          assignedTimestamp = projectWithClient.createdAt instanceof Date 
            ? projectWithClient.createdAt.toISOString() 
            : projectWithClient.createdAt;
        }
        
        if (assignedTimestamp && stageConfigForEmail.maxInstanceTime > 0) {
          const deadlineDate = addBusinessHours(assignedTimestamp, stageConfigForEmail.maxInstanceTime);
          formattedDueDate = deadlineDate.toLocaleString('en-GB', { 
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          });
        }
      }

      const recipientIds = finalUsersToNotify.map(u => u.id).sort().join(',');
      const dedupeKey = `${projectId}:${newStageName}:${changeReason || 'none'}:${recipientIds}`;

      const clientData = projectWithClient.client as any;
      const emailSubject = `Project Stage Update: ${projectWithClient.description} - ${newStageName}`;
      
      const emailBody = `
        <p>Hello,</p>
        <p>The project "${projectWithClient.description}" for ${clientData.name} has been moved to stage: <strong>${newStageName}</strong></p>
        ${oldStageName ? `<p>Previous stage: ${oldStageName}</p>` : ''}
        ${changeReason ? `<p>Change reason: ${changeReason}</p>` : ''}
        ${notes ? `<p>Notes: ${notes}</p>` : ''}
        ${formattedDueDate ? `<p>Due date: ${formattedDueDate}</p>` : ''}
        <p>Please log into The Link system to review the project and take the necessary action.</p>
        <p>Best regards,<br/>The Link Team</p>
      `.trim();

      const pushTitle = `${newStageName}: ${projectWithClient.description}`;
      const pushBody = `${clientData.name}${formattedDueDate ? ` | Due: ${formattedDueDate}` : ''}`;

      // Check which users have push subscriptions
      const pushSubscriptionUserIds = await db
        .select({ userId: pushSubscriptions.userId })
        .from(pushSubscriptions)
        .where(inArray(pushSubscriptions.userId, userIds));
      const usersWithPush = new Set(pushSubscriptionUserIds.map(p => p.userId));

      const recipients = finalUsersToNotify.map(user => ({
        userId: user.id,
        name: `${user.firstName} ${user.lastName || ''}`.trim(),
        email: user.email!,
        mobile: null, // Staff users don't have mobile numbers in schema yet; SMS is for future client portal use
        hasPushSubscription: usersWithPush.has(user.id),
      }));

      return {
        projectId,
        newStageName,
        oldStageName,
        dedupeKey,
        recipients,
        emailSubject,
        emailBody,
        pushTitle,
        pushBody,
        metadata: {
          projectName: projectWithClient.description,
          clientName: clientData.name,
          dueDate: formattedDueDate,
          changeReason,
          notes,
        },
      };
    } catch (error) {
      console.error(`Error preparing stage change notification for project ${projectId}:`, error);
      return null;
    }
  }

  /**
   * Prepare a client value notification (client-facing notification sent via staff's Outlook)
   * This fetches client contacts (people linked to the project's client) instead of internal staff
   */
  async prepareClientValueNotification(
    projectId: string,
    newStageName: string,
    sendingUserId: string,
    oldStageName?: string
  ): Promise<ClientValueNotificationPreview | null> {
    try {
      if (oldStageName && oldStageName === newStageName) {
        return null;
      }

      const project = await this.getProject(projectId);
      if (!project) {
        console.warn(`Project ${projectId} not found for client value notification preview`);
        return null;
      }

      // Check if notifications are enabled for this project type
      const [projectType] = await db
        .select({ notificationsActive: projectTypes.notificationsActive })
        .from(projectTypes)
        .where(eq(projectTypes.id, project.projectTypeId));

      if (projectType && projectType.notificationsActive === false) {
        console.log(`Notifications disabled for project type ${project.projectTypeId}, skipping notification preview`);
        return null;
      }

      // Get project with client data and chronology for context
      const projectWithClient = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        with: {
          client: true,
          chronology: {
            orderBy: (chronology: any, { desc }: { desc: any }) => [desc(chronology.timestamp)],
            with: {
              fieldResponses: {
                with: {
                  customField: true,
                },
              },
            },
          },
        },
      });

      if (!projectWithClient || !projectWithClient.client) {
        console.warn(`Project with client data not found for ${projectId}`);
        return null;
      }

      const clientData = projectWithClient.client as any;
      const clientId = project.clientId;

      // Fetch all people linked to this client via clientPeople
      const clientContactsData = await db
        .select({
          personId: people.id,
          fullName: people.fullName,
          email: people.email,
          primaryEmail: people.primaryEmail,
          telephone: people.telephone,
          primaryPhone: people.primaryPhone,
          receiveNotifications: people.receiveNotifications,
          officerRole: clientPeople.officerRole,
          isPrimaryContact: clientPeople.isPrimaryContact,
        })
        .from(clientPeople)
        .innerJoin(people, eq(clientPeople.personId, people.id))
        .where(eq(clientPeople.clientId, clientId));

      if (clientContactsData.length === 0) {
        console.log(`[ClientValueNotification] No client contacts found for client ${clientId}, skipping notification preview`);
        return null;
      }
      
      console.log(`[ClientValueNotification] Found ${clientContactsData.length} contacts for client ${clientId}`);

      // Map to client value notification recipients
      const recipients: ClientValueNotificationRecipient[] = clientContactsData.map(contact => ({
        personId: contact.personId,
        fullName: contact.fullName,
        email: contact.email || contact.primaryEmail || null,
        mobile: contact.telephone || contact.primaryPhone || null,
        role: contact.officerRole || null,
        isPrimaryContact: contact.isPrimaryContact || false,
        receiveNotifications: contact.receiveNotifications !== false, // Default to true
      }));

      // Get the sending user to check if they have email access enabled
      const sendingUser = await this.getUser(sendingUserId);
      if (!sendingUser) {
        console.warn(`Sending user ${sendingUserId} not found`);
        return null;
      }

      // Check if the user has email access enabled by admin (tenant-wide Microsoft 365 access)
      // Also check if Microsoft Graph is configured at the application level
      const senderHasOutlook = !!sendingUser.accessEmail && isApplicationGraphConfigured();
      const senderEmail = sendingUser.email || null;

      // Get chronology for context
      const chronologyEntries = (projectWithClient.chronology || []) as any[];
      const mostRecentChronologyEntry = chronologyEntries.length > 0 
        ? chronologyEntries[0] 
        : null;
      
      const changeReason = mostRecentChronologyEntry?.changeReason || undefined;
      const notes = mostRecentChronologyEntry?.notes || undefined;

      // Calculate due date if available - lookup stage by name AND projectTypeId to avoid cross-type conflicts
      const [newStage] = await db
        .select()
        .from(kanbanStages)
        .where(
          and(
            eq(kanbanStages.name, newStageName),
            eq(kanbanStages.projectTypeId, project.projectTypeId)
          )
        );

      let formattedDueDate: string | undefined = undefined;
      if (newStage?.maxInstanceTime) {
        const chronologyForEmail = chronologyEntries.map((entry: any) => ({
          toStatus: entry.toStatus,
          timestamp: entry.timestamp instanceof Date ? entry.timestamp.toISOString() : entry.timestamp,
        }));
        
        const sortedChronology = [...chronologyForEmail].sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const stageEntry = sortedChronology.find(entry => entry.toStatus === newStageName);
        
        let assignedTimestamp: string | null = null;
        if (stageEntry) {
          assignedTimestamp = stageEntry.timestamp;
        } else if (projectWithClient.createdAt) {
          assignedTimestamp = projectWithClient.createdAt instanceof Date 
            ? projectWithClient.createdAt.toISOString() 
            : projectWithClient.createdAt;
        }
        
        if (assignedTimestamp && newStage.maxInstanceTime > 0) {
          const deadlineDate = addBusinessHours(assignedTimestamp, newStage.maxInstanceTime);
          formattedDueDate = deadlineDate.toLocaleString('en-GB', { 
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
          });
        }
      }

      // Create dedupe key based on recipient person IDs
      const recipientIds = recipients.map(r => r.personId).sort().join(',');
      const dedupeKey = `client:${projectId}:${newStageName}:${changeReason || 'none'}:${recipientIds}`;

      // Look up stage notification template from project_type_notifications
      let emailSubject = `Update: ${projectWithClient.description} - ${newStageName}`;
      let emailBody = `
        <p>Dear Client,</p>
        <p>We wanted to let you know that work on "${projectWithClient.description}" has progressed to: <strong>${newStageName}</strong></p>
        ${oldStageName ? `<p>Previous stage: ${oldStageName}</p>` : ''}
        ${notes ? `<p>Notes: ${notes}</p>` : ''}
        <p>If you have any questions, please don't hesitate to get in touch.</p>
        <p>Kind regards,<br/>${sendingUser.firstName || 'The Team'}</p>
      `.trim();

      // Try to find a matching notification template for this stage
      if (newStage?.id) {
        const [stageTemplate] = await db
          .select()
          .from(projectTypeNotifications)
          .where(
            and(
              eq(projectTypeNotifications.projectTypeId, project.projectTypeId),
              eq(projectTypeNotifications.stageId, newStage.id),
              eq(projectTypeNotifications.stageTrigger, 'entry'),
              eq(projectTypeNotifications.isActive, true)
            )
          )
          .limit(1);

        if (stageTemplate?.emailTitle || stageTemplate?.emailBody) {
          console.log(`[ClientValueNotification] Using template from project_type_notifications for stage ${newStageName}`);
          if (stageTemplate.emailTitle) {
            emailSubject = stageTemplate.emailTitle;
          }
          if (stageTemplate.emailBody) {
            emailBody = stageTemplate.emailBody;
          }
        }
      }

      // Fetch stage approval responses for this project and build the approval map
      // This allows templates to use {stage_approval:ApprovalName} variables
      const stageApprovalsMap = new Map<string, StageApprovalData>();
      
      try {
        // Get all approval responses for this project with their field and approval info
        const approvalResponses = await db
          .select({
            approvalId: stageApprovals.id,
            approvalName: stageApprovals.name,
            fieldId: stageApprovalFields.id,
            fieldName: stageApprovalFields.fieldName,
            fieldType: stageApprovalFields.fieldType,
            valueBoolean: stageApprovalResponses.valueBoolean,
            valueNumber: stageApprovalResponses.valueNumber,
            valueLongText: stageApprovalResponses.valueLongText,
            valueMultiSelect: stageApprovalResponses.valueMultiSelect,
          })
          .from(stageApprovalResponses)
          .innerJoin(stageApprovalFields, eq(stageApprovalResponses.fieldId, stageApprovalFields.id))
          .innerJoin(stageApprovals, eq(stageApprovalFields.stageApprovalId, stageApprovals.id))
          .where(eq(stageApprovalResponses.projectId, projectId));

        // Group responses by approval name
        for (const resp of approvalResponses) {
          if (!stageApprovalsMap.has(resp.approvalName)) {
            stageApprovalsMap.set(resp.approvalName, {
              approvalName: resp.approvalName,
              responses: [],
            });
          }
          
          // Determine the value based on field type
          let value: boolean | number | string | string[] | null = null;
          if (resp.fieldType === 'boolean') {
            value = resp.valueBoolean;
          } else if (resp.fieldType === 'number') {
            value = resp.valueNumber;
          } else if (resp.fieldType === 'long_text') {
            value = resp.valueLongText;
          } else if (resp.fieldType === 'multi_select') {
            value = resp.valueMultiSelect;
          }
          
          stageApprovalsMap.get(resp.approvalName)!.responses.push({
            fieldName: resp.fieldName,
            fieldType: resp.fieldType as 'boolean' | 'number' | 'long_text' | 'multi_select',
            value,
          });
        }
        
        console.log(`[ClientValueNotification] Found ${stageApprovalsMap.size} stage approvals for project ${projectId}`);
      } catch (approvalError) {
        console.warn(`[ClientValueNotification] Failed to fetch stage approvals:`, approvalError);
        // Continue without approval data
      }

      // Process notification variables including stage approvals
      const variableContext: NotificationVariableContext = {
        client: {
          id: clientId,
          name: clientData.name,
          email: clientData.email || null,
          clientType: clientData.clientType || null,
          financialYearEnd: clientData.financialYearEnd || null,
        },
        project: {
          id: projectId,
          description: projectWithClient.description,
          projectTypeName: '', // Could be fetched if needed
          currentStatus: newStageName,
          startDate: null, // Not available in this context
          dueDate: projectWithClient.dueDate || null,
        },
        assignedStaff: sendingUser,
        sendingStaff: sendingUser, // The user sending this notification (for {staff_calendly_link})
        stageApprovals: stageApprovalsMap.size > 0 ? stageApprovalsMap : undefined,
      };

      // Process variables in subject and body
      const processedEmailSubject = processNotificationVariables(emailSubject, variableContext);
      const processedEmailBody = processNotificationVariables(emailBody, variableContext);

      return {
        projectId,
        newStageName,
        oldStageName,
        dedupeKey,
        recipients,
        emailSubject: processedEmailSubject,
        emailBody: processedEmailBody,
        senderHasOutlook,
        senderEmail,
        metadata: {
          projectName: projectWithClient.description,
          clientName: clientData.name,
          dueDate: formattedDueDate,
          changeReason,
          notes,
        },
      };
    } catch (error) {
      console.error(`Error preparing client value notification for project ${projectId}:`, error);
      return null;
    }
  }

  async sendStageChangeNotifications(projectId: string, newStageName: string, oldStageName?: string): Promise<void> {
    try {
      if (oldStageName && oldStageName === newStageName) {
        return;
      }

      const deduplicationKey = `${projectId}:${newStageName}`;
      const now = Date.now();
      const lastNotification = this.recentNotifications.get(deduplicationKey);
      
      if (lastNotification && (now - lastNotification) < 30000) {
        console.log(`Skipping duplicate notification for project ${projectId} to stage ${newStageName}`);
        return;
      }
      
      this.recentNotifications.set(deduplicationKey, now);
      
      if (this.recentNotifications.size > 1000) {
        const entries = Array.from(this.recentNotifications.entries());
        entries.sort((a, b) => b[1] - a[1]);
        this.recentNotifications.clear();
        entries.slice(0, 500).forEach(([key, timestamp]) => {
          this.recentNotifications.set(key, timestamp);
        });
      }

      const project = await this.getProject(projectId);
      if (!project) {
        console.warn(`Project ${projectId} not found for stage change notifications`);
        return;
      }

      const [projectType] = await db
        .select({ notificationsActive: projectTypes.notificationsActive })
        .from(projectTypes)
        .where(eq(projectTypes.id, project.projectTypeId));

      if (projectType && projectType.notificationsActive === false) {
        console.log(`Notifications disabled for project type ${project.projectTypeId}, skipping notifications`);
        return;
      }

      const [newStage] = await db
        .select()
        .from(kanbanStages)
        .where(eq(kanbanStages.name, newStageName));

      if (!newStage) {
        console.warn(`Kanban stage '${newStageName}' not found for notifications`);
        return;
      }

      let usersToNotify: User[] = [];
      
      if (newStage.assignedUserId) {
        const assignedUser = await this.getUser(newStage.assignedUserId);
        if (assignedUser) {
          usersToNotify = [assignedUser];
        }
      } else if (newStage.assignedWorkRoleId) {
        const workRole = await this.getWorkRoleById(newStage.assignedWorkRoleId);
        if (workRole) {
          const roleAssignment = await this.resolveRoleAssigneeForClient(project.clientId, project.projectTypeId, workRole.name);
          if (roleAssignment) {
            usersToNotify = [roleAssignment];
          }
        }
      }

      if (usersToNotify.length === 0) {
        console.log(`No users to notify for stage '${newStageName}', skipping notifications`);
        return;
      }

      const projectWithClient = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        with: {
          client: true,
          chronology: {
            orderBy: (chronology: any, { desc }: { desc: any }) => [desc(chronology.timestamp)],
            with: {
              fieldResponses: {
                with: {
                  customField: true,
                },
              },
            },
          },
        },
      });

      if (!projectWithClient) {
        console.warn(`Project with client data not found for ${projectId}`);
        return;
      }
      
      const clientData2 = projectWithClient.client as any;
      const chronologyEntries2 = (projectWithClient.chronology || []) as any[];
      
      const mostRecentChronologyEntry = chronologyEntries2.length > 0 
        ? chronologyEntries2[0] 
        : null;
      
      const changeReason = mostRecentChronologyEntry?.changeReason || undefined;
      const notes = mostRecentChronologyEntry?.notesHtml || mostRecentChronologyEntry?.notes || undefined;
      const fieldResponses = mostRecentChronologyEntry?.fieldResponses?.map((fr: any) => ({
        fieldName: fr.customField.fieldName,
        fieldType: fr.fieldType,
        value: fr.fieldType === 'number' 
          ? fr.valueNumber!
          : fr.fieldType === 'multi_select' 
            ? (fr.valueMultiSelect || [])
            : (fr.valueLongText || '')
      })) || undefined;

      const userIds = usersToNotify.map(user => user.id);
      const allPreferences = await db
        .select()
        .from(userNotificationPreferences)
        .where(inArray(userNotificationPreferences.userId, userIds));
      
      const preferencesMap = new Map<string, UserNotificationPreferences>();
      allPreferences.forEach(pref => {
        preferencesMap.set(pref.userId, pref);
      });

      const finalUsersToNotify = usersToNotify.filter(user => {
        const preferences = preferencesMap.get(user.id);
        const notifyStageChanges = preferences?.notifyStageChanges ?? true;
        
        if (!notifyStageChanges) {
          console.log(`User ${user.email} has stage change notifications disabled, skipping`);
          return false;
        }

        if (!user.email || !user.firstName) {
          console.warn(`User ${user.id} missing email or name, skipping notification`);
          return false;
        }

        return true;
      });

      if (usersToNotify.length === 0) {
        console.log(`No users to notify for project ${projectId} stage change to ${newStageName}`);
        return;
      }

      const chronologyForEmail = chronologyEntries2.map((entry: any) => ({
        toStatus: entry.toStatus,
        timestamp: entry.timestamp instanceof Date ? entry.timestamp.toISOString() : entry.timestamp,
      }));

      const stageConfigForEmail = {
        maxInstanceTime: newStage.maxInstanceTime,
      };

      const emailPromises = usersToNotify.map(async (user) => {
        try {
          const emailSent = await sendStageChangeNotificationEmail(
            user.email!,
            `${user.firstName} ${user.lastName || ''}`.trim(),
            projectWithClient.description,
            clientData2.name,
            newStageName,
            oldStageName,
            projectId,
            stageConfigForEmail,
            chronologyForEmail,
            projectWithClient.createdAt instanceof Date ? projectWithClient.createdAt.toISOString() : (projectWithClient.createdAt as unknown as string),
            changeReason,
            notes,
            fieldResponses
          );

          if (emailSent) {
            console.log(`Stage change notification sent to ${user.email} for project ${projectId}`);
            return { success: true, email: user.email };
          } else {
            console.warn(`Failed to send stage change notification to ${user.email} for project ${projectId}`);
            return { success: false, email: user.email, error: 'Email sending failed' };
          }
        } catch (error) {
          console.error(`Error sending stage change notification to user ${user.id}:`, error);
          return { success: false, email: user.email, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      const results = await Promise.allSettled(emailPromises);
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;
      console.log(`Stage change notifications for project ${projectId}: ${successful} successful, ${failed} failed`);

      try {
        let formattedDueDate: string | undefined = undefined;
        
        if (chronologyForEmail && chronologyForEmail.length > 0) {
          const sortedChronology = [...chronologyForEmail].sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          const stageEntry = sortedChronology.find(entry => entry.toStatus === newStageName);
          
          let assignedTimestamp: string | null = null;
          if (stageEntry) {
            assignedTimestamp = stageEntry.timestamp;
          } else if (projectWithClient.createdAt) {
            assignedTimestamp = projectWithClient.createdAt instanceof Date 
              ? projectWithClient.createdAt.toISOString() 
              : projectWithClient.createdAt;
          }
          
          if (assignedTimestamp && stageConfigForEmail.maxInstanceTime && stageConfigForEmail.maxInstanceTime > 0) {
            const deadlineDate = addBusinessHours(assignedTimestamp, stageConfigForEmail.maxInstanceTime);
            formattedDueDate = deadlineDate.toLocaleString('en-GB', { 
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZoneName: 'short'
            });
          }
        }
        
        for (const user of finalUsersToNotify) {
          try {
            await sendProjectStageChangeNotification(
              projectId,
              projectWithClient.description,
              clientData2.name,
              oldStageName || 'Unknown',
              newStageName,
              user.id,
              `${user.firstName} ${user.lastName || ''}`.trim(),
              formattedDueDate
            );
          } catch (pushError) {
            console.error(`Failed to send push notification to user ${user.id}:`, pushError);
          }
        }
      } catch (error) {
        console.error(`Error sending push notifications for project ${projectId}:`, error);
      }
      
    } catch (error) {
      console.error(`Error in sendStageChangeNotifications for project ${projectId}:`, error);
    }
  }

  async sendBulkProjectAssignmentNotifications(createdProjects: Project[]): Promise<void> {
    if (!createdProjects || createdProjects.length === 0) {
      return;
    }

    const batchKey = createdProjects.map(p => p.id).sort().join(',');
    const now = Date.now();
    const CACHE_DURATION = 5 * 60 * 1000;
    
    if (this.recentNotifications.has(batchKey)) {
      const lastSent = this.recentNotifications.get(batchKey)!;
      if (now - lastSent < CACHE_DURATION) {
        console.log('Bulk notifications already sent recently for this batch, skipping to prevent duplicates');
        return;
      }
    }
    
    const assigneeProjectCounts = new Map<string, number>();
    
    for (const project of createdProjects) {
      const assigneeIds = [
        project.bookkeeperId,
        project.clientManagerId,
        project.currentAssigneeId
      ].filter((id): id is string => Boolean(id));
      
      for (const assigneeId of assigneeIds) {
        const currentCount = assigneeProjectCounts.get(assigneeId) || 0;
        assigneeProjectCounts.set(assigneeId, currentCount + 1);
      }
    }

    if (assigneeProjectCounts.size === 0) {
      console.log('No valid assignees found for bulk project notifications');
      return;
    }

    const allAssigneeIds = Array.from(assigneeProjectCounts.keys());
    console.log(`Queuing bulk project notifications for ${allAssigneeIds.length} assignees (${createdProjects.length} projects total)`);
    
    const assignees = await db.select().from(users).where(inArray(users.id, allAssigneeIds));
    const assigneeMap = new Map(assignees.map(user => [user.id, user]));
    
    const existingPreferences = await db
      .select()
      .from(userNotificationPreferences)
      .where(inArray(userNotificationPreferences.userId, allAssigneeIds));
    const preferencesMap = new Map(existingPreferences.map(pref => [pref.userId, pref]));

    const usersNeedingDefaults = allAssigneeIds.filter(id => !preferencesMap.has(id));
    if (usersNeedingDefaults.length > 0) {
      const defaultPreferences = usersNeedingDefaults.map(userId => ({
        userId,
        notifyStageChanges: true,
        notifyNewProjects: true,
      }));
      
      const createdDefaults = await db
        .insert(userNotificationPreferences)
        .values(defaultPreferences)
        .returning();
      
      createdDefaults.forEach(pref => preferencesMap.set(pref.userId, pref));
    }

    const emailPromises: { promise: Promise<boolean>; userEmail: string; projectCount: number }[] = [];
    let skippedCount = 0;
    
    for (const [assigneeId, projectCount] of Array.from(assigneeProjectCounts.entries())) {
      try {
        const assignee = assigneeMap.get(assigneeId);
        if (!assignee) {
          console.warn(`Assignee with ID ${assigneeId} not found for bulk notification`);
          continue;
        }

        if (!assignee.email || assignee.email.trim() === '') {
          console.warn(`Assignee ${assignee.firstName} ${assignee.lastName} (ID: ${assigneeId}) has no email address, skipping notification`);
          continue;
        }

        const preferences = preferencesMap.get(assigneeId);
        if (!preferences?.notifyNewProjects) {
          console.log(`User ${assignee.email} has disabled new project notifications, skipping bulk notification`);
          skippedCount++;
          continue;
        }

        const emailPromise = sendBulkProjectAssignmentSummaryEmail(
          assignee.email,
          `${assignee.firstName} ${assignee.lastName}`.trim() || assignee.email,
          projectCount
        );

        emailPromises.push({
          promise: emailPromise,
          userEmail: assignee.email,
          projectCount
        });
        
        console.log(`Queued bulk project assignment notification for ${assignee.email}: ${projectCount} projects`);
      } catch (error) {
        console.error(`Failed to queue bulk notification for assignee ${assigneeId}:`, error);
      }
    }

    if (emailPromises.length > 0) {
      console.log(`Processing ${emailPromises.length} bulk notification emails...`);
      
      const results = await Promise.allSettled(emailPromises.map(ep => ep.promise));
      
      let successCount = 0;
      let failureCount = 0;
      
      results.forEach((result, index) => {
        const emailInfo = emailPromises[index];
        if (result.status === 'fulfilled') {
          successCount++;
          console.log(`✓ Successfully delivered bulk notification to ${emailInfo.userEmail} (${emailInfo.projectCount} projects)`);
        } else {
          failureCount++;
          console.error(`✗ Failed to deliver bulk notification to ${emailInfo.userEmail}:`, result.reason);
        }
      });
      
      console.log(`Bulk project notifications completed: ${successCount} delivered, ${failureCount} failed, ${skippedCount} skipped (preferences disabled)`);
      
      this.recentNotifications.set(batchKey, now);
      
      if (this.recentNotifications.size > 100) {
        const entries = Array.from(this.recentNotifications.entries());
        entries.sort((a, b) => b[1] - a[1]);
        this.recentNotifications.clear();
        entries.slice(0, 50).forEach(([key, timestamp]) => {
          this.recentNotifications.set(key, timestamp);
        });
      }
    } else {
      console.log('No bulk project notifications to send after filtering');
    }
  }
}
