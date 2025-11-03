import type { Express } from "express";
import { storage } from "../storage";
import { ObjectStorageService, ObjectNotFoundError } from "../objectStorage";
import { validateFileUpload, MAX_FILE_SIZE } from "../utils/fileValidation";
import { createDocumentsFromAttachments } from "../utils/documentHelpers";
import { verifyThreadAccess } from "../middleware/attachmentAccess";
import { sendNewClientMessageNotification } from "../notification-template-service";
import { z } from "zod";

// Push notification schemas
const pushSubscribeSchema = z.object({
  endpoint: z.string().url("Invalid endpoint URL"),
  keys: z.object({
    p256dh: z.string().min(1, "p256dh key is required"),
    auth: z.string().min(1, "auth key is required"),
  }),
  userAgent: z.string().optional(),
});

const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url("Invalid endpoint URL"),
});

export async function registerPortalRoutes(app: Express): Promise<void> {
  // ===== CLIENT PORTAL AUTHENTICATION ROUTES (Public - No Auth Required) =====
  const { sendMagicLink, verifyMagicLink, sendVerificationCode, verifyCode } = await import('../portalAuth');

  // Request verification code (email-based login)
  app.post('/api/portal/auth/request-code', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const result = await sendVerificationCode(email);

      if (!result.success) {
        return res.status(400).json({ message: result.error || 'Failed to send code' });
      }

      // Always return success to prevent email enumeration
      res.json({ message: 'If a portal account exists for this email, a code has been sent' });
    } catch (error) {
      console.error('Error requesting code:', error);
      res.status(500).json({ message: 'Failed to send code' });
    }
  });

  // Verify code and get JWT
  app.post('/api/portal/auth/verify-code', async (req, res) => {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({ message: 'Email and code are required' });
      }

      const result = await verifyCode(email, code);

      if (!result.success) {
        return res.status(400).json({ message: result.error || 'Invalid code' });
      }

      res.json({ jwt: result.jwt });
    } catch (error) {
      console.error('Error verifying code:', error);
      res.status(500).json({ message: 'Verification failed' });
    }
  });

  // DEPRECATED: Request magic link (only for pre-existing portal users)
  app.post('/api/portal/auth/request-magic-link', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const result = await sendMagicLink(email);

      if (!result.success) {
        return res.status(400).json({ message: result.error || 'Failed to send magic link' });
      }

      // Always return success to prevent email enumeration
      res.json({ message: 'If a portal account exists for this email, a magic link has been sent' });
    } catch (error) {
      console.error('Error requesting magic link:', error);
      res.status(500).json({ message: 'Failed to send magic link' });
    }
  });

  // DEPRECATED: Verify magic link and get JWT
  app.get('/api/portal/auth/verify', async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ message: 'Token is required' });
      }

      const result = await verifyMagicLink(token);

      if (!result.success) {
        return res.status(400).json({ message: result.error || 'Verification failed' });
      }

      res.json({ jwt: result.jwt });
    } catch (error) {
      console.error('Error verifying magic link:', error);
      res.status(500).json({ message: 'Verification failed' });
    }
  });

  // ===== CLIENT PORTAL COMPANY SWITCHING ROUTES (JWT Auth Required) =====
  const { authenticatePortal, createJWT } = await import('../portalAuth');

  // Get all companies available to the authenticated portal user
  app.get('/api/portal/available-companies', authenticatePortal, async (req: any, res) => {
    try {
      const personId = req.portalUser!.relatedPersonId;

      if (!personId) {
        // If no personId, user can only access their current company
        const currentClient = await storage.getClientById(req.portalUser!.clientId);
        if (!currentClient) {
          return res.status(404).json({ message: 'Current company not found' });
        }
        return res.json([{
          id: currentClient.id,
          name: currentClient.name,
          isCurrent: true
        }]);
      }

      // Get all companies the person is connected to
      const clientRelationships = await storage.getClientPeopleByPersonId(personId);

      // Filter to only include company clients (not individuals)
      const companies = clientRelationships
        .filter(relationship => relationship.client.clientType === 'company')
        .map(relationship => ({
          id: relationship.client.id,
          name: relationship.client.name,
          officerRole: relationship.officerRole,
          isCurrent: relationship.client.id === req.portalUser!.clientId
        }));

      res.json(companies);
    } catch (error) {
      console.error('Error fetching available companies:', error);
      res.status(500).json({ message: 'Failed to fetch available companies' });
    }
  });

  // Switch to a different company and get a new JWT
  app.post('/api/portal/switch-company', authenticatePortal, async (req: any, res) => {
    try {
      const { clientId } = req.body;
      const personId = req.portalUser!.relatedPersonId;

      if (!clientId) {
        return res.status(400).json({ message: 'clientId is required' });
      }

      if (!personId) {
        return res.status(403).json({ message: 'Cannot switch companies: No person association' });
      }

      // Verify the person is actually connected to this client
      const clientRelationships = await storage.getClientPeopleByPersonId(personId);
      const hasAccess = clientRelationships.some(
        relationship => relationship.client.id === clientId && relationship.client.clientType === 'company'
      );

      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied to this company' });
      }

      // Get the portal user to create a new JWT
      const portalUser = await storage.getClientPortalUserById(req.portalUser!.id);
      if (!portalUser) {
        return res.status(404).json({ message: 'Portal user not found' });
      }

      // Create a new JWT with the new clientId
      const newJWT = createJWT({
        id: portalUser.id,
        clientId: clientId,
        email: portalUser.email,
        name: portalUser.name || 'Portal User'
      });

      res.json({ jwt: newJWT });
    } catch (error) {
      console.error('Error switching company:', error);
      res.status(500).json({ message: 'Failed to switch company' });
    }
  });

  // ===== CLIENT PORTAL MESSAGING ROUTES (JWT Auth Required) =====

  // Get all threads for authenticated portal user
  app.get('/api/portal/threads', authenticatePortal, async (req: any, res) => {
    try {
      const clientId = req.portalUser!.clientId;
      const status = req.query.status as string | undefined;

      const threads = await storage.getMessageThreadsWithUnreadCount(clientId, status);
      res.json(threads);
    } catch (error) {
      console.error('Error fetching threads:', error);
      res.status(500).json({ message: 'Failed to fetch threads' });
    }
  });

  // Get specific thread
  app.get('/api/portal/threads/:threadId', authenticatePortal, async (req: any, res) => {
    try {
      const { threadId } = req.params;
      const clientId = req.portalUser!.clientId;

      const thread = await storage.getMessageThreadById(threadId);

      if (!thread) {
        return res.status(404).json({ message: 'Thread not found' });
      }

      if (thread.clientId !== clientId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json(thread);
    } catch (error) {
      console.error('Error fetching thread:', error);
      res.status(500).json({ message: 'Failed to fetch thread' });
    }
  });

  // Create new thread
  app.post('/api/portal/threads', authenticatePortal, async (req: any, res) => {
    try {
      const portalUserId = req.portalUser!.id;
      const clientId = req.portalUser!.clientId;
      const { subject, projectId, serviceId } = req.body;

      if (!subject) {
        return res.status(400).json({ message: 'Subject is required' });
      }

      const thread = await storage.createMessageThread({
        subject,
        clientId,
        createdByClientPortalUserId: portalUserId,
        projectId: projectId || null,
        serviceId: serviceId || null,
        status: 'open'
      });

      res.status(201).json(thread);
    } catch (error) {
      console.error('Error creating thread:', error);
      res.status(500).json({ message: 'Failed to create thread' });
    }
  });

  // Get messages for a thread
  app.get('/api/portal/threads/:threadId/messages', authenticatePortal, async (req: any, res) => {
    try {
      const { threadId } = req.params;
      const clientId = req.portalUser!.clientId;

      const thread = await storage.getMessageThreadById(threadId);
      if (!thread || thread.clientId !== clientId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const messages = await storage.getMessagesByThreadId(threadId);

      // Enrich messages with staff user names
      const enrichedMessages = await Promise.all(
        messages.map(async (message: any) => {
          if (message.userId) {
            const staffUser = await storage.getUser(message.userId);
            return {
              ...message,
              staffUserName: staffUser ? `${staffUser.firstName || ''} ${staffUser.lastName || ''}`.trim() || staffUser.email : 'Staff'
            };
          }
          return message;
        })
      );

      res.json(enrichedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ message: 'Failed to fetch messages' });
    }
  });

  // Send message in a thread
  app.post('/api/portal/threads/:threadId/messages', authenticatePortal, async (req: any, res) => {
    try {
      const { threadId } = req.params;
      const portalUserId = req.portalUser!.id;
      const clientId = req.portalUser!.clientId;
      const { content, attachments } = req.body;

      if (!content && (!attachments || attachments.length === 0)) {
        return res.status(400).json({ message: 'Content or attachments are required' });
      }

      const thread = await storage.getMessageThreadById(threadId);
      if (!thread || thread.clientId !== clientId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const message = await storage.createMessage({
        threadId,
        content: content || '',
        clientPortalUserId: portalUserId,
        attachments: attachments || null,
        isReadByStaff: false,
        isReadByClient: true
      });

      // Auto-create document records for attachments
      if (attachments && attachments.length > 0) {
        await createDocumentsFromAttachments({
          clientId,
          messageId: message.id,
          threadId,
          attachments,
          clientPortalUserId: portalUserId,
        });
      }

      // Send push notifications to staff members using template service
      try {
        // Get client name for notification
        const client = await storage.getClientById(clientId);
        const clientName = client?.name || 'A client';
        
        // Get all staff users (all users are staff in this system)
        const allStaffUsers = await storage.getAllUsers();
        const staffUserIds = allStaffUsers.map(user => user.id);
        
        if (staffUserIds.length > 0) {
          const url = `/messages?thread=${threadId}`;
          
          await sendNewClientMessageNotification(
            staffUserIds,
            clientName,
            content || (attachments && attachments.length > 0 ? `Sent ${attachments.length} attachment${attachments.length > 1 ? 's' : ''}` : ''),
            url
          );
        }
      } catch (pushError) {
        console.error('[Push] Error sending notifications to staff:', pushError);
        // Don't fail the message send if push fails
      }

      res.status(201).json(message);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ message: 'Failed to send message' });
    }
  });

  // Mark thread as read for client
  app.put('/api/portal/threads/:threadId/mark-read', authenticatePortal, async (req: any, res) => {
    try {
      const { threadId } = req.params;
      const clientId = req.portalUser!.clientId;

      const thread = await storage.getMessageThreadById(threadId);
      if (!thread || thread.clientId !== clientId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.markMessagesAsReadByClient(threadId);
      res.json({ message: 'Marked as read' });
    } catch (error) {
      console.error('Error marking thread as read:', error);
      res.status(500).json({ message: 'Failed to mark as read' });
    }
  });

  // Get unread count for client
  app.get('/api/portal/unread-count', authenticatePortal, async (req: any, res) => {
    try {
      const clientId = req.portalUser!.clientId;
      const count = await storage.getUnreadMessageCountForClient(clientId);
      res.json({ count });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({ message: 'Failed to fetch unread count' });
    }
  });

  // Generate presigned URL for message attachment upload (portal)
  app.post('/api/portal/attachments/upload-url', authenticatePortal, async (req: any, res) => {
    try {
      const { fileName, fileType, fileSize } = req.body;

      if (!fileName || !fileType) {
        return res.status(400).json({ message: 'fileName and fileType are required' });
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
      console.error('Error generating upload URL:', error);
      res.status(500).json({ message: 'Failed to generate upload URL' });
    }
  });

  // GET /api/portal/attachments/* - Serve attachment files with authentication
  app.get('/api/portal/attachments/*', authenticatePortal, async (req: any, res) => {
    try {
      // Extract the object path from the URL
      const objectPath = req.path.replace('/api/portal/attachments', '/objects');

      // Get the thread ID from query params
      const threadId = req.query.threadId;
      if (!threadId) {
        return res.status(400).json({ message: 'threadId query parameter is required' });
      }

      // Verify thread access
      const portalUserId = req.portalUser.id;
      const { hasAccess } = await verifyThreadAccess(undefined, portalUserId, threadId);

      if (!hasAccess) {
        console.log(`[Portal File Access Denied] User: ${portalUserId}, Thread: ${threadId}, Path: ${objectPath}`);
        return res.status(403).json({ message: 'Access denied to this file' });
      }

      // Serve the file without ACL check since we verified thread access
      const objectStorageService = new ObjectStorageService();
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
        objectStorageService.downloadObject(objectFile, res);
      } catch (error) {
        console.error('Error serving portal attachment:', error);
        if (error instanceof ObjectNotFoundError) {
          return res.status(404).json({ message: 'Attachment not found' });
        }
        return res.status(500).json({ message: 'Error serving attachment' });
      }
    } catch (error) {
      console.error('Error serving portal attachment:', error);
      res.status(500).json({ message: 'Failed to serve attachment' });
    }
  });

  // ===== CLIENT PORTAL PUSH NOTIFICATION ROUTES (JWT Auth Required) =====

  // POST /api/portal/push/subscribe - Portal user push notification subscription
  app.post("/api/portal/push/subscribe", authenticatePortal, async (req: any, res: any) => {
    try {
      const portalUserId = req.portalUser.id;

      const validationResult = pushSubscribeSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid subscription data",
          errors: validationResult.error.issues
        });
      }

      const { endpoint, keys, userAgent } = validationResult.data;

      const subscription = await storage.createPushSubscription({
        clientPortalUserId: portalUserId,
        endpoint,
        keys,
        userAgent: userAgent || req.headers['user-agent'] || null
      });

      // Set pushNotificationsEnabled to true when user subscribes
      await storage.updateClientPortalUser(portalUserId, {
        pushNotificationsEnabled: true
      });

      res.status(201).json(subscription);
    } catch (error) {
      console.error("Error subscribing portal user to push notifications:", error);
      res.status(500).json({ message: "Failed to subscribe to push notifications" });
    }
  });

  // DELETE /api/portal/push/unsubscribe - Portal user push notification unsubscribe
  app.delete("/api/portal/push/unsubscribe", authenticatePortal, async (req: any, res: any) => {
    try {
      const portalUserId = req.portalUser.id;

      const validationResult = pushUnsubscribeSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid unsubscribe data",
          errors: validationResult.error.issues
        });
      }

      const { endpoint } = validationResult.data;
      await storage.deletePushSubscription(endpoint);

      // Check if user has any remaining subscriptions
      const remainingSubscriptions = await storage.getPushSubscriptionsByClientPortalUserId(portalUserId);

      // If no subscriptions left, set pushNotificationsEnabled to false
      if (remainingSubscriptions.length === 0) {
        await storage.updateClientPortalUser(portalUserId, {
          pushNotificationsEnabled: false
        });
      }

      res.json({ message: "Unsubscribed successfully" });
    } catch (error) {
      console.error("Error unsubscribing portal user from push notifications:", error);
      res.status(500).json({ message: "Failed to unsubscribe" });
    }
  });

  // GET /api/portal/push/subscriptions - Get portal user's push subscriptions
  app.get("/api/portal/push/subscriptions", authenticatePortal, async (req: any, res: any) => {
    try {
      const portalUserId = req.portalUser.id;
      const subscriptions = await storage.getPushSubscriptionsByClientPortalUserId(portalUserId);
      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching portal user push subscriptions:", error);
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  // ===== CLIENT PORTAL DOCUMENT ROUTES (JWT Auth Required) =====

  // GET /api/portal/documents - List all documents for authenticated portal user
  app.get("/api/portal/documents", authenticatePortal, async (req: any, res: any) => {
    try {
      const portalUserId = req.portalUser.id;
      const clientId = req.portalUser.clientId;

      const documents = await storage.listPortalDocuments(clientId, portalUserId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching portal documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // POST /api/portal/documents/upload-url - Generate presigned URL for portal document upload
  app.post("/api/portal/documents/upload-url", authenticatePortal, async (req: any, res: any) => {
    try {
      const { fileName, fileType, fileSize } = req.body;
      const portalUserId = req.portalUser.id;
      const clientId = req.portalUser.clientId;

      if (!fileName || !fileType) {
        return res.status(400).json({ message: "fileName and fileType are required" });
      }

      // Server-side validation using utility
      const validation = validateFileUpload(fileName, fileType, fileSize || 0, MAX_FILE_SIZE);
      if (!validation.isValid) {
        return res.status(400).json({ message: validation.error });
      }

      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const objectPath = `portal-uploads/${clientId}/${timestamp}-${sanitizedFileName}`;

      const { Storage } = await import('@google-cloud/storage');
      const gcs = new Storage();
      const bucketName = process.env.GCS_BUCKET_NAME || '';
      const bucket = gcs.bucket(bucketName);
      const file = bucket.file(objectPath);

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType: fileType,
      });

      res.json({
        uploadUrl: url,
        objectPath,
        fileName,
        fileType,
        fileSize
      });
    } catch (error) {
      console.error("Error generating portal document upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // POST /api/portal/documents/confirm - Confirm document upload and create database record
  app.post("/api/portal/documents/confirm", authenticatePortal, async (req: any, res: any) => {
    try {
      const { objectPath, fileName, fileType, fileSize } = req.body;
      const portalUserId = req.portalUser.id;
      const clientId = req.portalUser.clientId;

      if (!objectPath || !fileName || !fileType) {
        return res.status(400).json({ message: "objectPath, fileName, and fileType are required" });
      }

      let folderId = null;
      const existingFolders = await storage.getDocumentFoldersByClientId(clientId);
      const clientUploadsFolder = existingFolders.find((f: any) => f.name === 'Client Uploads');

      if (clientUploadsFolder) {
        folderId = clientUploadsFolder.id;
      } else {
        const newFolder = await storage.createDocumentFolder({
          clientId,
          name: 'Client Uploads',
          createdBy: null,
          source: 'portal_upload'
        });
        folderId = newFolder.id;
      }

      const document = await storage.createPortalDocument({
        clientId,
        clientPortalUserId: portalUserId,
        folderId,
        fileName,
        fileType,
        fileSize: fileSize || 0,
        objectPath,
        uploadName: fileName,
        source: 'portal_upload',
        isPortalVisible: true,
        uploadedBy: null
      });

      res.json(document);
    } catch (error) {
      console.error("Error confirming portal document upload:", error);
      res.status(500).json({ message: "Failed to confirm upload" });
    }
  });

  // GET /api/portal/documents/:id/file - Serve portal document file directly
  app.get("/api/portal/documents/:id/file", authenticatePortal, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const portalUserId = req.portalUser.id;
      const clientId = req.portalUser.clientId;

      // Verify document access - user must own the document (same clientId)
      const document = await storage.getPortalDocumentById(id, clientId, portalUserId);
      if (!document) {
        console.log(`[Portal Document Access Denied] User: ${portalUserId}, Document: ${id}`);
        return res.status(404).json({ message: "Document not found" });
      }

      // Serve the file using ObjectStorageService
      const objectStorageService = new ObjectStorageService();
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(document.objectPath);
        objectStorageService.downloadObject(objectFile, res);
      } catch (error) {
        console.error('Error serving portal document:', error);
        if (error instanceof ObjectNotFoundError) {
          return res.status(404).json({ message: 'Document file not found' });
        }
        return res.status(500).json({ message: 'Error serving document' });
      }
    } catch (error) {
      console.error("Error serving portal document:", error);
      res.status(500).json({ message: "Failed to serve document" });
    }
  });

  // DELETE /api/portal/documents/:id - Delete portal document
  app.delete("/api/portal/documents/:id", authenticatePortal, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const portalUserId = req.portalUser.id;
      const clientId = req.portalUser.clientId;

      const document = await storage.getPortalDocumentById(id, clientId, portalUserId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      try {
        const { Storage } = await import('@google-cloud/storage');
        const gcs = new Storage();
        const bucketName = process.env.GCS_BUCKET_NAME || '';
        const bucket = gcs.bucket(bucketName);
        const file = bucket.file(document.objectPath);
        await file.delete();
      } catch (storageError) {
        console.error("Error deleting file from storage:", storageError);
      }

      await storage.deletePortalDocument(id, clientId, portalUserId);
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting portal document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Portal Task Instance Routes

  // GET /api/portal/task-instances - Get all task instances for logged-in portal user
  app.get("/api/portal/task-instances", authenticatePortal, async (req: any, res: any) => {
    try {
      const portalUserId = req.portalUser.id;
      const relatedPersonId = req.portalUser.relatedPersonId;
      const clientId = req.portalUser.clientId;

      if (!relatedPersonId) {
        return res.status(400).json({ message: "Portal user has no associated person" });
      }

      if (!clientId) {
        return res.status(400).json({ message: "Client ID is required" });
      }

      const instances = await storage.getTaskInstancesByPersonIdAndClientId(relatedPersonId, clientId);
      res.json(instances);
    } catch (error) {
      console.error("Error fetching portal task instances:", error);
      res.status(500).json({ message: "Failed to fetch task instances" });
    }
  });

  // GET /api/portal/task-instances/count/incomplete - Get count of incomplete tasks
  app.get("/api/portal/task-instances/count/incomplete", authenticatePortal, async (req: any, res: any) => {
    try {
      const relatedPersonId = req.portalUser.relatedPersonId;
      const clientId = req.portalUser.clientId;

      if (!relatedPersonId) {
        return res.status(400).json({ message: "Portal user has no associated person" });
      }

      if (!clientId) {
        return res.status(400).json({ message: "Client ID is required" });
      }

      const instances = await storage.getTaskInstancesByPersonIdAndClientId(relatedPersonId, clientId);
      const incompleteCount = instances.filter(i => i.status !== 'submitted' && i.status !== 'approved' && i.status !== 'cancelled').length;
      res.json({ count: incompleteCount });
    } catch (error) {
      console.error("Error counting incomplete task instances:", error);
      res.status(500).json({ message: "Failed to count incomplete tasks" });
    }
  });

  // GET /api/portal/task-instances/:id - Get specific task instance with full details
  app.get("/api/portal/task-instances/:id", authenticatePortal, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const portalUserId = req.portalUser.id;
      const relatedPersonId = req.portalUser.relatedPersonId;

      if (!relatedPersonId) {
        return res.status(400).json({ message: "Portal user has no associated person" });
      }

      const instance = await storage.getTaskInstanceWithFullData(id);

      if (!instance) {
        return res.status(404).json({ message: "Task instance not found" });
      }

      // Verify the task is assigned to this portal user
      if (instance.personId !== relatedPersonId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(instance);
    } catch (error) {
      console.error("Error fetching portal task instance:", error);
      res.status(500).json({ message: "Failed to fetch task instance" });
    }
  });

  // PATCH /api/portal/task-instances/:id - Update responses (save progress)
  app.patch("/api/portal/task-instances/:id", authenticatePortal, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { responses } = req.body;
      const relatedPersonId = req.portalUser.relatedPersonId;

      if (!relatedPersonId) {
        return res.status(400).json({ message: "Portal user has no associated person" });
      }

      // Verify the task is assigned to this portal user
      const instance = await storage.getTaskInstanceWithFullData(id);
      if (!instance) {
        return res.status(404).json({ message: "Task instance not found" });
      }
      if (instance.personId !== relatedPersonId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Don't allow updates to submitted/reviewed tasks
      if (instance.status === 'submitted' || instance.status === 'reviewed') {
        return res.status(400).json({ message: "Cannot update a submitted task" });
      }

      // Update responses
      const allResponses = await storage.getTaskInstanceResponsesByTaskInstanceId(id);
      for (const [questionId, value] of Object.entries(responses)) {
        const existingResponse = allResponses.find(r => r.questionId === questionId);
        if (existingResponse) {
          await storage.updateTaskInstanceResponse(existingResponse.id, { responseValue: value as string });
        } else {
          await storage.saveTaskInstanceResponse({
            taskInstanceId: id,
            questionId,
            responseValue: value as string,
          });
        }
      }

      // Update status to in_progress if it was draft or not_started
      if (instance.status === 'draft' || instance.status === 'not_started') {
        await storage.updateTaskInstance(id, { status: 'in_progress' });
      }

      res.json({ message: "Progress saved successfully" });
    } catch (error) {
      console.error("Error updating task responses:", error);
      res.status(500).json({ message: "Failed to save progress" });
    }
  });

  // POST /api/portal/task-instances/:id/submit - Submit the task instance
  app.post("/api/portal/task-instances/:id/submit", authenticatePortal, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { responses } = req.body;
      const relatedPersonId = req.portalUser.relatedPersonId;

      if (!relatedPersonId) {
        return res.status(400).json({ message: "Portal user has no associated person" });
      }

      // Verify the task is assigned to this portal user
      const instance = await storage.getTaskInstanceWithFullData(id);
      if (!instance) {
        return res.status(404).json({ message: "Task instance not found" });
      }
      if (instance.personId !== relatedPersonId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Don't allow re-submission
      if (instance.status === 'submitted' || instance.status === 'reviewed') {
        return res.status(400).json({ message: "Task already submitted" });
      }

      // Save all responses
      const allResponses = await storage.getTaskInstanceResponsesByTaskInstanceId(id);
      for (const [questionId, value] of Object.entries(responses)) {
        const existingResponse = allResponses.find(r => r.questionId === questionId);
        if (existingResponse) {
          await storage.updateTaskInstanceResponse(existingResponse.id, { responseValue: value as string });
        } else {
          await storage.saveTaskInstanceResponse({
            taskInstanceId: id,
            questionId,
            responseValue: value as string,
          });
        }
      }

      // Update status to submitted
      await storage.updateTaskInstance(id, {
        status: 'submitted',
      });

      res.json({ message: "Task submitted successfully" });
    } catch (error) {
      console.error("Error submitting task:", error);
      res.status(500).json({ message: "Failed to submit task" });
    }
  });

  // POST /api/portal/task-instances/upload-url - Generate presigned URL for task file upload
  app.post("/api/portal/task-instances/upload-url", authenticatePortal, async (req: any, res: any) => {
    try {
      const { fileName, fileType, fileSize, instanceId, questionId } = req.body;
      const portalUserId = req.portalUser.id;
      const clientId = req.portalUser.clientId;
      const relatedPersonId = req.portalUser.relatedPersonId;

      if (!fileName || !fileType || !instanceId || !questionId) {
        return res.status(400).json({ message: "fileName, fileType, instanceId, and questionId are required" });
      }

      // Verify the task is assigned to this portal user
      const instance = await storage.getTaskInstanceById(instanceId);
      if (!instance || instance.personId !== relatedPersonId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Server-side validation
      const validation = validateFileUpload(fileName, fileType, fileSize || 0, MAX_FILE_SIZE);
      if (!validation.isValid) {
        return res.status(400).json({ message: validation.error });
      }

      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const objectPath = `task-uploads/${clientId}/${instanceId}/${timestamp}-${sanitizedFileName}`;

      const { Storage } = await import('@google-cloud/storage');
      const gcs = new Storage();
      const bucketName = process.env.GCS_BUCKET_NAME || '';
      const bucket = gcs.bucket(bucketName);
      const file = bucket.file(objectPath);

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType: fileType,
      });

      res.json({
        uploadUrl: url,
        objectPath,
        fileName,
        fileType,
        fileSize,
        instanceId,
        questionId
      });
    } catch (error) {
      console.error("Error generating task file upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // POST /api/portal/task-instances/confirm-upload - Confirm task file upload and create document record
  app.post("/api/portal/task-instances/confirm-upload", authenticatePortal, async (req: any, res: any) => {
    try {
      const { objectPath, fileName, fileType, fileSize, instanceId, questionId } = req.body;
      const portalUserId = req.portalUser.id;
      const clientId = req.portalUser.clientId;
      const relatedPersonId = req.portalUser.relatedPersonId;

      if (!objectPath || !fileName || !fileType || !instanceId || !questionId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Verify the task is assigned to this portal user
      const instance = await storage.getTaskInstanceById(instanceId);
      if (!instance || instance.personId !== relatedPersonId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Find or create "Task Uploads" folder
      let folderId = null;
      const existingFolders = await storage.getDocumentFoldersByClientId(clientId);
      const taskUploadsFolder = existingFolders.find((f: any) => f.name === 'Task Uploads');

      if (taskUploadsFolder) {
        folderId = taskUploadsFolder.id;
      } else {
        const newFolder = await storage.createDocumentFolder({
          clientId,
          name: 'Task Uploads',
          createdBy: null,
          source: 'task_upload'
        });
        folderId = newFolder.id;
      }

      // Create document record
      const document = await storage.createPortalDocument({
        clientId,
        clientPortalUserId: portalUserId,
        folderId,
        fileName,
        fileType,
        fileSize: fileSize || 0,
        objectPath,
        uploadName: fileName,
        source: 'task_upload',
        isPortalVisible: true,
        uploadedBy: null
      });

      // Store document reference in task response
      const allResponses = await storage.getTaskInstanceResponsesByTaskInstanceId(instanceId);
      const existingResponse = allResponses.find(r => r.questionId === questionId);
      const responseValue = JSON.stringify({
        documentId: document.id,
        fileName: fileName,
        fileType: fileType,
        fileSize: fileSize
      });

      if (existingResponse) {
        await storage.updateTaskInstanceResponse(existingResponse.id, { responseValue: responseValue });
      } else {
        await storage.saveTaskInstanceResponse({
          taskInstanceId: instanceId,
          questionId,
          responseValue: responseValue,
        });
      }

      res.json({ document, response: { documentId: document.id, fileName } });
    } catch (error) {
      console.error("Error confirming task file upload:", error);
      res.status(500).json({ message: "Failed to confirm upload" });
    }
  });
}
