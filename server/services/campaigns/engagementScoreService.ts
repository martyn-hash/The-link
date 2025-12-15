import { campaignAnalyticsStorage, campaignRecipientStorage, campaignStorage } from '../../storage/campaigns/index.js';
import { subDays } from 'date-fns';

const SCORE_WEIGHTS = {
  email_opened: 1,
  email_clicked: 2,
  sms_clicked: 2,
  page_viewed: 2,
  action_completed: 5,
  campaign_ignored: -1
} as const;

export type EngagementEventType = keyof typeof SCORE_WEIGHTS;

export async function updateEngagementScore(
  clientId: string,
  event: EngagementEventType
): Promise<void> {
  if (event === 'campaign_ignored') {
    await campaignAnalyticsStorage.incrementCampaignIgnored(clientId);
  } else {
    await campaignAnalyticsStorage.updateEngagementScore(clientId, event);
  }
}

export async function processIgnoredCampaigns(): Promise<{
  campaignsProcessed: number;
  recipientsMarkedIgnored: number;
}> {
  const cutoffDate = subDays(new Date(), 7);
  const campaigns = await campaignStorage.getSentBefore(cutoffDate);
  
  let recipientsMarkedIgnored = 0;

  for (const campaign of campaigns) {
    const recipients = await campaignRecipientStorage.getNoEngagement(campaign.id);
    
    for (const recipient of recipients) {
      await updateEngagementScore(recipient.clientId, 'campaign_ignored');
      recipientsMarkedIgnored++;
    }
  }

  return {
    campaignsProcessed: campaigns.length,
    recipientsMarkedIgnored
  };
}

export async function getClientEngagementSummary(clientId: string): Promise<{
  score: number;
  emailStats: { received: number; opened: number; clicked: number };
  smsStats: { received: number; clicked: number };
  pageStats: { viewed: number; actionsCompleted: number };
  consecutiveIgnored: number;
  lastEngagement: Date | null;
}> {
  const scoreData = await campaignAnalyticsStorage.getClientEngagementScore(clientId);
  
  if (!scoreData) {
    return {
      score: 0,
      emailStats: { received: 0, opened: 0, clicked: 0 },
      smsStats: { received: 0, clicked: 0 },
      pageStats: { viewed: 0, actionsCompleted: 0 },
      consecutiveIgnored: 0,
      lastEngagement: null
    };
  }

  return {
    score: scoreData.totalScore ?? 0,
    emailStats: {
      received: scoreData.emailsReceived ?? 0,
      opened: scoreData.emailsOpened ?? 0,
      clicked: scoreData.emailsClicked ?? 0
    },
    smsStats: {
      received: scoreData.smsReceived ?? 0,
      clicked: scoreData.smsClicked ?? 0
    },
    pageStats: {
      viewed: scoreData.pagesViewed ?? 0,
      actionsCompleted: scoreData.actionsCompleted ?? 0
    },
    consecutiveIgnored: scoreData.consecutiveIgnored ?? 0,
    lastEngagement: scoreData.lastEngagementAt ?? null
  };
}

export async function getEngagementLeaderboard(limit: number = 10): Promise<{
  topEngaged: Array<{ clientId: string; score: number }>;
  leastEngaged: Array<{ clientId: string; score: number; consecutiveIgnored: number }>;
}> {
  const topEngaged = await campaignAnalyticsStorage.getTopEngagedClients(limit);
  const leastEngaged = await campaignAnalyticsStorage.getLeastEngagedClients(limit);

  return {
    topEngaged: topEngaged.map(c => ({
      clientId: c.clientId,
      score: c.totalScore ?? 0
    })),
    leastEngaged: leastEngaged.map(c => ({
      clientId: c.clientId,
      score: c.totalScore ?? 0,
      consecutiveIgnored: c.consecutiveIgnored ?? 0
    }))
  };
}
