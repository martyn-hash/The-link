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
import {
  insertContactPreferenceSchema,
  updateContactPreferenceSchema,
  insertPreferenceTokenSchema,
  insertCampaignTemplateSchema,
  updateCampaignTemplateSchema,
  insertCampaignSchema,
  updateCampaignSchema,
  insertCampaignTargetCriteriaSchema,
  insertCampaignMessageSchema,
  updateCampaignMessageSchema,
  insertCampaignRecipientSchema,
  updateCampaignRecipientSchema,
  insertCampaignEngagementSchema,
  insertClientEngagementScoreSchema,
  updateClientEngagementScoreSchema,
  insertCampaignDeliveryQueueSchema,
  updateCampaignDeliveryQueueSchema,
  optOutRequestSchema,
  targetCriteriaFilterSchema,
} from './schemas';

export type ContactPreference = typeof contactPreferences.$inferSelect;
export type InsertContactPreference = z.infer<typeof insertContactPreferenceSchema>;
export type UpdateContactPreference = z.infer<typeof updateContactPreferenceSchema>;

export type PreferenceToken = typeof preferenceTokens.$inferSelect;
export type InsertPreferenceToken = z.infer<typeof insertPreferenceTokenSchema>;

export type CampaignTemplate = typeof campaignTemplates.$inferSelect;
export type InsertCampaignTemplate = z.infer<typeof insertCampaignTemplateSchema>;
export type UpdateCampaignTemplate = z.infer<typeof updateCampaignTemplateSchema>;

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type UpdateCampaign = z.infer<typeof updateCampaignSchema>;

export type CampaignTargetCriteria = typeof campaignTargetCriteria.$inferSelect;
export type InsertCampaignTargetCriteria = z.infer<typeof insertCampaignTargetCriteriaSchema>;

export type CampaignMessage = typeof campaignMessages.$inferSelect;
export type InsertCampaignMessage = z.infer<typeof insertCampaignMessageSchema>;
export type UpdateCampaignMessage = z.infer<typeof updateCampaignMessageSchema>;

export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type InsertCampaignRecipient = z.infer<typeof insertCampaignRecipientSchema>;
export type UpdateCampaignRecipient = z.infer<typeof updateCampaignRecipientSchema>;

export type CampaignEngagement = typeof campaignEngagement.$inferSelect;
export type InsertCampaignEngagement = z.infer<typeof insertCampaignEngagementSchema>;

export type ClientEngagementScore = typeof clientEngagementScores.$inferSelect;
export type InsertClientEngagementScore = z.infer<typeof insertClientEngagementScoreSchema>;
export type UpdateClientEngagementScore = z.infer<typeof updateClientEngagementScoreSchema>;

export type CampaignDeliveryQueue = typeof campaignDeliveryQueue.$inferSelect;
export type InsertCampaignDeliveryQueue = z.infer<typeof insertCampaignDeliveryQueueSchema>;
export type UpdateCampaignDeliveryQueue = z.infer<typeof updateCampaignDeliveryQueueSchema>;

export type OptOutRequest = z.infer<typeof optOutRequestSchema>;
export type TargetCriteriaFilter = z.infer<typeof targetCriteriaFilterSchema>;

export type CampaignCategory = 'chase' | 'informational' | 'upsell' | 'engagement';
export type CampaignStatus = 'draft' | 'review' | 'approved' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled';
export type Channel = 'email' | 'sms' | 'voice';
export type RecipientStatus = 'pending' | 'queued' | 'sending' | 'sent' | 'delivered' | 'bounced' | 'failed' | 'excluded' | 'opted_out';
export type EngagementEventType = 'queued' | 'sent' | 'delivered' | 'bounced' | 'opened' | 'clicked' | 'page_viewed' | 'action_clicked' | 'action_completed' | 'unsubscribed' | 'spam_report' | 'failed';
export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed_permanent';

export interface CampaignWithDetails extends Campaign {
  template?: CampaignTemplate | null;
  createdBy?: { id: string; fullName: string } | null;
  targetCriteria: CampaignTargetCriteria[];
  messages: CampaignMessage[];
  recipientCount?: number;
}

export interface RecipientRules {
  strategy: 'primary_only' | 'all_contacts' | 'role_based';
  roles?: string[];
  channels: Channel[];
}

export interface RenderedContent {
  subject?: string;
  body?: string;
  plainTextBody?: string;
  smsContent?: string;
  voiceScript?: string;
}
