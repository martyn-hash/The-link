import { db } from "../../db";
import { eq, desc, and, gte, lte, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  userActivityTracking,
  users,
  clients,
  people,
  projects,
  communications,
  type UserActivityTracking,
  type User,
} from "@shared/schema";

export class UserActivityStorage {
  // Reference to storage facade for entity fetching (will be injected after construction)
  private storage: any;

  constructor() {
    // Storage reference will be set via setStorage after facade is constructed
  }

  setStorage(storage: any) {
    this.storage = storage;
  }

  async trackUserActivity(userId: string, entityType: string, entityId: string): Promise<void> {
    try {
      // Only track entity types that are in the enum
      const validEntityTypes = ['client', 'project', 'person', 'communication'];
      if (!validEntityTypes.includes(entityType)) {
        // Silently skip invalid entity types - they may be legacy or not yet supported
        return;
      }

      // Insert or update activity tracking (upsert to handle duplicate views)
      await db
        .insert(userActivityTracking)
        .values({
          userId,
          entityType: entityType as any,
          entityId,
        })
        .onConflictDoUpdate({
          target: [userActivityTracking.userId, userActivityTracking.entityType, userActivityTracking.entityId],
          set: {
            viewedAt: sql`now()`,
          },
        });
    } catch (error) {
      console.error('Error tracking user activity:', error);
      // Don't throw error - activity tracking is non-critical
    }
  }

  async getRecentlyViewedByUser(userId: string, limit: number = 10): Promise<{ entityType: string; entityId: string; viewedAt: Date; entityData?: any }[]> {
    try {
      const recentActivities = await db
        .select()
        .from(userActivityTracking)
        .where(eq(userActivityTracking.userId, userId))
        .orderBy(desc(userActivityTracking.viewedAt))
        .limit(limit);


      // Enrich with entity data (if storage reference is available)
      const enrichedActivities = await Promise.all(
        recentActivities.map(async (activity) => {
          let entityData = null;
          if (this.storage) {
            try {
              switch (activity.entityType) {
                case 'client':
                  entityData = await this.storage.getClientById(activity.entityId);
                  break;
                case 'project':
                  entityData = await this.storage.getProject(activity.entityId);
                  break;
                case 'person':
                  entityData = await this.storage.getPersonById(activity.entityId);
                  break;
                case 'communication':
                  // For now, we'll skip enriching communications
                  break;
              }
            } catch (error) {
              console.warn(`Error enriching entity data for ${activity.entityType}:${activity.entityId}:`, error);
            }
          }

          return {
            entityType: activity.entityType,
            entityId: activity.entityId,
            viewedAt: activity.viewedAt!,
            entityData,
          };
        })
      );

      return enrichedActivities;
    } catch (error) {
      console.error('Error getting recently viewed by user:', error);
      return [];
    }
  }

  async getUserActivityTracking(options?: { userId?: string; entityType?: string; dateFrom?: string; dateTo?: string; limit?: number }): Promise<(UserActivityTracking & { user: User; entityName: string | null })[]> {
    let query = db
      .select({
        id: userActivityTracking.id,
        userId: userActivityTracking.userId,
        entityType: userActivityTracking.entityType,
        entityId: userActivityTracking.entityId,
        viewedAt: userActivityTracking.viewedAt,
        user: users,
        clientName: clients.name,
        personName: sql<string>`${people.firstName} || ' ' || ${people.lastName}`,
        projectDescription: projects.description,
        communicationSubject: communications.subject,
      })
      .from(userActivityTracking)
      .innerJoin(users, eq(userActivityTracking.userId, users.id))
      .leftJoin(clients, and(
        sql`entity_type = 'client'`,
        eq(userActivityTracking.entityId, clients.id)
      ))
      .leftJoin(people, and(
        sql`entity_type = 'person'`,
        eq(userActivityTracking.entityId, people.id)
      ))
      .leftJoin(projects, and(
        sql`entity_type = 'project'`,
        eq(userActivityTracking.entityId, projects.id)
      ))
      .leftJoin(communications, and(
        sql`entity_type = 'communication'`,
        eq(userActivityTracking.entityId, communications.id)
      ))
      .orderBy(desc(userActivityTracking.viewedAt));

    const conditions = [];
    
    // Always filter to only valid enum values to prevent enum parsing errors
    conditions.push(sql`entity_type IN ('client', 'project', 'person', 'communication')`);
    
    if (options?.userId) {
      conditions.push(eq(userActivityTracking.userId, options.userId));
    }
    
    if (options?.entityType) {
      conditions.push(eq(userActivityTracking.entityType, options.entityType as any));
    }
    
    if (options?.dateFrom) {
      const fromDate = new Date(options.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      conditions.push(gte(userActivityTracking.viewedAt, fromDate));
    }
    
    if (options?.dateTo) {
      const toDate = new Date(options.dateTo);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(userActivityTracking.viewedAt, toDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }

    const results = await query;
    
    // Map results to include entityName based on entity type
    return results.map(row => ({
      id: row.id,
      userId: row.userId,
      entityType: row.entityType,
      entityId: row.entityId,
      viewedAt: row.viewedAt,
      user: row.user,
      entityName: row.clientName || row.personName || row.projectDescription || row.communicationSubject || null,
    }));
  }
}