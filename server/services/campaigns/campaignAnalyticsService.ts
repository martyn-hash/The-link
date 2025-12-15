import { campaignStorage, campaignRecipientStorage, campaignAnalyticsStorage } from '../../storage/campaigns/index.js';
import { pageVisitStorage } from '../../storage/pages/index.js';
import { ClientStorage } from '../../storage/clients/index.js';
import { UserStorage } from '../../storage/users/index.js';

const clientStorage = new ClientStorage();
const userStorage = new UserStorage();

interface CampaignMetrics {
  totalRecipients: number;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  opened: number;
  clicked: number;
  actioned: number;
}

interface CampaignRates {
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  actionRate: number;
  bounceRate: number;
}

interface ManagerBreakdown {
  managerId: string;
  managerName: string;
  sent: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
}

interface CampaignAnalytics {
  campaign: {
    id: string;
    name: string;
    category: string | null;
    status: string | null;
    sentAt: Date | null;
  };
  metrics: CampaignMetrics;
  rates: CampaignRates;
  breakdowns: {
    byManager: ManagerBreakdown[];
  };
  timeline: Array<{
    date: string;
    sent: number;
    opened: number;
    clicked: number;
  }>;
}

export async function getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
  const campaign = await campaignStorage.getById(campaignId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  const recipients = await campaignRecipientStorage.getByCampaignId(campaignId);
  
  const metrics: CampaignMetrics = {
    totalRecipients: recipients.length,
    sent: recipients.filter(r => r.status === 'sent' || r.status === 'delivered').length,
    delivered: recipients.filter(r => r.status === 'delivered').length,
    bounced: recipients.filter(r => r.status === 'bounced').length,
    failed: recipients.filter(r => r.status === 'failed').length,
    opened: recipients.filter(r => r.openedAt).length,
    clicked: recipients.filter(r => r.clickedAt).length,
    actioned: 0
  };

  if (campaign.pageId) {
    const recipientIds = recipients.map(r => r.id);
    const actionedCount = await pageVisitStorage.countByRecipientIds(recipientIds);
    metrics.actioned = actionedCount;
  }

  const rates: CampaignRates = {
    deliveryRate: metrics.sent > 0 ? Math.round((metrics.delivered / metrics.sent) * 1000) / 10 : 0,
    openRate: metrics.delivered > 0 ? Math.round((metrics.opened / metrics.delivered) * 1000) / 10 : 0,
    clickRate: metrics.delivered > 0 ? Math.round((metrics.clicked / metrics.delivered) * 1000) / 10 : 0,
    actionRate: metrics.delivered > 0 ? Math.round((metrics.actioned / metrics.delivered) * 1000) / 10 : 0,
    bounceRate: metrics.sent > 0 ? Math.round((metrics.bounced / metrics.sent) * 1000) / 10 : 0
  };

  const byManager = await getBreakdownByManager(recipients);

  const timeline = await getEngagementTimeline(campaignId);

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      category: campaign.category,
      status: campaign.status,
      sentAt: campaign.sentAt
    },
    metrics,
    rates,
    breakdowns: {
      byManager
    },
    timeline
  };
}

async function getBreakdownByManager(recipients: any[]): Promise<ManagerBreakdown[]> {
  const uniqueClientIds = new Set(recipients.map(r => r.clientId));
  const clientIds = Array.from(uniqueClientIds);
  
  if (clientIds.length === 0) {
    return [];
  }

  const clientManagerMap = new Map<string, string>();
  
  for (const clientId of clientIds) {
    const client = await clientStorage.getClientById(clientId);
    if (client?.managerId) {
      clientManagerMap.set(clientId, client.managerId);
    }
  }

  const managerGroups = new Map<string, any[]>();
  
  for (const recipient of recipients) {
    const managerId = clientManagerMap.get(recipient.clientId);
    if (managerId) {
      const existing = managerGroups.get(managerId) || [];
      existing.push(recipient);
      managerGroups.set(managerId, existing);
    }
  }

  const breakdowns: ManagerBreakdown[] = [];

  const entries = Array.from(managerGroups.entries());
  for (const [managerId, managerRecipients] of entries) {
    const user = await userStorage.getUser(managerId);
    const sent = managerRecipients.length;
    const opened = managerRecipients.filter((r: any) => r.openedAt).length;
    const clicked = managerRecipients.filter((r: any) => r.clickedAt).length;

    breakdowns.push({
      managerId,
      managerName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown',
      sent,
      opened,
      clicked,
      openRate: sent > 0 ? Math.round((opened / sent) * 1000) / 10 : 0,
      clickRate: opened > 0 ? Math.round((clicked / opened) * 1000) / 10 : 0
    });
  }

  return breakdowns.sort((a, b) => b.sent - a.sent);
}

async function getEngagementTimeline(campaignId: string): Promise<Array<{
  date: string;
  sent: number;
  opened: number;
  clicked: number;
}>> {
  const events = await campaignAnalyticsStorage.getEngagementByCampaignId(campaignId);
  
  const dateMap = new Map<string, { sent: number; opened: number; clicked: number }>();

  for (const event of events) {
    if (!event.timestamp) continue;
    
    const dateKey = event.timestamp.toISOString().split('T')[0];
    const existing = dateMap.get(dateKey) || { sent: 0, opened: 0, clicked: 0 };

    switch (event.eventType) {
      case 'sent':
      case 'delivered':
        existing.sent++;
        break;
      case 'opened':
        existing.opened++;
        break;
      case 'clicked':
        existing.clicked++;
        break;
    }

    dateMap.set(dateKey, existing);
  }

  return Array.from(dateMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getCampaignOverviewStats(): Promise<{
  totalCampaigns: number;
  sentThisMonth: number;
  averageOpenRate: number;
  averageClickRate: number;
  topPerformingCampaigns: Array<{
    id: string;
    name: string;
    openRate: number;
    clickRate: number;
  }>;
}> {
  const allCampaigns = await campaignStorage.getAll();
  const sentCampaigns = allCampaigns.filter(c => c.status === 'sent');
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sentThisMonth = sentCampaigns.filter(c => 
    c.sentAt && c.sentAt >= startOfMonth
  ).length;

  let totalOpenRate = 0;
  let totalClickRate = 0;
  const campaignPerformance: Array<{ id: string; name: string; openRate: number; clickRate: number }> = [];

  for (const campaign of sentCampaigns.slice(0, 50)) {
    const stats = await campaignAnalyticsStorage.getCampaignStats(campaign.id);
    totalOpenRate += stats.openRate;
    totalClickRate += stats.clickRate;
    
    campaignPerformance.push({
      id: campaign.id,
      name: campaign.name,
      openRate: stats.openRate,
      clickRate: stats.clickRate
    });
  }

  const avgOpenRate = sentCampaigns.length > 0 
    ? Math.round((totalOpenRate / Math.min(sentCampaigns.length, 50)) * 10) / 10 
    : 0;
  const avgClickRate = sentCampaigns.length > 0 
    ? Math.round((totalClickRate / Math.min(sentCampaigns.length, 50)) * 10) / 10 
    : 0;

  const topPerforming = campaignPerformance
    .sort((a, b) => b.openRate - a.openRate)
    .slice(0, 5);

  return {
    totalCampaigns: allCampaigns.length,
    sentThisMonth,
    averageOpenRate: avgOpenRate,
    averageClickRate: avgClickRate,
    topPerformingCampaigns: topPerforming
  };
}

export async function getSequenceAnalytics(parentCampaignId: string): Promise<{
  steps: Array<{
    stepNumber: number;
    campaignId: string;
    name: string;
    recipientCount: number;
    sentCount: number;
    openedCount: number;
    clickedCount: number;
    droppedFromSequence: number;
  }>;
  totalRecipients: number;
  completionRate: number;
}> {
  const steps = await campaignStorage.getSequenceSteps(parentCampaignId);
  const allSteps = [await campaignStorage.getById(parentCampaignId), ...steps].filter(Boolean);
  
  const stepAnalytics: Array<{
    stepNumber: number;
    campaignId: string;
    name: string;
    recipientCount: number;
    sentCount: number;
    openedCount: number;
    clickedCount: number;
    droppedFromSequence: number;
  }> = [];
  let firstStepRecipients = 0;
  let lastStepCompleted = 0;

  for (let i = 0; i < allSteps.length; i++) {
    const step = allSteps[i];
    if (!step) continue;

    const recipients = await campaignRecipientStorage.getByCampaignId(step.id);
    const sentCount = recipients.filter(r => r.status === 'sent' || r.status === 'delivered').length;
    const openedCount = recipients.filter(r => r.openedAt).length;
    const clickedCount = recipients.filter(r => r.clickedAt).length;

    if (i === 0) {
      firstStepRecipients = recipients.length;
    }

    const previousRecipients: number = i > 0 && stepAnalytics[i - 1] ? stepAnalytics[i - 1].recipientCount : recipients.length;
    const droppedFromSequence: number = previousRecipients - recipients.length;

    if (i === allSteps.length - 1) {
      lastStepCompleted = sentCount;
    }

    stepAnalytics.push({
      stepNumber: i + 1,
      campaignId: step.id,
      name: step.name,
      recipientCount: recipients.length,
      sentCount,
      openedCount,
      clickedCount,
      droppedFromSequence: Math.max(0, droppedFromSequence)
    });
  }

  return {
    steps: stepAnalytics,
    totalRecipients: firstStepRecipients,
    completionRate: firstStepRecipients > 0 
      ? Math.round((lastStepCompleted / firstStepRecipients) * 1000) / 10 
      : 0
  };
}
