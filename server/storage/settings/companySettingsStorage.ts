import { eq } from 'drizzle-orm';
import { db } from '../../db';
import {
  companySettings,
  type CompanySettings,
  type UpdateCompanySettings,
} from '@shared/schema';

export class CompanySettingsStorage {
  async getCompanySettings(): Promise<CompanySettings | undefined> {
    const [settings] = await db
      .select()
      .from(companySettings)
      .limit(1);
    return settings;
  }

  async updateCompanySettings(settings: UpdateCompanySettings): Promise<CompanySettings> {
    const { nanoid } = await import('nanoid');
    
    const existing = await this.getCompanySettings();
    
    if (existing) {
      const [updated] = await db
        .update(companySettings)
        .set({
          ...settings,
          updatedAt: new Date(),
        })
        .where(eq(companySettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(companySettings)
        .values({
          id: nanoid(),
          emailSenderName: settings.emailSenderName || "The Link Team",
        })
        .returning();
      return created;
    }
  }
}
