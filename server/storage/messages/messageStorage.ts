import { db } from "../../db.js";
import { 
  messages,
  messageThreads,
  users,
  clientPortalUsers,
  projects,
  type Message,
  type InsertMessage
} from "@shared/schema";
import { eq, and, sql, isNull, or } from "drizzle-orm";

export class MessageStorage {
  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values(message)
      .returning();
    
    // Update thread's lastMessageAt and lastMessageByStaff
    const lastMessageByStaff = !!message.userId; // true if message is from staff, false if from client
    await db
      .update(messageThreads)
      .set({ 
        lastMessageAt: new Date(),
        lastMessageByStaff
      })
      .where(eq(messageThreads.id, message.threadId));
    
    return newMessage;
  }

  async getMessageById(id: string): Promise<Message | undefined> {
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, id));
    return message;
  }

  async getMessagesByThreadId(threadId: string): Promise<Message[]> {
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
      .orderBy(messages.createdAt);
    
    return result.map(row => ({
      ...row.message,
      user: row.user || undefined,
      clientPortalUser: row.clientPortalUser || undefined,
    })) as Message[];
  }

  async updateMessage(id: string, message: Partial<InsertMessage>): Promise<Message> {
    const [updated] = await db
      .update(messages)
      .set({ ...message, updatedAt: new Date() })
      .where(eq(messages.id, id))
      .returning();
    return updated;
  }

  async deleteMessage(id: string): Promise<void> {
    await db.delete(messages).where(eq(messages.id, id));
  }

  async markMessagesAsReadByStaff(threadId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isReadByStaff: true })
      .where(and(
        eq(messages.threadId, threadId),
        eq(messages.isReadByStaff, false)
      ));
  }

  async markMessagesAsReadByClient(threadId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isReadByClient: true })
      .where(and(
        eq(messages.threadId, threadId),
        eq(messages.isReadByClient, false)
      ));
  }

  async getUnreadMessageCountForClient(clientId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .innerJoin(messageThreads, eq(messages.threadId, messageThreads.id))
      .where(and(
        eq(messageThreads.clientId, clientId),
        eq(messages.isReadByClient, false),
        isNull(messages.clientPortalUserId) // Messages from staff
      ));
    return result[0]?.count || 0;
  }

  async getUnreadMessageCountForStaff(userId: string, isAdmin: boolean = false): Promise<number> {
    // Count distinct threads with unread messages (not individual messages)
    // If admin, count all threads with unread messages from clients
    if (isAdmin) {
      const result = await db
        .select({ count: sql<number>`count(DISTINCT ${messages.threadId})::int` })
        .from(messages)
        .where(and(
          eq(messages.isReadByStaff, false),
          isNull(messages.userId) // Messages from clients
        ));
      return result[0]?.count || 0;
    }
    
    // For non-admin users, only count threads with unread messages from clients where the user has project assignments
    const result = await db
      .select({ count: sql<number>`count(DISTINCT ${messages.threadId})::int` })
      .from(messages)
      .innerJoin(messageThreads, eq(messages.threadId, messageThreads.id))
      .innerJoin(projects, eq(messageThreads.clientId, projects.clientId))
      .where(and(
        eq(messages.isReadByStaff, false),
        isNull(messages.userId), // Messages from clients
        or(
          eq(projects.bookkeeperId, userId),
          eq(projects.clientManagerId, userId),
          eq(projects.projectOwnerId, userId),
          eq(projects.currentAssigneeId, userId)
        )
      ));
    return result[0]?.count || 0;
  }
}
