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
  content: z.string().min(1, "Reply content is required"),
  isHtml: z.boolean().optional().default(true),
  isReplyAll: z.boolean().optional().default(false),
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
   * - content: The reply content (HTML or plain text)
   * - isHtml: Whether the content is HTML (default: true)
   * - isReplyAll: Whether to reply to all recipients (default: false)
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
      
      const { content, isHtml, isReplyAll } = validation.data;
      
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
      
      // Send reply via Microsoft Graph API
      // The Graph API /reply and /replyAll actions send immediately and return 202 Accepted
      if (isReplyAll) {
        await createReplyAllToMessage(userId, graphMessageId, content, isHtml);
      } else {
        await createReplyToMessage(userId, graphMessageId, content, isHtml);
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
   * Get all messages in an email thread
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
      
      // Filter to only messages the user has access to
      const accessibleMessages = [];
      for (const message of messages) {
        const hasAccess = await storage.userHasAccessToMessage(userId, message.id);
        if (hasAccess) {
          accessibleMessages.push(message);
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
}
