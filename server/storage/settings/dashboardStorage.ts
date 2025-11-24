import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db';
import {
  dashboards,
  type Dashboard,
  type InsertDashboard,
  type UpdateDashboard,
} from '@shared/schema';

export class DashboardStorage {
  async createDashboard(dashboard: InsertDashboard): Promise<Dashboard> {
    const [newDashboard] = await db
      .insert(dashboards)
      .values(dashboard)
      .returning();
    return newDashboard;
  }

  async getDashboardsByUserId(userId: string): Promise<Dashboard[]> {
    const userDashboards = await db
      .select()
      .from(dashboards)
      .where(eq(dashboards.userId, userId))
      .orderBy(desc(dashboards.createdAt));
    return userDashboards;
  }

  async getSharedDashboards(): Promise<Dashboard[]> {
    const shared = await db
      .select()
      .from(dashboards)
      .where(eq(dashboards.visibility, 'shared'))
      .orderBy(desc(dashboards.createdAt));
    return shared;
  }

  async getDashboardById(id: string): Promise<Dashboard | undefined> {
    const [dashboard] = await db
      .select()
      .from(dashboards)
      .where(eq(dashboards.id, id));
    return dashboard;
  }

  async updateDashboard(id: string, dashboard: UpdateDashboard): Promise<Dashboard> {
    const [updated] = await db
      .update(dashboards)
      .set({
        ...dashboard,
        updatedAt: new Date(),
      })
      .where(eq(dashboards.id, id))
      .returning();
    
    if (!updated) {
      throw new Error(`Dashboard not found with id ${id}`);
    }
    
    return updated;
  }

  async deleteDashboard(id: string): Promise<void> {
    await db
      .delete(dashboards)
      .where(eq(dashboards.id, id));
  }

  async getHomescreenDashboard(userId: string): Promise<Dashboard | undefined> {
    const [dashboard] = await db
      .select()
      .from(dashboards)
      .where(and(
        eq(dashboards.userId, userId),
        eq(dashboards.isHomescreenDashboard, true)
      ));
    return dashboard;
  }

  async clearHomescreenDashboards(userId: string): Promise<void> {
    await db
      .update(dashboards)
      .set({ isHomescreenDashboard: false })
      .where(eq(dashboards.userId, userId));
  }
}
