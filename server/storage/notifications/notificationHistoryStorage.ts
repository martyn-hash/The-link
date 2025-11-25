import { db } from "../../db";
import { eq, desc } from "drizzle-orm";
import {
  notificationHistory,
  type NotificationHistory,
} from "@shared/schema";

export class NotificationHistoryStorage {
  async getNotificationHistoryByClientId(clientId: string): Promise<NotificationHistory[]> {
    return await db
      .select()
      .from(notificationHistory)
      .where(eq(notificationHistory.clientId, clientId))
      .orderBy(desc(notificationHistory.createdAt));
  }

  async getNotificationHistoryByProjectId(projectId: string): Promise<NotificationHistory[]> {
    return await db
      .select()
      .from(notificationHistory)
      .where(eq((notificationHistory as any).projectId, projectId))
      .orderBy(desc(notificationHistory.createdAt));
  }
}
