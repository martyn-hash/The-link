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

/**
 * Send signature request email to a recipient
 */
export async function sendSignatureRequestEmail(
  recipientEmail: string,
  recipientName: string,
  firmName: string,
  documentName: string,
  customMessage: string,
  signLink: string
) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();

    const subject = `Please sign: ${documentName}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #0A7BBF; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
          .button { 
            display: inline-block; 
            padding: 15px 30px; 
            background-color: #76CA23; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
          }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .message-box { background-color: white; padding: 15px; border-left: 4px solid #0A7BBF; margin: 20px 0; }
          .document-title { font-size: 18px; font-weight: bold; color: #0A7BBF; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Document Signature Request</h1>
          </div>
          <div class="content">
            <p>Dear ${recipientName},</p>
            
            <p>Please sign <strong class="document-title">${documentName}</strong></p>
            
            <p><strong>${firmName}</strong> has requested your electronic signature on this document.</p>
            
            ${customMessage ? `
              <div class="message-box">
                <p><strong>Message from ${firmName}:</strong></p>
                <p>${customMessage.replace(/\n/g, '<br>')}</p>
              </div>
            ` : ''}
            
            <p>To review and sign this document, please click the button below:</p>
            
            <div style="text-align: center;">
              <a href="${signLink}" class="button">Review & Sign Document</a>
            </div>
            
            <p style="font-size: 12px; color: #666;">
              Or copy and paste this link into your browser:<br>
              <a href="${signLink}">${signLink}</a>
            </p>
            
            <p><strong>Important Information:</strong></p>
            <ul>
              <li>This document requires an electronic signature</li>
              <li>Your signature will be legally binding under UK eIDAS regulations</li>
              <li>You will need to review and accept the electronic signature disclosure</li>
              <li>This link is unique to you and should not be shared</li>
            </ul>
            
            <p>If you have any questions about this document, please contact ${firmName} directly.</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} ${firmName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const msg = {
      to: recipientEmail,
      from: fromEmail,
      subject,
      html,
    };

    await client.send(msg);
    console.log(`[Email] Signature request sent to ${recipientEmail}`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Error sending signature request:', error);
    throw error;
  }
}

/**
 * Send reminder email for pending signature
 */
export async function sendReminderEmail(
  recipientEmail: string,
  recipientName: string,
  firmName: string,
  documentName: string,
  daysSinceSent: number,
  reminderNumber: number,
  signLink: string
) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();

    const subject = `Reminder: Please sign ${documentName}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
          .button { 
            display: inline-block; 
            padding: 15px 30px; 
            background-color: #76CA23; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
          }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .reminder-badge { 
            background-color: #FF9800; 
            color: white; 
            padding: 5px 15px; 
            border-radius: 20px; 
            display: inline-block;
            font-weight: bold;
            margin: 10px 0;
          }
          .document-title { font-size: 18px; font-weight: bold; color: #0A7BBF; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Signature Reminder</h1>
          </div>
          <div class="content">
            <div class="reminder-badge">Reminder ${reminderNumber} • ${daysSinceSent} day${daysSinceSent !== 1 ? 's' : ''} ago</div>
            
            <p>Dear ${recipientName},</p>
            
            <p>This is a friendly reminder that <strong>${firmName}</strong> is waiting for your signature on the following document:</p>
            
            <p class="document-title">${documentName}</p>
            
            <p>This document was sent to you ${daysSinceSent} day${daysSinceSent !== 1 ? 's' : ''} ago and still requires your electronic signature to proceed.</p>
            
            <p><strong>Why this matters:</strong></p>
            <ul>
              <li>Your signature is needed to complete this important document</li>
              <li>The signing process takes just a few minutes</li>
              <li>This helps us keep your matters moving forward</li>
            </ul>
            
            <p>To review and sign the document, please click the button below:</p>
            
            <div style="text-align: center;">
              <a href="${signLink}" class="button">Review & Sign Document</a>
            </div>
            
            <p style="font-size: 12px; color: #666;">
              Or copy and paste this link into your browser:<br>
              <a href="${signLink}">${signLink}</a>
            </p>
            
            <p>If you have any questions or concerns about this document, please don't hesitate to contact ${firmName} directly.</p>
            
            <p style="font-style: italic; color: #666; font-size: 14px; margin-top: 30px;">
              This is an automated reminder. You're receiving this because you have a pending signature request.
            </p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} ${firmName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const msg = {
      to: recipientEmail,
      from: fromEmail,
      subject,
      html,
    };

    await client.send(msg);
    console.log(`[Email] Reminder email sent to ${recipientEmail} (reminder #${reminderNumber})`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Error sending reminder email:', error);
    throw error;
  }
}

/**
 * Send completed document email with signed PDF and certificate as attachments
 */
export async function sendCompletedDocumentEmail(
  recipientEmail: string,
  recipientName: string,
  firmName: string,
  clientName: string,
  documentName: string,
  signedPdfUrl: string,
  certificateUrl?: string,
  signedPdfBuffer?: Buffer,
  certificateBuffer?: Buffer
) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();

    const subject = `Signed Document: ${documentName}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #76CA23; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
          .button { 
            display: inline-block; 
            padding: 15px 30px; 
            background-color: #0A7BBF; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
          }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Document Signed Successfully</h1>
          </div>
          <div class="content">
            <div class="success-icon">✅</div>
            
            <p>Dear ${recipientName},</p>
            
            <p>Thank you for signing the document. All required signatures have been collected, and the document is now complete.</p>
            
            <p><strong>Document:</strong> ${documentName}</p>
            <p><strong>Client:</strong> ${clientName}</p>
            <p><strong>Completed:</strong> ${new Date().toLocaleString('en-GB', { 
              dateStyle: 'full', 
              timeStyle: 'short',
              timeZone: 'Europe/London'
            })}</p>
            
            <p>You can download your signed copy of the document and certificate of completion using the buttons below:</p>
            
            <div style="text-align: center;">
              <a href="${signedPdfUrl}" class="button">Download Signed Document</a>
              ${certificateUrl ? `
                <br/><br/>
                <a href="${certificateUrl}" class="button" style="background-color: #76CA23;">Download Certificate of Completion</a>
              ` : ''}
            </div>
            
            <p><strong>What You're Receiving:</strong></p>
            <ul>
              <li><strong>Signed Document:</strong> The original document with all signatures applied</li>
              ${certificateUrl ? '<li><strong>Certificate of Completion:</strong> A detailed audit trail showing who signed, when, and from where</li>' : ''}
              <li>Both documents are legally binding and verifiable</li>
              <li>The certificate provides cryptographic proof of document integrity</li>
              <li>Please save both documents for your records</li>
            </ul>
            
            <p>If you have any questions, please contact ${firmName}.</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} ${firmName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Build attachments array if buffers provided
    const attachments: any[] = [];
    const MAX_ATTACHMENT_SIZE = 30 * 1024 * 1024; // 30MB SendGrid limit
    let totalAttachmentSize = 0;

    // Add signed PDF attachment if buffer provided
    if (signedPdfBuffer) {
      const pdfSize = signedPdfBuffer.length;
      if (totalAttachmentSize + pdfSize <= MAX_ATTACHMENT_SIZE) {
        attachments.push({
          content: signedPdfBuffer.toString('base64'),
          filename: documentName.endsWith('.pdf') ? documentName : `${documentName}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        });
        totalAttachmentSize += pdfSize;
        console.log(`[Email] Added signed PDF attachment (${(pdfSize / 1024).toFixed(1)} KB)`);
      } else {
        console.warn(`[Email] Skipping signed PDF attachment - would exceed 30MB limit`);
      }
    }

    // Add certificate attachment if buffer provided
    if (certificateBuffer) {
      const certSize = certificateBuffer.length;
      if (totalAttachmentSize + certSize <= MAX_ATTACHMENT_SIZE) {
        const certificateFilename = documentName.replace('.pdf', '_Certificate.pdf');
        attachments.push({
          content: certificateBuffer.toString('base64'),
          filename: certificateFilename,
          type: 'application/pdf',
          disposition: 'attachment'
        });
        totalAttachmentSize += certSize;
        console.log(`[Email] Added certificate attachment (${(certSize / 1024).toFixed(1)} KB)`);
      } else {
        console.warn(`[Email] Skipping certificate attachment - would exceed 30MB limit`);
      }
    }

    const msg: any = {
      to: recipientEmail,
      from: fromEmail,
      subject,
      html,
    };

    // Only add attachments array if we have attachments
    if (attachments.length > 0) {
      msg.attachments = attachments;
      console.log(`[Email] Sending ${attachments.length} attachment(s), total ${(totalAttachmentSize / 1024).toFixed(1)} KB`);
    }

    await client.send(msg);
    console.log(`[Email] Completed document sent to ${recipientEmail}`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Error sending completed document:', error);
    throw error;
  }
}
