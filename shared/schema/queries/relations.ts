import { relations } from 'drizzle-orm';
import { bookkeepingQueries, queryResponseTokens } from './tables';
import { users } from '../users/tables';
import { projects } from '../projects/tables';

export const bookkeepingQueriesRelations = relations(bookkeepingQueries, ({ one }) => ({
  project: one(projects, {
    fields: [bookkeepingQueries.projectId],
    references: [projects.id],
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

export const queryResponseTokensRelations = relations(queryResponseTokens, ({ one }) => ({
  project: one(projects, {
    fields: [queryResponseTokens.projectId],
    references: [projects.id],
  }),
  createdBy: one(users, {
    fields: [queryResponseTokens.createdById],
    references: [users.id],
    relationName: "tokenCreatedBy",
  }),
}));
