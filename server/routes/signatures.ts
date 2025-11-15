import type { Express } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { 
  signatureRequests, 
  signatureFields, 
  signatureRequestRecipients,
  signatures,
  signatureAuditLogs,
  signedDocuments,
  documents,
  people,
  clients,
  companySettings
} from "../../shared/schema";
import { 
  insertSignatureRequestSchema,
  insertSignatureFieldSchema,
  insertSignatureRequestRecipientSchema 
} from "../../shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import crypto from "crypto";
import { PDFDocument, rgb } from "pdf-lib";
import { ObjectStorageService } from "../objectStorage";
import { sendSignatureRequestEmail, sendCompletedDocumentEmail } from "../lib/sendgrid";
import { sendSignatureRequestCompletedEmail } from "../emailService";
import { UAParser } from "ua-parser-js";
import { generateCertificateOfCompletion } from "../lib/certificateGenerator";
import geoip from "geoip-lite";
import { z } from "zod";

/**
 * Session management constants and helpers
 */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const sessionTokenSchema = z.object({
  sessionToken: z.string().min(20, "Invalid session token")
});

/**
 * Check if a session has expired (30-minute timeout)
 * Treats missing, null, or invalid timestamps as expired
 */
function isSessionExpired(sessionLastActive: Date | string | null): boolean {
  if (!sessionLastActive) return true;
  const lastActiveDate = typeof sessionLastActive === 'string' 
    ? new Date(sessionLastActive) 
    : sessionLastActive;
  // Treat invalid dates (NaN) as expired to prevent stuck sessions
  if (isNaN(lastActiveDate.getTime())) return true;
  return (Date.now() - lastActiveDate.getTime()) >= SESSION_TIMEOUT_MS;
}

/**
 * Helper function to extract IP address from request
 */
function getClientIp(req: any): string {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

/**
 * Helper function to perform geo-lookup on IP address
 * Returns city and country information
 */
function getGeoLocation(ipAddress: string): { city: string | null; country: string | null } {
  if (ipAddress === "unknown" || ipAddress.startsWith("127.") || ipAddress.startsWith("::")) {
    return { city: null, country: null };
  }

  try {
    const geo = geoip.lookup(ipAddress);
    if (geo) {
      return {
        city: geo.city || null,
        country: geo.country || null,
      };
    }
  } catch (error) {
    console.error(`[Geo] Error looking up IP ${ipAddress}:`, error);
  }

  return { city: null, country: null };
}

/**
 * Helper function to create audit log entry with full device/geo tracking
 * CRITICAL: Only pass consentAcceptedAt/signedAt for actual consent/signature events
 */
async function createAuditLog(params: {
  recipientId: string;
  eventType: string;
  signerName: string;
  signerEmail: string;
  req: any;
  documentHash?: string;
  eventDetails?: any; // JSON object for event context
  metadata?: any;
  consentAcceptedAt?: Date | null;
  signedAt?: Date | null;
  consentText?: string;
}) {
  const { 
    recipientId, 
    eventType, 
    signerName, 
    signerEmail, 
    req, 
    documentHash, 
    eventDetails, 
    metadata,
    consentAcceptedAt,
    signedAt,
    consentText
  } = params;

  // Extract IP and user agent
  const ipAddress = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "unknown";

  // Parse user agent for device/browser/OS info
  const parser = new UAParser(userAgent);
  const uaResult = parser.getResult();

  const deviceInfo = uaResult.device.type || "Desktop";
  const browserInfo = uaResult.browser.name
    ? `${uaResult.browser.name} ${uaResult.browser.version || ''}`.trim()
    : "Unknown";
  const osInfo = uaResult.os.name
    ? `${uaResult.os.name} ${uaResult.os.version || ''}`.trim()
    : "Unknown";

  // Perform geo-lookup
  const { city, country } = getGeoLocation(ipAddress);

  // Prepare metadata with consent text if provided
  const fullMetadata = metadata ? { ...metadata } : {};
  if (consentText) {
    fullMetadata.consentText = consentText;
  }

  const [auditLog] = await db
    .insert(signatureAuditLogs)
    .values({
      signatureRequestRecipientId: recipientId,
      eventType,
      eventDetails: eventDetails || null,
      signerName,
      signerEmail,
      ipAddress,
      userAgent,
      deviceInfo,
      browserInfo,
      osInfo,
      city,
      country,
      // CRITICAL: Only set these if explicitly provided (actual consent/signature events)
      // For document_opened, consent_viewed, email_delivered, these will be null
      consentAcceptedAt: consentAcceptedAt !== undefined ? consentAcceptedAt : null,
      signedAt: signedAt !== undefined ? signedAt : null,
      documentHash: documentHash || "unknown",
      documentVersion: "1.0",
      authMethod: "email_link",
      metadata: Object.keys(fullMetadata).length > 0 ? fullMetadata : null,
    })
    .returning();

  console.log(`[Audit] ${eventType} logged for ${signerEmail} from ${ipAddress} (${city || 'Unknown'}, ${country || 'Unknown'})`);
  return auditLog;
}

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
    const recipients = await db
      .select()
      .from(signatureRequestRecipients)
      .where(eq(signatureRequestRecipients.signatureRequestId, signatureRequestId));
    
    const recipientIds = recipients.map(r => r.id);
    
    // Fetch ONLY audit logs for this signature request's recipients (scoped query)
    const allAuditLogs = recipientIds.length > 0
      ? await db
          .select()
          .from(signatureAuditLogs)
          .where(inArray(signatureAuditLogs.signatureRequestRecipientId, recipientIds))
      : [];
    
    // Filter to only completed signature events for this request
    let completedSignatureLogs = allAuditLogs.filter(log => 
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

    // Fetch company logo from settings if available
    let logoBytes: Buffer | undefined;
    try {
      const [settings] = await db
        .select()
        .from(companySettings)
        .limit(1);
      
      if (settings?.logoObjectPath) {
        const logoFile = await objectStorageService.getObjectEntityFile(settings.logoObjectPath);
        const [logoBytesArray] = await logoFile.download();
        logoBytes = Buffer.from(logoBytesArray);
        console.log('[E-Signature] Company logo loaded for certificate');
      }
    } catch (error) {
      console.error('[E-Signature] Error loading company logo:', error);
      // Continue without logo if loading fails
    }

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
        logoBytes, // Pass logo to certificate generator
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

    // Merge signed PDF with certificate into a single combined document
    let combinedPdfPath: string | null = null;
    let combinedPdfSize = signedPdfBytes.length;
    let finalFileName = signedFileName; // Default to signed-only filename
    let finalPdfHash = signedDocumentHash; // Default to signed-only hash
    
    if (certificatePath) {
      try {
        // Load signed PDF
        const signedPdfDoc = await PDFDocument.load(signedPdfBytes);
        
        // Download and load certificate PDF
        const certFile = await objectStorageService.getObjectEntityFile(certificatePath);
        const [certBytes] = await certFile.download();
        const certPdfDoc = await PDFDocument.load(certBytes);
        
        // Create new combined PDF
        const combinedPdfDoc = await PDFDocument.create();
        
        // Copy all pages from signed document
        const signedPages = await combinedPdfDoc.copyPages(
          signedPdfDoc,
          signedPdfDoc.getPageIndices()
        );
        signedPages.forEach(page => combinedPdfDoc.addPage(page));
        
        // Copy all pages from certificate
        const certPages = await combinedPdfDoc.copyPages(
          certPdfDoc,
          certPdfDoc.getPageIndices()
        );
        certPages.forEach(page => combinedPdfDoc.addPage(page));
        
        // Save combined PDF
        const combinedPdfBytes = await combinedPdfDoc.save();
        combinedPdfSize = combinedPdfBytes.length;
        
        // Generate hash of combined PDF (for integrity verification)
        finalPdfHash = crypto
          .createHash('sha256')
          .update(combinedPdfBytes)
          .digest('hex');
        
        // Upload combined PDF
        const combinedFileName = `${document.fileName.replace('.pdf', '')}_Signed_with_Certificate.pdf`;
        const { objectPath: combinedObjectPath, fileName: returnedFileName } = await objectStorageService.uploadSignedDocument(
          signatureRequestId,
          combinedFileName,
          Buffer.from(combinedPdfBytes),
          uploadedBy
        );
        
        combinedPdfPath = combinedObjectPath;
        finalFileName = returnedFileName; // Use actual filename from combined upload
        console.log(`[E-Signature] Combined PDF (signed + certificate) created: ${combinedObjectPath}`);
        console.log(`[E-Signature] Combined PDF hash: ${finalPdfHash}`);
      } catch (error) {
        console.error("[E-Signature] Error creating combined PDF:", error);
        // Fall back to separate files if merge fails
      }
    }

    // Create signed document record with certificate path
    const [signedDoc] = await db
      .insert(signedDocuments)
      .values({
        signatureRequestId,
        clientId,
        signedPdfPath: combinedPdfPath || signedObjectPath, // Use combined if available, otherwise signed only
        originalPdfHash: originalDocumentHash, // Hash of original PDF (pre-signature)
        signedPdfHash: finalPdfHash, // Hash of combined PDF if merge succeeded, otherwise signed-only hash
        auditTrailPdfPath: certificatePath,
        fileName: finalFileName, // Use combined filename if merge succeeded, otherwise signed-only filename
        fileSize: combinedPdfSize,
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
        const statusFilter = req.query.status as string | undefined;

        let query = db
          .select({
            signatureRequest: signatureRequests,
            client: clients,
            createdByPerson: people,
          })
          .from(signatureRequests)
          .leftJoin(clients, eq(signatureRequests.clientId, clients.id))
          .leftJoin(people, eq(signatureRequests.createdBy, people.id));

        if (statusFilter && statusFilter !== "all") {
          query = query.where(eq(signatureRequests.status, statusFilter)) as any;
        }

        const requests = await query.orderBy(desc(signatureRequests.createdAt));

        // Get recipients for each request
        const requestIds = requests.map(r => r.signatureRequest.id);
        const allRecipients = requestIds.length > 0 
          ? await db
              .select()
              .from(signatureRequestRecipients)
              .where(inArray(signatureRequestRecipients.signatureRequestId, requestIds))
          : [];

        // Group recipients by request ID
        const recipientsByRequest = allRecipients.reduce((acc, recipient) => {
          if (!acc[recipient.signatureRequestId]) {
            acc[recipient.signatureRequestId] = [];
          }
          acc[recipient.signatureRequestId].push(recipient);
          return acc;
        }, {} as Record<string, typeof allRecipients>);

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
          } : null,
          createdByPerson: item.createdByPerson ? {
            ...item.createdByPerson,
            createdAt: item.createdByPerson.createdAt
              ? new Date(Number(item.createdByPerson.createdAt)).toISOString()
              : null,
          } : null,
          recipients: (recipientsByRequest[item.signatureRequest.id] || []).map(r => ({
            name: r.name,
            email: r.email,
            signedAt: r.signedAt ? new Date(Number(r.signedAt)).toISOString() : null,
          })),
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
   * GET /api/documents/:id/view-url
   * Get a signed URL for viewing a document (for signature request builder)
   */
  app.get(
    "/api/documents/:id/view-url",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { id } = req.params;

        const [document] = await db
          .select()
          .from(documents)
          .where(eq(documents.id, id));

        if (!document) {
          return res.status(404).json({ error: "Document not found" });
        }

        // Generate signed URL for viewing
        const signedUrl = await storage.getSignedUrl(document.objectPath);

        res.json({ url: signedUrl });
      } catch (error: any) {
        console.error("Error generating view URL:", error);
        res.status(500).json({ 
          error: "Failed to generate view URL",
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
          friendlyName,
          documentId, 
          emailSubject, 
          emailMessage,
          fields,
          recipients,
          redirectUrl,
          reminderEnabled = true,
          reminderIntervalDays = 3
        } = req.body;

        // Validate friendlyName is provided
        if (!friendlyName || friendlyName.trim() === '') {
          return res.status(400).json({ error: "Friendly name is required" });
        }

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

        // Calculate next reminder date if reminders enabled
        const now = new Date();
        const nextReminderDate = reminderEnabled 
          ? new Date(now.getTime() + reminderIntervalDays * 24 * 60 * 60 * 1000)
          : null;

        // Create signature request
        const [request] = await db
          .insert(signatureRequests)
          .values({
            clientId,
            friendlyName: friendlyName.trim(),
            documentId,
            createdBy: userId,
            status: "draft",
            emailSubject: emailSubject || "Document Signature Request",
            emailMessage,
            redirectUrl: redirectUrl || null,
            reminderEnabled,
            reminderIntervalDays,
            remindersSentCount: 0,
            nextReminderDate,
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
        const createdRecipients = [];
        console.log('[Signature Request] Recipients received from frontend:', recipients);
        if (recipients && recipients.length > 0) {
          const recipientsWithTokens = recipients.map((recipient: any, index: number) => ({
            signatureRequestId: request.id,
            personId: recipient.personId,
            email: recipient.email,
            secureToken: nanoid(32), // Generate secure 32-character token
            orderIndex: recipient.orderIndex || index,
          }));

          console.log('[Signature Request] Prepared recipients for insert:', recipientsWithTokens);
          const insertedRecipients = await db.insert(signatureRequestRecipients).values(recipientsWithTokens).returning();
          console.log('[Signature Request] Inserted recipients:', insertedRecipients);
          createdRecipients.push(...insertedRecipients);
        }

        // Send emails immediately after creation
        if (createdRecipients.length > 0) {
          // Get client details for email
          const [client] = await db
            .select()
            .from(clients)
            .where(eq(clients.id, clientId));

          if (!client) {
            return res.status(404).json({ error: "Client not found" });
          }

          const now = new Date();
          const baseUrl = process.env.REPLIT_DEV_DOMAIN 
            ? `https://${process.env.REPLIT_DEV_DOMAIN}`
            : `http://localhost:5000`;

          // Get person details for all recipients in one query
          const personIds = createdRecipients.map(r => r.personId);
          const peopleList = await db
            .select()
            .from(people)
            .where(inArray(people.id, personIds));

          const peopleMap = new Map(peopleList.map(p => [p.id, p]));

          // Get firm name from company settings for email
          const [settings] = await db.select().from(companySettings).limit(1);
          const firmName = settings?.firmName || "The Link";

          // Send emails to all recipients using Promise.allSettled (don't fail entire request if one email fails)
          const emailPromises = createdRecipients.map(async (recipient) => {
            const person = peopleMap.get(recipient.personId);
            if (!person) {
              return { 
                recipientId: recipient.id, 
                success: false, 
                error: 'Person not found' 
              };
            }

            try {
              const signLink = `${baseUrl}/sign?token=${recipient.secureToken}`;
              
              await sendSignatureRequestEmail(
                recipient.email,
                person.fullName || recipient.email,
                firmName,
                request.friendlyName || document.fileName,
                request.emailMessage || "",
                signLink
              );

              // Update recipient to mark as sent with success status
              await db
                .update(signatureRequestRecipients)
                .set({ 
                  sentAt: now,
                  sendStatus: 'sent',
                  sendError: null
                })
                .where(eq(signatureRequestRecipients.id, recipient.id));

              console.log(`[E-Signature] Email sent successfully to ${recipient.email}`);
              return { recipientId: recipient.id, success: true };
            } catch (error: any) {
              console.error(`[E-Signature] Failed to send email to ${recipient.email}:`, error);
              
              // Update recipient with failed status
              await db
                .update(signatureRequestRecipients)
                .set({ 
                  sendStatus: 'failed',
                  sendError: error.message || 'Unknown error'
                })
                .where(eq(signatureRequestRecipients.id, recipient.id));

              return { 
                recipientId: recipient.id, 
                success: false, 
                error: error.message 
              };
            }
          });

          // Wait for all email sends to complete (don't fail the request)
          const emailResults = await Promise.allSettled(emailPromises);
          const successfulSends = emailResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
          const failedSends = emailResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

          console.log(`[E-Signature] Email results: ${successfulSends} sent, ${failedSends} failed`);

          // Update request status to pending (emails sent or attempted)
          await db
            .update(signatureRequests)
            .set({ 
              status: "pending",
              updatedAt: now 
            })
            .where(eq(signatureRequests.id, request.id));
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
        
        // Get firm name from company settings for email
        const [settings] = await db.select().from(companySettings).limit(1);
        const firmName = settings?.firmName || "The Link";
        
        // Send emails to each recipient
        const emailResults = [];
        for (const { recipient, person } of recipientsWithDetails) {
          try {
            const signLink = `${baseUrl}/sign?token=${recipient.secureToken}`;
            
            await sendSignatureRequestEmail(
              recipient.email,
              person.fullName || recipient.email,
              firmName,
              request.friendlyName || document.fileName,
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
   * POST /api/signature-requests/:id/cancel
   * Cancel a signature request with reason and disable reminders
   */
  app.post(
    "/api/signature-requests/:id/cancel",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { cancellation_reason } = req.body;
        const userId = req.user.id;

        // Validate cancellation reason is provided
        if (!cancellation_reason || cancellation_reason.trim().length === 0) {
          return res.status(400).json({ error: "Cancellation reason is required" });
        }

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

        if (request.status === "cancelled") {
          return res.status(400).json({ error: "This signature request is already cancelled" });
        }

        const now = new Date();

        // CRITICAL FIX: Update with concurrency guard - only update if status hasn't changed
        // This prevents race conditions where simultaneous completion could re-enable reminders
        const updateResult = await db
          .update(signatureRequests)
          .set({ 
            status: "cancelled",
            cancellationReason: cancellation_reason.trim(),
            cancelledAt: now,
            cancelledBy: userId,
            reminderEnabled: false, // Disable reminders when cancelled
            nextReminderDate: null, // Clear next reminder date
            updatedAt: now
          })
          .where(
            and(
              eq(signatureRequests.id, id),
              // Concurrency guard: only update if status is still cancellable
              sql`${signatureRequests.status} IN ('draft', 'pending', 'partially_signed')`
            )
          );

        // Check if update actually happened (row was still in cancellable state)
        if (!updateResult || updateResult.rowCount === 0) {
          return res.status(409).json({ 
            error: "Signature request status has changed and can no longer be cancelled" 
          });
        }

        console.log(`[E-Signature] Request ${id} cancelled by user ${userId}. Reason: ${cancellation_reason.trim()}`);

        res.json({ 
          success: true,
          message: "Signature request cancelled successfully" 
        });
      } catch (error: any) {
        console.error("Error cancelling signature request:", error);
        res.status(500).json({ 
          error: "Failed to cancel signature request",
          message: error.message 
        });
      }
    }
  );

  /**
   * DELETE /api/signature-requests/:id
   * Cancel a signature request (legacy endpoint - use POST /cancel instead)
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
   * POST /api/sign/:token/consent-viewed
   * Track when user views consent disclosure (public route)
   */
  app.post("/api/sign/:token/consent-viewed", async (req, res) => {
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

      // Get person and document info for audit log
      const [person] = await db
        .select()
        .from(people)
        .where(eq(people.id, recipient.personId));

      const [request] = await db
        .select()
        .from(signatureRequests)
        .where(eq(signatureRequests.id, recipient.signatureRequestId));

      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, request?.documentId));

      // Fetch firm name from company settings for consent disclosure
      const [settings] = await db.select().from(companySettings).limit(1);
      const firmName = settings?.firmName || "The Link";

      // Log consent view event with full consent disclosure text
      const consentDisclosureText = `
By proceeding, you consent to electronically sign this document under UK eIDAS Regulation.

Your Rights:
- Withdraw consent anytime by contacting ${firmName}
- Request a paper copy at any time
- No penalty for withdrawal or requesting paper copy

Requirements:
- Compatible device with internet access
- Ability to view PDF documents
- Valid email address for authentication

You agree that:
- Electronic signatures have the same legal effect as handwritten
- This consent applies only to this specific document
- Completed documents will be provided electronically
- You consent to UK eIDAS electronic signature standards
      `.trim();

      try {
        await createAuditLog({
          recipientId: recipient.id,
          eventType: "consent_viewed",
          signerName: person?.fullName || recipient.email,
          signerEmail: recipient.email,
          req,
          documentHash: "not_applicable",
          eventDetails: { message: "User viewed consent disclosure" },
          consentText: consentDisclosureText,
          metadata: {
            documentId: document?.id,
            requestId: request?.id,
            timestamp: new Date().toISOString(),
          },
        });

        res.json({ success: true, message: "Consent view logged" });
      } catch (error) {
        console.error("[Audit] Failed to log consent view:", error);
        res.status(500).json({ error: "Failed to log consent view" });
      }
    } catch (error: any) {
      console.error("Error logging consent view:", error);
      res.status(500).json({
        error: "Failed to log consent view",
        message: error.message,
      });
    }
  });

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

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Get client
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, request.clientId));

      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Get person
      const [person] = await db
        .select()
        .from(people)
        .where(eq(people.id, recipient.personId));

      if (!person) {
        return res.status(404).json({ error: "Recipient not found" });
      }

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

      // Update viewedAt and create audit log for document open (only once)
      if (!recipient.viewedAt) {
        // Check if document_opened event already logged (dedupe multiple GETs)
        const [existingOpenLog] = await db
          .select()
          .from(signatureAuditLogs)
          .where(
            and(
              eq(signatureAuditLogs.signatureRequestRecipientId, recipient.id),
              eq(signatureAuditLogs.eventType, "document_opened")
            )
          )
          .limit(1);

        await db
          .update(signatureRequestRecipients)
          .set({ viewedAt: new Date() })
          .where(eq(signatureRequestRecipients.id, recipient.id));

        // Only log if not already logged (prevent duplicate audit entries from repeated GETs)
        if (!existingOpenLog) {
          try {
            await createAuditLog({
              recipientId: recipient.id,
              eventType: "document_opened",
              signerName: person.fullName || recipient.email,
              signerEmail: recipient.email,
              req,
              documentHash: document.fileName || "unknown",
              eventDetails: { message: `Document accessed: ${document.fileName}`, fileName: document.fileName },
              metadata: {
                documentId: document.id,
                requestId: request.id,
                firstView: true,
              },
            });
          } catch (error) {
            console.error("[Audit] Failed to log document open:", error);
            // Don't fail request if audit logging fails
          }
        }
      }

      // Get firm name from company settings
      const [settings] = await db.select().from(companySettings).limit(1);
      const firmName = settings?.firmName || "The Link";

      // Generate signed URL for PDF viewing (15 minute expiry)
      const objectStorageService = new ObjectStorageService();
      const signedPdfUrl = await objectStorageService.getSignedDownloadURL(document.objectPath, 900);

      res.json({
        request: {
          id: request.id,
          friendlyName: request.friendlyName,
          emailSubject: request.emailSubject,
          emailMessage: request.emailMessage,
        },
        document: {
          id: document.id,
          fileName: document.fileName,
          fileType: document.fileType,
          objectPath: document.objectPath,
          signedUrl: signedPdfUrl,
        },
        client: {
          name: client.name,
        },
        recipient: {
          name: person.fullName,
          email: recipient.email,
        },
        firmName,
        redirectUrl: request.redirectUrl || null,
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
   * POST /api/sign/:token/session
   * Claim or refresh signing session (public route)
   * Single-session protection: prevents concurrent signing in multiple browsers
   */
  app.post("/api/sign/:token/session", async (req: any, res) => {
    try {
      const { token } = req.params;
      
      // Validate session token payload
      const validation = sessionTokenSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid session token",
          details: validation.error.errors 
        });
      }

      const { sessionToken } = validation.data;

      // Find recipient by token
      const [recipient] = await db
        .select()
        .from(signatureRequestRecipients)
        .where(eq(signatureRequestRecipients.secureToken, token));

      if (!recipient) {
        return res.status(404).json({ error: "Invalid or expired signature link" });
      }

      // Check if signing token expired
      if (recipient.tokenExpiresAt && new Date(recipient.tokenExpiresAt) < new Date()) {
        return res.status(403).json({ error: "This signature link has expired" });
      }

      // Check if already signed
      if (recipient.signedAt) {
        return res.status(400).json({ error: "This document has already been signed" });
      }

      const now = new Date();

      // If this session already owns the token, just refresh timestamp (heartbeat-style update)
      if (recipient.activeSessionToken === sessionToken) {
        await db
          .update(signatureRequestRecipients)
          .set({ sessionLastActive: now })
          .where(eq(signatureRequestRecipients.id, recipient.id));
        
        return res.json({ success: true, message: "Session refreshed" });
      }

      // Check for active session from another browser
      if (recipient.activeSessionToken && !isSessionExpired(recipient.sessionLastActive)) {
        // Another session is active - return conflict with STORED device info
        return res.status(409).json({
          error: "active_session",
          message: "This document is being signed in another browser",
          sessionLastActive: recipient.sessionLastActive,
          deviceInfo: {
            browser: recipient.sessionBrowserInfo || "Unknown",
            os: recipient.sessionOsInfo || "Unknown",
            device: recipient.sessionDeviceInfo || "Desktop"
          }
        });
      }

      // Session expired or no active session - claim it with device info
      const parser = new UAParser(req.headers["user-agent"] || "");
      const uaResult = parser.getResult();
      
      const deviceInfo = uaResult.device.type || "Desktop";
      const browserInfo = uaResult.browser.name ? 
        `${uaResult.browser.name} ${uaResult.browser.version || ''}`.trim() : 
        "Unknown";
      const osInfo = uaResult.os.name ? 
        `${uaResult.os.name} ${uaResult.os.version || ''}`.trim() : 
        "Unknown";

      await db
        .update(signatureRequestRecipients)
        .set({ 
          activeSessionToken: sessionToken,
          sessionLastActive: now,
          sessionDeviceInfo: deviceInfo,
          sessionBrowserInfo: browserInfo,
          sessionOsInfo: osInfo
        })
        .where(eq(signatureRequestRecipients.id, recipient.id));

      res.json({ success: true, message: "Session claimed" });
    } catch (error: any) {
      console.error("Error claiming session:", error);
      res.status(500).json({ 
        error: "Failed to claim session",
        message: error.message 
      });
    }
  });

  /**
   * POST /api/sign/:token/session/force
   * Force takeover of signing session (public route)
   * Allows user to take control from another browser/tab
   */
  app.post("/api/sign/:token/session/force", async (req: any, res) => {
    try {
      const { token } = req.params;
      
      // Validate session token payload
      const validation = sessionTokenSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid session token",
          details: validation.error.errors 
        });
      }

      const { sessionToken } = validation.data;

      // Find recipient by token
      const [recipient] = await db
        .select()
        .from(signatureRequestRecipients)
        .where(eq(signatureRequestRecipients.secureToken, token));

      if (!recipient) {
        return res.status(404).json({ error: "Invalid or expired signature link" });
      }

      // Check if signing token expired
      if (recipient.tokenExpiresAt && new Date(recipient.tokenExpiresAt) < new Date()) {
        return res.status(403).json({ error: "This signature link has expired" });
      }

      // Check if already signed
      if (recipient.signedAt) {
        return res.status(400).json({ error: "This document has already been signed" });
      }

      const now = new Date();

      // Get person details for audit log
      const [person] = await db
        .select()
        .from(people)
        .where(eq(people.id, recipient.personId));

      // Parse device info for new session
      const parser = new UAParser(req.headers["user-agent"] || "");
      const uaResult = parser.getResult();
      
      const deviceInfo = uaResult.device.type || "Desktop";
      const browserInfo = uaResult.browser.name ? 
        `${uaResult.browser.name} ${uaResult.browser.version || ''}`.trim() : 
        "Unknown";
      const osInfo = uaResult.os.name ? 
        `${uaResult.os.name} ${uaResult.os.version || ''}`.trim() : 
        "Unknown";

      // Force takeover - overwrite session with device info
      await db
        .update(signatureRequestRecipients)
        .set({ 
          activeSessionToken: sessionToken,
          sessionLastActive: now,
          sessionDeviceInfo: deviceInfo,
          sessionBrowserInfo: browserInfo,
          sessionOsInfo: osInfo
        })
        .where(eq(signatureRequestRecipients.id, recipient.id));

      // Log session force takeover for forensics
      await createAuditLog({
        recipientId: recipient.id,
        eventType: "session_forced",
        signerName: person?.fullName || "Unknown",
        signerEmail: recipient.email,
        req,
        eventDetails: { message: "Session forcefully taken over from another browser" },
        metadata: {
          previousSessionToken: recipient.activeSessionToken,
          newSessionToken: sessionToken
        }
      });

      res.json({ success: true, message: "Session taken over" });
    } catch (error: any) {
      console.error("Error forcing session takeover:", error);
      res.status(500).json({ 
        error: "Failed to take over session",
        message: error.message 
      });
    }
  });

  /**
   * PATCH /api/sign/:token/session/heartbeat
   * Update session last active timestamp (public route)
   * Called every 60s to maintain session freshness
   */
  app.patch("/api/sign/:token/session/heartbeat", async (req: any, res) => {
    try {
      const { token } = req.params;
      
      // Validate session token payload
      const validation = sessionTokenSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid session token",
          details: validation.error.errors 
        });
      }

      const { sessionToken } = validation.data;

      // Find recipient by token
      const [recipient] = await db
        .select()
        .from(signatureRequestRecipients)
        .where(eq(signatureRequestRecipients.secureToken, token));

      if (!recipient) {
        return res.status(404).json({ error: "Invalid or expired signature link" });
      }

      // Check session ownership
      if (recipient.activeSessionToken !== sessionToken) {
        return res.status(409).json({ 
          error: "session_taken_over",
          message: "Your session was taken over by another browser" 
        });
      }

      // Check if session expired
      if (isSessionExpired(recipient.sessionLastActive)) {
        return res.status(409).json({ 
          error: "session_expired",
          message: "Session expired due to inactivity (30 minutes)" 
        });
      }

      // Update last active timestamp
      await db
        .update(signatureRequestRecipients)
        .set({ sessionLastActive: new Date() })
        .where(eq(signatureRequestRecipients.id, recipient.id));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating heartbeat:", error);
      res.status(500).json({ 
        error: "Failed to update heartbeat",
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

      // CRITICAL: Session ownership validation (single-session protection)
      // Validate session token exists in request
      const { sessionToken } = req.body;
      if (!sessionToken) {
        return res.status(400).json({ 
          error: "Session token required",
          message: "Please refresh the page and try again" 
        });
      }

      // Verify session ownership - prevent stale submissions after takeover
      if (recipient.activeSessionToken !== sessionToken) {
        return res.status(409).json({ 
          error: "session_lost", 
          message: "Your session was taken over by another browser. Please refresh and try again." 
        });
      }

      // Verify session hasn't expired
      if (isSessionExpired(recipient.sessionLastActive)) {
        return res.status(409).json({ 
          error: "session_expired",
          message: "Session expired due to inactivity (30 minutes). Please refresh and try again." 
        });
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
      const ipAddress = getClientIp(req);
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
        
        // CRITICAL FIX: Update with concurrency guard - only update if status hasn't been cancelled
        // This prevents race conditions where simultaneous cancellation could be overwritten
        const completionUpdateResult = await db
          .update(signatureRequests)
          .set({ 
            status: "completed",
            completedAt: now,
            reminderEnabled: false, // Disable reminders when document is fully signed
            nextReminderDate: null, // Clear next reminder date
            updatedAt: now 
          })
          .where(
            and(
              eq(signatureRequests.id, request.id),
              // Concurrency guard: only update if status is still in progress
              sql`${signatureRequests.status} IN ('pending', 'partially_signed')`
            )
          );

        // Check if update actually happened (wasn't cancelled concurrently)
        if (!completionUpdateResult || completionUpdateResult.rowCount === 0) {
          return res.status(409).json({ 
            error: "Signature request has been cancelled or status has changed" 
          });
        }

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

            // Get firm name from company settings for email
            const [settings] = await db.select().from(companySettings).limit(1);
            const firmName = settings?.firmName || "The Link";

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

            // Generate download links for signed PDF and certificate
            const signedPdfUrl = `${baseUrl}/api/signed-documents/${signedDocumentId}/download`;
            
            // Get signed document record to access paths and generate certificate URL
            const [signedDoc] = await db
              .select()
              .from(signedDocuments)
              .where(eq(signedDocuments.id, signedDocumentId));

            // Generate certificate download URL if certificate exists
            const certificateUrl = signedDoc?.auditTrailPdfPath 
              ? `${baseUrl}/api/signed-documents/${signedDocumentId}/certificate`
              : undefined;

            // Download signed PDF and certificate from object storage for attachments
            let signedPdfBuffer: Buffer | undefined;
            let certificateBuffer: Buffer | undefined;

            if (signedDoc) {
              const objectStorageService = new ObjectStorageService();
              // Download signed PDF for attachment
              try {
                signedPdfBuffer = await objectStorageService.downloadObjectToBuffer(signedDoc.signedPdfPath);
                console.log(`[E-Signature] Downloaded signed PDF for email attachment`);
              } catch (error) {
                console.error(`[E-Signature] Failed to download signed PDF for attachment:`, error);
                // Continue - email will still send with download link
              }

              // Download certificate for attachment if available
              if (signedDoc.auditTrailPdfPath) {
                try {
                  certificateBuffer = await objectStorageService.downloadObjectToBuffer(signedDoc.auditTrailPdfPath);
                  console.log(`[E-Signature] Downloaded certificate for email attachment`);
                } catch (error) {
                  console.error(`[E-Signature] Failed to download certificate for attachment:`, error);
                  // Continue - email will still send with download link
                }
              }
            }

            let emailsSentCount = 0;
            for (const { recipient: recipientData, person: personData } of allRecipientsForEmail) {
              try {
                await sendCompletedDocumentEmail(
                  recipientData.email,
                  personData.fullName || recipientData.email,
                  firmName,
                  client?.name || "Unknown",
                  request.friendlyName || document.fileName,
                  signedPdfUrl,
                  certificateUrl, // CRITICAL: Keep download link for graceful fallback
                  signedPdfBuffer,
                  certificateBuffer
                );
                console.log(`[E-Signature] Completion email sent to ${recipientData.email}`);
                emailsSentCount++;

                // Log email delivery in audit trail
                try {
                  await createAuditLog({
                    recipientId: recipientData.id,
                    eventType: "email_delivered",
                    signerName: personData.fullName || recipientData.email,
                    signerEmail: recipientData.email,
                    req: { ip: "system", headers: {} }, // System-generated, no real IP
                    documentHash: document.fileName || "unknown",
                    eventDetails: { message: "Completion email sent with signed document" },
                    metadata: {
                      documentId: document.id,
                      requestId: request.id,
                      signedDocumentId,
                      emailType: "completion",
                      attachmentsIncluded: !!(signedPdfBuffer && certificateBuffer),
                    },
                  });
                } catch (auditError) {
                  console.error(`[Audit] Failed to log email delivery:`, auditError);
                  // Don't fail email sending if audit logging fails
                }
              } catch (emailError) {
                console.error(`[E-Signature] Failed to send completion email to ${recipientData.email}:`, emailError);
                // Don't fail if email sending fails
              }
            }

            // Update signed document with email sent timestamp if any emails were sent
            if (emailsSentCount > 0 && signedDoc) {
              try {
                await db
                  .update(signedDocuments)
                  .set({ emailSentAt: new Date() })
                  .where(eq(signedDocuments.id, signedDocumentId));
                console.log(`[E-Signature] Updated signed document with email sent timestamp`);
              } catch (error) {
                console.error(`[E-Signature] Failed to update emailSentAt:`, error);
                // Don't fail if update fails
              }
            }

            // Send notification to request creator
            try {
              const [creator] = await db
                .select()
                .from(people)
                .where(eq(people.id, request.createdBy));

              if (creator?.email) {
                const recipientNames = allRecipientsForEmail.map(r => r.person.fullName || r.recipient.email);
                
                await sendSignatureRequestCompletedEmail(
                  creator.email,
                  creator.fullName || creator.email,
                  request.friendlyName || document.fileName,
                  client?.name || "Unknown",
                  now,
                  recipientNames
                );
                console.log(`[E-Signature] Creator notification email sent to ${creator.email}`);
              }
            } catch (error) {
              console.error("[E-Signature] Error sending creator notification:", error);
              // Don't fail signature submission if creator notification fails
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
