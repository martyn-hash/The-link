import { db } from "../../db.js";
import { 
  projectMessageParticipants,
  projectMessageThreads,
  projectMessages,
  type ProjectMessageParticipant,
  type InsertProjectMessageParticipant
} from "../../../shared/schema.js";
import { eq, and, desc, sql, ne, or, isNull } from "drizzle-orm";

export class ProjectMessageParticipantStorage {
  // Cross-domain helpers (injected by facade)
  private getUser: any;
  private getProject: any;

  registerHelpers(helpers: { getUser: any; getProject: any }) {
    this.getUser = helpers.getUser;
    this.getProject = helpers.getProject;
  }

  async createProjectMessageParticipant(participant: InsertProjectMessageParticipant): Promise<ProjectMessageParticipant> {
    const [newParticipant] = await db
      .insert(projectMessageParticipants)
      .values(participant)
      .returning();
    return newParticipant;
  }

  async getProjectMessageParticipantsByThreadId(threadId: string): Promise<ProjectMessageParticipant[]> {
    const participants = await db
      .select()
      .from(projectMessageParticipants)
      .where(eq(projectMessageParticipants.threadId, threadId))
      .orderBy(projectMessageParticipants.joinedAt);
    return participants;
  }

  async getProjectMessageParticipantsByUserId(userId: string): Promise<ProjectMessageParticipant[]> {
    const participants = await db
      .select()
      .from(projectMessageParticipants)
      .where(eq(projectMessageParticipants.userId, userId))
      .orderBy(desc(projectMessageParticipants.joinedAt));
    return participants;
  }

  async updateProjectMessageParticipant(id: string, participant: Partial<InsertProjectMessageParticipant>): Promise<ProjectMessageParticipant> {
    const [updated] = await db
      .update(projectMessageParticipants)
      .set({ ...participant, updatedAt: new Date() })
      .where(eq(projectMessageParticipants.id, id))
      .returning();
    return updated;
  }

  async deleteProjectMessageParticipant(id: string): Promise<void> {
    await db.delete(projectMessageParticipants).where(eq(projectMessageParticipants.id, id));
  }

  async markProjectMessagesAsRead(threadId: string, userId: string, lastReadMessageId: string): Promise<void> {
    // Find the participant record for this thread and user
    const [participant] = await db
      .select()
      .from(projectMessageParticipants)
      .where(and(
        eq(projectMessageParticipants.threadId, threadId),
        eq(projectMessageParticipants.userId, userId)
      ));
    
    if (!participant) {
      throw new Error(`Participant not found for thread ${threadId} and user ${userId}`);
    }
    
    // Update the participant's last read info
    await db
      .update(projectMessageParticipants)
      .set({ 
        lastReadAt: new Date(),
        lastReadMessageId,
        updatedAt: new Date()
      })
      .where(eq(projectMessageParticipants.id, participant.id));
  }

  async updateParticipantReminderSent(threadId: string, userId: string): Promise<void> {
    // Find the participant record for this thread and user
    const [participant] = await db
      .select()
      .from(projectMessageParticipants)
      .where(and(
        eq(projectMessageParticipants.threadId, threadId),
        eq(projectMessageParticipants.userId, userId)
      ));
    
    if (!participant) {
      throw new Error(`Participant not found for thread ${threadId} and user ${userId}`);
    }
    
    // Update the participant's last reminder email timestamp
    await db
      .update(projectMessageParticipants)
      .set({ 
        lastReminderEmailSentAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(projectMessageParticipants.id, participant.id));
  }

  async getUnreadProjectMessagesForUser(userId: string): Promise<{ threadId: string; count: number; projectId: string }[]> {
    // Get all threads the user is participating in
    const participantRecords = await db
      .select({
        threadId: projectMessageParticipants.threadId,
        lastReadMessageId: projectMessageParticipants.lastReadMessageId,
        lastReadAt: projectMessageParticipants.lastReadAt,
      })
      .from(projectMessageParticipants)
      .where(eq(projectMessageParticipants.userId, userId));
    
    const unreadCounts: { threadId: string; count: number; projectId: string }[] = [];
    
    for (const participant of participantRecords) {
      // Count messages created after the user's last read timestamp
      const result = await db
        .select({
          count: sql<number>`count(*)::int`,
          projectId: projectMessageThreads.projectId,
        })
        .from(projectMessages)
        .innerJoin(projectMessageThreads, eq(projectMessages.threadId, projectMessageThreads.id))
        .where(and(
          eq(projectMessages.threadId, participant.threadId),
          ne(projectMessages.userId, userId), // Exclude user's own messages
          participant.lastReadAt 
            ? sql`${projectMessages.createdAt} > ${participant.lastReadAt}`
            : sql`true` // If never read, count all messages from others
        ))
        .groupBy(projectMessageThreads.projectId);
      
      if (result.length > 0 && result[0].count > 0) {
        unreadCounts.push({
          threadId: participant.threadId,
          count: result[0].count,
          projectId: result[0].projectId!,
        });
      }
    }
    
    return unreadCounts;
  }

  async getProjectMessageUnreadSummaries(olderThanMinutes: number): Promise<Array<{
    userId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    threads: Array<{
      threadId: string;
      topic: string;
      projectId: string;
      projectName: string;
      unreadCount: number;
      oldestUnreadAt: Date;
    }>;
  }>> {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    
    // Get all participants with unread messages older than cutoff
    const participantsWithUnread = await db
      .select({
        userId: projectMessageParticipants.userId,
        threadId: projectMessageParticipants.threadId,
        lastReadAt: projectMessageParticipants.lastReadAt,
        lastReminderEmailSentAt: projectMessageParticipants.lastReminderEmailSentAt,
        topic: projectMessageThreads.topic,
        projectId: projectMessageThreads.projectId,
      })
      .from(projectMessageParticipants)
      .innerJoin(projectMessageThreads, eq(projectMessageParticipants.threadId, projectMessageThreads.id))
      .where(
        or(
          isNull(projectMessageParticipants.lastReadAt),
          sql`${projectMessageParticipants.lastReadAt} < ${cutoffTime}`
        )
      );
    
    // Group by user
    const userMap = new Map<string, {
      userId: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      threads: Array<{
        threadId: string;
        topic: string;
        projectId: string;
        projectName: string;
        unreadCount: number;
        oldestUnreadAt: Date;
      }>;
    }>();
    
    for (const participant of participantsWithUnread) {
      // Get unread messages in this thread that are:
      // 1. Older than the cutoff time (10 minutes)
      // 2. NEW since we last sent a reminder email (if we've sent one before)
      const unreadMessages = await db
        .select({
          id: projectMessages.id,
          createdAt: projectMessages.createdAt,
        })
        .from(projectMessages)
        .where(and(
          eq(projectMessages.threadId, participant.threadId),
          ne(projectMessages.userId, participant.userId), // Exclude user's own messages
          participant.lastReadAt 
            ? sql`${projectMessages.createdAt} > ${participant.lastReadAt}`
            : sql`true`, // If never read, count all messages from others
          sql`${projectMessages.createdAt} < ${cutoffTime}`, // Only messages older than cutoff
          // Critical: Only include messages created AFTER the last reminder email was sent
          // This prevents re-sending reminders for the same old unread messages
          participant.lastReminderEmailSentAt
            ? sql`${projectMessages.createdAt} > ${participant.lastReminderEmailSentAt}`
            : sql`true` // If we've never sent a reminder, include all unread messages
        ))
        .orderBy(projectMessages.createdAt);
      
      if (unreadMessages.length === 0) continue;
      
      // Get user details (using injected helper)
      const user = await this.getUser(participant.userId);
      if (!user || !user.email) continue;
      
      // Get project details (using injected helper)
      const project = await this.getProject(participant.projectId);
      if (!project) continue;
      
      if (!userMap.has(participant.userId)) {
        userMap.set(participant.userId, {
          userId: participant.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          threads: [],
        });
      }
      
      const userSummary = userMap.get(participant.userId)!;
      userSummary.threads.push({
        threadId: participant.threadId,
        topic: participant.topic,
        projectId: participant.projectId,
        projectName: project.name,
        unreadCount: unreadMessages.length,
        oldestUnreadAt: unreadMessages[0].createdAt,
      });
    }
    
    return Array.from(userMap.values()).filter(u => u.threads.length > 0);
  }
}
