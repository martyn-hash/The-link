import { eq, and, not, isNull } from 'drizzle-orm';
import { db } from '../../db';
import {
  userNotificationPreferences,
  users,
  type User,
  type UserNotificationPreferences,
  type InsertUserNotificationPreferences,
  type UpdateUserNotificationPreferences,
} from '@shared/schema';

export class UserNotificationPreferencesStorage {
  async getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, userId));
    return preferences;
  }

  async createUserNotificationPreferences(preferences: InsertUserNotificationPreferences): Promise<UserNotificationPreferences> {
    const [newPreferences] = await db
      .insert(userNotificationPreferences)
      .values(preferences)
      .returning();
    return newPreferences;
  }

  async updateUserNotificationPreferences(userId: string, preferences: UpdateUserNotificationPreferences): Promise<UserNotificationPreferences> {
    const [updatedPreferences] = await db
      .update(userNotificationPreferences)
      .set({
        ...preferences,
        updatedAt: new Date(),
      })
      .where(eq(userNotificationPreferences.userId, userId))
      .returning();
    
    if (!updatedPreferences) {
      throw new Error("User notification preferences not found");
    }
    
    return updatedPreferences;
  }

  async getOrCreateDefaultNotificationPreferences(userId: string): Promise<UserNotificationPreferences> {
    const existing = await this.getUserNotificationPreferences(userId);
    if (existing) {
      return existing;
    }

    const defaultPreferences: InsertUserNotificationPreferences = {
      userId,
      notifyStageChanges: true,
      notifyNewProjects: true,
    };

    return await this.createUserNotificationPreferences(defaultPreferences);
  }

  async getUsersWithSchedulingNotifications(): Promise<User[]> {
    const usersWithNotifications = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        isAdmin: users.isAdmin,
        canSeeAdminMenu: users.canSeeAdminMenu,
        passwordHash: users.passwordHash,
        isFallbackUser: users.isFallbackUser,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .innerJoin(userNotificationPreferences, eq(users.id, userNotificationPreferences.userId))
      .where(
        and(
          eq(userNotificationPreferences.notifySchedulingSummary, true),
          eq(users.isAdmin, true),
          not(isNull(users.email))
        )
      );
    
    return usersWithNotifications as User[];
  }
}
