import { db } from "../../db.js";
import { 
  messageThreads,
  messages,
  users,
  clientPortalUsers,
  type MessageThread,
  type InsertMessageThread
} from "@shared/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";

export class MessageThreadStorage {
  async createMessageThread(thread: InsertMessageThread): Promise<MessageThread> {
    const [newThread] = await db
      .insert(messageThreads)
      .values(thread)
      .returning();
    return newThread;
  }

  async getMessageThreadById(id: string): Promise<MessageThread | undefined> {
    const [thread] = await db
      .select()
      .from(messageThreads)
      .where(eq(messageThreads.id, id));
    return thread;
  }

  async getMessageThreadsByClientId(clientId: string, filters?: { status?: string }): Promise<MessageThread[]> {
    const conditions = [eq(messageThreads.clientId, clientId)];
    if (filters?.status) {
      conditions.push(sql`${messageThreads.status} = ${filters.status}`);
    }
    
    return await db
      .select()
      .from(messageThreads)
      .where(and(...conditions))
      .orderBy(desc(messageThreads.lastMessageAt));
  }

  async getMessageThreadsWithUnreadCount(clientId: string, status?: string): Promise<(MessageThread & { unreadCount: number })[]> {
    const conditions = [eq(messageThreads.clientId, clientId)];
    if (status) {
      conditions.push(sql`${messageThreads.status} = ${status}`);
    }

    const result = await db
      .select({
        id: messageThreads.id,
        clientId: messageThreads.clientId,
        subject: messageThreads.subject,
        status: messageThreads.status,
        isArchived: messageThreads.isArchived,
        archivedAt: messageThreads.archivedAt,
        archivedBy: messageThreads.archivedBy,
        lastMessageAt: messageThreads.lastMessageAt,
        createdByUserId: messageThreads.createdByUserId,
        createdAt: messageThreads.createdAt,
        updatedAt: messageThreads.updatedAt,
        unreadCount: sql<number>`COALESCE(COUNT(CASE WHEN ${messages.isReadByClient} = false AND ${messages.clientPortalUserId} IS NULL THEN 1 END), 0)::int`
      })
      .from(messageThreads)
      .leftJoin(messages, eq(messageThreads.id, messages.threadId))
      .where(and(...conditions))
      .groupBy(messageThreads.id)
      .orderBy(desc(messageThreads.lastMessageAt));

    return result.map(row => ({
      ...row,
      unreadCount: row.unreadCount || 0
    })) as any;
  }

  async getAllMessageThreads(filters?: { status?: string; clientId?: string }): Promise<MessageThread[]> {
    const conditions = [];
    if (filters?.status) {
      conditions.push(sql`${messageThreads.status} = ${filters.status}`);
    }
    if (filters?.clientId) {
      conditions.push(eq(messageThreads.clientId, filters.clientId));
    }
    
    const query = db
      .select()
      .from(messageThreads)
      .orderBy(desc(messageThreads.lastMessageAt));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async getLastMessageForThread(threadId: string): Promise<{ 
    content: string; 
    senderName: string; 
    isFromStaff: boolean;
    createdAt: Date;
  } | null> {
    const result = await db
      .select({
        message: messages,
        user: users,
        clientPortalUser: clientPortalUsers,
      })
      .from(messages)
      .leftJoin(users, eq(messages.userId, users.id))
      .leftJoin(clientPortalUsers, eq(messages.clientPortalUserId, clientPortalUsers.id))
      .where(eq(messages.threadId, threadId))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    
    if (result.length === 0) return null;
    
    const row = result[0];
    const isFromStaff = !!row.message.userId;
    
    let senderName: string = 'Unknown';
    if (isFromStaff && row.user) {
      senderName = `${row.user.firstName || ''} ${row.user.lastName || ''}`.trim() || row.user.email || 'Unknown';
    } else if (!isFromStaff && row.clientPortalUser) {
      senderName = row.clientPortalUser.email || 'Unknown';
    }
    
    return {
      content: row.message.content,
      senderName: senderName!,
      isFromStaff,
      createdAt: row.message.createdAt!,
    };
  }

  async hasUnreadMessagesForStaff(threadId: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.threadId, threadId),
          eq(messages.isReadByStaff, false),
          sql`${messages.clientPortalUserId} IS NOT NULL` // Only messages from clients
        )
      );
    
    return result[0]?.count > 0;
  }

  async updateMessageThread(id: string, thread: Partial<InsertMessageThread>): Promise<MessageThread> {
    const [updated] = await db
      .update(messageThreads)
      .set({ ...thread, updatedAt: new Date() })
      .where(eq(messageThreads.id, id))
      .returning();
    return updated;
  }

  async deleteMessageThread(id: string): Promise<void> {
    await db.delete(messageThreads).where(eq(messageThreads.id, id));
  }

  async getMessageThreadsByProjectId(projectId: string): Promise<MessageThread[]> {
    return await db
      .select()
      .from(messageThreads)
      .where(eq(messageThreads.projectId, projectId))
      .orderBy(desc(messageThreads.lastMessageAt));
  }

  async autoArchiveThreadsByProjectId(projectId: string, archivedBy: string): Promise<number> {
    const result = await db
      .update(messageThreads)
      .set({ 
        isArchived: true, 
        archivedAt: new Date(),
        archivedBy,
        autoArchivedByProject: true,
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(messageThreads.projectId, projectId),
          eq(messageThreads.isArchived, false)
        )
      )
      .returning();
    return result.length;
  }

  async unarchiveAutoArchivedThreadsByProjectId(projectId: string): Promise<number> {
    const result = await db
      .update(messageThreads)
      .set({ 
        isArchived: false, 
        archivedAt: null,
        archivedBy: null,
        autoArchivedByProject: false,
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(messageThreads.projectId, projectId),
          eq(messageThreads.autoArchivedByProject, true)
        )
      )
      .returning();
    return result.length;
  }
}
