import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import {
  contactPreferences,
  preferenceTokens,
  campaignTemplates,
  campaigns,
  campaignTargetCriteria,
  campaignMessages,
  campaignRecipients,
  campaignEngagement,
  clientEngagementScores,
  campaignDeliveryQueue,
} from './tables';

export const insertContactPreferenceSchema = createInsertSchema(contactPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateContactPreferenceSchema = insertContactPreferenceSchema.partial().omit({
  personId: true,
});

export const insertPreferenceTokenSchema = createInsertSchema(preferenceTokens).omit({
  id: true,
  createdAt: true,
});

export const insertCampaignTemplateSchema = createInsertSchema(campaignTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCampaignTemplateSchema = insertCampaignTemplateSchema.partial();

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCampaignSchema = insertCampaignSchema.partial();

export const insertCampaignTargetCriteriaSchema = createInsertSchema(campaignTargetCriteria).omit({
  id: true,
  createdAt: true,
});

export const insertCampaignMessageSchema = createInsertSchema(campaignMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCampaignMessageSchema = insertCampaignMessageSchema.partial().omit({
  campaignId: true,
});

export const insertCampaignRecipientSchema = createInsertSchema(campaignRecipients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCampaignRecipientSchema = insertCampaignRecipientSchema.partial().omit({
  campaignId: true,
  clientId: true,
  personId: true,
});

export const insertCampaignEngagementSchema = createInsertSchema(campaignEngagement).omit({
  id: true,
  timestamp: true,
});

export const insertClientEngagementScoreSchema = createInsertSchema(clientEngagementScores).omit({
  id: true,
  updatedAt: true,
});

export const updateClientEngagementScoreSchema = insertClientEngagementScoreSchema.partial().omit({
  clientId: true,
});

export const insertCampaignDeliveryQueueSchema = createInsertSchema(campaignDeliveryQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCampaignDeliveryQueueSchema = insertCampaignDeliveryQueueSchema.partial().omit({
  recipientId: true,
});

export const optOutRequestSchema = z.object({
  channel: z.enum(['email', 'sms', 'voice']),
  category: z.enum(['chase', 'informational', 'upsell', 'engagement', 'all']),
  reason: z.string().optional(),
});

export const targetCriteriaFilterSchema = z.object({
  filterGroup: z.number().optional(),
  filterType: z.string(),
  operator: z.string(),
  value: z.any(),
  sortOrder: z.number().optional(),
});
