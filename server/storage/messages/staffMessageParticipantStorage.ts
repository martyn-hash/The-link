import { db } from "../../db.js";
import { 
  staffMessageParticipants,
  staffMessages,
  type StaffMessageParticipant,
  type InsertStaffMessageParticipant
} from "@shared/schema";
import { eq, and, desc, sql, ne } from "drizzle-orm";

export class StaffMessageParticipantStorage {
  async createStaffMessageParticipant(participant: InsertStaffMessageParticipant): Promise<StaffMessageParticipant> {
    const [newParticipant] = await db
      .insert(staffMessageParticipants)
      .values(participant)
      .returning();
    return newParticipant;
  }

  async getStaffMessageParticipantsByThreadId(threadId: string): Promise<StaffMessageParticipant[]> {
    const participants = await db
      .select()
      .from(staffMessageParticipants)
      .where(eq(staffMessageParticipants.threadId, threadId))
      .orderBy(staffMessageParticipants.joinedAt);
    return participants;
  }

  async getStaffMessageParticipantsByUserId(userId: string): Promise<StaffMessageParticipant[]> {
    const participants = await db
      .select()
      .from(staffMessageParticipants)
      .where(eq(staffMessageParticipants.userId, userId))
      .orderBy(desc(staffMessageParticipants.joinedAt));
    return participants;
  }

  async updateStaffMessageParticipant(id: string, participant: Partial<InsertStaffMessageParticipant>): Promise<StaffMessageParticipant> {
    const [updated] = await db
      .update(staffMessageParticipants)
      .set({ ...participant, updatedAt: new Date() })
      .where(eq(staffMessageParticipants.id, id))
      .returning();
    return updated;
  }

  async deleteStaffMessageParticipant(id: string): Promise<void> {
    await db.delete(staffMessageParticipants).where(eq(staffMessageParticipants.id, id));
  }

  async markStaffMessagesAsRead(threadId: string, userId: string, lastReadMessageId: string): Promise<void> {
    await db
      .update(staffMessageParticipants)
      .set({ 
        lastReadAt: new Date(),
        lastReadMessageId,
        updatedAt: new Date()
      })
      .where(and(
        eq(staffMessageParticipants.threadId, threadId),
        eq(staffMessageParticipants.userId, userId)
      ));
  }

  async getUnreadStaffMessagesForUser(userId: string): Promise<{ threadId: string; count: number }[]> {
    // Get all threads the user is participating in
    const participantRecords = await db
      .select({
        threadId: staffMessageParticipants.threadId,
        lastReadMessageId: staffMessageParticipants.lastReadMessageId,
        lastReadAt: staffMessageParticipants.lastReadAt,
      })
      .from(staffMessageParticipants)
      .where(eq(staffMessageParticipants.userId, userId));
    
    const unreadCounts: { threadId: string; count: number }[] = [];
    
    for (const participant of participantRecords) {
      // Count unread messages (messages after lastReadAt, excluding user's own messages)
      const unreadMessages = await db
        .select()
        .from(staffMessages)
        .where(and(
          eq(staffMessages.threadId, participant.threadId),
          ne(staffMessages.userId, userId), // Exclude user's own messages
          participant.lastReadAt 
            ? sql`${staffMessages.createdAt} > ${participant.lastReadAt}`
            : sql`true` // If never read, count all messages from others
        ));
      
      if (unreadMessages.length > 0) {
        unreadCounts.push({
          threadId: participant.threadId,
          count: unreadMessages.length,
        });
      }
    }
    
    return unreadCounts;
  }
}
