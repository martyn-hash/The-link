import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { aiInteractions, aiFunctionInvocations, aiInsights } from './tables';

export const insertAIInteractionSchema = createInsertSchema(aiInteractions).omit({
  id: true,
  createdAt: true,
});

export const insertAIFunctionInvocationSchema = createInsertSchema(aiFunctionInvocations).omit({
  id: true,
  createdAt: true,
});

export const insertAIInsightSchema = createInsertSchema(aiInsights).omit({
  id: true,
  createdAt: true,
});

export type InsertAIInteractionInput = z.infer<typeof insertAIInteractionSchema>;
export type InsertAIFunctionInvocationInput = z.infer<typeof insertAIFunctionInvocationSchema>;
export type InsertAIInsightInput = z.infer<typeof insertAIInsightSchema>;
