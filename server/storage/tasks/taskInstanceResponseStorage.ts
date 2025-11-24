import { db } from "../../db.js";
import {
  taskInstanceResponses,
  clientRequestTemplateQuestions,
  clientCustomRequestQuestions,
  type TaskInstanceResponse,
  type InsertTaskInstanceResponse,
  type TaskTemplateQuestion
} from "../../../shared/schema.js";
import { eq } from "drizzle-orm";

export class TaskInstanceResponseStorage {
  async saveTaskInstanceResponse(response: InsertTaskInstanceResponse): Promise<TaskInstanceResponse> {
    const [saved] = await db
      .insert(taskInstanceResponses)
      .values(response)
      .onConflictDoUpdate({
        target: [taskInstanceResponses.taskInstanceId, taskInstanceResponses.questionId],
        set: {
          responseValue: response.responseValue,
          fileUrls: response.fileUrls,
          updatedAt: new Date(),
        },
      })
      .returning();
    return saved;
  }

  async getTaskInstanceResponseById(id: string): Promise<TaskInstanceResponse | undefined> {
    const [response] = await db
      .select()
      .from(taskInstanceResponses)
      .where(eq(taskInstanceResponses.id, id));
    return response;
  }

  async getTaskInstanceResponsesByTaskInstanceId(taskInstanceId: string): Promise<(TaskInstanceResponse & { question: TaskTemplateQuestion })[]> {
    const responses = await db
      .select({
        id: taskInstanceResponses.id,
        taskInstanceId: taskInstanceResponses.taskInstanceId,
        questionId: taskInstanceResponses.questionId,
        responseValue: taskInstanceResponses.responseValue,
        fileUrls: taskInstanceResponses.fileUrls,
        createdAt: taskInstanceResponses.createdAt,
        updatedAt: taskInstanceResponses.updatedAt,
        templateQuestion: clientRequestTemplateQuestions,
        customQuestion: clientCustomRequestQuestions,
      })
      .from(taskInstanceResponses)
      .leftJoin(clientRequestTemplateQuestions, eq(taskInstanceResponses.questionId, clientRequestTemplateQuestions.id))
      .leftJoin(clientCustomRequestQuestions, eq(taskInstanceResponses.questionId, clientCustomRequestQuestions.id))
      .where(eq(taskInstanceResponses.taskInstanceId, taskInstanceId));

    return responses.map(row => ({
      id: row.id,
      taskInstanceId: row.taskInstanceId,
      questionId: row.questionId,
      responseValue: row.responseValue,
      fileUrls: row.fileUrls,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      question: (row.templateQuestion || row.customQuestion) as any,
    }));
  }

  async updateTaskInstanceResponse(id: string, response: Partial<InsertTaskInstanceResponse>): Promise<TaskInstanceResponse> {
    const [updated] = await db
      .update(taskInstanceResponses)
      .set({ ...response, updatedAt: new Date() })
      .where(eq(taskInstanceResponses.id, id))
      .returning();
    return updated;
  }

  async deleteTaskInstanceResponse(id: string): Promise<void> {
    await db
      .delete(taskInstanceResponses)
      .where(eq(taskInstanceResponses.id, id));
  }

  async bulkSaveTaskInstanceResponses(taskInstanceId: string, responses: InsertTaskInstanceResponse[]): Promise<void> {
    if (responses.length === 0) return;

    await db.transaction(async (tx) => {
      for (const response of responses) {
        await tx
          .insert(taskInstanceResponses)
          .values({
            ...response,
            taskInstanceId,
          })
          .onConflictDoUpdate({
            target: [taskInstanceResponses.taskInstanceId, taskInstanceResponses.questionId],
            set: {
              responseValue: response.responseValue,
              fileUrls: response.fileUrls,
              updatedAt: new Date(),
            },
          });
      }
    });
  }
}
