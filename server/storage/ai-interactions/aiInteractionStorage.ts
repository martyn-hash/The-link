import { db } from '../../db';
import { eq, desc, and, gte, lte, sql, count, isNull, or } from 'drizzle-orm';
import { 
  aiInteractions, 
  aiFunctionInvocations, 
  aiInsights 
} from '@shared/schema/ai-interactions/tables';
import type { 
  AIInteraction, 
  InsertAIInteraction,
  AIFunctionInvocation,
  InsertAIFunctionInvocation,
  AIInsight,
  InsertAIInsight,
  AggregatedFailure
} from '@shared/schema/ai-interactions/types';

export class AIInteractionStorage {
  async createInteraction(data: InsertAIInteraction): Promise<AIInteraction> {
    const [interaction] = await db
      .insert(aiInteractions)
      .values(data)
      .returning();
    return interaction;
  }

  async getInteractionById(id: string): Promise<AIInteraction | undefined> {
    const [interaction] = await db
      .select()
      .from(aiInteractions)
      .where(eq(aiInteractions.id, id));
    return interaction;
  }

  async updateInteraction(id: string, data: Partial<InsertAIInteraction>): Promise<AIInteraction> {
    const [interaction] = await db
      .update(aiInteractions)
      .set(data)
      .where(eq(aiInteractions.id, id))
      .returning();
    return interaction;
  }

  async createFunctionInvocation(data: InsertAIFunctionInvocation): Promise<AIFunctionInvocation> {
    const [invocation] = await db
      .insert(aiFunctionInvocations)
      .values(data)
      .returning();
    return invocation;
  }

  async getFunctionInvocationsByInteractionId(interactionId: string): Promise<AIFunctionInvocation[]> {
    return db
      .select()
      .from(aiFunctionInvocations)
      .where(eq(aiFunctionInvocations.interactionId, interactionId))
      .orderBy(aiFunctionInvocations.createdAt);
  }

  async getInteractionsInRange(startDate: Date, endDate: Date): Promise<AIInteraction[]> {
    return db
      .select()
      .from(aiInteractions)
      .where(
        and(
          gte(aiInteractions.createdAt, startDate),
          lte(aiInteractions.createdAt, endDate)
        )
      )
      .orderBy(desc(aiInteractions.createdAt));
  }

  async getFailedInteractionsInRange(startDate: Date, endDate: Date): Promise<AIInteraction[]> {
    return db
      .select()
      .from(aiInteractions)
      .where(
        and(
          gte(aiInteractions.createdAt, startDate),
          lte(aiInteractions.createdAt, endDate),
          or(
            eq(aiInteractions.status, 'failed'),
            eq(aiInteractions.status, 'clarification_needed')
          )
        )
      )
      .orderBy(desc(aiInteractions.createdAt));
  }

  async getInteractionStats(startDate: Date, endDate: Date): Promise<{
    total: number;
    successful: number;
    failed: number;
    partial: number;
    clarificationNeeded: number;
  }> {
    const stats = await db
      .select({
        status: aiInteractions.status,
        count: count()
      })
      .from(aiInteractions)
      .where(
        and(
          gte(aiInteractions.createdAt, startDate),
          lte(aiInteractions.createdAt, endDate)
        )
      )
      .groupBy(aiInteractions.status);

    const result = {
      total: 0,
      successful: 0,
      failed: 0,
      partial: 0,
      clarificationNeeded: 0
    };

    for (const row of stats) {
      const countVal = Number(row.count);
      result.total += countVal;
      if (row.status === 'success') result.successful = countVal;
      else if (row.status === 'failed') result.failed = countVal;
      else if (row.status === 'partial') result.partial = countVal;
      else if (row.status === 'clarification_needed') result.clarificationNeeded = countVal;
    }

    return result;
  }

  async getTopFailedIntentsInRange(startDate: Date, endDate: Date, limit: number = 10): Promise<Array<{intent: string | null, count: number}>> {
    const results = await db
      .select({
        intent: aiInteractions.intentDetected,
        count: count()
      })
      .from(aiInteractions)
      .where(
        and(
          gte(aiInteractions.createdAt, startDate),
          lte(aiInteractions.createdAt, endDate),
          or(
            eq(aiInteractions.status, 'failed'),
            eq(aiInteractions.status, 'clarification_needed')
          )
        )
      )
      .groupBy(aiInteractions.intentDetected)
      .orderBy(desc(count()))
      .limit(limit);

    return results.map(r => ({ intent: r.intent, count: Number(r.count) }));
  }

  async aggregateFailedInteractions(startDate: Date, endDate: Date): Promise<AggregatedFailure[]> {
    const failures = await this.getFailedInteractionsInRange(startDate, endDate);
    
    const patternMap = new Map<string, {count: number, examples: string[], intentDetected?: string}>();
    
    for (const failure of failures) {
      const normalizedText = failure.requestText.toLowerCase().trim();
      const words = normalizedText.split(/\s+/).slice(0, 5).join(' ');
      
      if (!patternMap.has(words)) {
        patternMap.set(words, { 
          count: 0, 
          examples: [],
          intentDetected: failure.intentDetected || undefined
        });
      }
      
      const entry = patternMap.get(words)!;
      entry.count++;
      if (entry.examples.length < 3) {
        entry.examples.push(failure.requestText);
      }
    }

    const aggregated: AggregatedFailure[] = [];
    const entries = Array.from(patternMap.entries());
    for (const [pattern, data] of entries) {
      if (data.count >= 2) {
        aggregated.push({
          pattern,
          count: data.count,
          examples: data.examples,
          intentDetected: data.intentDetected
        });
      }
    }

    return aggregated.sort((a, b) => b.count - a.count).slice(0, 20);
  }

  async createInsight(data: InsertAIInsight): Promise<AIInsight> {
    const [insight] = await db
      .insert(aiInsights)
      .values(data)
      .returning();
    return insight;
  }

  async getInsightById(id: string): Promise<AIInsight | undefined> {
    const [insight] = await db
      .select()
      .from(aiInsights)
      .where(eq(aiInsights.id, id));
    return insight;
  }

  async getLatestInsight(): Promise<AIInsight | undefined> {
    const [insight] = await db
      .select()
      .from(aiInsights)
      .orderBy(desc(aiInsights.createdAt))
      .limit(1);
    return insight;
  }

  async getInsightsByDateRange(startDate: Date, endDate: Date): Promise<AIInsight[]> {
    return db
      .select()
      .from(aiInsights)
      .where(
        and(
          gte(aiInsights.weekStartDate, startDate),
          lte(aiInsights.weekEndDate, endDate)
        )
      )
      .orderBy(desc(aiInsights.weekStartDate));
  }

  async updateInsight(id: string, data: Partial<InsertAIInsight>): Promise<AIInsight> {
    const [insight] = await db
      .update(aiInsights)
      .set(data)
      .where(eq(aiInsights.id, id))
      .returning();
    return insight;
  }

  async getRecentInteractions(limit: number = 50): Promise<AIInteraction[]> {
    return db
      .select()
      .from(aiInteractions)
      .orderBy(desc(aiInteractions.createdAt))
      .limit(limit);
  }

  async getInteractionsByUserId(userId: string, limit: number = 50): Promise<AIInteraction[]> {
    return db
      .select()
      .from(aiInteractions)
      .where(eq(aiInteractions.userId, userId))
      .orderBy(desc(aiInteractions.createdAt))
      .limit(limit);
  }

  async getFunctionSuccessRate(startDate: Date, endDate: Date): Promise<Array<{functionName: string, total: number, succeeded: number, rate: number}>> {
    const results = await db
      .select({
        functionName: aiFunctionInvocations.functionName,
        total: count(),
        succeeded: sql<number>`SUM(CASE WHEN ${aiFunctionInvocations.succeeded} THEN 1 ELSE 0 END)`
      })
      .from(aiFunctionInvocations)
      .where(
        and(
          gte(aiFunctionInvocations.createdAt, startDate),
          lte(aiFunctionInvocations.createdAt, endDate)
        )
      )
      .groupBy(aiFunctionInvocations.functionName)
      .orderBy(desc(count()));

    return results.map(r => ({
      functionName: r.functionName,
      total: Number(r.total),
      succeeded: Number(r.succeeded),
      rate: Number(r.total) > 0 ? (Number(r.succeeded) / Number(r.total)) * 100 : 0
    }));
  }
}
