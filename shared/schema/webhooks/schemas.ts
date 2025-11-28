import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { webhookConfigs, webhookLogs } from "./tables";

export const insertWebhookConfigSchema = createInsertSchema(webhookConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateWebhookConfigSchema = insertWebhookConfigSchema.partial();

export const insertWebhookLogSchema = createInsertSchema(webhookLogs).omit({
  id: true,
  sentAt: true,
});

export const sendWebhookRequestSchema = z.object({
  webhookConfigIds: z.array(z.string()).min(1, "Select at least one webhook"),
});

export const webhookPayloadSchema = z.record(z.string(), z.any()).and(
  z.object({
    client_id: z.string(),
    client_name: z.string(),
    person_count: z.number(),
    metadata_sentAt: z.string(),
    metadata_sentBy: z.string(),
    metadata_webhookName: z.string(),
    metadata_source: z.string(),
  })
);
