import { pgTable, varchar, text, timestamp, boolean, index, unique, jsonb, integer, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../users/tables';
import { clients, people } from '../clients/tables';

export const campaignCategoryEnum = pgEnum('campaign_category', ['chase', 'informational', 'upsell', 'engagement']);

export const campaignStatusEnum = pgEnum('campaign_status', ['draft', 'review', 'approved', 'scheduled', 'sending', 'sent', 'paused', 'cancelled']);

export const channelEnum = pgEnum('channel', ['email', 'sms', 'voice']);

export const recipientStatusEnum = pgEnum('recipient_status', ['pending', 'queued', 'sending', 'sent', 'delivered', 'bounced', 'failed', 'excluded', 'opted_out']);

export const engagementEventEnum = pgEnum('engagement_event', ['queued', 'sent', 'delivered', 'bounced', 'opened', 'clicked', 'page_viewed', 'action_clicked', 'action_completed', 'unsubscribed', 'spam_report', 'failed']);

export const queueStatusEnum = pgEnum('queue_status', ['pending', 'processing', 'completed', 'failed_permanent']);

export const contactPreferences = pgTable("contact_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: varchar("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  channel: channelEnum("channel").notNull(),
  category: campaignCategoryEnum("category").notNull(),
  optedOut: boolean("opted_out").default(false),
  optedOutAt: timestamp("opted_out_at"),
  optedOutReason: text("opted_out_reason"),
  optedOutVia: varchar("opted_out_via"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_contact_preferences_person_id").on(table.personId),
  index("idx_contact_preferences_channel").on(table.channel),
  index("idx_contact_preferences_category").on(table.category),
  unique("unique_person_channel_category").on(table.personId, table.channel, table.category),
]);

export const preferenceTokens = pgTable("preference_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token", { length: 64 }).notNull().unique(),
  personId: varchar("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_preference_tokens_token").on(table.token),
  index("idx_preference_tokens_person_id").on(table.personId),
  index("idx_preference_tokens_expires_at").on(table.expiresAt),
]);

export const campaignTemplates = pgTable("campaign_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  category: campaignCategoryEnum("category"),
  targetCriteriaTemplate: jsonb("target_criteria_template"),
  recipientRules: jsonb("recipient_rules"),
  channels: jsonb("channels"),
  emailSubject: varchar("email_subject"),
  emailBody: text("email_body"),
  smsContent: varchar("sms_content", { length: 160 }),
  voiceScript: text("voice_script"),
  pageTemplateId: varchar("page_template_id"),
  isActive: boolean("is_active").default(true),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_campaign_templates_category").on(table.category),
  index("idx_campaign_templates_is_active").on(table.isActive),
  index("idx_campaign_templates_created_by").on(table.createdByUserId),
]);

export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  category: campaignCategoryEnum("category"),
  status: campaignStatusEnum("status").default('draft'),
  templateId: varchar("template_id").references(() => campaignTemplates.id),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  approvedByUserId: varchar("approved_by_user_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  scheduledFor: timestamp("scheduled_for"),
  sendingStartedAt: timestamp("sending_started_at"),
  sentAt: timestamp("sent_at"),
  targetCriteria: jsonb("target_criteria"),
  recipientRules: jsonb("recipient_rules"),
  targetCriteriaSnapshot: jsonb("target_criteria_snapshot"),
  recipientCountSnapshot: integer("recipient_count_snapshot"),
  pageId: varchar("page_id"),
  isSequence: boolean("is_sequence").default(false),
  parentCampaignId: varchar("parent_campaign_id"),
  sequenceOrder: integer("sequence_order"),
  sequenceCondition: jsonb("sequence_condition"),
  previewConfirmedAt: timestamp("preview_confirmed_at"),
  previewConfirmedByUserId: varchar("preview_confirmed_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_campaigns_status").on(table.status),
  index("idx_campaigns_category").on(table.category),
  index("idx_campaigns_created_by").on(table.createdByUserId),
  index("idx_campaigns_scheduled_for").on(table.scheduledFor),
  index("idx_campaigns_parent_campaign").on(table.parentCampaignId),
]);

export const campaignTargetCriteria = pgTable("campaign_target_criteria", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  filterGroup: integer("filter_group"),
  filterType: varchar("filter_type").notNull(),
  operator: varchar("operator").notNull(),
  value: jsonb("value"),
  sortOrder: integer("sort_order"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_campaign_target_criteria_campaign").on(table.campaignId),
]);

export const campaignMessages = pgTable("campaign_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  channel: channelEnum("channel").notNull(),
  subject: varchar("subject"),
  body: text("body"),
  plainTextBody: text("plain_text_body"),
  voiceScript: text("voice_script"),
  attachments: jsonb("attachments"),
  mergeFieldsUsed: text("merge_fields_used").array(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_campaign_messages_campaign").on(table.campaignId),
  index("idx_campaign_messages_channel").on(table.channel),
]);

export const campaignRecipients = pgTable("campaign_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  personId: varchar("person_id").notNull().references(() => people.id),
  channel: channelEnum("channel").notNull(),
  channelAddress: varchar("channel_address").notNull(),
  inclusionReason: text("inclusion_reason"),
  lastCampaignReceivedAt: timestamp("last_campaign_received_at"),
  lastCampaignCategory: varchar("last_campaign_category"),
  status: recipientStatusEnum("status").default('pending'),
  manuallyAdded: boolean("manually_added").default(false),
  manuallyRemoved: boolean("manually_removed").default(false),
  removedByUserId: varchar("removed_by_user_id").references(() => users.id),
  removedReason: text("removed_reason"),
  resolvedMergeData: jsonb("resolved_merge_data"),
  renderedContent: jsonb("rendered_content"),
  queuedAt: timestamp("queued_at"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  openCount: integer("open_count").default(0),
  clickedAt: timestamp("clicked_at"),
  clickCount: integer("click_count").default(0),
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  lastRetryAt: timestamp("last_retry_at"),
  externalMessageId: varchar("external_message_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_campaign_recipients_campaign").on(table.campaignId),
  index("idx_campaign_recipients_client").on(table.clientId),
  index("idx_campaign_recipients_person").on(table.personId),
  index("idx_campaign_recipients_channel").on(table.channel),
  index("idx_campaign_recipients_status").on(table.status),
  index("idx_campaign_recipients_last_campaign").on(table.lastCampaignReceivedAt),
]);

export const campaignEngagement = pgTable("campaign_engagement", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  recipientId: varchar("recipient_id").notNull().references(() => campaignRecipients.id, { onDelete: "cascade" }),
  eventType: engagementEventEnum("event_type").notNull(),
  channel: channelEnum("channel").notNull(),
  eventData: jsonb("event_data"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_campaign_engagement_campaign").on(table.campaignId),
  index("idx_campaign_engagement_recipient").on(table.recipientId),
  index("idx_campaign_engagement_event_type").on(table.eventType),
  index("idx_campaign_engagement_timestamp").on(table.timestamp),
]);

export const clientEngagementScores = pgTable("client_engagement_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  totalScore: integer("total_score").default(0),
  emailsReceived: integer("emails_received").default(0),
  emailsOpened: integer("emails_opened").default(0),
  emailsClicked: integer("emails_clicked").default(0),
  smsReceived: integer("sms_received").default(0),
  smsClicked: integer("sms_clicked").default(0),
  pagesViewed: integer("pages_viewed").default(0),
  actionsCompleted: integer("actions_completed").default(0),
  lastEngagementAt: timestamp("last_engagement_at"),
  lastCampaignSentAt: timestamp("last_campaign_sent_at"),
  consecutiveIgnored: integer("consecutive_ignored").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_client_engagement").on(table.clientId),
  index("idx_client_engagement_scores_client").on(table.clientId),
  index("idx_client_engagement_scores_score").on(table.totalScore),
  index("idx_client_engagement_scores_last").on(table.lastEngagementAt),
]);

export const campaignDeliveryQueue = pgTable("campaign_delivery_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipientId: varchar("recipient_id").notNull().references(() => campaignRecipients.id, { onDelete: "cascade" }),
  channel: channelEnum("channel").notNull(),
  priority: integer("priority").default(5),
  status: queueStatusEnum("status").default('pending'),
  attemptCount: integer("attempt_count").default(0),
  maxAttempts: integer("max_attempts").default(3),
  nextAttemptAt: timestamp("next_attempt_at"),
  lastAttemptAt: timestamp("last_attempt_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_delivery_queue_status").on(table.status),
  index("idx_delivery_queue_next_attempt").on(table.nextAttemptAt),
  index("idx_delivery_queue_priority").on(table.priority),
]);
