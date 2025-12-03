import { db } from "../../db.js";
import { 
  projectMessageThreads,
  projectMessageParticipants,
  projectMessages,
  projects,
  clients,
  users,
  type ProjectMessageThread,
  type InsertProjectMessageThread
} from "@shared/schema";
import { eq, and, desc, sql, inArray, ne } from "drizzle-orm";

export class ProjectMessageThreadStorage {
  async createProjectMessageThread(thread: InsertProjectMessageThread): Promise<ProjectMessageThread> {
    const [newThread] = await db
      .insert(projectMessageThreads)
      .values(thread)
      .returning();
    return newThread;
  }

  async getProjectMessageThreadById(id: string): Promise<ProjectMessageThread | undefined> {
    const [thread] = await db
      .select()
      .from(projectMessageThreads)
      .where(eq(projectMessageThreads.id, id));
    return thread;
  }

  async getProjectMessageThreadsByProjectId(projectId: string): Promise<ProjectMessageThread[]> {
    const threads = await db
      .select()
      .from(projectMessageThreads)
      .where(eq(projectMessageThreads.projectId, projectId))
      .orderBy(desc(projectMessageThreads.lastMessageAt));
    return threads;
  }

  async getProjectMessageThreadsForUser(userId: string, filters?: { includeArchived?: boolean }): Promise<Array<ProjectMessageThread & {
    project: { id: string; description: string; clientId: string };
    client: { id: string; name: string };
    unreadCount: number;
    lastMessage: { content: string; createdAt: Date; userId: string | null } | null;
    participants: Array<{ id: string; email: string; firstName: string | null; lastName: string | null }>;
  }>> {
    const participantRecords = await db
      .select({
        threadId: projectMessageParticipants.threadId,
        lastReadAt: projectMessageParticipants.lastReadAt,
      })
      .from(projectMessageParticipants)
      .where(eq(projectMessageParticipants.userId, userId));

    const threadIds = participantRecords.map(p => p.threadId);
    
    if (threadIds.length === 0) {
      return [];
    }

    let whereConditions = [inArray(projectMessageThreads.id, threadIds)];
    
    if (!filters?.includeArchived) {
      whereConditions.push(eq(projectMessageThreads.isArchived, false));
    }

    const threadsData = await db
      .select({
        thread: projectMessageThreads,
        project: projects,
        client: clients,
      })
      .from(projectMessageThreads)
      .innerJoin(projects, eq(projectMessageThreads.projectId, projects.id))
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(and(...whereConditions))
      .orderBy(desc(projectMessageThreads.lastMessageAt));

    const enrichedThreads = await Promise.all(threadsData.map(async (row) => {
      const participantRecord = participantRecords.find(p => p.threadId === row.thread.id);
      
      const unreadCountResult = await db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(projectMessages)
        .where(and(
          eq(projectMessages.threadId, row.thread.id),
          ne(projectMessages.userId, userId),
          participantRecord?.lastReadAt 
            ? sql`${projectMessages.createdAt} > ${participantRecord.lastReadAt}`
            : sql`true`
        ));
      
      const lastMessageResult = await db
        .select({
          content: projectMessages.content,
          createdAt: projectMessages.createdAt,
          userId: projectMessages.userId,
        })
        .from(projectMessages)
        .where(eq(projectMessages.threadId, row.thread.id))
        .orderBy(desc(projectMessages.createdAt))
        .limit(1);

      const threadParticipants = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(projectMessageParticipants)
        .innerJoin(users, eq(projectMessageParticipants.userId, users.id))
        .where(eq(projectMessageParticipants.threadId, row.thread.id));

      return {
        ...row.thread,
        project: {
          id: row.project.id,
          description: row.project.description,
          clientId: row.project.clientId,
        },
        client: {
          id: row.client.id,
          name: row.client.name,
        },
        unreadCount: unreadCountResult[0]?.count || 0,
        lastMessage: lastMessageResult[0] || null,
        participants: threadParticipants,
      };
    }));

    return enrichedThreads as any;
  }

  async updateProjectMessageThread(id: string, thread: Partial<InsertProjectMessageThread>): Promise<ProjectMessageThread> {
    const [updated] = await db
      .update(projectMessageThreads)
      .set({ ...thread, updatedAt: new Date() })
      .where(eq(projectMessageThreads.id, id))
      .returning();
    return updated;
  }

  async deleteProjectMessageThread(id: string): Promise<void> {
    await db.delete(projectMessageThreads).where(eq(projectMessageThreads.id, id));
  }

  async archiveProjectMessageThread(id: string, archivedBy: string): Promise<ProjectMessageThread> {
    const [updated] = await db
      .update(projectMessageThreads)
      .set({ 
        isArchived: true, 
        archivedAt: new Date(),
        archivedBy,
        updatedAt: new Date() 
      })
      .where(eq(projectMessageThreads.id, id))
      .returning();
    return updated;
  }

  async unarchiveProjectMessageThread(id: string): Promise<ProjectMessageThread> {
    const [updated] = await db
      .update(projectMessageThreads)
      .set({ 
        isArchived: false, 
        archivedAt: null,
        archivedBy: null,
        updatedAt: new Date() 
      })
      .where(eq(projectMessageThreads.id, id))
      .returning();
    return updated;
  }

  /**
   * Get count of unread project message threads for a user using a single aggregated query.
   * This is optimized to avoid the N+1 query pattern of fetching all threads then counting.
   */
  async getUnreadProjectThreadCountForUser(userId: string): Promise<number> {
    const result = await db.execute(sql`
      SELECT COUNT(DISTINCT pmp.thread_id)::int as count
      FROM project_message_participants pmp
      INNER JOIN project_message_threads pmt ON pmt.id = pmp.thread_id
      INNER JOIN project_messages pm ON pm.thread_id = pmp.thread_id
      WHERE pmp.user_id = ${userId}
        AND pmt.is_archived = false
        AND pm.user_id != ${userId}
        AND pm.created_at > COALESCE(pmp.last_read_at, '1970-01-01'::timestamp)
    `);
    
    return (result.rows[0] as any)?.count || 0;
  }

  async autoArchiveThreadsByProjectId(projectId: string, archivedBy: string): Promise<number> {
    const result = await db
      .update(projectMessageThreads)
      .set({ 
        isArchived: true, 
        archivedAt: new Date(),
        archivedBy,
        autoArchivedByProject: true,
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(projectMessageThreads.projectId, projectId),
          eq(projectMessageThreads.isArchived, false)
        )
      )
      .returning();
    return result.length;
  }

  async unarchiveAutoArchivedThreadsByProjectId(projectId: string): Promise<number> {
    const result = await db
      .update(projectMessageThreads)
      .set({ 
        isArchived: false, 
        archivedAt: null,
        archivedBy: null,
        autoArchivedByProject: false,
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(projectMessageThreads.projectId, projectId),
          eq(projectMessageThreads.autoArchivedByProject, true)
        )
      )
      .returning();
    return result.length;
  }
}
