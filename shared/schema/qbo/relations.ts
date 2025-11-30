import { relations } from 'drizzle-orm';
import { qboConnections, qboOAuthStates } from './tables';
import { clients } from '../clients/tables';
import { users } from '../users/tables';

export const qboConnectionsRelations = relations(qboConnections, ({ one }) => ({
  client: one(clients, {
    fields: [qboConnections.clientId],
    references: [clients.id],
  }),
  connectedByUser: one(users, {
    fields: [qboConnections.connectedBy],
    references: [users.id],
  }),
}));

export const qboOAuthStatesRelations = relations(qboOAuthStates, ({ one }) => ({
  client: one(clients, {
    fields: [qboOAuthStates.clientId],
    references: [clients.id],
  }),
  user: one(users, {
    fields: [qboOAuthStates.userId],
    references: [users.id],
  }),
}));
