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
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("Email not sent - SendGrid API key not configured");
    return false;
  }

  try {
    await mailService.send({
      to: params.to,
      from: params.from || process.env.FROM_EMAIL || "noreply@bookflow.com",
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
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
      <p>You have been assigned a new task in the BookFlow system:</p>
      
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #374151;">Project Details</h3>
        <p><strong>Client:</strong> ${clientName}</p>
        <p><strong>Description:</strong> ${projectDescription}</p>
        <p><strong>Status:</strong> ${newStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
      </div>
      
      <p>Please log into the BookFlow system to view the complete project details and take the necessary action.</p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        BookFlow Team
      </p>
    </div>
  `;

  const text = `
Hello ${assigneeName},

You have been assigned a new task in the BookFlow system:

Client: ${clientName}
Description: ${projectDescription}
Status: ${newStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}

Please log into the BookFlow system to view the complete project details and take the necessary action.

Best regards,
BookFlow Team
  `;

  return await sendEmail({
    to: assigneeEmail,
    from: process.env.FROM_EMAIL || "noreply@bookflow.com",
    subject,
    text,
    html,
  });
}
