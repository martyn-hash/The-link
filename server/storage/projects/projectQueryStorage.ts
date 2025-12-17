import { db } from '../../db.js';
import {
  projects,
  projectChronology,
  projectSchedulingHistory,
  projectTypes,
  services,
  servicePriorityIndicators,
} from '@shared/schema';
import { eq, and, or, desc, gte, lte, lt, isNotNull, isNull, inArray, sql } from 'drizzle-orm';
import type {
  ProjectWithRelations,
  User,
} from '@shared/schema';
import type { ProjectStorageHelpers, ProjectQueryFilters } from './types.js';

/**
 * Storage class for complex project query operations.
 * 
 * Handles:
 * - Complex filtered project queries
 * - User-based project queries
 * - Client-based project queries
 * - Client service-based project queries
 * - Priority service indicators batch lookup
 */
export class ProjectQueryStorage {
  constructor(private projectHelpers: ProjectStorageHelpers) {}

  async getAllProjects(filters?: ProjectQueryFilters): Promise<ProjectWithRelations[]> {
    let whereConditions = [];
    
    if (filters?.month) {
      whereConditions.push(eq(projects.projectMonth, filters.month));
    }
    
    const excludeCompletedProjects = filters?.showCompletedRegardless === false;
    
    if (filters?.archived !== undefined) {
      if (!excludeCompletedProjects) {
        whereConditions.push(
          or(
            eq(projects.archived, filters.archived),
            isNotNull(projects.completionStatus)
          )!
        );
      } else {
        whereConditions.push(eq(projects.archived, filters.archived));
      }
    } else if (filters?.showArchived !== true) {
      if (!excludeCompletedProjects) {
        whereConditions.push(
          or(
            eq(projects.archived, false),
            isNotNull(projects.completionStatus)
          )!
        );
      } else {
        whereConditions.push(eq(projects.archived, false));
      }
    }
    
    if (filters?.inactive !== undefined) {
      if (!excludeCompletedProjects) {
        whereConditions.push(
          or(
            eq(projects.inactive, filters.inactive),
            isNotNull(projects.completionStatus)
          )!
        );
      } else {
        whereConditions.push(eq(projects.inactive, filters.inactive));
      }
    } else {
      if (!excludeCompletedProjects) {
        whereConditions.push(
          or(
            eq(projects.inactive, false),
            isNotNull(projects.completionStatus)
          )!
        );
      } else {
        whereConditions.push(eq(projects.inactive, false));
      }
    }
    
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

    if (filters?.serviceId) {
      const serviceProjectTypes = await db
        .select({ id: projectTypes.id })
        .from(projectTypes)
        .where(eq(projectTypes.serviceId, filters.serviceId));
      
      const projectTypeIds = serviceProjectTypes.map(pt => pt.id);
      
      if (projectTypeIds.length > 0) {
        whereConditions.push(inArray(projects.projectTypeId, projectTypeIds));
      } else {
        return [];
      }
    }
    
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
        chronology: {
          orderBy: desc(projectChronology.timestamp),
          with: {
            assignee: true,
            changedBy: true,
          },
        },
      },
    });
    
    const stageRoleAssigneesMap = this.projectHelpers.resolveStageRoleAssigneesBatch
      ? await this.projectHelpers.resolveStageRoleAssigneesBatch(results)
      : new Map<string, User | undefined>();

    const priorityIndicatorsMap = await this.getPriorityServiceIndicatorsBatch(results);

    const projectsWithAssignees = results.map((project: any) => {
      return {
        ...project,
        currentAssignee: project.currentAssignee || undefined,
        projectOwner: project.projectOwner || undefined,
        stageRoleAssignee: stageRoleAssigneesMap.get(project.id),
        priorityServiceIndicators: priorityIndicatorsMap.get(project.id) || [],
        chronology: project.chronology.map((c: any) => ({
          ...c,
          assignee: c.assignee || undefined,
          changedBy: c.changedBy || undefined,
        })),
      };
    });
    
    return projectsWithAssignees as any;
  }

  private async getPriorityServiceIndicatorsBatch(projectList: any[]): Promise<Map<string, { name: string; count: number; dueDate?: Date | string | null }[]>> {
    const priorityMap = new Map<string, { name: string; count: number; dueDate?: Date | string | null }[]>();
    
    if (projectList.length === 0) {
      return priorityMap;
    }

    try {
      const indicatorMappings = await db
        .select({
          indicatorServiceId: servicePriorityIndicators.indicatorServiceId,
          targetServiceId: servicePriorityIndicators.targetServiceId,
          indicatorServiceName: services.name,
        })
        .from(servicePriorityIndicators)
        .innerJoin(services, eq(servicePriorityIndicators.indicatorServiceId, services.id));

      if (indicatorMappings.length === 0) {
        return priorityMap;
      }

      const targetToIndicators = new Map<string, Array<{ id: string; name: string }>>();
      for (const mapping of indicatorMappings) {
        const existing = targetToIndicators.get(mapping.targetServiceId) || [];
        existing.push({ id: mapping.indicatorServiceId, name: mapping.indicatorServiceName });
        targetToIndicators.set(mapping.targetServiceId, existing);
      }
      
      const indicatorServiceIds = Array.from(new Set(indicatorMappings.map(m => m.indicatorServiceId)));

      const clientIds = Array.from(new Set(projectList.map(p => p.clientId)));

      const aggregatedProjectData = await db
        .select({
          clientId: projects.clientId,
          serviceId: projectTypes.serviceId,
          projectCount: sql<number>`count(*)::int`.as('project_count'),
          minDueDate: sql<Date | null>`min(${projects.dueDate})`.as('min_due_date'),
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
        )
        .groupBy(projects.clientId, projectTypes.serviceId);

      const clientServiceData = new Map<string, { count: number; dueDate: Date | null }>();
      for (const row of aggregatedProjectData) {
        if (row.serviceId) {
          clientServiceData.set(`${row.clientId}:${row.serviceId}`, {
            count: row.projectCount,
            dueDate: row.minDueDate,
          });
        }
      }

      for (const proj of projectList) {
        const projectServiceId = proj.projectType?.serviceId;
        if (!projectServiceId) continue;

        const indicatorsForThisService = targetToIndicators.get(projectServiceId);
        if (!indicatorsForThisService) continue;

        const indicators: { name: string; count: number; dueDate?: Date | string | null }[] = [];
        for (const indicator of indicatorsForThisService) {
          const data = clientServiceData.get(`${proj.clientId}:${indicator.id}`);
          if (data && data.count > 0) {
            indicators.push({
              name: indicator.name,
              count: data.count,
              dueDate: data.count === 1 ? data.dueDate : undefined,
            });
          }
        }

        if (indicators.length > 0) {
          priorityMap.set(proj.id, indicators);
        }
      }
    } catch (error) {
      console.error('Error fetching priority service indicators:', error);
    }

    return priorityMap;
  }

  async getProjectsByUser(userId: string, role: string, filters?: ProjectQueryFilters): Promise<ProjectWithRelations[]> {
    let userWhereCondition;
    
    switch (role) {
      case "admin":
      case "manager":
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

    let whereConditions = [userWhereCondition];
    
    if (filters?.month) {
      whereConditions.push(eq(projects.projectMonth, filters.month));
    }
    
    if (filters?.archived !== undefined) {
      whereConditions.push(
        or(
          eq(projects.archived, filters.archived),
          isNotNull(projects.completionStatus)
        )!
      );
    } else if (filters?.showArchived !== true) {
      whereConditions.push(
        or(
          eq(projects.archived, false),
          isNotNull(projects.completionStatus)
        )!
      );
    }
    
    if (filters?.inactive !== undefined) {
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

    if (filters?.serviceId) {
      const serviceProjectTypes = await db
        .select({ id: projectTypes.id })
        .from(projectTypes)
        .where(eq(projectTypes.serviceId, filters.serviceId));
      
      const projectTypeIds = serviceProjectTypes.map(pt => pt.id);
      
      if (projectTypeIds.length > 0) {
        whereConditions.push(inArray(projects.projectTypeId, projectTypeIds));
      } else {
        return [];
      }
    }
    
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
        chronology: {
          orderBy: desc(projectChronology.timestamp),
          with: {
            assignee: true,
            changedBy: true,
          },
        },
      },
    });
    
    const stageRoleAssigneesMap = this.projectHelpers.resolveStageRoleAssigneesBatch
      ? await this.projectHelpers.resolveStageRoleAssigneesBatch(results)
      : new Map<string, User | undefined>();

    const projectsWithAssignees = results.map((project: any) => {
      return {
        ...project,
        currentAssignee: project.currentAssignee || undefined,
        projectOwner: project.projectOwner || undefined,
        stageRoleAssignee: stageRoleAssigneesMap.get(project.id),
        chronology: project.chronology.map((c: any) => ({
          ...c,
          assignee: c.assignee || undefined,
          changedBy: c.changedBy || undefined,
        })),
      };
    });
    
    return projectsWithAssignees as any;
  }

  async getProjectsByClient(clientId: string, filters?: ProjectQueryFilters): Promise<ProjectWithRelations[]> {
    let whereConditions = [eq(projects.clientId, clientId)];
    
    if (filters?.month) {
      whereConditions.push(eq(projects.projectMonth, filters.month));
    }
    
    if (filters?.archived !== undefined) {
      whereConditions.push(eq(projects.archived, filters.archived));
    } else if (filters?.showArchived === true) {
      whereConditions.push(eq(projects.archived, true));
    } else if (filters?.showArchived === false) {
      whereConditions.push(eq(projects.archived, false));
    }
    
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

    if (filters?.serviceId) {
      const serviceProjectTypes = await db
        .select({ id: projectTypes.id })
        .from(projectTypes)
        .where(eq(projectTypes.serviceId, filters.serviceId));
      
      const projectTypeIds = serviceProjectTypes.map(pt => pt.id);
      
      if (projectTypeIds.length > 0) {
        whereConditions.push(inArray(projects.projectTypeId, projectTypeIds));
      } else {
        return [];
      }
    }
    
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
        chronology: {
          orderBy: desc(projectChronology.timestamp),
          with: {
            assignee: true,
            changedBy: true,
          },
        },
        stageApprovalResponses: {
          with: {
            field: {
              with: {
                stageApproval: true,
              },
            },
          },
        },
      },
    });
    
    const stageRoleAssigneesMap = this.projectHelpers.resolveStageRoleAssigneesBatch
      ? await this.projectHelpers.resolveStageRoleAssigneesBatch(results)
      : new Map<string, User | undefined>();

    const priorityIndicatorsMap = await this.getPriorityServiceIndicatorsBatch(results);

    const projectsWithAssignees = results.map((project: any) => {
      return {
        ...project,
        currentAssignee: project.currentAssignee || undefined,
        projectOwner: project.projectOwner || undefined,
        stageRoleAssignee: stageRoleAssigneesMap.get(project.id),
        priorityServiceIndicators: priorityIndicatorsMap.get(project.id) || [],
        chronology: project.chronology.map((c: any) => ({
          ...c,
          assignee: c.assignee || undefined,
          changedBy: c.changedBy || undefined,
        })),
        stageApprovalResponses: project.stageApprovalResponses || [],
      };
    });
    
    return projectsWithAssignees as any;
  }

  async getProjectsByClientServiceId(clientServiceId: string): Promise<ProjectWithRelations[]> {
    const schedulingHistory = await db
      .select({ projectId: projectSchedulingHistory.projectId })
      .from(projectSchedulingHistory)
      .where(
        and(
          eq(projectSchedulingHistory.clientServiceId, clientServiceId),
          isNotNull(projectSchedulingHistory.projectId)
        )
      );

    const projectIds = Array.from(new Set(schedulingHistory.map(h => h.projectId).filter((id): id is string => id !== null)));

    if (projectIds.length === 0) {
      return [];
    }

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

    const stageRoleAssigneesMap = this.projectHelpers.resolveStageRoleAssigneesBatch
      ? await this.projectHelpers.resolveStageRoleAssigneesBatch(results)
      : new Map<string, User | undefined>();

    const priorityIndicatorsMap = await this.getPriorityServiceIndicatorsBatch(results);

    const projectsWithAssignees = results.map((project: any) => {
      return {
        ...project,
        currentAssignee: project.currentAssignee || undefined,
        projectOwner: project.projectOwner || undefined,
        stageRoleAssignee: stageRoleAssigneesMap.get(project.id),
        priorityServiceIndicators: priorityIndicatorsMap.get(project.id) || [],
        chronology: project.chronology.map((c: any) => ({
          ...c,
          assignee: c.assignee || undefined,
          changedBy: c.changedBy || undefined,
        })),
      };
    });

    return projectsWithAssignees as any;
  }
}
