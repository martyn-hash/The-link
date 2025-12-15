import { relations } from 'drizzle-orm';
import {
  pageTemplates,
  pages,
  pageComponents,
  pageActions,
  pageVisits,
  pageActionLogs,
} from './tables';
import { users } from '../users/tables';
import { clients, people } from '../clients/tables';
import { campaigns, campaignRecipients } from '../campaigns/tables';

export const pageTemplatesRelations = relations(pageTemplates, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [pageTemplates.createdByUserId],
    references: [users.id],
  }),
  pages: many(pages),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [pages.campaignId],
    references: [campaigns.id],
  }),
  template: one(pageTemplates, {
    fields: [pages.templateId],
    references: [pageTemplates.id],
  }),
  createdBy: one(users, {
    fields: [pages.createdByUserId],
    references: [users.id],
  }),
  components: many(pageComponents),
  actions: many(pageActions),
  visits: many(pageVisits),
  actionLogs: many(pageActionLogs),
}));

export const pageComponentsRelations = relations(pageComponents, ({ one, many }) => ({
  page: one(pages, {
    fields: [pageComponents.pageId],
    references: [pages.id],
  }),
  actions: many(pageActions),
}));

export const pageActionsRelations = relations(pageActions, ({ one, many }) => ({
  page: one(pages, {
    fields: [pageActions.pageId],
    references: [pages.id],
  }),
  component: one(pageComponents, {
    fields: [pageActions.componentId],
    references: [pageComponents.id],
  }),
  logs: many(pageActionLogs),
}));

export const pageVisitsRelations = relations(pageVisits, ({ one, many }) => ({
  page: one(pages, {
    fields: [pageVisits.pageId],
    references: [pages.id],
  }),
  recipient: one(campaignRecipients, {
    fields: [pageVisits.recipientId],
    references: [campaignRecipients.id],
  }),
  client: one(clients, {
    fields: [pageVisits.clientId],
    references: [clients.id],
  }),
  person: one(people, {
    fields: [pageVisits.personId],
    references: [people.id],
  }),
  actionLogs: many(pageActionLogs),
}));

export const pageActionLogsRelations = relations(pageActionLogs, ({ one }) => ({
  page: one(pages, {
    fields: [pageActionLogs.pageId],
    references: [pages.id],
  }),
  action: one(pageActions, {
    fields: [pageActionLogs.actionId],
    references: [pageActions.id],
  }),
  visit: one(pageVisits, {
    fields: [pageActionLogs.visitId],
    references: [pageVisits.id],
  }),
  recipient: one(campaignRecipients, {
    fields: [pageActionLogs.recipientId],
    references: [campaignRecipients.id],
  }),
  client: one(clients, {
    fields: [pageActionLogs.clientId],
    references: [clients.id],
  }),
  person: one(people, {
    fields: [pageActionLogs.personId],
    references: [people.id],
  }),
}));
