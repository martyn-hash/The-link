import sgMail from '@sendgrid/mail';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected');
  }
  return {apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email};
}

export async function getUncachableSendGridClient() {
  const {apiKey, email} = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

export interface UnreadProjectMessageSummary {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  threads: {
    threadId: string;
    topic: string;
    projectId: string;
    projectName: string;
    unreadCount: number;
    oldestUnreadAt: Date;
  }[];
}

export async function sendProjectMessageReminderEmail(summary: UnreadProjectMessageSummary): Promise<void> {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    
    const userName = summary.firstName && summary.lastName 
      ? `${summary.firstName} ${summary.lastName}` 
      : summary.firstName || 'there';
    
    const totalUnread = summary.threads.reduce((sum, t) => sum + t.unreadCount, 0);
    const threadPlural = summary.threads.length === 1 ? 'thread' : 'threads';
    const messagePlural = totalUnread === 1 ? 'message' : 'messages';
    
    let threadList = summary.threads.map(thread => {
      const messageCount = thread.unreadCount === 1 ? '1 message' : `${thread.unreadCount} messages`;
      const projectUrl = `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/projects/${thread.projectId}?tab=messages&thread=${thread.threadId}`;
      return `• ${thread.topic} (${thread.projectName}) - ${messageCount}\n  ${projectUrl}`;
    }).join('\n\n');
    
    const htmlThreadList = summary.threads.map(thread => {
      const messageCount = thread.unreadCount === 1 ? '1 message' : `${thread.unreadCount} messages`;
      const projectUrl = `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/projects/${thread.projectId}?tab=messages&thread=${thread.threadId}`;
      return `
        <div style="margin-bottom: 20px; padding: 15px; background-color: #f9fafb; border-left: 3px solid #3b82f6; border-radius: 4px;">
          <div style="font-weight: 600; color: #111827; margin-bottom: 8px;">
            ${thread.topic}
          </div>
          <div style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">
            ${thread.projectName} • ${messageCount}
          </div>
          <a href="${projectUrl}" style="display: inline-block; padding: 8px 16px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 500;">
            View Messages
          </a>
        </div>
      `;
    }).join('');
    
    const msg = {
      to: summary.email,
      from: {
        email: fromEmail,
        name: 'The Link'
      },
      subject: `You have ${totalUnread} unread ${messagePlural} in ${summary.threads.length} project ${threadPlural}`,
      text: `Hi ${userName},\n\nYou have ${totalUnread} unread ${messagePlural} in ${summary.threads.length} project ${threadPlural}:\n\n${threadList}\n\nBest regards,\nThe Link Team`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #111827; margin-bottom: 24px;">
            Hi ${userName},
          </h2>
          <p style="color: #374151; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
            You have <strong>${totalUnread} unread ${messagePlural}</strong> in <strong>${summary.threads.length} project ${threadPlural}</strong>:
          </p>
          ${htmlThreadList}
          <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
            Best regards,<br/>
            The Link Team
          </p>
        </div>
      `
    };
    
    await client.send(msg);
    console.log(`[Email] Sent project message reminder to ${summary.email} (${totalUnread} unread in ${summary.threads.length} threads)`);
  } catch (error) {
    console.error(`[Email] Failed to send project message reminder to ${summary.email}:`, error);
    throw error;
  }
}
