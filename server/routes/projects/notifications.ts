import type { Express } from "express";
import { storage } from "../../storage/index";
import { htmlToPlainText } from "../../utils/text";

export function registerProjectNotificationsRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
): void {
  app.post("/api/projects/:id/send-stage-change-notification", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const projectId = req.params.id;
      
      const { sendStageChangeNotificationSchema } = await import("@shared/schema");
      const notificationData = sendStageChangeNotificationSchema.parse({
        ...req.body,
        projectId,
      });

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (notificationData.suppress) {
        console.log(`[Notification] User suppressed stage change notification for project ${projectId} with dedupe key ${notificationData.dedupeKey}`);
        return res.json({ 
          success: true, 
          message: "Notification suppressed",
          sent: false 
        });
      }

      const preview = await storage.prepareStageChangeNotification(
        projectId,
        project.currentStatus
      );

      if (!preview) {
        return res.status(400).json({ message: "No notification preview available" });
      }

      if (preview.dedupeKey !== notificationData.dedupeKey) {
        return res.status(400).json({ message: "Invalid dedupe key - notification may have already been processed" });
      }

      const stats = {
        email: { successful: 0, failed: 0 },
        push: { successful: 0, failed: 0 },
        sms: { successful: 0, failed: 0 }
      };

      const emailRecipients = notificationData.emailRecipientIds?.length 
        ? preview.recipients.filter(r => notificationData.emailRecipientIds!.includes(r.userId))
        : preview.recipients;
      const pushRecipients = notificationData.pushRecipientIds?.length
        ? preview.recipients.filter(r => notificationData.pushRecipientIds!.includes(r.userId))
        : preview.recipients;
      const smsRecipients = notificationData.smsRecipientIds?.length
        ? preview.recipients.filter(r => notificationData.smsRecipientIds!.includes(r.userId))
        : preview.recipients;

      if (notificationData.sendEmail !== false && emailRecipients.length > 0) {
        const { sendEmail } = await import("../../emailService");
        
        const emailPromises = emailRecipients.map(async (recipient) => {
          try {
            const emailSent = await sendEmail({
              to: recipient.email,
              subject: notificationData.emailSubject,
              html: notificationData.emailBody,
            });

            if (emailSent) {
              console.log(`Stage change notification sent to ${recipient.email} for project ${projectId}`);
              return { success: true, email: recipient.email };
            } else {
              console.warn(`Failed to send stage change notification to ${recipient.email} for project ${projectId}`);
              return { success: false, email: recipient.email, error: 'Email sending failed' };
            }
          } catch (error) {
            console.error(`Error sending stage change notification to ${recipient.email}:`, error);
            return { success: false, email: recipient.email, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        });

        const results = await Promise.allSettled(emailPromises);
        stats.email.successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        stats.email.failed = results.length - stats.email.successful;
      } else {
        console.log(`[Notification] Email channel disabled for project ${projectId}`);
      }

      if (notificationData.sendPush !== false && notificationData.pushTitle && notificationData.pushBody && pushRecipients.length > 0) {
        try {
          const { sendProjectStageChangeNotification } = await import('../../notification-template-service');
          
          for (const recipient of pushRecipients) {
            try {
              await sendProjectStageChangeNotification(
                projectId,
                notificationData.pushTitle,
                notificationData.pushBody,
                preview.oldStageName || 'Unknown',
                preview.newStageName,
                recipient.userId,
                recipient.name,
                preview.metadata.dueDate
              );
              stats.push.successful++;
            } catch (pushError) {
              console.error(`Failed to send push notification to user ${recipient.userId}:`, pushError);
              stats.push.failed++;
            }
          }
        } catch (error) {
          console.error(`Error sending push notifications for project ${projectId}:`, error);
          stats.push.failed = preview.recipients.length;
        }
      } else if (!notificationData.sendPush) {
        console.log(`[Notification] Push channel disabled for project ${projectId}`);
      }

      if (notificationData.sendSms && notificationData.smsBody && smsRecipients.length > 0) {
        console.log(`[Notification] SMS channel enabled but not yet implemented for project ${projectId}`);
        stats.sms.failed = smsRecipients.length;
      }

      const totalSuccessful = stats.email.successful + stats.push.successful + stats.sms.successful;
      const totalFailed = stats.email.failed + stats.push.failed + stats.sms.failed;

      res.json({ 
        success: true, 
        message: `Notifications sent: ${totalSuccessful} successful, ${totalFailed} failed`,
        sent: totalSuccessful > 0,
        stats
      });
    } catch (error) {
      console.error("[POST /api/projects/:id/send-stage-change-notification] Error:", error instanceof Error ? error.message : error);
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else if (error instanceof Error && error.message) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to send stage change notification" });
      }
    }
  });

  app.post("/api/projects/:id/prepare-client-value-notification", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const projectId = req.params.id;
      const { newStageName, oldStageName } = req.body;

      if (!newStageName) {
        return res.status(400).json({ message: "newStageName is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const preview = await storage.prepareClientValueNotification(
        projectId,
        newStageName,
        effectiveUserId,
        oldStageName
      );

      if (!preview) {
        return res.status(200).json({ 
          message: "No client contacts found or notifications disabled for this project type",
          preview: null
        });
      }

      res.json({ preview });
    } catch (error) {
      console.error("[POST /api/projects/:id/prepare-client-value-notification] Error:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to prepare client value notification" });
    }
  });

  app.post("/api/projects/:id/send-client-value-notification", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId;
      const effectiveUser = req.user?.effectiveUser;

      if (!effectiveUserId || !effectiveUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const projectId = req.params.id;
      
      const { sendClientValueNotificationSchema } = await import("@shared/schema");
      const notificationData = sendClientValueNotificationSchema.parse({
        ...req.body,
        projectId,
      });

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (notificationData.suppress) {
        console.log(`[Client Value Notification] User suppressed notification for project ${projectId}`);
        return res.json({ 
          success: true, 
          message: "Notification suppressed",
          sent: false 
        });
      }

      const preview = await storage.prepareClientValueNotification(
        projectId,
        project.currentStatus,
        effectiveUserId
      );

      if (!preview) {
        return res.status(400).json({ message: "No notification preview available" });
      }

      if (preview.dedupeKey !== notificationData.dedupeKey) {
        return res.status(400).json({ message: "Invalid dedupe key - notification may have already been processed" });
      }

      const stats = {
        email: { successful: 0, failed: 0 },
        sms: { successful: 0, failed: 0 }
      };

      const emailRecipients = notificationData.emailRecipientIds?.length 
        ? preview.recipients.filter(r => notificationData.emailRecipientIds!.includes(r.personId) && r.email)
        : preview.recipients.filter(r => r.email);
      const smsRecipients = notificationData.smsRecipientIds?.length
        ? preview.recipients.filter(r => notificationData.smsRecipientIds!.includes(r.personId) && r.mobile)
        : preview.recipients.filter(r => r.mobile);

      const { processNotificationVariables } = await import("../../notification-variables");

      const projectWithDetails = await storage.getProjectById(projectId);
      
      if (!projectWithDetails) {
        console.warn(`[Client Value Notification] Could not load project details for ${projectId}`);
        return res.status(400).json({ message: "Could not load project details for merge field processing" });
      }
      
      const client = projectWithDetails.client;
      const companySettings = await storage.getCompanySettings();

      const buildMergeFieldContext = (recipient: typeof emailRecipients[0]) => {
        const recipientName = recipient.fullName || '';
        const clientName = client?.name || recipientName;
        
        return {
          client: {
            id: client?.id || '',
            name: clientName,
            email: client?.email || recipient.email || null,
            clientType: client?.clientType || null,
            financialYearEnd: (client as any)?.financialYearEnd || null,
          },
          person: {
            id: recipient.personId,
            fullName: recipientName,
            email: recipient.email || null,
          },
          project: {
            id: project.id,
            description: project.description || '',
            projectTypeName: projectWithDetails.projectType?.name || '',
            currentStatus: project.currentStatus || '',
            startDate: (project as any).startDate || null,
            dueDate: project.dueDate || null,
          },
          projectOwner: effectiveUser,
          assignedStaff: effectiveUser,
          firmSettings: companySettings ? {
            firmName: companySettings.firmName || 'The Link',
            firmPhone: companySettings.firmPhone || null,
            firmEmail: companySettings.firmEmail || null,
            portalUrl: companySettings.portalUrl || null,
          } : undefined,
        };
      };

      const sendViaSendGrid = async () => {
        const { sendEmail } = await import("../../emailService");
        
        const emailPromises = emailRecipients.map(async (recipient) => {
          try {
            const context = buildMergeFieldContext(recipient);
            const processedSubject = processNotificationVariables(notificationData.emailSubject, context);
            const processedBody = processNotificationVariables(notificationData.emailBody, context);
            
            const emailSent = await sendEmail({
              to: recipient.email!,
              subject: processedSubject,
              html: processedBody,
            });

            if (emailSent) {
              console.log(`[Client Value Notification] Email sent via SendGrid to ${recipient.email} for project ${projectId}`);
              return { success: true, email: recipient.email };
            } else {
              console.warn(`[Client Value Notification] Failed to send via SendGrid to ${recipient.email}`);
              return { success: false, email: recipient.email, error: 'Email sending failed' };
            }
          } catch (error) {
            console.error(`[Client Value Notification] Error sending via SendGrid to ${recipient.email}:`, error);
            return { success: false, email: recipient.email, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        });

        const results = await Promise.allSettled(emailPromises);
        stats.email.successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        stats.email.failed = results.length - stats.email.successful;
      };

      if (notificationData.sendEmail !== false && emailRecipients.length > 0) {
        if (preview.senderHasOutlook && effectiveUser?.email) {
          try {
            const { sendEmailAsUser: sendEmailTenantWide, isApplicationGraphConfigured } = await import("../../utils/applicationGraphClient");
            
            if (!isApplicationGraphConfigured()) {
              console.log(`[Client Value Notification] Microsoft Graph not configured, using SendGrid for project ${projectId}`);
              await sendViaSendGrid();
            } else {
              const emailPromises = emailRecipients.map(async (recipient) => {
                try {
                  const context = buildMergeFieldContext(recipient);
                  const processedSubject = processNotificationVariables(notificationData.emailSubject, context);
                  const processedBody = processNotificationVariables(notificationData.emailBody, context);
                  
                  await sendEmailTenantWide(
                    effectiveUser.email!,
                    recipient.email!,
                    processedSubject,
                    processedBody,
                    true
                  );
                  console.log(`[Client Value Notification] Email sent via Microsoft Graph to ${recipient.email} for project ${projectId}`);
                  return { success: true, email: recipient.email };
                } catch (error) {
                  console.error(`[Client Value Notification] Failed to send via Microsoft Graph to ${recipient.email}:`, error);
                  return { success: false, email: recipient.email, error: error instanceof Error ? error.message : 'Unknown error' };
                }
              });

              const results = await Promise.allSettled(emailPromises);
              stats.email.successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
              stats.email.failed = results.length - stats.email.successful;
            }
          } catch (outlookError) {
            console.error(`[Client Value Notification] Microsoft Graph send error, falling back to SendGrid:`, outlookError);
            await sendViaSendGrid();
          }
        } else {
          await sendViaSendGrid();
        }
      } else {
        console.log(`[Client Value Notification] Email channel disabled for project ${projectId}`);
      }

      if (notificationData.sendSms && notificationData.smsBody && smsRecipients.length > 0) {
        const apiKey = process.env.VOODOO_SMS_API_KEY;
        
        if (!apiKey) {
          console.warn(`[Client Value Notification] VOODOO_SMS_API_KEY not configured - cannot send SMS for project ${projectId}`);
          stats.sms.failed = smsRecipients.length;
        } else {
          const formatPhoneForVoodooSMS = (phone: string): string => {
            const cleanPhone = phone.replace(/[^\d]/g, '');
            if (cleanPhone.startsWith('07') && cleanPhone.length === 11) {
              return `+447${cleanPhone.slice(2)}`;
            } else if (cleanPhone.startsWith('447') && cleanPhone.length === 12) {
              return `+${cleanPhone}`;
            } else if (phone.startsWith('+447') && cleanPhone.length === 12) {
              return phone;
            } else {
              return phone.startsWith('+') ? phone : `+${cleanPhone}`;
            }
          };

          const smsPromises = smsRecipients.map(async (recipient) => {
            try {
              const context = buildMergeFieldContext(recipient);
              const processedSmsBody = processNotificationVariables(notificationData.smsBody!, context);
              
              const formattedPhone = formatPhoneForVoodooSMS(recipient.mobile!);
              
              const smsData = {
                to: formattedPhone,
                from: "GrowthAcc",
                msg: processedSmsBody,
                external_reference: `project-${projectId}-${recipient.personId}-${Date.now()}`
              };

              console.log(`[Client Value Notification] Sending SMS via VoodooSMS to ${formattedPhone}`);

              const response = await fetch('https://api.voodoosms.com/sendsms', {
                method: 'POST',
                headers: {
                  'Authorization': apiKey,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(smsData)
              });

              if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Client Value Notification] VoodooSMS API error for ${recipient.mobile}:`, response.status, errorText);
                return { success: false, mobile: recipient.mobile, error: `API error: ${response.status}` };
              }

              const smsResponse = await response.json();
              console.log(`[Client Value Notification] SMS sent successfully to ${recipient.mobile}:`, smsResponse);
              
              return { success: true, mobile: recipient.mobile };
            } catch (error) {
              console.error(`[Client Value Notification] Error sending SMS to ${recipient.mobile}:`, error);
              return { success: false, mobile: recipient.mobile, error: error instanceof Error ? error.message : 'Unknown error' };
            }
          });

          const smsResults = await Promise.allSettled(smsPromises);
          stats.sms.successful = smsResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
          stats.sms.failed = smsResults.length - stats.sms.successful;
        }
      }

      const totalSuccessful = stats.email.successful + stats.sms.successful;
      const totalFailed = stats.email.failed + stats.sms.failed;

      res.json({ 
        success: true, 
        message: `Notifications sent: ${totalSuccessful} successful, ${totalFailed} failed`,
        sent: totalSuccessful > 0,
        sentViaOutlook: preview.senderHasOutlook,
        stats
      });
    } catch (error) {
      console.error("[POST /api/projects/:id/send-client-value-notification] Error:", error instanceof Error ? error.message : error);
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ message: "Validation failed", errors: (error as any).issues });
      } else if (error instanceof Error && error.message) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to send client value notification" });
      }
    }
  });
}
