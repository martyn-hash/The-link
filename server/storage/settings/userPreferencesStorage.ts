import { eq } from 'drizzle-orm';
import { db } from '../../db';
import {
  userProjectPreferences,
  type UserProjectPreferences,
  type InsertUserProjectPreferences,
} from '@shared/schema';

export class UserPreferencesStorage {
  async getUserProjectPreferences(userId: string): Promise<UserProjectPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(userProjectPreferences)
      .where(eq(userProjectPreferences.userId, userId));
    return preferences;
  }

  async upsertUserProjectPreferences(preferences: InsertUserProjectPreferences): Promise<UserProjectPreferences> {
    const [result] = await db
      .insert(userProjectPreferences)
      .values(preferences)
      .onConflictDoUpdate({
        target: userProjectPreferences.userId,
        set: {
          defaultViewId: preferences.defaultViewId,
          defaultViewType: preferences.defaultViewType,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async deleteUserProjectPreferences(userId: string): Promise<void> {
    await db
      .delete(userProjectPreferences)
      .where(eq(userProjectPreferences.userId, userId));
  }

  async clearDefaultView(userId: string): Promise<void> {
    await db
      .update(userProjectPreferences)
      .set({
        defaultViewId: null,
        defaultViewType: null,
        updatedAt: new Date(),
      })
      .where(eq(userProjectPreferences.userId, userId));
  }
}
