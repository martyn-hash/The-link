import type { Express } from "express";
import { db } from "../db";
import { 
  signatureRequests, 
  signatureFields, 
  signatureRequestRecipients,
  signatures,
  signatureAuditLogs,
  signedDocuments,
  documents,
  people,
  clients
} from "../../shared/schema";
import { 
  insertSignatureRequestSchema,
  insertSignatureFieldSchema,
  insertSignatureRequestRecipientSchema 
} from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import crypto from "crypto";

/**
 * Register signature request routes
 */
export function registerSignatureRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any
) {
  
  // Staff routes - require authentication
  
  /**
   * GET /api/signature-requests/client/:clientId
   * Get all signature requests for a client
   */
  app.get(
    "/api/signature-requests/client/:clientId",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res) => {
      try {
        const { clientId } = req.params;

        const requests = await db
          .select()
          .from(signatureRequests)
          .where(eq(signatureRequests.clientId, clientId))
          .orderBy(desc(signatureRequests.createdAt));

        res.json(requests);
      } catch (error: any) {
        console.error("Error fetching signature requests:", error);
        res.status(500).json({ 
          error: "Failed to fetch signature requests",
          message: error.message 
        });
      }
    }
  );

  /**
   * GET /api/signature-requests/:id
   * Get a specific signature request with all details
   */
  app.get(
    "/api/signature-requests/:id",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res) => {
      try {
        const { id } = req.params;

        // Get signature request
        const [request] = await db
          .select()
          .from(signatureRequests)
          .where(eq(signatureRequests.id, id));

        if (!request) {
          return res.status(404).json({ error: "Signature request not found" });
        }

        // Get document
        const [document] = await db
          .select()
          .from(documents)
          .where(eq(documents.id, request.documentId));

        // Get fields
        const fields = await db
          .select()
          .from(signatureFields)
          .where(eq(signatureFields.signatureRequestId, id))
          .orderBy(signatureFields.orderIndex);

        // Get recipients
        const recipients = await db
          .select({
            id: signatureRequestRecipients.id,
            signatureRequestId: signatureRequestRecipients.signatureRequestId,
            personId: signatureRequestRecipients.personId,
            email: signatureRequestRecipients.email,
            secureToken: signatureRequestRecipients.secureToken,
            tokenExpiresAt: signatureRequestRecipients.tokenExpiresAt,
            sentAt: signatureRequestRecipients.sentAt,
            viewedAt: signatureRequestRecipients.viewedAt,
            signedAt: signatureRequestRecipients.signedAt,
            reminderSentAt: signatureRequestRecipients.reminderSentAt,
            orderIndex: signatureRequestRecipients.orderIndex,
            createdAt: signatureRequestRecipients.createdAt,
            person: people,
          })
          .from(signatureRequestRecipients)
          .leftJoin(people, eq(signatureRequestRecipients.personId, people.id))
          .where(eq(signatureRequestRecipients.signatureRequestId, id))
          .orderBy(signatureRequestRecipients.orderIndex);

        res.json({
          ...request,
          document,
          fields,
          recipients,
        });
      } catch (error: any) {
        console.error("Error fetching signature request:", error);
        res.status(500).json({ 
          error: "Failed to fetch signature request",
          message: error.message 
        });
      }
    }
  );

  /**
   * POST /api/signature-requests
   * Create a new signature request with fields and recipients
   */
  app.post(
    "/api/signature-requests",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { 
          clientId, 
          documentId, 
          emailSubject, 
          emailMessage,
          fields,
          recipients 
        } = req.body;

        // Validate document exists and is a PDF
        const [document] = await db
          .select()
          .from(documents)
          .where(eq(documents.id, documentId));

        if (!document) {
          return res.status(404).json({ error: "Document not found" });
        }

        if (!document.fileType.includes('pdf')) {
          return res.status(400).json({ error: "Only PDF documents can be used for e-signatures" });
        }

        // Create signature request
        const [request] = await db
          .insert(signatureRequests)
          .values({
            clientId,
            documentId,
            createdBy: userId,
            status: "draft",
            emailSubject: emailSubject || "Document Signature Request",
            emailMessage,
          })
          .returning();

        // Create signature fields
        if (fields && fields.length > 0) {
          await db.insert(signatureFields).values(
            fields.map((field: any, index: number) => ({
              signatureRequestId: request.id,
              recipientPersonId: field.recipientPersonId,
              fieldType: field.fieldType,
              pageNumber: field.pageNumber,
              xPosition: field.xPosition,
              yPosition: field.yPosition,
              width: field.width,
              height: field.height,
              label: field.label,
              orderIndex: field.orderIndex || index,
            }))
          );
        }

        // Create recipients with secure tokens
        if (recipients && recipients.length > 0) {
          const recipientsWithTokens = recipients.map((recipient: any, index: number) => ({
            signatureRequestId: request.id,
            personId: recipient.personId,
            email: recipient.email,
            secureToken: nanoid(32), // Generate secure 32-character token
            orderIndex: recipient.orderIndex || index,
          }));

          await db.insert(signatureRequestRecipients).values(recipientsWithTokens);
        }

        res.status(201).json(request);
      } catch (error: any) {
        console.error("Error creating signature request:", error);
        res.status(500).json({ 
          error: "Failed to create signature request",
          message: error.message 
        });
      }
    }
  );

  /**
   * POST /api/signature-requests/:id/send
   * Send signature request emails to all recipients
   */
  app.post(
    "/api/signature-requests/:id/send",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res) => {
      try {
        const { id } = req.params;

        // Get signature request
        const [request] = await db
          .select()
          .from(signatureRequests)
          .where(eq(signatureRequests.id, id));

        if (!request) {
          return res.status(404).json({ error: "Signature request not found" });
        }

        // Get recipients
        const recipients = await db
          .select()
          .from(signatureRequestRecipients)
          .where(eq(signatureRequestRecipients.signatureRequestId, id));

        if (recipients.length === 0) {
          return res.status(400).json({ error: "No recipients found for this signature request" });
        }

        // TODO: Send emails via SendGrid (will implement in task 8)
        // For now, just mark as sent and update status
        
        const now = new Date();
        
        // Update recipients to mark as sent
        for (const recipient of recipients) {
          await db
            .update(signatureRequestRecipients)
            .set({ sentAt: now })
            .where(eq(signatureRequestRecipients.id, recipient.id));
        }

        // Update request status to pending
        await db
          .update(signatureRequests)
          .set({ 
            status: "pending",
            updatedAt: now 
          })
          .where(eq(signatureRequests.id, id));

        res.json({ 
          success: true, 
          message: "Signature request sent to all recipients",
          recipientCount: recipients.length 
        });
      } catch (error: any) {
        console.error("Error sending signature request:", error);
        res.status(500).json({ 
          error: "Failed to send signature request",
          message: error.message 
        });
      }
    }
  );

  /**
   * DELETE /api/signature-requests/:id
   * Cancel a signature request
   */
  app.delete(
    "/api/signature-requests/:id",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const userId = req.user.id;

        const [request] = await db
          .select()
          .from(signatureRequests)
          .where(eq(signatureRequests.id, id));

        if (!request) {
          return res.status(404).json({ error: "Signature request not found" });
        }

        if (request.status === "completed") {
          return res.status(400).json({ error: "Cannot cancel a completed signature request" });
        }

        // Update status to cancelled
        await db
          .update(signatureRequests)
          .set({ 
            status: "cancelled",
            cancelledAt: new Date(),
            cancelledBy: userId 
          })
          .where(eq(signatureRequests.id, id));

        res.json({ success: true, message: "Signature request cancelled" });
      } catch (error: any) {
        console.error("Error cancelling signature request:", error);
        res.status(500).json({ 
          error: "Failed to cancel signature request",
          message: error.message 
        });
      }
    }
  );

  // Public routes for signing (no authentication required)

  /**
   * GET /api/sign/:token
   * Get signature request details for a recipient (public route)
   */
  app.get("/api/sign/:token", async (req, res) => {
    try {
      const { token } = req.params;

      // Find recipient by token
      const [recipient] = await db
        .select()
        .from(signatureRequestRecipients)
        .where(eq(signatureRequestRecipients.secureToken, token));

      if (!recipient) {
        return res.status(404).json({ error: "Invalid or expired signature link" });
      }

      // Check if token is expired
      if (recipient.tokenExpiresAt && new Date(recipient.tokenExpiresAt) < new Date()) {
        return res.status(403).json({ error: "This signature link has expired" });
      }

      // Check if already signed
      if (recipient.signedAt) {
        return res.status(400).json({ error: "You have already signed this document" });
      }

      // Get signature request
      const [request] = await db
        .select()
        .from(signatureRequests)
        .where(eq(signatureRequests.id, recipient.signatureRequestId));

      if (!request) {
        return res.status(404).json({ error: "Signature request not found" });
      }

      // Check if request is still pending
      if (request.status === "cancelled") {
        return res.status(400).json({ error: "This signature request has been cancelled" });
      }

      if (request.status === "completed") {
        return res.status(400).json({ error: "This signature request has already been completed" });
      }

      // Get document
      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, request.documentId));

      // Get client
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, request.clientId));

      // Get person
      const [person] = await db
        .select()
        .from(people)
        .where(eq(people.id, recipient.personId));

      // Get signature fields for this recipient
      const fields = await db
        .select()
        .from(signatureFields)
        .where(
          and(
            eq(signatureFields.signatureRequestId, request.id),
            eq(signatureFields.recipientPersonId, recipient.personId)
          )
        )
        .orderBy(signatureFields.orderIndex);

      // Update viewedAt if first time viewing
      if (!recipient.viewedAt) {
        await db
          .update(signatureRequestRecipients)
          .set({ viewedAt: new Date() })
          .where(eq(signatureRequestRecipients.id, recipient.id));
      }

      res.json({
        request: {
          id: request.id,
          emailSubject: request.emailSubject,
          emailMessage: request.emailMessage,
        },
        document: {
          id: document.id,
          fileName: document.fileName,
          fileType: document.fileType,
          objectPath: document.objectPath,
        },
        client: {
          name: client.name,
        },
        recipient: {
          name: person.fullName,
          email: recipient.email,
        },
        fields,
      });
    } catch (error: any) {
      console.error("Error fetching signature request for signing:", error);
      res.status(500).json({ 
        error: "Failed to load signature request",
        message: error.message 
      });
    }
  });

  /**
   * POST /api/sign/:token
   * Submit signatures (public route)
   * This will be implemented in task 5
   */
  app.post("/api/sign/:token", async (req, res) => {
    try {
      // Placeholder - will be fully implemented in task 5
      res.status(501).json({ 
        error: "Signature submission not yet implemented",
        message: "This endpoint will be implemented in task 5" 
      });
    } catch (error: any) {
      console.error("Error submitting signatures:", error);
      res.status(500).json({ 
        error: "Failed to submit signatures",
        message: error.message 
      });
    }
  });
}
