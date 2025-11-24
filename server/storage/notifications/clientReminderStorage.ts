import { db } from "../../db";
import { eq, desc } from "drizzle-orm";
import {
  clientRequestReminders,
  type ClientRequestReminder,
  type InsertClientRequestReminder,
  type UpdateClientRequestReminder,
} from "@shared/schema";

export class ClientReminderStorage {
  async getClientRequestRemindersByNotificationId(notificationId: string): Promise<ClientRequestReminder[]> {
    return await db
      .select()
      .from(clientRequestReminders)
      .where(eq(clientRequestReminders.projectTypeNotificationId, notificationId))
      .orderBy(desc(clientRequestReminders.createdAt));
  }

  async getClientRequestReminderById(id: string): Promise<ClientRequestReminder | undefined> {
    const [reminder] = await db
      .select()
      .from(clientRequestReminders)
      .where(eq(clientRequestReminders.id, id));
    return reminder;
  }

  async createClientRequestReminder(reminder: InsertClientRequestReminder): Promise<ClientRequestReminder> {
    const [created] = await db
      .insert(clientRequestReminders)
      .values(reminder)
      .returning();
    return created;
  }

  async updateClientRequestReminder(id: string, reminder: UpdateClientRequestReminder): Promise<ClientRequestReminder> {
    const [updated] = await db
      .update(clientRequestReminders)
      .set(reminder)
      .where(eq(clientRequestReminders.id, id))
      .returning();
    return updated;
  }

  async deleteClientRequestReminder(id: string): Promise<void> {
    await db.delete(clientRequestReminders).where(eq(clientRequestReminders.id, id));
  }
}
