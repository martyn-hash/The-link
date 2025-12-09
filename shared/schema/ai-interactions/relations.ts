import { relations } from 'drizzle-orm';
import { aiInteractions, aiFunctionInvocations } from './tables';
import { users } from '../users/tables';

export const aiInteractionsRelations = relations(aiInteractions, ({ one, many }) => ({
  user: one(users, {
    fields: [aiInteractions.userId],
    references: [users.id],
  }),
  functionInvocations: many(aiFunctionInvocations),
}));

export const aiFunctionInvocationsRelations = relations(aiFunctionInvocations, ({ one }) => ({
  interaction: one(aiInteractions, {
    fields: [aiFunctionInvocations.interactionId],
    references: [aiInteractions.id],
  }),
}));
