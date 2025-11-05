import type { Express } from "express";
import { storage } from "../storage";
import { createReplyToMessage, createReplyAllToMessage } from "../utils/userOutlookClient";
import { z } from "zod";

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
      
      // Send reply via Microsoft Graph API with attachments and custom recipients/subject
      if (replyAll) {
        await createReplyAllToMessage(userId, graphMessageId, body, true, subject, to, cc, attachments);
      } else {
        await createReplyToMessage(userId, graphMessageId, body, true, subject, to, cc, attachments);
      }
      
      res.json({
        success: true,
        message: "Reply sent successfully. It will appear in your Sent Items shortly."
      });
    } catch (error) {
      console.error('Error sending email reply:', error);
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
}
