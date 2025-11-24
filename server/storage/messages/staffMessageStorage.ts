import { db } from "../../db.js";
import { 
  staffMessages,
  staffMessageThreads,
  type StaffMessage,
  type InsertStaffMessage
} from "../../../shared/schema.js";
import { eq } from "drizzle-orm";

export class StaffMessageStorage {
  async createStaffMessage(message: InsertStaffMessage): Promise<StaffMessage> {
    const [newMessage] = await db
      .insert(staffMessages)
      .values(message)
      .returning();
    
    // Update thread's lastMessageAt and lastMessageByUserId
    await db
      .update(staffMessageThreads)
      .set({ 
        lastMessageAt: new Date(),
        lastMessageByUserId: message.userId
      })
      .where(eq(staffMessageThreads.id, message.threadId));
    
    return newMessage;
  }

  async getStaffMessageById(id: string): Promise<StaffMessage | undefined> {
    const [message] = await db
      .select()
      .from(staffMessages)
      .where(eq(staffMessages.id, id));
    return message;
  }

  async getStaffMessagesByThreadId(threadId: string): Promise<StaffMessage[]> {
    const messages = await db
      .select()
      .from(staffMessages)
      .where(eq(staffMessages.threadId, threadId))
      .orderBy(staffMessages.createdAt);
    return messages;
  }

  async updateStaffMessage(id: string, message: Partial<InsertStaffMessage>): Promise<StaffMessage> {
    const [updated] = await db
      .update(staffMessages)
      .set({ ...message, updatedAt: new Date() })
      .where(eq(staffMessages.id, id))
      .returning();
    return updated;
  }

  async deleteStaffMessage(id: string): Promise<void> {
    await db.delete(staffMessages).where(eq(staffMessages.id, id));
  }
}
