import { db } from "../../db";
import { eq, and } from "drizzle-orm";
import {
  userCalendarColorPreferences,
  type UserCalendarColorPreference,
  type InsertUserCalendarColorPreference,
} from "@shared/schema";

export class CalendarColorStorage {
  async getColorPreferencesForUser(userId: string): Promise<UserCalendarColorPreference[]> {
    return await db
      .select()
      .from(userCalendarColorPreferences)
      .where(eq(userCalendarColorPreferences.userId, userId));
  }

  async getColorPreference(userId: string, calendarOwnerId: string): Promise<UserCalendarColorPreference | undefined> {
    const result = await db
      .select()
      .from(userCalendarColorPreferences)
      .where(
        and(
          eq(userCalendarColorPreferences.userId, userId),
          eq(userCalendarColorPreferences.calendarOwnerId, calendarOwnerId)
        )
      )
      .limit(1);
    return result[0];
  }

  async setColorPreference(data: InsertUserCalendarColorPreference): Promise<UserCalendarColorPreference> {
    const existing = await this.getColorPreference(data.userId, data.calendarOwnerId);
    
    if (existing) {
      const [updated] = await db
        .update(userCalendarColorPreferences)
        .set({ color: data.color, updatedAt: new Date() })
        .where(eq(userCalendarColorPreferences.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(userCalendarColorPreferences)
      .values(data)
      .returning();
    return created;
  }

  async deleteColorPreference(userId: string, calendarOwnerId: string): Promise<void> {
    await db
      .delete(userCalendarColorPreferences)
      .where(
        and(
          eq(userCalendarColorPreferences.userId, userId),
          eq(userCalendarColorPreferences.calendarOwnerId, calendarOwnerId)
        )
      );
  }
}

export const calendarColorStorage = new CalendarColorStorage();
