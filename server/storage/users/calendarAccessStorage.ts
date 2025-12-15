import { db } from "../../db";
import { eq, and } from "drizzle-orm";
import {
  userCalendarAccess,
  users,
  type UserCalendarAccess,
  type InsertUserCalendarAccess,
  type User,
} from "@shared/schema";

export class CalendarAccessStorage {
  async getCalendarAccessForUser(userId: string): Promise<(UserCalendarAccess & { canAccessUser: User })[]> {
    const result = await db
      .select({
        access: userCalendarAccess,
        canAccessUser: users,
      })
      .from(userCalendarAccess)
      .innerJoin(users, eq(userCalendarAccess.canAccessUserId, users.id))
      .where(eq(userCalendarAccess.userId, userId));

    return result.map(r => ({
      ...r.access,
      canAccessUser: r.canAccessUser,
    }));
  }

  async getUsersWhoCanAccessCalendar(targetUserId: string): Promise<(UserCalendarAccess & { user: User })[]> {
    const result = await db
      .select({
        access: userCalendarAccess,
        user: users,
      })
      .from(userCalendarAccess)
      .innerJoin(users, eq(userCalendarAccess.userId, users.id))
      .where(eq(userCalendarAccess.canAccessUserId, targetUserId));

    return result.map(r => ({
      ...r.access,
      user: r.user,
    }));
  }

  async grantCalendarAccess(data: InsertUserCalendarAccess): Promise<UserCalendarAccess> {
    const existing = await db
      .select()
      .from(userCalendarAccess)
      .where(
        and(
          eq(userCalendarAccess.userId, data.userId),
          eq(userCalendarAccess.canAccessUserId, data.canAccessUserId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const [newAccess] = await db
      .insert(userCalendarAccess)
      .values(data)
      .returning();
    return newAccess;
  }

  async revokeCalendarAccess(userId: string, canAccessUserId: string): Promise<void> {
    await db
      .delete(userCalendarAccess)
      .where(
        and(
          eq(userCalendarAccess.userId, userId),
          eq(userCalendarAccess.canAccessUserId, canAccessUserId)
        )
      );
  }

  async setCalendarAccessForUser(
    userId: string,
    canAccessUserIds: string[],
    grantedBy: string
  ): Promise<void> {
    await db.delete(userCalendarAccess).where(eq(userCalendarAccess.userId, userId));

    if (canAccessUserIds.length > 0) {
      await db.insert(userCalendarAccess).values(
        canAccessUserIds.map(canAccessUserId => ({
          userId,
          canAccessUserId,
          grantedBy,
        }))
      );
    }
  }

  async canUserAccessCalendar(userId: string, targetUserId: string): Promise<boolean> {
    if (userId === targetUserId) return true;
    
    const result = await db
      .select()
      .from(userCalendarAccess)
      .where(
        and(
          eq(userCalendarAccess.userId, userId),
          eq(userCalendarAccess.canAccessUserId, targetUserId)
        )
      )
      .limit(1);

    return result.length > 0;
  }
}

export const calendarAccessStorage = new CalendarAccessStorage();
