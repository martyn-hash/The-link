import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY environment variable not set. Email notifications will be disabled.");
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

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

  const fromEmail = params.from || process.env.FROM_EMAIL || "link@growth-accountants.com";
  
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
  const magicLinkUrl = `${baseUrl}/magic-link-verify?token=${magicLinkToken}`;
  const subject = "Your Magic Link Login - The Link";
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4f46e5;">Magic Link Login</h2>
      <p>Hello ${recipientName},</p>
      <p>You requested a magic link to sign in to your The Link account. You can use either of the following methods to log in:</p>
      
      <div style="background-color: #f0f9ff; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #e0f2fe;">
        <h3 style="margin-top: 0; color: #0369a1; font-size: 18px;">🔗 Option 1: Click the Magic Link</h3>
        <p style="margin-bottom: 20px; font-size: 16px; color: #374151;">Click the button below to log in automatically:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${magicLinkUrl}" 
             style="display: inline-block; background-color: #0369a1; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(3, 105, 161, 0.2);">
            🚀 Sign In to The Link
          </a>
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #6b7280; line-height: 1.5;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <span style="word-break: break-all; font-family: monospace; background-color: #f8fafc; padding: 4px 8px; border-radius: 4px; margin-top: 8px; display: inline-block;">${magicLinkUrl}</span>
        </p>
      </div>
      
      <div style="background-color: #f0fdf4; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #dcfce7;">
        <h3 style="margin-top: 0; color: #166534; font-size: 18px;">🔢 Option 2: Use Verification Code</h3>
        <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">Alternatively, enter this 4-digit code on the login page:</p>
        <div style="text-align: center; margin: 25px 0;">
          <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px 30px; border-radius: 16px; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3); border: 3px solid #34d399;">
            <div style="font-size: 48px; font-weight: 900; letter-spacing: 12px; line-height: 1; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">
              ${fourDigitCode}
            </div>
            <div style="font-size: 12px; margin-top: 8px; opacity: 0.9; font-weight: 600; letter-spacing: 1px;">
              VERIFICATION CODE
            </div>
          </div>
        </div>
      </div>
      
      <div style="background-color: #fef3cd; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; color: #92400e; font-size: 15px; font-weight: 600; line-height: 1.4;">
          <strong style="font-size: 16px;">⏰ Important:</strong> This magic link and code will expire in <strong style="color: #dc2626;">10 minutes</strong> for your security.
        </p>
      </div>
      
      <p style="color: #6b7280; font-size: 14px;">
        If you didn't request this login link, please ignore this email. Your account remains secure.
      </p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        The Link Team
      </p>
    </div>
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
    from: process.env.FROM_EMAIL || "link@growth-accountants.com",
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
  const subject = `New Task Assignment - ${clientName}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4f46e5;">New Task Assignment</h2>
      <p>Hello ${assigneeName},</p>
      <p>You have been assigned a new task in The Link system:</p>
      
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #374151;">Project Details</h3>
        <p><strong>Client:</strong> ${clientName}</p>
        <p><strong>Description:</strong> ${projectDescription}</p>
        <p><strong>Status:</strong> ${newStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
      </div>
      
      <p>Please log into The Link system to view the complete project details and take the necessary action.</p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        The Link Team
      </p>
    </div>
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
    from: process.env.FROM_EMAIL || "link@growth-accountants.com",
    subject,
    text,
    html,
  });
}
