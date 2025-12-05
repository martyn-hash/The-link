import { db } from '../../db.js';
import {
  bookkeepingQueries,
  users,
  projects,
} from '@shared/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import type {
  BookkeepingQuery,
  InsertBookkeepingQuery,
  UpdateBookkeepingQuery,
  BookkeepingQueryWithRelations,
} from '@shared/schema';
import { BaseStorage } from '../base/BaseStorage.js';

export class QueryStorage extends BaseStorage {
  async createQuery(data: InsertBookkeepingQuery): Promise<BookkeepingQuery> {
    const [query] = await db.insert(bookkeepingQueries).values(data).returning();
    return query;
  }

  async createQueries(dataArray: InsertBookkeepingQuery[]): Promise<BookkeepingQuery[]> {
    if (dataArray.length === 0) return [];
    const queries = await db.insert(bookkeepingQueries).values(dataArray).returning();
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

  async getQueriesByProjectId(projectId: string): Promise<BookkeepingQueryWithRelations[]> {
    const results = await db
      .select({
        query: bookkeepingQueries,
        createdBy: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(bookkeepingQueries)
      .leftJoin(users, eq(bookkeepingQueries.createdById, users.id))
      .where(eq(bookkeepingQueries.projectId, projectId))
      .orderBy(desc(bookkeepingQueries.createdAt));

    return results.map((r) => ({
      ...r.query,
      createdBy: r.createdBy as any,
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

  async updateQuery(id: string, data: UpdateBookkeepingQuery): Promise<BookkeepingQuery> {
    const updates: any = { ...data };
    
    if (data.status === 'answered_by_staff' || data.status === 'answered_by_client') {
      if (!updates.answeredAt) {
        updates.answeredAt = new Date();
      }
    }
    
    if (data.status === 'resolved') {
      if (!updates.resolvedAt) {
        updates.resolvedAt = new Date();
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
}
