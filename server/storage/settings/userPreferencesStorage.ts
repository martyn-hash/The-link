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
}
