import { db } from '../../db.js';
import {
  projects,
  projectChronology,
  projectTypes,
  clients,
  kanbanStages,
  users,
  userNotificationPreferences,
} from '@shared/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import type { Project } from '@shared/schema';
import { normalizeProjectMonth } from '@shared/schema';
import { sendBulkProjectAssignmentSummaryEmail } from '../../emailService.js';
import type { ProjectStorageHelpers } from './types.js';

/**
 * Storage class for bulk project operations.
 * 
 * Handles:
 * - CSV project import with role-based assignment resolution
 * - Bulk notification sending for project assignments
 * - CSV validation
 */
export class ProjectBulkStorage {
  constructor(
    private projectHelpers: ProjectStorageHelpers,
    private recentNotifications: Map<string, number>
  ) {}

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

  async createProjectsFromCSV(projectsData: any[]): Promise<{
    success: boolean;
    createdProjects: Project[];
    archivedProjects: Project[];
    errors: string[];
    summary: {
      totalRows: number;
      newProjectsCreated: number;
      existingProjectsArchived: number;
      alreadyExistsCount: number;
      clientsProcessed: string[];
    };
  }> {
    const result = {
      success: false,
      createdProjects: [] as Project[],
      archivedProjects: [] as Project[],
      errors: [] as string[],
      summary: {
        totalRows: projectsData.length,
        newProjectsCreated: 0,
        existingProjectsArchived: 0,
        alreadyExistsCount: 0,
        clientsProcessed: [] as string[],
      },
    };

    try {
      const validationResult = await this.validateCSVData(projectsData);
      if (!validationResult.isValid) {
        result.errors = validationResult.errors;
        return result;
      }

      const transactionResult = await db.transaction(async (tx) => {
        const createdProjects: Project[] = [];
        const archivedProjects: Project[] = [];
        const processedClients = new Set<string>();
        let alreadyExistsCount = 0;

        if (!this.projectHelpers.getDefaultStage) {
          throw new Error('Helper getDefaultStage not registered');
        }
        const defaultStage = await this.projectHelpers.getDefaultStage();
        if (!defaultStage) {
          throw new Error("No kanban stages found. Please create at least one stage before importing projects.");
        }

        for (const data of projectsData) {
          try {
            if (!this.projectHelpers.getProjectTypeByName) {
              throw new Error('Helper getProjectTypeByName not registered');
            }
            const projectType = await this.projectHelpers.getProjectTypeByName(data.projectDescription);
            if (!projectType) {
              throw new Error(`Project type '${data.projectDescription}' not found. Please configure this project type in the admin area before importing.`);
            }

            if (!this.projectHelpers.getClientByName) {
              throw new Error('Helper getClientByName not registered');
            }
            let client = await this.projectHelpers.getClientByName(data.clientName);
            if (!client) {
              const [newClient] = await tx.insert(clients).values({
                name: data.clientName,
                email: data.clientEmail,
              }).returning();
              client = newClient;
            }

            let finalBookkeeperId: string;
            let finalClientManagerId: string;
            let finalCurrentAssigneeId: string;
            let usedRoleBasedAssignment = false;

            if (!this.projectHelpers.getServiceByProjectTypeId) {
              throw new Error('Helper getServiceByProjectTypeId not registered');
            }
            const service = await this.projectHelpers.getServiceByProjectTypeId(projectType.id);
            
            if (service) {
              try {
                if (!this.projectHelpers.getClientServiceByClientAndProjectType || !this.projectHelpers.resolveProjectAssignments) {
                  throw new Error('Helper methods not registered');
                }
                
                const clientService = await this.projectHelpers.getClientServiceByClientAndProjectType(client.id, projectType.id);
                
                if (clientService) {
                  const roleAssignments = await this.projectHelpers.resolveProjectAssignments(client.id, projectType.id);
                  
                  finalBookkeeperId = roleAssignments.bookkeeperId;
                  finalClientManagerId = roleAssignments.clientManagerId;
                  finalCurrentAssigneeId = roleAssignments.currentAssigneeId;
                  usedRoleBasedAssignment = true;
                  
                  if (roleAssignments.usedFallback) {
                    console.warn(
                      `CSV import used fallback user for roles: ${roleAssignments.fallbackRoles.join(', ')} for client ${data.clientName}`
                    );
                  }
                } else {
                  console.warn(
                    `Project type '${data.projectDescription}' is service-mapped but client '${data.clientName}' has no service assignment. Using CSV email assignments.`
                  );
                  
                  if (!this.projectHelpers.getUserByEmail) {
                    throw new Error('Helper getUserByEmail not registered');
                  }
                  const bookkeeper = await this.projectHelpers.getUserByEmail(data.bookkeeperEmail);
                  const clientManager = await this.projectHelpers.getUserByEmail(data.clientManagerEmail);
                  
                  if (!bookkeeper || !clientManager) {
                    throw new Error(`Bookkeeper (${data.bookkeeperEmail}) or client manager (${data.clientManagerEmail}) not found`);
                  }
                  
                  finalBookkeeperId = bookkeeper.id;
                  finalClientManagerId = clientManager.id;
                  finalCurrentAssigneeId = clientManager.id;
                }
              } catch (error) {
                if (error instanceof Error && error.message.includes('cannot use role-based assignments')) {
                  console.warn(
                    `Role-based assignment failed for project type '${data.projectDescription}': ${error.message}. Using CSV email assignments.`
                  );
                  
                  if (!this.projectHelpers.getUserByEmail) {
                    throw new Error('Helper getUserByEmail not registered');
                  }
                  const bookkeeper = await this.projectHelpers.getUserByEmail(data.bookkeeperEmail);
                  const clientManager = await this.projectHelpers.getUserByEmail(data.clientManagerEmail);
                  
                  if (!bookkeeper || !clientManager) {
                    throw new Error(`Bookkeeper (${data.bookkeeperEmail}) or client manager (${data.clientManagerEmail}) not found`);
                  }
                  
                  finalBookkeeperId = bookkeeper.id;
                  finalClientManagerId = clientManager.id;
                  finalCurrentAssigneeId = clientManager.id;
                } else {
                  throw error;
                }
              }
            } else {
              if (!this.projectHelpers.getUserByEmail) {
                throw new Error('Helper getUserByEmail not registered');
              }
              const bookkeeper = await this.projectHelpers.getUserByEmail(data.bookkeeperEmail);
              const clientManager = await this.projectHelpers.getUserByEmail(data.clientManagerEmail);
              
              if (!bookkeeper || !clientManager) {
                throw new Error(`Bookkeeper (${data.bookkeeperEmail}) or client manager (${data.clientManagerEmail}) not found`);
              }
              
              finalBookkeeperId = bookkeeper.id;
              finalClientManagerId = clientManager.id;
              finalCurrentAssigneeId = clientManager.id;
            }

            const normalizedProjectMonth = normalizeProjectMonth(data.projectMonth);
            const existingProjectForMonth = await tx.query.projects.findFirst({
              where: and(
                eq(projects.clientId, client.id),
                eq(projects.description, data.projectDescription),
                eq(projects.projectMonth, normalizedProjectMonth),
                eq(projects.archived, false)
              ),
            });

            if (existingProjectForMonth) {
              console.log(`Skipping duplicate project for ${data.clientName} - ${data.projectDescription} - ${normalizedProjectMonth}`);
              alreadyExistsCount++;
              processedClients.add(data.clientName);
              continue;
            }

            const existingProjects = await tx.query.projects.findMany({
              where: and(
                eq(projects.clientId, client.id),
                eq(projects.description, data.projectDescription),
                eq(projects.archived, false)
              ),
              with: {
                chronology: {
                  orderBy: desc(projectChronology.timestamp),
                  limit: 1,
                },
              },
            });

            for (const existingProject of existingProjects) {
              if (existingProject.currentStatus !== "Completed") {
                const chronologyList = existingProject.chronology as any[];
                const lastChronology = chronologyList[0];
                const timeInPreviousStage = lastChronology && lastChronology.timestamp
                  ? Math.floor((Date.now() - new Date(lastChronology.timestamp).getTime()) / (1000 * 60))
                  : 0;

                await tx.insert(projectChronology).values({
                  projectId: existingProject.id,
                  fromStatus: existingProject.currentStatus,
                  toStatus: "Not Completed in Time",
                  assigneeId: existingProject.currentAssigneeId || finalClientManagerId,
                  changeReason: "clarifications_needed",
                  notes: `Project moved to 'Not Completed in Time' due to new monthly cycle. Previous status: ${existingProject.currentStatus}`,
                  timeInPreviousStage,
                });

                const [updatedProject] = await tx.update(projects)
                  .set({
                    currentStatus: "Not Completed in Time",
                    currentAssigneeId: existingProject.currentAssigneeId || finalClientManagerId,
                    archived: true,
                    updatedAt: new Date(),
                  })
                  .where(eq(projects.id, existingProject.id))
                  .returning();

                archivedProjects.push(updatedProject);
              }
            }

            let notCompletedStage = await tx.select().from(kanbanStages).where(and(
              eq(kanbanStages.name, "Not Completed in Time"),
              eq(kanbanStages.projectTypeId, projectType.id)
            ));
            if (notCompletedStage.length === 0) {
              const maxOrder = await tx.select({ maxOrder: sql<number>`COALESCE(MAX(${kanbanStages.order}), 0)` }).from(kanbanStages).where(eq(kanbanStages.projectTypeId, projectType.id));
              const [newStage] = await tx.insert(kanbanStages).values({
                name: "Not Completed in Time",
                projectTypeId: projectType.id,
                assignedUserId: null,
                assignedWorkRoleId: null,
                order: (maxOrder[0]?.maxOrder || 0) + 1,
                color: "#ef4444",
              }).returning();
              notCompletedStage = [newStage];
            }

            const [newProject] = await tx.insert(projects).values({
              clientId: client.id,
              projectTypeId: projectType.id,
              bookkeeperId: finalBookkeeperId,
              clientManagerId: finalClientManagerId,
              currentAssigneeId: finalCurrentAssigneeId,
              description: data.projectDescription,
              currentStatus: defaultStage.name,
              priority: data.priority || "medium",
              dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
              projectMonth: normalizedProjectMonth,
              archived: false,
            }).returning();

            await tx.insert(projectChronology).values({
              projectId: newProject.id,
              fromStatus: null,
              toStatus: defaultStage.name,
              assigneeId: finalCurrentAssigneeId,
              changeReason: `${newProject.description} Created → ${defaultStage.name}`,
              notes: `New project created for month ${normalizedProjectMonth}${usedRoleBasedAssignment ? ' using role-based assignments' : ' using CSV email assignments'}`,
              timeInPreviousStage: 0,
            });

            createdProjects.push(newProject);
            processedClients.add(data.clientName);

          } catch (error) {
            console.error(`Error processing project for ${data.clientName}:`, error);
            throw new Error(`Failed to process project for ${data.clientName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        return {
          createdProjects,
          archivedProjects,
          processedClients: Array.from(processedClients),
          alreadyExistsCount,
        };
      });

      result.success = true;
      result.createdProjects = transactionResult.createdProjects;
      result.archivedProjects = transactionResult.archivedProjects;
      result.summary.newProjectsCreated = transactionResult.createdProjects.length;
      result.summary.existingProjectsArchived = transactionResult.archivedProjects.length;
      result.summary.alreadyExistsCount = transactionResult.alreadyExistsCount;
      result.summary.clientsProcessed = transactionResult.processedClients;

      return result;

    } catch (error) {
      console.error("Error in createProjectsFromCSV:", error);
      result.errors.push(error instanceof Error ? error.message : "Unknown error occurred");
      return result;
    }
  }

  private async validateCSVData(projectsData: any[]): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!projectsData || projectsData.length === 0) {
      errors.push("CSV data is empty or invalid");
      return { isValid: false, errors };
    }

    const clientNames = projectsData.map(data => data.clientName).filter(Boolean);
    const duplicateClients = clientNames.filter((name, index) => clientNames.indexOf(name) !== index);
    if (duplicateClients.length > 0) {
      errors.push(`Duplicate client names found in CSV: ${Array.from(new Set(duplicateClients)).join(', ')}. Each client can only appear once per upload.`);
    }

    const activeDescriptions = await db.select().from(projectTypes).where(eq(projectTypes.active, true));
    if (activeDescriptions.length === 0) {
      errors.push("No active project descriptions found. Please configure project descriptions in the admin area before importing projects.");
      return { isValid: false, errors };
    }

    const validDescriptionNames = new Set(activeDescriptions.map(desc => desc.name));
    const invalidDescriptions = projectsData
      .map(data => data.projectDescription)
      .filter(desc => desc && !validDescriptionNames.has(desc));

    if (invalidDescriptions.length > 0) {
      errors.push(`Invalid project descriptions found: ${Array.from(new Set(invalidDescriptions)).join(', ')}. Valid descriptions are: ${Array.from(validDescriptionNames).join(', ')}`);
    }

    return { isValid: errors.length === 0, errors };
  }
}
