import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { contactPreferences, preferenceTokens } from '@shared/schema';
import { eq, and, desc, lte } from 'drizzle-orm';
import type { ContactPreference, InsertContactPreference, UpdateContactPreference, PreferenceToken, InsertPreferenceToken } from '@shared/schema';
import { nanoid } from 'nanoid';

export class ContactPreferencesStorage extends BaseStorage {
  async create(data: InsertContactPreference): Promise<ContactPreference> {
    const [preference] = await db.insert(contactPreferences).values(data).returning();
    return preference;
  }

  async getById(id: string): Promise<ContactPreference | undefined> {
    const [preference] = await db.select().from(contactPreferences).where(eq(contactPreferences.id, id));
    return preference;
  }

  async getByPersonId(personId: string): Promise<ContactPreference[]> {
    return db.select().from(contactPreferences)
      .where(eq(contactPreferences.personId, personId))
      .orderBy(desc(contactPreferences.createdAt));
  }

  async getByPersonIdAndChannel(personId: string, channel: string): Promise<ContactPreference[]> {
    return db.select().from(contactPreferences)
      .where(and(
        eq(contactPreferences.personId, personId),
        eq(contactPreferences.channel, channel as any)
      ));
  }

  async getPreference(personId: string, channel: string, category: string): Promise<ContactPreference | undefined> {
    const [preference] = await db.select().from(contactPreferences)
      .where(and(
        eq(contactPreferences.personId, personId),
        eq(contactPreferences.channel, channel as any),
        eq(contactPreferences.category, category as any)
      ));
    return preference;
  }

  async update(id: string, data: UpdateContactPreference): Promise<ContactPreference> {
    const [preference] = await db
      .update(contactPreferences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contactPreferences.id, id))
      .returning();
    
    if (!preference) {
      throw new Error(`Contact preference with ID '${id}' not found`);
    }
    
    return preference;
  }

  async delete(id: string): Promise<void> {
    await db.delete(contactPreferences).where(eq(contactPreferences.id, id));
  }

  async optOut(personId: string, channel: string, category: string, via: string, reason?: string): Promise<ContactPreference> {
    const existing = await this.getPreference(personId, channel, category);
    
    const optOutData = {
      optedOut: true,
      optedOutAt: new Date(),
      optedOutVia: via,
      optedOutReason: reason,
    };
    
    if (existing) {
      return this.update(existing.id, optOutData);
    }
    
    return this.create({
      personId,
      channel: channel as any,
      category: category as any,
      ...optOutData,
    });
  }

  async optIn(personId: string, channel: string, category: string): Promise<ContactPreference> {
    const existing = await this.getPreference(personId, channel, category);
    
    if (existing) {
      return this.update(existing.id, {
        optedOut: false,
        optedOutAt: null,
        optedOutVia: null,
        optedOutReason: null,
      });
    }
    
    return this.create({
      personId,
      channel: channel as any,
      category: category as any,
      optedOut: false,
    });
  }

  async isOptedOut(personId: string, channel: string, category: string): Promise<boolean> {
    const preference = await this.getPreference(personId, channel, category);
    if (preference?.optedOut) return true;
    
    const allCategoryPreference = await this.getPreference(personId, channel, 'chase');
    return allCategoryPreference?.optedOut ?? false;
  }

  async getOptedOutCategories(personId: string, channel: string): Promise<string[]> {
    const preferences = await this.getByPersonIdAndChannel(personId, channel);
    return preferences
      .filter(p => p.optedOut)
      .map(p => p.category ?? '')
      .filter(Boolean);
  }

  async optOutAll(personId: string, channel: string, via: string, reason?: string): Promise<void> {
    const categories = ['chase', 'informational', 'upsell', 'engagement'] as const;
    
    for (const category of categories) {
      await this.optOut(personId, channel, category, via, reason);
    }
  }

  async createPreferenceToken(personId: string, expiryDays: number = 30): Promise<string> {
    const token = nanoid(32);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);
    
    await db.insert(preferenceTokens).values({
      token,
      personId,
      expiresAt,
    });
    
    return token;
  }

  async validatePreferenceToken(token: string): Promise<string | null> {
    const [tokenRecord] = await db.select()
      .from(preferenceTokens)
      .where(eq(preferenceTokens.token, token));
    
    if (!tokenRecord) return null;
    if (new Date() > tokenRecord.expiresAt) return null;
    
    return tokenRecord.personId;
  }

  async markTokenUsed(token: string): Promise<void> {
    await db.update(preferenceTokens)
      .set({ usedAt: new Date() })
      .where(eq(preferenceTokens.token, token));
  }

  async cleanupExpiredTokens(): Promise<number> {
    const now = new Date();
    const result = await db.delete(preferenceTokens)
      .where(lte(preferenceTokens.expiresAt, now));
    return 0;
  }
}

export const contactPreferencesStorage = new ContactPreferencesStorage();
