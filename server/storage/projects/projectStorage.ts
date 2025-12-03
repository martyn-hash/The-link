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
  changeReasons,
  reasonCustomFields,
  reasonFieldResponses,
  workRoles,
  clientServiceRoleAssignments,
  userNotificationPreferences,
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
import { calculateBusinessHours } from '@shared/businessTime';
import { normalizeProjectMonth } from '@shared/schema';
import { sendBulkProjectAssignmentSummaryEmail } from '../../emailService.js';

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
  private projectHelpers: {
    getDefaultStage?: () => Promise<any>;
    validateProjectStatus?: (status: string) => Promise<any>;
    getServiceByProjectTypeId?: (projectTypeId: string) => Promise<any>;
    getClientServiceByClientAndProjectType?: (clientId: string, projectTypeId: string) => Promise<any>;
    resolveProjectAssignments?: (clientId: string, projectTypeId: string) => Promise<any>;
    resolveServiceOwner?: (clientId: string, projectTypeId: string) => Promise<any>;
    resolveStageRoleAssignee?: (project: any) => Promise<User | undefined>;
    resolveStageRoleAssigneesBatch?: (projects: any[]) => Promise<Map<string, User | undefined>>;
    validateStageReasonMapping?: (stageId: string, reasonId: string) => Promise<any>;
    validateRequiredFields?: (reasonId: string, fieldResponses: any[]) => Promise<any>;
    getWorkRoleById?: (workRoleId: string) => Promise<any>;
    resolveRoleAssigneeForClient?: (clientId: string, projectTypeId: string, roleName: string) => Promise<any>;
    sendStageChangeNotifications?: (projectId: string, newStatus: string, oldStatus: string) => Promise<void>;
    createProjectMessageThread?: (data: any) => Promise<any>;
    createProjectMessageParticipant?: (data: any) => Promise<any>;
    createProjectMessage?: (data: any) => Promise<any>;
    cancelScheduledNotificationsForProject?: (projectId: string, reason: string) => Promise<void>;
    getProjectTypeByName?: (name: string) => Promise<any>;
    getClientByName?: (name: string) => Promise<any>;
    getUserByEmail?: (email: string) => Promise<any>;
  } = {};
  
  // Cache for recent notifications to prevent duplicates
  private recentNotifications = new Map<string, number>();

  /**
   * Register helper methods for cross-domain dependencies
   */
  registerProjectHelpers(helpers: typeof this.projectHelpers) {
    this.projectHelpers = { ...this.projectHelpers, ...helpers };
  }

  // ==================== Core Project CRUD Operations ====================

  async createProject(projectData: InsertProject): Promise<Project> {
    // Ensure we have a valid status
    let finalProjectData = { ...projectData };
    
    if (!finalProjectData.currentStatus) {
      // Use default stage when no status is provided
      if (!this.projectHelpers.getDefaultStage) {
        throw new Error('Helper getDefaultStage not registered');
      }
      const defaultStage = await this.projectHelpers.getDefaultStage();
      if (!defaultStage) {
        throw new Error("No kanban stages found. Please create at least one stage before creating projects.");
      }
      finalProjectData.currentStatus = defaultStage.name;
    }
    
    // Validate that the currentStatus matches an existing stage
    if (!this.projectHelpers.validateProjectStatus) {
      throw new Error('Helper validateProjectStatus not registered');
    }
    const validation = await this.projectHelpers.validateProjectStatus(finalProjectData.currentStatus!);
    if (!validation.isValid) {
      throw new Error(validation.reason || "Invalid project status");
    }

    // Check if project type is mapped to a service for role-based assignments
    if (!this.projectHelpers.getServiceByProjectTypeId) {
      throw new Error('Helper getServiceByProjectTypeId not registered');
    }
    const service = await this.projectHelpers.getServiceByProjectTypeId(finalProjectData.projectTypeId);
    
    if (service) {
      // Project type is mapped to a service - use role-based assignments
      try {
        if (!this.projectHelpers.getClientServiceByClientAndProjectType || !this.projectHelpers.resolveProjectAssignments) {
          throw new Error('Helper methods not registered');
        }
        
        const clientService = await this.projectHelpers.getClientServiceByClientAndProjectType(
          finalProjectData.clientId, 
          finalProjectData.projectTypeId
        );
        
        if (clientService) {
          // Use role-based assignment logic
          const roleAssignments = await this.projectHelpers.resolveProjectAssignments(
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
    if (service && this.projectHelpers.resolveServiceOwner) {
      // For service-mapped projects, resolve the effective service owner
      const serviceOwner = await this.projectHelpers.resolveServiceOwner(finalProjectData.clientId, finalProjectData.projectTypeId);
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
          orderBy: (stageApprovalResponses, { asc }) => [asc(stageApprovalResponses.createdAt)],
        },
      },
    });

    if (!project) {
      return undefined;
    }

    // Resolve the stage role assignee if helpers are available
    const stageRoleAssignee = this.projectHelpers.resolveStageRoleAssignee
      ? await this.projectHelpers.resolveStageRoleAssignee(project)
      : undefined;

    return {
      ...project,
      currentAssignee: project.currentAssignee || undefined,
      bookkeeper: project.bookkeeper || undefined,
      clientManager: project.clientManager || undefined,
      projectOwner: project.projectOwner || undefined,
      chronology: project.chronology.map(c => ({
        ...c,
        assignee: c.assignee || undefined,
        changedBy: c.changedBy || undefined,
        fieldResponses: c.fieldResponses || [],
      })),
      stageApprovalResponses: (project.stageApprovalResponses || []).map(r => ({
        ...r,
        field: r.field || undefined,
      })),
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

  // ==================== Complex Project Query Operations ====================

  async getAllProjects(filters?: { month?: string; archived?: boolean; showArchived?: boolean; showCompletedRegardless?: boolean; inactive?: boolean; serviceId?: string; assigneeId?: string; serviceOwnerId?: string; userId?: string; dynamicDateFilter?: string; dateFrom?: string; dateTo?: string; dueDate?: string }): Promise<ProjectWithRelations[]> {
    let whereConditions = [];
    
    if (filters?.month) {
      whereConditions.push(eq(projects.projectMonth, filters.month));
    }
    
    // Determine whether to include completed projects regardless of archived/inactive status
    // When showCompletedRegardless is EXPLICITLY false, completed projects are excluded entirely
    // When showCompletedRegardless is true OR undefined (default), completed projects are always included
    // This ensures backward compatibility - existing callers without this parameter maintain current behavior
    const excludeCompletedProjects = filters?.showCompletedRegardless === false;
    
    // Handle archived filtering
    if (filters?.archived !== undefined) {
      if (!excludeCompletedProjects) {
        // Explicit archived filter: match archived status OR include completed projects
        whereConditions.push(
          or(
            eq(projects.archived, filters.archived),
            isNotNull(projects.completionStatus)
          )!
        );
      } else {
        // Don't include completed projects automatically
        whereConditions.push(eq(projects.archived, filters.archived));
      }
    } else if (filters?.showArchived !== true) {
      if (!excludeCompletedProjects) {
        // Default behavior (undefined or false): exclude archived projects BUT always include completed projects
        whereConditions.push(
          or(
            eq(projects.archived, false),
            isNotNull(projects.completionStatus)
          )!
        );
      } else {
        // Exclude archived projects and do not include completed projects automatically
        whereConditions.push(eq(projects.archived, false));
      }
    }
    // When showArchived is explicitly true, don't filter by archived status (show all)
    
    // Handle inactive filtering
    if (filters?.inactive !== undefined) {
      if (!excludeCompletedProjects) {
        // Explicit inactive filter: match inactive status OR include completed projects
        whereConditions.push(
          or(
            eq(projects.inactive, filters.inactive),
            isNotNull(projects.completionStatus)
          )!
        );
      } else {
        // Don't include completed projects automatically
        whereConditions.push(eq(projects.inactive, filters.inactive));
      }
    } else {
      if (!excludeCompletedProjects) {
        // Default: exclude inactive projects BUT always include completed projects
        whereConditions.push(
          or(
            eq(projects.inactive, false),
            isNotNull(projects.completionStatus)
          )!
        );
      } else {
        // Exclude inactive projects and do not include completed projects automatically
        whereConditions.push(eq(projects.inactive, false));
      }
    }
    
    // If showCompletedRegardless is explicitly false, exclude completed projects
    if (excludeCompletedProjects) {
      whereConditions.push(isNull(projects.completionStatus));
    }
    
    if (filters?.assigneeId) {
      whereConditions.push(eq(projects.currentAssigneeId, filters.assigneeId));
    }
    
    if (filters?.serviceOwnerId) {
      whereConditions.push(eq(projects.projectOwnerId, filters.serviceOwnerId));
    }
    
    if (filters?.userId) {
      whereConditions.push(eq(projects.clientManagerId, filters.userId));
    }

    // Filter by service if provided - need to join with projectTypes
    if (filters?.serviceId) {
      // Use a subquery to find project types linked to the service
      const serviceProjectTypes = await db
        .select({ id: projectTypes.id })
        .from(projectTypes)
        .where(eq(projectTypes.serviceId, filters.serviceId));
      
      const projectTypeIds = serviceProjectTypes.map(pt => pt.id);
      
      if (projectTypeIds.length > 0) {
        whereConditions.push(inArray(projects.projectTypeId, projectTypeIds));
      } else {
        // No project types found for this service, return empty result
        return [];
      }
    }
    
    // Exact due date filtering (takes precedence over dynamic date filters)
    if (filters?.dueDate) {
      const targetDate = new Date(filters.dueDate);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      whereConditions.push(
        and(
          gte(projects.dueDate, sql`${targetDate}`),
          lt(projects.dueDate, sql`${nextDay}`)
        )!
      );
    } else if (filters?.dynamicDateFilter && filters.dynamicDateFilter !== 'all') {
      // Dynamic date filtering
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      switch (filters.dynamicDateFilter) {
        case 'overdue':
          whereConditions.push(lt(projects.dueDate, sql`${today}`));
          break;
        case 'today':
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          whereConditions.push(
            and(
              gte(projects.dueDate, sql`${today}`),
              lt(projects.dueDate, sql`${tomorrow}`)
            )!
          );
          break;
        case 'next7days':
          const next7 = new Date(today);
          next7.setDate(next7.getDate() + 7);
          whereConditions.push(
            and(
              gte(projects.dueDate, sql`${today}`),
              lte(projects.dueDate, sql`${next7}`)
            )!
          );
          break;
        case 'next14days':
          const next14 = new Date(today);
          next14.setDate(next14.getDate() + 14);
          whereConditions.push(
            and(
              gte(projects.dueDate, sql`${today}`),
              lte(projects.dueDate, sql`${next14}`)
            )!
          );
          break;
        case 'next30days':
          const next30 = new Date(today);
          next30.setDate(next30.getDate() + 30);
          whereConditions.push(
            and(
              gte(projects.dueDate, sql`${today}`),
              lte(projects.dueDate, sql`${next30}`)
            )!
          );
          break;
        case 'custom':
          if (filters.dateFrom && filters.dateTo) {
            whereConditions.push(
              and(
                gte(projects.dueDate, sql`${filters.dateFrom}`),
                lte(projects.dueDate, sql`${filters.dateTo}`)
              )!
            );
          } else if (filters.dateFrom) {
            whereConditions.push(gte(projects.dueDate, sql`${filters.dateFrom}`));
          } else if (filters.dateTo) {
            whereConditions.push(lte(projects.dueDate, sql`${filters.dateTo}`));
          }
          break;
      }
    }
    
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
    
    const results = await db.query.projects.findMany({
      where: whereClause,
      with: {
        client: true,
        bookkeeper: true,
        clientManager: true,
        currentAssignee: true,
        projectOwner: true,
        projectType: {
          with: {
            service: true,
          },
        },
        // Load chronology without expensive fieldResponses join (was causing timeout)
        chronology: {
          orderBy: desc(projectChronology.timestamp),
          with: {
            assignee: true,
            changedBy: true,
            // fieldResponses join removed for performance - only loaded in getProject() detail view
          },
        },
      },
    });
    
    // OPTIMIZED: Use batch lookup for stage role assignees (Issue #3 fix)
    // This reduces N+1 queries (3 per project) to just 3 batch queries total
    const stageRoleAssigneesMap = this.projectHelpers.resolveStageRoleAssigneesBatch
      ? await this.projectHelpers.resolveStageRoleAssigneesBatch(results)
      : new Map<string, User | undefined>();

    // Fetch priority service indicators for all projects
    // This finds services that have showInProjectServiceId set, then checks if clients have ACTIVE PROJECTS for those services
    const priorityIndicatorsMap = await this.getPriorityServiceIndicatorsBatch(results);

    // Convert null relations to undefined and populate stage role assignee from batch result
    const projectsWithAssignees = results.map((project) => {
      return {
        ...project,
        currentAssignee: project.currentAssignee || undefined,
        projectOwner: project.projectOwner || undefined,
        stageRoleAssignee: stageRoleAssigneesMap.get(project.id),
        priorityServiceIndicators: priorityIndicatorsMap.get(project.id) || [],
        chronology: project.chronology.map(c => ({
          ...c,
          assignee: c.assignee || undefined,
          changedBy: c.changedBy || undefined,
        })),
      };
    });
    
    return projectsWithAssignees as any;
  }

  /**
   * Batch lookup for priority service indicators
   * Returns a map of projectId -> array of service names that should show as priority indicators
   */
  private async getPriorityServiceIndicatorsBatch(projectList: any[]): Promise<Map<string, string[]>> {
    const priorityMap = new Map<string, string[]>();
    
    if (projectList.length === 0) {
      return priorityMap;
    }

    try {
      // Step 1: Get all services that have showInProjectServiceId set
      const indicatorServices = await db
        .select({
          id: services.id,
          name: services.name,
          showInProjectServiceId: services.showInProjectServiceId,
        })
        .from(services)
        .where(isNotNull(services.showInProjectServiceId));

      if (indicatorServices.length === 0) {
        return priorityMap;
      }

      // Step 2: Build a map of targetServiceId -> list of indicator service info
      const targetToIndicators = new Map<string, Array<{ id: string; name: string }>>();
      for (const service of indicatorServices) {
        if (service.showInProjectServiceId) {
          const existing = targetToIndicators.get(service.showInProjectServiceId) || [];
          existing.push({ id: service.id, name: service.name });
          targetToIndicators.set(service.showInProjectServiceId, existing);
        }
      }

      // Step 3: Get unique client IDs and service IDs we need to check
      const clientIds = [...new Set(projectList.map(p => p.clientId))];
      const indicatorServiceIds = indicatorServices.map(s => s.id);

      // Step 4: Fetch all ACTIVE PROJECTS for relevant clients and indicator services
      // An active project is one where completionStatus is NULL and inactive is false
      // We join projects with projectTypes to get the serviceId
      const activeProjectsForIndicatorServices = await db
        .select({
          clientId: projects.clientId,
          serviceId: projectTypes.serviceId,
        })
        .from(projects)
        .innerJoin(projectTypes, eq(projects.projectTypeId, projectTypes.id))
        .where(
          and(
            inArray(projects.clientId, clientIds),
            inArray(projectTypes.serviceId, indicatorServiceIds),
            isNull(projects.completionStatus),
            eq(projects.inactive, false)
          )
        );

      // Step 5: Build a set of (clientId, serviceId) pairs where an active project exists
      const clientHasActiveProjectForService = new Set<string>();
      for (const proj of activeProjectsForIndicatorServices) {
        if (proj.serviceId) {
          clientHasActiveProjectForService.add(`${proj.clientId}:${proj.serviceId}`);
        }
      }

      // Step 6: For each project, determine which priority indicators to show
      for (const proj of projectList) {
        const projectServiceId = proj.projectType?.serviceId;
        if (!projectServiceId) continue;

        const indicatorsForThisService = targetToIndicators.get(projectServiceId);
        if (!indicatorsForThisService) continue;

        const indicators: string[] = [];
        for (const indicator of indicatorsForThisService) {
          // Check if the client has an ACTIVE PROJECT for this indicator service
          if (clientHasActiveProjectForService.has(`${proj.clientId}:${indicator.id}`)) {
            indicators.push(indicator.name);
          }
        }

        if (indicators.length > 0) {
          priorityMap.set(proj.id, indicators);
        }
      }
    } catch (error) {
      console.error('Error fetching priority service indicators:', error);
      // Return empty map on error to not break the main query
    }

    return priorityMap;
  }

  async getProjectsByUser(userId: string, role: string, filters?: { month?: string; archived?: boolean; showArchived?: boolean; inactive?: boolean; serviceId?: string; assigneeId?: string; serviceOwnerId?: string; userId?: string; dynamicDateFilter?: string; dateFrom?: string; dateTo?: string }): Promise<ProjectWithRelations[]> {
    let userWhereCondition;
    
    switch (role) {
      case "admin":
      case "manager":
        // Admin and Manager can see all projects
        return this.getAllProjects(filters);
      case "client_manager":
        userWhereCondition = eq(projects.clientManagerId, userId);
        break;
      case "bookkeeper":
        userWhereCondition = eq(projects.bookkeeperId, userId);
        break;
      default:
        userWhereCondition = eq(projects.currentAssigneeId, userId);
    }

    // Build combined where conditions
    let whereConditions = [userWhereCondition];
    
    if (filters?.month) {
      whereConditions.push(eq(projects.projectMonth, filters.month));
    }
    
    // Handle archived filtering: always include completed projects regardless of archived status
    // The archived filter only applies to active (non-completed) projects
    if (filters?.archived !== undefined) {
      // Explicit archived filter: match archived status OR include completed projects
      whereConditions.push(
        or(
          eq(projects.archived, filters.archived),
          isNotNull(projects.completionStatus)
        )!
      );
    } else if (filters?.showArchived !== true) {
      // Default behavior (undefined or false): exclude archived projects BUT always include completed projects
      whereConditions.push(
        or(
          eq(projects.archived, false),
          isNotNull(projects.completionStatus)
        )!
      );
    }
    // When showArchived is explicitly true, don't filter by archived status (show all)
    
    // Handle inactive filtering: always include completed projects regardless of inactive status
    // The inactive filter only applies to active (non-completed) projects
    if (filters?.inactive !== undefined) {
      // Explicit inactive filter: match inactive status OR include completed projects
      whereConditions.push(
        or(
          eq(projects.inactive, filters.inactive),
          isNotNull(projects.completionStatus)
        )!
      );
    }
    
    if (filters?.assigneeId) {
      whereConditions.push(eq(projects.currentAssigneeId, filters.assigneeId));
    }
    
    if (filters?.serviceOwnerId) {
      whereConditions.push(eq(projects.projectOwnerId, filters.serviceOwnerId));
    }
    
    if (filters?.userId) {
      whereConditions.push(eq(projects.clientManagerId, filters.userId));
    }

    // Filter by service if provided - need to join with projectTypes
    if (filters?.serviceId) {
      // Use a subquery to find project types linked to the service
      const serviceProjectTypes = await db
        .select({ id: projectTypes.id })
        .from(projectTypes)
        .where(eq(projectTypes.serviceId, filters.serviceId));
      
      const projectTypeIds = serviceProjectTypes.map(pt => pt.id);
      
      if (projectTypeIds.length > 0) {
        whereConditions.push(inArray(projects.projectTypeId, projectTypeIds));
      } else {
        // No project types found for this service, return empty result
        return [];
      }
    }
    
    // Dynamic date filtering
    if (filters?.dynamicDateFilter && filters.dynamicDateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      switch (filters.dynamicDateFilter) {
        case 'overdue':
          whereConditions.push(lt(projects.dueDate, sql`${today}`));
          break;
        case 'today':
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          whereConditions.push(
            and(
              gte(projects.dueDate, sql`${today}`),
              lt(projects.dueDate, sql`${tomorrow}`)
            )!
          );
          break;
        case 'next7days':
          const next7 = new Date(today);
          next7.setDate(next7.getDate() + 7);
          whereConditions.push(
            and(
              gte(projects.dueDate, sql`${today}`),
              lte(projects.dueDate, sql`${next7}`)
            )!
          );
          break;
        case 'next14days':
          const next14 = new Date(today);
          next14.setDate(next14.getDate() + 14);
          whereConditions.push(
            and(
              gte(projects.dueDate, sql`${today}`),
              lte(projects.dueDate, sql`${next14}`)
            )!
          );
          break;
        case 'next30days':
          const next30 = new Date(today);
          next30.setDate(next30.getDate() + 30);
          whereConditions.push(
            and(
              gte(projects.dueDate, sql`${today}`),
              lte(projects.dueDate, sql`${next30}`)
            )!
          );
          break;
        case 'custom':
          if (filters.dateFrom && filters.dateTo) {
            whereConditions.push(
              and(
                gte(projects.dueDate, sql`${filters.dateFrom}`),
                lte(projects.dueDate, sql`${filters.dateTo}`)
              )!
            );
          } else if (filters.dateFrom) {
            whereConditions.push(gte(projects.dueDate, sql`${filters.dateFrom}`));
          } else if (filters.dateTo) {
            whereConditions.push(lte(projects.dueDate, sql`${filters.dateTo}`));
          }
          break;
      }
    }
    
    const whereClause = and(...whereConditions);

    const results = await db.query.projects.findMany({
      where: whereClause,
      with: {
        client: true,
        bookkeeper: true,
        clientManager: true,
        currentAssignee: true,
        projectOwner: true,
        projectType: {
          with: {
            service: true,
          },
        },
        // Load chronology without expensive fieldResponses join
        chronology: {
          orderBy: desc(projectChronology.timestamp),
          with: {
            assignee: true,
            changedBy: true,
          },
        },
      },
    });
    
    // OPTIMIZED: Use batch lookup for stage role assignees (Issue #3 fix)
    const stageRoleAssigneesMap = this.projectHelpers.resolveStageRoleAssigneesBatch
      ? await this.projectHelpers.resolveStageRoleAssigneesBatch(results)
      : new Map<string, User | undefined>();

    // Convert null relations to undefined and populate stage role assignee from batch result
    const projectsWithAssignees = results.map((project) => {
      return {
        ...project,
        currentAssignee: project.currentAssignee || undefined,
        projectOwner: project.projectOwner || undefined,
        stageRoleAssignee: stageRoleAssigneesMap.get(project.id),
        chronology: project.chronology.map(c => ({
          ...c,
          assignee: c.assignee || undefined,
          changedBy: c.changedBy || undefined,
        })),
      };
    });
    
    return projectsWithAssignees as any;
  }

  async getProjectsByClient(clientId: string, filters?: { month?: string; archived?: boolean; showArchived?: boolean; inactive?: boolean; serviceId?: string; assigneeId?: string; serviceOwnerId?: string; userId?: string; dynamicDateFilter?: string; dateFrom?: string; dateTo?: string }): Promise<ProjectWithRelations[]> {
    let whereConditions = [eq(projects.clientId, clientId)];
    
    if (filters?.month) {
      whereConditions.push(eq(projects.projectMonth, filters.month));
    }
    
    // Handle archived filtering: only apply one or the other, not both
    if (filters?.archived !== undefined) {
      whereConditions.push(eq(projects.archived, filters.archived));
    } else if (filters?.showArchived === true) {
      // When showArchived is true, show ONLY archived projects
      whereConditions.push(eq(projects.archived, true));
    } else if (filters?.showArchived === false) {
      whereConditions.push(eq(projects.archived, false));
    }
    // When showArchived is undefined, don't filter by archived status (include all)
    
    if (filters?.inactive !== undefined) {
      whereConditions.push(eq(projects.inactive, filters.inactive));
    }
    
    if (filters?.assigneeId) {
      whereConditions.push(eq(projects.currentAssigneeId, filters.assigneeId));
    }
    
    if (filters?.serviceOwnerId) {
      whereConditions.push(eq(projects.projectOwnerId, filters.serviceOwnerId));
    }
    
    if (filters?.userId) {
      whereConditions.push(eq(projects.clientManagerId, filters.userId));
    }

    // Filter by service if provided - need to join with projectTypes
    if (filters?.serviceId) {
      // Use a subquery to find project types linked to the service
      const serviceProjectTypes = await db
        .select({ id: projectTypes.id })
        .from(projectTypes)
        .where(eq(projectTypes.serviceId, filters.serviceId));
      
      const projectTypeIds = serviceProjectTypes.map(pt => pt.id);
      
      if (projectTypeIds.length > 0) {
        whereConditions.push(inArray(projects.projectTypeId, projectTypeIds));
      } else {
        // No project types found for this service, return empty result
        return [];
      }
    }
    
    // Dynamic date filtering
    if (filters?.dynamicDateFilter && filters.dynamicDateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      switch (filters.dynamicDateFilter) {
        case 'overdue':
          whereConditions.push(lt(projects.dueDate, sql`${today}`));
          break;
        case 'today':
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          whereConditions.push(
            and(
              gte(projects.dueDate, sql`${today}`),
              lt(projects.dueDate, sql`${tomorrow}`)
            )!
          );
          break;
        case 'next7days':
          const next7 = new Date(today);
          next7.setDate(next7.getDate() + 7);
          whereConditions.push(
            and(
              gte(projects.dueDate, sql`${today}`),
              lte(projects.dueDate, sql`${next7}`)
            )!
          );
          break;
        case 'next14days':
          const next14 = new Date(today);
          next14.setDate(next14.getDate() + 14);
          whereConditions.push(
            and(
              gte(projects.dueDate, sql`${today}`),
              lte(projects.dueDate, sql`${next14}`)
            )!
          );
          break;
        case 'next30days':
          const next30 = new Date(today);
          next30.setDate(next30.getDate() + 30);
          whereConditions.push(
            and(
              gte(projects.dueDate, sql`${today}`),
              lte(projects.dueDate, sql`${next30}`)
            )!
          );
          break;
        case 'custom':
          if (filters.dateFrom && filters.dateTo) {
            whereConditions.push(
              and(
                gte(projects.dueDate, sql`${filters.dateFrom}`),
                lte(projects.dueDate, sql`${filters.dateTo}`)
              )!
            );
          } else if (filters.dateFrom) {
            whereConditions.push(gte(projects.dueDate, sql`${filters.dateFrom}`));
          } else if (filters.dateTo) {
            whereConditions.push(lte(projects.dueDate, sql`${filters.dateTo}`));
          }
          break;
      }
    }
    
    const whereClause = and(...whereConditions);

    const results = await db.query.projects.findMany({
      where: whereClause,
      with: {
        client: true,
        bookkeeper: true,
        clientManager: true,
        currentAssignee: true,
        projectOwner: true,
        projectType: {
          with: {
            service: true,
          },
        },
        // Load chronology without expensive fieldResponses join
        chronology: {
          orderBy: desc(projectChronology.timestamp),
          with: {
            assignee: true,
            changedBy: true,
          },
        },
      },
    });
    
    // OPTIMIZED: Use batch lookup for stage role assignees (Issue #3 fix)
    const stageRoleAssigneesMap = this.projectHelpers.resolveStageRoleAssigneesBatch
      ? await this.projectHelpers.resolveStageRoleAssigneesBatch(results)
      : new Map<string, User | undefined>();

    // Fetch priority service indicators for all projects
    const priorityIndicatorsMap = await this.getPriorityServiceIndicatorsBatch(results);

    // Convert null relations to undefined and populate stage role assignee from batch result
    const projectsWithAssignees = results.map((project) => {
      return {
        ...project,
        currentAssignee: project.currentAssignee || undefined,
        projectOwner: project.projectOwner || undefined,
        stageRoleAssignee: stageRoleAssigneesMap.get(project.id),
        priorityServiceIndicators: priorityIndicatorsMap.get(project.id) || [],
        chronology: project.chronology.map(c => ({
          ...c,
          assignee: c.assignee || undefined,
          changedBy: c.changedBy || undefined,
        })),
      };
    });
    
    return projectsWithAssignees as any;
  }

  async getProjectsByClientServiceId(clientServiceId: string): Promise<ProjectWithRelations[]> {
    // Query projectSchedulingHistory to find all projects created for this client service
    const schedulingHistory = await db
      .select({ projectId: projectSchedulingHistory.projectId })
      .from(projectSchedulingHistory)
      .where(
        and(
          eq(projectSchedulingHistory.clientServiceId, clientServiceId),
          isNotNull(projectSchedulingHistory.projectId)
        )
      );

    // Extract unique project IDs
    const projectIds = Array.from(new Set(schedulingHistory.map(h => h.projectId).filter((id): id is string => id !== null)));

    if (projectIds.length === 0) {
      return [];
    }

    // Fetch the full project details for these project IDs
    const results = await db.query.projects.findMany({
      where: inArray(projects.id, projectIds),
      with: {
        client: true,
        bookkeeper: true,
        clientManager: true,
        currentAssignee: true,
        projectOwner: true,
        projectType: {
          with: {
            service: true,
          },
        },
        // Load chronology without expensive fieldResponses join
        chronology: {
          orderBy: desc(projectChronology.timestamp),
          with: {
            assignee: true,
            changedBy: true,
          },
        },
      },
      orderBy: [desc(projects.createdAt)],
    });

    // OPTIMIZED: Use batch lookup for stage role assignees (Issue #3 fix)
    const stageRoleAssigneesMap = this.projectHelpers.resolveStageRoleAssigneesBatch
      ? await this.projectHelpers.resolveStageRoleAssigneesBatch(results)
      : new Map<string, User | undefined>();

    // Fetch priority service indicators for all projects
    const priorityIndicatorsMap = await this.getPriorityServiceIndicatorsBatch(results);

    // Convert null relations to undefined and populate stage role assignee from batch result
    const projectsWithAssignees = results.map((project) => {
      return {
        ...project,
        currentAssignee: project.currentAssignee || undefined,
        projectOwner: project.projectOwner || undefined,
        stageRoleAssignee: stageRoleAssigneesMap.get(project.id),
        priorityServiceIndicators: priorityIndicatorsMap.get(project.id) || [],
        chronology: project.chronology.map(c => ({
          ...c,
          assignee: c.assignee || undefined,
          changedBy: c.changedBy || undefined,
        })),
      };
    });

    return projectsWithAssignees as any;
  }

  // ==================== Project Status Updates ====================

  async updateProjectStatus(update: UpdateProjectStatus, userId: string): Promise<Project> {
    const project = await this.getProject(update.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // CRITICAL FIX: Capture the old status and previous assignee before any transaction to ensure reliable scope
    const oldStatus = project.currentStatus;
    const previousAssigneeId = project.currentAssigneeId;

    // Validate the new status using the centralized validation method
    if (!this.projectHelpers.validateProjectStatus) {
      throw new Error('Helper validateProjectStatus not registered');
    }
    const validation = await this.projectHelpers.validateProjectStatus(update.newStatus);
    if (!validation.isValid) {
      throw new Error(validation.reason || "Invalid project status");
    }

    // Look up the kanban stage to get the assigned role - MUST scope by project type to avoid name collisions
    const [stage] = await db.select().from(kanbanStages).where(
      and(
        eq(kanbanStages.name, update.newStatus),
        eq(kanbanStages.projectTypeId, project.projectTypeId)
      )
    );
    if (!stage) {
      throw new Error(`Kanban stage '${update.newStatus}' not found for this project type`);
    }

    // Look up the change reason scoped to the project's project type to avoid name collisions
    const [reason] = await db.select().from(changeReasons).where(
      and(
        eq(changeReasons.reason, update.changeReason),
        eq(changeReasons.projectTypeId, project.projectTypeId)
      )
    );
    if (!reason) {
      throw new Error(`Change reason '${update.changeReason}' not found`);
    }

    // Validate that the submitted reason is mapped to the target stage
    if (!this.projectHelpers.validateStageReasonMapping) {
      throw new Error('Helper validateStageReasonMapping not registered');
    }
    const stageReasonValidation = await this.projectHelpers.validateStageReasonMapping(stage.id, reason.id);
    if (!stageReasonValidation.isValid) {
      throw new Error(stageReasonValidation.reason || "Invalid stage-reason mapping");
    }

    // Validate field responses if provided
    if (update.fieldResponses && update.fieldResponses.length > 0) {
      // Server-side field validation - load custom fields and validate against actual field configuration
      for (const fieldResponse of update.fieldResponses) {
        const [customField] = await db.select().from(reasonCustomFields).where(eq(reasonCustomFields.id, fieldResponse.customFieldId));
        if (!customField) {
          throw new Error(`Custom field with ID '${fieldResponse.customFieldId}' not found`);
        }

        // Validate that field response matches the server-side field type and constraints
        const { fieldType, options } = customField;
        
        // Check that exactly one value field is populated based on server field type
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
          
          // Additional validation for multi_select: check that all values exist in options
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

    // Validate required fields for this reason
    if (!this.projectHelpers.validateRequiredFields) {
      throw new Error('Helper validateRequiredFields not registered');
    }
    const requiredFieldsValidation = await this.projectHelpers.validateRequiredFields(reason.id, update.fieldResponses || []);
    if (!requiredFieldsValidation.isValid) {
      throw new Error(requiredFieldsValidation.reason || "Required fields validation failed");
    }

    // Determine new assignee based on the stage's assignment
    let newAssigneeId: string;
    if (stage.assignedUserId) {
      // Direct user assignment
      newAssigneeId = stage.assignedUserId;
    } else if (stage.assignedWorkRoleId) {
      // Work role assignment - get the work role name and resolve through client service role assignments
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
      // Fallback to current assignee or client manager
      newAssigneeId = project.currentAssigneeId || project.clientManagerId;
    }

    // Calculate time in previous stage
    const lastChronology = project.chronology[0];
    let timeInPreviousStage: number;
    let businessHoursInPreviousStage: number;
    
    if (lastChronology && lastChronology.timestamp) {
      // If there's a previous chronology entry, calculate from its timestamp
      timeInPreviousStage = Math.floor((Date.now() - new Date(lastChronology.timestamp).getTime()) / (1000 * 60));
      
      // Calculate business hours using the same timestamps
      try {
        const businessHours = calculateBusinessHours(
          new Date(lastChronology.timestamp).toISOString(), 
          new Date().toISOString()
        );
        // Store in minutes for precision (multiply by 60 and round)
        businessHoursInPreviousStage = Math.round(businessHours * 60);
      } catch (error) {
        console.error("Error calculating business hours:", error);
        businessHoursInPreviousStage = 0;
      }
    } else {
      // If no previous chronology entry exists, calculate from project.createdAt
      // Handle case where project.createdAt could be null
      if (project.createdAt) {
        timeInPreviousStage = Math.floor((Date.now() - new Date(project.createdAt).getTime()) / (1000 * 60));
        
        // Calculate business hours from project creation
        try {
          const businessHours = calculateBusinessHours(
            new Date(project.createdAt).toISOString(), 
            new Date().toISOString()
          );
          // Store in minutes for precision (multiply by 60 and round)
          businessHoursInPreviousStage = Math.round(businessHours * 60);
        } catch (error) {
          console.error("Error calculating business hours from project creation:", error);
          businessHoursInPreviousStage = 0;
        }
      } else {
        // Fallback to 0 minutes and 0 business hours if createdAt is null
        timeInPreviousStage = 0;
        businessHoursInPreviousStage = 0;
      }
    }

    // Use a transaction to ensure chronology and field responses are created atomically
    // Capture chronologyEntry for use outside transaction (for thread creation)
    let chronologyEntryId: string | undefined;
    
    const updatedProject = await db.transaction(async (tx) => {
      // Backfill plain text notes from HTML for backward compatibility
      let notesText = update.notes;
      if (!notesText && update.notesHtml) {
        // Strip HTML tags to create plain text version for legacy consumers
        notesText = update.notesHtml
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
          .replace(/&amp;/g, '&') // Decode HTML entities
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();
      }
      
      // Create chronology entry
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

      // Capture the chronology entry ID for thread creation
      chronologyEntryId = chronologyEntry.id;

      // Create field responses if provided
      if (update.fieldResponses && update.fieldResponses.length > 0) {
        for (const fieldResponse of update.fieldResponses) {
          // Get the custom field to obtain the server-side fieldType
          const [customField] = await tx.select().from(reasonCustomFields).where(eq(reasonCustomFields.id, fieldResponse.customFieldId));
          if (!customField) {
            throw new Error(`Custom field with ID '${fieldResponse.customFieldId}' not found`);
          }
          
          await tx.insert(reasonFieldResponses).values({
            chronologyId: chronologyEntry.id,
            customFieldId: fieldResponse.customFieldId,
            fieldType: customField.fieldType, // Use server-side fieldType
            valueNumber: fieldResponse.valueNumber,
            valueShortText: fieldResponse.valueShortText,
            valueLongText: fieldResponse.valueLongText,
            valueMultiSelect: fieldResponse.valueMultiSelect,
          });
        }
      }

      // Update project
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

    // Send stage change notifications after successful project update
    // This is done outside the transaction to avoid affecting the project update if notifications fail
    // CRITICAL FIX: Use captured oldStatus instead of project.currentStatus to avoid scope issues
    if (this.projectHelpers.sendStageChangeNotifications) {
      await this.projectHelpers.sendStageChangeNotifications(update.projectId, update.newStatus, oldStatus);
    }

    // Auto-create message thread when the assignee changes (handoff between different users)
    // Compare previous assignee with new assignee to detect actual handoffs
    if (previousAssigneeId && newAssigneeId && previousAssigneeId !== newAssigneeId && chronologyEntryId) {
      try {
        if (!this.projectHelpers.createProjectMessageThread || !this.projectHelpers.createProjectMessageParticipant || !this.projectHelpers.createProjectMessage) {
          console.warn('Message thread helpers not registered, skipping thread creation');
        } else {
          // Create unique thread topic with timestamp for each stage change
          // Include chronology ID suffix to guarantee uniqueness even for rapid consecutive changes
          const timestamp = new Date().toLocaleString('en-GB', { 
            day: '2-digit', 
            month: 'short', 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          const shortId = chronologyEntryId.substring(0, 8); // First 8 chars for readability
          const threadTopic = `${oldStatus} to ${update.newStatus} - ${timestamp} (${shortId})`;
          
          // Create the message thread (no duplicate check - create new thread every time)
          const newThread = await this.projectHelpers.createProjectMessageThread({
            projectId: update.projectId,
            topic: threadTopic,
            createdByUserId: userId,
          });
          
          // Add both the previous and new assignees as participants
          await this.projectHelpers.createProjectMessageParticipant({
            threadId: newThread.id,
            userId: previousAssigneeId,
          });
          
          await this.projectHelpers.createProjectMessageParticipant({
            threadId: newThread.id,
            userId: newAssigneeId,
          });
          
          // Also add the person who made the change as a participant if different from both assignees
          if (userId !== previousAssigneeId && userId !== newAssigneeId) {
            await this.projectHelpers.createProjectMessageParticipant({
              threadId: newThread.id,
              userId: userId,
            });
          }
          
          // Always create a message for the handoff - with notes/attachments if provided, or a default summary
          const hasCustomContent = (update.notesHtml && update.notesHtml.trim()) || (update.attachments && update.attachments.length > 0);
          
          // Transform attachments to include URL for stage-change-attachments endpoint
          // so AttachmentList can fetch them correctly (not from project-messages endpoint)
          const messageAttachments = update.attachments?.map(att => ({
            ...att,
            url: `/api/projects/${update.projectId}/stage-change-attachments${att.objectPath}`,
          }));
          
          // Build the message content - use provided notes or create a default handoff summary
          let messageContent: string;
          if (update.notesHtml && update.notesHtml.trim()) {
            messageContent = update.notesHtml.trim();
          } else if (update.attachments && update.attachments.length > 0) {
            messageContent = `<p>Stage changed from <strong>${oldStatus}</strong> to <strong>${update.newStatus}</strong></p><p>Reason: ${update.changeReason}</p><p><em>Attachments included below.</em></p>`;
          } else {
            // Default handoff message when no notes or attachments provided
            messageContent = `<p>Stage changed from <strong>${oldStatus}</strong> to <strong>${update.newStatus}</strong></p><p>Reason: ${update.changeReason}</p>`;
          }
          
          await this.projectHelpers.createProjectMessage({
            threadId: newThread.id,
            content: messageContent,
            userId: userId,
            attachments: hasCustomContent ? messageAttachments : undefined,
          });
          
          console.log(`[Storage] Created message thread "${threadTopic}" for project ${update.projectId} (handoff from ${previousAssigneeId} to ${newAssigneeId})`);
        }
      } catch (error) {
        console.error(`[Storage] Failed to create message thread for project ${update.projectId}:`, error);
        // Don't throw - thread creation failure shouldn't block the status update
      }
    }

    // Auto-cancel remaining notifications when project moves to a final stage
    // (stages that can be final stages are intended as completion points)
    if (stage.canBeFinalStage && oldStatus !== update.newStatus) {
      console.log(`[Storage] Project ${update.projectId} moved to final stage '${update.newStatus}', cancelling all remaining notifications`);
      
      try {
        if (this.projectHelpers.cancelScheduledNotificationsForProject) {
          await this.projectHelpers.cancelScheduledNotificationsForProject(update.projectId, `Project moved to final stage: ${update.newStatus}`);
        }
      } catch (error) {
        console.error(`[Storage] Failed to cancel notifications for project ${update.projectId}:`, error);
      }
    }

    return updatedProject;
  }

  // ==================== Project Analytics ====================

  async getProjectAnalytics(filters: any, groupBy: string, metric?: string): Promise<{ label: string; value: number }[]> {
    const conditions: any[] = [];
    
    // Apply service filter (projects are linked to services through projectTypes)
    if (filters.serviceFilter && filters.serviceFilter !== 'all') {
      // Get project types for the selected service
      const projectTypesForService = await db
        .select({ id: projectTypes.id })
        .from(projectTypes)
        .where(eq(projectTypes.serviceId, filters.serviceFilter));
      
      if (projectTypesForService.length > 0) {
        const projectTypeIds = projectTypesForService.map(pt => pt.id);
        conditions.push(inArray(projects.projectTypeId, projectTypeIds));
      } else {
        // No project types for this service, return empty results
        return [];
      }
    }
    
    // Apply archived filter
    if (filters.showArchived === false) {
      conditions.push(eq(projects.archived, false));
    }
    
    // Apply task assignee filter
    if (filters.taskAssigneeFilter && filters.taskAssigneeFilter !== 'all') {
      conditions.push(eq(projects.currentAssigneeId, filters.taskAssigneeFilter));
    }
    
    // Apply service owner filter
    if (filters.serviceOwnerFilter && filters.serviceOwnerFilter !== 'all') {
      conditions.push(eq(projects.projectOwnerId, filters.serviceOwnerFilter));
    }
    
    // Apply user filter
    if (filters.userFilter && filters.userFilter !== 'all') {
      conditions.push(
        or(
          eq(projects.bookkeeperId, filters.userFilter),
          eq(projects.clientManagerId, filters.userFilter),
          eq(projects.currentAssigneeId, filters.userFilter)
        )
      );
    }
    
    // Apply date filters
    if (filters.dynamicDateFilter && filters.dynamicDateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (filters.dynamicDateFilter === 'overdue') {
        conditions.push(sql`${projects.dueDate} < ${today}`);
      } else if (filters.dynamicDateFilter === 'today') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        conditions.push(sql`${projects.dueDate} >= ${today} AND ${projects.dueDate} < ${tomorrow}`);
      } else if (filters.dynamicDateFilter === 'next7days') {
        const next7 = new Date(today);
        next7.setDate(next7.getDate() + 7);
        conditions.push(sql`${projects.dueDate} >= ${today} AND ${projects.dueDate} < ${next7}`);
      } else if (filters.dynamicDateFilter === 'next14days') {
        const next14 = new Date(today);
        next14.setDate(next14.getDate() + 14);
        conditions.push(sql`${projects.dueDate} >= ${today} AND ${projects.dueDate} < ${next14}`);
      } else if (filters.dynamicDateFilter === 'next30days') {
        const next30 = new Date(today);
        next30.setDate(next30.getDate() + 30);
        conditions.push(sql`${projects.dueDate} >= ${today} AND ${projects.dueDate} < ${next30}`);
      } else if (filters.dynamicDateFilter === 'custom' && filters.customDateRange) {
        const { from, to } = filters.customDateRange;
        if (from) {
          const fromDate = new Date(from);
          conditions.push(sql`${projects.dueDate} >= ${fromDate}`);
        }
        if (to) {
          const toDate = new Date(to);
          conditions.push(sql`${projects.dueDate} <= ${toDate}`);
        }
      }
    }
    
    // Apply client filter
    if (filters.clientFilter && filters.clientFilter !== 'all') {
      conditions.push(eq(projects.clientId, filters.clientFilter));
    }
    
    // Apply project type filter
    if (filters.projectTypeFilter && filters.projectTypeFilter !== 'all') {
      conditions.push(eq(projects.projectTypeId, filters.projectTypeFilter));
    }
    
    // Group by logic
    let results: { label: string; value: number }[] = [];
    
    if (groupBy === 'projectType') {
      const grouped = await db
        .select({
          projectTypeId: projects.projectTypeId,
          count: sql<number>`cast(count(*) as integer)`,
        })
        .from(projects)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(projects.projectTypeId);
      
      // Get project type names
      const projectTypeIds = grouped.map(g => g.projectTypeId).filter(Boolean) as string[];
      if (projectTypeIds.length > 0) {
        const types = await db
          .select()
          .from(projectTypes)
          .where(inArray(projectTypes.id, projectTypeIds));
        
        const typeMap = new Map(types.map(t => [t.id, t.name]));
        
        results = grouped.map(g => ({
          label: g.projectTypeId ? (typeMap.get(g.projectTypeId) || 'Unknown') : 'Unknown',
          value: g.count,
        }));
      }
    } else if (groupBy === 'status') {
      const grouped = await db
        .select({
          status: projects.currentStatus,
          count: sql<number>`cast(count(*) as integer)`,
        })
        .from(projects)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(projects.currentStatus);
      
      // Fetch all kanban stages to get order and color information
      const allStages = await db
        .select({
          name: kanbanStages.name,
          order: kanbanStages.order,
          color: kanbanStages.color,
        })
        .from(kanbanStages)
        .orderBy(kanbanStages.order);
      
      // Create a map of stage name to order and color
      const stageOrderMap = new Map(allStages.map(s => [s.name, { order: s.order, color: s.color }]));
      
      // Map results with stage info and sort by stage order
      results = grouped.map(g => ({
        label: g.status || 'Unknown',
        value: g.count,
        order: stageOrderMap.get(g.status || '')?.order ?? 999,
        color: stageOrderMap.get(g.status || '')?.color || null,
      })).sort((a, b) => a.order - b.order);
    } else if (groupBy === 'assignee') {
      const grouped = await db
        .select({
          assigneeId: projects.currentAssigneeId,
          count: sql<number>`cast(count(*) as integer)`,
        })
        .from(projects)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(projects.currentAssigneeId);
      
      // Get user names
      const assigneeIds = grouped.map(g => g.assigneeId).filter(Boolean) as string[];
      if (assigneeIds.length > 0) {
        const assignees = await db
          .select()
          .from(users)
          .where(inArray(users.id, assigneeIds));
        
        const userMap = new Map(assignees.map(u => [u.id, `${u.firstName} ${u.lastName}`]));
        
        results = grouped.map(g => ({
          label: g.assigneeId ? (userMap.get(g.assigneeId) || 'Unknown') : 'Unassigned',
          value: g.count,
        }));
      }
    } else if (groupBy === 'serviceOwner') {
      // Group by project owner (which is the service owner)
      const grouped = await db
        .select({
          projectOwnerId: projects.projectOwnerId,
          count: sql<number>`cast(count(*) as integer)`,
        })
        .from(projects)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(projects.projectOwnerId);
      
      // Get user names for service owners
      const ownerIds = grouped.map(g => g.projectOwnerId).filter(Boolean) as string[];
      let ownerMap = new Map<string, string>();
      
      if (ownerIds.length > 0) {
        const owners = await db
          .select()
          .from(users)
          .where(inArray(users.id, ownerIds));
        
        ownerMap = new Map(owners.map(u => [u.id, `${u.firstName} ${u.lastName}`]));
      }
      
      // Always construct results from grouped, even when ownerIds is empty
      results = grouped.map(g => ({
        label: g.projectOwnerId ? (ownerMap.get(g.projectOwnerId) || 'Unknown') : 'No Owner',
        value: g.count,
      }));
    } else if (groupBy === 'daysOverdue') {
      // Calculate days overdue buckets
      const allProjects = await db
        .select({
          id: projects.id,
          dueDate: projects.dueDate,
        })
        .from(projects)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      
      const now = new Date();
      const buckets = {
        '1-9 days': 0,
        '10-31 days': 0,
        '32-60 days': 0,
        '60+ days': 0,
        'Not Overdue': 0,
      };
      
      for (const project of allProjects) {
        if (!project.dueDate) {
          buckets['Not Overdue']++;
        } else {
          const dueDate = new Date(project.dueDate);
          const diffTime = now.getTime() - dueDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            buckets['Not Overdue']++;
          } else if (diffDays >= 1 && diffDays <= 9) {
            buckets['1-9 days']++;
          } else if (diffDays >= 10 && diffDays <= 31) {
            buckets['10-31 days']++;
          } else if (diffDays >= 32 && diffDays <= 60) {
            buckets['32-60 days']++;
          } else {
            buckets['60+ days']++;
          }
        }
      }
      
      results = Object.entries(buckets).map(([label, value]) => ({
        label,
        value,
      })).filter(item => item.value > 0); // Only show non-empty buckets
    }
    
    return results;
  }

  // ==================== Bulk Operations ====================

  async sendBulkProjectAssignmentNotifications(createdProjects: Project[]): Promise<void> {
    if (!createdProjects || createdProjects.length === 0) {
      return;
    }

    // DEDUPLICATION CACHE: Check if we've already sent notifications for this batch recently
    const batchKey = createdProjects.map(p => p.id).sort().join(',');
    const now = Date.now();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    
    if (this.recentNotifications.has(batchKey)) {
      const lastSent = this.recentNotifications.get(batchKey)!;
      if (now - lastSent < CACHE_DURATION) {
        console.log('Bulk notifications already sent recently for this batch, skipping to prevent duplicates');
        return;
      }
    }
    
    // CRITICAL FIX: Group projects by ALL assignee types (not just clientManagerId)
    const assigneeProjectCounts = new Map<string, number>();
    
    for (const project of createdProjects) {
      // Include all three assignee types: bookkeeperId, clientManagerId, currentAssigneeId
      const assigneeIds = [
        project.bookkeeperId,
        project.clientManagerId,
        project.currentAssigneeId
      ].filter((id): id is string => Boolean(id)); // Remove null/undefined values
      
      for (const assigneeId of assigneeIds) {
        const currentCount = assigneeProjectCounts.get(assigneeId) || 0;
        assigneeProjectCounts.set(assigneeId, currentCount + 1);
      }
    }

    if (assigneeProjectCounts.size === 0) {
      console.log('No valid assignees found for bulk project notifications');
      return;
    }

    // PERFORMANCE FIX: Batch-load users and preferences using inArray
    const allAssigneeIds = Array.from(assigneeProjectCounts.keys());
    console.log(`Queuing bulk project notifications for ${allAssigneeIds.length} assignees (${createdProjects.length} projects total)`);
    
    // Batch load users
    const assignees = await db.select().from(users).where(inArray(users.id, allAssigneeIds));
    const assigneeMap = new Map(assignees.map(user => [user.id, user]));
    
    // Batch load notification preferences
    const existingPreferences = await db
      .select()
      .from(userNotificationPreferences)
      .where(inArray(userNotificationPreferences.userId, allAssigneeIds));
    const preferencesMap = new Map(existingPreferences.map(pref => [pref.userId, pref]));

    // Create default preferences for users who don't have them
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
      
      // Add to preferences map
      createdDefaults.forEach(pref => preferencesMap.set(pref.userId, pref));
    }

    // Send summary emails to each assignee
    const emailPromises: { promise: Promise<boolean>; userEmail: string; projectCount: number }[] = [];
    let skippedCount = 0;
    
    for (const [assigneeId, projectCount] of Array.from(assigneeProjectCounts.entries())) {
      try {
        const assignee = assigneeMap.get(assigneeId);
        if (!assignee) {
          console.warn(`Assignee with ID ${assigneeId} not found for bulk notification`);
          continue;
        }

        // EMAIL VALIDATION: Check that email exists before sending
        if (!assignee.email || assignee.email.trim() === '') {
          console.warn(`Assignee ${assignee.firstName} ${assignee.lastName} (ID: ${assigneeId}) has no email address, skipping notification`);
          continue;
        }

        // Check notification preferences
        const preferences = preferencesMap.get(assigneeId);
        if (!preferences?.notifyNewProjects) {
          console.log(`User ${assignee.email} has disabled new project notifications, skipping bulk notification`);
          skippedCount++;
          continue;
        }

        // Send bulk summary email
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

    // LOGGING FIX: Wait for all emails and report actual delivery status
    if (emailPromises.length > 0) {
      console.log(`Processing ${emailPromises.length} bulk notification emails...`);
      
      const results = await Promise.allSettled(emailPromises.map(ep => ep.promise));
      
      // Count successes and failures
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
      
      // Mark this batch as processed to prevent duplicates
      this.recentNotifications.set(batchKey, now);
      
      // Clean up old cache entries (keep only last 100 entries)
      if (this.recentNotifications.size > 100) {
        const entries = Array.from(this.recentNotifications.entries());
        entries.sort((a, b) => b[1] - a[1]); // Sort by timestamp descending
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
      // Validate CSV data format and duplicates first
      const validationResult = await this.validateCSVData(projectsData);
      if (!validationResult.isValid) {
        result.errors = validationResult.errors;
        return result;
      }

      // Use transaction for atomic monthly workflow
      const transactionResult = await db.transaction(async (tx) => {
        const createdProjects: Project[] = [];
        const archivedProjects: Project[] = [];
        const processedClients = new Set<string>();
        let alreadyExistsCount = 0;

        // Get required configuration data
        if (!this.projectHelpers.getDefaultStage) {
          throw new Error('Helper getDefaultStage not registered');
        }
        const defaultStage = await this.projectHelpers.getDefaultStage();
        if (!defaultStage) {
          throw new Error("No kanban stages found. Please create at least one stage before importing projects.");
        }

        // We'll create "Not Completed in Time" stage per project type as needed in the loop

        // Process each CSV row
        for (const data of projectsData) {
          try {
            // Find project type for this description
            if (!this.projectHelpers.getProjectTypeByName) {
              throw new Error('Helper getProjectTypeByName not registered');
            }
            const projectType = await this.projectHelpers.getProjectTypeByName(data.projectDescription);
            if (!projectType) {
              throw new Error(`Project type '${data.projectDescription}' not found. Please configure this project type in the admin area before importing.`);
            }

            // Find or create client
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

            // Determine user assignments - check if project type is service-mapped
            let finalBookkeeperId: string;
            let finalClientManagerId: string;
            let finalCurrentAssigneeId: string;
            let usedRoleBasedAssignment = false;

            if (!this.projectHelpers.getServiceByProjectTypeId) {
              throw new Error('Helper getServiceByProjectTypeId not registered');
            }
            const service = await this.projectHelpers.getServiceByProjectTypeId(projectType.id);
            
            if (service) {
              // Project type is mapped to a service - try role-based assignments
              try {
                if (!this.projectHelpers.getClientServiceByClientAndProjectType || !this.projectHelpers.resolveProjectAssignments) {
                  throw new Error('Helper methods not registered');
                }
                
                const clientService = await this.projectHelpers.getClientServiceByClientAndProjectType(client.id, projectType.id);
                
                if (clientService) {
                  // Use role-based assignment logic
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
                  // Service exists but client doesn't have service mapping - fallback to CSV user emails
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
                  // Role-based assignment failed, fallback to CSV user emails
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
                  throw error; // Re-throw other errors
                }
              }
            } else {
              // Project type is NOT mapped to a service - use CSV email assignments (existing logic)
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

            // CRITICAL: Check for existing project with same (client, description, projectMonth) triplet
            const normalizedProjectMonth = normalizeProjectMonth(data.projectMonth);
            const existingProjectForMonth = await tx.query.projects.findFirst({
              where: and(
                eq(projects.clientId, client.id),
                eq(projects.description, data.projectDescription),
                eq(projects.projectMonth, normalizedProjectMonth),
                eq(projects.archived, false)
              ),
            });

            // Skip if project already exists for this month (IDEMPOTENCY)
            if (existingProjectForMonth) {
              console.log(`Skipping duplicate project for ${data.clientName} - ${data.projectDescription} - ${normalizedProjectMonth}`);
              alreadyExistsCount++;
              processedClients.add(data.clientName);
              continue;
            }

            // Handle monthly workflow for existing projects (different months only)
            const existingProjects = await tx.query.projects.findMany({
              where: and(
                eq(projects.clientId, client.id),
                eq(projects.description, data.projectDescription),
                eq(projects.archived, false) // ARCHIVAL SAFETY: only get non-archived projects
              ),
              with: {
                chronology: {
                  orderBy: desc(projectChronology.timestamp),
                  limit: 1,
                },
              },
            });

            // Process existing active projects
            for (const existingProject of existingProjects) {
              if (existingProject.currentStatus !== "Completed") {
                // Calculate time in current stage
                const lastChronology = existingProject.chronology[0];
                const timeInPreviousStage = lastChronology && lastChronology.timestamp
                  ? Math.floor((Date.now() - new Date(lastChronology.timestamp).getTime()) / (1000 * 60))
                  : 0;

                // Create chronology entry for status change
                await tx.insert(projectChronology).values({
                  projectId: existingProject.id,
                  fromStatus: existingProject.currentStatus,
                  toStatus: "Not Completed in Time",
                  assigneeId: existingProject.currentAssigneeId || finalClientManagerId,
                  changeReason: "clarifications_needed",
                  notes: `Project moved to 'Not Completed in Time' due to new monthly cycle. Previous status: ${existingProject.currentStatus}`,
                  timeInPreviousStage,
                });

                // Update project status and archive it
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

            // Find "Not Completed in Time" stage for this project type or create it if needed
            let notCompletedStage = await tx.select().from(kanbanStages).where(and(
              eq(kanbanStages.name, "Not Completed in Time"),
              eq(kanbanStages.projectTypeId, projectType.id)
            ));
            if (notCompletedStage.length === 0) {
              // Create the stage if it doesn't exist for this project type
              const maxOrder = await tx.select({ maxOrder: sql<number>`COALESCE(MAX(${kanbanStages.order}), 0)` }).from(kanbanStages).where(eq(kanbanStages.projectTypeId, projectType.id));
              const [newStage] = await tx.insert(kanbanStages).values({
                name: "Not Completed in Time",
                projectTypeId: projectType.id,
                assignedUserId: null, // Will use fallback logic
                assignedWorkRoleId: null,
                order: (maxOrder[0]?.maxOrder || 0) + 1,
                color: "#ef4444", // Red color for overdue items
              }).returning();
              notCompletedStage = [newStage];
            }

            // Create new project for this month using resolved user assignments
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
              projectMonth: normalizedProjectMonth, // Use normalized format
              archived: false,
            }).returning();

            // Create initial chronology entry for new project
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

      // Update result with transaction outcome
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

    // Check for duplicate client names in CSV
    const clientNames = projectsData.map(data => data.clientName).filter(Boolean);
    const duplicateClients = clientNames.filter((name, index) => clientNames.indexOf(name) !== index);
    if (duplicateClients.length > 0) {
      errors.push(`Duplicate client names found in CSV: ${Array.from(new Set(duplicateClients)).join(', ')}. Each client can only appear once per upload.`);
    }

    // Validate project descriptions against configured ones
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
