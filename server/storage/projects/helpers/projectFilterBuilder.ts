import { projects, projectTypes } from '@shared/schema';
import { eq, and, or, gte, lte, lt, isNotNull, isNull, inArray, sql } from 'drizzle-orm';
import { db } from '../../../db.js';

/**
 * Shared filter building utilities for project queries.
 * Centralizes filtering logic used across multiple query methods.
 */

export interface ProjectFilterOptions {
  month?: string;
  archived?: boolean;
  showArchived?: boolean;
  showCompletedRegardless?: boolean;
  inactive?: boolean;
  serviceId?: string;
  assigneeId?: string;
  serviceOwnerId?: string;
  userId?: string;
  dynamicDateFilter?: string;
  dateFrom?: string;
  dateTo?: string;
  dueDate?: string;
  clientId?: string;
}

/**
 * Build status filter conditions for archived status.
 * Handles the logic of including completed projects regardless of archived status.
 */
export function buildArchivedFilter(
  filters: ProjectFilterOptions,
  excludeCompletedProjects: boolean
): any[] {
  const whereConditions: any[] = [];
  
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
  
  return whereConditions;
}

/**
 * Build inactive filter conditions.
 * Handles the logic of including completed projects regardless of inactive status.
 */
export function buildInactiveFilter(
  filters: ProjectFilterOptions,
  excludeCompletedProjects: boolean
): any[] {
  const whereConditions: any[] = [];
  
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
  
  return whereConditions;
}

/**
 * Build date range filter based on dynamic date filter option.
 */
export function buildDynamicDateFilter(
  dynamicDateFilter: string,
  dateFrom?: string,
  dateTo?: string
): any {
  if (!dynamicDateFilter || dynamicDateFilter === 'all') {
    return null;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch (dynamicDateFilter) {
    case 'overdue':
      return lt(projects.dueDate, sql`${today}`);
    case 'today': {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return and(
        gte(projects.dueDate, sql`${today}`),
        lt(projects.dueDate, sql`${tomorrow}`)
      )!;
    }
    case 'next7days': {
      const next7 = new Date(today);
      next7.setDate(next7.getDate() + 7);
      return and(
        gte(projects.dueDate, sql`${today}`),
        lte(projects.dueDate, sql`${next7}`)
      )!;
    }
    case 'next14days': {
      const next14 = new Date(today);
      next14.setDate(next14.getDate() + 14);
      return and(
        gte(projects.dueDate, sql`${today}`),
        lte(projects.dueDate, sql`${next14}`)
      )!;
    }
    case 'next30days': {
      const next30 = new Date(today);
      next30.setDate(next30.getDate() + 30);
      return and(
        gte(projects.dueDate, sql`${today}`),
        lte(projects.dueDate, sql`${next30}`)
      )!;
    }
    case 'custom':
      if (dateFrom && dateTo) {
        return and(
          gte(projects.dueDate, sql`${dateFrom}`),
          lte(projects.dueDate, sql`${dateTo}`)
        )!;
      } else if (dateFrom) {
        return gte(projects.dueDate, sql`${dateFrom}`);
      } else if (dateTo) {
        return lte(projects.dueDate, sql`${dateTo}`);
      }
      return null;
    default:
      return null;
  }
}

/**
 * Build exact due date filter.
 */
export function buildExactDueDateFilter(dueDate: string): any {
  const targetDate = new Date(dueDate);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  return and(
    gte(projects.dueDate, sql`${targetDate}`),
    lt(projects.dueDate, sql`${nextDay}`)
  )!;
}

/**
 * Get project type IDs for a given service.
 * Returns null if service has no project types.
 */
export async function getProjectTypeIdsForService(serviceId: string): Promise<string[] | null> {
  const serviceProjectTypes = await db
    .select({ id: projectTypes.id })
    .from(projectTypes)
    .where(eq(projectTypes.serviceId, serviceId));
  
  if (serviceProjectTypes.length === 0) {
    return null;
  }
  
  return serviceProjectTypes.map(pt => pt.id);
}

/**
 * Build service filter by looking up project types for the service.
 */
export function buildServiceFilter(projectTypeIds: string[]): any {
  return inArray(projects.projectTypeId, projectTypeIds);
}

/**
 * Build user assignment filters.
 */
export function buildUserFilters(filters: ProjectFilterOptions): any[] {
  const whereConditions: any[] = [];
  
  if (filters?.assigneeId) {
    whereConditions.push(eq(projects.currentAssigneeId, filters.assigneeId));
  }
  
  if (filters?.serviceOwnerId) {
    whereConditions.push(eq(projects.projectOwnerId, filters.serviceOwnerId));
  }
  
  if (filters?.userId) {
    whereConditions.push(eq(projects.clientManagerId, filters.userId));
  }
  
  return whereConditions;
}

/**
 * Build project month filter.
 */
export function buildMonthFilter(month: string): any {
  return eq(projects.projectMonth, month);
}

/**
 * Build client filter.
 */
export function buildClientFilter(clientId: string): any {
  return eq(projects.clientId, clientId);
}
