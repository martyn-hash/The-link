import { relations } from "drizzle-orm";
import { webhookConfigs, webhookLogs } from "./tables";
import { users } from "../users/tables";
import { clients } from "../clients/tables";

export const webhookConfigsRelations = relations(webhookConfigs, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [webhookConfigs.createdBy],
    references: [users.id],
  }),
  logs: many(webhookLogs),
}));

export const webhookLogsRelations = relations(webhookLogs, ({ one }) => ({
  webhookConfig: one(webhookConfigs, {
    fields: [webhookLogs.webhookConfigId],
    references: [webhookConfigs.id],
  }),
  client: one(clients, {
    fields: [webhookLogs.clientId],
    references: [clients.id],
  }),
  triggeredByUser: one(users, {
    fields: [webhookLogs.triggeredBy],
    references: [users.id],
  }),
}));
