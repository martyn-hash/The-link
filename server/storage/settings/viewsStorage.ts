import { eq, desc } from 'drizzle-orm';
import { db } from '../../db';
import {
  projectViews,
  companyViews,
  type ProjectView,
  type InsertProjectView,
  type CompanyView,
  type InsertCompanyView,
} from '@shared/schema';

export class ViewsStorage {
  async createProjectView(view: InsertProjectView): Promise<ProjectView> {
    const [newView] = await db
      .insert(projectViews)
      .values(view)
      .returning();
    return newView;
  }

  async getProjectViewsByUserId(userId: string): Promise<ProjectView[]> {
    const views = await db
      .select()
      .from(projectViews)
      .where(eq(projectViews.userId, userId))
      .orderBy(desc(projectViews.createdAt));
    return views;
  }

  async updateProjectView(id: string, updates: Partial<InsertProjectView>): Promise<ProjectView | null> {
    const [updated] = await db
      .update(projectViews)
      .set(updates)
      .where(eq(projectViews.id, id))
      .returning();
    return updated || null;
  }

  async deleteProjectView(id: string): Promise<void> {
    await db
      .delete(projectViews)
      .where(eq(projectViews.id, id));
  }

  async createCompanyView(view: InsertCompanyView): Promise<CompanyView> {
    const [newView] = await db
      .insert(companyViews)
      .values(view)
      .returning();
    return newView;
  }

  async getCompanyViewsByUserId(userId: string): Promise<CompanyView[]> {
    const views = await db
      .select()
      .from(companyViews)
      .where(eq(companyViews.userId, userId))
      .orderBy(desc(companyViews.createdAt));
    return views;
  }

  async deleteCompanyView(id: string): Promise<void> {
    await db
      .delete(companyViews)
      .where(eq(companyViews.id, id));
  }
}
