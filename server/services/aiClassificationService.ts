import OpenAI from "openai";
import type { DeterministicResult } from "./deterministicClassificationService";
import type { SentimentLabel, OpportunityType, UrgencyLevel } from "@shared/schema";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export interface AIClassificationRequest {
  emailId: string;
  subject: string;
  bodyPreview: string;
  fromName: string;
  hasAttachments: boolean;
  attachmentNames?: string[];
  threadPosition: 'first' | 'reply' | 'forward';
  deterministicResult: {
    requiresTaskFloor: boolean;
    requiresReplyFloor: boolean;
    triggeredRules: string[];
  };
}

export interface AIClassificationResponse {
  requiresTask: boolean;
  requiresReply: boolean;
  sentiment: {
    score: number;
    label: SentimentLabel;
  };
  opportunity: OpportunityType | null;
  urgency: UrgencyLevel;
  informationOnly: boolean;
  confidence: number;
  reasoning: string;
}

export interface MergedClassification {
  requiresTask: boolean;
  requiresReply: boolean;
  sentimentScore: number;
  sentimentLabel: SentimentLabel;
  opportunity: OpportunityType | null;
  urgency: UrgencyLevel;
  informationOnly: boolean;
  deterministicTaskFloor: boolean;
  deterministicReplyFloor: boolean;
  triggeredRules: { ruleId: string; ruleName: string; matchedText?: string; explanation: string }[];
  aiTask: boolean;
  aiReply: boolean;
  aiConfidence: number;
  aiReasoning: string;
  aiRawResponse: any;
  mergedAt: Date;
}

const SYSTEM_PROMPT = `You are an email classification assistant for an accounting/bookkeeping firm.

Classify the email with the following rules:
1. requires_task: TRUE if the email requests work, documents, or deliverables
2. requires_reply: TRUE if the sender expects a response
3. sentiment: Score from -1.0 to 1.0, with label (very_negative, negative, neutral, positive, very_positive)
4. opportunity: Identify any commercial opportunities (upsell, cross_sell, referral, expansion, retention_risk, testimonial) or null
5. urgency: critical/high/normal/low based on deadline signals
6. information_only: TRUE if email is purely informational with no action needed

CRITICAL RULE: If information_only = true, then requires_task and requires_reply MUST be false.

Consider the deterministic analysis already performed. You may RAISE classification levels but never LOWER them below the floor values provided.

Respond ONLY with a valid JSON object matching this schema:
{
  "requires_task": boolean,
  "requires_reply": boolean,
  "sentiment": { "score": number, "label": "very_negative"|"negative"|"neutral"|"positive"|"very_positive" },
  "opportunity": "upsell"|"cross_sell"|"referral"|"expansion"|"retention_risk"|"testimonial"|null,
  "urgency": "critical"|"high"|"normal"|"low",
  "information_only": boolean,
  "confidence": number (0.0 to 1.0),
  "reasoning": string (brief explanation)
}`;

function stripSignature(body: string): string {
  const signaturePatterns = [
    /^--\s*$/m,
    /^Regards,?\s*$/mi,
    /^Best regards,?\s*$/mi,
    /^Kind regards,?\s*$/mi,
    /^Thanks,?\s*$/mi,
    /^Cheers,?\s*$/mi,
    /^Sent from my (iPhone|iPad|Android|Samsung|phone)/mi,
    /^Get Outlook for/mi,
  ];
  
  let strippedBody = body;
  for (const pattern of signaturePatterns) {
    const match = strippedBody.search(pattern);
    if (match !== -1) {
      strippedBody = strippedBody.substring(0, match);
    }
  }
  
  return strippedBody.trim();
}

function getSentimentLabel(score: number): SentimentLabel {
  if (score <= -0.6) return 'very_negative';
  if (score <= -0.2) return 'negative';
  if (score <= 0.2) return 'neutral';
  if (score <= 0.6) return 'positive';
  return 'very_positive';
}

export async function classifyWithAI(request: AIClassificationRequest): Promise<AIClassificationResponse> {
  const openai = getOpenAIClient();
  
  const bodyPreview = stripSignature(request.bodyPreview).substring(0, 500);
  
  const userMessage = JSON.stringify({
    email_id: request.emailId,
    subject: request.subject,
    body_preview: bodyPreview,
    from_name: request.fromName,
    has_attachments: request.hasAttachments,
    attachment_names: request.attachmentNames,
    thread_position: request.threadPosition,
    deterministic_result: {
      requires_task_floor: request.deterministicResult.requiresTaskFloor,
      requires_reply_floor: request.deterministicResult.requiresReplyFloor,
      triggered_rules: request.deterministicResult.triggeredRules
    }
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 512,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    const parsed = JSON.parse(content);
    
    const sentimentScore = Math.max(-1, Math.min(1, parsed.sentiment?.score ?? 0));
    const sentimentLabel = parsed.sentiment?.label || getSentimentLabel(sentimentScore);

    return {
      requiresTask: parsed.requires_task ?? false,
      requiresReply: parsed.requires_reply ?? false,
      sentiment: {
        score: sentimentScore,
        label: sentimentLabel
      },
      opportunity: parsed.opportunity || null,
      urgency: parsed.urgency || 'normal',
      informationOnly: parsed.information_only ?? false,
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
      reasoning: parsed.reasoning || ''
    };
  } catch (error: any) {
    console.error('[AI Classification] Error:', error);
    
    return {
      requiresTask: request.deterministicResult.requiresTaskFloor,
      requiresReply: request.deterministicResult.requiresReplyFloor,
      sentiment: { score: 0, label: 'neutral' },
      opportunity: null,
      urgency: 'normal',
      informationOnly: !request.deterministicResult.requiresTaskFloor && !request.deterministicResult.requiresReplyFloor,
      confidence: 0,
      reasoning: `AI classification failed: ${error.message}`
    };
  }
}

export function mergeClassifications(
  deterministic: DeterministicResult,
  ai: AIClassificationResponse
): MergedClassification {
  const requiresTask = deterministic.requires_task_floor || ai.requiresTask;
  const requiresReply = deterministic.requires_reply_floor || ai.requiresReply;
  
  const informationOnly = ai.informationOnly && 
                          !deterministic.requires_task_floor && 
                          !deterministic.requires_reply_floor;

  return {
    requiresTask,
    requiresReply,
    sentimentScore: ai.sentiment.score,
    sentimentLabel: ai.sentiment.label,
    opportunity: ai.opportunity,
    urgency: ai.urgency,
    informationOnly,
    deterministicTaskFloor: deterministic.requires_task_floor,
    deterministicReplyFloor: deterministic.requires_reply_floor,
    triggeredRules: deterministic.triggered_rules,
    aiTask: ai.requiresTask,
    aiReply: ai.requiresReply,
    aiConfidence: ai.confidence,
    aiReasoning: ai.reasoning,
    aiRawResponse: ai,
    mergedAt: new Date()
  };
}

export async function classifyEmail(
  emailId: string,
  subject: string,
  body: string,
  fromName: string,
  hasAttachments: boolean,
  attachmentNames: string[] = [],
  threadPosition: 'first' | 'reply' | 'forward' = 'first',
  deterministicResult: DeterministicResult
): Promise<MergedClassification> {
  const aiRequest: AIClassificationRequest = {
    emailId,
    subject,
    bodyPreview: body,
    fromName,
    hasAttachments,
    attachmentNames,
    threadPosition,
    deterministicResult: {
      requiresTaskFloor: deterministicResult.requires_task_floor,
      requiresReplyFloor: deterministicResult.requires_reply_floor,
      triggeredRules: deterministicResult.triggered_rules.map(r => r.ruleId)
    }
  };

  const aiResult = await classifyWithAI(aiRequest);
  return mergeClassifications(deterministicResult, aiResult);
}
