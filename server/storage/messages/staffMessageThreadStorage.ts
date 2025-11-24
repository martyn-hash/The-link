import { db } from "../../db.js";
import { 
  staffMessageThreads,
  staffMessageParticipants,
  staffMessages,
  users,
  type StaffMessageThread,
  type InsertStaffMessageThread
} from "../../../shared/schema.js";
import { eq, and, desc, sql, inArray, ne } from "drizzle-orm";

export class StaffMessageThreadStorage {
  async createStaffMessageThread(thread: InsertStaffMessageThread): Promise<StaffMessageThread> {
    const [newThread] = await db
      .insert(staffMessageThreads)
      .values(thread)
      .returning();
    return newThread;
  }

  async getStaffMessageThreadById(id: string): Promise<StaffMessageThread | undefined> {
    const [thread] = await db
      .select()
      .from(staffMessageThreads)
      .where(eq(staffMessageThreads.id, id));
    return thread;
  }

  async getStaffMessageThreadsForUser(userId: string, filters?: { includeArchived?: boolean }): Promise<Array<StaffMessageThread & {
    unreadCount: number;
    lastMessage: { content: string; createdAt: Date; userId: string | null } | null;
    participants: Array<{ id: string; email: string; firstName: string | null; lastName: string | null }>;
  }>> {
    // Get all threads where user is a participant
    const participantRecords = await db
      .select({ threadId: staffMessageParticipants.threadId })
      .from(staffMessageParticipants)
      .where(eq(staffMessageParticipants.userId, userId));
    
    if (participantRecords.length === 0) {
      return [];
    }
    
    const threadIds = participantRecords.map(p => p.threadId);
    
    // Get threads
    let query = db
      .select()
      .from(staffMessageThreads)
      .where(inArray(staffMessageThreads.id, threadIds));
    
    // Apply archive filter
    if (!filters?.includeArchived) {
      query = query.where(eq(staffMessageThreads.isArchived, false)) as any;
    }
    
    const threads = await query.orderBy(desc(staffMessageThreads.lastMessageAt));
    
    // Enrich each thread with participants, last message, and unread count
    const enrichedThreads = await Promise.all(threads.map(async (thread) => {
      // Get participants
      const participantRecords = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(staffMessageParticipants)
        .innerJoin(users, eq(staffMessageParticipants.userId, users.id))
        .where(eq(staffMessageParticipants.threadId, thread.id));
      
      // Get last message
      const [lastMsg] = await db
        .select({
          content: staffMessages.content,
          createdAt: staffMessages.createdAt,
          userId: staffMessages.userId,
        })
        .from(staffMessages)
        .where(eq(staffMessages.threadId, thread.id))
        .orderBy(desc(staffMessages.createdAt))
        .limit(1);
      
      // Get unread count for this user
      const [participant] = await db
        .select()
        .from(staffMessageParticipants)
        .where(and(
          eq(staffMessageParticipants.threadId, thread.id),
          eq(staffMessageParticipants.userId, userId)
        ));
      
      let unreadCount = 0;
      if (participant) {
        const unreadMessages = await db
          .select()
          .from(staffMessages)
          .where(and(
            eq(staffMessages.threadId, thread.id),
            ne(staffMessages.userId, userId), // Exclude user's own messages
            participant.lastReadAt 
              ? sql`${staffMessages.createdAt} > ${participant.lastReadAt}`
              : sql`true` // If never read, count all messages from others
          ));
        unreadCount = unreadMessages.length;
      }
      
      return {
        ...thread,
        unreadCount,
        lastMessage: lastMsg || null,
        participants: participantRecords,
      };
    }));
    
    return enrichedThreads;
  }

  async updateStaffMessageThread(id: string, thread: Partial<InsertStaffMessageThread>): Promise<StaffMessageThread> {
    const [updated] = await db
      .update(staffMessageThreads)
      .set({ ...thread, updatedAt: new Date() })
      .where(eq(staffMessageThreads.id, id))
      .returning();
    return updated;
  }

  async deleteStaffMessageThread(id: string): Promise<void> {
    await db.delete(staffMessageThreads).where(eq(staffMessageThreads.id, id));
  }

  async archiveStaffMessageThread(id: string, archivedBy: string): Promise<StaffMessageThread> {
    const [updated] = await db
      .update(staffMessageThreads)
      .set({ 
        isArchived: true,
        archivedAt: new Date(),
        archivedBy,
        updatedAt: new Date()
      })
      .where(eq(staffMessageThreads.id, id))
      .returning();
    return updated;
  }

  async unarchiveStaffMessageThread(id: string): Promise<StaffMessageThread> {
    const [updated] = await db
      .update(staffMessageThreads)
      .set({ 
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
        updatedAt: new Date()
      })
      .where(eq(staffMessageThreads.id, id))
      .returning();
    return updated;
  }
}
