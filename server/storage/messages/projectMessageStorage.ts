import { db } from "../../db.js";
import { 
  projectMessages,
  projectMessageThreads,
  users,
  type ProjectMessage,
  type InsertProjectMessage
} from "@shared/schema";
import { eq } from "drizzle-orm";

export class ProjectMessageStorage {
  async createProjectMessage(message: InsertProjectMessage): Promise<ProjectMessage> {
    const [newMessage] = await db
      .insert(projectMessages)
      .values(message)
      .returning();
    
    // Update thread's lastMessageAt and lastMessageByUserId
    await db
      .update(projectMessageThreads)
      .set({ 
        lastMessageAt: new Date(),
        lastMessageByUserId: message.userId
      })
      .where(eq(projectMessageThreads.id, message.threadId));
    
    return newMessage;
  }

  async getProjectMessageById(id: string): Promise<ProjectMessage | undefined> {
    const [message] = await db
      .select()
      .from(projectMessages)
      .where(eq(projectMessages.id, id));
    return message;
  }

  async getProjectMessagesByThreadId(threadId: string): Promise<ProjectMessage[]> {
    const result = await db
      .select({
        message: projectMessages,
        user: users,
      })
      .from(projectMessages)
      .leftJoin(users, eq(projectMessages.userId, users.id))
      .where(eq(projectMessages.threadId, threadId))
      .orderBy(projectMessages.createdAt);
    
    return result.map(row => ({
      ...row.message,
      user: row.user || undefined,
    })) as ProjectMessage[];
  }

  async updateProjectMessage(id: string, message: Partial<InsertProjectMessage>): Promise<ProjectMessage> {
    const [updated] = await db
      .update(projectMessages)
      .set({ ...message, updatedAt: new Date() })
      .where(eq(projectMessages.id, id))
      .returning();
    return updated;
  }

  async deleteProjectMessage(id: string): Promise<void> {
    await db.delete(projectMessages).where(eq(projectMessages.id, id));
  }
}
