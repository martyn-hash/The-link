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
import { insertInboxSchema, insertUserInboxAccessSchema } from "@shared/schema";

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
  resolveEffectiveUser: any,
  requireSuperAdmin: any
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

  // ========== INBOX MANAGEMENT ROUTES ==========

  /**
   * GET /api/inboxes
   * Get all inboxes (super admin only)
   */
  app.get('/api/inboxes', isAuthenticated, resolveEffectiveUser, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const allInboxes = await storage.getAllInboxes();
      res.json(allInboxes);
    } catch (error: any) {
      console.error('[Get Inboxes] Error:', error);
      res.status(500).json({ message: "Failed to fetch inboxes", error: error.message });
    }
  });

  /**
   * GET /api/inboxes/:id
   * Get a specific inbox by ID
   */
  app.get('/api/inboxes/:id', isAuthenticated, resolveEffectiveUser, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const inbox = await storage.getInboxById(req.params.id);
      if (!inbox) {
        return res.status(404).json({ message: "Inbox not found" });
      }

      res.json(inbox);
    } catch (error: any) {
      console.error('[Get Inbox] Error:', error);
      res.status(500).json({ message: "Failed to fetch inbox", error: error.message });
    }
  });

  /**
   * POST /api/inboxes
   * Create a new inbox (super admin only)
   * Used for adding shared mailboxes like payroll@company.com
   */
  app.post('/api/inboxes', isAuthenticated, resolveEffectiveUser, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const createInboxSchema = z.object({
        emailAddress: z.string().email("Invalid email address"),
        displayName: z.string().optional(),
        inboxType: z.enum(['user', 'shared', 'functional']).optional().default('shared'),
        azureUserId: z.string().optional(),
      });

      const validation = createInboxSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: validation.error.errors
        });
      }

      const { emailAddress, displayName, inboxType, azureUserId } = validation.data;

      // Check if inbox already exists
      const existing = await storage.getInboxByEmailAddress(emailAddress);
      if (existing) {
        return res.status(400).json({ message: "An inbox with this email address already exists" });
      }

      const inbox = await storage.createInbox({
        emailAddress: emailAddress.toLowerCase(),
        displayName: displayName || emailAddress,
        inboxType,
        azureUserId,
        isActive: true,
      });

      res.status(201).json(inbox);
    } catch (error: any) {
      console.error('[Create Inbox] Error:', error);
      res.status(500).json({ message: "Failed to create inbox", error: error.message });
    }
  });

  /**
   * PATCH /api/inboxes/:id
   * Update an inbox (super admin only)
   */
  app.patch('/api/inboxes/:id', isAuthenticated, resolveEffectiveUser, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const inbox = await storage.getInboxById(req.params.id);
      if (!inbox) {
        return res.status(404).json({ message: "Inbox not found" });
      }

      const updateInboxSchema = z.object({
        displayName: z.string().optional(),
        inboxType: z.enum(['user', 'shared', 'functional']).optional(),
        azureUserId: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      });

      const validation = updateInboxSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: validation.error.errors
        });
      }

      const updated = await storage.updateInbox(req.params.id, validation.data);
      res.json(updated);
    } catch (error: any) {
      console.error('[Update Inbox] Error:', error);
      res.status(500).json({ message: "Failed to update inbox", error: error.message });
    }
  });

  /**
   * DELETE /api/inboxes/:id
   * Delete an inbox (super admin only)
   */
  app.delete('/api/inboxes/:id', isAuthenticated, resolveEffectiveUser, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const inbox = await storage.getInboxById(req.params.id);
      if (!inbox) {
        return res.status(404).json({ message: "Inbox not found" });
      }

      // Prevent deletion of user-linked inboxes
      if (inbox.linkedUserId) {
        return res.status(400).json({ 
          message: "Cannot delete an inbox linked to a user. Remove the user link first." 
        });
      }

      await storage.deleteInbox(req.params.id);
      res.json({ success: true, message: "Inbox deleted" });
    } catch (error: any) {
      console.error('[Delete Inbox] Error:', error);
      res.status(500).json({ message: "Failed to delete inbox", error: error.message });
    }
  });

  /**
   * GET /api/inboxes/:id/access
   * Get all users with access to a specific inbox
   */
  app.get('/api/inboxes/:id/access', isAuthenticated, resolveEffectiveUser, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const inbox = await storage.getInboxById(req.params.id);
      if (!inbox) {
        return res.status(404).json({ message: "Inbox not found" });
      }

      const accessRecords = await storage.getInboxAccessByInboxId(req.params.id);
      res.json(accessRecords);
    } catch (error: any) {
      console.error('[Get Inbox Access] Error:', error);
      res.status(500).json({ message: "Failed to fetch inbox access", error: error.message });
    }
  });

  // ========== USER INBOX ACCESS ROUTES ==========

  /**
   * GET /api/users/:userId/inbox-access
   * Get all inboxes a user has access to
   * Users can view their own inbox access, super admins can view anyone's
   */
  app.get('/api/users/:userId/inbox-access', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user!.effectiveUserId;

      // Users can view their own inbox access
      if (currentUserId === userId) {
        const accessRecords = await storage.getInboxAccessByUserId(userId);
        return res.json(accessRecords);
      }

      // For viewing other users' inbox access, require super admin
      const currentUser = await storage.getUser(currentUserId);
      if (!currentUser?.superAdmin) {
        return res.status(403).json({ message: "Super admin access required to view other users' inbox access" });
      }

      const accessRecords = await storage.getInboxAccessByUserId(userId);
      res.json(accessRecords);
    } catch (error: any) {
      console.error('[Get User Inbox Access] Error:', error);
      res.status(500).json({ message: "Failed to fetch user inbox access", error: error.message });
    }
  });

  /**
   * POST /api/users/:userId/inbox-access
   * Grant a user access to an inbox (super admin only)
   */
  app.post('/api/users/:userId/inbox-access', isAuthenticated, resolveEffectiveUser, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const grantedById = req.user!.effectiveUserId;

      const grantAccessSchema = z.object({
        inboxId: z.string().min(1, "Inbox ID is required"),
        accessLevel: z.enum(['read', 'write', 'full']).optional().default('read'),
      });

      const validation = grantAccessSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: validation.error.errors
        });
      }

      const { inboxId, accessLevel } = validation.data;

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify inbox exists
      const inbox = await storage.getInboxById(inboxId);
      if (!inbox) {
        return res.status(404).json({ message: "Inbox not found" });
      }

      // Check if access already exists
      const existing = await storage.getUserInboxAccessByUserAndInbox(userId, inboxId);
      if (existing) {
        // Update existing access
        const updated = await storage.updateUserInboxAccess(existing.id, { accessLevel, grantedBy: grantedById });
        return res.json({ ...updated, inbox });
      }

      // Create new access
      const access = await storage.grantInboxAccess(userId, inboxId, accessLevel, grantedById);
      res.status(201).json({ ...access, inbox });
    } catch (error: any) {
      console.error('[Grant Inbox Access] Error:', error);
      res.status(500).json({ message: "Failed to grant inbox access", error: error.message });
    }
  });

  /**
   * POST /api/users/:userId/inbox-access/bulk
   * Grant a user access to multiple inboxes at once (super admin only)
   */
  app.post('/api/users/:userId/inbox-access/bulk', isAuthenticated, resolveEffectiveUser, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const grantedById = req.user!.effectiveUserId;

      const bulkGrantSchema = z.object({
        inboxIds: z.array(z.string().min(1)).min(1, "At least one inbox is required"),
        accessLevel: z.enum(['read', 'write', 'full']).optional().default('read'),
      });

      const validation = bulkGrantSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: validation.error.errors
        });
      }

      const { inboxIds, accessLevel } = validation.data;

      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const results: any[] = [];
      const errors: any[] = [];

      for (const inboxId of inboxIds) {
        try {
          // Verify inbox exists
          const inbox = await storage.getInboxById(inboxId);
          if (!inbox) {
            errors.push({ inboxId, error: "Inbox not found" });
            continue;
          }

          // Check if access already exists
          const existing = await storage.getUserInboxAccessByUserAndInbox(userId, inboxId);
          if (existing) {
            // Update existing access
            const updated = await storage.updateUserInboxAccess(existing.id, { accessLevel, grantedBy: grantedById });
            results.push({ ...updated, inbox });
          } else {
            // Create new access
            const access = await storage.grantInboxAccess(userId, inboxId, accessLevel, grantedById);
            results.push({ ...access, inbox });
          }
        } catch (err: any) {
          errors.push({ inboxId, error: err.message });
        }
      }

      res.status(201).json({ 
        success: true, 
        granted: results.length, 
        failed: errors.length,
        results,
        errors 
      });
    } catch (error: any) {
      console.error('[Bulk Grant Inbox Access] Error:', error);
      res.status(500).json({ message: "Failed to grant inbox access", error: error.message });
    }
  });

  /**
   * DELETE /api/users/:userId/inbox-access/:inboxId
   * Revoke a user's access to an inbox (super admin only)
   */
  app.delete('/api/users/:userId/inbox-access/:inboxId', isAuthenticated, resolveEffectiveUser, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { userId, inboxId } = req.params;

      // Verify the access exists
      const access = await storage.getUserInboxAccessByUserAndInbox(userId, inboxId);
      if (!access) {
        return res.status(404).json({ message: "Inbox access not found" });
      }

      // Check if this is the user's own inbox - don't allow revoking self-access
      const inbox = await storage.getInboxById(inboxId);
      if (inbox?.linkedUserId === userId) {
        return res.status(400).json({ 
          message: "Cannot revoke a user's access to their own inbox" 
        });
      }

      await storage.revokeInboxAccess(userId, inboxId);
      res.json({ success: true, message: "Inbox access revoked" });
    } catch (error: any) {
      console.error('[Revoke Inbox Access] Error:', error);
      res.status(500).json({ message: "Failed to revoke inbox access", error: error.message });
    }
  });

  /**
   * GET /api/my-inboxes
   * Get the current user's accessible inboxes
   */
  app.get('/api/my-inboxes', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user!.effectiveUserId;
      const accessRecords = await storage.getInboxAccessByUserId(userId);
      res.json(accessRecords);
    } catch (error: any) {
      console.error('[Get My Inboxes] Error:', error);
      res.status(500).json({ message: "Failed to fetch your inboxes", error: error.message });
    }
  });

  /**
   * GET /api/comms/inbox/:inboxId/messages
   * Fetch emails from a specific inbox the user has access to
   * Queries Microsoft Graph API directly for fresh email data
   */
  app.get('/api/comms/inbox/:inboxId/messages', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user!.effectiveUserId;
      const { inboxId } = req.params;
      const { top = '25', skip = '0', folder = 'Inbox' } = req.query;

      // Verify user has access to this inbox
      const hasAccess = await storage.canUserAccessInbox(userId, inboxId);
      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this inbox" });
      }

      // Get the inbox to find the email address
      const inbox = await storage.getInboxById(inboxId);
      if (!inbox) {
        return res.status(404).json({ message: "Inbox not found" });
      }

      // Check if Graph API is configured
      if (!isApplicationGraphConfigured()) {
        return res.status(400).json({
          message: "Microsoft 365 email integration is not configured"
        });
      }

      // Fetch messages from Graph API
      const { getApplicationGraphClient } = await import('../utils/applicationGraphClient');
      const client = await getApplicationGraphClient();
      
      const emailAddress = inbox.emailAddress;
      const topNum = Math.min(parseInt(top as string) || 25, 50);
      const skipNum = parseInt(skip as string) || 0;

      const response = await client
        .api(`/users/${encodeURIComponent(emailAddress)}/mailFolders/${folder}/messages`)
        .select('id,subject,from,toRecipients,receivedDateTime,bodyPreview,hasAttachments,isRead,importance')
        .orderby('receivedDateTime DESC')
        .top(topNum)
        .skip(skipNum)
        .get();

      const messages = response.value || [];
      const nextLink = response['@odata.nextLink'];

      res.json({
        messages,
        hasMore: !!nextLink,
        total: response['@odata.count'] || null,
        inbox: {
          id: inbox.id,
          email: inbox.emailAddress,
          displayName: inbox.displayName,
        }
      });
    } catch (error: any) {
      console.error('[Comms Inbox Messages] Error:', error);
      
      // Handle Graph API specific errors
      if (error.code === 'MailboxNotEnabledForRESTAPI') {
        return res.status(400).json({ 
          message: "This mailbox is not enabled for email access" 
        });
      }
      if (error.code === 'ErrorItemNotFound') {
        return res.status(404).json({ 
          message: "Mailbox or folder not found" 
        });
      }
      
      res.status(500).json({ 
        message: "Failed to fetch emails", 
        error: error.message 
      });
    }
  });

  /**
   * GET /api/comms/inbox/:inboxId/messages/:messageId
   * Fetch a single email message with full body content
   */
  app.get('/api/comms/inbox/:inboxId/messages/:messageId', isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const userId = req.user!.effectiveUserId;
      const { inboxId, messageId } = req.params;

      // Verify user has access to this inbox
      const hasAccess = await storage.canUserAccessInbox(userId, inboxId);
      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this inbox" });
      }

      // Get the inbox to find the email address
      const inbox = await storage.getInboxById(inboxId);
      if (!inbox) {
        return res.status(404).json({ message: "Inbox not found" });
      }

      // Check if Graph API is configured
      if (!isApplicationGraphConfigured()) {
        return res.status(400).json({
          message: "Microsoft 365 email integration is not configured"
        });
      }

      // Fetch the full message from Graph API
      const { getApplicationGraphClient } = await import('../utils/applicationGraphClient');
      const client = await getApplicationGraphClient();
      
      const emailAddress = inbox.emailAddress;

      const message = await client
        .api(`/users/${encodeURIComponent(emailAddress)}/messages/${messageId}`)
        .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,body,bodyPreview,hasAttachments,isRead,importance,conversationId')
        .expand('attachments($select=id,name,size,contentType,isInline)')
        .get();

      res.json(message);
    } catch (error: any) {
      console.error('[Comms Get Message] Error:', error);
      
      if (error.code === 'ErrorItemNotFound') {
        return res.status(404).json({ 
          message: "Message not found" 
        });
      }
      
      res.status(500).json({ 
        message: "Failed to fetch email", 
        error: error.message 
      });
    }
  });

  /**
   * POST /api/inboxes/sync-users
   * Sync inboxes with all users (create inbox records for users who don't have one)
   * Super admin only
   */
  app.post('/api/inboxes/sync-users', isAuthenticated, resolveEffectiveUser, requireSuperAdmin, async (req: any, res: any) => {
    try {
      // Get all users with email addresses
      const users = await storage.getAllUsers();
      let created = 0;
      let skipped = 0;
      let accessGranted = 0;

      for (const user of users) {
        if (!user.email) {
          skipped++;
          continue;
        }

        // Check if inbox already exists for this user
        const existingInbox = await storage.getInboxByEmailAddress(user.email);
        
        if (!existingInbox) {
          // Create inbox for user
          const inbox = await storage.createInbox({
            emailAddress: user.email.toLowerCase(),
            displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            inboxType: 'user',
            linkedUserId: user.id,
            isActive: true,
          });
          
          // Grant user access to their own inbox
          await storage.grantInboxAccess(user.id, inbox.id, 'full', req.user.effectiveUserId);
          created++;
          accessGranted++;
        } else {
          // Check if user has access to their inbox
          const hasAccess = await storage.canUserAccessInbox(user.id, existingInbox.id);
          if (!hasAccess) {
            await storage.grantInboxAccess(user.id, existingInbox.id, 'full', req.user.effectiveUserId);
            accessGranted++;
          }
          
          // Update linked user if not set
          if (!existingInbox.linkedUserId) {
            await storage.updateInbox(existingInbox.id, { linkedUserId: user.id });
          }
        }
      }

      res.json({
        success: true,
        message: `Synced inboxes for ${users.length} users`,
        created,
        skipped,
        accessGranted,
      });
    } catch (error: any) {
      console.error('[Sync User Inboxes] Error:', error);
      res.status(500).json({ message: "Failed to sync user inboxes", error: error.message });
    }
  });
}
