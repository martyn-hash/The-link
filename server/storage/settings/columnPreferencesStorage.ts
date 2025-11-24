import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import {
  userColumnPreferences,
  type UserColumnPreferences,
  type InsertUserColumnPreferences,
  type UpdateUserColumnPreferences,
} from '@shared/schema';

export class ColumnPreferencesStorage {
  async getUserColumnPreferences(userId: string, viewType: string = 'projects'): Promise<UserColumnPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(userColumnPreferences)
      .where(and(
        eq(userColumnPreferences.userId, userId),
        eq(userColumnPreferences.viewType, viewType)
      ));
    return preferences;
  }

  async upsertUserColumnPreferences(preferences: InsertUserColumnPreferences): Promise<UserColumnPreferences> {
    const [result] = await db
      .insert(userColumnPreferences)
      .values(preferences)
      .onConflictDoUpdate({
        target: [userColumnPreferences.userId, userColumnPreferences.viewType],
        set: {
          columnOrder: preferences.columnOrder,
          visibleColumns: preferences.visibleColumns,
          columnWidths: preferences.columnWidths,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async updateUserColumnPreferences(userId: string, viewType: string, preferences: UpdateUserColumnPreferences): Promise<UserColumnPreferences> {
    const [updated] = await db
      .update(userColumnPreferences)
      .set({
        ...preferences,
        updatedAt: new Date(),
      })
      .where(and(
        eq(userColumnPreferences.userId, userId),
        eq(userColumnPreferences.viewType, viewType)
      ))
      .returning();
    
    if (!updated) {
      throw new Error(`Column preferences not found for user ${userId} and viewType ${viewType}`);
    }
    
    return updated;
  }
}
