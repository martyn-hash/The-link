import { db } from '../../db.js';
import { campaigns } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { campaignStorage, campaignTargetStorage, campaignMessageStorage, campaignRecipientStorage } from '../../storage/campaigns/index.js';
import { getMatchingClientCount } from './campaignTargetingService.js';
import { resolveRecipients, saveResolvedRecipients, type RecipientRules } from './campaignRecipientService.js';
import { validateMergeFields } from './mergeFieldService.js';
import type { Campaign } from '@shared/schema';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const STATE_TRANSITIONS: Record<string, string[]> = {
  'draft': ['review', 'cancelled'],
  'review': ['draft', 'approved', 'cancelled'],
  'approved': ['scheduled', 'sending', 'cancelled'],
  'scheduled': ['paused', 'sending', 'cancelled'],
  'paused': ['scheduled', 'cancelled'],
  'sending': ['sent'],
  'sent': [],
  'cancelled': [],
};

async function validateTransitionToReview(campaign: Campaign): Promise<ValidationResult> {
  const criteria = await campaignTargetStorage.getByCampaignId(campaign.id);
  if (criteria.length === 0) {
    return { valid: false, error: 'Campaign must have at least one targeting filter' };
  }

  const messages = await campaignMessageStorage.getByCampaignId(campaign.id);
  if (messages.length === 0) {
    return { valid: false, error: 'Campaign must have at least one message' };
  }

  const count = await getMatchingClientCount(campaign.id);
  if (count === 0) {
    return { valid: false, error: 'Campaign targeting matches no clients' };
  }

  return { valid: true };
}

async function validateTransitionToApproved(campaign: Campaign): Promise<ValidationResult> {
  if (!campaign.previewConfirmedAt) {
    return { valid: false, error: 'Campaign must have preview confirmed before approval' };
  }

  const validation = await validateMergeFields(campaign.id);
  if (!validation.valid) {
    return { valid: false, error: `Merge field issues: ${validation.issues.join(', ')}` };
  }

  return { valid: true };
}

async function validateTransitionToScheduled(campaign: Campaign): Promise<ValidationResult> {
  if (!campaign.scheduledFor) {
    return { valid: false, error: 'Scheduled time is required' };
  }
  if (new Date(campaign.scheduledFor) < new Date()) {
    return { valid: false, error: 'Scheduled time must be in the future' };
  }
  return { valid: true };
}

const TRANSITION_VALIDATIONS: Record<string, (campaign: Campaign) => Promise<ValidationResult>> = {
  'review': validateTransitionToReview,
  'approved': validateTransitionToApproved,
  'scheduled': validateTransitionToScheduled,
};

export async function canTransition(
  campaignId: string,
  toStatus: string
): Promise<{ allowed: boolean; reason?: string }> {
  const campaign = await campaignStorage.getById(campaignId);
  if (!campaign) {
    return { allowed: false, reason: 'Campaign not found' };
  }

  const currentStatus = campaign.status as string;
  const allowed = STATE_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(toStatus)) {
    return { allowed: false, reason: `Cannot transition from ${campaign.status} to ${toStatus}` };
  }

  const validator = TRANSITION_VALIDATIONS[toStatus];
  if (validator) {
    const result = await validator(campaign);
    if (!result.valid) {
      return { allowed: false, reason: result.error };
    }
  }

  return { allowed: true };
}

export async function transitionCampaignStatus(
  campaignId: string,
  newStatus: string,
  userId: string,
  options?: { scheduledFor?: Date }
): Promise<Campaign> {
  const campaign = await campaignStorage.getById(campaignId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  const currentStatus = campaign.status as string;
  const allowedStatuses = STATE_TRANSITIONS[currentStatus];
  if (!allowedStatuses || !allowedStatuses.includes(newStatus)) {
    throw new Error(`Cannot transition from ${currentStatus} to ${newStatus}`);
  }

  const validator = TRANSITION_VALIDATIONS[newStatus];
  if (validator) {
    const result = await validator(campaign);
    if (!result.valid) {
      throw new Error(result.error);
    }
  }

  const updates: Partial<Campaign> = { status: newStatus as any };

  switch (newStatus) {
    case 'review':
      updates.reviewedByUserId = userId;
      updates.reviewedAt = new Date();
      break;

    case 'approved':
      updates.approvedByUserId = userId;
      updates.approvedAt = new Date();
      updates.targetCriteriaSnapshot = campaign.targetCriteria;
      
      const recipientRules = campaign.recipientRules as RecipientRules || {
        strategy: 'primary_only',
        channels: { email: true, sms: false, voice: false }
      };
      
      const recipients = await resolveRecipients(
        campaignId,
        recipientRules,
        campaign.category as string
      );
      updates.recipientCountSnapshot = recipients.length;
      await saveResolvedRecipients(campaignId, recipients);
      break;

    case 'scheduled':
      if (options?.scheduledFor) {
        updates.scheduledFor = options.scheduledFor;
      }
      break;

    case 'sending':
      updates.sendingStartedAt = new Date();
      break;

    case 'sent':
      updates.sentAt = new Date();
      break;
  }

  return campaignStorage.update(campaignId, updates as any);
}

export async function confirmPreview(
  campaignId: string,
  userId: string
): Promise<Campaign> {
  return campaignStorage.update(campaignId, {
    previewConfirmedAt: new Date(),
    previewConfirmedByUserId: userId,
  } as any);
}

export async function getCampaignWorkflowState(campaignId: string): Promise<{
  currentStatus: string;
  allowedTransitions: string[];
  validationIssues: Record<string, string>;
}> {
  const campaign = await campaignStorage.getById(campaignId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  const campaignStatus = campaign.status as string;
  const allowedTransitions = STATE_TRANSITIONS[campaignStatus] || [];
  const validationIssues: Record<string, string> = {};

  for (const status of allowedTransitions) {
    const validator = TRANSITION_VALIDATIONS[status];
    if (validator) {
      const result = await validator(campaign);
      if (!result.valid && result.error) {
        validationIssues[status] = result.error;
      }
    }
  }

  return {
    currentStatus: campaign.status as string,
    allowedTransitions,
    validationIssues,
  };
}

export function getStatusDisplayInfo(status: string): {
  label: string;
  color: string;
  description: string;
} {
  const statusInfo: Record<string, { label: string; color: string; description: string }> = {
    draft: { label: 'Draft', color: 'gray', description: 'Campaign is being created' },
    review: { label: 'In Review', color: 'yellow', description: 'Awaiting review and approval' },
    approved: { label: 'Approved', color: 'blue', description: 'Ready to schedule or send' },
    scheduled: { label: 'Scheduled', color: 'purple', description: 'Waiting to be sent at scheduled time' },
    paused: { label: 'Paused', color: 'orange', description: 'Sending has been paused' },
    sending: { label: 'Sending', color: 'cyan', description: 'Currently sending to recipients' },
    sent: { label: 'Sent', color: 'green', description: 'Campaign has been sent' },
    cancelled: { label: 'Cancelled', color: 'red', description: 'Campaign was cancelled' },
  };

  return statusInfo[status] || { label: status, color: 'gray', description: '' };
}

export async function processScheduledCampaigns(): Promise<{
  processed: number;
  triggered: number;
  errors: string[];
}> {
  const now = new Date();
  const errors: string[] = [];
  let triggered = 0;
  
  const scheduledCampaigns = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.status, 'scheduled'));
  
  const dueCampaigns = scheduledCampaigns.filter(c => {
    if (!c.scheduledFor) return false;
    return new Date(c.scheduledFor) <= now;
  });
  
  for (const campaign of dueCampaigns) {
    try {
      await campaignStorage.update(campaign.id, {
        status: 'sending',
        sendingStartedAt: now,
      } as any);
      
      const { queueCampaignForDelivery } = await import('./campaignDeliveryService.js');
      await queueCampaignForDelivery(campaign.id);
      
      triggered++;
      console.log(`[ScheduledCampaigns] Triggered campaign ${campaign.id} "${campaign.name}"`);
    } catch (error: any) {
      errors.push(`Campaign ${campaign.id}: ${error.message}`);
      console.error(`[ScheduledCampaigns] Error triggering campaign ${campaign.id}:`, error);
    }
  }
  
  return { processed: dueCampaigns.length, triggered, errors };
}
