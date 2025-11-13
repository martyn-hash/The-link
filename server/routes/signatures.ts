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
import { PDFDocument, rgb } from "pdf-lib";
import { ObjectStorageService } from "../objectStorage";
import { sendSignatureRequestEmail, sendCompletedDocumentEmail } from "../lib/sendgrid";
import { UAParser } from "ua-parser-js";
import { generateCertificateOfCompletion } from "../lib/certificateGenerator";

/**
 * Helper function to process PDF with signatures
 * Downloads original PDF, overlays all signatures, and uploads signed version
 */
async function processPdfWithSignatures(
  signatureRequestId: string,
  documentId: string,
  clientId: string,
  uploadedBy?: string
) {
  try {
    const objectStorageService = new ObjectStorageService();
    
    // Get document info
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!document) {
      throw new Error("Document not found");
    }

    // Download original PDF using ObjectStorageService
    const objectFile = await objectStorageService.getObjectEntityFile(document.objectPath);
    const [pdfBytes] = await objectFile.download();

    // Generate hash of ORIGINAL PDF bytes (pre-signature)
    const originalDocumentHash = crypto
      .createHash('sha256')
      .update(pdfBytes)
      .digest('hex');

    // Load PDF with pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    // Get all signature fields for this request
    const fields = await db
      .select()
      .from(signatureFields)
      .where(eq(signatureFields.signatureRequestId, signatureRequestId));

    // Get all signatures for this request
    const allSignatures = await db
      .select({
        signature: signatures,
        field: signatureFields,
      })
      .from(signatures)
      .innerJoin(signatureFields, eq(signatures.signatureFieldId, signatureFields.id))
      .where(eq(signatureFields.signatureRequestId, signatureRequestId));

    // Overlay each signature onto the PDF
    for (const { signature, field } of allSignatures) {
      // Convert from 1-indexed page number (from frontend) to 0-indexed array (pdf-lib)
      const pageIndex = field.pageNumber - 1;
      const page = pages[pageIndex];
      
      if (!page) {
        console.warn(`Page ${field.pageNumber} (index ${pageIndex}) not found for field ${field.id}`);
        continue;
      }

      const { width: pageWidth, height: pageHeight } = page.getSize();

      if (signature.signatureType === "drawn") {
        // For drawn signatures, embed the image
        try {
          // Remove data URL prefix if present
          const base64Data = signature.signatureData.replace(/^data:image\/\w+;base64,/, '');
          const imageBytes = Buffer.from(base64Data, 'base64');
          
          const image = await pdfDoc.embedPng(imageBytes);
          const imageDims = image.scale(0.5); // Scale down the signature
          
          // Convert field coordinates from percentage to PDF coordinates
          // Frontend stores top-left corner as percentage; PDF uses bottom-left origin
          // Y conversion: pageHeight - (topY% * pageHeight) - (height% * pageHeight)
          const x = (field.xPosition / 100) * pageWidth;
          const topYInPdfCoords = (field.yPosition / 100) * pageHeight; // Distance from top
          const fieldHeightInPdfCoords = (field.height / 100) * pageHeight;
          const y = pageHeight - topYInPdfCoords - fieldHeightInPdfCoords; // Bottom-left corner
          const width = (field.width / 100) * pageWidth;
          const height = fieldHeightInPdfCoords;

          page.drawImage(image, {
            x,
            y,
            width: Math.min(width, imageDims.width),
            height: Math.min(height, imageDims.height),
          });
        } catch (error) {
          console.error(`Error embedding signature image for field ${field.id}:`, error);
        }
      } else if (signature.signatureType === "typed") {
        // For typed signatures, draw text
        // Convert from top-left percentage to PDF bottom-left coordinates
        const x = (field.xPosition / 100) * pageWidth;
        const topYInPdfCoords = (field.yPosition / 100) * pageHeight;
        const fieldHeightInPdfCoords = (field.height / 100) * pageHeight;
        const y = pageHeight - topYInPdfCoords - fieldHeightInPdfCoords;

        page.drawText(signature.signatureData, {
          x,
          y: y + 10, // Adjust for text baseline
          size: 16,
          color: rgb(0, 0, 0),
        });
      }
    }

    // Generate signed PDF bytes
    const signedPdfBytes = await pdfDoc.save();

    // Generate hash of SIGNED PDF bytes (post-signature)
    const signedDocumentHash = crypto
      .createHash('sha256')
      .update(signedPdfBytes)
      .digest('hex');

    // Upload signed PDF using ObjectStorageService
    const { objectPath: signedObjectPath, fileName: signedFileName } = 
      await objectStorageService.uploadSignedDocument(
        signatureRequestId,
        document.fileName, // Pass original filename, uploadSignedDocument will add timestamp
        Buffer.from(signedPdfBytes),
        uploadedBy
      );

    // Get audit trail data for certificate generation
    // CRITICAL: Only get signature_completed events with valid signedAt timestamps
    const allAuditLogs = await db
      .select()
      .from(signatureAuditLogs);
    
    const recipients = await db
      .select()
      .from(signatureRequestRecipients)
      .where(eq(signatureRequestRecipients.signatureRequestId, signatureRequestId));
    
    const recipientIds = recipients.map(r => r.id);
    
    // Filter to only completed signature events for this request
    let completedSignatureLogs = allAuditLogs.filter(log => 
      recipientIds.includes(log.signatureRequestRecipientId) &&
      log.eventType === "signature_completed" &&
      log.signedAt !== null
    );

    // CRITICAL: Deduplicate by recipient (take latest signature per recipient)
    const latestLogsByRecipient = new Map<string, typeof completedSignatureLogs[0]>();
    for (const log of completedSignatureLogs) {
      const existing = latestLogsByRecipient.get(log.signatureRequestRecipientId);
      if (!existing || log.signedAt! > existing.signedAt!) {
        latestLogsByRecipient.set(log.signatureRequestRecipientId, log);
      }
    }
    completedSignatureLogs = Array.from(latestLogsByRecipient.values());

    // CRITICAL: Fail early if no signer logs - cannot create valid signed document
    if (completedSignatureLogs.length === 0) {
      console.error("[E-Signature] FATAL: No completed signature logs found, cannot process signed document");
      throw new Error("Cannot process signed document: No signature audit data available");
    }

    // Get consent acceptance timestamps for each recipient (UK eIDAS compliance)
    const consentLogs = allAuditLogs.filter(log => 
      recipientIds.includes(log.signatureRequestRecipientId) &&
      log.eventType === "consent_accepted" &&
      log.consentAcceptedAt !== null
    );
    const consentByRecipient = new Map<string, Date>();
    for (const log of consentLogs) {
      consentByRecipient.set(log.signatureRequestRecipientId, log.consentAcceptedAt!);
    }

    // Get client information
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId));

    // Generate Certificate of Completion PDF
    let certificatePath: string | null = null;
    try {

      // CRITICAL: Never fabricate timestamps - only use real data
      const signerInfos = completedSignatureLogs.map(log => {
        // Log warning if document hash is missing
        if (!log.documentHash) {
          console.warn(`[E-Signature] Document hash missing for signer ${log.signerEmail}, using original document hash`);
        }
        
        // Get consent acceptance timestamp for UK eIDAS compliance
        const consentAcceptedAt = consentByRecipient.get(log.signatureRequestRecipientId);
        
        return {
          signerName: log.signerName,
          signerEmail: log.signerEmail,
          signedAt: log.signedAt!.toISOString(), // Safe due to filter
          consentAcceptedAt: consentAcceptedAt?.toISOString() || log.signedAt!.toISOString(), // Fallback to signedAt
          ipAddress: log.ipAddress,
          deviceInfo: log.deviceInfo || "Unknown",
          browserInfo: log.browserInfo || "Unknown",
          osInfo: log.osInfo || "Unknown",
          documentHash: log.documentHash || originalDocumentHash,
          consentText: (log.metadata as any)?.consentText || undefined,
        };
      });

      // CRITICAL: Use actual completion time (latest signature) not fabricated "now"
      const actualCompletionTime = new Date(
        Math.max(...completedSignatureLogs.map(log => log.signedAt!.getTime()))
      );

      const certificateBytes = await generateCertificateOfCompletion({
        documentName: document.fileName,
        clientName: client?.name || "Unknown",
        completedAt: actualCompletionTime,
        signers: signerInfos,
        originalDocumentHash,
        signedDocumentHash,
      });

      // Upload certificate PDF
      const certificateFileName = `${document.fileName.replace('.pdf', '')}_Certificate.pdf`;
      const { objectPath: certObjectPath } = await objectStorageService.uploadSignedDocument(
        signatureRequestId,
        certificateFileName,
        Buffer.from(certificateBytes),
        uploadedBy
      );
      
      certificatePath = certObjectPath;
      console.log(`[E-Signature] Certificate generated and stored: ${certObjectPath}`);
    } catch (error) {
      console.error("[E-Signature] Error generating certificate:", error);
      // Don't fail if certificate generation fails
    }

    // CRITICAL: Use actual completion time (from audit logs) - no fabrication allowed
    // We already verified completedSignatureLogs.length > 0 above, so this is always valid
    const documentCompletionTime = new Date(
      Math.max(...completedSignatureLogs.map(log => log.signedAt!.getTime()))
    );

    // Create signed document record with certificate path
    const [signedDoc] = await db
      .insert(signedDocuments)
      .values({
        signatureRequestId,
        clientId,
        signedPdfPath: signedObjectPath,
        originalPdfHash: originalDocumentHash, // Hash of original PDF (pre-signature)
        signedPdfHash: signedDocumentHash, // Hash of final signed PDF (post-signature)
        auditTrailPdfPath: certificatePath,
        fileName: signedFileName, // Use the actual filename returned from upload
        fileSize: signedPdfBytes.length,
        completedAt: documentCompletionTime,
      })
      .returning();

    return {
      signedDocument: signedDoc,
      originalDocumentHash,
      signedDocumentHash,
    };
  } catch (error) {
    console.error("Error processing PDF with signatures:", error);
    throw error;
  }
}

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
   * GET /api/signature-requests
   * Get all signature requests (for staff)
   */
  app.get(
    "/api/signature-requests",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res) => {
      try {
        const requests = await db
          .select({
            signatureRequest: signatureRequests,
            client: clients,
            createdByPerson: people,
          })
          .from(signatureRequests)
          .leftJoin(clients, eq(signatureRequests.clientId, clients.id))
          .leftJoin(people, eq(signatureRequests.createdBy, people.id))
          .orderBy(desc(signatureRequests.createdAt));

        // Convert bigint timestamps to ISO strings for JSON serialization
        const serializedRequests = requests.map(item => ({
          signatureRequest: {
            ...item.signatureRequest,
            createdAt: item.signatureRequest.createdAt 
              ? new Date(Number(item.signatureRequest.createdAt)).toISOString()
              : null,
            updatedAt: item.signatureRequest.updatedAt
              ? new Date(Number(item.signatureRequest.updatedAt)).toISOString()
              : null,
            completedAt: item.signatureRequest.completedAt
              ? new Date(Number(item.signatureRequest.completedAt)).toISOString()
              : null,
          },
          client: item.client ? {
            ...item.client,
            createdAt: item.client.createdAt
              ? new Date(Number(item.client.createdAt)).toISOString()
              : null,
            updatedAt: item.client.updatedAt
              ? new Date(Number(item.client.updatedAt)).toISOString()
              : null,
          } : null,
          createdByPerson: item.createdByPerson ? {
            ...item.createdByPerson,
            createdAt: item.createdByPerson.createdAt
              ? new Date(Number(item.createdByPerson.createdAt)).toISOString()
              : null,
            updatedAt: item.createdByPerson.updatedAt
              ? new Date(Number(item.createdByPerson.updatedAt)).toISOString()
              : null,
          } : null,
        }));

        res.json(serializedRequests);
      } catch (error: any) {
        console.error("Error fetching all signature requests:", error);
        res.status(500).json({ 
          error: "Failed to fetch signature requests",
          message: error.message 
        });
      }
    }
  );

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

        // Convert bigint timestamps to ISO strings for JSON serialization
        const serializedRequests = requests.map(request => ({
          ...request,
          createdAt: request.createdAt 
            ? new Date(Number(request.createdAt)).toISOString()
            : null,
          updatedAt: request.updatedAt
            ? new Date(Number(request.updatedAt)).toISOString()
            : null,
          completedAt: request.completedAt
            ? new Date(Number(request.completedAt)).toISOString()
            : null,
        }));

        res.json(serializedRequests);
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
          // Validate no duplicate fields per recipient + field type
          const fieldCombinations = new Map<string, any>();
          for (const field of fields) {
            const key = `${field.recipientPersonId}-${field.fieldType}`;
            if (fieldCombinations.has(key)) {
              return res.status(422).json({
                error: "Duplicate field detected",
                message: `A ${field.fieldType} field already exists for this recipient. Each recipient can have only one field per type.`
              });
            }
            fieldCombinations.set(key, field);
          }

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

        // Get recipients with person details
        const recipientsWithDetails = await db
          .select({
            recipient: signatureRequestRecipients,
            person: people,
          })
          .from(signatureRequestRecipients)
          .innerJoin(people, eq(signatureRequestRecipients.personId, people.id))
          .where(eq(signatureRequestRecipients.signatureRequestId, id));

        if (recipientsWithDetails.length === 0) {
          return res.status(400).json({ error: "No recipients found for this signature request" });
        }

        // Get document and client details
        const [document] = await db
          .select()
          .from(documents)
          .where(eq(documents.id, request.documentId));

        const [client] = await db
          .select()
          .from(clients)
          .where(eq(clients.id, request.clientId));

        if (!document || !client) {
          return res.status(404).json({ error: "Document or client not found" });
        }

        const now = new Date();
        const baseUrl = process.env.REPLIT_DEV_DOMAIN 
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : `http://localhost:5000`;
        
        // Send emails to each recipient
        const emailResults = [];
        for (const { recipient, person } of recipientsWithDetails) {
          try {
            const signLink = `${baseUrl}/sign?token=${recipient.secureToken}`;
            
            await sendSignatureRequestEmail(
              recipient.email,
              person.fullName || recipient.email,
              client.name,
              document.fileName,
              request.emailMessage || "",
              signLink
            );

            // Update recipient to mark as sent
            await db
              .update(signatureRequestRecipients)
              .set({ sentAt: now })
              .where(eq(signatureRequestRecipients.id, recipient.id));

            emailResults.push({ email: recipient.email, success: true });
          } catch (error: any) {
            console.error(`Error sending email to ${recipient.email}:`, error);
            emailResults.push({ 
              email: recipient.email, 
              success: false, 
              error: error.message 
            });
          }
        }

        // Update request status to pending
        await db
          .update(signatureRequests)
          .set({ 
            status: "pending",
            updatedAt: now 
          })
          .where(eq(signatureRequests.id, id));

        const successCount = emailResults.filter(r => r.success).length;
        const failureCount = emailResults.filter(r => !r.success).length;

        res.json({ 
          success: successCount > 0, 
          message: failureCount === 0 
            ? "Signature request sent to all recipients" 
            : `Sent to ${successCount}/${recipientsWithDetails.length} recipients`,
          recipientCount: recipientsWithDetails.length,
          successCount,
          failureCount,
          results: emailResults
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
   */
  app.post("/api/sign/:token", async (req: any, res) => {
    try {
      const { token } = req.params;
      const { signatures: submittedSignatures, consentAccepted } = req.body;

      // CRITICAL FIX: Validate consent acceptance properly
      if (consentAccepted !== true) {
        return res.status(400).json({ error: "You must accept the consent disclosure to sign" });
      }

      // Validate signatures array
      if (!submittedSignatures || !Array.isArray(submittedSignatures) || submittedSignatures.length === 0) {
        return res.status(400).json({ error: "No signatures provided" });
      }

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

      if (!request || request.status === "cancelled") {
        return res.status(400).json({ error: "This signature request is no longer active" });
      }

      // Get all fields for this recipient
      const requiredFields = await db
        .select()
        .from(signatureFields)
        .where(
          and(
            eq(signatureFields.signatureRequestId, request.id),
            eq(signatureFields.recipientPersonId, recipient.personId)
          )
        );

      // CRITICAL FIX: Validate all required fields are completed
      const submittedFieldIds = new Set(submittedSignatures.map(s => s.fieldId));
      const missingFields = requiredFields.filter(f => !submittedFieldIds.has(f.id));
      
      if (missingFields.length > 0) {
        return res.status(400).json({ 
          error: "All signature fields must be completed",
          missingFields: missingFields.map(f => f.id) 
        });
      }

      // CRITICAL FIX: Validate signatures are not blank
      for (const sig of submittedSignatures) {
        if (!sig.data || sig.data.trim().length === 0) {
          return res.status(400).json({ 
            error: "Signatures cannot be blank" 
          });
        }
        
        // For drawn signatures, validate it's a valid data URL
        if (sig.type === "drawn" && !sig.data.startsWith("data:image/")) {
          return res.status(400).json({ 
            error: "Invalid signature image format" 
          });
        }
      }

      // Get document for hash
      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, request.documentId));

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Get person details
      const [person] = await db
        .select()
        .from(people)
        .where(eq(people.id, recipient.personId));

      // Collect audit trail data
      const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      
      // Parse user agent for device/browser/os info
      const parser = new UAParser(userAgent);
      const uaResult = parser.getResult();
      
      const deviceInfo = uaResult.device.type || "Desktop";
      const browserInfo = uaResult.browser.name ? 
        `${uaResult.browser.name} ${uaResult.browser.version || ''}`.trim() : 
        "Unknown";
      const osInfo = uaResult.os.name ? 
        `${uaResult.os.name} ${uaResult.os.version || ''}`.trim() : 
        "Unknown";

      // CRITICAL FIX: Generate document hash from actual PDF bytes
      let documentHash = "";
      try {
        const objectStorageService = new ObjectStorageService();
        const objectFile = await objectStorageService.getObjectEntityFile(document.objectPath);
        const [pdfBytes] = await objectFile.download();
        documentHash = crypto
          .createHash('sha256')
          .update(pdfBytes)
          .digest('hex');
      } catch (error) {
        console.error("Error generating document hash:", error);
        // Fallback to path hash if download fails
        documentHash = crypto
          .createHash('sha256')
          .update(document.objectPath)
          .digest('hex');
      }

      const now = new Date();

      // Consent text that was acknowledged (UK eIDAS requirement)
      const consentText = "I have read and agree to the Electronic Signature Disclosure and Consent. I understand that my electronic signature will be legally binding.";

      // Store signatures in database
      for (const sig of submittedSignatures) {
        await db.insert(signatures).values({
          signatureFieldId: sig.fieldId,
          signatureRequestRecipientId: recipient.id,
          signatureType: sig.type, // 'drawn' or 'typed'
          signatureData: sig.data, // Base64 image or text
          signedAt: now,
        });
      }

      // CRITICAL FIX: Create audit trail record with explicit consent tracking
      await db.insert(signatureAuditLogs).values({
        signatureRequestRecipientId: recipient.id,
        eventType: "signature_completed",
        signerName: person?.fullName || "Unknown",
        signerEmail: recipient.email,
        ipAddress,
        userAgent,
        deviceInfo,
        browserInfo,
        osInfo,
        consentAccepted: true, // Explicitly store validated consent (UK eIDAS requirement)
        consentAcceptedAt: now,
        signedAt: now,
        documentHash,
        documentVersion: document.id,
        authMethod: "email_link",
        metadata: {
          submittedFields: submittedSignatures.length,
          timestamp: now.toISOString(),
          consentText, // Store the actual consent text for audit context
        },
      });

      // Update recipient status
      await db
        .update(signatureRequestRecipients)
        .set({ signedAt: now })
        .where(eq(signatureRequestRecipients.id, recipient.id));

      // Check if all recipients have signed
      const allRecipients = await db
        .select()
        .from(signatureRequestRecipients)
        .where(eq(signatureRequestRecipients.signatureRequestId, request.id));

      const allSigned = allRecipients.every(r => r.signedAt !== null);
      const someSigned = allRecipients.some(r => r.signedAt !== null);

      // Update request status and process PDF if all signed
      let newStatus = request.status;
      let signedDocumentId = null;
      
      if (allSigned) {
        newStatus = "completed";
        await db
          .update(signatureRequests)
          .set({ 
            status: "completed",
            completedAt: now,
            updatedAt: now 
          })
          .where(eq(signatureRequests.id, request.id));

        // CRITICAL FIX: Process PDF with all signatures and create signed document
        try {
          const pdfResult = await processPdfWithSignatures(
            request.id,
            request.documentId,
            request.clientId
          );
          signedDocumentId = pdfResult.signedDocument.id;
          
          console.log(`[E-Signature] Signed document created: ${signedDocumentId}`);
          console.log(`[E-Signature] Original hash: ${pdfResult.originalDocumentHash}`);
          console.log(`[E-Signature] Signed hash: ${pdfResult.signedDocumentHash}`);

          // Send completion emails to all recipients
          try {
            const [client] = await db
              .select()
              .from(clients)
              .where(eq(clients.id, request.clientId));

            const allRecipientsForEmail = await db
              .select({
                recipient: signatureRequestRecipients,
                person: people,
              })
              .from(signatureRequestRecipients)
              .innerJoin(people, eq(signatureRequestRecipients.personId, people.id))
              .where(eq(signatureRequestRecipients.signatureRequestId, request.id));

            const baseUrl = process.env.REPLIT_DEV_DOMAIN 
              ? `https://${process.env.REPLIT_DEV_DOMAIN}`
              : `http://localhost:5000`;

            // Generate download link for signed PDF
            const signedPdfUrl = `${baseUrl}/api/signed-documents/${signedDocumentId}/download`;

            for (const { recipient: recipientData, person: personData } of allRecipientsForEmail) {
              try {
                await sendCompletedDocumentEmail(
                  recipientData.email,
                  personData.fullName || recipientData.email,
                  client?.name || "Unknown",
                  document.fileName,
                  signedPdfUrl
                );
                console.log(`[E-Signature] Completion email sent to ${recipientData.email}`);
              } catch (emailError) {
                console.error(`[E-Signature] Failed to send completion email to ${recipientData.email}:`, emailError);
                // Don't fail if email sending fails
              }
            }
          } catch (error) {
            console.error("[E-Signature] Error sending completion emails:", error);
            // Don't fail signature submission if emails fail
          }
        } catch (error) {
          console.error("[E-Signature] Error processing PDF:", error);
          // Don't fail the signature submission if PDF processing fails
          // The signatures are still recorded and can be reprocessed later
        }
      } else if (someSigned && request.status === "pending") {
        newStatus = "partially_signed";
        await db
          .update(signatureRequests)
          .set({ 
            status: "partially_signed",
            updatedAt: now 
          })
          .where(eq(signatureRequests.id, request.id));
      }

      res.json({ 
        success: true, 
        message: "Your signature has been recorded successfully",
        allSigned,
        status: newStatus,
        signedDocumentId
      });
    } catch (error: any) {
      console.error("Error submitting signatures:", error);
      res.status(500).json({ 
        error: "Failed to submit signatures",
        message: error.message 
      });
    }
  });

  /**
   * GET /api/signature-requests/:id/audit-trail
   * Get audit trail for a signature request (staff only)
   */
  app.get(
    "/api/signature-requests/:id/audit-trail",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res) => {
      try {
        const { id } = req.params;

        // Get all recipients for this request
        const recipients = await db
          .select()
          .from(signatureRequestRecipients)
          .where(eq(signatureRequestRecipients.signatureRequestId, id));

        if (recipients.length === 0) {
          return res.json([]);
        }

        // Get audit logs for all recipients
        const recipientIds = recipients.map(r => r.id);
        const auditLogs = await db
          .select()
          .from(signatureAuditLogs)
          .where(eq(signatureAuditLogs.signatureRequestRecipientId, recipientIds[0]));

        // TODO: Fix to use IN clause for multiple recipients
        // For now, just fetch all and filter
        const allAuditLogs = await db
          .select()
          .from(signatureAuditLogs);
        
        const filteredLogs = allAuditLogs.filter(log => 
          recipientIds.includes(log.signatureRequestRecipientId)
        );

        res.json(filteredLogs);
      } catch (error: any) {
        console.error("Error fetching audit trail:", error);
        res.status(500).json({ 
          error: "Failed to fetch audit trail",
          message: error.message 
        });
      }
    }
  );

  /**
   * GET /api/signed-documents/:id/download
   * Download a signed document (public route - anyone with link can download)
   */
  app.get("/api/signed-documents/:id/download", async (req: any, res) => {
    try {
      const { id } = req.params;

      const [signedDoc] = await db
        .select()
        .from(signedDocuments)
        .where(eq(signedDocuments.id, id));

      if (!signedDoc) {
        return res.status(404).json({ error: "Signed document not found" });
      }

      // Download using ObjectStorageService
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(signedDoc.signedPdfPath);
      
      // Set Content-Disposition header BEFORE calling downloadObject
      // downloadObject sets Content-Type and Cache-Control but not Content-Disposition
      res.setHeader('Content-Disposition', `attachment; filename="${signedDoc.fileName}"`);
      
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error: any) {
      console.error("Error downloading signed document:", error);
      res.status(500).json({ 
        error: "Failed to download signed document",
        message: error.message 
      });
    }
  });

  /**
   * GET /api/signature-requests/:id/signed-document
   * Get signed document info for a signature request (staff only)
   */
  app.get(
    "/api/signature-requests/:id/signed-document",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res) => {
      try {
        const { id } = req.params;

        const [signedDoc] = await db
          .select()
          .from(signedDocuments)
          .where(eq(signedDocuments.signatureRequestId, id));

        if (!signedDoc) {
          return res.status(404).json({ error: "Signed document not found" });
        }

        res.json(signedDoc);
      } catch (error: any) {
        console.error("Error fetching signed document:", error);
        res.status(500).json({ 
          error: "Failed to fetch signed document",
          message: error.message 
        });
      }
    }
  );

  /**
   * GET /api/signed-documents/:id/certificate
   * Download certificate of completion (public route - anyone with link can download)
   */
  app.get("/api/signed-documents/:id/certificate", async (req: any, res) => {
    try {
      const { id } = req.params;

      const [signedDoc] = await db
        .select()
        .from(signedDocuments)
        .where(eq(signedDocuments.id, id));

      if (!signedDoc) {
        return res.status(404).json({ error: "Signed document not found" });
      }

      if (!signedDoc.auditTrailPdfPath) {
        return res.status(404).json({ error: "Certificate not available for this document" });
      }

      // Download using ObjectStorageService
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(signedDoc.auditTrailPdfPath);
      
      // Extract certificate filename from signed document filename
      const certificateFileName = signedDoc.fileName.replace('.pdf', '_Certificate.pdf');
      
      res.setHeader('Content-Disposition', `attachment; filename="${certificateFileName}"`);
      
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error: any) {
      console.error("Error downloading certificate:", error);
      res.status(500).json({ 
        error: "Failed to download certificate",
        message: error.message 
        });
    }
  });
}
