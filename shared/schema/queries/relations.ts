import { relations } from 'drizzle-orm';
import { bookkeepingQueries, queryResponseTokens, scheduledQueryReminders, queryGroups, queryAnswerHistory } from './tables';
import { users } from '../users/tables';
import { projects } from '../projects/tables';
import { clients } from '../clients/tables';

export const queryGroupsRelations = relations(queryGroups, ({ one, many }) => ({
  project: one(projects, {
    fields: [queryGroups.projectId],
    references: [projects.id],
  }),
  createdBy: one(users, {
    fields: [queryGroups.createdById],
    references: [users.id],
    relationName: "queryGroupCreatedBy",
  }),
  queries: many(bookkeepingQueries),
}));

export const bookkeepingQueriesRelations = relations(bookkeepingQueries, ({ one }) => ({
  project: one(projects, {
    fields: [bookkeepingQueries.projectId],
    references: [projects.id],
  }),
  group: one(queryGroups, {
    fields: [bookkeepingQueries.groupId],
    references: [queryGroups.id],
  }),
  createdBy: one(users, {
    fields: [bookkeepingQueries.createdById],
    references: [users.id],
    relationName: "queryCreatedBy",
  }),
  answeredBy: one(users, {
    fields: [bookkeepingQueries.answeredById],
    references: [users.id],
    relationName: "queryAnsweredBy",
  }),
  resolvedBy: one(users, {
    fields: [bookkeepingQueries.resolvedById],
    references: [users.id],
    relationName: "queryResolvedBy",
  }),
}));

export const queryResponseTokensRelations = relations(queryResponseTokens, ({ one, many }) => ({
  project: one(projects, {
    fields: [queryResponseTokens.projectId],
    references: [projects.id],
  }),
  createdBy: one(users, {
    fields: [queryResponseTokens.createdById],
    references: [users.id],
    relationName: "tokenCreatedBy",
  }),
  reminders: many(scheduledQueryReminders),
}));

export const scheduledQueryRemindersRelations = relations(scheduledQueryReminders, ({ one }) => ({
  token: one(queryResponseTokens, {
    fields: [scheduledQueryReminders.tokenId],
    references: [queryResponseTokens.id],
  }),
  project: one(projects, {
    fields: [scheduledQueryReminders.projectId],
    references: [projects.id],
  }),
  cancelledBy: one(users, {
    fields: [scheduledQueryReminders.cancelledById],
    references: [users.id],
    relationName: "reminderCancelledBy",
  }),
}));

export const queryAnswerHistoryRelations = relations(queryAnswerHistory, ({ one }) => ({
  client: one(clients, {
    fields: [queryAnswerHistory.clientId],
    references: [clients.id],
  }),
  project: one(projects, {
    fields: [queryAnswerHistory.projectId],
    references: [projects.id],
  }),
  answeredBy: one(users, {
    fields: [queryAnswerHistory.answeredById],
    references: [users.id],
    relationName: "answerHistoryAnsweredBy",
  }),
  sourceQuery: one(bookkeepingQueries, {
    fields: [queryAnswerHistory.sourceQueryId],
    references: [bookkeepingQueries.id],
  }),
}));
