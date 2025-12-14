import { runDeterministicClassification, DeterministicResult } from "./deterministicClassificationService";
import { classifyEmail, MergedClassification } from "./aiClassificationService";
import { storage } from "../storage";
import type { InsertEmailClassification, InsertEmailWorkflowState } from "@shared/schema";

interface EmailToClassify {
  id: string;
  inboxId: string;
  subject: string;
  bodyPreview: string;
  fromAddress: string;
  fromName: string;
  hasAttachments: boolean;
  attachmentNames?: string[];
  isReply?: boolean;
  isForward?: boolean;
}

export interface ClassificationPipelineResult {
  emailId: string;
  deterministicResult: DeterministicResult;
  mergedClassification: MergedClassification;
  classificationId: string;
  workflowStateId: string;
}

function determineThreadPosition(email: EmailToClassify): 'first' | 'reply' | 'forward' {
  if (email.isForward) return 'forward';
  if (email.isReply) return 'reply';
  
  const subjectLower = email.subject.toLowerCase();
  if (subjectLower.startsWith('re:') || subjectLower.startsWith('re ')) {
    return 'reply';
  }
  if (subjectLower.startsWith('fwd:') || subjectLower.startsWith('fw:')) {
    return 'forward';
  }
  
  return 'first';
}

export async function runClassificationPipeline(email: EmailToClassify): Promise<ClassificationPipelineResult> {
  console.log(`[Classification Pipeline] Starting classification for email ${email.id}`);

  const deterministicResult = runDeterministicClassification({
    subject: email.subject,
    body: email.bodyPreview,
    hasAttachments: email.hasAttachments,
    senderEmail: email.fromAddress,
    senderName: email.fromName
  });

  console.log(`[Classification Pipeline] Deterministic result:`, {
    taskFloor: deterministicResult.requires_task_floor,
    replyFloor: deterministicResult.requires_reply_floor,
    triggeredRules: deterministicResult.triggered_rules.map(r => r.ruleId)
  });

  const threadPosition = determineThreadPosition(email);
  
  const mergedClassification = await classifyEmail(
    email.id,
    email.subject,
    email.bodyPreview,
    email.fromName,
    email.hasAttachments,
    email.attachmentNames || [],
    threadPosition,
    deterministicResult
  );

  console.log(`[Classification Pipeline] Merged classification:`, {
    requiresTask: mergedClassification.requiresTask,
    requiresReply: mergedClassification.requiresReply,
    urgency: mergedClassification.urgency,
    informationOnly: mergedClassification.informationOnly,
    opportunity: mergedClassification.opportunity,
    aiConfidence: mergedClassification.aiConfidence
  });

  const classificationData: InsertEmailClassification = {
    emailId: email.id,
    requiresTask: mergedClassification.requiresTask,
    requiresReply: mergedClassification.requiresReply,
    sentimentScore: String(mergedClassification.sentimentScore),
    sentimentLabel: mergedClassification.sentimentLabel,
    opportunity: mergedClassification.opportunity,
    urgency: mergedClassification.urgency,
    informationOnly: mergedClassification.informationOnly,
    deterministicTaskFloor: mergedClassification.deterministicTaskFloor,
    deterministicReplyFloor: mergedClassification.deterministicReplyFloor,
    triggeredRules: mergedClassification.triggeredRules,
    aiTask: mergedClassification.aiTask,
    aiReply: mergedClassification.aiReply,
    aiConfidence: String(mergedClassification.aiConfidence),
    aiReasoning: mergedClassification.aiReasoning,
    aiRawResponse: mergedClassification.aiRawResponse
  };

  const classification = await storage.upsertEmailClassification(classificationData);
  console.log(`[Classification Pipeline] Classification stored with ID ${classification.id}`);

  const workflowData: InsertEmailWorkflowState = {
    emailId: email.id,
    state: 'pending',
    requiresTask: mergedClassification.requiresTask,
    requiresReply: mergedClassification.requiresReply
  };

  const workflowState = await storage.upsertEmailWorkflowState(workflowData);
  console.log(`[Classification Pipeline] Workflow state created with ID ${workflowState.id}`);

  return {
    emailId: email.id,
    deterministicResult,
    mergedClassification,
    classificationId: classification.id,
    workflowStateId: workflowState.id
  };
}

export async function classifyExistingEmail(emailId: string): Promise<ClassificationPipelineResult | null> {
  const email = await storage.getInboxEmailById(emailId);
  if (!email) {
    console.error(`[Classification Pipeline] Email not found: ${emailId}`);
    return null;
  }

  const attachments = await storage.getAttachmentsByMessageId(email.microsoftId);
  const attachmentNames = attachments.map(a => a.fileName);

  return runClassificationPipeline({
    id: email.id,
    inboxId: email.inboxId,
    subject: email.subject || '',
    bodyPreview: email.bodyPreview || '',
    fromAddress: email.fromAddress,
    fromName: email.fromName || '',
    hasAttachments: email.hasAttachments ?? false,
    attachmentNames,
    isReply: false,
    isForward: false
  });
}

export async function classifyUnclassifiedEmails(inboxId?: string): Promise<ClassificationPipelineResult[]> {
  const emails = await storage.getUnclassifiedInboxEmails(inboxId);
  console.log(`[Classification Pipeline] Found ${emails.length} unclassified emails`);
  
  const results: ClassificationPipelineResult[] = [];
  
  for (const email of emails) {
    try {
      const attachments = await storage.getAttachmentsByMessageId(email.microsoftId);
      const attachmentNames = attachments.map(a => a.fileName);

      const result = await runClassificationPipeline({
        id: email.id,
        inboxId: email.inboxId,
        subject: email.subject || '',
        bodyPreview: email.bodyPreview || '',
        fromAddress: email.fromAddress,
        fromName: email.fromName || '',
        hasAttachments: email.hasAttachments ?? false,
        attachmentNames,
        isReply: false,
        isForward: false
      });
      
      results.push(result);
    } catch (error) {
      console.error(`[Classification Pipeline] Error classifying email ${email.id}:`, error);
    }
  }

  console.log(`[Classification Pipeline] Successfully classified ${results.length} emails`);
  return results;
}
