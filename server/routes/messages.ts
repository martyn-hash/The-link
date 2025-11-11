import type { Express } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "../objectStorage";
import { sendPushNotificationToMultiple, type PushNotificationPayload } from "../push-service";
import { validateFileUpload, MAX_FILE_SIZE } from "../utils/fileValidation";
import { createDocumentsFromAttachments } from "../utils/documentHelpers";
import { sendNewStaffMessageNotification, sendNewClientMessageNotification } from "../notification-template-service";
import {
  insertCommunicationSchema,
} from "@shared/schema";
import {
  paramClientIdSchema,
  paramPersonIdSchema,
  validateParams,
} from "./routeHelpers";

// Communications parameter validation schemas
const paramCommunicationIdSchema = z.object({
  communicationId: z.string().min(1, "Communication ID is required").uuid("Invalid communication ID format")
});

export function registerMessageRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  verifyMessageAttachmentAccess: any,
  verifyThreadAccess: any
): void {
  // Helper function to check if user has access to client
  const userHasClientAccess = async (userId: string, clientId: string, isAdmin: boolean = false): Promise<boolean> => {
    // Admins have access to all clients
    if (isAdmin) {
      return true;
    }

    // Check if client exists
    const client = await storage.getClientById(clientId);
    if (!client) {
      return false;
    }

    // For now, implement basic access control - could be enhanced based on business rules
    // This is a placeholder for actual client-user relationship checks
    // In a real application, you might check:
    // - User is assigned to client account
    // - User has role permissions for this client
    // - Client belongs to user's organization/team

    // As a basic implementation, only admins can access all clients
    // Non-admin users need explicit permission (to be implemented)
    return false; // Restrict access for non-admins until proper permissions are implemented
  };

  // ==================================================
  // COMMUNICATIONS API ROUTES
  // ==================================================

  // GET /api/communications - Get all communications (admin only)
  app.get("/api/communications", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const communications = await storage.getAllCommunications();
      res.json(communications);
    } catch (error) {
      console.error("Error fetching communications:", error);
      res.status(500).json({ message: "Failed to fetch communications" });
    }
  });

  // GET /api/communications/client/:clientId - Get communications for a specific client
  app.get("/api/communications/client/:clientId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramsValidation = validateParams(paramClientIdSchema, req.params);
      if (!paramsValidation.success) {
        return res.status(400).json({
          message: "Invalid client ID",
          errors: paramsValidation.errors
        });
      }

      const { clientId } = paramsValidation.data;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      // Enforce per-client authorization
      const hasAccess = await userHasClientAccess(effectiveUserId, clientId, req.user.isAdmin);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied. You don't have permission to view communications for this client." });
      }

      const communications = await storage.getCommunicationsByClientId(clientId);
      res.json(communications);
    } catch (error) {
      console.error("Error fetching client communications:", error);
      res.status(500).json({ message: "Failed to fetch client communications" });
    }
  });

  // GET /api/communications/person/:personId - Get communications for a specific person
  app.get("/api/communications/person/:personId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramsValidation = validateParams(paramPersonIdSchema, req.params);
      if (!paramsValidation.success) {
        return res.status(400).json({
          message: "Invalid person ID",
          errors: paramsValidation.errors
        });
      }

      const { personId } = paramsValidation.data;
      const communications = await storage.getCommunicationsByPersonId(personId);
      res.json(communications);
    } catch (error) {
      console.error("Error fetching person communications:", error);
      res.status(500).json({ message: "Failed to fetch person communications" });
    }
  });

  // GET /api/communications/:communicationId - Get a specific communication
  app.get("/api/communications/:communicationId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramsValidation = validateParams(paramCommunicationIdSchema, req.params);
      if (!paramsValidation.success) {
        return res.status(400).json({
          message: "Invalid communication ID",
          errors: paramsValidation.errors
        });
      }

      const { communicationId } = paramsValidation.data;
      const communication = await storage.getCommunicationById(communicationId);

      if (!communication) {
        return res.status(404).json({ message: "Communication not found" });
      }

      res.json(communication);
    } catch (error) {
      console.error("Error fetching communication:", error);
      res.status(500).json({ message: "Failed to fetch communication" });
    }
  });

  // POST /api/communications - Create a new communication
  app.post("/api/communications", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Validate request body but ignore userId (will be set from auth context)
      const bodyValidation = insertCommunicationSchema.omit({ userId: true }).safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid communication data",
          errors: bodyValidation.error.issues
        });
      }

      const communicationData = bodyValidation.data;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      // All authenticated users can create communications (progress notes)
      // Force userId from authenticated context (prevent spoofing)
      const communication = await storage.createCommunication({
        ...communicationData,
        userId: effectiveUserId,
      });

      // Fetch the full communication with relations
      const fullCommunication = await storage.getCommunicationById(communication.id);
      res.json(fullCommunication);
    } catch (error) {
      console.error("Error creating communication:", error);
      res.status(500).json({ message: "Failed to create communication" });
    }
  });

  // PUT /api/communications/:communicationId - Update a communication
  app.put("/api/communications/:communicationId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramsValidation = validateParams(paramCommunicationIdSchema, req.params);
      if (!paramsValidation.success) {
        return res.status(400).json({
          message: "Invalid communication ID",
          errors: paramsValidation.errors
        });
      }

      const partialSchema = insertCommunicationSchema.partial();
      const bodyValidation = partialSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid communication data",
          errors: bodyValidation.error.issues
        });
      }

      const { communicationId } = paramsValidation.data;
      const updateData = bodyValidation.data;

      // Ensure the communication exists and user has permission
      const existingCommunication = await storage.getCommunicationById(communicationId);
      if (!existingCommunication) {
        return res.status(404).json({ message: "Communication not found" });
      }

      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      // Check both communication ownership AND client access
      const hasClientAccess = await userHasClientAccess(effectiveUserId, existingCommunication.clientId, req.user.isAdmin);
      if (!hasClientAccess) {
        return res.status(403).json({ message: "Access denied. You don't have permission to access this client's communications." });
      }

      if (existingCommunication.userId !== effectiveUserId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized to update this communication" });
      }

      const communication = await storage.updateCommunication(communicationId, updateData);

      // Fetch the full communication with relations
      const fullCommunication = await storage.getCommunicationById(communication.id);
      res.json(fullCommunication);
    } catch (error) {
      console.error("Error updating communication:", error);
      res.status(500).json({ message: "Failed to update communication" });
    }
  });

  // DELETE /api/communications/:communicationId - Delete a communication
  app.delete("/api/communications/:communicationId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const paramsValidation = validateParams(paramCommunicationIdSchema, req.params);
      if (!paramsValidation.success) {
        return res.status(400).json({
          message: "Invalid communication ID",
          errors: paramsValidation.errors
        });
      }

      const { communicationId } = paramsValidation.data;

      // Ensure the communication exists and user has permission
      const existingCommunication = await storage.getCommunicationById(communicationId);
      if (!existingCommunication) {
        return res.status(404).json({ message: "Communication not found" });
      }

      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      // Check both communication ownership AND client access
      const hasClientAccess = await userHasClientAccess(effectiveUserId, existingCommunication.clientId, req.user.isAdmin);
      if (!hasClientAccess) {
        return res.status(403).json({ message: "Access denied. You don't have permission to access this client's communications." });
      }

      if (existingCommunication.userId !== effectiveUserId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized to delete this communication" });
      }

      await storage.deleteCommunication(communicationId);
      res.json({ message: "Communication deleted successfully" });
    } catch (error) {
      console.error("Error deleting communication:", error);
      res.status(500).json({ message: "Failed to delete communication" });
    }
  });

  // ==================================================
  // INTERNAL STAFF MESSAGING ROUTES (OIDC Auth Required)
  // ==================================================

  // Get all threads for staff (filtered by user's assigned projects)
  app.get("/api/internal/messages/threads", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;
      const status = req.query.status as string | undefined;

      // Get all threads - filtering will be done based on user's project assignments
      const allThreads = await storage.getAllMessageThreads({ status });

      // Filter threads based on user access
      let accessibleThreads = allThreads;
      if (!isAdmin) {
        const threadIds = allThreads.map(t => t.id);
        const accessibleThreadIds = new Set<string>();

        // Check each thread's client for user access
        for (const thread of allThreads) {
          const hasAccess = await userHasClientAccess(effectiveUserId, thread.clientId, isAdmin);
          if (hasAccess) {
            accessibleThreadIds.add(thread.id);
          }
        }

        accessibleThreads = allThreads.filter(t => accessibleThreadIds.has(t.id));
      }

      // Enrich threads with client portal user, client information, and last message details
      const enrichedThreads = await Promise.all(
        accessibleThreads.map(async (thread) => {
          const client = await storage.getClientById(thread.clientId);
          let clientPortalUser = null;

          if (thread.createdByClientPortalUserId) {
            const cpUser = await storage.getClientPortalUserById(thread.createdByClientPortalUserId);
            if (cpUser) {
              clientPortalUser = {
                id: cpUser.id,
                email: cpUser.email,
                clientId: cpUser.clientId,
                personId: cpUser.personId,
                client: client ? { id: client.id, name: client.name } : undefined
              };
            }
          }

          // Get last message details
          const lastMessage = await storage.getLastMessageForThread(thread.id);
          const hasUnreadMessages = await storage.hasUnreadMessagesForStaff(thread.id);

          return {
            ...thread,
            clientPortalUser,
            lastMessageContent: lastMessage?.content || null,
            lastMessageSenderName: lastMessage?.senderName || null,
            hasUnreadMessages,
          };
        })
      );

      res.json(enrichedThreads);
    } catch (error) {
      console.error("Error fetching threads:", error);
      res.status(500).json({ message: "Failed to fetch threads" });
    }
  });

  // Get specific thread for staff
  app.get("/api/internal/messages/threads/:threadId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;

      const thread = await storage.getMessageThreadById(threadId);

      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      const hasAccess = await userHasClientAccess(effectiveUserId, thread.clientId, isAdmin);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(thread);
    } catch (error) {
      console.error("Error fetching thread:", error);
      res.status(500).json({ message: "Failed to fetch thread" });
    }
  });

  // Create a new thread (staff only)
  app.post("/api/internal/messages/threads", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;
      const { subject, clientId, projectId, serviceId } = req.body;

      if (!subject) {
        return res.status(400).json({ message: "Subject is required" });
      }

      if (!clientId) {
        return res.status(400).json({ message: "Client is required" });
      }

      // Verify user has access to this client
      const hasAccess = await userHasClientAccess(effectiveUserId, clientId, isAdmin);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const thread = await storage.createMessageThread({
        subject,
        clientId,
        createdByUserId: effectiveUserId,
        projectId: projectId || null,
        serviceId: serviceId || null,
        status: 'open'
      });

      res.status(201).json(thread);
    } catch (error) {
      console.error("Error creating thread:", error);
      res.status(500).json({ message: "Failed to create thread" });
    }
  });

  // Get messages for a thread (staff)
  app.get("/api/internal/messages/threads/:threadId/messages", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;

      const thread = await storage.getMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      const hasAccess = await userHasClientAccess(effectiveUserId, thread.clientId, isAdmin);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const messages = await storage.getMessagesByThreadId(threadId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Reply to thread (staff)
  app.post("/api/internal/messages/threads/:threadId/messages", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;
      const { content, attachments } = req.body;

      if (!content && (!attachments || attachments.length === 0)) {
        return res.status(400).json({ message: "Content or attachments are required" });
      }

      const thread = await storage.getMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      const hasAccess = await userHasClientAccess(effectiveUserId, thread.clientId, isAdmin);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const message = await storage.createMessage({
        threadId,
        content: content || '',
        userId: effectiveUserId,
        attachments: attachments || null,
        isReadByStaff: true,
        isReadByClient: false
      });

      // Auto-create document records for attachments
      if (attachments && attachments.length > 0) {
        await createDocumentsFromAttachments({
          clientId: thread.clientId,
          messageId: message.id,
          threadId,
          attachments,
          uploadedBy: effectiveUserId,
        });
      }

      // Send push notifications to portal users using template service
      try {
        const portalUsers = await storage.getClientPortalUsersByClientId(thread.clientId);
        const allSubscriptions: any[] = [];

        for (const portalUser of portalUsers) {
          // Only send to users who have push notifications enabled
          if (portalUser.pushNotificationsEnabled) {
            const subs = await storage.getPushSubscriptionsByClientPortalUserId(portalUser.id);
            allSubscriptions.push(...subs);
          }
        }

        if (allSubscriptions.length > 0) {
          const sender = await storage.getUser(effectiveUserId);
          const senderName = sender ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.email : 'Staff';

          let body = content || '';
          if (attachments && attachments.length > 0) {
            body = body ? `${body} (${attachments.length} attachment${attachments.length > 1 ? 's' : ''})` : `Sent ${attachments.length} attachment${attachments.length > 1 ? 's' : ''}`;
          }
          body = body.length > 100 ? body.substring(0, 100) + '...' : body;

          const payload: PushNotificationPayload = {
            title: `New message from ${senderName}`,
            body,
            icon: '/pwa-icon-192.png',
            badge: '/pwa-icon-192.png',
            tag: `message-${message.id}`,
            url: `/portal/threads/${threadId}`
          };

          const result = await sendPushNotificationToMultiple(
            allSubscriptions.map(sub => ({
              endpoint: sub.endpoint,
              keys: sub.keys as { p256dh: string; auth: string }
            })),
            payload
          );

          console.log(`[Push] Sent notification to ${result.successful}/${allSubscriptions.length} portal user subscriptions`);

          // Clean up expired subscriptions
          if (result.expiredSubscriptions.length > 0) {
            for (const endpoint of result.expiredSubscriptions) {
              await storage.deletePushSubscription(endpoint);
            }
          }
        }
      } catch (pushError) {
        console.error('[Push] Error sending notifications to portal users:', pushError);
        // Don't fail the message send if push fails
      }

      res.status(201).json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Update thread status (staff)
  app.put("/api/internal/messages/threads/:threadId/status", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;
      const { status } = req.body;

      if (!status || !['new', 'in_progress', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const thread = await storage.getMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      const hasAccess = await userHasClientAccess(effectiveUserId, thread.clientId, isAdmin);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedThread = await storage.updateMessageThread(threadId, { status });
      res.json(updatedThread);
    } catch (error) {
      console.error("Error updating thread status:", error);
      res.status(500).json({ message: "Failed to update thread status" });
    }
  });

  // Mark thread as read for staff
  app.put("/api/internal/messages/threads/:threadId/mark-read", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;

      const thread = await storage.getMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      const hasAccess = await userHasClientAccess(effectiveUserId, thread.clientId, isAdmin);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.markMessagesAsReadByStaff(threadId);
      res.json({ message: "Marked as read" });
    } catch (error) {
      console.error("Error marking thread as read:", error);
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  // Get unread count for staff
  app.get("/api/internal/messages/unread-count", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;

      const count = await storage.getUnreadMessageCountForStaff(effectiveUserId, isAdmin);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  // Archive thread (staff only)
  app.put("/api/internal/messages/threads/:threadId/archive", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;

      const thread = await storage.getMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      const hasAccess = await userHasClientAccess(effectiveUserId, thread.clientId, isAdmin);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedThread = await storage.updateMessageThread(threadId, {
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: effectiveUserId,
      });
      res.json(updatedThread);
    } catch (error) {
      console.error("Error archiving thread:", error);
      res.status(500).json({ message: "Failed to archive thread" });
    }
  });

  // Unarchive thread (staff only)
  app.put("/api/internal/messages/threads/:threadId/unarchive", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;

      const thread = await storage.getMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      const hasAccess = await userHasClientAccess(effectiveUserId, thread.clientId, isAdmin);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedThread = await storage.updateMessageThread(threadId, {
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
      });
      res.json(updatedThread);
    } catch (error) {
      console.error("Error unarchiving thread:", error);
      res.status(500).json({ message: "Failed to unarchive thread" });
    }
  });

  // Generate presigned URL for message attachment upload (staff)
  app.post("/api/internal/messages/attachments/upload-url", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { fileName, fileType, fileSize } = req.body;

      if (!fileName || !fileType) {
        return res.status(400).json({ message: "fileName and fileType are required" });
      }

      // Server-side validation
      const validation = validateFileUpload(fileName, fileType, fileSize || 0, MAX_FILE_SIZE);
      if (!validation.isValid) {
        return res.status(400).json({ message: validation.error });
      }

      const objectStorageService = new ObjectStorageService();
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL();

      res.json({
        url: uploadURL,
        objectPath,
        fileName,
        fileType,
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // Serve message attachments with thread access check (staff)
  app.get("/api/internal/messages/attachments/*", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Extract the object path from the URL
      const objectPath = req.path.replace('/api/internal/messages/attachments', '/objects');

      // Get the thread ID from query params
      const threadId = req.query.threadId;
      if (!threadId) {
        return res.status(400).json({ message: "threadId query parameter is required" });
      }

      // Check if the thread exists
      const thread = await storage.getMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      // Check if the user has access to the client
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;
      const hasAccess = await userHasClientAccess(effectiveUserId, thread.clientId, isAdmin);

      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Serve the file without ACL check since we verified thread access
      const objectStorageService = new ObjectStorageService();
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
        objectStorageService.downloadObject(objectFile, res);
      } catch (error) {
        console.error("Error serving attachment:", error);
        if (error instanceof ObjectNotFoundError) {
          return res.status(404).json({ message: "Attachment not found" });
        }
        return res.status(500).json({ message: "Error serving attachment" });
      }
    } catch (error) {
      console.error("Error serving message attachment:", error);
      res.status(500).json({ message: "Failed to serve attachment" });
    }
  });

  // ==================================================
  // PROJECT MESSAGING ROUTES (Staff Only)
  // ==================================================

  // Get all threads the user participates in across all projects
  app.get("/api/project-messages/my-threads", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const includeArchived = req.query.includeArchived === 'true';

      const threads = await storage.getProjectMessageThreadsForUser(effectiveUserId, { includeArchived });
      
      res.json(threads);
    } catch (error) {
      console.error("Error fetching user's project message threads:", error);
      res.status(500).json({ message: "Failed to fetch threads" });
    }
  });

  // Get all threads for a project (only threads where user is a participant)
  // Supports pagination with cursor and limit query parameters
  app.get("/api/internal/project-messages/threads/:projectId", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      
      // Pagination parameters
      const limit = parseInt(req.query.limit as string) || 5;
      const cursor = req.query.cursor as string | undefined;

      // Check if user has access to this project
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;
      const hasAccess = await userHasClientAccess(effectiveUserId, project.clientId, isAdmin);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const allThreads = await storage.getProjectMessageThreadsByProjectId(projectId);

      // Filter to only threads where the user is a participant
      const userThreads = [];
      for (const thread of allThreads) {
        const participants = await storage.getProjectMessageParticipantsByThreadId(thread.id);
        const isParticipant = participants.some(p => p.userId === effectiveUserId);
        if (isParticipant) {
          userThreads.push(thread);
        }
      }

      // Sort threads by lastMessageAt descending (most recent first)
      const sortedThreads = userThreads.sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return timeB - timeA;
      });

      // Apply cursor-based pagination
      let paginatedThreads = sortedThreads;
      if (cursor) {
        // Find the index of the cursor thread
        const cursorIndex = sortedThreads.findIndex(t => t.id === cursor);
        if (cursorIndex >= 0) {
          // Start from the thread after the cursor
          paginatedThreads = sortedThreads.slice(cursorIndex + 1);
        } else {
          // Invalid cursor, start from beginning
          paginatedThreads = sortedThreads;
        }
      }

      // Limit the results
      const threadsToReturn = paginatedThreads.slice(0, limit);

      // Enrich threads with user and participant information
      const enrichedThreads = await Promise.all(threadsToReturn.map(async (thread) => {
        const creator = thread.createdByUserId ? await storage.getUser(thread.createdByUserId) : undefined;
        const participants = await storage.getProjectMessageParticipantsByThreadId(thread.id);
        const participantUsers = await Promise.all(
          participants.map(async (p) => {
            const user = await storage.getUser(p.userId);
            return user;
          })
        );

        return {
          ...thread,
          creator,
          participants: participantUsers.filter(Boolean),
        };
      }));

      // Determine if there are more threads after the current batch
      const hasNextPage = paginatedThreads.length > limit;
      const nextCursor = hasNextPage && threadsToReturn.length > 0 
        ? threadsToReturn[threadsToReturn.length - 1].id 
        : null;

      res.json({
        threads: enrichedThreads,
        pagination: {
          hasNextPage,
          nextCursor,
        },
      });
    } catch (error) {
      console.error("Error fetching project message threads:", error);
      res.status(500).json({ message: "Failed to fetch threads" });
    }
  });

  // Create a new project message thread
  app.post("/api/internal/project-messages/threads", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { projectId, topic, participantUserIds, initialMessage } = req.body;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      if (!projectId || !topic || !participantUserIds || !Array.isArray(participantUserIds)) {
        return res.status(400).json({ message: "projectId, topic, and participantUserIds are required" });
      }

      // Check if user has access to this project
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const isAdmin = req.user?.effectiveIsAdmin || req.user?.isAdmin;
      const hasAccess = await userHasClientAccess(effectiveUserId, project.clientId, isAdmin);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Create the thread
      const thread = await storage.createProjectMessageThread({
        projectId,
        topic,
        createdByUserId: effectiveUserId,
        lastMessageAt: new Date(),
      });

      // Add participants (including the creator)
      const allParticipants = Array.from(new Set([effectiveUserId, ...participantUserIds]));
      await Promise.all(
        allParticipants.map((userId) =>
          storage.createProjectMessageParticipant({
            threadId: thread.id,
            userId,
          })
        )
      );

      // If there's an initial message, create it
      if (initialMessage && initialMessage.content) {
        await storage.createProjectMessage({
          threadId: thread.id,
          content: initialMessage.content,
          userId: effectiveUserId,
          attachments: initialMessage.attachments || null,
        });
      }

      res.status(201).json(thread);
    } catch (error) {
      console.error("Error creating project message thread:", error);
      res.status(500).json({ message: "Failed to create thread" });
    }
  });

  // Get messages for a thread
  app.get("/api/internal/project-messages/threads/:threadId/messages", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      // Check if thread exists
      const thread = await storage.getProjectMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      // Verify user is a participant in this thread
      const participants = await storage.getProjectMessageParticipantsByThreadId(threadId);
      const isParticipant = participants.some(p => p.userId === effectiveUserId);
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied - not a participant" });
      }

      const messages = await storage.getProjectMessagesByThreadId(threadId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching project messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send a message in a thread
  app.post("/api/internal/project-messages/threads/:threadId/messages", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const { content, attachments } = req.body;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      if (!content) {
        return res.status(400).json({ message: "content is required" });
      }

      // Check if thread exists
      const thread = await storage.getProjectMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      // Verify user is a participant in this thread
      const participants = await storage.getProjectMessageParticipantsByThreadId(threadId);
      const isParticipant = participants.some(p => p.userId === effectiveUserId);
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied - not a participant" });
      }

      // Create the message
      const message = await storage.createProjectMessage({
        threadId,
        content,
        userId: effectiveUserId,
        attachments: attachments || null,
      });

      // Send push notifications to participants (except sender) using template service
      try {
        const sender = await storage.getUser(effectiveUserId);
        const senderName = sender?.firstName && sender?.lastName
          ? `${sender.firstName} ${sender.lastName}`
          : sender?.email || 'Someone';

        // Get all participants except the sender
        const otherParticipants = participants.filter(p => p.userId !== effectiveUserId);

        if (otherParticipants.length > 0) {
          const recipientUserIds = otherParticipants.map(p => p.userId);
          const url = `/projects/${thread.projectId}?tab=messages&thread=${threadId}`;
          
          await sendNewStaffMessageNotification(
            recipientUserIds,
            senderName,
            content,
            url
          );
        }
      } catch (pushError) {
        console.error('[Push] Error sending project message notifications:', pushError);
        // Don't fail the message send if push fails
      }

      res.status(201).json(message);
    } catch (error) {
      console.error("Error sending project message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Mark messages as read
  app.put("/api/internal/project-messages/threads/:threadId/mark-read", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const { lastReadMessageId } = req.body;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      if (!lastReadMessageId) {
        return res.status(400).json({ message: "lastReadMessageId is required" });
      }

      // Check if thread exists
      const thread = await storage.getProjectMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      // Verify user is a participant in this thread
      const participants = await storage.getProjectMessageParticipantsByThreadId(threadId);
      const isParticipant = participants.some(p => p.userId === effectiveUserId);
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied - not a participant" });
      }

      await storage.markProjectMessagesAsRead(threadId, effectiveUserId, lastReadMessageId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  // Archive a thread
  app.put("/api/internal/project-messages/threads/:threadId/archive", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      // Check if thread exists
      const thread = await storage.getProjectMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      // Verify user is a participant in this thread
      const participants = await storage.getProjectMessageParticipantsByThreadId(threadId);
      const isParticipant = participants.some(p => p.userId === effectiveUserId);
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied - not a participant" });
      }

      const updated = await storage.archiveProjectMessageThread(threadId, effectiveUserId);
      res.json(updated);
    } catch (error) {
      console.error("Error archiving thread:", error);
      res.status(500).json({ message: "Failed to archive thread" });
    }
  });

  // Unarchive a thread
  app.put("/api/internal/project-messages/threads/:threadId/unarchive", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      // Check if thread exists
      const thread = await storage.getProjectMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      // Verify user is a participant in this thread
      const participants = await storage.getProjectMessageParticipantsByThreadId(threadId);
      const isParticipant = participants.some(p => p.userId === effectiveUserId);
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied - not a participant" });
      }

      const updated = await storage.unarchiveProjectMessageThread(threadId);
      res.json(updated);
    } catch (error) {
      console.error("Error unarchiving thread:", error);
      res.status(500).json({ message: "Failed to unarchive thread" });
    }
  });

  // Get unread message count for the current user
  app.get("/api/internal/project-messages/unread-count", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const unreadMessages = await storage.getUnreadProjectMessagesForUser(effectiveUserId);

      const totalCount = unreadMessages.reduce((sum, item) => sum + item.count, 0);

      res.json({
        total: totalCount,
        byThread: unreadMessages,
      });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  // Generate upload URL for project message attachments
  app.post("/api/internal/project-messages/attachments/upload-url", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { fileName, fileType, threadId } = req.body;

      if (!fileName || !fileType || !threadId) {
        return res.status(400).json({ message: "fileName, fileType, and threadId are required" });
      }

      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      // Check if thread exists
      const thread = await storage.getProjectMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      // Verify user is a participant in this thread
      const participants = await storage.getProjectMessageParticipantsByThreadId(threadId);
      const isParticipant = participants.some(p => p.userId === effectiveUserId);
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied - not a participant" });
      }

      // Generate a unique object path in the private directory
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
      const fullPath = `${privateDir}/project-messages/${threadId}/${timestamp}_${sanitizedFileName}`;

      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getUploadURLForPath(fullPath);

      // Return the normalized object path for later retrieval
      const objectPath = `/objects/project-messages/${threadId}/${timestamp}_${sanitizedFileName}`;

      res.json({
        url: uploadURL,
        objectPath,
        fileName,
        fileType,
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // Serve project message attachments with thread access check
  app.get("/api/internal/project-messages/attachments/*", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      // Extract the object path from the URL
      const objectPath = req.path.replace('/api/internal/project-messages/attachments', '/objects');

      // Get the thread ID from query params
      const threadId = req.query.threadId;
      if (!threadId) {
        return res.status(400).json({ message: "threadId query parameter is required" });
      }

      // Check if the thread exists
      const thread = await storage.getProjectMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      // Verify user is a participant in this thread
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const participants = await storage.getProjectMessageParticipantsByThreadId(threadId);
      const isParticipant = participants.some(p => p.userId === effectiveUserId);

      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied - not a participant" });
      }

      // Serve the file without ACL check since we verified thread access
      const objectStorageService = new ObjectStorageService();
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
        objectStorageService.downloadObject(objectFile, res);
      } catch (error) {
        console.error("Error serving attachment:", error);
        if (error instanceof ObjectNotFoundError) {
          return res.status(404).json({ message: "Attachment not found" });
        }
        return res.status(500).json({ message: "Error serving attachment" });
      }
    } catch (error) {
      console.error("Error serving project message attachment:", error);
      res.status(500).json({ message: "Failed to serve attachment" });
    }
  });

  // ========== Standalone Staff Message Routes ==========
  
  // Get all standalone staff message threads for current user
  app.get("/api/staff-messages/my-threads", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      const { includeArchived } = req.query;
      
      const threads = await storage.getStaffMessageThreadsForUser(effectiveUserId, {
        includeArchived: includeArchived === 'true',
      });
      
      res.json(threads);
    } catch (error) {
      console.error("Error fetching user's staff message threads:", error);
      res.status(500).json({ message: "Failed to fetch threads" });
    }
  });

  // Create a new standalone staff message thread
  app.post("/api/staff-messages/threads", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { topic, participantUserIds, initialMessage } = req.body;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      if (!topic || !participantUserIds || !Array.isArray(participantUserIds)) {
        return res.status(400).json({ message: "topic and participantUserIds are required" });
      }

      // Create the thread
      const thread = await storage.createStaffMessageThread({
        topic,
        createdByUserId: effectiveUserId,
        lastMessageAt: new Date(),
      });

      // Add participants (including the creator)
      const allParticipants = Array.from(new Set([effectiveUserId, ...participantUserIds]));
      await Promise.all(
        allParticipants.map((userId) =>
          storage.createStaffMessageParticipant({
            threadId: thread.id,
            userId,
          })
        )
      );

      // If there's an initial message, create it
      if (initialMessage && initialMessage.content) {
        await storage.createStaffMessage({
          threadId: thread.id,
          content: initialMessage.content,
          userId: effectiveUserId,
          attachments: initialMessage.attachments || null,
        });
      }

      res.status(201).json(thread);
    } catch (error) {
      console.error("Error creating staff message thread:", error);
      res.status(500).json({ message: "Failed to create thread" });
    }
  });

  // Get messages for a standalone staff thread
  app.get("/api/staff-messages/threads/:threadId/messages", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      // Check if thread exists
      const thread = await storage.getStaffMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      // Verify user is a participant in this thread
      const participants = await storage.getStaffMessageParticipantsByThreadId(threadId);
      const isParticipant = participants.some(p => p.userId === effectiveUserId);
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied - not a participant" });
      }

      const messages = await storage.getStaffMessagesByThreadId(threadId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching staff messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send a message in a standalone staff thread
  app.post("/api/staff-messages/threads/:threadId/messages", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const { content, attachments } = req.body;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      if (!content) {
        return res.status(400).json({ message: "content is required" });
      }

      // Check if thread exists
      const thread = await storage.getStaffMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      // Verify user is a participant in this thread
      const participants = await storage.getStaffMessageParticipantsByThreadId(threadId);
      const isParticipant = participants.some(p => p.userId === effectiveUserId);
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied - not a participant" });
      }

      // Create the message
      const message = await storage.createStaffMessage({
        threadId,
        content,
        userId: effectiveUserId,
        attachments: attachments || null,
      });

      // Send push notifications to participants (except sender) using template service
      try {
        const sender = await storage.getUser(effectiveUserId);
        const senderName = sender?.firstName && sender?.lastName
          ? `${sender.firstName} ${sender.lastName}`
          : sender?.email || 'Someone';

        // Get all participants except the sender
        const otherParticipants = participants.filter(p => p.userId !== effectiveUserId);

        if (otherParticipants.length > 0) {
          const recipientUserIds = otherParticipants.map(p => p.userId);
          const url = `/internal-chat?thread=${threadId}`;
          
          await sendNewStaffMessageNotification(
            recipientUserIds,
            senderName,
            content,
            url
          );
        }
      } catch (pushError) {
        console.error('[Push] Error sending staff message notifications:', pushError);
        // Don't fail the message send if push fails
      }

      res.status(201).json(message);
    } catch (error) {
      console.error("Error sending staff message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Generate upload URL for staff message attachments
  app.post("/api/staff-messages/attachments/upload-url", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { fileName, fileType, fileSize, threadId } = req.body;

      if (!fileName || !fileType || !threadId) {
        return res.status(400).json({ message: "fileName, fileType, and threadId are required" });
      }

      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      // Check if thread exists
      const thread = await storage.getStaffMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      // Verify user is a participant in this thread
      const participants = await storage.getStaffMessageParticipantsByThreadId(threadId);
      const isParticipant = participants.some(p => p.userId === effectiveUserId);
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied - not a participant" });
      }

      // Server-side validation
      const validation = validateFileUpload(fileName, fileType, fileSize || 0, MAX_FILE_SIZE);
      if (!validation.isValid) {
        return res.status(400).json({ message: validation.error });
      }

      const objectStorageService = new ObjectStorageService();
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL();

      res.json({
        url: uploadURL,
        objectPath,
        fileName,
        fileType,
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // Mark messages as read in a standalone staff thread
  app.put("/api/staff-messages/threads/:threadId/mark-read", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { threadId } = req.params;
      const { lastReadMessageId } = req.body;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      if (!lastReadMessageId) {
        return res.status(400).json({ message: "lastReadMessageId is required" });
      }

      // Check if thread exists
      const thread = await storage.getStaffMessageThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: "Thread not found" });
      }

      // Verify user is a participant in this thread
      const participants = await storage.getStaffMessageParticipantsByThreadId(threadId);
      const isParticipant = participants.some(p => p.userId === effectiveUserId);
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied - not a participant" });
      }

      // Mark messages as read
      await storage.markStaffMessagesAsRead(threadId, effectiveUserId, lastReadMessageId);

      res.json({ message: "Marked as read" });
    } catch (error) {
      console.error("Error marking staff messages as read:", error);
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });
}
