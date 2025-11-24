import { db } from '../../db.js';
import {
  projects,
  projectChronology,
  projectSchedulingHistory,
  users,
  clients,
  clientServices,
  projectTypes,
  kanbanStages,
  services,
} from '@shared/schema';
import { eq, and, or, desc, gte, lte, lt, isNotNull, isNull, inArray, sql } from 'drizzle-orm';
import type {
  Project,
  InsertProject,
  ProjectWithRelations,
  UpdateProjectStatus,
  User,
} from '@shared/schema';
import { BaseStorage } from '../base/BaseStorage.js';

/**
 * Storage class for core project operations.
 * 
 * Handles:
 * - Project CRUD operations
 * - Project filtering and querying
 * - Project status updates
 * - Project analytics
 * - Bulk operations (CSV import, notifications)
 */
export class ProjectStorage extends BaseStorage {
  // Helper references (will be injected by facade)
  private helpers: {
    getDefaultStage?: () => Promise<any>;
    validateProjectStatus?: (status: string) => Promise<any>;
    getServiceByProjectTypeId?: (projectTypeId: string) => Promise<any>;
    getClientServiceByClientAndProjectType?: (clientId: string, projectTypeId: string) => Promise<any>;
    resolveProjectAssignments?: (clientId: string, projectTypeId: string) => Promise<any>;
    resolveServiceOwner?: (clientId: string, projectTypeId: string) => Promise<any>;
    resolveStageRoleAssignee?: (project: any) => Promise<User | undefined>;
  } = {};

  /**
   * Register helper methods for cross-domain dependencies
   */
  registerHelpers(helpers: typeof this.helpers) {
    this.helpers = { ...this.helpers, ...helpers };
  }

  // ==================== Core Project CRUD Operations ====================

  async createProject(projectData: InsertProject): Promise<Project> {
    // Ensure we have a valid status
    let finalProjectData = { ...projectData };
    
    if (!finalProjectData.currentStatus) {
      // Use default stage when no status is provided
      if (!this.helpers.getDefaultStage) {
        throw new Error('Helper getDefaultStage not registered');
      }
      const defaultStage = await this.helpers.getDefaultStage();
      if (!defaultStage) {
        throw new Error("No kanban stages found. Please create at least one stage before creating projects.");
      }
      finalProjectData.currentStatus = defaultStage.name;
    }
    
    // Validate that the currentStatus matches an existing stage
    if (!this.helpers.validateProjectStatus) {
      throw new Error('Helper validateProjectStatus not registered');
    }
    const validation = await this.helpers.validateProjectStatus(finalProjectData.currentStatus);
    if (!validation.isValid) {
      throw new Error(validation.reason || "Invalid project status");
    }

    // Check if project type is mapped to a service for role-based assignments
    if (!this.helpers.getServiceByProjectTypeId) {
      throw new Error('Helper getServiceByProjectTypeId not registered');
    }
    const service = await this.helpers.getServiceByProjectTypeId(finalProjectData.projectTypeId);
    
    if (service) {
      // Project type is mapped to a service - use role-based assignments
      try {
        if (!this.helpers.getClientServiceByClientAndProjectType || !this.helpers.resolveProjectAssignments) {
          throw new Error('Helper methods not registered');
        }
        
        const clientService = await this.helpers.getClientServiceByClientAndProjectType(
          finalProjectData.clientId, 
          finalProjectData.projectTypeId
        );
        
        if (clientService) {
          // Use role-based assignment logic
          const roleAssignments = await this.helpers.resolveProjectAssignments(
            finalProjectData.clientId, 
            finalProjectData.projectTypeId
          );
          
          // Override the user assignments with role-based assignments
          finalProjectData.bookkeeperId = roleAssignments.bookkeeperId;
          finalProjectData.clientManagerId = roleAssignments.clientManagerId;
          finalProjectData.currentAssigneeId = roleAssignments.currentAssigneeId;
          
          if (roleAssignments.usedFallback) {
            console.warn(
              `Project creation used fallback user for roles: ${roleAssignments.fallbackRoles.join(', ')}`
            );
          }
        } else {
          // Service exists but client doesn't have service mapping
          console.warn(
            `Project type ${finalProjectData.projectTypeId} is service-mapped but client ${finalProjectData.clientId} has no service assignment. Using direct user assignments.`
          );
          
          // Validate that required fields are present for direct assignment
          if (!finalProjectData.bookkeeperId || !finalProjectData.clientManagerId) {
            throw new Error("Project type is service-mapped but client has no service assignment. Direct user assignments (bookkeeperId, clientManagerId) are required.");
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('cannot use role-based assignments')) {
          // Role-based assignment failed, fallback to direct assignment
          console.warn(
            `Role-based assignment failed for project type ${finalProjectData.projectTypeId}: ${error.message}. Using direct user assignments.`
          );
          
          // Validate that required fields are present for direct assignment
          if (!finalProjectData.bookkeeperId || !finalProjectData.clientManagerId) {
            throw new Error("Role-based assignment failed and direct user assignments (bookkeeperId, clientManagerId) are missing.");
          }
        } else {
          throw error; // Re-throw other errors
        }
      }
    } else {
      // Project type is NOT mapped to a service - use direct user assignments (existing logic)
      if (!finalProjectData.bookkeeperId || !finalProjectData.clientManagerId) {
        throw new Error("Project type is not service-mapped. Direct user assignments (bookkeeperId, clientManagerId) are required.");
      }
    }

    // Set project owner based on service owner resolution
    if (service && this.helpers.resolveServiceOwner) {
      // For service-mapped projects, resolve the effective service owner
      const serviceOwner = await this.helpers.resolveServiceOwner(finalProjectData.clientId, finalProjectData.projectTypeId);
      if (serviceOwner) {
        finalProjectData.projectOwnerId = serviceOwner.id;
        console.log(`Project owner set to service owner: ${serviceOwner.email} (${serviceOwner.id})`);
      } else {
        console.warn(`No service owner found for client ${finalProjectData.clientId} and project type ${finalProjectData.projectTypeId}`);
      }
    }
    // For non-service-mapped projects, projectOwnerId remains null (which is fine since it's nullable)

    // Ensure currentAssigneeId is set if not already assigned
    if (!finalProjectData.currentAssigneeId) {
      finalProjectData.currentAssigneeId = finalProjectData.clientManagerId;
    }
    
    // Use a database transaction to ensure both project and chronology entry are created atomically
    return await db.transaction(async (tx) => {
      // Create the project
      const [project] = await tx.insert(projects).values(finalProjectData).returning();
      
      // Create initial chronology entry
      await tx.insert(projectChronology).values({
        projectId: project.id,
        fromStatus: null, // Initial entry has no previous status
        toStatus: project.currentStatus,
        assigneeId: project.currentAssigneeId,
        changeReason: `${project.description} Created → ${project.currentStatus}`,
        timeInPreviousStage: null, // No previous stage for initial entry
        businessHoursInPreviousStage: null, // No previous stage for initial entry
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
      },
    });

    if (!project) {
      return undefined;
    }

    // Resolve the stage role assignee if helpers are available
    const stageRoleAssignee = this.helpers.resolveStageRoleAssignee
      ? await this.helpers.resolveStageRoleAssignee(project)
      : undefined;

    return {
      ...project,
      stageRoleAssignee,
    } as ProjectWithRelations;
  }

  async updateProject(id: string, updateData: Partial<InsertProject>): Promise<Project> {
    const [updatedProject] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();

    if (!updatedProject) {
      throw new Error('Project not found');
    }

    return updatedProject;
  }

  async getActiveProjectsByClientAndType(clientId: string, projectTypeId: string): Promise<Project[]> {
    const activeProjects = await db.query.projects.findMany({
      where: and(
        eq(projects.clientId, clientId),
        eq(projects.projectTypeId, projectTypeId),
        eq(projects.archived, false),
        eq(projects.inactive, false),
        isNull(projects.completionStatus) // Only include projects that are truly active (not completed)
      ),
    });
    
    return activeProjects;
  }

  async getUniqueDueDatesForService(serviceId: string): Promise<string[]> {
    // Find all project types for this service
    const serviceProjectTypes = await db
      .select({ id: projectTypes.id })
      .from(projectTypes)
      .where(eq(projectTypes.serviceId, serviceId));
    
    const projectTypeIds = serviceProjectTypes.map(pt => pt.id);
    
    if (projectTypeIds.length === 0) {
      return [];
    }

    // Get unique due dates for projects with these project types
    const dueDates = await db
      .selectDistinct({ dueDate: projects.dueDate })
      .from(projects)
      .where(
        and(
          inArray(projects.projectTypeId, projectTypeIds),
          isNotNull(projects.dueDate),
          eq(projects.inactive, false) // Exclude inactive projects
        )
      )
      .orderBy(projects.dueDate);

    // Convert dates to ISO strings and filter out nulls
    return dueDates
      .map(d => d.dueDate)
      .filter((date): date is Date => date !== null)
      .map(date => date.toISOString().split('T')[0]); // Return YYYY-MM-DD format
  }

  // Note: The following complex methods (getAllProjects, getProjectsByUser, getProjectsByClient,
  // getProjectsByClientServiceId, updateProjectStatus, getProjectAnalytics, createProjectsFromCSV,
  // sendBulkProjectAssignmentNotifications) are too large to extract in one pass.
  // They will remain in the facade delegating to old storage temporarily until Stage 4 Part 2.
  // This allows Stage 4 to be testable with the core CRUD methods while keeping file size manageable.
}
