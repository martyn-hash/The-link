import { db } from "../../db.js";
import { 
  projectMessageParticipants,
  projectMessageThreads,
  projectMessages,
  users,
  projects,
  type ProjectMessageParticipant,
  type InsertProjectMessageParticipant
} from "@shared/schema";
import { eq, and, desc, sql, ne, or, isNull, inArray } from "drizzle-orm";

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

  /**
   * OPTIMIZED: Two-phase bounded approach to avoid N+1 queries
   * Phase A: Single indexed query to find candidates (LIMIT 100)
   * Phase B: Batch hydration of users/projects in parallel queries
   */
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
    
    // PHASE A: Single aggregated query to find all candidates with unread counts
    // This replaces the N+1 pattern with one efficient indexed query
    const candidates = await db.execute(sql`
      SELECT 
        pmp.user_id,
        pmp.thread_id,
        pmt.topic,
        pmt.project_id,
        COUNT(pm.id)::int as unread_count,
        MIN(pm.created_at) as oldest_unread_at
      FROM project_message_participants pmp
      INNER JOIN project_message_threads pmt ON pmt.id = pmp.thread_id
      INNER JOIN project_messages pm ON pm.thread_id = pmp.thread_id
      WHERE 
        pm.user_id != pmp.user_id
        AND pm.created_at < ${cutoffTime}
        AND pm.created_at > COALESCE(pmp.last_read_at, '1970-01-01'::timestamp)
        AND pm.created_at > COALESCE(pmp.last_reminder_email_sent_at, '1970-01-01'::timestamp)
      GROUP BY pmp.user_id, pmp.thread_id, pmt.topic, pmt.project_id
      HAVING COUNT(pm.id) > 0
      ORDER BY MIN(pm.created_at) ASC
      LIMIT 25
    `);
    
    if (!candidates.rows || candidates.rows.length === 0) {
      return [];
    }
    
    // PHASE B: Batch hydration - collect unique IDs
    const userIds = new Set<string>();
    const projectIds = new Set<string>();
    
    for (const row of candidates.rows as any[]) {
      userIds.add(row.user_id);
      projectIds.add(row.project_id);
    }
    
    // Batch fetch users and projects in parallel (2 queries instead of N)
    const [usersMap, projectsMap] = await Promise.all([
      this.batchGetUsers(Array.from(userIds)),
      this.batchGetProjects(Array.from(projectIds)),
    ]);
    
    // Build result grouped by user
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
    
    let skippedDueToMissingData = 0;
    for (const row of candidates.rows as any[]) {
      const user = usersMap.get(row.user_id);
      const project = projectsMap.get(row.project_id);
      
      if (!user || !user.email || !project) {
        skippedDueToMissingData++;
        if (!user) {
          console.warn(`[Project Message Reminders] Skipping candidate: user ${row.user_id} not found in batch hydration`);
        } else if (!user.email) {
          console.warn(`[Project Message Reminders] Skipping candidate: user ${row.user_id} has no email`);
        } else if (!project) {
          console.warn(`[Project Message Reminders] Skipping candidate: project ${row.project_id} not found in batch hydration`);
        }
        continue;
      }
      
      if (!userMap.has(row.user_id)) {
        userMap.set(row.user_id, {
          userId: row.user_id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          threads: [],
        });
      }
      
      const userSummary = userMap.get(row.user_id)!;
      userSummary.threads.push({
        threadId: row.thread_id,
        topic: row.topic,
        projectId: row.project_id,
        projectName: project.name,
        unreadCount: row.unread_count,
        oldestUnreadAt: new Date(row.oldest_unread_at),
      });
    }
    
    if (skippedDueToMissingData > 0) {
      console.warn(`[Project Message Reminders] Skipped ${skippedDueToMissingData} candidates due to missing hydration data`);
    }
    
    return Array.from(userMap.values()).filter(u => u.threads.length > 0);
  }

  /**
   * Batch fetch users by IDs - TRUE batch query using WHERE id IN (...)
   * This is a single indexed query instead of N parallel connections
   */
  private async batchGetUsers(userIds: string[]): Promise<Map<string, { email: string; firstName: string | null; lastName: string | null }>> {
    const result = new Map<string, { email: string; firstName: string | null; lastName: string | null }>();
    if (userIds.length === 0) return result;
    
    const userRows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(inArray(users.id, userIds));
    
    for (const user of userRows) {
      if (user.email) {
        result.set(user.id, {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        });
      }
    }
    
    return result;
  }

  /**
   * Batch fetch projects by IDs - TRUE batch query using WHERE id IN (...)
   * This is a single indexed query instead of N parallel connections
   */
  private async batchGetProjects(projectIds: string[]): Promise<Map<string, { name: string }>> {
    const result = new Map<string, { name: string }>();
    if (projectIds.length === 0) return result;
    
    const projectRows = await db
      .select({
        id: projects.id,
        description: projects.description,
      })
      .from(projects)
      .where(inArray(projects.id, projectIds));
    
    for (const project of projectRows) {
      result.set(project.id, {
        name: project.description || 'Unknown Project',
      });
    }
    
    return result;
  }

  async getProjectMessageParticipantsNeedingReminders(hoursThreshold: number): Promise<Array<{
    threadId: string;
    userId: string;
    userEmail: string;
    userName: string;
    projectDescription: string;
    clientName: string;
    unreadCount: number;
  }>> {
    const cutoffTime = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
    
    const participantsWithUnread = await db
      .select({
        userId: projectMessageParticipants.userId,
        threadId: projectMessageParticipants.threadId,
        lastReadAt: projectMessageParticipants.lastReadAt,
        lastReminderEmailSentAt: projectMessageParticipants.lastReminderEmailSentAt,
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
    
    const results: Array<{
      threadId: string;
      userId: string;
      userEmail: string;
      userName: string;
      projectDescription: string;
      clientName: string;
      unreadCount: number;
    }> = [];
    
    for (const participant of participantsWithUnread) {
      const unreadMessages = await db
        .select({ id: projectMessages.id })
        .from(projectMessages)
        .where(and(
          eq(projectMessages.threadId, participant.threadId),
          ne(projectMessages.userId, participant.userId),
          participant.lastReadAt 
            ? sql`${projectMessages.createdAt} > ${participant.lastReadAt}`
            : sql`true`,
          sql`${projectMessages.createdAt} < ${cutoffTime}`,
          participant.lastReminderEmailSentAt
            ? sql`${projectMessages.createdAt} > ${participant.lastReminderEmailSentAt}`
            : sql`true`
        ));
      
      if (unreadMessages.length === 0) continue;
      
      const user = await this.getUser(participant.userId);
      if (!user || !user.email) continue;
      
      const project = await this.getProject(participant.projectId);
      if (!project) continue;
      
      results.push({
        threadId: participant.threadId,
        userId: participant.userId,
        userEmail: user.email,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        projectDescription: project.description || project.name || 'Unknown Project',
        clientName: project.clientName || 'Unknown Client',
        unreadCount: unreadMessages.length,
      });
    }
    
    return results;
  }
}
