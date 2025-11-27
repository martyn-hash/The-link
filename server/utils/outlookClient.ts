import { Client } from '@microsoft/microsoft-graph-client';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
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
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=outlook',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Outlook not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableOutlookClient() {
  const accessToken = await getAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

interface EmailAttachment {
  filename: string;
  contentType: string;
  content: string; // Base64 encoded content
  size: number;
}

// Helper function to send email via Microsoft Graph API
export async function sendEmail(
  to: string, 
  subject: string, 
  content: string, 
  isHtml: boolean = false,
  attachments: EmailAttachment[] = []
) {
  try {
    console.log('[Outlook Client] Getting Outlook client...');
    const graphClient = await getUncachableOutlookClient();
    console.log('[Outlook Client] Client obtained successfully');
    
    const message: any = {
      subject,
      body: {
        contentType: isHtml ? 'HTML' : 'Text',
        content
      },
      toRecipients: [
        {
          emailAddress: {
            address: to
          }
        }
      ]
    };

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      message.attachments = attachments.map(att => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.filename,
        contentType: att.contentType,
        contentBytes: att.content // Already base64 encoded
      }));
      console.log('[Outlook Client] Adding', attachments.length, 'attachment(s) to email');
    }

    console.log('[Outlook Client] Sending email via Graph API to:', to, 'Subject:', subject);
    const result = await graphClient.api('/me/sendMail').post({
      message,
      saveToSentItems: true
    });
    console.log('[Outlook Client] Email sent successfully via Graph API');

    return { success: true, result };
  } catch (error) {
    console.error('[Outlook Client] Error sending email:', {
      error: error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      to,
      subject
    });
    throw error;
  }
}

// Helper function to get user profile information
export async function getOutlookProfile() {
  try {
    const graphClient = await getUncachableOutlookClient();
    const profile = await graphClient.api('/me').get();
    return profile;
  } catch (error) {
    console.error('Error getting Outlook profile:', error);
    throw error;
  }
}

// Setup webhook subscription for a user's Outlook mailbox
// Note: This requires user-level OAuth tokens (not app-level) for per-user mailbox subscriptions
export async function setupOutlookWebhook(userId: string): Promise<any> {
  // TODO: Implement webhook subscription for user mailbox
  // This requires:
  // 1. User-level OAuth access token (from userOutlookClient)
  // 2. Graph API subscription creation
  // 3. Webhook endpoint validation
  throw new Error('Webhook subscription not yet implemented - use per-user OAuth flow via userOutlookClient');
}