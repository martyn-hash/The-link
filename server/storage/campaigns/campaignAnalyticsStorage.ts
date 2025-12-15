import { BaseStorage } from '../base/BaseStorage.js';
import { db } from '../../db.js';
import { campaignEngagement, clientEngagementScores } from '@shared/schema';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import type {
  CampaignEngagement,
  InsertCampaignEngagement,
  ClientEngagementScore,
  InsertClientEngagementScore,
  UpdateClientEngagementScore,
} from '@shared/schema';

export class CampaignAnalyticsStorage extends BaseStorage {
  async createEngagementEvent(data: InsertCampaignEngagement): Promise<CampaignEngagement> {
    const [event] = await db.insert(campaignEngagement).values(data).returning();
    return event;
  }

  async getEngagementByCampaignId(campaignId: string): Promise<CampaignEngagement[]> {
    return db.select().from(campaignEngagement)
      .where(eq(campaignEngagement.campaignId, campaignId))
      .orderBy(desc(campaignEngagement.timestamp));
  }

  async getEngagementByRecipientId(recipientId: string): Promise<CampaignEngagement[]> {
    return db.select().from(campaignEngagement)
      .where(eq(campaignEngagement.recipientId, recipientId))
      .orderBy(desc(campaignEngagement.timestamp));
  }

  async countEngagementByType(campaignId: string): Promise<Record<string, number>> {
    const results = await db
      .select({
        eventType: campaignEngagement.eventType,
        count: sql<number>`count(*)::int`
      })
      .from(campaignEngagement)
      .where(eq(campaignEngagement.campaignId, campaignId))
      .groupBy(campaignEngagement.eventType);
    
    return results.reduce((acc, { eventType, count }) => {
      if (eventType) acc[eventType] = count;
      return acc;
    }, {} as Record<string, number>);
  }

  async getClientEngagementScore(clientId: string): Promise<ClientEngagementScore | undefined> {
    const [score] = await db.select().from(clientEngagementScores)
      .where(eq(clientEngagementScores.clientId, clientId));
    return score;
  }

  async upsertClientEngagementScore(clientId: string, data: Partial<InsertClientEngagementScore>): Promise<ClientEngagementScore> {
    const existing = await this.getClientEngagementScore(clientId);
    
    if (existing) {
      const [updated] = await db
        .update(clientEngagementScores)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(clientEngagementScores.clientId, clientId))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(clientEngagementScores)
      .values({ clientId, ...data })
      .returning();
    return created;
  }

  async updateEngagementScore(clientId: string, eventType: string): Promise<ClientEngagementScore> {
    const existing = await this.getClientEngagementScore(clientId);
    
    const scoreDeltas: Record<string, { field: keyof UpdateClientEngagementScore; scorePoints: number }> = {
      'email_opened': { field: 'emailsOpened', scorePoints: 1 },
      'email_clicked': { field: 'emailsClicked', scorePoints: 2 },
      'sms_clicked': { field: 'smsClicked', scorePoints: 2 },
      'page_viewed': { field: 'pagesViewed', scorePoints: 2 },
      'action_completed': { field: 'actionsCompleted', scorePoints: 5 },
    };

    const delta = scoreDeltas[eventType];
    if (!delta) {
      return existing ?? await this.upsertClientEngagementScore(clientId, {});
    }

    const updates: UpdateClientEngagementScore = {
      lastEngagementAt: new Date(),
      consecutiveIgnored: 0,
    };

    if (existing) {
      (updates as any)[delta.field] = ((existing[delta.field] as number) ?? 0) + 1;
      updates.totalScore = (existing.totalScore ?? 0) + delta.scorePoints;
    } else {
      (updates as any)[delta.field] = 1;
      updates.totalScore = delta.scorePoints;
    }

    return this.upsertClientEngagementScore(clientId, updates);
  }

  async incrementCampaignIgnored(clientId: string): Promise<ClientEngagementScore> {
    const existing = await this.getClientEngagementScore(clientId);
    
    const consecutiveIgnored = ((existing?.consecutiveIgnored ?? 0) + 1);
    const totalScore = Math.max(0, (existing?.totalScore ?? 0) - 1);

    return this.upsertClientEngagementScore(clientId, {
      consecutiveIgnored,
      totalScore,
    });
  }

  async getTopEngagedClients(limit: number = 10): Promise<ClientEngagementScore[]> {
    return db.select().from(clientEngagementScores)
      .orderBy(desc(clientEngagementScores.totalScore))
      .limit(limit);
  }

  async getLeastEngagedClients(limit: number = 10): Promise<ClientEngagementScore[]> {
    return db.select().from(clientEngagementScores)
      .orderBy(sql`${clientEngagementScores.totalScore} ASC`)
      .limit(limit);
  }

  async getCampaignStats(campaignId: string): Promise<{
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    failed: number;
    openRate: number;
    clickRate: number;
  }> {
    const counts = await this.countEngagementByType(campaignId);
    
    const sent = counts['sent'] ?? 0;
    const delivered = counts['delivered'] ?? 0;
    const opened = counts['opened'] ?? 0;
    const clicked = counts['clicked'] ?? 0;
    const bounced = counts['bounced'] ?? 0;
    const failed = counts['failed'] ?? 0;
    
    const openRate = delivered > 0 ? (opened / delivered) * 100 : 0;
    const clickRate = opened > 0 ? (clicked / opened) * 100 : 0;
    
    return {
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      failed,
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
    };
  }
}

export const campaignAnalyticsStorage = new CampaignAnalyticsStorage();
