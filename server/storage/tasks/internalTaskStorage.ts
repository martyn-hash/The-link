import { db } from "../../db.js";
import {
  internalTasks,
  taskTypes,
  taskConnections,
  taskProgressNotes,
  taskDocuments,
  users,
  type InternalTask,
  type InsertInternalTask,
  type UpdateInternalTask,
  type CloseInternalTask,
  type TaskConnection,
  type InsertTaskConnection,
  type TaskProgressNote,
  type InsertTaskProgressNote,
  type TaskDocument,
  type InsertTaskDocument,
  type User
} from "@shared/schema";
import { eq, desc, and, inArray, ne, or, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export class InternalTaskStorage {
  async createInternalTask(task: InsertInternalTask): Promise<InternalTask> {
    const [created] = await db
      .insert(internalTasks)
      .values(task as any)
      .returning();
    return created;
  }

  async getInternalTaskById(id: string): Promise<InternalTask | undefined> {
    const [task] = await db
      .select()
      .from(internalTasks)
      .where(eq(internalTasks.id, id));
    return task;
  }

  async getInternalTasksByAssignee(assigneeId: string, filters?: { status?: string; priority?: string; assigneeId?: string }): Promise<InternalTask[]> {
    const conditions: any[] = [eq(internalTasks.assignedTo, assigneeId)];
    if (filters?.status) {
      conditions.push(eq(internalTasks.status, filters.status as any));
    }
    if (filters?.priority) {
      conditions.push(eq(internalTasks.priority, filters.priority as any));
    }
    // Additional assignee filter (for narrowing down within the "assigned" view)
    if (filters?.assigneeId) {
      conditions.push(eq(internalTasks.assignedTo, filters.assigneeId));
    }
    
    const assigneeAlias = alias(users, 'assignee');
    const creatorAlias = alias(users, 'creator');
    
    const results = await db
      .select({
        task: internalTasks,
        taskType: taskTypes,
        assignee: assigneeAlias,
        creator: creatorAlias,
      })
      .from(internalTasks)
      .leftJoin(taskTypes, eq(internalTasks.taskTypeId, taskTypes.id))
      .leftJoin(assigneeAlias, eq(internalTasks.assignedTo, assigneeAlias.id))
      .leftJoin(creatorAlias, eq(internalTasks.createdBy, creatorAlias.id))
      .where(and(...conditions))
      .orderBy(desc(internalTasks.createdAt));
    
    return results.map(row => ({
      ...row.task,
      taskType: row.taskType || undefined,
      assignee: row.assignee || undefined,
      creator: row.creator || undefined,
    })) as any;
  }

  async getInternalTasksByCreator(creatorId: string, filters?: { status?: string; priority?: string; assigneeId?: string }): Promise<InternalTask[]> {
    const conditions: any[] = [
      eq(internalTasks.createdBy, creatorId),
      // Exclude tasks where the creator assigned it to themselves (self-assigned tasks)
      or(ne(internalTasks.assignedTo, creatorId), isNull(internalTasks.assignedTo))
    ];
    if (filters?.status) {
      conditions.push(eq(internalTasks.status, filters.status as any));
    }
    if (filters?.priority) {
      conditions.push(eq(internalTasks.priority, filters.priority as any));
    }
    // Additional assignee filter (for filtering tasks created for a specific person)
    if (filters?.assigneeId) {
      conditions.push(eq(internalTasks.assignedTo, filters.assigneeId));
    }
    
    const assigneeAlias = alias(users, 'assignee');
    const creatorAlias = alias(users, 'creator');
    
    const results = await db
      .select({
        task: internalTasks,
        taskType: taskTypes,
        assignee: assigneeAlias,
        creator: creatorAlias,
      })
      .from(internalTasks)
      .leftJoin(taskTypes, eq(internalTasks.taskTypeId, taskTypes.id))
      .leftJoin(assigneeAlias, eq(internalTasks.assignedTo, assigneeAlias.id))
      .leftJoin(creatorAlias, eq(internalTasks.createdBy, creatorAlias.id))
      .where(and(...conditions))
      .orderBy(desc(internalTasks.createdAt));
    
    return results.map(row => ({
      ...row.task,
      taskType: row.taskType || undefined,
      assignee: row.assignee || undefined,
      creator: row.creator || undefined,
    })) as any;
  }

  async getAllInternalTasks(filters?: { status?: string; priority?: string; assigneeId?: string; creatorId?: string }): Promise<InternalTask[]> {
    const conditions: any[] = [];
    if (filters?.status) {
      conditions.push(eq(internalTasks.status, filters.status as any));
    }
    if (filters?.priority) {
      conditions.push(eq(internalTasks.priority, filters.priority as any));
    }
    if (filters?.assigneeId) {
      conditions.push(eq(internalTasks.assignedTo, filters.assigneeId));
    }
    if (filters?.creatorId) {
      conditions.push(eq(internalTasks.createdBy, filters.creatorId));
    }
    
    const assigneeAlias = alias(users, 'assignee');
    const creatorAlias = alias(users, 'creator');
    
    const results = await db
      .select({
        task: internalTasks,
        taskType: taskTypes,
        assignee: assigneeAlias,
        creator: creatorAlias,
      })
      .from(internalTasks)
      .leftJoin(taskTypes, eq(internalTasks.taskTypeId, taskTypes.id))
      .leftJoin(assigneeAlias, eq(internalTasks.assignedTo, assigneeAlias.id))
      .leftJoin(creatorAlias, eq(internalTasks.createdBy, creatorAlias.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(internalTasks.createdAt));
    
    return results.map(row => ({
      ...row.task,
      taskType: row.taskType || undefined,
      assignee: row.assignee || undefined,
      creator: row.creator || undefined,
    })) as any;
  }

  async getInternalTasksByClient(clientId: string): Promise<InternalTask[]> {
    const connections = await db
      .select()
      .from(taskConnections)
      .where(
        and(
          eq(taskConnections.entityType, 'client'),
          eq(taskConnections.entityId, clientId)
        )
      );
    
    if (connections.length === 0) {
      return [];
    }

    const taskIds = connections.map(c => c.taskId);
    
    const tasksWithTypes = await db
      .select({
        task: internalTasks,
        taskType: taskTypes,
      })
      .from(internalTasks)
      .leftJoin(taskTypes, eq(internalTasks.taskTypeId, taskTypes.id))
      .where(inArray(internalTasks.id, taskIds))
      .orderBy(desc(internalTasks.createdAt));
    
    const allUserIds = new Set<string>();
    tasksWithTypes.forEach(row => {
      if (row.task.assignedTo) allUserIds.add(row.task.assignedTo);
      if (row.task.createdBy) allUserIds.add(row.task.createdBy);
      if (row.task.closedBy) allUserIds.add(row.task.closedBy);
    });
    
    const usersList = await db
      .select()
      .from(users)
      .where(inArray(users.id, Array.from(allUserIds)));
    
    const usersMap = new Map(usersList.map(u => [u.id, u]));
    
    return tasksWithTypes.map(row => ({
      ...row.task,
      taskType: row.taskType || undefined,
      assignee: row.task.assignedTo ? usersMap.get(row.task.assignedTo) : undefined,
      creator: row.task.createdBy ? usersMap.get(row.task.createdBy) : undefined,
      closedByUser: row.task.closedBy ? usersMap.get(row.task.closedBy) : undefined,
    })) as any;
  }

  async getInternalTasksByProject(projectId: string): Promise<InternalTask[]> {
    const connections = await db
      .select()
      .from(taskConnections)
      .where(
        and(
          eq(taskConnections.entityType, 'project'),
          eq(taskConnections.entityId, projectId)
        )
      );
    
    if (connections.length === 0) {
      return [];
    }

    const taskIds = connections.map(c => c.taskId);
    
    const tasksWithTypes = await db
      .select({
        task: internalTasks,
        taskType: taskTypes,
      })
      .from(internalTasks)
      .leftJoin(taskTypes, eq(internalTasks.taskTypeId, taskTypes.id))
      .where(inArray(internalTasks.id, taskIds))
      .orderBy(desc(internalTasks.createdAt));
    
    const allUserIds = new Set<string>();
    tasksWithTypes.forEach(row => {
      if (row.task.assignedTo) allUserIds.add(row.task.assignedTo);
      if (row.task.createdBy) allUserIds.add(row.task.createdBy);
      if (row.task.closedBy) allUserIds.add(row.task.closedBy);
    });
    
    const usersList = await db
      .select()
      .from(users)
      .where(inArray(users.id, Array.from(allUserIds)));
    
    const usersMap = new Map(usersList.map(u => [u.id, u]));
    
    return tasksWithTypes.map(row => ({
      ...row.task,
      taskType: row.taskType || undefined,
      assignee: row.task.assignedTo ? usersMap.get(row.task.assignedTo) : undefined,
      creator: row.task.createdBy ? usersMap.get(row.task.createdBy) : undefined,
      closedByUser: row.task.closedBy ? usersMap.get(row.task.closedBy) : undefined,
    })) as any;
  }

  async updateInternalTask(id: string, task: UpdateInternalTask): Promise<InternalTask> {
    const [updated] = await db
      .update(internalTasks)
      .set({ ...task, updatedAt: new Date() } as any)
      .where(eq(internalTasks.id, id))
      .returning();
    if (!updated) {
      throw new Error("Task not found");
    }
    return updated;
  }

  async closeInternalTask(id: string, closeData: CloseInternalTask, userId: string): Promise<InternalTask> {
    const [updated] = await db
      .update(internalTasks)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedBy: userId,
        closureNote: closeData.closureNote,
        totalTimeSpentMinutes: closeData.totalTimeSpentMinutes,
        updatedAt: new Date(),
      })
      .where(eq(internalTasks.id, id))
      .returning();
    if (!updated) {
      throw new Error("Task not found");
    }
    return updated;
  }

  async deleteInternalTask(id: string): Promise<void> {
    await db.delete(internalTasks).where(eq(internalTasks.id, id));
  }

  async archiveInternalTask(id: string, userId: string): Promise<InternalTask> {
    const [updated] = await db
      .update(internalTasks)
      .set({
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(internalTasks.id, id))
      .returning();
    if (!updated) {
      throw new Error("Task not found");
    }
    return updated;
  }

  async unarchiveInternalTask(id: string): Promise<InternalTask> {
    const [updated] = await db
      .update(internalTasks)
      .set({
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(internalTasks.id, id))
      .returning();
    if (!updated) {
      throw new Error("Task not found");
    }
    return updated;
  }

  async bulkReassignTasks(taskIds: string[], assignedTo: string): Promise<void> {
    if (taskIds.length === 0) return;
    await db
      .update(internalTasks)
      .set({ assignedTo, updatedAt: new Date() })
      .where(inArray(internalTasks.id, taskIds));
  }

  async bulkUpdateTaskStatus(taskIds: string[], status: string): Promise<void> {
    if (taskIds.length === 0) return;
    await db
      .update(internalTasks)
      .set({ status: status as any, updatedAt: new Date() })
      .where(inArray(internalTasks.id, taskIds));
  }

  // Task Connection operations
  async createTaskConnection(connection: InsertTaskConnection): Promise<TaskConnection> {
    const [created] = await db
      .insert(taskConnections)
      .values(connection)
      .returning();
    return created;
  }

  async getTaskConnectionsByTaskId(taskId: string): Promise<TaskConnection[]> {
    return await db
      .select()
      .from(taskConnections)
      .where(eq(taskConnections.taskId, taskId));
  }

  async deleteTaskConnection(id: string): Promise<void> {
    await db.delete(taskConnections).where(eq(taskConnections.id, id));
  }

  // Task Progress Notes operations
  async createTaskProgressNote(note: InsertTaskProgressNote): Promise<TaskProgressNote> {
    const [created] = await db
      .insert(taskProgressNotes)
      .values(note)
      .returning();
    return created;
  }

  async getTaskProgressNotesByTaskId(taskId: string): Promise<(TaskProgressNote & { user: User })[]> {
    const results = await db
      .select({
        id: taskProgressNotes.id,
        taskId: taskProgressNotes.taskId,
        userId: taskProgressNotes.userId,
        content: taskProgressNotes.content,
        createdAt: taskProgressNotes.createdAt,
        user: users,
      })
      .from(taskProgressNotes)
      .leftJoin(users, eq(taskProgressNotes.userId, users.id))
      .where(eq(taskProgressNotes.taskId, taskId))
      .orderBy(desc(taskProgressNotes.createdAt));
    return results as any;
  }

  async deleteTaskProgressNote(id: string): Promise<void> {
    await db.delete(taskProgressNotes).where(eq(taskProgressNotes.id, id));
  }

  // Task Document operations
  async createTaskDocument(document: InsertTaskDocument): Promise<TaskDocument> {
    const [created] = await db
      .insert(taskDocuments)
      .values(document)
      .returning();
    return created;
  }

  async getTaskDocument(id: string): Promise<TaskDocument | undefined> {
    const [document] = await db
      .select()
      .from(taskDocuments)
      .where(eq(taskDocuments.id, id));
    return document;
  }

  async getTaskDocuments(taskId: string): Promise<(TaskDocument & { uploader: User })[]> {
    const results = await db
      .select({
        id: taskDocuments.id,
        taskId: taskDocuments.taskId,
        uploadedBy: taskDocuments.uploadedBy,
        fileName: taskDocuments.fileName,
        fileSize: taskDocuments.fileSize,
        mimeType: taskDocuments.mimeType,
        storagePath: taskDocuments.storagePath,
        createdAt: taskDocuments.createdAt,
        uploader: users,
      })
      .from(taskDocuments)
      .leftJoin(users, eq(taskDocuments.uploadedBy, users.id))
      .where(eq(taskDocuments.taskId, taskId))
      .orderBy(desc(taskDocuments.createdAt));
    return results as any;
  }

  async deleteTaskDocument(id: string): Promise<void> {
    await db.delete(taskDocuments).where(eq(taskDocuments.id, id));
  }
}
