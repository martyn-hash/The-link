import { db } from '../../db.js';
import {
  bookkeepingQueries,
  users,
  projects,
  queryGroups,
  queryAnswerHistory,
} from '@shared/schema';
import { eq, and, desc, inArray, sql, like, or, ne } from 'drizzle-orm';
import type {
  BookkeepingQuery,
  InsertBookkeepingQuery,
  UpdateBookkeepingQuery,
  BookkeepingQueryWithRelations,
  QuerySuggestion,
  AnsweredByType,
  QueryAnswerHistory,
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

  async getQueryById(id: string): Promise<(BookkeepingQueryWithRelations & { group?: QueryGroup }) | undefined> {
    const [query] = await db
      .select({
        query: bookkeepingQueries,
        createdBy: users,
        group: queryGroups,
      })
      .from(bookkeepingQueries)
      .leftJoin(users, eq(bookkeepingQueries.createdById, users.id))
      .leftJoin(queryGroups, eq(bookkeepingQueries.groupId, queryGroups.id))
      .where(eq(bookkeepingQueries.id, id));

    if (!query) return undefined;

    return {
      ...query.query,
      createdBy: query.createdBy || undefined,
      group: query.group || undefined,
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

  // ============================================
  // Query Answer History (Auto-Suggest Feature)
  // ============================================

  private normalizeDescription(description: string): string {
    return description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async recordQueryAnswer(data: {
    clientId: string;
    projectId: string;
    description: string;
    moneyDirection: 'in' | 'out' | null;
    answerText: string;
    answeredByType: AnsweredByType;
    answeredById?: string;
    answeredAt: Date;
    sourceQueryId: string;
    prefixLength?: number;
  }): Promise<QueryAnswerHistory> {
    const normalizedDesc = this.normalizeDescription(data.description);
    const prefixLength = data.prefixLength || 10;
    const descriptionPrefix = normalizedDesc.substring(0, prefixLength);

    const [record] = await db.insert(queryAnswerHistory).values({
      clientId: data.clientId,
      projectId: data.projectId,
      descriptionPrefix,
      moneyDirection: data.moneyDirection,
      answerText: data.answerText,
      answeredByType: data.answeredByType,
      answeredById: data.answeredById,
      answeredAt: data.answeredAt,
      sourceQueryId: data.sourceQueryId,
    }).returning();

    return record;
  }

  async getSuggestionsForQuery(params: {
    queryId: string;
    clientId: string;
    description: string;
    moneyDirection: 'in' | 'out' | null;
    prefixLength?: number;
    limit?: number;
  }): Promise<QuerySuggestion[]> {
    const { queryId, clientId, description, moneyDirection, prefixLength = 10, limit = 5 } = params;
    
    const normalizedDesc = this.normalizeDescription(description);
    const descriptionPrefix = normalizedDesc.substring(0, prefixLength);

    if (!descriptionPrefix || descriptionPrefix.length < 3) {
      return [];
    }

    // Find matching answer history entries - SECURITY: filter by clientId to ensure tenant isolation
    const results = await db
      .select({
        history: queryAnswerHistory,
        sourceQuery: {
          id: bookkeepingQueries.id,
          description: bookkeepingQueries.description,
        },
      })
      .from(queryAnswerHistory)
      .leftJoin(bookkeepingQueries, eq(queryAnswerHistory.sourceQueryId, bookkeepingQueries.id))
      .where(
        and(
          eq(queryAnswerHistory.clientId, clientId),
          like(queryAnswerHistory.descriptionPrefix, `${descriptionPrefix}%`),
          ne(queryAnswerHistory.sourceQueryId, queryId)
        )
      )
      .orderBy(desc(queryAnswerHistory.answeredAt))
      .limit(limit * 2);

    // Score and filter results
    const suggestions: QuerySuggestion[] = results.map((r) => {
      const isFromSameClient = r.history.clientId === clientId;
      const moneyMatch = !moneyDirection || !r.history.moneyDirection || 
        r.history.moneyDirection === moneyDirection;
      
      // Calculate match score
      let matchScore = 0;
      if (isFromSameClient) matchScore += 50;
      if (moneyMatch) matchScore += 20;
      
      // Prefix match length bonus
      const historyPrefix = r.history.descriptionPrefix;
      const commonLength = this.getCommonPrefixLength(descriptionPrefix, historyPrefix);
      matchScore += commonLength * 3;

      // Recency bonus (answers from last 90 days get bonus)
      const daysSinceAnswer = (Date.now() - new Date(r.history.answeredAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceAnswer < 90) {
        matchScore += Math.max(0, 10 - Math.floor(daysSinceAnswer / 10));
      }

      return {
        id: r.history.id,
        answerText: r.history.answerText,
        answeredByType: r.history.answeredByType as AnsweredByType,
        answeredAt: new Date(r.history.answeredAt),
        sourceQueryId: r.history.sourceQueryId,
        sourceQueryDescription: r.sourceQuery?.description || undefined,
        matchScore,
        isFromSameClient,
      };
    });

    // Sort by score and return top results
    return suggestions
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }

  private getCommonPrefixLength(a: string, b: string): number {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) {
      i++;
    }
    return i;
  }

  async getQueryWithClient(queryId: string): Promise<{ query: BookkeepingQuery; clientId: string; projectId: string } | null> {
    const [result] = await db
      .select({
        query: bookkeepingQueries,
        clientId: projects.clientId,
        projectId: projects.id,
      })
      .from(bookkeepingQueries)
      .innerJoin(projects, eq(bookkeepingQueries.projectId, projects.id))
      .where(eq(bookkeepingQueries.id, queryId));

    if (!result) return null;

    return {
      query: result.query,
      clientId: result.clientId,
      projectId: result.projectId,
    };
  }

  async hasSuggestionsForQueries(queryIds: string[], prefixLength = 10): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();
    
    if (queryIds.length === 0) return result;

    // Get queries with their descriptions
    const queries = await db
      .select({
        id: bookkeepingQueries.id,
        description: bookkeepingQueries.description,
        clientId: projects.clientId,
      })
      .from(bookkeepingQueries)
      .innerJoin(projects, eq(bookkeepingQueries.projectId, projects.id))
      .where(inArray(bookkeepingQueries.id, queryIds));

    // Check each query for suggestions
    for (const query of queries) {
      if (!query.description) {
        result.set(query.id, false);
        continue;
      }

      const normalizedDesc = this.normalizeDescription(query.description);
      const descriptionPrefix = normalizedDesc.substring(0, prefixLength);

      if (descriptionPrefix.length < 3) {
        result.set(query.id, false);
        continue;
      }

      // Check if there are matching answers
      const [match] = await db
        .select({ id: queryAnswerHistory.id })
        .from(queryAnswerHistory)
        .where(
          and(
            like(queryAnswerHistory.descriptionPrefix, `${descriptionPrefix}%`),
            ne(queryAnswerHistory.sourceQueryId, query.id)
          )
        )
        .limit(1);

      result.set(query.id, !!match);
    }

    return result;
  }
}
