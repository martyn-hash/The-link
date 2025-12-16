import { db } from '../../db.js';
import {
  queryResponseTokens,
  bookkeepingQueries,
  queryGroups,
  users,
  projects,
} from '@shared/schema';
import { eq, and, inArray, sql, lt } from 'drizzle-orm';
import type {
  QueryResponseToken,
  InsertQueryResponseToken,
  QueryResponseTokenWithRelations,
  BookkeepingQuery,
} from '@shared/schema';
import { BaseStorage } from '../base/BaseStorage.js';
import crypto from 'crypto';

export class QueryTokenStorage extends BaseStorage {
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async createToken(data: Omit<InsertQueryResponseToken, 'token'>): Promise<QueryResponseToken> {
    const token = this.generateSecureToken();
    const [result] = await db.insert(queryResponseTokens).values({
      ...data,
      token,
    }).returning();
    return result;
  }

  async getTokenByValue(token: string): Promise<QueryResponseTokenWithRelations | undefined> {
    const [result] = await db
      .select({
        token: queryResponseTokens,
        createdBy: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
        project: {
          id: projects.id,
          description: projects.description,
        },
      })
      .from(queryResponseTokens)
      .leftJoin(users, eq(queryResponseTokens.createdById, users.id))
      .leftJoin(projects, eq(queryResponseTokens.projectId, projects.id))
      .where(eq(queryResponseTokens.token, token));

    if (!result) return undefined;

    return {
      ...result.token,
      createdBy: result.createdBy as any,
      project: result.project as any,
    };
  }

  async getTokenById(id: string): Promise<QueryResponseToken | undefined> {
    const [token] = await db
      .select()
      .from(queryResponseTokens)
      .where(eq(queryResponseTokens.id, id));
    return token;
  }

  async getTokensByProjectId(projectId: string): Promise<QueryResponseToken[]> {
    return db
      .select()
      .from(queryResponseTokens)
      .where(eq(queryResponseTokens.projectId, projectId))
      .orderBy(sql`${queryResponseTokens.createdAt} DESC`);
  }

  async markTokenAccessed(tokenId: string): Promise<{ isFirstAccess: boolean }> {
    const result = await db
      .update(queryResponseTokens)
      .set({ accessedAt: new Date() })
      .where(
        and(
          eq(queryResponseTokens.id, tokenId),
          sql`${queryResponseTokens.accessedAt} IS NULL`
        )
      )
      .returning({ id: queryResponseTokens.id });
    
    // If a row was returned, this was the first access (the update matched the IS NULL condition)
    return { isFirstAccess: result.length > 0 };
  }

  async markTokenCompleted(tokenId: string): Promise<void> {
    await db
      .update(queryResponseTokens)
      .set({ completedAt: new Date() })
      .where(eq(queryResponseTokens.id, tokenId));
  }

  async markOpenNotificationSent(tokenId: string): Promise<{ wasAlreadySent: boolean }> {
    const result = await db
      .update(queryResponseTokens)
      .set({ openNotificationSentAt: new Date() })
      .where(
        and(
          eq(queryResponseTokens.id, tokenId),
          sql`${queryResponseTokens.openNotificationSentAt} IS NULL`
        )
      )
      .returning({ id: queryResponseTokens.id });
    
    return { wasAlreadySent: result.length === 0 };
  }

  async markSubmitNotificationSent(tokenId: string): Promise<{ wasAlreadySent: boolean }> {
    const result = await db
      .update(queryResponseTokens)
      .set({ submitNotificationSentAt: new Date() })
      .where(
        and(
          eq(queryResponseTokens.id, tokenId),
          sql`${queryResponseTokens.submitNotificationSentAt} IS NULL`
        )
      )
      .returning({ id: queryResponseTokens.id });
    
    return { wasAlreadySent: result.length === 0 };
  }

  async updateToken(tokenId: string, updates: { recipientEmail?: string; recipientName?: string | null }): Promise<QueryResponseToken | undefined> {
    const [result] = await db
      .update(queryResponseTokens)
      .set(updates)
      .where(eq(queryResponseTokens.id, tokenId))
      .returning();
    return result;
  }

  async extendTokenExpiry(tokenId: string, additionalDays: number): Promise<QueryResponseToken | undefined> {
    const token = await this.getTokenById(tokenId);
    if (!token) return undefined;

    // Extend from current expiry or from now if already expired
    const baseDate = token.expiresAt > new Date() ? token.expiresAt : new Date();
    const newExpiresAt = new Date(baseDate);
    newExpiresAt.setDate(newExpiresAt.getDate() + additionalDays);

    const [result] = await db
      .update(queryResponseTokens)
      .set({ expiresAt: newExpiresAt })
      .where(eq(queryResponseTokens.id, tokenId))
      .returning();
    return result;
  }

  async getActiveTokensByProjectId(projectId: string): Promise<QueryResponseTokenWithRelations[]> {
    const results = await db
      .select({
        token: queryResponseTokens,
        createdBy: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
        project: {
          id: projects.id,
          description: projects.description,
        },
      })
      .from(queryResponseTokens)
      .leftJoin(users, eq(queryResponseTokens.createdById, users.id))
      .leftJoin(projects, eq(queryResponseTokens.projectId, projects.id))
      .where(
        and(
          eq(queryResponseTokens.projectId, projectId),
          sql`${queryResponseTokens.completedAt} IS NULL`
        )
      )
      .orderBy(sql`${queryResponseTokens.createdAt} DESC`);

    return results.map(r => ({
      ...r.token,
      createdBy: r.createdBy as any,
      project: r.project as any,
    }));
  }

  async validateToken(token: string): Promise<{ valid: boolean; reason?: string; tokenData?: QueryResponseTokenWithRelations }> {
    const tokenData = await this.getTokenByValue(token);

    if (!tokenData) {
      return { valid: false, reason: 'Token not found' };
    }

    if (tokenData.expiresAt < new Date()) {
      // Return tokenData even when expired so we can show expiry info to users
      return { valid: false, reason: 'Token has expired', tokenData };
    }

    if (tokenData.completedAt) {
      return { valid: false, reason: 'Responses already submitted', tokenData };
    }

    return { valid: true, tokenData };
  }

  async getQueriesForToken(token: string): Promise<(BookkeepingQuery & { group?: { id: string; groupName: string; description: string | null } })[]> {
    const tokenData = await this.getTokenByValue(token);
    if (!tokenData || !tokenData.queryIds || tokenData.queryIds.length === 0) {
      return [];
    }

    const results = await db
      .select({
        query: bookkeepingQueries,
        group: {
          id: queryGroups.id,
          groupName: queryGroups.groupName,
          description: queryGroups.description,
        },
      })
      .from(bookkeepingQueries)
      .leftJoin(queryGroups, eq(bookkeepingQueries.groupId, queryGroups.id))
      .where(inArray(bookkeepingQueries.id, tokenData.queryIds));

    return results.map(r => ({
      ...r.query,
      group: r.group?.id ? r.group : undefined,
    }));
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await db
      .delete(queryResponseTokens)
      .where(lt(queryResponseTokens.expiresAt, new Date()))
      .returning();
    return result.length;
  }
}

export const queryTokenStorage = new QueryTokenStorage();
