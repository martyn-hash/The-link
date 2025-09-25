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
  const subject = `Your Magic Link Login - The Link (Code: ${fourDigitCode})`;
  
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

export async function sendStageChangeNotificationEmail(
  recipientEmail: string,
  recipientName: string,
  projectDescription: string,
  clientName: string,
  stageName: string,
  fromStage?: string,
  projectId?: string
): Promise<boolean> {
  const formattedStageName = stageName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const subject = `Project moved to ${formattedStageName} - Action required - The Link`;
  
  const stageTransition = fromStage 
    ? `from "${fromStage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}" to "${formattedStageName}"`
    : `to "${formattedStageName}"`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4f46e5;">🔄 Project Stage Changed</h2>
      <p>Hello ${recipientName},</p>
      <p>A project has been moved ${stageTransition} and requires your attention.</p>
      
      <div style="background-color: #f0f9ff; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #e0f2fe;">
        <h3 style="margin-top: 0; color: #0369a1; font-size: 18px;">📋 Project Details</h3>
        <p style="margin-bottom: 12px;"><strong>Client:</strong> ${clientName}</p>
        <p style="margin-bottom: 12px;"><strong>Description:</strong> ${projectDescription}</p>
        <p style="margin-bottom: 0;"><strong>Current Stage:</strong> <span style="background-color: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 6px; font-weight: 600;">${formattedStageName}</span></p>
      </div>
      
      <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #10b981;">
        <h3 style="margin-top: 0; color: #166534; font-size: 16px;">✅ What's Next?</h3>
        <p style="margin-bottom: 0; color: #374151; line-height: 1.6;">
          This project has been assigned to your stage and is ready for your review and action. Please review the project details, complete any required tasks, and update the status as appropriate.
        </p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_BASE_URL || 'http://localhost:5000'}/projects${projectId ? `/${projectId}` : ''}" 
           style="display: inline-block; background-color: #4f46e5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">
          🚀 Review Project in The Link
        </a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        You're receiving this notification because you have notifications enabled for stage changes. You can update your notification preferences in your account settings.
      </p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        The Link Team
      </p>
    </div>
  `;

  const text = `
Hello ${recipientName},

A project has been moved ${stageTransition} and requires your attention.

PROJECT DETAILS:
Client: ${clientName}
Description: ${projectDescription}
Current Stage: ${formattedStageName}

WHAT'S NEXT:
This project has been assigned to your stage and is ready for your review and action. Please review the project details, complete any required tasks, and update the status as appropriate.

Please log into The Link system to review the project and take the necessary action.

You're receiving this notification because you have notifications enabled for stage changes. You can update your notification preferences in your account settings.

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
  const isFailure = summaryData.status === 'failure';
  const hasErrors = summaryData.errorsEncountered > 0;
  
  const subject = `${isFailure ? '❌ ' : hasErrors ? '⚠️ ' : '✅ '}Nightly Project Scheduling Summary - ${new Date().toLocaleDateString()}`;
  
  const statusIcon = isFailure ? '❌' : hasErrors ? '⚠️' : '✅';
  const statusColor = isFailure ? '#dc2626' : hasErrors ? '#f59e0b' : '#10b981';
  const statusBg = isFailure ? '#fef2f2' : hasErrors ? '#fefbf2' : '#f0fdf4';
  const statusText = summaryData.status.replace('_', ' ').toUpperCase();
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${statusColor};">${statusIcon} Nightly Project Scheduling Summary</h2>
      <p>Hello ${recipientName},</p>
      <p>Your automated project scheduling system ran at ${new Date().toLocaleString()} with the following results:</p>
      
      <div style="background-color: ${statusBg}; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid ${statusColor}30;">
        <h3 style="margin-top: 0; color: ${statusColor}; font-size: 18px;">${statusIcon} Overall Status: ${statusText}</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
          <div style="background-color: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
            <div style="font-size: 32px; font-weight: bold; color: #4f46e5;">${summaryData.servicesFoundDue}</div>
            <div style="font-size: 14px; color: #6b7280; font-weight: 600;">SERVICES DUE</div>
          </div>
          <div style="background-color: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
            <div style="font-size: 32px; font-weight: bold; color: #10b981;">${summaryData.projectsCreated}</div>
            <div style="font-size: 14px; color: #6b7280; font-weight: 600;">PROJECTS CREATED</div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
          <div style="background-color: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
            <div style="font-size: 32px; font-weight: bold; color: #0369a1;">${summaryData.servicesRescheduled}</div>
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
        <a href="${process.env.FRONTEND_BASE_URL || 'http://localhost:5000'}/admin" 
           style="display: inline-block; background-color: #4f46e5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">
          🚀 View Admin Dashboard
        </a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        This is an automated summary of your nightly project scheduling run. The next scheduling run will occur at 1:00 AM UTC tomorrow.
      </p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        The Link Automated Scheduling System
      </p>
    </div>
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
    from: process.env.FROM_EMAIL || "link@growth-accountants.com",
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
  const subject = `${projectCount} new projects assigned to you - The Link`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4f46e5;">📋 New Projects Assigned</h2>
      <p>Hello ${recipientName},</p>
      <p>You have <strong>${projectCount}</strong> new projects awaiting your attention.</p>
      
      <div style="background-color: #f0f9ff; padding: 25px; border-radius: 12px; margin: 25px 0; border: 2px solid #e0f2fe; text-align: center;">
        <div style="background-color: #4f46e5; color: white; display: inline-block; padding: 20px 30px; border-radius: 16px; box-shadow: 0 8px 16px rgba(79, 70, 229, 0.3);">
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
        <a href="${process.env.FRONTEND_BASE_URL || 'http://localhost:5000'}/projects" 
           style="display: inline-block; background-color: #4f46e5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">
          🚀 View Your Projects
        </a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        You're receiving this summary notification because multiple projects were assigned to you at once. You can update your notification preferences in your account settings.
      </p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        The Link Team
      </p>
    </div>
  `;

  const text = `
Hello ${recipientName},

You have ${projectCount} new projects awaiting your attention. Please log in to review and begin work.

Visit: ${process.env.FRONTEND_BASE_URL || 'http://localhost:5000'}/projects

You're receiving this summary notification because multiple projects were assigned to you at once. You can update your notification preferences in your account settings.

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
