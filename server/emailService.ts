import { MailService } from '@sendgrid/mail';
import DOMPurify from 'isomorphic-dompurify';

if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY environment variable not set. Email notifications will be disabled.");
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

const baseUrl = 'https://flow.growth.accountants';
const logoUrl = `${baseUrl}/attached_assets/full_logo_transparent_600_1761924125378.png`;

interface EmailParams {
  to: string;
  from?: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("Email not sent - SendGrid API key not configured");
    return false;
  }

  // Extract email address if 'from' param already has a name
  let emailAddress = params.from || process.env.FROM_EMAIL || "link@growth-accountants.com";
  if (emailAddress.includes('<')) {
    // Already has a name, extract just the email
    const match = emailAddress.match(/<(.+)>/);
    if (match) emailAddress = match[1];
  }
  
  // Always use 'The Link' as sender name
  const fromEmail = `The Link <${emailAddress}>`;
  
  try {
    const emailData: any = {
      to: params.to,
      from: fromEmail,
      subject: params.subject,
    };
    
    if (params.html) {
      emailData.html = params.html;
    }
    if (params.text) {
      emailData.text = params.text;
    }
    
    await mailService.send(emailData);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export async function sendMagicLinkEmail(
  recipientEmail: string,
  recipientName: string = recipientEmail,
  magicLinkToken: string,
  fourDigitCode: string,
  baseUrl: string
): Promise<boolean> {
  const productionUrl = 'https://flow.growth.accountants';
  const magicLinkUrl = `${productionUrl}/magic-link-verify?token=${magicLinkToken}`;
  const logoUrl = `${productionUrl}/attached_assets/full_logo_transparent_600_1761924125378.png`;
  const subject = `Your Magic Link Login - The Link (Code: ${fourDigitCode})`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
          <img src="${logoUrl}" alt="Growth Accountants" style="max-width: 120px; height: auto; margin-bottom: 10px;" />
          <h1 style="color: #1e293b; margin: 0; font-size: 20px;">The Link</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #1e293b; margin-top: 0;">Magic Link Login</h2>
          <p style="color: #475569; font-size: 16px;">Hello ${recipientName},</p>
          <p style="color: #475569; font-size: 16px;">You requested a magic link to sign in to your The Link account. You can use either of the following methods to log in:</p>
          <div style="background-color: #f0f9ff; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #e0f2fe;">
            <h3 style="margin-top: 0; color: #0A7BBF; font-size: 18px;">🔗 Option 1: Click the Magic Link</h3>
            <p style="margin-bottom: 20px; font-size: 16px; color: #374151;">Click the button below to log in automatically:</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${magicLinkUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #0A7BBF 0%, #0869A3 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(10, 123, 191, 0.3);">
                🚀 Sign In to The Link
              </a>
            </div>
            <p style="margin-top: 20px; font-size: 12px; color: #6b7280; line-height: 1.5;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <span style="word-break: break-all; font-family: monospace; background-color: #f8fafc; padding: 4px 8px; border-radius: 4px; margin-top: 8px; display: inline-block;">${magicLinkUrl}</span>
            </p>
          </div>
          
          <div style="background-color: #f0fdf4; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #dcfce7;">
            <h3 style="margin-top: 0; color: #76CA23; font-size: 18px;">🔢 Option 2: Use Verification Code</h3>
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">Alternatively, enter this 4-digit code on the login page:</p>
            <div style="text-align: center; margin: 25px 0;">
              <div style="display: inline-block; background: linear-gradient(135deg, #76CA23 0%, #5A9A1A 100%); color: white; padding: 20px 30px; border-radius: 16px; box-shadow: 0 8px 16px rgba(118, 202, 35, 0.3); border: 3px solid #89d93b;">
                <div style="font-size: 48px; font-weight: 900; letter-spacing: 12px; line-height: 1; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">
                  ${fourDigitCode}
                </div>
                <div style="font-size: 12px; margin-top: 8px; opacity: 0.9; font-weight: 600; letter-spacing: 1px;">
                  VERIFICATION CODE
                </div>
              </div>
            </div>
          </div>
          
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; color: #92400e; font-size: 15px; font-weight: 600; line-height: 1.4;">
              <strong style="font-size: 16px;">⏰ Important:</strong> This magic link and code will expire in <strong style="color: #dc2626;">10 minutes</strong> for your security.
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            If you didn't request this login link, please ignore this email. Your account remains secure.
          </p>
        </div>
        <div style="background-color: #f1f5f9; padding: 30px; text-align: center; color: #64748b; font-size: 14px;">
          <p style="margin: 0 0 10px 0;">
            <strong style="color: #0A7BBF;">The Link</strong> by Growth Accountants
          </p>
          <p style="margin: 0; font-size: 13px;">
            Your workflow management partner
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Hello ${recipientName},

You requested a magic link to sign in to your The Link account. You can use either of the following methods to log in:

OPTION 1: Click the Magic Link
Copy and paste this link into your browser to log in automatically:
${magicLinkUrl}

OPTION 2: Use Verification Code
Enter this 4-digit code on the login page: 

>>> ${fourDigitCode} <<<

IMPORTANT: This magic link and code will expire in 10 minutes for your security.

If you didn't request this login link, please ignore this email. Your account remains secure.

Best regards,
The Link Team
  `;

  return await sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
  });
}

export async function sendTaskAssignmentEmail(
  assigneeEmail: string,
  assigneeName: string,
  projectDescription: string,
  clientName: string,
  newStatus: string
): Promise<boolean> {
  const baseUrl = 'https://flow.growth.accountants';
  const logoUrl = `${baseUrl}/attached_assets/full_logo_transparent_600_1761924125378.png`;
  const subject = `New Task Assignment - ${clientName} - The Link`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
          <img src="${logoUrl}" alt="Growth Accountants" style="max-width: 120px; height: auto; margin-bottom: 10px;" />
          <h1 style="color: #1e293b; margin: 0; font-size: 20px;">The Link</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #1e293b; margin-top: 0;">📋 New Task Assignment</h2>
          <p style="color: #475569; font-size: 16px;">Hello ${assigneeName},</p>
          <p style="color: #475569; font-size: 16px;">You have been assigned a new task in The Link system:</p>
          
          <div style="background-color: #f0f9ff; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #e0f2fe;">
            <h3 style="margin-top: 0; color: #0A7BBF; font-size: 18px;">Project Details</h3>
            <p style="margin-bottom: 12px; color: #374151;"><strong>Client:</strong> ${clientName}</p>
            <p style="margin-bottom: 12px; color: #374151;"><strong>Description:</strong> ${projectDescription}</p>
            <p style="margin-bottom: 0; color: #374151;"><strong>Status:</strong> <span style="background-color: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 6px; font-weight: 600;">${newStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span></p>
          </div>
          
          <p style="color: #475569; font-size: 16px;">Please log into The Link system to view the complete project details and take the necessary action.</p>
        </div>
        <div style="background-color: #f1f5f9; padding: 30px; text-align: center; color: #64748b; font-size: 14px;">
          <p style="margin: 0 0 10px 0;">
            <strong style="color: #0A7BBF;">The Link</strong> by Growth Accountants
          </p>
          <p style="margin: 0; font-size: 13px;">
            Your workflow management partner
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Hello ${assigneeName},

You have been assigned a new task in The Link system:

Client: ${clientName}
Description: ${projectDescription}
Status: ${newStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}

Please log into The Link system to view the complete project details and take the necessary action.

Best regards,
The Link Team
  `;

  return await sendEmail({
    to: assigneeEmail,
    subject,
    text,
    html,
  });
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

export async function sendStageChangeNotificationEmail(
  recipientEmail: string,
  recipientName: string,
  projectDescription: string,
  clientName: string,
  stageName: string,
  fromStage?: string,
  projectId?: string,
  stageConfig?: { maxInstanceTime?: number | null },
  chronology?: Array<{ toStatus: string; timestamp: string }>,
  projectCreatedAt?: string,
  changeReason?: string,
  notes?: string,
  fieldResponses?: Array<{ fieldName: string; fieldType: string; value: string | number | string[] }>,
  attachments?: Array<{ fileName: string; fileSize: number; fileType: string; objectPath: string }>
): Promise<boolean> {
  const baseUrl = 'https://flow.growth.accountants';
  const logoUrl = `${baseUrl}/attached_assets/full_logo_transparent_600_1761924125378.png`;
  const formattedStageName = stageName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const subject = `Project moved to ${formattedStageName} - Action required - The Link`;
  
  const stageTransition = fromStage 
    ? `from "${fromStage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}" to "${formattedStageName}"`
    : `to "${formattedStageName}"`;
  
  // Sanitize HTML notes to prevent injection attacks - only allow safe formatting tags
  const sanitizedNotes = notes ? DOMPurify.sanitize(notes, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody'],
    ALLOWED_ATTR: []
  }) : '';
  
  // Convert sanitized notes to plain text for text email
  const notesPlainText = sanitizedNotes ? htmlToPlainText(sanitizedNotes) : '';
  const notesHtml = sanitizedNotes;
  
  // Calculate timing information if we have the necessary data
  let assignedTimestamp: string | null = null;
  let dueTimestamp: string | null = null;
  let maxHoursAllowed: number | null = null;
  
  if (chronology && chronology.length > 0) {
    // Import business time functions for deadline calculation
    const { addBusinessHours } = await import('@shared/businessTime');
    
    // Sort chronology by timestamp DESC and find when project entered current stage
    const sortedChronology = [...chronology].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const stageEntry = sortedChronology.find(entry => entry.toStatus === stageName);
    
    if (stageEntry) {
      assignedTimestamp = stageEntry.timestamp;
    } else if (projectCreatedAt) {
      // If no chronology entry, project may have been created in this stage
      assignedTimestamp = projectCreatedAt;
    }
    
    // Calculate due date if we have max time and assignment timestamp
    if (assignedTimestamp && stageConfig?.maxInstanceTime && stageConfig.maxInstanceTime > 0) {
      maxHoursAllowed = stageConfig.maxInstanceTime;
      
      // Calculate deadline by adding business hours (excluding weekends)
      const deadlineDate = addBusinessHours(assignedTimestamp, maxHoursAllowed);
      dueTimestamp = deadlineDate.toISOString();
    }
  }
  
  // Format dates for email display
  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-GB', { 
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };
  
  // Helper function to format field response values
  const formatFieldValue = (fieldType: string, value: string | number | string[]): string => {
    if (fieldType === 'multi_select' && Array.isArray(value)) {
      return value.join(', ');
    }
    return String(value);
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
          <img src="${logoUrl}" alt="Growth Accountants" style="max-width: 120px; height: auto; margin-bottom: 10px;" />
          <h1 style="color: #1e293b; margin: 0; font-size: 20px;">The Link</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #1e293b; margin-top: 0;">🔄 Project Stage Changed</h2>
          <p style="color: #475569; font-size: 16px;">Hello ${recipientName},</p>
          
          <div style="background-color: #f0f9ff; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #e0f2fe;">
            <h3 style="margin-top: 0; color: #0A7BBF; font-size: 18px;">📋 Project Details</h3>
            <p style="margin-bottom: 12px; color: #374151;"><strong>Client:</strong> ${clientName}</p>
            <p style="margin-bottom: 12px; color: #374151;"><strong>Description:</strong> ${projectDescription}</p>
            <p style="margin-bottom: 0; color: #374151;"><strong>Current Stage:</strong> <span style="background-color: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 6px; font-weight: 600;">${formattedStageName}</span></p>
          </div>
          
          ${assignedTimestamp ? `
          <div style="background-color: #fef3c7; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #fbbf24;">
            <h3 style="margin-top: 0; color: #92400e; font-size: 18px;">⏱️ Timeline & Deadlines</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #374151; font-weight: 600; width: 45%;">Assigned to you:</td>
                <td style="padding: 8px 0; color: #374151;">${formatDateTime(assignedTimestamp)}</td>
              </tr>
              ${dueTimestamp ? `
              <tr style="background-color: #fed7aa;">
                <td style="padding: 12px 0; color: #92400e; font-weight: 700; font-size: 16px; border-top: 2px solid #f59e0b;">Deadline:</td>
                <td style="padding: 12px 0; color: #dc2626; font-weight: 700; font-size: 18px; border-top: 2px solid #f59e0b;">${formatDateTime(dueTimestamp)}</td>
              </tr>
              <tr style="background-color: #fed7aa;">
                <td colspan="2" style="padding: 8px 0 12px 0; color: #92400e; font-size: 14px;">
                  You have ${maxHoursAllowed} business hours to complete this work (weekends excluded)
                </td>
              </tr>
              ` : ''}
            </table>
          </div>
          ` : ''}
          
          ${changeReason || notes || (fieldResponses && fieldResponses.length > 0) || fromStage ? `
          <div style="background-color: #f8fafc; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #e2e8f0;">
            <h3 style="margin-top: 0; color: #475569; font-size: 18px;">📝 Details</h3>
            ${fromStage ? `<p style="margin-bottom: 12px; color: #374151;"><strong>Stage Change:</strong> ${fromStage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} → ${formattedStageName}</p>` : ''}
            ${changeReason ? `<p style="margin-bottom: 12px; color: #374151;"><strong>Change Reason:</strong> ${changeReason}</p>` : ''}
            ${notesHtml ? `<div style="margin-bottom: 12px; color: #374151;"><strong>Notes:</strong><div style="margin-top: 8px;">${notesHtml}</div></div>` : ''}
            ${fieldResponses && fieldResponses.length > 0 ? `
              <div style="margin-top: 15px;">
                <p style="margin-bottom: 8px; color: #374151; font-weight: 600;">Additional Information:</p>
                ${fieldResponses.map(fr => `
                  <p style="margin-bottom: 8px; margin-left: 15px; color: #374151;">
                    <strong>${fr.fieldName}:</strong> ${formatFieldValue(fr.fieldType, fr.value)}
                  </p>
                `).join('')}
              </div>
            ` : ''}
          </div>
          ` : ''}
          
          ${attachments && attachments.length > 0 ? `
          <div style="background-color: #fdf4ff; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #e879f9;">
            <h3 style="margin-top: 0; color: #a21caf; font-size: 18px;">📎 Attachments (${attachments.length})</h3>
            <p style="margin-bottom: 12px; color: #374151;">The following files were attached to this stage change. Please log in to The Link to view and download them.</p>
            <ul style="margin: 0; padding-left: 20px;">
              ${attachments.map(att => `
                <li style="margin-bottom: 8px; color: #374151;">
                  <strong>${att.fileName}</strong> <span style="color: #6b7280; font-size: 12px;">(${(att.fileSize / 1024).toFixed(1)} KB)</span>
                </li>
              `).join('')}
            </ul>
          </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/projects${projectId ? `/${projectId}` : ''}" 
               style="display: inline-block; background: linear-gradient(135deg, #0A7BBF 0%, #0869A3 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(10, 123, 191, 0.3);">
              🚀 Review Project in The Link
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            You're receiving this notification because you have notifications enabled for stage changes. You can update your notification preferences in your account settings.
          </p>
        </div>
        <div style="background-color: #f1f5f9; padding: 30px; text-align: center; color: #64748b; font-size: 14px;">
          <p style="margin: 0 0 10px 0;">
            <strong style="color: #0A7BBF;">The Link</strong> by Growth Accountants
          </p>
          <p style="margin: 0; font-size: 13px;">
            Your workflow management partner
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Hello ${recipientName},

PROJECT DETAILS:
Client: ${clientName}
Description: ${projectDescription}
Current Stage: ${formattedStageName}

${assignedTimestamp ? `
⏱️ TIMELINE & DEADLINES:
- Assigned to you: ${formatDateTime(assignedTimestamp)}
${dueTimestamp ? `- DEADLINE: ${formatDateTime(dueTimestamp)}
  You have ${maxHoursAllowed} business hours to complete this work (weekends excluded)
` : ''}
` : ''}

${changeReason || notes || (fieldResponses && fieldResponses.length > 0) || fromStage ? `
DETAILS:
${fromStage ? `Stage Change: ${fromStage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} → ${formattedStageName}` : ''}
${changeReason ? `Change Reason: ${changeReason}` : ''}
${notesPlainText ? `Notes: ${notesPlainText}` : ''}
${fieldResponses && fieldResponses.length > 0 ? `
Additional Information:
${fieldResponses.map(fr => `  - ${fr.fieldName}: ${formatFieldValue(fr.fieldType, fr.value)}`).join('\n')}
` : ''}
` : ''}

${attachments && attachments.length > 0 ? `
📎 ATTACHMENTS (${attachments.length}):
${attachments.map(att => `  - ${att.fileName} (${(att.fileSize / 1024).toFixed(1)} KB)`).join('\n')}

Please log in to The Link to view and download these files.
` : ''}

Please log into The Link system to review the project and take the necessary action.

You're receiving this notification because you have notifications enabled for stage changes. You can update your notification preferences in your account settings.

Best regards,
The Link Team
  `;

  return await sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
  });
}

export async function sendSchedulingSummaryEmail(
  recipientEmail: string,
  recipientName: string,
  summaryData: {
    status: 'success' | 'partial_failure' | 'failure';
    servicesFoundDue: number;
    projectsCreated: number;
    servicesRescheduled: number;
    errorsEncountered: number;
    executionTimeMs: number;
    summary: string;
    errors?: any[];
  }
): Promise<boolean> {
  const baseUrl = 'https://flow.growth.accountants';
  const logoUrl = `${baseUrl}/attached_assets/full_logo_transparent_600_1761924125378.png`;
  const isFailure = summaryData.status === 'failure';
  const hasErrors = summaryData.errorsEncountered > 0;
  
  const subject = `${isFailure ? '❌ ' : hasErrors ? '⚠️ ' : '✅ '}Nightly Project Scheduling Summary - ${new Date().toLocaleDateString()} - The Link`;
  
  const statusIcon = isFailure ? '❌' : hasErrors ? '⚠️' : '✅';
  const statusColor = isFailure ? '#dc2626' : hasErrors ? '#f59e0b' : '#10b981';
  const statusBg = isFailure ? '#fef2f2' : hasErrors ? '#fefbf2' : '#f0fdf4';
  const statusText = summaryData.status.replace('_', ' ').toUpperCase();
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
          <img src="${logoUrl}" alt="Growth Accountants" style="max-width: 120px; height: auto; margin-bottom: 10px;" />
          <h1 style="color: #1e293b; margin: 0; font-size: 20px;">The Link</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: ${statusColor}; margin-top: 0;">${statusIcon} Nightly Project Scheduling Summary</h2>
          <p style="color: #475569; font-size: 16px;">Hello ${recipientName},</p>
          <p style="color: #475569; font-size: 16px;">Your automated project scheduling system ran at ${new Date().toLocaleString()} with the following results:</p>
          
          <div style="background-color: ${statusBg}; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid ${statusColor}30;">
            <h3 style="margin-top: 0; color: ${statusColor}; font-size: 18px;">${statusIcon} Overall Status: ${statusText}</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
              <div style="background-color: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                <div style="font-size: 32px; font-weight: bold; color: #0A7BBF;">${summaryData.servicesFoundDue}</div>
                <div style="font-size: 14px; color: #6b7280; font-weight: 600;">SERVICES DUE</div>
              </div>
              <div style="background-color: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                <div style="font-size: 32px; font-weight: bold; color: #76CA23;">${summaryData.projectsCreated}</div>
                <div style="font-size: 14px; color: #6b7280; font-weight: 600;">PROJECTS CREATED</div>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
              <div style="background-color: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                <div style="font-size: 32px; font-weight: bold; color: #0A7BBF;">${summaryData.servicesRescheduled}</div>
                <div style="font-size: 14px; color: #6b7280; font-weight: 600;">SERVICES RESCHEDULED</div>
              </div>
              <div style="background-color: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                <div style="font-size: 32px; font-weight: bold; color: ${hasErrors ? '#dc2626' : '#6b7280'};">${summaryData.errorsEncountered}</div>
                <div style="font-size: 14px; color: #6b7280; font-weight: 600;">ERRORS</div>
              </div>
            </div>
            <p style="margin-bottom: 0; color: #374151; font-size: 14px; text-align: center;">
              <strong>Execution Time:</strong> ${summaryData.executionTimeMs}ms
            </p>
          </div>
          
          ${hasErrors ? `
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #dc2626;">
            <h3 style="margin-top: 0; color: #dc2626; font-size: 16px;">⚠️ Errors Encountered</h3>
            <p style="color: #374151; margin-bottom: 15px;">The following errors occurred during scheduling:</p>
            <div style="background-color: white; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #374151; max-height: 200px; overflow-y: auto; border: 1px solid #fecaca;">
              ${summaryData.errors?.map(error => 
                `<div style="margin-bottom: 10px; padding: 8px; background-color: #fef2f2; border-radius: 4px;">
                  <strong>Service ${error.serviceId || 'Unknown'}:</strong> ${error.error || 'Unknown error'}
                </div>`
              ).join('') || 'Error details not available'}
            </div>
          </div>
          ` : ''}
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e2e8f0;">
            <h3 style="margin-top: 0; color: #475569; font-size: 16px;">📋 Summary</h3>
            <p style="margin-bottom: 0; color: #374151; line-height: 1.6; font-style: italic;">
              "${summaryData.summary}"
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/admin" 
               style="display: inline-block; background: linear-gradient(135deg, #0A7BBF 0%, #0869A3 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(10, 123, 191, 0.3);">
              🚀 View Admin Dashboard
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            This is an automated summary of your nightly project scheduling run. The next scheduling run will occur at 1:00 AM UTC tomorrow.
          </p>
        </div>
        <div style="background-color: #f1f5f9; padding: 30px; text-align: center; color: #64748b; font-size: 14px;">
          <p style="margin: 0 0 10px 0;">
            <strong style="color: #0A7BBF;">The Link</strong> by Growth Accountants
          </p>
          <p style="margin: 0; font-size: 13px;">
            Your workflow management partner
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
NIGHTLY PROJECT SCHEDULING SUMMARY - ${new Date().toLocaleDateString()}

Hello ${recipientName},

Your automated project scheduling system ran at ${new Date().toLocaleString()} with the following results:

OVERALL STATUS: ${statusText}

RESULTS:
- Services Found Due: ${summaryData.servicesFoundDue}
- Projects Created: ${summaryData.projectsCreated}
- Services Rescheduled: ${summaryData.servicesRescheduled}
- Errors Encountered: ${summaryData.errorsEncountered}
- Execution Time: ${summaryData.executionTimeMs}ms

SUMMARY:
${summaryData.summary}

${hasErrors ? `
ERRORS:
${summaryData.errors?.map(error => `- Service ${error.serviceId || 'Unknown'}: ${error.error || 'Unknown error'}`).join('\n') || 'Error details not available'}
` : ''}

This is an automated summary of your nightly project scheduling run. The next scheduling run will occur at 1:00 AM UTC tomorrow.

Best regards,
The Link Automated Scheduling System
  `;

  return await sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
  });
}

export async function sendBulkProjectAssignmentSummaryEmail(
  recipientEmail: string,
  recipientName: string,
  projectCount: number
): Promise<boolean> {
  const baseUrl = 'https://flow.growth.accountants';
  const logoUrl = `${baseUrl}/attached_assets/full_logo_transparent_600_1761924125378.png`;
  const subject = `${projectCount} new projects assigned to you - The Link`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
          <img src="${logoUrl}" alt="Growth Accountants" style="max-width: 120px; height: auto; margin-bottom: 10px;" />
          <h1 style="color: #1e293b; margin: 0; font-size: 20px;">The Link</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #1e293b; margin-top: 0;">📋 New Projects Assigned</h2>
          <p style="color: #475569; font-size: 16px;">Hello ${recipientName},</p>
          <p style="color: #475569; font-size: 16px;">You have <strong>${projectCount}</strong> new projects awaiting your attention.</p>
          
          <div style="background-color: #f0f9ff; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #e0f2fe; text-align: center;">
            <div style="background: linear-gradient(135deg, #0A7BBF 0%, #0869A3 100%); color: white; display: inline-block; padding: 20px 30px; border-radius: 16px; box-shadow: 0 8px 16px rgba(10, 123, 191, 0.3);">
              <div style="font-size: 48px; font-weight: 900; line-height: 1;">
                ${projectCount}
              </div>
              <div style="font-size: 14px; margin-top: 8px; opacity: 0.9; font-weight: 600; letter-spacing: 1px;">
                NEW PROJECTS
              </div>
            </div>
            <p style="margin-top: 20px; font-size: 16px; color: #374151;">
              Please log in to review and begin work on your new projects.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/projects" 
               style="display: inline-block; background: linear-gradient(135deg, #0A7BBF 0%, #0869A3 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(10, 123, 191, 0.3);">
              🚀 View Your Projects
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            You're receiving this summary notification because multiple projects were assigned to you at once. You can update your notification preferences in your account settings.
          </p>
        </div>
        <div style="background-color: #f1f5f9; padding: 30px; text-align: center; color: #64748b; font-size: 14px;">
          <p style="margin: 0 0 10px 0;">
            <strong style="color: #0A7BBF;">The Link</strong> by Growth Accountants
          </p>
          <p style="margin: 0; font-size: 13px;">
            Your workflow management partner
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Hello ${recipientName},

You have ${projectCount} new projects awaiting your attention. Please log in to review and begin work.

Visit: ${baseUrl}/projects

You're receiving this summary notification because multiple projects were assigned to you at once. You can update your notification preferences in your account settings.

Best regards,
The Link Team
  `;

  return await sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
  });
}

export async function sendWelcomeEmail(
  recipientEmail: string,
  recipientName: string,
  loginUrl: string = 'https://flow.growth.accountants'
): Promise<boolean> {
  const baseUrl = 'https://flow.growth.accountants';
  const logoUrl = `${baseUrl}/attached_assets/full_logo_transparent_600_1761924125378.png`;
  const subject = `Welcome to The Link - Your Account is Ready!`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
          <img src="${logoUrl}" alt="Growth Accountants" style="max-width: 120px; height: auto; margin-bottom: 10px;" />
          <h1 style="color: #1e293b; margin: 0; font-size: 24px;">Welcome to The Link!</h1>
        </div>
        
        <div style="padding: 40px 30px;">
          <h2 style="color: #1e293b; margin-top: 0;">🎉 Your Account is Ready</h2>
          <p style="color: #475569; font-size: 16px;">Hello ${recipientName},</p>
          <p style="color: #475569; font-size: 16px;">
            Your staff account has been created! You now have access to The Link, our workflow management system.
          </p>
          
          <div style="background-color: #f0f9ff; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #e0f2fe;">
            <h3 style="margin-top: 0; color: #0A7BBF; font-size: 18px;">🔐 First-Time Login Instructions</h3>
            <p style="color: #374151; font-size: 15px; margin-bottom: 15px;">
              For your first login, we recommend using the <strong>magic link</strong> feature for quick and secure access:
            </p>
            <ol style="color: #374151; font-size: 15px; line-height: 1.8; margin: 15px 0; padding-left: 20px;">
              <li>Click the button below to visit the login page</li>
              <li>Enter your email address: <strong style="color: #0A7BBF;">${recipientEmail}</strong></li>
              <li>Click "Magic Link"</li>
              <li>Check your email and click the link to log in instantly</li>
            </ol>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" 
               style="display: inline-block; background: #0A7BBF; color: #ffffff !important; padding: 18px 50px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 18px; box-shadow: 0 6px 20px rgba(10, 123, 191, 0.4); border: 3px solid #0869A3; transition: all 0.3s ease;">
              🚀 Go to Login Page
            </a>
          </div>
          
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin-top: 0; color: #92400e; font-size: 16px;">💡 Important: Password Required</h3>
            <p style="margin-bottom: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
              After your first login, you will be <strong>required to set a password</strong>. For best security practices, please create this password using your password manager.
            </p>
          </div>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e2e8f0;">
            <h3 style="margin-top: 0; color: #475569; font-size: 16px;">📧 Your Login Details</h3>
            <p style="margin-bottom: 8px; color: #374151;"><strong>Login URL:</strong></p>
            <p style="margin: 0 0 15px 0; font-size: 14px;">
              <a href="${loginUrl}" style="color: #0A7BBF; word-break: break-all;">${loginUrl}</a>
            </p>
            <p style="margin-bottom: 8px; color: #374151;"><strong>Your Email:</strong></p>
            <p style="margin: 0; color: #0A7BBF; font-size: 14px; font-family: monospace; background-color: #f1f5f9; padding: 8px; border-radius: 4px;">
              ${recipientEmail}
            </p>
          </div>
        </div>
        
        <div style="background-color: #f1f5f9; padding: 30px; text-align: center; color: #64748b; font-size: 14px;">
          <p style="margin: 0 0 10px 0;">
            <strong style="color: #0A7BBF;">The Link</strong> by Growth Accountants
          </p>
          <p style="margin: 0; font-size: 13px;">
            Your workflow management partner
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome to The Link!

Hello ${recipientName},

Your staff account has been created! You now have access to The Link, our workflow management system.

FIRST-TIME LOGIN INSTRUCTIONS:

For your first login, we recommend using the magic link feature for quick and secure access:

1. Visit the login page: ${loginUrl}
2. Enter your email address: ${recipientEmail}
3. Click "Magic Link"
4. Check your email and click the link to log in instantly

IMPORTANT: PASSWORD REQUIRED

After your first login, you will be required to set a password. For best security practices, please create this password using your password manager.

YOUR LOGIN DETAILS:
- Login URL: ${loginUrl}
- Your Email: ${recipientEmail}

Best regards,
The Link Team
  `;

  return await sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
  });
}

export async function sendInternalTaskAssignmentEmail(
  assigneeEmail: string,
  assigneeName: string,
  taskTitle: string,
  taskDescription: string | null,
  priority: string,
  dueDate: Date | null,
  creatorName: string,
  taskTypeName: string | null
): Promise<boolean> {
  const baseUrl = 'https://flow.growth.accountants';
  const logoUrl = `${baseUrl}/attached_assets/full_logo_transparent_600_1761924125378.png`;
  const subject = `New Internal Task Assigned: ${taskTitle} - The Link`;
  
  const priorityColors: Record<string, { bg: string; text: string }> = {
    urgent: { bg: '#fef2f2', text: '#dc2626' },
    high: { bg: '#fef3c7', text: '#f59e0b' },
    medium: { bg: '#dbeafe', text: '#1e40af' },
    low: { bg: '#f0fdf4', text: '#166534' }
  };
  
  const priorityEmoji: Record<string, string> = {
    urgent: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢'
  };
  
  const priorityColor = priorityColors[priority] || priorityColors.medium;
  const emoji = priorityEmoji[priority] || '📋';
  const formattedPriority = priority.charAt(0).toUpperCase() + priority.slice(1);
  const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString('en-GB', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }) : 'No due date set';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
          <img src="${logoUrl}" alt="Growth Accountants" style="max-width: 120px; height: auto; margin-bottom: 10px;" />
          <h1 style="color: #1e293b; margin: 0; font-size: 20px;">The Link</h1>
        </div>
        <div style="padding: 40px 30px;">
          <h2 style="color: #1e293b; margin-top: 0;">${emoji} New Internal Task Assigned</h2>
          <p style="color: #475569; font-size: 16px;">Hello ${assigneeName},</p>
          <p style="color: #475569; font-size: 16px;">You have been assigned a new internal task by ${creatorName}:</p>
          
          <div style="background-color: #f0f9ff; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #e0f2fe;">
            <h3 style="margin-top: 0; color: #0A7BBF; font-size: 18px;">📋 Task Details</h3>
            <p style="margin-bottom: 12px; color: #374151;"><strong>Title:</strong> ${taskTitle}</p>
            ${taskDescription ? `<p style="margin-bottom: 12px; color: #374151;"><strong>Description:</strong> ${taskDescription}</p>` : ''}
            ${taskTypeName ? `<p style="margin-bottom: 12px; color: #374151;"><strong>Type:</strong> ${taskTypeName}</p>` : ''}
            <p style="margin-bottom: 12px; color: #374151;"><strong>Priority:</strong> <span style="background-color: ${priorityColor.bg}; color: ${priorityColor.text}; padding: 4px 12px; border-radius: 6px; font-weight: 600;">${emoji} ${formattedPriority}</span></p>
            <p style="margin-bottom: 12px; color: #374151;"><strong>Due Date:</strong> ${formattedDueDate}</p>
            <p style="margin-bottom: 0; color: #374151;"><strong>Assigned By:</strong> ${creatorName}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/internal-tasks" 
               style="display: inline-block; background: linear-gradient(135deg, #0A7BBF 0%, #0869A3 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(10, 123, 191, 0.3);">
              🚀 View Task in The Link
            </a>
          </div>
          
          <p style="color: #475569; font-size: 16px;">Please log into The Link system to view the complete task details and take the necessary action.</p>
        </div>
        <div style="background-color: #f1f5f9; padding: 30px; text-align: center; color: #64748b; font-size: 14px;">
          <p style="margin: 0 0 10px 0;">
            <strong style="color: #0A7BBF;">The Link</strong> by Growth Accountants
          </p>
          <p style="margin: 0; font-size: 13px;">
            Your workflow management partner
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Hello ${assigneeName},

You have been assigned a new internal task by ${creatorName}:

TASK DETAILS:
Title: ${taskTitle}
${taskDescription ? `Description: ${taskDescription}` : ''}
${taskTypeName ? `Type: ${taskTypeName}` : ''}
Priority: ${formattedPriority}
Due Date: ${formattedDueDate}
Assigned By: ${creatorName}

Please log into The Link system to view the complete task details and take the necessary action.

View Task: ${baseUrl}/internal-tasks

Best regards,
The Link Team
  `;

  return await sendEmail({
    to: assigneeEmail,
    subject,
    text,
    html,
  });
}


export async function sendSignatureRequestCompletedEmail(
  creatorEmail: string,
  creatorName: string,
  documentName: string,
  clientName: string,
  completedAt: Date,
  recipientNames: string[]
): Promise<boolean> {
  const subject = `✅ Signature Request Completed: ${documentName} - The Link`;
  
  const formattedDate = completedAt.toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
          <img src="${logoUrl}" alt="Growth Accountants" style="max-width: 120px; height: auto; margin-bottom: 10px;" />
          <h1 style="color: #1e293b; margin: 0; font-size: 20px;">The Link</h1>
        </div>
        <div style="padding: 40px 30px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
              <span style="font-size: 40px;">✅</span>
            </div>
            <h2 style="color: #1e293b; margin: 0;">Signature Request Completed!</h2>
          </div>

          <p style="color: #475569; font-size: 16px;">Hello ${creatorName},</p>
          <p style="color: #475569; font-size: 16px;">Great news! Your signature request has been fully signed by all recipients.</p>
          
          <div style="background-color: #f0fdf4; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #bbf7d0;">
            <h3 style="margin-top: 0; color: #059669; font-size: 18px;">📄 Document Details</h3>
            <p style="margin-bottom: 12px; color: #374151;"><strong>Document:</strong> ${documentName}</p>
            <p style="margin-bottom: 12px; color: #374151;"><strong>Client:</strong> ${clientName}</p>
            <p style="margin-bottom: 12px; color: #374151;"><strong>Completed:</strong> ${formattedDate}</p>
            <p style="margin-bottom: 0; color: #374151;"><strong>Signed by:</strong> ${recipientNames.join(', ')}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/signature-requests" 
               style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
              📥 Download Signed Document
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            The signed document and certificate of completion are now available for download in The Link system.
          </p>
        </div>
        <div style="background-color: #f1f5f9; padding: 30px; text-align: center; color: #64748b; font-size: 14px;">
          <p style="margin: 0 0 10px 0;">
            <strong style="color: #0A7BBF;">The Link</strong> by Growth Accountants
          </p>
          <p style="margin: 0; font-size: 13px;">
            Your workflow management partner
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Hello ${creatorName},

Great news! Your signature request has been fully signed by all recipients.

Document: ${documentName}
Client: ${clientName}
Completed: ${formattedDate}
Signed by: ${recipientNames.join(', ')}

The signed document and certificate of completion are now available for download in The Link system.

View your signature requests: ${baseUrl}/signature-requests

---
The Link by Growth Accountants
Your workflow management partner
  `;

  return await sendEmail({
    to: creatorEmail,
    subject,
    text,
    html,
  });
}
