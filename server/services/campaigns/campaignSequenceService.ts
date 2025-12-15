import { subDays } from 'date-fns';
import { campaignStorage } from '../../storage/campaigns/campaignStorage.js';
import { campaignRecipientStorage } from '../../storage/campaigns/campaignRecipientStorage.js';
import { pageVisitStorage } from '../../storage/pages/pageVisitStorage.js';
import { queueCampaignForDelivery } from './campaignDeliveryService.js';
import type { Campaign, CampaignRecipient } from '@shared/schema';

export interface SequenceCondition {
  type: 'no_open' | 'no_click' | 'no_action' | 'action_completed' | 'time_elapsed';
  waitDays: number;
  actionType?: string;
}

export async function processSequenceProgression(): Promise<{
  sequencesProcessed: number;
  recipientsProgressed: number;
  errors: string[];
}> {
  console.log('[Sequence] Starting sequence progression processing...');
  
  const sequences = await campaignStorage.getActiveSequences();
  console.log(`[Sequence] Found ${sequences.length} active sequences`);
  
  let recipientsProgressed = 0;
  const errors: string[] = [];
  
  for (const sequence of sequences) {
    try {
      const result = await processSequence(sequence);
      recipientsProgressed += result.recipientsProgressed;
    } catch (error: any) {
      const errorMsg = `Error processing sequence ${sequence.id}: ${error.message}`;
      console.error(`[Sequence] ${errorMsg}`);
      errors.push(errorMsg);
    }
  }
  
  console.log(`[Sequence] Processing complete. ${sequences.length} sequences, ${recipientsProgressed} recipients progressed`);
  
  return {
    sequencesProcessed: sequences.length,
    recipientsProgressed,
    errors,
  };
}

async function processSequence(parentCampaign: Campaign): Promise<{ recipientsProgressed: number }> {
  console.log(`[Sequence] Processing sequence: ${parentCampaign.name} (${parentCampaign.id})`);
  
  const steps = await campaignStorage.getSequenceSteps(parentCampaign.id);
  console.log(`[Sequence] Found ${steps.length} steps for sequence ${parentCampaign.id}`);
  
  let recipientsProgressed = 0;
  
  for (let i = 1; i < steps.length; i++) {
    const currentStep = steps[i];
    const previousStep = steps[i - 1];
    
    if (!currentStep || !previousStep) continue;
    
    if (currentStep.status !== 'approved' && currentStep.status !== 'scheduled') {
      console.log(`[Sequence] Skipping step ${i + 1} - status is ${currentStep.status}`);
      continue;
    }
    
    if (previousStep.status !== 'sent') {
      console.log(`[Sequence] Skipping step ${i + 1} - previous step not sent yet`);
      continue;
    }
    
    const condition = currentStep.sequenceCondition as SequenceCondition | null;
    if (!condition) {
      console.log(`[Sequence] Skipping step ${i + 1} - no condition defined`);
      continue;
    }
    
    const eligibleRecipients = await findEligibleRecipientsForStep(
      previousStep,
      currentStep,
      condition
    );
    
    console.log(`[Sequence] Step ${i + 1}: ${eligibleRecipients.length} eligible recipients`);
    
    if (eligibleRecipients.length > 0) {
      await campaignRecipientStorage.bulkCreateForStep(currentStep.id, eligibleRecipients);
      
      await campaignStorage.update(currentStep.id, { status: 'sending' });
      await queueCampaignForDelivery(currentStep.id);
      
      recipientsProgressed += eligibleRecipients.length;
      console.log(`[Sequence] Queued ${eligibleRecipients.length} recipients for step ${i + 1}`);
    }
  }
  
  return { recipientsProgressed };
}

async function findEligibleRecipientsForStep(
  previousStep: Campaign,
  currentStep: Campaign,
  condition: SequenceCondition
): Promise<CampaignRecipient[]> {
  const previousRecipients = await campaignRecipientStorage.getByCampaignId(previousStep.id, {
    status: ['sent', 'delivered'],
  });
  
  const eligible: CampaignRecipient[] = [];
  const waitThreshold = subDays(new Date(), condition.waitDays);
  
  for (const recipient of previousRecipients) {
    const alreadyReceived = await campaignRecipientStorage.exists(currentStep.id, recipient.personId);
    if (alreadyReceived) continue;
    
    if (recipient.sentAt && new Date(recipient.sentAt) > waitThreshold) {
      continue;
    }
    
    let meetsCondition = false;
    
    switch (condition.type) {
      case 'no_open':
        meetsCondition = !recipient.openedAt;
        break;
      
      case 'no_click':
        meetsCondition = !recipient.clickedAt;
        break;
      
      case 'no_action':
        if (recipient.id) {
          const hasAction = await pageVisitStorage.existsForRecipient(recipient.id);
          meetsCondition = !hasAction;
        } else {
          meetsCondition = true;
        }
        break;
      
      case 'action_completed':
        if (recipient.id && condition.actionType) {
          const actionCompleted = await pageVisitStorage.existsForRecipient(
            recipient.id,
            condition.actionType
          );
          meetsCondition = actionCompleted;
        }
        break;
      
      case 'time_elapsed':
        meetsCondition = true;
        break;
    }
    
    if (meetsCondition) {
      eligible.push(recipient);
    }
  }
  
  return eligible;
}

export async function getSequenceStats(parentCampaignId: string): Promise<{
  steps: Array<{
    stepNumber: number;
    campaignId: string;
    name: string;
    status: string;
    condition: SequenceCondition | null;
    recipientCount: number;
    sentCount: number;
    openedCount: number;
    clickedCount: number;
  }>;
  totalRecipients: number;
  totalSent: number;
}> {
  const steps = await campaignStorage.getSequenceSteps(parentCampaignId);
  
  const stepStats = await Promise.all(
    steps.map(async (step, index) => {
      const recipients = await campaignRecipientStorage.getByCampaignId(step.id);
      const statusCounts = await campaignRecipientStorage.countByStatus(step.id);
      
      return {
        stepNumber: index + 1,
        campaignId: step.id,
        name: step.name,
        status: step.status || 'draft',
        condition: step.sequenceCondition as SequenceCondition | null,
        recipientCount: recipients.length,
        sentCount: (statusCounts.sent || 0) + (statusCounts.delivered || 0),
        openedCount: recipients.filter(r => r.openedAt).length,
        clickedCount: recipients.filter(r => r.clickedAt).length,
      };
    })
  );
  
  return {
    steps: stepStats,
    totalRecipients: stepStats.reduce((sum, s) => sum + s.recipientCount, 0),
    totalSent: stepStats.reduce((sum, s) => sum + s.sentCount, 0),
  };
}

export async function createSequenceStep(
  parentCampaignId: string,
  stepData: {
    name: string;
    sequenceOrder: number;
    sequenceCondition: SequenceCondition;
    createdByUserId: string;
  }
): Promise<Campaign> {
  const parent = await campaignStorage.getById(parentCampaignId);
  if (!parent) {
    throw new Error('Parent campaign not found');
  }
  
  if (!parent.isSequence) {
    throw new Error('Parent campaign is not a sequence');
  }
  
  return campaignStorage.create({
    name: stepData.name,
    category: parent.category,
    status: 'draft',
    parentCampaignId,
    sequenceOrder: stepData.sequenceOrder,
    sequenceCondition: stepData.sequenceCondition,
    createdByUserId: stepData.createdByUserId,
    targetCriteria: parent.targetCriteria as Record<string, unknown> | null,
    recipientRules: parent.recipientRules as Record<string, unknown> | null,
  });
}

export async function pauseSequence(parentCampaignId: string): Promise<void> {
  const steps = await campaignStorage.getSequenceSteps(parentCampaignId);
  
  for (const step of steps) {
    if (step.status === 'scheduled' || step.status === 'approved') {
      await campaignStorage.update(step.id, { status: 'paused' });
    }
  }
  
  await campaignStorage.update(parentCampaignId, { status: 'paused' });
  console.log(`[Sequence] Paused sequence ${parentCampaignId} and ${steps.length} steps`);
}

export async function resumeSequence(parentCampaignId: string): Promise<void> {
  const steps = await campaignStorage.getSequenceSteps(parentCampaignId);
  
  for (const step of steps) {
    if (step.status === 'paused') {
      await campaignStorage.update(step.id, { status: 'approved' });
    }
  }
  
  await campaignStorage.update(parentCampaignId, { status: 'approved' });
  console.log(`[Sequence] Resumed sequence ${parentCampaignId} and ${steps.length} steps`);
}

export async function cancelSequence(parentCampaignId: string): Promise<void> {
  const steps = await campaignStorage.getSequenceSteps(parentCampaignId);
  
  for (const step of steps) {
    if (step.status !== 'sent' && step.status !== 'cancelled') {
      await campaignStorage.update(step.id, { status: 'cancelled' });
    }
  }
  
  await campaignStorage.update(parentCampaignId, { status: 'cancelled' });
  console.log(`[Sequence] Cancelled sequence ${parentCampaignId} and pending steps`);
}
