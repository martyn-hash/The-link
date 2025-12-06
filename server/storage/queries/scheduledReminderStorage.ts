import { db } from '../../db.js';
import {
  scheduledQueryReminders,
  queryResponseTokens,
  users,
  projects,
} from '@shared/schema';
import { eq, and, sql, lte, inArray } from 'drizzle-orm';
import type {
  ScheduledQueryReminder,
  InsertScheduledQueryReminder,
  ScheduledQueryReminderWithRelations,
  ReminderStatus,
} from '@shared/schema';
import { BaseStorage } from '../base/BaseStorage.js';

export class ScheduledReminderStorage extends BaseStorage {
  async create(data: InsertScheduledQueryReminder): Promise<ScheduledQueryReminder> {
    const [result] = await db.insert(scheduledQueryReminders).values(data).returning();
    return result;
  }

  async createMany(data: InsertScheduledQueryReminder[]): Promise<ScheduledQueryReminder[]> {
    if (data.length === 0) return [];
    const results = await db.insert(scheduledQueryReminders).values(data).returning();
    return results;
  }

  async getById(id: string): Promise<ScheduledQueryReminder | undefined> {
    const [result] = await db
      .select()
      .from(scheduledQueryReminders)
      .where(eq(scheduledQueryReminders.id, id));
    return result;
  }

  async getByTokenId(tokenId: string): Promise<ScheduledQueryReminder[]> {
    return db
      .select()
      .from(scheduledQueryReminders)
      .where(eq(scheduledQueryReminders.tokenId, tokenId))
      .orderBy(scheduledQueryReminders.scheduledAt);
  }

  async getByProjectId(projectId: string): Promise<ScheduledQueryReminderWithRelations[]> {
    const results = await db
      .select({
        reminder: scheduledQueryReminders,
        token: {
          id: queryResponseTokens.id,
          token: queryResponseTokens.token,
          expiresAt: queryResponseTokens.expiresAt,
          recipientEmail: queryResponseTokens.recipientEmail,
          recipientName: queryResponseTokens.recipientName,
          queryCount: queryResponseTokens.queryCount,
        },
        cancelledBy: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(scheduledQueryReminders)
      .leftJoin(queryResponseTokens, eq(scheduledQueryReminders.tokenId, queryResponseTokens.id))
      .leftJoin(users, eq(scheduledQueryReminders.cancelledById, users.id))
      .where(eq(scheduledQueryReminders.projectId, projectId))
      .orderBy(scheduledQueryReminders.scheduledAt);

    return results.map((r) => ({
      ...r.reminder,
      token: r.token as any,
      cancelledBy: r.cancelledBy as any,
    }));
  }

  async getDueReminders(): Promise<ScheduledQueryReminderWithRelations[]> {
    const now = new Date();
    const results = await db
      .select({
        reminder: scheduledQueryReminders,
        token: {
          id: queryResponseTokens.id,
          token: queryResponseTokens.token,
          expiresAt: queryResponseTokens.expiresAt,
          recipientEmail: queryResponseTokens.recipientEmail,
          recipientName: queryResponseTokens.recipientName,
          queryCount: queryResponseTokens.queryCount,
          completedAt: queryResponseTokens.completedAt,
          queryIds: queryResponseTokens.queryIds,
        },
        project: {
          id: projects.id,
          description: projects.description,
        },
      })
      .from(scheduledQueryReminders)
      .leftJoin(queryResponseTokens, eq(scheduledQueryReminders.tokenId, queryResponseTokens.id))
      .leftJoin(projects, eq(scheduledQueryReminders.projectId, projects.id))
      .where(
        and(
          eq(scheduledQueryReminders.status, 'pending'),
          lte(scheduledQueryReminders.scheduledAt, now)
        )
      )
      .orderBy(scheduledQueryReminders.scheduledAt);

    return results.map((r) => ({
      ...r.reminder,
      token: r.token as any,
      project: r.project as any,
    }));
  }

  async updateStatus(
    id: string,
    status: ReminderStatus,
    extras?: {
      sentAt?: Date;
      errorMessage?: string;
      dialoraCallId?: string;
      queriesRemaining?: number;
    }
  ): Promise<ScheduledQueryReminder | undefined> {
    const updates: any = { status };
    if (extras?.sentAt) updates.sentAt = extras.sentAt;
    if (extras?.errorMessage) updates.errorMessage = extras.errorMessage;
    if (extras?.dialoraCallId) updates.dialoraCallId = extras.dialoraCallId;
    if (extras?.queriesRemaining !== undefined) updates.queriesRemaining = extras.queriesRemaining;

    const [result] = await db
      .update(scheduledQueryReminders)
      .set(updates)
      .where(eq(scheduledQueryReminders.id, id))
      .returning();
    return result;
  }

  async cancel(id: string, cancelledById: string): Promise<ScheduledQueryReminder | undefined> {
    const [result] = await db
      .update(scheduledQueryReminders)
      .set({
        status: 'cancelled',
        cancelledById,
        cancelledAt: new Date(),
      })
      .where(
        and(
          eq(scheduledQueryReminders.id, id),
          eq(scheduledQueryReminders.status, 'pending')
        )
      )
      .returning();
    return result;
  }

  async cancelAllForToken(tokenId: string, cancelledById: string): Promise<number> {
    const results = await db
      .update(scheduledQueryReminders)
      .set({
        status: 'cancelled',
        cancelledById,
        cancelledAt: new Date(),
      })
      .where(
        and(
          eq(scheduledQueryReminders.tokenId, tokenId),
          eq(scheduledQueryReminders.status, 'pending')
        )
      )
      .returning();
    return results.length;
  }

  async skipRemainingForToken(tokenId: string, reason: string = 'All queries answered'): Promise<number> {
    const results = await db
      .update(scheduledQueryReminders)
      .set({
        status: 'skipped',
        errorMessage: reason,
      })
      .where(
        and(
          eq(scheduledQueryReminders.tokenId, tokenId),
          eq(scheduledQueryReminders.status, 'pending')
        )
      )
      .returning();
    return results.length;
  }

  async getPendingCountForToken(tokenId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scheduledQueryReminders)
      .where(
        and(
          eq(scheduledQueryReminders.tokenId, tokenId),
          eq(scheduledQueryReminders.status, 'pending')
        )
      );
    return result?.count || 0;
  }

  async delete(id: string): Promise<boolean> {
    const results = await db
      .delete(scheduledQueryReminders)
      .where(eq(scheduledQueryReminders.id, id))
      .returning();
    return results.length > 0;
  }

  async deleteAllForToken(tokenId: string): Promise<number> {
    const results = await db
      .delete(scheduledQueryReminders)
      .where(eq(scheduledQueryReminders.tokenId, tokenId))
      .returning();
    return results.length;
  }
}

export const scheduledReminderStorage = new ScheduledReminderStorage();
