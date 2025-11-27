import { z } from "zod";
import { webhookConfigs, webhookLogs } from "./tables";
import {
  insertWebhookConfigSchema,
  updateWebhookConfigSchema,
  insertWebhookLogSchema,
  sendWebhookRequestSchema,
  webhookPayloadSchema,
} from "./schemas";

export type WebhookConfig = typeof webhookConfigs.$inferSelect;
export type InsertWebhookConfig = z.infer<typeof insertWebhookConfigSchema>;
export type UpdateWebhookConfig = z.infer<typeof updateWebhookConfigSchema>;

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;

export type SendWebhookRequest = z.infer<typeof sendWebhookRequestSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

export type WebhookConfigWithStatus = WebhookConfig & {
  isAvailable: boolean;
  unavailableReason?: string;
};

export type WebhookLogWithDetails = WebhookLog & {
  webhookName: string;
  triggeredByName: string;
};
