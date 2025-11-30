import { createInsertSchema } from 'drizzle-zod';
import { qboConnections, qboOAuthStates } from './tables';

export const insertQboConnectionSchema = createInsertSchema(qboConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateQboConnectionSchema = insertQboConnectionSchema.partial();

export const insertQboOAuthStateSchema = createInsertSchema(qboOAuthStates).omit({
  id: true,
  createdAt: true,
});
