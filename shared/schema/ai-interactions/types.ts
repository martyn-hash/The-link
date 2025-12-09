import { aiInteractions, aiFunctionInvocations, aiInsights } from './tables';

export type AIInteraction = typeof aiInteractions.$inferSelect;
export type InsertAIInteraction = typeof aiInteractions.$inferInsert;

export type AIFunctionInvocation = typeof aiFunctionInvocations.$inferSelect;
export type InsertAIFunctionInvocation = typeof aiFunctionInvocations.$inferInsert;

export type AIInsight = typeof aiInsights.$inferSelect;
export type InsertAIInsight = typeof aiInsights.$inferInsert;

export type AIInteractionStatus = "success" | "failed" | "partial" | "clarification_needed";

export interface AggregatedFailure {
  pattern: string;
  count: number;
  examples: string[];
  intentDetected?: string;
}

export interface AIRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  suggestion: string;
  affectedUserCount?: number;
  exampleQueries?: string[];
}
