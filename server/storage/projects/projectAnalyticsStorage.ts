import { db } from '../../db.js';
import {
  projects,
  projectTypes,
  kanbanStages,
  users,
} from '@shared/schema';
import { eq, and, or, inArray, sql } from 'drizzle-orm';
import type { ProjectStorageHelpers } from './types.js';

/**
 * Storage class for project analytics operations.
 * 
 * Handles:
 * - Project analytics grouped by various dimensions
 * - Filter application for analytics queries
 */
export class ProjectAnalyticsStorage {
  constructor(private projectHelpers: ProjectStorageHelpers) {}

  async getProjectAnalytics(filters: any, groupBy: string, metric?: string): Promise<{ label: string; value: number }[]> {
    const conditions: any[] = [];
    
    if (filters.serviceFilter && filters.serviceFilter !== 'all') {
      const projectTypesForService = await db
        .select({ id: projectTypes.id })
        .from(projectTypes)
        .where(eq(projectTypes.serviceId, filters.serviceFilter));
      
      if (projectTypesForService.length > 0) {
        const projectTypeIds = projectTypesForService.map(pt => pt.id);
        conditions.push(inArray(projects.projectTypeId, projectTypeIds));
      } else {
        return [];
      }
    }
    
    if (filters.showArchived === false) {
      conditions.push(eq(projects.archived, false));
    }
    
    if (filters.taskAssigneeFilter && filters.taskAssigneeFilter !== 'all') {
      conditions.push(eq(projects.currentAssigneeId, filters.taskAssigneeFilter));
    }
    
    if (filters.serviceOwnerFilter && filters.serviceOwnerFilter !== 'all') {
      conditions.push(eq(projects.projectOwnerId, filters.serviceOwnerFilter));
    }
    
    if (filters.userFilter && filters.userFilter !== 'all') {
      conditions.push(
        or(
          eq(projects.bookkeeperId, filters.userFilter),
          eq(projects.clientManagerId, filters.userFilter),
          eq(projects.currentAssigneeId, filters.userFilter)
        )
      );
    }
    
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
    
    if (filters.clientFilter && filters.clientFilter !== 'all') {
      conditions.push(eq(projects.clientId, filters.clientFilter));
    }
    
    if (filters.projectTypeFilter && filters.projectTypeFilter !== 'all') {
      conditions.push(eq(projects.projectTypeId, filters.projectTypeFilter));
    }
    
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
      
      const allStages = await db
        .select({
          name: kanbanStages.name,
          order: kanbanStages.order,
          color: kanbanStages.color,
        })
        .from(kanbanStages)
        .orderBy(kanbanStages.order);
      
      const stageOrderMap = new Map(allStages.map(s => [s.name, { order: s.order, color: s.color }]));
      
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
      const grouped = await db
        .select({
          projectOwnerId: projects.projectOwnerId,
          count: sql<number>`cast(count(*) as integer)`,
        })
        .from(projects)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(projects.projectOwnerId);
      
      const ownerIds = grouped.map(g => g.projectOwnerId).filter(Boolean) as string[];
      let ownerMap = new Map<string, string>();
      
      if (ownerIds.length > 0) {
        const owners = await db
          .select()
          .from(users)
          .where(inArray(users.id, ownerIds));
        
        ownerMap = new Map(owners.map(u => [u.id, `${u.firstName} ${u.lastName}`]));
      }
      
      results = grouped.map(g => ({
        label: g.projectOwnerId ? (ownerMap.get(g.projectOwnerId) || 'Unknown') : 'No Owner',
        value: g.count,
      }));
    } else if (groupBy === 'daysOverdue') {
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
      })).filter(item => item.value > 0);
    }
    
    return results;
  }
}
