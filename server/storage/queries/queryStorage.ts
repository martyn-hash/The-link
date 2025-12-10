import { db } from '../../db.js';
import {
  bookkeepingQueries,
  users,
  projects,
  queryGroups,
} from '@shared/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import type {
  BookkeepingQuery,
  InsertBookkeepingQuery,
  UpdateBookkeepingQuery,
  BookkeepingQueryWithRelations,
} from '@shared/schema';
import { BaseStorage } from '../base/BaseStorage.js';

export interface QueryGroup {
  id: string;
  projectId: string;
  groupName: string;
  description: string | null;
  createdById: string;
  createdAt: Date | null;
}

export interface QueryGroupWithQueries extends QueryGroup {
  queries: BookkeepingQuery[];
  createdBy?: { id: string; firstName: string | null; lastName: string | null };
}

export class QueryStorage extends BaseStorage {
  async createQuery(data: InsertBookkeepingQuery): Promise<BookkeepingQuery> {
    const [query] = await db.insert(bookkeepingQueries).values(data as any).returning();
    return query;
  }

  async createQueries(dataArray: InsertBookkeepingQuery[]): Promise<BookkeepingQuery[]> {
    if (dataArray.length === 0) return [];
    const queries = await db.insert(bookkeepingQueries).values(dataArray as any).returning();
    return queries;
  }

  async getQueryById(id: string): Promise<BookkeepingQueryWithRelations | undefined> {
    const [query] = await db
      .select({
        query: bookkeepingQueries,
        createdBy: users,
      })
      .from(bookkeepingQueries)
      .leftJoin(users, eq(bookkeepingQueries.createdById, users.id))
      .where(eq(bookkeepingQueries.id, id));

    if (!query) return undefined;

    return {
      ...query.query,
      createdBy: query.createdBy || undefined,
    };
  }

  async getQueriesByProjectId(projectId: string): Promise<(BookkeepingQueryWithRelations & { group?: QueryGroup })[]> {
    const results = await db
      .select({
        query: bookkeepingQueries,
        createdBy: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
        group: queryGroups,
      })
      .from(bookkeepingQueries)
      .leftJoin(users, eq(bookkeepingQueries.createdById, users.id))
      .leftJoin(queryGroups, eq(bookkeepingQueries.groupId, queryGroups.id))
      .where(eq(bookkeepingQueries.projectId, projectId))
      .orderBy(desc(bookkeepingQueries.createdAt));

    return results.map((r) => ({
      ...r.query,
      createdBy: r.createdBy as any,
      group: r.group || undefined,
    }));
  }

  async getQueryCountByProjectId(projectId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookkeepingQueries)
      .where(eq(bookkeepingQueries.projectId, projectId));
    return result?.count || 0;
  }

  async getOpenQueryCountByProjectId(projectId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookkeepingQueries)
      .where(
        and(
          eq(bookkeepingQueries.projectId, projectId),
          inArray(bookkeepingQueries.status, ['open', 'sent_to_client'])
        )
      );
    return result?.count || 0;
  }

  async getOpenQueryCountsBatch(projectIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    
    if (projectIds.length === 0) {
      return result;
    }

    const counts = await db
      .select({
        projectId: bookkeepingQueries.projectId,
        count: sql<number>`count(*)::int`,
      })
      .from(bookkeepingQueries)
      .where(
        and(
          inArray(bookkeepingQueries.projectId, projectIds),
          inArray(bookkeepingQueries.status, ['open', 'sent_to_client'])
        )
      )
      .groupBy(bookkeepingQueries.projectId);

    for (const row of counts) {
      result.set(row.projectId, row.count);
    }

    return result;
  }

  async updateQuery(id: string, data: UpdateBookkeepingQuery, userId?: string): Promise<BookkeepingQuery> {
    const updates: any = { ...data };
    
    if (data.status === 'answered_by_staff' || data.status === 'answered_by_client') {
      if (!updates.answeredAt) {
        updates.answeredAt = new Date();
      }
      if (userId) {
        updates.answeredById = userId;
      }
    }
    
    if (data.status === 'resolved') {
      if (!updates.resolvedAt) {
        updates.resolvedAt = new Date();
      }
      if (userId) {
        updates.resolvedById = userId;
      }
    }
    
    if (data.status === 'sent_to_client') {
      if (!updates.sentToClientAt) {
        updates.sentToClientAt = new Date();
      }
    }

    const [query] = await db
      .update(bookkeepingQueries)
      .set(updates)
      .where(eq(bookkeepingQueries.id, id))
      .returning();

    if (!query) {
      throw new Error(`Query with ID '${id}' not found`);
    }

    return query;
  }

  async deleteQuery(id: string): Promise<void> {
    const result = await db
      .delete(bookkeepingQueries)
      .where(eq(bookkeepingQueries.id, id));

    if (result.rowCount === 0) {
      throw new Error(`Query with ID '${id}' not found`);
    }
  }

  async deleteQueriesByProjectId(projectId: string): Promise<number> {
    const result = await db
      .delete(bookkeepingQueries)
      .where(eq(bookkeepingQueries.projectId, projectId));
    return result.rowCount || 0;
  }

  async bulkUpdateQueryStatus(
    ids: string[],
    status: BookkeepingQuery['status'],
    updatedById: string
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const updates: any = { status };

    if (status === 'answered_by_staff' || status === 'answered_by_client') {
      updates.answeredAt = new Date();
      updates.answeredById = updatedById;
    }

    if (status === 'resolved') {
      updates.resolvedAt = new Date();
      updates.resolvedById = updatedById;
    }

    if (status === 'sent_to_client') {
      updates.sentToClientAt = new Date();
    }

    const result = await db
      .update(bookkeepingQueries)
      .set(updates)
      .where(inArray(bookkeepingQueries.id, ids));

    return result.rowCount || 0;
  }

  async markQueriesAsSentToClient(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;

    const result = await db
      .update(bookkeepingQueries)
      .set({
        status: 'sent_to_client',
        sentToClientAt: new Date(),
      })
      .where(inArray(bookkeepingQueries.id, ids));

    return result.rowCount || 0;
  }

  async getQueriesByStatus(
    projectId: string,
    status: BookkeepingQuery['status']
  ): Promise<BookkeepingQuery[]> {
    return await db
      .select()
      .from(bookkeepingQueries)
      .where(
        and(
          eq(bookkeepingQueries.projectId, projectId),
          eq(bookkeepingQueries.status, status)
        )
      )
      .orderBy(desc(bookkeepingQueries.createdAt));
  }

  async getQueryStatsByProjectId(projectId: string): Promise<{
    total: number;
    open: number;
    answeredByStaff: number;
    sentToClient: number;
    answeredByClient: number;
    resolved: number;
  }> {
    const queries = await db
      .select({ status: bookkeepingQueries.status })
      .from(bookkeepingQueries)
      .where(eq(bookkeepingQueries.projectId, projectId));

    const stats = {
      total: queries.length,
      open: 0,
      answeredByStaff: 0,
      sentToClient: 0,
      answeredByClient: 0,
      resolved: 0,
    };

    for (const q of queries) {
      switch (q.status) {
        case 'open':
          stats.open++;
          break;
        case 'answered_by_staff':
          stats.answeredByStaff++;
          break;
        case 'sent_to_client':
          stats.sentToClient++;
          break;
        case 'answered_by_client':
          stats.answeredByClient++;
          break;
        case 'resolved':
          stats.resolved++;
          break;
      }
    }

    return stats;
  }

  // Query Group methods
  async createQueryGroup(data: {
    projectId: string;
    groupName: string;
    description?: string;
    createdById: string;
  }): Promise<QueryGroup> {
    const [group] = await db.insert(queryGroups).values(data as any).returning();
    return group;
  }

  async getQueryGroupById(id: string): Promise<QueryGroupWithQueries | undefined> {
    const [group] = await db
      .select({
        group: queryGroups,
        createdBy: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(queryGroups)
      .leftJoin(users, eq(queryGroups.createdById, users.id))
      .where(eq(queryGroups.id, id));

    if (!group) return undefined;

    const queries = await db
      .select()
      .from(bookkeepingQueries)
      .where(eq(bookkeepingQueries.groupId, id))
      .orderBy(desc(bookkeepingQueries.date));

    return {
      ...group.group,
      queries,
      createdBy: group.createdBy || undefined,
    };
  }

  async getQueryGroupsByProjectId(projectId: string): Promise<QueryGroupWithQueries[]> {
    const groups = await db
      .select({
        group: queryGroups,
        createdBy: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(queryGroups)
      .leftJoin(users, eq(queryGroups.createdById, users.id))
      .where(eq(queryGroups.projectId, projectId))
      .orderBy(desc(queryGroups.createdAt));

    const result: QueryGroupWithQueries[] = [];
    
    for (const g of groups) {
      const queries = await db
        .select()
        .from(bookkeepingQueries)
        .where(eq(bookkeepingQueries.groupId, g.group.id))
        .orderBy(desc(bookkeepingQueries.date));

      result.push({
        ...g.group,
        queries,
        createdBy: g.createdBy || undefined,
      });
    }

    return result;
  }

  async updateQueryGroup(id: string, data: {
    groupName?: string;
    description?: string;
  }): Promise<QueryGroup | undefined> {
    const [updated] = await db
      .update(queryGroups)
      .set(data)
      .where(eq(queryGroups.id, id))
      .returning();
    return updated;
  }

  async deleteQueryGroup(id: string): Promise<boolean> {
    const result = await db.delete(queryGroups).where(eq(queryGroups.id, id));
    return (result.rowCount || 0) > 0;
  }

  async assignQueriesToGroup(queryIds: string[], groupId: string): Promise<number> {
    if (queryIds.length === 0) return 0;

    const result = await db
      .update(bookkeepingQueries)
      .set({ groupId })
      .where(inArray(bookkeepingQueries.id, queryIds));

    return result.rowCount || 0;
  }

  async removeQueriesFromGroup(queryIds: string[]): Promise<number> {
    if (queryIds.length === 0) return 0;

    const result = await db
      .update(bookkeepingQueries)
      .set({ groupId: null })
      .where(inArray(bookkeepingQueries.id, queryIds));

    return result.rowCount || 0;
  }

  async getQueriesWithGroups(projectId: string): Promise<(BookkeepingQueryWithRelations & { group?: QueryGroup })[]> {
    const results = await db
      .select({
        query: bookkeepingQueries,
        createdBy: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
        group: queryGroups,
      })
      .from(bookkeepingQueries)
      .leftJoin(users, eq(bookkeepingQueries.createdById, users.id))
      .leftJoin(queryGroups, eq(bookkeepingQueries.groupId, queryGroups.id))
      .where(eq(bookkeepingQueries.projectId, projectId))
      .orderBy(desc(bookkeepingQueries.createdAt));

    return results.map((r) => ({
      ...r.query,
      createdBy: r.createdBy as any,
      group: r.group || undefined,
    }));
  }
}
