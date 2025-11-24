import { db } from "../../db.js";
import {
  taskTypes,
  type TaskType,
  type InsertTaskType,
  type UpdateTaskType
} from "../../../shared/schema.js";
import { eq, and } from "drizzle-orm";

export class TaskTypeStorage {
  async createTaskType(taskType: InsertTaskType): Promise<TaskType> {
    const [created] = await db
      .insert(taskTypes)
      .values(taskType)
      .returning();
    return created;
  }

  async getTaskTypeById(id: string): Promise<TaskType | undefined> {
    const [taskType] = await db
      .select()
      .from(taskTypes)
      .where(eq(taskTypes.id, id));
    return taskType;
  }

  async getAllTaskTypes(includeInactive = false): Promise<TaskType[]> {
    const conditions = includeInactive ? [] : [eq(taskTypes.isActive, true)];
    return await db
      .select()
      .from(taskTypes)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(taskTypes.name);
  }

  async getActiveTaskTypes(): Promise<TaskType[]> {
    return await db
      .select()
      .from(taskTypes)
      .where(eq(taskTypes.isActive, true))
      .orderBy(taskTypes.name);
  }

  async updateTaskType(id: string, taskType: UpdateTaskType): Promise<TaskType> {
    const [updated] = await db
      .update(taskTypes)
      .set({ ...taskType, updatedAt: new Date() })
      .where(eq(taskTypes.id, id))
      .returning();
    if (!updated) {
      throw new Error("Task type not found");
    }
    return updated;
  }

  async deleteTaskType(id: string): Promise<void> {
    await db.delete(taskTypes).where(eq(taskTypes.id, id));
  }
}
