import type { Express } from "express";
import { storage } from "../storage/index";
import { z } from "zod";
import {
  isApplicationGraphConfigured,
  getUserByEmail,
  getUserEmails,
  getUserMailFolders,
  listTenantUsers,
  createReplyToMessage,
  createReplyAllToMessage,
} from "../utils/applicationGraphClient";
import { slaCalculationService } from "../services/slaCalculationService";

/**
 * Email Routes
 * 
 * Handles email threading and messaging functionality for The Link CRM.
 * Integrates with Microsoft Graph API for sending replies.
 */

// Validation schemas
const replyToEmailSchema = z.object({
  body: z.string().min(1, "Reply content is required"),
  to: z.array(z.string().email()).optional(),
  cc: z.array(z.string().email()).optional(),
  subject: z.string().optional(),
  replyAll: z.boolean().optional().default(false),
  attachments: z.array(z.object({
    objectPath: z.string(),
    fileName: z.string(),
    contentType: z.string().optional(),
    fileSize: z.number().optional(),
  })).optional(),
});

export function registerEmailRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any
) {
  /**
   * POST /api/emails/:messageId/reply
   * Send a reply to an email message
   * 
   * Body:
   * - body: The reply content (HTML)
   * - to: Array of recipient email addresses (optional, defaults from original message)
   * - cc: Array of CC email addresses (optional)
   * - subject: Email subject (optional, defaults to Re: original subject)
   * - replyAll: Whether to reply to all recipients (default: false)
   * - attachments: Array of attachment metadata from /api/upload/attachments
   */
  app.post('/api/emails/:messageId/reply', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { messageId } = req.params;
      const userId = req.user!.effectiveUserId;
      
      // Validate request body
      const validation = replyToEmailSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: validation.error.errors
        });
      }
      
      const { body, to, cc, subject, replyAll, attachments } = validation.data;
      
      // Check if tenant-wide Graph is configured
      if (!isApplicationGraphConfigured()) {
        return res.status(400).json({
          message: "Microsoft 365 email integration is not configured on this server."
        });
      }
      
      // Get the user to check their accessEmail flag and get their email
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(400).json({ message: "User not found." });
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
      
      // Get the email message from database
      const message = await storage.getEmailMessageById(messageId);
      if (!message) {
        return res.status(404).json({ message: "Email message not found" });
      }
      
      // Check if user has access to this message (must be in their mailbox)
      const hasAccess = await storage.userHasAccessToMessage(userId, messageId);
      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this email message" });
      }
      
      // Get the user's Graph API message ID for this message
      const graphMessageId = await storage.getUserGraphMessageId(userId, messageId);
      if (!graphMessageId) {
        return res.status(404).json({ message: "Message not found in your mailbox" });
      }
      
      // Send reply via Microsoft Graph API using tenant-wide permissions
      // Pass user's email (for /users/{email}/... endpoints) instead of userId
      if (replyAll) {
        await createReplyAllToMessage(user.email, graphMessageId, body, true, { subject, to, cc, attachments });
      } else {
        await createReplyToMessage(user.email, graphMessageId, body, true, { subject, to, cc, attachments });
      }
      
      res.json({
        success: true,
        message: "Reply sent successfully. It will appear in your Sent Items shortly."
      });
    } catch (error) {
      console.error('Error sending email reply:', error);
      
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
        message: "Failed to send reply",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  /**
   * GET /api/emails/thread/:threadId
   * Get all messages in an email thread with attachments
   */
  app.get('/api/emails/thread/:threadId', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const userId = req.user!.effectiveUserId;
      
      // Get the thread
      const thread = await storage.getEmailThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Email thread not found" });
      }
      
      // Get all messages in the thread
      const messages = await storage.getEmailMessagesByThreadId(threadId);
      
      // Filter to only messages the user has access to and add attachments
      const accessibleMessages = [];
      for (const message of messages) {
        const hasAccess = await storage.userHasAccessToMessage(userId, message.internetMessageId);
        if (hasAccess) {
          // Get attachments for this message
          const attachments = await storage.getAttachmentsByMessageId(message.internetMessageId);
          
          accessibleMessages.push({
            ...message,
            attachments
          });
        }
      }
      
      res.json({
        thread,
        messages: accessibleMessages
      });
    } catch (error) {
      console.error('Error fetching email thread:', error);
      res.status(500).json({
        message: "Failed to fetch email thread",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  /**
   * GET /api/emails/client/:clientId
   * Get all email threads for a client
   */
  app.get('/api/emails/client/:clientId', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { clientId } = req.params;
      const userId = req.user!.effectiveUserId;
      
      // Verify client exists
      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      // Get all threads for this client
      const threads = await storage.getEmailThreadsByClientId(clientId);
      
      res.json({
        threads
      });
    } catch (error) {
      console.error('Error fetching client email threads:', error);
      res.status(500).json({
        message: "Failed to fetch client email threads",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  /**
   * GET /api/emails/my-threads
   * Get all email threads where current user is involved
   * 
   * Query params:
   * - myEmailsOnly: boolean (default: false) - if true, only return threads where user is in to/cc/from, otherwise return all threads in user's mailbox
   * - clientId: string (optional) - filter by specific client
   */
  app.get('/api/emails/my-threads', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user!.effectiveUserId;
      const myEmailsOnly = req.query.myEmailsOnly === 'true';
      const clientId = req.query.clientId as string | undefined;
      
      // Get threads where user is involved
      let threads = await storage.getEmailThreadsByUserId(userId, myEmailsOnly);
      
      // Filter by client if specified
      if (clientId) {
        threads = threads.filter(thread => thread.clientId === clientId);
      }
      
      res.json({
        threads
      });
    } catch (error) {
      console.error('Error fetching user email threads:', error);
      res.status(500).json({
        message: "Failed to fetch email threads",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  /**
   * GET /api/emails/attachments/:attachmentId
   * Get a signed URL for an email attachment
   */
  app.get('/api/emails/attachments/:attachmentId', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { attachmentId } = req.params;
      const userId = req.user!.effectiveUserId;
      
      // Get the attachment
      const attachment = await storage.getEmailAttachmentById(attachmentId);
      if (!attachment) {
        return res.status(404).json({ message: "Attachment not found" });
      }
      
      // Get the message this attachment belongs to
      const messageAttachment = await storage.getEmailMessageAttachmentByAttachmentId(attachmentId);
      if (!messageAttachment || messageAttachment.length === 0) {
        return res.status(404).json({ message: "Attachment not linked to any message" });
      }
      
      // Verify user has access to at least one message with this attachment
      const hasAccess = await storage.userHasAccessToMessage(userId, messageAttachment[0].internetMessageId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this attachment" });
      }
      
      // Generate signed URL
      const signedUrl = await storage.getSignedUrl(attachment.objectPath);
      
      res.json({
        url: signedUrl,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        fileSize: attachment.fileSize
      });
    } catch (error) {
      console.error('Error getting email attachment:', error);
      res.status(500).json({
        message: "Failed to get attachment",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Admin: Manual mailbox sync
  app.post('/api/admin/emails/sync-mailbox', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      // Verify the user exists and has Outlook access
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Trigger full delta sync for this user
      const { performIncrementalDeltaSync } = await import('../services/emailIngestionService');
      await performIncrementalDeltaSync(userId);

      res.json({
        message: `Successfully triggered mailbox sync for ${user.email}`,
        userId
      });
    } catch (error) {
      console.error('Error in manual mailbox sync:', error);
      res.status(500).json({
        message: "Mailbox sync failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Admin: Get quarantine emails
  app.get('/api/admin/emails/quarantine', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const unmatchedEmails = await storage.getUnmatchedEmails({ resolvedOnly: false });
      
      res.json(unmatchedEmails);
    } catch (error) {
      console.error('Error getting quarantine emails:', error);
      res.status(500).json({
        message: "Failed to get quarantine emails",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Admin: Subscribe to webhook for a user's mailbox
  app.post('/api/admin/emails/webhook/subscribe', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      // Verify the user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Setup webhook subscription
      const { setupOutlookWebhook } = await import('../utils/outlookClient');
      const subscription = await setupOutlookWebhook(userId);

      res.json({
        message: `Successfully created webhook subscription for ${user.email}`,
        subscription
      });
    } catch (error) {
      console.error('Error creating webhook subscription:', error);
      res.status(500).json({
        message: "Failed to create webhook subscription",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Microsoft Graph webhook endpoint (no auth required for validation)
  app.post('/api/webhooks/outlook', async (req: any, res: any) => {
    try {
      // Handle validation token during subscription creation
      if (req.query?.validationToken) {
        return res.status(200).send(req.query.validationToken);
      }

      // Handle webhook notifications
      const notifications = req.body?.value;
      if (!notifications || !Array.isArray(notifications)) {
        return res.status(400).json({ message: "Invalid notification payload" });
      }

      // Process each notification asynchronously (don't block webhook response)
      Promise.all(
        notifications.map(async (notification: any) => {
          try {
            const { subscriptionId, resource, changeType } = notification;
            
            // Get the subscription from database to find which user's mailbox this is
            const subscription = await storage.getGraphWebhookSubscription(subscriptionId);
            if (!subscription || !subscription.isActive) {
              console.warn(`Webhook notification for unknown/inactive subscription: ${subscriptionId}`);
              return;
            }

            // Trigger incremental delta sync for this user's mailbox
            const { performIncrementalDeltaSync } = await import('../services/emailIngestionService');
            await performIncrementalDeltaSync(subscription.userId);
            
            console.log(`Processed webhook notification for user ${subscription.userId}, changeType: ${changeType}`);
          } catch (error) {
            console.error('Error processing webhook notification:', error);
          }
        })
      ).catch(error => {
        console.error('Error processing webhook notifications batch:', error);
      });

      // Always respond 202 Accepted immediately to Graph API
      res.status(202).send();
    } catch (error) {
      console.error('Error in webhook endpoint:', error);
      res.status(500).json({
        message: "Webhook processing failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Admin: Send test stage change notification email
  app.post('/api/admin/emails/test-stage-change', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { sendStageChangeNotificationEmail } = await import('../emailService');
      
      // Send a comprehensive test email with all possible fields
      const emailSent = await sendStageChangeNotificationEmail(
        'jamsplan1@gmail.com',
        'Bob Bookkeeper',
        'Weekly Payroll - CAVANAGH BUILDERS LTD',
        'CAVANAGH BUILDERS LTD',
        'Complete',
        'Do_The_Work',
        'test-project-123',
        { maxInstanceTime: 1 }, // 1 business hour
        [
          { toStatus: 'Complete', timestamp: new Date().toISOString() },
          { toStatus: 'Do_The_Work', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }
        ],
        new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        'Work completed successfully',
        'All payroll calculations verified and submitted to HMRC',
        [
          { fieldName: 'Number of Employees Processed', fieldType: 'number', value: 15 },
          { fieldName: 'Payment Method', fieldType: 'long_text', value: 'BACS Transfer' },
          { fieldName: 'Issues Encountered', fieldType: 'multi_select', value: ['Late Timesheets', 'System Downtime'] }
        ]
      );

      if (emailSent) {
        res.json({
          success: true,
          message: 'Test email sent successfully to jamsplan1@gmail.com'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to send test email'
        });
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      res.status(500).json({
        message: "Failed to send test email",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ==================================================
  // ADMIN: Tenant-Wide Microsoft Graph API Test Routes
  // ==================================================

  /**
   * GET /api/admin/emails/test-tenant-access
   * Test tenant-wide email access using application permissions
   * 
   * Query params:
   * - email: Email address to look up (e.g., martyn@growth.accountants)
   */
  app.get('/api/admin/emails/test-tenant-access', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Check if application credentials are configured
      if (!isApplicationGraphConfigured()) {
        return res.status(400).json({
          success: false,
          message: "Microsoft application credentials not configured",
          missing: "MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and/or MICROSOFT_TENANT_ID"
        });
      }

      const email = req.query.email as string || 'martyn@growth.accountants';

      console.log(`[Tenant Access Test] Testing access for email: ${email}`);

      // Step 1: Look up the user by email to get their Azure AD GUID
      const user = await getUserByEmail(email);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: `User not found in Azure AD: ${email}`,
          step: 'user_lookup'
        });
      }

      console.log(`[Tenant Access Test] Found user: ${user.displayName} (${user.id})`);

      // Step 2: Get the user's mail folders
      let mailFolders;
      try {
        mailFolders = await getUserMailFolders(user.id);
        console.log(`[Tenant Access Test] Retrieved ${mailFolders.length} mail folders`);
      } catch (folderError: any) {
        return res.status(500).json({
          success: false,
          message: "Failed to access mail folders - may lack Mail.Read permission",
          error: folderError.message,
          user: {
            id: user.id,
            displayName: user.displayName,
            email: user.mail || user.userPrincipalName
          },
          step: 'mail_folders'
        });
      }

      // Step 3: Get some recent emails from Inbox
      let recentEmails;
      try {
        recentEmails = await getUserEmails(user.id, {
          folder: 'Inbox',
          top: 5,
          orderBy: 'receivedDateTime desc'
        });
        console.log(`[Tenant Access Test] Retrieved ${recentEmails.messages.length} recent emails`);
      } catch (emailError: any) {
        return res.status(500).json({
          success: false,
          message: "Failed to read emails - may lack Mail.Read permission",
          error: emailError.message,
          user: {
            id: user.id,
            displayName: user.displayName,
            email: user.mail || user.userPrincipalName
          },
          mailFolders,
          step: 'read_emails'
        });
      }

      // Success! Return all the data
      res.json({
        success: true,
        message: "Tenant-wide email access is working!",
        user: {
          azureAdId: user.id,
          displayName: user.displayName,
          email: user.mail || user.userPrincipalName
        },
        mailFolders: mailFolders.map(f => ({
          name: f.displayName,
          totalItems: f.totalItemCount,
          unread: f.unreadItemCount
        })),
        recentEmails: recentEmails.messages.map((msg: any) => ({
          id: msg.id,
          internetMessageId: msg.internetMessageId,
          subject: msg.subject,
          from: msg.from?.emailAddress?.address,
          receivedDateTime: msg.receivedDateTime,
          isRead: msg.isRead,
          preview: msg.bodyPreview?.substring(0, 100)
        }))
      });

    } catch (error: any) {
      console.error('[Tenant Access Test] Error:', error);
      res.status(500).json({
        success: false,
        message: "Tenant access test failed",
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  /**
   * GET /api/admin/emails/list-tenant-users
   * List all users in the tenant (for testing/debugging)
   */
  app.get('/api/admin/emails/list-tenant-users', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      if (!isApplicationGraphConfigured()) {
        return res.status(400).json({
          success: false,
          message: "Microsoft application credentials not configured"
        });
      }

      const result = await listTenantUsers({ top: 50 });

      res.json({
        success: true,
        count: result.users.length,
        users: result.users.map(u => ({
          id: u.id,
          displayName: u.displayName,
          email: u.mail || u.userPrincipalName
        }))
      });
    } catch (error: any) {
      console.error('[List Tenant Users] Error:', error);
      res.status(500).json({
        success: false,
        message: "Failed to list tenant users",
        error: error.message
      });
    }
  });

  // ============================================================================
  // EMAIL DASHBOARD ROUTES - Smart Inbox / SLA Management
  // ============================================================================

  /**
   * GET /api/email-dashboard/threads
   * Get email threads for the dashboard with SLA information
   * 
   * Query params:
   * - status: 'active' | 'complete' | 'snoozed' | 'all' (default: 'active')
   * - clientId: optional filter by client
   * - limit: number of threads (default: 50)
   */
  app.get('/api/email-dashboard/threads', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user!.effectiveUserId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(403).json({ message: "User not found" });
      }
      
      if (!user.accessEmail) {
        return res.status(403).json({ 
          message: "Email access is not enabled for your account."
        });
      }
      
      const status = (req.query.status as string) || 'active';
      const clientId = req.query.clientId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      
      let threads: any[] = [];
      
      if (status === 'all') {
        threads = await storage.getAllEmailThreads();
      } else if (status === 'active' || status === 'complete' || status === 'snoozed') {
        threads = await storage.getEmailThreadsBySlaStatus(status);
      } else {
        return res.status(400).json({ message: "Invalid status filter" });
      }
      
      // Filter by clientId if provided
      if (clientId) {
        threads = threads.filter(t => t.clientId === clientId);
      }
      
      // Limit results
      threads = threads.slice(0, limit);
      
      // Enrich with SLA calculation for each thread
      const enrichedThreads = await Promise.all(threads.map(async (thread) => {
        const slaInfo = await slaCalculationService.calculateSla(thread);
        
        // Get client info if linked
        let client = null;
        if (thread.clientId) {
          client = await storage.getClientById(thread.clientId);
        }
        
        return {
          ...thread,
          client: client ? { id: client.id, name: client.name } : null,
          sla: slaInfo ? {
            deadline: slaInfo.deadline,
            isBreached: slaInfo.isBreached,
            urgencyLevel: slaInfo.urgencyLevel,
            hoursRemaining: Math.round(slaInfo.hoursRemaining * 10) / 10,
            workingHoursRemaining: Math.round(slaInfo.workingHoursRemaining * 10) / 10
          } : null
        };
      }));
      
      res.json({
        threads: enrichedThreads,
        total: enrichedThreads.length
      });
      
    } catch (error: any) {
      console.error('[Email Dashboard] Error fetching threads:', error);
      res.status(500).json({ 
        message: "Failed to fetch email threads",
        error: error.message 
      });
    }
  });

  /**
   * GET /api/email-dashboard/stats
   * Get SLA statistics for the dashboard
   */
  app.get('/api/email-dashboard/stats', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user!.effectiveUserId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(403).json({ message: "User not found" });
      }
      
      if (!user.accessEmail) {
        return res.status(403).json({ 
          message: "Email access is not enabled for your account."
        });
      }
      
      const stats = await slaCalculationService.getSlaStats();
      const settings = await slaCalculationService.getSlaSettings();
      
      res.json({
        ...stats,
        settings: {
          responseDays: settings.slaResponseDays,
          workingDaysOnly: settings.slaWorkingDaysOnly,
          workingHoursStart: settings.workingHoursStart,
          workingHoursEnd: settings.workingHoursEnd,
          workingDays: settings.workingDays
        }
      });
      
    } catch (error: any) {
      console.error('[Email Dashboard] Error fetching stats:', error);
      res.status(500).json({ 
        message: "Failed to fetch SLA stats",
        error: error.message 
      });
    }
  });

  /**
   * PATCH /api/email-dashboard/threads/:threadId/complete
   * Mark a thread as complete (zero-inbox workflow)
   */
  app.patch('/api/email-dashboard/threads/:threadId/complete', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const userId = req.user!.effectiveUserId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(403).json({ message: "User not found" });
      }
      
      if (!user.accessEmail) {
        return res.status(403).json({ 
          message: "Email access is not enabled for your account."
        });
      }
      
      const thread = await slaCalculationService.markComplete(threadId, userId);
      
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }
      
      res.json({
        success: true,
        thread
      });
      
    } catch (error: any) {
      console.error('[Email Dashboard] Error marking thread complete:', error);
      res.status(500).json({ 
        message: "Failed to mark thread complete",
        error: error.message 
      });
    }
  });

  /**
   * PATCH /api/email-dashboard/threads/:threadId/reopen
   * Reopen a completed thread (mark as active)
   */
  app.patch('/api/email-dashboard/threads/:threadId/reopen', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const userId = req.user!.effectiveUserId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(403).json({ message: "User not found" });
      }
      
      if (!user.accessEmail) {
        return res.status(403).json({ 
          message: "Email access is not enabled for your account."
        });
      }
      
      const thread = await slaCalculationService.transitionToActive(threadId, new Date());
      
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }
      
      res.json({
        success: true,
        thread
      });
      
    } catch (error: any) {
      console.error('[Email Dashboard] Error reopening thread:', error);
      res.status(500).json({ 
        message: "Failed to reopen thread",
        error: error.message 
      });
    }
  });

  /**
   * PATCH /api/email-dashboard/threads/:threadId/snooze
   * Snooze a thread until a specified date
   * 
   * Body:
   * - snoozeUntil: ISO date string
   */
  app.patch('/api/email-dashboard/threads/:threadId/snooze', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const userId = req.user!.effectiveUserId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(403).json({ message: "User not found" });
      }
      
      if (!user.accessEmail) {
        return res.status(403).json({ 
          message: "Email access is not enabled for your account."
        });
      }
      
      const snoozeSchema = z.object({
        snoozeUntil: z.string().datetime()
      });
      
      const validation = snoozeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: validation.error.errors
        });
      }
      
      const snoozeUntil = new Date(validation.data.snoozeUntil);
      
      if (snoozeUntil <= new Date()) {
        return res.status(400).json({ message: "Snooze date must be in the future" });
      }
      
      const thread = await slaCalculationService.snoozeThread(threadId, snoozeUntil);
      
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }
      
      res.json({
        success: true,
        thread
      });
      
    } catch (error: any) {
      console.error('[Email Dashboard] Error snoozing thread:', error);
      res.status(500).json({ 
        message: "Failed to snooze thread",
        error: error.message 
      });
    }
  });

  /**
   * GET /api/email-dashboard/threads/:threadId
   * Get a single thread with all messages and SLA info
   */
  app.get('/api/email-dashboard/threads/:threadId', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const userId = req.user!.effectiveUserId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(403).json({ message: "User not found" });
      }
      
      if (!user.accessEmail) {
        return res.status(403).json({ 
          message: "Email access is not enabled for your account."
        });
      }
      
      const thread = await storage.getEmailThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }
      
      // Get all messages in this thread
      const messages = await storage.getEmailMessagesByThreadId(threadId);
      
      // Sort messages by sent time (oldest first for conversation view)
      messages.sort((a, b) => 
        new Date(a.sentDateTime || a.receivedDateTime).getTime() - 
        new Date(b.sentDateTime || b.receivedDateTime).getTime()
      );
      
      // Get SLA info
      const slaInfo = await slaCalculationService.calculateSla(thread);
      
      // Get client info if linked
      let client = null;
      if (thread.clientId) {
        client = await storage.getClientById(thread.clientId);
      }
      
      // Get attachments for each message
      const messagesWithAttachments = await Promise.all(messages.map(async (msg) => {
        const attachments = await storage.getAttachmentsByMessageId(msg.internetMessageId);
        return {
          ...msg,
          attachments: attachments.map(att => ({
            id: att.id,
            filename: att.fileName,
            contentType: att.contentType,
            size: att.fileSize
          }))
        };
      }));
      
      res.json({
        thread: {
          ...thread,
          client: client ? { id: client.id, name: client.name } : null,
          sla: slaInfo ? {
            deadline: slaInfo.deadline,
            isBreached: slaInfo.isBreached,
            urgencyLevel: slaInfo.urgencyLevel,
            hoursRemaining: Math.round(slaInfo.hoursRemaining * 10) / 10,
            workingHoursRemaining: Math.round(slaInfo.workingHoursRemaining * 10) / 10
          } : null
        },
        messages: messagesWithAttachments
      });
      
    } catch (error: any) {
      console.error('[Email Dashboard] Error fetching thread:', error);
      res.status(500).json({ 
        message: "Failed to fetch thread",
        error: error.message 
      });
    }
  });
}
