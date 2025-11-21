import sgMail from '@sendgrid/mail';
import DOMPurify from 'isomorphic-dompurify';

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

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableSendGridClient() {
  const {apiKey, email} = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

// Helper function to convert HTML to plain text
function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/[uo]l>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' | ')
    .replace(/<\/th>/gi, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

// Helper function to send project message notification email
export async function sendProjectMessageNotification({
  to,
  senderName,
  projectName,
  threadTopic,
  messagePreview,
  threadUrl,
}: {
  to: string;
  senderName: string;
  projectName: string;
  threadTopic: string;
  messagePreview: string;
  threadUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    
    // Sanitize HTML to prevent injection attacks - only allow safe formatting tags
    const sanitizedHtml = DOMPurify.sanitize(messagePreview, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody'],
      ALLOWED_ATTR: []
    });
    
    // Convert sanitized HTML to plain text for the text version
    const plainTextPreview = htmlToPlainText(sanitizedHtml).substring(0, 500);
    
    // Truncate sanitized HTML for preview (keep reasonable size)
    const htmlPreview = sanitizedHtml.substring(0, 2000);
    
    const msg = {
      to,
      from: {
        email: fromEmail,
        name: 'The Link'
      },
      subject: `New message in ${threadTopic}`,
      text: `${senderName} sent a message in "${threadTopic}" for project ${projectName}.\n\n${plainTextPreview}\n\nView the conversation: ${threadUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Message from ${senderName}</h2>
          <p style="color: #666;">in <strong>${threadTopic}</strong> for project <strong>${projectName}</strong></p>
          <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #3b82f6; margin: 20px 0;">
            ${htmlPreview}
          </div>
          <a href="${threadUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px;">
            View Conversation
          </a>
        </div>
      `,
    };

    await client.send(msg);
    console.log(`[SendGrid] Notification email sent to ${to}`);
  } catch (error) {
    console.error('[SendGrid] Failed to send notification email:', error);
    // Don't rethrow - we want message sending to succeed even if email fails
  }
}
