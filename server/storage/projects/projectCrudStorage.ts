import { db } from '../../db.js';
import {
  projects,
  projectChronology,
  projectTypes,
} from '@shared/schema';
import { eq, and, isNotNull, isNull, inArray, desc } from 'drizzle-orm';
import type {
  Project,
  InsertProject,
  ProjectWithRelations,
} from '@shared/schema';
import type { ProjectStorageHelpers } from './types.js';

/**
 * Storage class for core project CRUD operations.
 * 
 * Handles:
 * - Project creation with role-based assignment resolution
 * - Project retrieval with relations
 * - Project updates with auto-unarchive logic
 * - Project deletion
 * - Active project queries
 * - Due date queries for services
 */
export class ProjectCrudStorage {
  constructor(private projectHelpers: ProjectStorageHelpers) {}

  async createProject(projectData: InsertProject): Promise<Project> {
    let finalProjectData = { ...projectData };
    
    if (!finalProjectData.currentStatus) {
      if (!this.projectHelpers.getDefaultStage) {
        throw new Error('Helper getDefaultStage not registered');
      }
      const defaultStage = await this.projectHelpers.getDefaultStage();
      if (!defaultStage) {
        throw new Error("No kanban stages found. Please create at least one stage before creating projects.");
      }
      finalProjectData.currentStatus = defaultStage.name;
    }
    
    if (!this.projectHelpers.validateProjectStatus) {
      throw new Error('Helper validateProjectStatus not registered');
    }
    const validation = await this.projectHelpers.validateProjectStatus(finalProjectData.currentStatus!);
    if (!validation.isValid) {
      throw new Error(validation.reason || "Invalid project status");
    }

    if (!this.projectHelpers.getServiceByProjectTypeId) {
      throw new Error('Helper getServiceByProjectTypeId not registered');
    }
    const service = await this.projectHelpers.getServiceByProjectTypeId(finalProjectData.projectTypeId);
    
    if (service) {
      try {
        if (!this.projectHelpers.getClientServiceByClientAndProjectType || !this.projectHelpers.resolveProjectAssignments) {
          throw new Error('Helper methods not registered');
        }
        
        const clientService = await this.projectHelpers.getClientServiceByClientAndProjectType(
          finalProjectData.clientId, 
          finalProjectData.projectTypeId
        );
        
        if (clientService) {
          const roleAssignments = await this.projectHelpers.resolveProjectAssignments(
            finalProjectData.clientId, 
            finalProjectData.projectTypeId
          );
          
          finalProjectData.bookkeeperId = roleAssignments.bookkeeperId;
          finalProjectData.clientManagerId = roleAssignments.clientManagerId;
          finalProjectData.currentAssigneeId = roleAssignments.currentAssigneeId;
          
          if (roleAssignments.usedFallback) {
            console.warn(
              `Project creation used fallback user for roles: ${roleAssignments.fallbackRoles.join(', ')}`
            );
          }
        } else {
          console.warn(
            `Project type ${finalProjectData.projectTypeId} is service-mapped but client ${finalProjectData.clientId} has no service assignment. Using direct user assignments.`
          );
          
          if (!finalProjectData.bookkeeperId || !finalProjectData.clientManagerId) {
            throw new Error("Project type is service-mapped but client has no service assignment. Direct user assignments (bookkeeperId, clientManagerId) are required.");
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('cannot use role-based assignments')) {
          console.warn(
            `Role-based assignment failed for project type ${finalProjectData.projectTypeId}: ${error.message}. Using direct user assignments.`
          );
          
          if (!finalProjectData.bookkeeperId || !finalProjectData.clientManagerId) {
            throw new Error("Role-based assignment failed and direct user assignments (bookkeeperId, clientManagerId) are missing.");
          }
        } else {
          throw error;
        }
      }
    } else {
      if (!finalProjectData.bookkeeperId || !finalProjectData.clientManagerId) {
        throw new Error("Project type is not service-mapped. Direct user assignments (bookkeeperId, clientManagerId) are required.");
      }
    }

    if (service && this.projectHelpers.resolveServiceOwner) {
      const serviceOwner = await this.projectHelpers.resolveServiceOwner(finalProjectData.clientId, finalProjectData.projectTypeId);
      if (serviceOwner) {
        finalProjectData.projectOwnerId = serviceOwner.id;
        console.log(`Project owner set to service owner: ${serviceOwner.email} (${serviceOwner.id})`);
      } else {
        console.warn(`No service owner found for client ${finalProjectData.clientId} and project type ${finalProjectData.projectTypeId}`);
      }
    }

    if (!finalProjectData.currentAssigneeId) {
      finalProjectData.currentAssigneeId = finalProjectData.clientManagerId;
    }
    
    return await db.transaction(async (tx) => {
      const [project] = await tx.insert(projects).values(finalProjectData).returning();
      
      await tx.insert(projectChronology).values({
        projectId: project.id,
        fromStatus: null,
        toStatus: project.currentStatus,
        assigneeId: project.currentAssigneeId,
        changeReason: `${project.description} Created → ${project.currentStatus}`,
        timeInPreviousStage: null,
        businessHoursInPreviousStage: null,
      });
      
      return project;
    });
  }

  async getProject(id: string): Promise<ProjectWithRelations | undefined> {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        client: true,
        projectType: {
          with: {
            service: true,
          },
        },
        currentAssignee: true,
        bookkeeper: true,
        clientManager: true,
        projectOwner: true,
        chronology: {
          with: {
            assignee: true,
            changedBy: true,
            fieldResponses: {
              with: {
                customField: true,
              },
            },
          },
          orderBy: desc(projectChronology.timestamp),
        },
        stageApprovalResponses: {
          with: {
            field: true,
          },
          orderBy: (stageApprovalResponses: any, { asc }: { asc: any }) => [asc(stageApprovalResponses.createdAt)],
        },
      },
    });

    if (!project) {
      return undefined;
    }

    const stageRoleAssignee = this.projectHelpers.resolveStageRoleAssignee
      ? await this.projectHelpers.resolveStageRoleAssignee(project)
      : undefined;

    return {
      ...project,
      currentAssignee: project.currentAssignee || undefined,
      bookkeeper: project.bookkeeper || undefined,
      clientManager: project.clientManager || undefined,
      projectOwner: project.projectOwner || undefined,
      chronology: (project.chronology as any[]).map((c: any) => ({
        ...c,
        assignee: c.assignee || undefined,
        changedBy: c.changedBy || undefined,
        fieldResponses: c.fieldResponses || [],
      })),
      stageApprovalResponses: ((project.stageApprovalResponses || []) as any[]).map((r: any) => ({
        ...r,
        field: r.field || undefined,
      })),
      stageRoleAssignee,
    } as ProjectWithRelations;
  }

  async updateProject(id: string, updateData: Partial<InsertProject>): Promise<Project> {
    let wasArchived = false;
    if (updateData.archived === false) {
      const [existingProject] = await db
        .select({ archived: projects.archived })
        .from(projects)
        .where(eq(projects.id, id));
      wasArchived = existingProject?.archived === true;
    }

    const [updatedProject] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();

    if (!updatedProject) {
      throw new Error('Project not found');
    }

    if (wasArchived && updateData.archived === false) {
      try {
        let totalUnarchived = 0;
        if (this.projectHelpers.unarchiveAutoArchivedMessageThreadsByProjectId) {
          const clientThreadsUnarchived = await this.projectHelpers.unarchiveAutoArchivedMessageThreadsByProjectId(id);
          totalUnarchived += clientThreadsUnarchived;
        }
        if (this.projectHelpers.unarchiveAutoArchivedProjectMessageThreadsByProjectId) {
          const projectThreadsUnarchived = await this.projectHelpers.unarchiveAutoArchivedProjectMessageThreadsByProjectId(id);
          totalUnarchived += projectThreadsUnarchived;
        }
        if (totalUnarchived > 0) {
          console.log(`[Storage] Auto-unarchived ${totalUnarchived} message thread(s) for re-opened project ${id}`);
        }
      } catch (error) {
        console.error(`[Storage] Failed to auto-unarchive message threads for project ${id}:`, error);
      }
    }

    return updatedProject;
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getActiveProjectsByClientAndType(clientId: string, projectTypeId: string): Promise<Project[]> {
    const activeProjects = await db.query.projects.findMany({
      where: and(
        eq(projects.clientId, clientId),
        eq(projects.projectTypeId, projectTypeId),
        eq(projects.archived, false),
        eq(projects.inactive, false),
        isNull(projects.completionStatus)
      ),
    });
    
    return activeProjects;
  }

  async getUniqueDueDatesForService(serviceId: string): Promise<string[]> {
    const serviceProjectTypes = await db
      .select({ id: projectTypes.id })
      .from(projectTypes)
      .where(eq(projectTypes.serviceId, serviceId));
    
    const projectTypeIds = serviceProjectTypes.map(pt => pt.id);
    
    if (projectTypeIds.length === 0) {
      return [];
    }

    const dueDates = await db
      .selectDistinct({ dueDate: projects.dueDate })
      .from(projects)
      .where(
        and(
          inArray(projects.projectTypeId, projectTypeIds),
          isNotNull(projects.dueDate),
          eq(projects.inactive, false)
        )
      )
      .orderBy(projects.dueDate);

    return dueDates
      .map(d => d.dueDate)
      .filter((date): date is Date => date !== null)
      .map(date => date.toISOString().split('T')[0]);
  }
}
