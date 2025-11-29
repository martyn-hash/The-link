import { db } from "../../db";
import { eq, inArray } from "drizzle-orm";
import {
  users,
  projects,
  projectTypes,
  kanbanStages,
  userNotificationPreferences,
  type User,
  type Project,
  type StageChangeNotificationPreview,
  type UserNotificationPreferences,
} from "@shared/schema";
import { sendStageChangeNotificationEmail, sendBulkProjectAssignmentSummaryEmail } from "../../emailService";

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
        const { addBusinessHours } = await import('@shared/businessTime');
        
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

      const recipients = finalUsersToNotify.map(user => ({
        userId: user.id,
        name: `${user.firstName} ${user.lastName || ''}`.trim(),
        email: user.email!,
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
        const { sendProjectStageChangeNotification } = await import('../../notification-template-service');
        
        let formattedDueDate: string | undefined = undefined;
        
        if (chronologyForEmail && chronologyForEmail.length > 0) {
          const { addBusinessHours } = await import('@shared/businessTime');
          
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
