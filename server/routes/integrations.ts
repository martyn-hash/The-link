import type { Express } from "express";
import { storage } from "../storage/index";
import fetch from 'node-fetch';
import multer from 'multer';
import sharp from 'sharp';
import {
  validateParams,
  sendEmailSchema,
  sendSmsSchema,
  pushSubscribeSchema,
  pushUnsubscribeSchema,
  pushSendSchema,
  createNotificationTemplateSchema,
  updateNotificationTemplateSchema,
  testNotificationTemplateSchema,
  ringCentralAuthenticateSchema,
  ringCentralLogCallSchema,
  ringCentralRequestTranscriptSchema,
  paramUserIntegrationIdSchema,
  resolveEffectiveUser,
  requireAdmin,
  userHasClientAccess,
} from "./routeHelpers";
import { insertUserIntegrationSchema, insertSmsTemplateSchema, updateSmsTemplateSchema } from "@shared/schema";
import { sendTaskAssignmentEmail } from "../emailService";
import {
  isApplicationGraphConfigured,
  sendEmailAsUser as sendEmailAsUserTenantWide,
} from "../utils/applicationGraphClient";
import { getUncachableSendGridClient } from "../sendgridService";
import {
  generateUserRingCentralAuthUrl,
  exchangeCodeForRingCentralTokens,
  disconnectRingCentral,
  storeRingCentralTokens,
  getSIPProvisionCredentials,
  getCallRecordingUrl,
  requestCallTranscription,
  getTranscriptionResult,
  findCallRecording
} from "../utils/userRingCentralClient";
import { scheduleTranscription } from "../transcription-service";
import { sendPushNotificationToMultiple, getVapidPublicKey, type PushNotificationPayload } from "../push-service";
import { objectStorageClient } from "../objectStorage";

export function registerIntegrationRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any
) {
  // ==================================================
  // MICROSOFT 365 EMAIL ROUTES (Tenant-Wide Access)
  // ==================================================
  // Uses application-level permissions - no individual OAuth required
  // Access controlled via accessEmail flag in user settings

  // Check Outlook status - checks tenant-wide configuration and user's accessEmail flag
  app.get('/api/oauth/outlook/status', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user!.effectiveUserId;
      
      // Check if tenant-wide Graph is configured
      if (!isApplicationGraphConfigured()) {
        return res.json({ connected: false, reason: 'not_configured' });
      }
      
      // Get the user to check their accessEmail flag
      const user = await storage.getUser(userId);
      if (!user) {
        return res.json({ connected: false, reason: 'user_not_found' });
      }
      
      // Check if user has email access enabled by admin
      if (!user.accessEmail) {
        return res.json({ 
          connected: false, 
          reason: 'access_not_enabled',
          message: 'Email access is managed by your administrator'
        });
      }
      
      // User has access - return connected status with their email
      res.json({
        connected: true,
        email: user.email || 'Connected',
        tenantWide: true // Indicate this is tenant-wide access, not individual OAuth
      });
    } catch (error) {
      console.error("Error checking Outlook status:", error instanceof Error ? error.message : error);
      res.json({ connected: false });
    }
  });

  // Send email using tenant-wide application permissions
  app.post('/api/oauth/outlook/send-email', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user!.effectiveUserId;

      // Validate request body
      const validationResult = sendEmailSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid email data",
          errors: validationResult.error.issues
        });
      }

      const { to, subject, content, clientId, personId } = validationResult.data;

      // Check if tenant-wide Graph is configured
      if (!isApplicationGraphConfigured()) {
        return res.status(400).json({
          message: "Microsoft 365 email integration is not configured on this server."
        });
      }
      
      // Get the user to check their accessEmail flag and get their email
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(400).json({
          message: "User not found."
        });
      }
      
      // Check if user has email access enabled by admin
      if (!user.accessEmail) {
        return res.status(403).json({
          message: "Email access is not enabled for your account. Please contact your administrator."
        });
      }
      
      // User must have an email address to send from
      if (!user.email) {
        return res.status(400).json({
          message: "No email address configured for your account."
        });
      }

      // Process inline images - convert /objects/ URLs to CID-based inline attachments
      let processedContent = content;
      let inlineAttachments: Array<{
        name: string;
        contentType: string;
        contentBytes: string;
        contentId: string;
        isInline: boolean;
      }> = [];

      if (content.includes('/objects/')) {
        try {
          const { processInlineImages } = await import('../utils/inlineImageProcessor');
          const processed = await processInlineImages(content);
          processedContent = processed.html;
          inlineAttachments = processed.inlineAttachments;
          console.log(`[Outlook Email] Processed ${inlineAttachments.length} inline image(s)`);
        } catch (imgError) {
          console.error('[Outlook Email] Error processing inline images:', imgError);
          // Continue with original content if processing fails
        }
      }

      // Send email using tenant-wide application permissions
      await sendEmailAsUserTenantWide(
        user.email,
        to,
        subject,
        processedContent,
        true, // isHtml
        { inlineAttachments }
      );

      // Log the communication with original content (not CID-processed) for readability
      if (clientId) {
        // Build subject with recipient for clearer chronology display
        const displaySubject = `${subject} - sent to ${to}`;
        
        await storage.createCommunication({
          clientId,
          personId: personId || null,
          type: 'email_sent',
          subject: displaySubject,
          content: content,
          actualContactTime: new Date(),
          userId,
          metadata: { originalSubject: subject }
        });
      }

      // Track outbound email in inbox_emails table
      try {
        // Get or create inbox for the sender
        const inbox = await storage.upsertInboxForUser(
          userId,
          user.email.toLowerCase(),
          `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
        );

        // Generate a unique ID for this outbound email (not from Microsoft since we sent it)
        const outboundMicrosoftId = `outbound-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

        // Parse recipients into the expected format
        const toRecipients = [{
          address: to,
          name: to
        }];

        await storage.createInboxEmail({
          inboxId: inbox.id,
          microsoftId: outboundMicrosoftId,
          fromAddress: user.email.toLowerCase(),
          fromName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
          toRecipients: toRecipients,
          subject: subject,
          bodyPreview: content.substring(0, 200).replace(/<[^>]*>/g, ''),
          bodyHtml: content,
          receivedAt: new Date(),
          hasAttachments: inlineAttachments.length > 0,
          matchedClientId: clientId || null,
          matchedPersonId: personId || null,
          direction: 'outbound',
          staffUserId: userId,
          status: 'no_action_needed',
          isRead: true,
        });

        console.log('[Outlook Email] Outbound email tracked in inbox_emails');
      } catch (trackingError) {
        // Don't fail the request if tracking fails - email was already sent
        console.error('[Outlook Email] Error tracking outbound email:', trackingError);
      }

      res.json({
        message: "Email sent successfully",
        sentTo: to,
        subject
      });
    } catch (error) {
      console.error("Error sending email via Microsoft Graph:", error instanceof Error ? error.message : error);

      // Handle specific Graph API errors
      if (error instanceof Error) {
        if (error.message.includes('InvalidAuthenticationToken') || error.message.includes('Unauthorized')) {
          return res.status(401).json({
            message: "Microsoft 365 authentication error. Please contact your administrator."
          });
        }
        if (error.message.includes('Forbidden') || error.message.includes('Access is denied')) {
          return res.status(403).json({
            message: "Permission denied. Your administrator may need to grant Mail.Send permissions."
          });
        }
        if (error.message.includes('MailboxNotFound') || error.message.includes('ResourceNotFound')) {
          return res.status(400).json({
            message: "Mailbox not found. Please verify your email address is correctly configured."
          });
        }
      }

      res.status(500).json({
        message: "Failed to send email. Please try again or contact your administrator."
      });
    }
  });

  // ==================================================
  // RINGCENTRAL OAUTH ROUTES
  // ==================================================

  // GET /api/oauth/ringcentral/auth-url - Generate OAuth authorization URL
  app.get('/api/oauth/ringcentral/auth-url', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user!.effectiveUserId;
      const authUrl = await generateUserRingCentralAuthUrl(userId);
      res.json({ authUrl });
    } catch (error) {
      console.error("Error generating RingCentral auth URL:", error instanceof Error ? error.message : error);

      if (error instanceof Error && error.message.includes('RingCentral OAuth not configured')) {
        return res.status(400).json({
          message: "RingCentral integration is not configured on this server",
          configured: false
        });
      }

      res.status(500).json({ message: "Failed to generate auth URL" });
    }
  });

  // GET /api/oauth/ringcentral/callback - Handle OAuth callback
  app.get('/api/oauth/ringcentral/callback', async (req: any, res: any) => {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        return res.status(400).send(`
          <html>
            <body>
              <h1>Error</h1>
              <p>Missing authorization code or state</p>
              <script>window.close();</script>
            </body>
          </html>
        `);
      }

      const result = await exchangeCodeForRingCentralTokens(code as string, state as string);

      // Store tokens
      await storeRingCentralTokens(
        result.userId,
        result.tokens.access_token,
        result.tokens.refresh_token,
        result.tokens.expires_in
      );

      // Return success page
      res.send(`
        <html>
          <head>
            <title>RingCentral Connected</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background-color: #f0f2f5;
              }
              .container {
                text-align: center;
                background: white;
                padding: 2rem;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              }
              .success-icon {
                font-size: 64px;
                color: #22c55e;
                margin-bottom: 1rem;
              }
              h1 {
                color: #1a1a1a;
                margin-bottom: 0.5rem;
              }
              p {
                color: #666;
                margin-bottom: 1.5rem;
              }
              .close-info {
                color: #999;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✓</div>
              <h1>RingCentral Connected Successfully</h1>
              <p>You can now make calls using RingCentral from the CRM.</p>
              <p class="close-info">This window will close automatically...</p>
            </div>
            <script>
              setTimeout(() => {
                window.close();
                if (!window.closed) {
                  window.location.href = '/profile?tab=integrations';
                }
              }, 2000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error in RingCentral OAuth callback:", error);
      res.status(500).send(`
        <html>
          <body>
            <h1>Error</h1>
            <p>${error instanceof Error ? error.message : 'Failed to connect RingCentral account'}</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
        </html>
      `);
    }
  });

  // DELETE /api/oauth/ringcentral/disconnect - Disconnect RingCentral
  app.delete('/api/oauth/ringcentral/disconnect', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user!.effectiveUserId;
      await disconnectRingCentral(userId);
      res.json({ message: "RingCentral account disconnected successfully" });
    } catch (error) {
      console.error("Error disconnecting RingCentral:", error);
      res.status(500).json({ message: "Failed to disconnect RingCentral account" });
    }
  });

  // ==================================================
  // RINGCENTRAL API ROUTES
  // ==================================================

  // POST /api/ringcentral/authenticate - Store RingCentral tokens
  app.post("/api/ringcentral/authenticate", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      const validation = ringCentralAuthenticateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid authentication data",
          errors: validation.error.issues
        });
      }

      const { accessToken, refreshToken, expiresIn } = validation.data;
      await storeRingCentralTokens(effectiveUserId, accessToken, refreshToken, expiresIn);

      res.json({ message: "RingCentral authenticated successfully" });
    } catch (error) {
      console.error("Error authenticating RingCentral:", error);
      res.status(500).json({ message: "Failed to authenticate RingCentral" });
    }
  });

  // GET /api/ringcentral/status - Check if user has RingCentral connected
  app.get("/api/ringcentral/status", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const integration = await storage.getUserIntegrationByType(effectiveUserId, 'ringcentral');

      res.json({
        connected: !!integration && integration.isActive,
        hasTokens: !!(integration?.accessToken)
      });
    } catch (error) {
      console.error("Error checking RingCentral status:", error);
      res.status(500).json({ message: "Failed to check RingCentral status" });
    }
  });

  // POST /api/ringcentral/sip-provision - Get SIP provisioning credentials for WebRTC
  app.post("/api/ringcentral/sip-provision", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      console.log('\n========== [SERVER] SIP PROVISION REQUEST ==========');
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      console.log('[SERVER] Effective User ID:', effectiveUserId);
      console.log('[SERVER] Requesting SIP provision from RingCentral API...');

      const sipProvision = await getSIPProvisionCredentials(effectiveUserId);

      console.log('[SERVER] ✓ SIP provision SUCCESS');
      // Device and extension info may not be present in the type
      console.log('[SERVER] SIP Username:', (sipProvision as any)?.username);
      console.log('[SERVER] SIP Domain:', (sipProvision as any)?.domain);
      console.log('[SERVER] Transport:', (sipProvision as any)?.transport);
      console.log('[SERVER] Full response available - ready for WebPhone initialization');
      console.log('====================================================\n');

      res.json(sipProvision);
    } catch (error) {
      console.error('\n========== [SERVER] SIP PROVISION ERROR ==========');
      console.error('[SERVER] ✗ Error getting SIP provision:', error);
      console.error('==================================================\n');
      if (error instanceof Error && error.message.includes('not connected')) {
        return res.status(401).json({ message: "RingCentral account not connected. Please authenticate first." });
      }
      res.status(500).json({ message: "Failed to get SIP provision credentials" });
    }
  });

  // POST /api/ringcentral/log-call - Log a call to communications
  app.post("/api/ringcentral/log-call", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      const validation = ringCentralLogCallSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid call log data",
          errors: validation.error.issues
        });
      }

      const { clientId, projectId, personId, phoneNumber, direction, duration, sessionId, recordingId, callDescription } = validation.data;

      const callTime = new Date();
      
      // Determine if we should schedule transcription (only for calls > 5 seconds)
      const shouldTranscribe = duration && duration > 5;
      
      // Build subject line - include description if provided (for non-person calls like HMRC)
      const subjectLine = callDescription 
        ? `Phone Call - ${callDescription} (${phoneNumber})`
        : `Phone Call - ${phoneNumber}`;
      
      // Build content with description if provided
      const contentLine = callDescription
        ? `${direction === 'outbound' ? 'Outbound' : 'Inbound'} call to ${callDescription} (${phoneNumber}). Duration: ${duration || 0}s`
        : `${direction === 'outbound' ? 'Outbound' : 'Inbound'} call to ${phoneNumber}. Duration: ${duration || 0}s`;
      
      // Create communication entry
      const communication = await storage.createCommunication({
        clientId,
        projectId: projectId || null,
        personId: personId || null,
        userId: effectiveUserId,
        type: 'phone_call',
        content: contentLine,
        subject: subjectLine,
        actualContactTime: callTime,
        metadata: {
          integration: 'ringcentral',
          sessionId,
          recordingId,
          direction,
          duration,
          phoneNumber,
          callDescription: callDescription || undefined,
          transcriptionStatus: shouldTranscribe ? 'pending' : 'not_available'
        }
      });

      // Schedule automatic transcription retrieval
      // This runs in the background after the call ends
      if (communication.id && shouldTranscribe) {
        console.log('[RingCentral] Scheduling transcription for communication:', communication.id);
        scheduleTranscription(communication.id, effectiveUserId, phoneNumber, callTime);
      }

      res.json(communication);
    } catch (error) {
      console.error("Error logging call:", error);
      res.status(500).json({ message: "Failed to log call" });
    }
  });

  // POST /api/ringcentral/request-transcript - Request transcription for a call
  app.post("/api/ringcentral/request-transcript", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      const validation = ringCentralRequestTranscriptSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid transcription request data",
          errors: validation.error.issues
        });
      }

      const { communicationId, recordingId } = validation.data;

      // Get recording URL
      const recordingUrl = await getCallRecordingUrl(effectiveUserId, recordingId);

      // Request transcription
      const transcriptionResult = await requestCallTranscription(effectiveUserId, recordingUrl);

      // Update communication with transcription job ID
      await storage.updateCommunication(communicationId, {
        metadata: {
          transcriptionJobId: transcriptionResult.jobId,
          transcriptionStatus: 'processing',
          recordingUrl
        }
      });

      res.json({
        message: "Transcription requested",
        jobId: transcriptionResult.jobId
      });
    } catch (error) {
      console.error("Error requesting transcription:", error);
      if (error instanceof Error && error.message.includes('not connected')) {
        return res.status(401).json({ message: "RingCentral account not connected. Please authenticate first." });
      }
      res.status(500).json({ message: "Failed to request transcription" });
    }
  });

  // GET /api/ringcentral/transcript/:jobId - Get transcription result
  app.get("/api/ringcentral/transcript/:jobId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const { jobId } = req.params;

      if (!jobId) {
        return res.status(400).json({ message: "Job ID is required" });
      }

      const transcriptionResult = await getTranscriptionResult(effectiveUserId, jobId);
      res.json(transcriptionResult);
    } catch (error) {
      console.error("Error getting transcription:", error);
      res.status(500).json({ message: "Failed to get transcription" });
    }
  });

  // ==================================================
  // PUSH NOTIFICATION API ROUTES
  // ==================================================

  // GET /api/push/vapid-public-key - Get VAPID public key for push subscriptions
  app.get("/api/push/vapid-public-key", (req: any, res: any) => {
    const publicKey = getVapidPublicKey();
    if (!publicKey) {
      return res.status(500).json({ message: "Push notifications not configured" });
    }
    res.json({ publicKey });
  });

  // POST /api/push/subscribe - Subscribe to push notifications
  app.post("/api/push/subscribe", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      const validationResult = pushSubscribeSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid subscription data",
          errors: validationResult.error.issues
        });
      }

      const { endpoint, keys, userAgent } = validationResult.data;

      const subscription = await storage.createPushSubscription({
        userId: effectiveUserId,
        endpoint,
        keys,
        userAgent: userAgent || req.headers['user-agent'] || null
      });

      res.status(201).json(subscription);
    } catch (error) {
      console.error("Error subscribing to push notifications:", error);
      res.status(500).json({ message: "Failed to subscribe to push notifications" });
    }
  });

  // DELETE /api/push/unsubscribe - Unsubscribe from push notifications
  app.delete("/api/push/unsubscribe", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const validationResult = pushUnsubscribeSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid unsubscribe data",
          errors: validationResult.error.issues
        });
      }

      const { endpoint } = validationResult.data;
      await storage.deletePushSubscription(endpoint);
      res.json({ message: "Unsubscribed successfully" });
    } catch (error) {
      console.error("Error unsubscribing from push notifications:", error);
      res.status(500).json({ message: "Failed to unsubscribe" });
    }
  });

  // GET /api/push/subscriptions - Get user's push subscriptions
  app.get("/api/push/subscriptions", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const subscriptions = await storage.getPushSubscriptionsByUserId(effectiveUserId);
      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching push subscriptions:", error);
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  // POST /api/push/send - Send push notifications (admin only)
  app.post("/api/push/send", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const validationResult = pushSendSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid push notification data",
          errors: validationResult.error.issues
        });
      }

      const { userIds, title, body, url, icon, tag, requireInteraction } = validationResult.data;

      const payload: PushNotificationPayload = {
        title,
        body,
        url,
        icon,
        tag,
        requireInteraction
      };

      let allSubscriptions: any[] = [];
      for (const userId of userIds) {
        const subs = await storage.getPushSubscriptionsByUserId(userId);
        allSubscriptions = allSubscriptions.concat(subs);
      }

      if (allSubscriptions.length === 0) {
        return res.status(404).json({ message: "No subscriptions found for specified users" });
      }

      const result = await sendPushNotificationToMultiple(
        allSubscriptions.map(sub => ({
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string }
        })),
        payload
      );

      if (result.expiredSubscriptions.length > 0) {
        for (const endpoint of result.expiredSubscriptions) {
          await storage.deletePushSubscription(endpoint);
        }
      }

      res.json({
        message: "Notifications sent",
        successful: result.successful,
        failed: result.failed,
        expiredRemoved: result.expiredSubscriptions.length
      });
    } catch (error) {
      console.error("Error sending push notifications:", error);
      res.status(500).json({ message: "Failed to send push notifications" });
    }
  });

  // POST /api/push/test - Test push notification to self (authenticated user)
  app.post("/api/push/test", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const subscriptions = await storage.getPushSubscriptionsByUserId(effectiveUserId);

      if (subscriptions.length === 0) {
        return res.status(404).json({
          message: "No push subscriptions found for your account",
          hint: "Please enable push notifications from your settings first"
        });
      }

      console.log(`[Push Test] Sending test notification to user ${effectiveUserId}, ${subscriptions.length} subscription(s)`);

      const payload: PushNotificationPayload = {
        title: "Test Notification",
        body: "This is a test notification from The Link. If you see this, push notifications are working!",
        icon: "/pwa-icon-192.png",
        tag: "test-notification",
        url: "/push-diagnostics"
      };

      const result = await sendPushNotificationToMultiple(
        subscriptions.map(sub => ({
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string }
        })),
        payload
      );

      if (result.expiredSubscriptions.length > 0) {
        for (const endpoint of result.expiredSubscriptions) {
          await storage.deletePushSubscription(endpoint);
        }
      }

      console.log(`[Push Test] Test complete - ${result.successful} successful, ${result.failed} failed`);

      res.json({
        message: result.successful > 0
          ? "Test notification sent successfully! Check your device."
          : "Failed to send test notification",
        successful: result.successful,
        failed: result.failed,
        expiredRemoved: result.expiredSubscriptions.length,
        subscriptionsFound: subscriptions.length
      });
    } catch (error) {
      console.error("[Push Test] Error sending test notification:", error);
      res.status(500).json({ message: "Failed to send test notification" });
    }
  });

  // ==================================================
  // PUSH NOTIFICATION TEMPLATE API ROUTES (ADMIN)
  // ==================================================

  // GET /api/push/templates - Get all notification templates
  app.get("/api/push/templates", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const templates = await storage.getAllPushNotificationTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching notification templates:", error);
      res.status(500).json({ message: "Failed to fetch notification templates" });
    }
  });

  // GET /api/push/templates/:type - Get template by type
  app.get("/api/push/templates/:type", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { type } = req.params;
      const template = await storage.getPushNotificationTemplateByType(type);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error fetching notification template:", error);
      res.status(500).json({ message: "Failed to fetch notification template" });
    }
  });

  // POST /api/push/templates - Create notification template
  app.post("/api/push/templates", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      // Validate request body
      const validation = createNotificationTemplateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid template data",
          errors: validation.error.errors 
        });
      }

      const created = await storage.createPushNotificationTemplate(validation.data);
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating notification template:", error);
      res.status(500).json({ message: "Failed to create notification template" });
    }
  });

  // PATCH /api/push/templates/:id - Update notification template
  app.patch("/api/push/templates/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      // Validate request body
      const validation = updateNotificationTemplateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid template data",
          errors: validation.error.errors 
        });
      }

      const updated = await storage.updatePushNotificationTemplate(id, validation.data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating notification template:", error);
      res.status(500).json({ message: "Failed to update notification template" });
    }
  });

  // POST /api/push/templates/test - Test a notification template with sample data
  app.post("/api/push/templates/test", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      
      // Validate request body
      const validation = testNotificationTemplateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid test data",
          errors: validation.error.errors 
        });
      }
      
      const { templateId, sampleData } = req.body;

      if (!templateId) {
        return res.status(400).json({ message: "Template ID is required" });
      }

      const subscriptions = await storage.getPushSubscriptionsByUserId(effectiveUserId);

      if (subscriptions.length === 0) {
        return res.status(404).json({
          message: "No push subscriptions found for your account",
          hint: "Please enable push notifications from your settings first"
        });
      }

      // Get all templates to find the one being tested
      const templates = await storage.getAllPushNotificationTemplates();
      const template = templates.find(t => t.id === templateId);

      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Render the template with sample data
      let title = template.titleTemplate;
      let body = template.bodyTemplate;

      // Replace placeholders with sample data
      if (sampleData) {
        Object.entries(sampleData).forEach(([key, value]) => {
          const placeholder = new RegExp(`\\{${key}\\}`, 'g');
          title = title.replace(placeholder, String(value));
          body = body.replace(placeholder, String(value));
        });
      }

      const payload: PushNotificationPayload = {
        title: `[TEST] ${title}`,
        body,
        icon: template.iconUrl || "/pwa-icon-192.png",
        badge: template.badgeUrl || undefined,
        tag: "test-template",
        url: "/"
      };

      const result = await sendPushNotificationToMultiple(
        subscriptions.map(sub => ({
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string }
        })),
        payload
      );

      if (result.expiredSubscriptions.length > 0) {
        for (const endpoint of result.expiredSubscriptions) {
          await storage.deletePushSubscription(endpoint);
        }
      }

      res.json({
        message: "Test notification sent",
        successful: result.successful,
        failed: result.failed,
        expiredRemoved: result.expiredSubscriptions.length
      });
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ message: "Failed to send test notification" });
    }
  });

  // DELETE /api/push/templates/:id - Delete notification template
  app.delete("/api/push/templates/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await storage.deletePushNotificationTemplate(id);
      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      console.error("Error deleting notification template:", error);
      res.status(500).json({ message: "Failed to delete notification template" });
    }
  });

  // ==================================================
  // SMS TEMPLATE API ROUTES
  // ==================================================

  // GET /api/sms/templates - Get all SMS templates (admin) or active templates (regular users)
  app.get("/api/sms/templates", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const user = req.user;
      // Admin users get all templates, regular users get only active templates
      if (user?.isAdmin) {
        const templates = await storage.getAllSmsTemplates();
        res.json(templates);
      } else {
        const templates = await storage.getActiveSmsTemplates();
        res.json(templates);
      }
    } catch (error) {
      console.error("Error fetching SMS templates:", error);
      res.status(500).json({ message: "Failed to fetch SMS templates" });
    }
  });

  // GET /api/sms/templates/:id - Get a single SMS template
  app.get("/api/sms/templates/:id", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const template = await storage.getSmsTemplateById(id);
      if (!template) {
        return res.status(404).json({ message: "SMS template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching SMS template:", error);
      res.status(500).json({ message: "Failed to fetch SMS template" });
    }
  });

  // POST /api/sms/templates - Create a new SMS template (admin only)
  app.post("/api/sms/templates", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const validationResult = insertSmsTemplateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid template data",
          errors: validationResult.error.issues 
        });
      }

      const template = await storage.createSmsTemplate(validationResult.data);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating SMS template:", error);
      res.status(500).json({ message: "Failed to create SMS template" });
    }
  });

  // PATCH /api/sms/templates/:id - Update an SMS template (admin only)
  app.patch("/api/sms/templates/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      
      const validationResult = updateSmsTemplateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid template data",
          errors: validationResult.error.issues 
        });
      }

      const existing = await storage.getSmsTemplateById(id);
      if (!existing) {
        return res.status(404).json({ message: "SMS template not found" });
      }

      const template = await storage.updateSmsTemplate(id, validationResult.data);
      res.json(template);
    } catch (error) {
      console.error("Error updating SMS template:", error);
      res.status(500).json({ message: "Failed to update SMS template" });
    }
  });

  // DELETE /api/sms/templates/:id - Delete an SMS template (admin only)
  app.delete("/api/sms/templates/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;

      const existing = await storage.getSmsTemplateById(id);
      if (!existing) {
        return res.status(404).json({ message: "SMS template not found" });
      }

      await storage.deleteSmsTemplate(id);
      res.json({ message: "SMS template deleted successfully" });
    } catch (error) {
      console.error("Error deleting SMS template:", error);
      res.status(500).json({ message: "Failed to delete SMS template" });
    }
  });

  // ==================================================
  // NOTIFICATION ICON API ROUTES
  // ==================================================

  // Configure multer for in-memory file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    }
  });

  // GET /api/notification-icons - Get all notification icons
  app.get("/api/notification-icons", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const icons = await storage.getAllNotificationIcons();
      res.json(icons);
    } catch (error) {
      console.error("Error fetching notification icons:", error);
      res.status(500).json({ message: "Failed to fetch notification icons" });
    }
  });

  // POST /api/notification-icons - Upload a new notification icon
  app.post("/api/notification-icons", isAuthenticated, resolveEffectiveUser, requireAdmin, upload.single('icon'), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const file = req.file;
      const iconId = crypto.randomUUID();
      
      // Get bucket name from environment
      const bucketName = process.env.GCS_BUCKET_NAME || '';
      if (!bucketName) {
        return res.status(500).json({ message: "Object storage not configured" });
      }
      
      const bucket = objectStorageClient.bucket(bucketName);
      
      // Process image with sharp - resize to standard PWA icon sizes (192x192 and 512x512)
      const sizes = [192, 512];
      const processedImages = await Promise.all(
        sizes.map(async (size) => {
          const buffer = await sharp(file.buffer)
            .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .png()
            .toBuffer();
          
          return { size, buffer, metadata: await sharp(buffer).metadata() };
        })
      );
      
      // Store both sizes
      for (const { size, buffer } of processedImages) {
        const fileName = `${file.originalname.split('.')[0]}-${size}.png`;
        const filePath = `.private/notification-icons/${iconId}/${fileName}`;
        await bucket.file(filePath).save(buffer, {
          metadata: { contentType: 'image/png' }
        });
      }

      // Store metadata for the 192x192 version (primary icon)
      const primaryImage = processedImages[0];
      const fileName = `${file.originalname.split('.')[0]}-192.png`;
      const storagePath = `.private/notification-icons/${iconId}/${fileName}`;
      
      const icon = await storage.createNotificationIcon({
        fileName,
        storagePath,
        fileSize: primaryImage.buffer.length,
        mimeType: 'image/png',
        width: primaryImage.metadata.width || 192,
        height: primaryImage.metadata.height || 192,
        uploadedBy: effectiveUserId,
      });

      res.json(icon);
    } catch (error) {
      console.error("Error uploading notification icon:", error);
      res.status(500).json({ message: "Failed to upload notification icon" });
    }
  });

  // GET /api/notification-icons/:id/download - Get signed URL for icon download
  app.get("/api/notification-icons/:id/download", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const icon = await storage.getNotificationIconById(id);

      if (!icon) {
        return res.status(404).json({ message: "Icon not found" });
      }

      const bucketName = process.env.GCS_BUCKET_NAME || '';
      if (!bucketName) {
        return res.status(500).json({ message: "Object storage not configured" });
      }

      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(icon.storagePath);

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
      });

      res.json({ url });
    } catch (error) {
      console.error("Error downloading notification icon:", error);
      res.status(500).json({ message: "Failed to download notification icon" });
    }
  });

  // DELETE /api/notification-icons/:id - Delete notification icon
  app.delete("/api/notification-icons/:id", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const icon = await storage.getNotificationIconById(id);

      if (!icon) {
        return res.status(404).json({ message: "Icon not found" });
      }

      const bucketName = process.env.GCS_BUCKET_NAME || '';
      if (!bucketName) {
        return res.status(500).json({ message: "Object storage not configured" });
      }

      const bucket = objectStorageClient.bucket(bucketName);
      
      // Delete both 192 and 512 versions
      const basePath = icon.storagePath.replace(/\/[^/]+$/, ''); // Remove filename
      try {
        await bucket.file(icon.storagePath).delete();
        await bucket.file(`${basePath}/${icon.fileName.replace('-192', '-512')}`).delete();
      } catch (storageError) {
        console.warn("Error deleting files from storage:", storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      await storage.deleteNotificationIcon(id);

      res.json({ message: "Icon deleted successfully" });
    } catch (error) {
      console.error("Error deleting notification icon:", error);
      res.status(500).json({ message: "Failed to delete notification icon" });
    }
  });

  // ==================================================
  // EMAIL API ROUTES
  // ==================================================

  // POST /api/email/send - Send email via Microsoft Graph (Outlook) with SendGrid fallback
  app.post("/api/email/send", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      console.log('[EMAIL SEND] Starting email send request:', {
        to: req.body.to,
        subject: req.body.subject,
        hasContent: !!req.body.content,
        contentLength: req.body.content?.length || 0
      });

      const bodyValidation = sendEmailSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        console.error('[EMAIL SEND] Validation failed:', bodyValidation.error.issues);
        return res.status(400).json({
          message: "Invalid email data",
          errors: bodyValidation.error.issues
        });
      }

      const { to, cc, bcc, subject, content, clientId, personId, personIds, projectId, isHtml, attachments } = bodyValidation.data;
      
      // Normalize 'to' to always be an array for consistent handling
      const toRecipients = Array.isArray(to) ? to : [to];

      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      console.log('[EMAIL SEND] User ID:', effectiveUserId, 'Client ID:', clientId || 'none', 'Project ID:', projectId || 'none', 'To recipients:', toRecipients.length, 'Attachments:', attachments?.length || 0, 'CC:', cc?.length || 0, 'BCC:', bcc?.length || 0);

      // Check if user has access to this client (only if clientId is provided)
      if (clientId) {
        const hasAccess = await userHasClientAccess(effectiveUserId, clientId);
        if (!hasAccess) {
          console.error('[EMAIL SEND] Access denied for user:', effectiveUserId, 'to client:', clientId);
          return res.status(403).json({ message: "Access denied. You don't have permission to send emails for this client." });
        }
      }

      // Get the user
      const user = await storage.getUser(effectiveUserId);
      if (!user) {
        return res.status(400).json({ message: "User not found." });
      }

      let emailResult: any = null;
      let sentVia = 'unknown';
      let outlookError: Error | null = null;

      // Process inline images (convert /objects/ URLs to CID-embedded attachments)
      let processedContent = content;
      let inlineAttachments: Array<{
        name: string;
        contentType: string;
        contentBytes: string;
        contentId: string;
        isInline: boolean;
      }> = [];

      if (isHtml && content.includes('/objects/')) {
        try {
          const { processInlineImages } = await import('../utils/inlineImageProcessor');
          const processed = await processInlineImages(content);
          processedContent = processed.html;
          inlineAttachments = processed.inlineAttachments;
          
          if (inlineAttachments.length > 0) {
            console.log(`[EMAIL SEND] Processed ${inlineAttachments.length} inline image(s) for CID embedding`);
          }
        } catch (inlineErr) {
          console.error('[EMAIL SEND] Error processing inline images:', inlineErr);
          // Continue with original content if processing fails
        }
      }

      // Try Outlook (Microsoft Graph) first if configured and user has access
      const outlookConfigured = isApplicationGraphConfigured();
      const userHasOutlookAccess = user.accessEmail && user.email;

      if (outlookConfigured && userHasOutlookAccess) {
        try {
          console.log('[EMAIL SEND] Attempting to send email via Outlook (Microsoft Graph) as:', user.email);
          
          // Convert attachments format for tenant-wide API
          const formattedAttachments = attachments?.map(att => ({
            name: att.filename,
            contentType: att.contentType,
            contentBytes: att.content // Already base64 encoded
          }));

          emailResult = await sendEmailAsUserTenantWide(
            user.email!,
            toRecipients, // Pass all recipients as array
            subject,
            processedContent,
            isHtml || false,
            { 
              cc: cc && cc.length > 0 ? cc : undefined,
              bcc: bcc && bcc.length > 0 ? bcc : undefined,
              attachments: formattedAttachments,
              inlineAttachments: inlineAttachments.length > 0 ? inlineAttachments : undefined
            }
          );
          sentVia = 'outlook';
          console.log('[EMAIL SEND] Email sent successfully via Outlook:', { to, subject });
        } catch (err) {
          outlookError = err instanceof Error ? err : new Error(String(err));
          console.error('[EMAIL SEND] Outlook failed, will try SendGrid fallback:', outlookError.message);
          // Continue to SendGrid fallback
        }
      }

      // Fallback to SendGrid if Outlook failed or wasn't available
      if (!emailResult) {
        try {
          console.log('[EMAIL SEND] Attempting to send email via SendGrid fallback');
          
          const { client: sgMail, fromEmail } = await getUncachableSendGridClient();
          
          // Use sender name from user if available, otherwise use "The Link"
          const senderName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : 'The Link';
          
          // Build SendGrid message
          const sgMessage: any = {
            to: toRecipients, // Pass all recipients as array
            from: {
              email: fromEmail,
              name: senderName
            },
            subject,
            ...(isHtml ? { html: processedContent } : { text: processedContent }),
          };
          
          // Add CC recipients if present
          if (cc && cc.length > 0) {
            sgMessage.cc = cc;
          }
          
          // Add BCC recipients if present
          if (bcc && bcc.length > 0) {
            sgMessage.bcc = bcc;
          }
          
          // Add attachments if present (including inline attachments for SendGrid)
          const sgAttachments: any[] = [];
          if (attachments && attachments.length > 0) {
            sgAttachments.push(...attachments.map(att => ({
              filename: att.filename,
              content: att.content, // Already base64 encoded
              type: att.contentType,
              disposition: 'attachment',
            })));
          }
          
          // Add inline attachments for SendGrid
          if (inlineAttachments.length > 0) {
            sgAttachments.push(...inlineAttachments.map(att => ({
              filename: att.name,
              content: att.contentBytes,
              type: att.contentType,
              disposition: 'inline',
              content_id: att.contentId,
            })));
          }
          
          if (sgAttachments.length > 0) {
            sgMessage.attachments = sgAttachments;
          }
          
          emailResult = await sgMail.send(sgMessage);
          sentVia = 'sendgrid';
          console.log('[EMAIL SEND] Email sent successfully via SendGrid:', { to: toRecipients, subject });
        } catch (sendgridError) {
          const sgErr = sendgridError instanceof Error ? sendgridError.message : String(sendgridError);
          console.error('[EMAIL SEND] SendGrid also failed:', sgErr);
          
          // Provide helpful error message based on what failed
          if (outlookError && !userHasOutlookAccess) {
            throw new Error('Email access is not enabled for your account and SendGrid fallback failed. Please contact your administrator.');
          } else if (outlookError) {
            throw new Error(`Outlook failed (${outlookError.message}) and SendGrid fallback also failed. Please try again later.`);
          } else {
            throw new Error('Email service (SendGrid) failed. Please try again later.');
          }
        }
      }

      // Log the email as a communication record (only if linked to a client)
      // If multiple personIds are provided, log one communication entry with first personId
      // (the communication content shows all recipients in the metadata)
      let communication = null;
      if (clientId) {
        // Use personIds array if provided, otherwise fall back to single personId
        const recipientPersonIds = personIds && personIds.length > 0 ? personIds : (personId ? [personId] : []);
        const primaryPersonId = recipientPersonIds[0] || null;
        
        // Build subject with recipients for clearer chronology display
        // Format: "Original Subject - sent to recipient1, recipient2"
        const recipientEmails = toRecipients.slice(0, 3).join(', ') + (toRecipients.length > 3 ? ` +${toRecipients.length - 3} more` : '');
        const displaySubject = `${subject} - sent to ${recipientEmails}`;
        
        communication = await storage.createCommunication({
          clientId,
          personId: primaryPersonId,
          projectId: projectId || null,
          type: 'email_sent',
          subject: displaySubject,
          content: content,
          actualContactTime: new Date(),
          userId: effectiveUserId,
          metadata: toRecipients.length > 1 ? {
            allRecipients: toRecipients,
            allPersonIds: recipientPersonIds,
            cc: cc || [],
            bcc: bcc || [],
            originalSubject: subject
          } : { originalSubject: subject }
        });
        console.log('[EMAIL SEND] Communication logged with ID:', communication.id, 'Recipients:', toRecipients.length, projectId ? `(linked to project ${projectId})` : '');
      }

      res.json({
        success: true,
        message: `Email sent successfully via ${sentVia === 'outlook' ? 'Outlook' : 'SendGrid'}`,
        emailResult,
        sentVia,
        ...(communication && { communication: await storage.getCommunicationById(communication.id) })
      });

    } catch (error) {
      console.error("[EMAIL SEND] ERROR Details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        fullError: error
      });

      // Map common errors to user-friendly messages
      let statusCode = 500;
      let message = "Failed to send email";

      if (error instanceof Error) {
        if (error.message.includes('Both Outlook and SendGrid')) {
          statusCode = 503;
          message = error.message;
        } else if (error.message.includes('SendGrid not connected')) {
          statusCode = 503;
          message = "Email service not configured. Please contact administrator.";
        } else if (error.message.includes('X_REPLIT_TOKEN')) {
          statusCode = 503;
          message = "Email service authentication error. Please try again later.";
        } else {
          message = `Email sending failed: ${error.message}`;
        }
      }

      res.status(statusCode).json({ message });
    }
  });

  // POST /api/email/test-send - Test endpoint to send email to jamsplan1@gmail.com
  app.post("/api/email/test-send", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const testEmail = "jamsplan1@gmail.com";
      const testSubject = `Test Email from The Link - ${new Date().toLocaleString()}`;
      const testContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4f46e5;">Test Email from The Link</h2>
          <p>This is a test email to verify that email sending is working correctly.</p>

          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #0369a1;">Test Details</h3>
            <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Sent by:</strong> ${req.user?.email || 'Unknown'}</p>
            <p><strong>Recipient:</strong> ${testEmail}</p>
          </div>

          <p>If you received this email, the email sending functionality is working correctly!</p>

          <p style="margin-top: 30px;">
            Best regards,<br>
            The Link Email System
          </p>
        </div>
      `;

      console.log('[TEST EMAIL] Starting test email send to:', testEmail);

      // Check if tenant-wide Graph is configured
      if (!isApplicationGraphConfigured()) {
        return res.status(503).json({
          message: "Email service not configured. Please contact administrator."
        });
      }

      // Get the admin user's email to send from their account
      const user = await storage.getUser(req.user!.id);
      if (!user?.email) {
        return res.status(400).json({
          message: "No email address configured for your account."
        });
      }

      console.log('[TEST EMAIL] Attempting to send via tenant-wide Graph API as:', user.email);
      const emailResult = await sendEmailAsUserTenantWide(user.email, testEmail, testSubject, testContent, true);
      console.log('[TEST EMAIL] Email sent successfully:', emailResult);

      res.json({
        success: true,
        message: `Test email sent successfully to ${testEmail}`,
        emailResult,
        details: {
          to: testEmail,
          subject: testSubject,
          sentAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error("[TEST EMAIL] ERROR Details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        fullError: error
      });

      let statusCode = 500;
      let message = "Failed to send test email";

      if (error instanceof Error) {
        if (error.message.includes('Outlook not connected')) {
          statusCode = 503;
          message = "Outlook connector not configured. Please set up the Outlook integration in Replit.";
        } else if (error.message.includes('X_REPLIT_TOKEN')) {
          statusCode = 503;
          message = "Replit authentication error. Please check your deployment configuration.";
        } else {
          message = `Test email failed: ${error.message}`;
        }
      }

      res.status(statusCode).json({
        message,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          attemptedRecipient: "jamsplan1@gmail.com",
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  // POST /api/admin/email/historical-import - Run historical email import for selected inboxes
  app.post("/api/admin/email/historical-import", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const { inboxIds, sinceDays = 90, maxMessagesPerFolder = 500, markOldAsNoAction = true, noActionThresholdDays = 7 } = req.body;

      if (!inboxIds || !Array.isArray(inboxIds) || inboxIds.length === 0) {
        return res.status(400).json({ message: "inboxIds must be a non-empty array of inbox IDs" });
      }

      console.log(`[HISTORICAL IMPORT] Starting import for ${inboxIds.length} inbox(es), ${sinceDays} days back`);
      
      // Import the function dynamically to avoid circular dependencies
      const { runHistoricalImport } = await import("../services/emailSyncService");
      
      const results = await runHistoricalImport(inboxIds, {
        sinceDays,
        maxMessagesPerFolder,
        markOldAsNoAction,
        noActionThresholdDays,
      });

      const totalInboxSynced = results.reduce((sum, r) => sum + r.inboxSynced, 0);
      const totalSentSynced = results.reduce((sum, r) => sum + r.sentSynced, 0);
      const totalMatched = results.reduce((sum, r) => sum + r.matched, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

      console.log(`[HISTORICAL IMPORT] Completed: ${totalInboxSynced} inbox, ${totalSentSynced} sent, ${totalMatched} matched, ${totalErrors} errors`);

      res.json({
        success: true,
        summary: {
          inboxesProcessed: results.length,
          totalInboxSynced,
          totalSentSynced,
          totalMatched,
          totalErrors,
        },
        results,
      });
    } catch (error) {
      console.error("[HISTORICAL IMPORT] Error:", error);
      res.status(500).json({
        message: "Historical import failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ==================================================
  // SMS API ROUTES
  // ==================================================

  // POST /api/sms/send - Send SMS via VoodooSMS
  app.post("/api/sms/send", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const bodyValidation = sendSmsSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid SMS data",
          errors: bodyValidation.error.issues
        });
      }

      const { to, message, clientId, personId, projectId } = bodyValidation.data;

      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      // Check if user has access to this client
      const hasAccess = await userHasClientAccess(effectiveUserId, clientId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied. You don't have permission to send SMS for this client." });
      }

      // Convert phone number to international format for VoodooSMS API
      let formattedPhoneNumber: string;

      // Clean the phone number - remove all non-digits
      const cleanPhone = to.replace(/[^\d]/g, '');

      // Check if it's a UK mobile number (starts with 07 and has 11 digits)
      if (cleanPhone.startsWith('07') && cleanPhone.length === 11) {
        // Convert UK mobile (07xxxxxxxx) to international format (+447xxxxxxx)
        formattedPhoneNumber = `+447${cleanPhone.slice(2)}`;
      } else if (cleanPhone.startsWith('447') && cleanPhone.length === 12) {
        // Already in UK international format without +, just add the +
        formattedPhoneNumber = `+${cleanPhone}`;
      } else if (to.startsWith('+447') && cleanPhone.length === 12) {
        // Already in correct international format
        formattedPhoneNumber = to;
      } else {
        // For other formats, try to use as-is but ensure it starts with +
        formattedPhoneNumber = to.startsWith('+') ? to : `+${cleanPhone}`;
      }

      // Prepare SMS data for VoodooSMS API
      const smsData = {
        to: formattedPhoneNumber,
        from: "GrowthAcc", // Default sender ID
        msg: message,
        external_reference: `client_${clientId}_${Date.now()}`
      };

      // Send SMS via VoodooSMS API
      const response = await fetch('https://api.voodoosms.com/sendsms', {
        method: 'POST',
        headers: {
          'Authorization': process.env.VOODOO_SMS_API_KEY || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(smsData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('VoodooSMS API error:', response.status, errorText);
        return res.status(500).json({
          message: "Failed to send SMS",
          error: `API responded with ${response.status}`
        });
      }

      const smsResponse = await response.json();

      // Log the SMS as a communication record
      // Note: If projectId is provided, the communication will automatically appear 
      // in the project chronology timeline (which queries communications by projectId)
      const communication = await storage.createCommunication({
        clientId,
        personId: personId || null,
        projectId: projectId || null,
        type: 'sms_sent',
        subject: 'SMS Sent',
        content: message,
        actualContactTime: new Date(),
        userId: effectiveUserId
      });
      console.log('[SMS SEND] Communication logged with ID:', communication.id, projectId ? `(linked to project ${projectId})` : '');

      res.json({
        success: true,
        message: "SMS sent successfully",
        smsResponse,
        communication: await storage.getCommunicationById(communication.id)
      });

    } catch (error) {
      console.error("Error sending SMS:", error);
      res.status(500).json({ message: "Failed to send SMS" });
    }
  });

  // ==================================================
  // USER INTEGRATIONS API ROUTES
  // ==================================================

  // GET /api/user-integrations - Get current user's integrations
  app.get("/api/user-integrations", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const integrations = await storage.getUserIntegrations(effectiveUserId);

      // Remove sensitive tokens from response
      const safeIntegrations = integrations.map((integration: any) => ({
        ...integration,
        accessToken: integration.accessToken ? "***" : null,
        refreshToken: integration.refreshToken ? "***" : null,
      }));

      res.json(safeIntegrations);
    } catch (error) {
      console.error("Error fetching user integrations:", error);
      res.status(500).json({ message: "Failed to fetch user integrations" });
    }
  });

  // POST /api/user-integrations - Create a new user integration
  app.post("/api/user-integrations", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const bodyValidation = insertUserIntegrationSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid integration data",
          errors: bodyValidation.error.issues
        });
      }

      const integrationData = bodyValidation.data;

      // Set the user ID from the authenticated user
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const integration = await storage.createUserIntegration({
        ...integrationData,
        userId: effectiveUserId,
      });

      // Remove sensitive tokens from response
      const safeIntegration = {
        ...integration,
        accessToken: integration.accessToken ? "***" : null,
        refreshToken: integration.refreshToken ? "***" : null,
      };

      res.json(safeIntegration);
    } catch (error) {
      console.error("Error creating user integration:", error);
      res.status(500).json({ message: "Failed to create user integration" });
    }
  });

  // PUT /api/user-integrations/:userIntegrationId - Update a user integration
  app.put("/api/user-integrations/:userIntegrationId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramsValidation = validateParams(paramUserIntegrationIdSchema, req.params);
      if (!paramsValidation.success) {
        return res.status(400).json({
          message: "Invalid user integration ID",
          errors: paramsValidation.errors
        });
      }

      const partialSchema = insertUserIntegrationSchema.partial();
      const bodyValidation = partialSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid integration data",
          errors: bodyValidation.error.issues
        });
      }

      const { userIntegrationId } = paramsValidation.data;
      const updateData = bodyValidation.data;

      // Ensure the user can only update their own integrations
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const existingIntegrations = await storage.getUserIntegrations(effectiveUserId);
      const hasAccess = existingIntegrations.some((integration: any) => integration.id === userIntegrationId);

      if (!hasAccess && !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized to update this integration" });
      }

      const integration = await storage.updateUserIntegration(userIntegrationId, updateData);

      // Remove sensitive tokens from response
      const safeIntegration = {
        ...integration,
        accessToken: integration.accessToken ? "***" : null,
        refreshToken: integration.refreshToken ? "***" : null,
      };

      res.json(safeIntegration);
    } catch (error) {
      console.error("Error updating user integration:", error);
      res.status(500).json({ message: "Failed to update user integration" });
    }
  });

  // DELETE /api/user-integrations/:userIntegrationId - Delete a user integration
  app.delete("/api/user-integrations/:userIntegrationId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramsValidation = validateParams(paramUserIntegrationIdSchema, req.params);
      if (!paramsValidation.success) {
        return res.status(400).json({
          message: "Invalid user integration ID",
          errors: paramsValidation.errors
        });
      }

      const { userIntegrationId } = paramsValidation.data;

      // Ensure the user can only delete their own integrations
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const existingIntegrations = await storage.getUserIntegrations(effectiveUserId);
      const hasAccess = existingIntegrations.some((integration: any) => integration.id === userIntegrationId);

      if (!hasAccess && !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized to delete this integration" });
      }

      await storage.deleteUserIntegration(userIntegrationId);
      res.json({ message: "User integration deleted successfully" });
    } catch (error) {
      console.error("Error deleting user integration:", error);
      res.status(500).json({ message: "Failed to delete user integration" });
    }
  });

  // Test email endpoint (development only)
  if (process.env.NODE_ENV === 'development') {
    app.post("/api/test-email", isAuthenticated, requireAdmin, async (req: any, res) => {
      try {
        const { to, subject, message } = req.body;

        if (!to || !subject || !message) {
          return res.status(400).json({ message: "Missing required fields: to, subject, message" });
        }

        const success = await sendTaskAssignmentEmail(
          to,
          "Test User",
          message,
          "Test Client",
          "bookkeeping_work_required"
        );

        if (success) {
          res.json({ message: "Test email sent successfully" });
        } else {
          res.status(500).json({ message: "Failed to send test email" });
        }
      } catch (error) {
        console.error("Error sending test email:", error);
        res.status(500).json({ message: "Failed to send test email" });
      }
    });
  }
}
