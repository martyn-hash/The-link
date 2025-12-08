import { db } from "../../db";
import { eq } from "drizzle-orm";
import {
  smsTemplates,
  type SmsTemplate,
  type InsertSmsTemplate,
} from "@shared/schema";

export class SmsTemplateStorage {
  async getAllSmsTemplates(): Promise<SmsTemplate[]> {
    return await db
      .select()
      .from(smsTemplates)
      .orderBy(smsTemplates.name);
  }

  async getActiveSmsTemplates(): Promise<SmsTemplate[]> {
    return await db
      .select()
      .from(smsTemplates)
      .where(eq(smsTemplates.isActive, true))
      .orderBy(smsTemplates.name);
  }

  async getSmsTemplateById(id: string): Promise<SmsTemplate | undefined> {
    const results = await db
      .select()
      .from(smsTemplates)
      .where(eq(smsTemplates.id, id))
      .limit(1);
    return results[0];
  }

  async createSmsTemplate(template: InsertSmsTemplate): Promise<SmsTemplate> {
    const [newTemplate] = await db
      .insert(smsTemplates)
      .values(template)
      .returning();
    return newTemplate;
  }

  async updateSmsTemplate(id: string, template: Partial<InsertSmsTemplate>): Promise<SmsTemplate> {
    const [updated] = await db
      .update(smsTemplates)
      .set({
        ...template,
        updatedAt: new Date(),
      })
      .where(eq(smsTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteSmsTemplate(id: string): Promise<void> {
    await db.delete(smsTemplates).where(eq(smsTemplates.id, id));
  }
}
