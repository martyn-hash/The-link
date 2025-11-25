import { db } from "../../db.js";
import {
  taskTimeEntries,
  users,
  type TaskTimeEntry,
  type InsertTaskTimeEntry,
  type StopTaskTimeEntry,
  type User
} from "../../../shared/schema.js";
import { eq, desc, and, isNull } from "drizzle-orm";

export class TaskTimeEntryStorage {
  async createTaskTimeEntry(entry: InsertTaskTimeEntry): Promise<TaskTimeEntry> {
    const [created] = await db
      .insert(taskTimeEntries)
      .values(entry)
      .returning();
    return created;
  }

  async getTaskTimeEntriesByTaskId(taskId: string): Promise<(TaskTimeEntry & { user: User })[]> {
    const results = await db
      .select({
        id: taskTimeEntries.id,
        taskId: taskTimeEntries.taskId,
        userId: taskTimeEntries.userId,
        startTime: taskTimeEntries.startTime,
        endTime: taskTimeEntries.endTime,
        durationMinutes: taskTimeEntries.durationMinutes,
        note: taskTimeEntries.note,
        createdAt: taskTimeEntries.createdAt,
        user: users,
      })
      .from(taskTimeEntries)
      .leftJoin(users, eq(taskTimeEntries.userId, users.id))
      .where(eq(taskTimeEntries.taskId, taskId))
      .orderBy(desc(taskTimeEntries.startTime));
    return results as any;
  }

  async getActiveTaskTimeEntry(taskId: string, userId: string): Promise<TaskTimeEntry | undefined> {
    const [entry] = await db
      .select()
      .from(taskTimeEntries)
      .where(
        and(
          eq(taskTimeEntries.taskId, taskId),
          eq(taskTimeEntries.userId, userId),
          isNull(taskTimeEntries.endTime)
        )
      )
      .orderBy(desc(taskTimeEntries.startTime))
      .limit(1);
    return entry;
  }

  async stopTaskTimeEntry(id: string, stopData: StopTaskTimeEntry): Promise<TaskTimeEntry> {
    const [entry] = await db
      .select()
      .from(taskTimeEntries)
      .where(eq(taskTimeEntries.id, id));
    
    if (!entry) {
      throw new Error("Time entry not found");
    }

    const endTime = new Date();
    const durationMinutes = Math.floor((endTime.getTime() - new Date(entry.startTime).getTime()) / 1000 / 60);

    const [updated] = await db
      .update(taskTimeEntries)
      .set({
        endTime,
        durationMinutes,
        note: stopData.note || entry.note,
      })
      .where(eq(taskTimeEntries.id, id))
      .returning();
    
    return updated;
  }

  async deleteTaskTimeEntry(id: string): Promise<void> {
    await db.delete(taskTimeEntries).where(eq(taskTimeEntries.id, id));
  }
}
