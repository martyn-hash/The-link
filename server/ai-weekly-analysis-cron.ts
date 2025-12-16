import * as cron from "node-cron";
import OpenAI from "openai";
import { storage } from "./storage/index";
import type { AggregatedFailure } from "@shared/schema/ai-interactions/types";
import { wrapCronHandler } from "./cron-telemetry";

let cronJob: ReturnType<typeof cron.schedule> | null = null;

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

function redactPII(text: string): string {
  let redacted = text;
  redacted = redacted.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
  redacted = redacted.replace(/\b\d{5,}\b/g, '[NUMBER]');
  redacted = redacted.replace(/£\s?\d+(?:,\d{3})*(?:\.\d{2})?/g, '[AMOUNT]');
  redacted = redacted.replace(/\$\s?\d+(?:,\d{3})*(?:\.\d{2})?/g, '[AMOUNT]');
  redacted = redacted.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]');
  redacted = redacted.replace(/\b\d{5}[-.\s]?\d{6}\b/g, '[PHONE]');
  redacted = redacted.replace(/\b\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{2,4}\b/g, '[ID]');
  redacted = redacted.replace(/\b(?:Mr|Mrs|Ms|Dr|Prof)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, '[PERSON]');
  redacted = redacted.replace(/\b[A-Z][a-z]+(?:\s+[A-Z&][a-z]*)?\s+(?:Ltd|Limited|LLP|PLC|Inc|Corp|LLC|Partners|Group|Holdings|Services|Consulting)\b/gi, '[COMPANY]');
  redacted = redacted.replace(/\b[A-Z]+\s+(?:ltd|limited|llp|plc|inc|corp|llc)\b/gi, '[COMPANY]');
  redacted = redacted.replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}(?=\s+(?:client|account|project|invoice|call|email|sms|text|reminder|task))/gi, '[NAME]');
  redacted = redacted.replace(/(?:call|email|text|sms|remind)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/gi, (match, name) => match.replace(name, '[NAME]'));
  redacted = redacted.replace(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,2}\b(?!\s+(?:and|or|the|for|to|in|on|at|by))/g, '[NAME]');
  return redacted;
}

function redactAggregatedFailures(failures: AggregatedFailure[]): AggregatedFailure[] {
  return failures.map(f => ({
    ...f,
    pattern: redactPII(f.pattern),
    examples: f.examples.map(ex => redactPII(ex))
  }));
}

export interface WeeklyAnalysisResult {
  summary: string;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    category: string;
    description: string;
    suggestedAction: string;
  }>;
  patternAnalysis: Array<{
    pattern: string;
    frequency: number;
    possibleIntent: string;
    suggestedImprovement: string;
  }>;
  newFunctionSuggestions: Array<{
    name: string;
    description: string;
    parameters: string[];
    justification: string;
  }>;
}

export async function runWeeklyAnalysis(): Promise<WeeklyAnalysisResult | null> {
  console.log("[AIWeeklyAnalysis] Starting weekly analysis...");
  
  const aiStorage = storage.aiInteractionStorage;
  
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const stats = await aiStorage.getInteractionStats(weekAgo, now);
  
  console.log("[AIWeeklyAnalysis] Stats:", stats);
  
  if (stats.total === 0) {
    console.log("[AIWeeklyAnalysis] No interactions to analyze");
    return null;
  }
  
  const aggregatedFailures = await aiStorage.aggregateFailedInteractions(weekAgo, now);
  const redactedFailures = redactAggregatedFailures(aggregatedFailures);
  
  console.log("[AIWeeklyAnalysis] Aggregated failures:", redactedFailures.length);
  
  if (redactedFailures.length === 0 && stats.failed === 0 && stats.clarificationNeeded === 0) {
    console.log("[AIWeeklyAnalysis] No failures to analyze, success rate is good");
    
    const insight = await aiStorage.createInsight({
      weekStartDate: weekAgo,
      weekEndDate: now,
      totalInteractions: stats.total,
      successfulInteractions: stats.successful,
      failedInteractions: stats.failed,
      partialInteractions: stats.partial,
      clarificationNeededCount: stats.clarificationNeeded,
      topFailurePatterns: [],
      recommendations: [],
      rawAnalysis: { message: "No significant failures to analyze" },
      status: 'completed'
    });
    
    console.log("[AIWeeklyAnalysis] Created insight:", insight.id);
    return null;
  }
  
  try {
    const openai = getOpenAIClient();
    
    const analysisPrompt = `You are an AI system analyst. Analyze the following failed AI interactions from a practice management system and provide actionable recommendations.

## Weekly Stats
- Total interactions: ${stats.total}
- Successful: ${stats.successful} (${stats.total > 0 ? ((stats.successful / stats.total) * 100).toFixed(1) : 0}%)
- Failed: ${stats.failed} (${stats.total > 0 ? ((stats.failed / stats.total) * 100).toFixed(1) : 0}%)
- Partial (fallback messages): ${stats.partial} (${stats.total > 0 ? ((stats.partial / stats.total) * 100).toFixed(1) : 0}%)
- Needed clarification: ${stats.clarificationNeeded} (${stats.total > 0 ? ((stats.clarificationNeeded / stats.total) * 100).toFixed(1) : 0}%)

## Aggregated Failure Patterns (grouped by similarity)
${redactedFailures.map((f, i) => `
### Pattern ${i + 1}: "${f.pattern}"
- Occurrences: ${f.count}
- Detected intent: ${f.intentDetected || 'Unknown'}
- Example requests: ${f.examples.slice(0, 3).map(e => `"${e}"`).join(', ')}
`).join('\n')}

## Current System Capabilities
The AI assistant can currently:
- Navigate to clients, projects, people, contacts
- Create reminders and tasks
- Search for entities
- Start calls and send SMS
- Navigate to various views (dashboard, invoices, etc.)

## Your Analysis Task
Provide a JSON response with:
1. A summary of the key issues
2. Prioritized recommendations (high/medium/low)
3. Pattern analysis explaining likely user intent
4. Suggestions for new functions that could address common failures

Respond ONLY with valid JSON matching this structure:
{
  "summary": "Brief summary of issues found",
  "recommendations": [
    {
      "priority": "high|medium|low",
      "category": "category name",
      "description": "what the issue is",
      "suggestedAction": "what to do about it"
    }
  ],
  "patternAnalysis": [
    {
      "pattern": "the pattern",
      "frequency": number,
      "possibleIntent": "what user probably wanted",
      "suggestedImprovement": "how to handle this better"
    }
  ],
  "newFunctionSuggestions": [
    {
      "name": "function_name",
      "description": "what it does",
      "parameters": ["param1", "param2"],
      "justification": "why this would help"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an AI system analyst. Always respond with valid JSON only." },
        { role: "user", content: analysisPrompt }
      ],
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }
    
    const analysis: WeeklyAnalysisResult = JSON.parse(content);
    
    console.log("[AIWeeklyAnalysis] Analysis complete:", analysis.summary);
    
    const insight = await aiStorage.createInsight({
      weekStartDate: weekAgo,
      weekEndDate: now,
      totalInteractions: stats.total,
      successfulInteractions: stats.successful,
      failedInteractions: stats.failed,
      partialInteractions: stats.partial,
      clarificationNeededCount: stats.clarificationNeeded,
      topFailurePatterns: redactedFailures,
      recommendations: analysis.recommendations,
      rawAnalysis: analysis,
      status: 'completed'
    });
    
    console.log("[AIWeeklyAnalysis] Created insight:", insight.id);
    
    return analysis;
    
  } catch (error: any) {
    console.error("[AIWeeklyAnalysis] Error during analysis:", error);
    
    await aiStorage.createInsight({
      weekStartDate: weekAgo,
      weekEndDate: now,
      totalInteractions: stats.total,
      successfulInteractions: stats.successful,
      failedInteractions: stats.failed,
      partialInteractions: stats.partial,
      clarificationNeededCount: stats.clarificationNeeded,
      topFailurePatterns: redactedFailures,
      recommendations: [],
      rawAnalysis: { error: error.message },
      status: 'failed'
    });
    
    throw error;
  }
}

export function startAIWeeklyAnalysisCron(): void {
  if (cronJob) {
    console.log("[AIWeeklyAnalysis] Cron job already running");
    return;
  }

  // Run at 06:25 UK time on Mondays (staggered from :00)
  cronJob = cron.schedule("25 6 * * 1", wrapCronHandler('AIWeeklyAnalysis', '25 6 * * 1', async () => {
    await runWeeklyAnalysis();
  }, { useLock: true, timezone: 'Europe/London' }), {
    timezone: "Europe/London"
  });

  console.log("[AIWeeklyAnalysis] Weekly analysis cron job started (runs Mondays at 06:25 UK time)");
}

export function stopAIWeeklyAnalysisCron(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log("[AIWeeklyAnalysis] Cron job stopped");
  }
}
