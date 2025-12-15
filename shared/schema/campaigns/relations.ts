import { relations } from 'drizzle-orm';
import {
  contactPreferences,
  campaignTemplates,
  campaigns,
  campaignTargetCriteria,
  campaignMessages,
  campaignRecipients,
  campaignEngagement,
  clientEngagementScores,
  campaignDeliveryQueue,
} from './tables';
import { users } from '../users/tables';
import { clients, people } from '../clients/tables';

export const contactPreferencesRelations = relations(contactPreferences, ({ one }) => ({
  person: one(people, {
    fields: [contactPreferences.personId],
    references: [people.id],
  }),
}));

export const campaignTemplatesRelations = relations(campaignTemplates, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [campaignTemplates.createdByUserId],
    references: [users.id],
  }),
  campaigns: many(campaigns),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  template: one(campaignTemplates, {
    fields: [campaigns.templateId],
    references: [campaignTemplates.id],
  }),
  createdBy: one(users, {
    fields: [campaigns.createdByUserId],
    references: [users.id],
  }),
  reviewedBy: one(users, {
    fields: [campaigns.reviewedByUserId],
    references: [users.id],
  }),
  approvedBy: one(users, {
    fields: [campaigns.approvedByUserId],
    references: [users.id],
  }),
  previewConfirmedBy: one(users, {
    fields: [campaigns.previewConfirmedByUserId],
    references: [users.id],
  }),
  parentCampaign: one(campaigns, {
    fields: [campaigns.parentCampaignId],
    references: [campaigns.id],
  }),
  targetCriteria: many(campaignTargetCriteria),
  messages: many(campaignMessages),
  recipients: many(campaignRecipients),
  engagement: many(campaignEngagement),
}));

export const campaignTargetCriteriaRelations = relations(campaignTargetCriteria, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignTargetCriteria.campaignId],
    references: [campaigns.id],
  }),
}));

export const campaignMessagesRelations = relations(campaignMessages, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignMessages.campaignId],
    references: [campaigns.id],
  }),
}));

export const campaignRecipientsRelations = relations(campaignRecipients, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [campaignRecipients.campaignId],
    references: [campaigns.id],
  }),
  client: one(clients, {
    fields: [campaignRecipients.clientId],
    references: [clients.id],
  }),
  person: one(people, {
    fields: [campaignRecipients.personId],
    references: [people.id],
  }),
  removedBy: one(users, {
    fields: [campaignRecipients.removedByUserId],
    references: [users.id],
  }),
  engagement: many(campaignEngagement),
  deliveryQueue: many(campaignDeliveryQueue),
}));

export const campaignEngagementRelations = relations(campaignEngagement, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignEngagement.campaignId],
    references: [campaigns.id],
  }),
  recipient: one(campaignRecipients, {
    fields: [campaignEngagement.recipientId],
    references: [campaignRecipients.id],
  }),
}));

export const clientEngagementScoresRelations = relations(clientEngagementScores, ({ one }) => ({
  client: one(clients, {
    fields: [clientEngagementScores.clientId],
    references: [clients.id],
  }),
}));

export const campaignDeliveryQueueRelations = relations(campaignDeliveryQueue, ({ one }) => ({
  recipient: one(campaignRecipients, {
    fields: [campaignDeliveryQueue.recipientId],
    references: [campaignRecipients.id],
  }),
}));
