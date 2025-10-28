import type { Express } from "express";
import { storage } from "../storage";
import fetch from 'node-fetch';
import {
  validateParams,
  sendEmailSchema,
  sendSmsSchema,
  pushSubscribeSchema,
  pushUnsubscribeSchema,
  pushSendSchema,
  ringCentralAuthenticateSchema,
  ringCentralLogCallSchema,
  ringCentralRequestTranscriptSchema,
  paramUserIntegrationIdSchema,
  resolveEffectiveUser,
  requireAdmin,
  userHasClientAccess,
} from "./routeHelpers";
import { insertUserIntegrationSchema } from "@shared/schema";
import { generateUserOutlookAuthUrl, exchangeCodeForTokens, getUserOutlookClient } from "../utils/userOutlookClient";
import {
  generateUserRingCentralAuthUrl,
  exchangeCodeForRingCentralTokens,
  disconnectRingCentral,
  storeRingCentralTokens,
  getSIPProvisionCredentials,
  getCallRecordingUrl,
  requestCallTranscription,
  getTranscriptionResult
} from "../utils/userRingCentralClient";
import { sendPushNotificationToMultiple, getVapidPublicKey, type PushNotificationPayload } from "../push-service";

export function registerIntegrationRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any
) {
  // ==================================================
  // OUTLOOK OAUTH ROUTES
  // ==================================================

  app.get('/api/oauth/outlook/auth-url', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user!.effectiveUserId;
      const authUrl = await generateUserOutlookAuthUrl(userId);
      res.json({ authUrl });
    } catch (error) {
      console.error("Error generating Outlook auth URL:", error instanceof Error ? error.message : error);

      // Check if it's a configuration error
      if (error instanceof Error && error.message.includes('Microsoft OAuth not configured')) {
        return res.status(400).json({
          message: "Microsoft Outlook integration is not configured on this server",
          configured: false
        });
      }

      res.status(500).json({ message: "Failed to generate auth URL" });
    }
  });

  app.get('/api/oauth/outlook/callback', async (req: any, res: any) => {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        return res.status(400).json({ message: "Missing authorization code or state" });
      }

      const result = await exchangeCodeForTokens(code as string, state as string);

      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      // Redirect to profile page with success message
      res.redirect('/profile?tab=integrations&outlook=connected');
    } catch (error) {
      console.error("Error handling Outlook OAuth callback:", error instanceof Error ? error.message : error);
      res.redirect('/profile?tab=integrations&outlook=error');
    }
  });

  app.get('/api/oauth/outlook/status', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user!.effectiveUserId;

      try {
        const account = await storage.getUserOauthAccount(userId, 'outlook');

        if (!account) {
          return res.json({ connected: false });
        }

        // Check if tokens are valid by trying to get user info
        try {
          const client = await getUserOutlookClient(userId);
          if (!client) {
            return res.json({ connected: false });
          }

          const userInfo = await client.api('/me').get();
          res.json({
            connected: true,
            email: userInfo.mail || userInfo.userPrincipalName,
            displayName: userInfo.displayName
          });
        } catch (tokenError) {
          // Tokens might be expired or invalid
          res.json({ connected: false, needsReauth: true });
        }
      } catch (dbError) {
        // Database or schema error - return disconnected status
        console.error("Database error checking OAuth status:", dbError instanceof Error ? dbError.message : dbError);
        res.json({ connected: false });
      }
    } catch (error) {
      console.error("Error checking Outlook status:", error instanceof Error ? error.message : error);
      // Return disconnected instead of 500 to prevent UI blocking
      res.json({ connected: false });
    }
  });

  app.delete('/api/oauth/outlook/disconnect', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user!.effectiveUserId;
      await storage.deleteUserOauthAccount(userId, 'outlook');
      res.json({ message: "Outlook account disconnected successfully" });
    } catch (error) {
      console.error("Error disconnecting Outlook account:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to disconnect account" });
    }
  });

  // Send email using user's Outlook account
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

      // Check if user has Outlook connected
      const outlookClient = await getUserOutlookClient(userId);
      if (!outlookClient) {
        return res.status(400).json({
          message: "No Outlook account connected. Please connect your account first."
        });
      }

      // Prepare email message
      const message = {
        subject,
        body: {
          contentType: 'HTML',
          content: content
        },
        toRecipients: [
          {
            emailAddress: {
              address: to
            }
          }
        ]
      };

      // Send email through Microsoft Graph API
      await outlookClient.api('/me/sendMail').post({
        message
      });

      // Log the communication only if linked to a client
      if (clientId) {
        await storage.createCommunication({
          clientId,
          personId: personId || null,
          type: 'email_sent',
          subject: subject,
          content: content,
          actualContactTime: new Date(),
          userId
        });
      }

      res.json({
        message: "Email sent successfully",
        sentTo: to,
        subject
      });
    } catch (error) {
      console.error("Error sending email via Outlook:", error instanceof Error ? error.message : error);

      // Handle specific Graph API errors
      if (error instanceof Error) {
        if (error.message.includes('InvalidAuthenticationToken') || error.message.includes('Unauthorized')) {
          return res.status(401).json({
            message: "Your Outlook connection has expired. Please reconnect your account."
          });
        }
        if (error.message.includes('Forbidden')) {
          return res.status(403).json({
            message: "Insufficient permissions to send email. Please reconnect your account."
          });
        }
      }

      res.status(500).json({
        message: "Failed to send email. Please try again or reconnect your account."
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

      const { clientId, personId, phoneNumber, direction, duration, sessionId, recordingId } = validation.data;

      // Create communication entry
      const communication = await storage.createCommunication({
        clientId,
        personId: personId || null,
        userId: effectiveUserId,
        type: 'phone_call',
        content: `${direction === 'outbound' ? 'Outbound' : 'Inbound'} call to ${phoneNumber}. Duration: ${duration || 0}s`,
        subject: `Phone Call - ${phoneNumber}`,
        actualContactTime: new Date(),
        metadata: {
          integration: 'ringcentral',
          sessionId,
          recordingId,
          direction,
          duration,
          phoneNumber,
          transcriptionStatus: recordingId ? 'pending' : 'not_available'
        }
      });

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
  // EMAIL API ROUTES
  // ==================================================

  // POST /api/email/send - Send email via Microsoft Graph (Outlook)
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

      const { to, subject, content, clientId, personId, isHtml } = bodyValidation.data;

      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      console.log('[EMAIL SEND] User ID:', effectiveUserId, 'Client ID:', clientId || 'none');

      // Check if user has access to this client (only if clientId is provided)
      if (clientId) {
        const hasAccess = await userHasClientAccess(effectiveUserId, clientId);
        if (!hasAccess) {
          console.error('[EMAIL SEND] Access denied for user:', effectiveUserId, 'to client:', clientId);
          return res.status(403).json({ message: "Access denied. You don't have permission to send emails for this client." });
        }
      }

      // Import the Outlook client functions
      const { sendEmail } = await import('../utils/outlookClient');

      console.log('[EMAIL SEND] Attempting to send email via Outlook connector...');
      // Send email via Microsoft Graph API
      const emailResult = await sendEmail(to, subject, content, isHtml || false);
      console.log('[EMAIL SEND] Email sent successfully via Outlook:', { to, subject, result: emailResult });

      // Log the email as a communication record (only if linked to a client)
      let communication = null;
      if (clientId) {
        communication = await storage.createCommunication({
          clientId,
          personId: personId || null,
          type: 'email_sent',
          subject: subject,
          content: content,
          actualContactTime: new Date(),
          userId: effectiveUserId
        });
        console.log('[EMAIL SEND] Communication logged with ID:', communication.id);
      }

      res.json({
        success: true,
        message: "Email sent successfully",
        emailResult,
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
        if (error.message.includes('Outlook not connected')) {
          statusCode = 503;
          message = "Email service not configured. Please contact administrator.";
        } else if (error.message.includes('X_REPLIT_TOKEN')) {
          statusCode = 503;
          message = "Email service authentication error. Please try again later.";
        } else if (error.message.includes('access_token')) {
          statusCode = 401;
          message = "Email service authorization expired. Please reconnect your email account.";
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

      // Import the Outlook client functions
      const { sendEmail } = await import('../utils/outlookClient');

      console.log('[TEST EMAIL] Attempting to send via Outlook connector...');
      const emailResult = await sendEmail(testEmail, testSubject, testContent, true);
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

      const { to, message, clientId, personId } = bodyValidation.data;

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
        from: "CRM", // Default sender ID
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
      const communication = await storage.createCommunication({
        clientId,
        personId: personId || null,
        type: 'sms_sent',
        subject: 'SMS Sent',
        content: message,
        actualContactTime: new Date(),
        userId: effectiveUserId
      });

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
      const safeIntegrations = integrations.map(integration => ({
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
      const hasAccess = existingIntegrations.some(integration => integration.id === userIntegrationId);

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
      const hasAccess = existingIntegrations.some(integration => integration.id === userIntegrationId);

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
}
