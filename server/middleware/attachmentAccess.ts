/**
 * Attachment Access Control Middleware
 * Verifies that users can only access attachments they're authorized to view
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { messages, messageThreads, documents } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { verifyJWT } from '../portalAuth';
import { storage } from '../storage';

/**
 * Verifies if a user has access to a specific message thread
 * @param userId - Staff user ID (if authenticated as staff)
 * @param portalUserId - Portal user ID (if authenticated as portal user)
 * @param threadId - The thread ID to check access for
 * @returns Object with hasAccess boolean and clientId if access is granted
 */
export async function verifyThreadAccess(
  userId: string | undefined,
  portalUserId: string | undefined,
  threadId: string
): Promise<{ hasAccess: boolean; clientId?: string }> {
  try {
    // Get the thread
    const thread = await db.query.messageThreads.findFirst({
      where: eq(messageThreads.id, threadId),
      columns: {
        id: true,
        clientId: true,
      },
    });

    if (!thread) {
      return { hasAccess: false };
    }

    // Staff users can access all threads
    if (userId) {
      return { hasAccess: true, clientId: thread.clientId };
    }

    // Portal users can only access threads for their own client
    if (portalUserId) {
      // Get the portal user's client ID
      const portalUser = await db.query.clientPortalUsers.findFirst({
        where: (clientPortalUsers, { eq }) => eq(clientPortalUsers.id, portalUserId),
        columns: {
          clientId: true,
        },
      });

      if (portalUser && portalUser.clientId === thread.clientId) {
        return { hasAccess: true, clientId: thread.clientId };
      }
    }

    return { hasAccess: false };
  } catch (error) {
    console.error('Error verifying thread access:', error);
    return { hasAccess: false };
  }
}

/**
 * Verifies if a user has access to a specific attachment/document
 * @param userId - Staff user ID (if authenticated as staff)
 * @param portalUserId - Portal user ID (if authenticated as portal user)
 * @param objectPath - The object path of the attachment
 * @returns Object with hasAccess boolean
 */
export async function verifyAttachmentAccess(
  userId: string | undefined,
  portalUserId: string | undefined,
  objectPath: string
): Promise<{ hasAccess: boolean; clientId?: string }> {
  try {
    // First, check if this attachment is linked to a message
    const [message] = await db
      .select({
        id: messages.id,
        threadId: messages.threadId,
        userId: messages.userId,
        clientPortalUserId: messages.clientPortalUserId,
        attachments: messages.attachments,
      })
      .from(messages)
      .where(eq(messages.id, messages.id)) // We'll need to search through attachments JSON
      .limit(1);

    // If it's a message attachment, verify thread access
    if (message && message.threadId) {
      return verifyThreadAccess(userId, portalUserId, message.threadId);
    }

    // Otherwise, check if it's a document
    const document = await db.query.documents.findFirst({
      where: eq(documents.objectPath, objectPath),
      columns: {
        id: true,
        clientId: true,
        uploadedBy: true,
        clientPortalUserId: true,
        messageId: true,
        threadId: true,
      },
    });

    if (!document) {
      return { hasAccess: false };
    }

    // If document is linked to a thread, verify thread access
    if (document.threadId) {
      return verifyThreadAccess(userId, portalUserId, document.threadId);
    }

    // Staff users can access all documents
    if (userId) {
      return { hasAccess: true, clientId: document.clientId };
    }

    // Portal users can only access documents for their own client
    if (portalUserId) {
      // Get the portal user's client ID
      const portalUser = await db.query.clientPortalUsers.findFirst({
        where: (clientPortalUsers, { eq }) => eq(clientPortalUsers.id, portalUserId),
        columns: {
          clientId: true,
        },
      });

      if (portalUser && portalUser.clientId === document.clientId) {
        return { hasAccess: true, clientId: document.clientId };
      }
    }

    return { hasAccess: false };
  } catch (error) {
    console.error('Error verifying attachment access:', error);
    return { hasAccess: false };
  }
}

/**
 * Express middleware to verify message attachment access
 * Requires threadId to be provided in query parameters
 */
export async function verifyMessageAttachmentAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = (req as any).user;
    const portalUser = (req as any).portalUser;
    const threadId = req.query.threadId as string;

    if (!threadId) {
      return res.status(400).json({ message: 'threadId is required' });
    }

    const { hasAccess } = await verifyThreadAccess(
      user?.id,
      portalUser?.id,
      threadId
    );

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this attachment' });
    }

    // Attach to request for downstream use
    (req as any).verified = {
      hasAccess: true,
      threadId,
    };

    next();
  } catch (error) {
    console.error('Error in verifyMessageAttachmentAccess middleware:', error);
    return res.status(500).json({ message: 'Error verifying access' });
  }
}

/**
 * Express middleware to verify document access
 */
export async function verifyDocumentAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = (req as any).user;
    const portalUser = (req as any).portalUser;
    const documentId = req.params.id || req.params.documentId;

    if (!documentId) {
      return res.status(400).json({ message: 'Document ID is required' });
    }

    // Get the document
    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
      columns: {
        id: true,
        clientId: true,
        objectPath: true,
        threadId: true,
      },
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // If document is linked to a thread, verify thread access
    if (document.threadId) {
      const { hasAccess } = await verifyThreadAccess(
        user?.id,
        portalUser?.id,
        document.threadId
      );

      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied to this document' });
      }
    } else {
      // Verify document access directly
      const { hasAccess } = await verifyAttachmentAccess(
        user?.id,
        portalUser?.id,
        document.objectPath
      );

      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied to this document' });
      }
    }

    // Attach document to request for downstream use
    (req as any).document = document;

    next();
  } catch (error) {
    console.error('Error in verifyDocumentAccess middleware:', error);
    return res.status(500).json({ message: 'Error verifying document access' });
  }
}

/**
 * Dual authentication middleware
 * Accepts both staff (session) and portal (JWT) authentication
 * Sets req.user for staff or req.portalUser for portal users
 */
export async function authenticateStaffOrPortal(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Try JWT authentication first (portal users)
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (token) {
      const payload = verifyJWT(token);
      if (payload) {
        // Verify the portal user still exists
        const portalUser = await storage.getClientPortalUserById(payload.userId);
        if (portalUser && portalUser.clientId === payload.clientId) {
          (req as any).portalUser = {
            id: portalUser.id,
            clientId: portalUser.clientId,
            email: portalUser.email,
          };
          return next();
        }
      }
    }

    // Try session authentication (staff users)
    if ((req as any).session?.userId) {
      const user = await storage.getUser((req as any).session.userId);
      if (user) {
        (req as any).user = {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin || false,
          canSeeAdminMenu: user.canSeeAdminMenu || false,
        };
        return next();
      }
    }

    // No valid authentication found
    return res.status(401).json({ message: 'Unauthorized' });
  } catch (error) {
    console.error('Error in authenticateStaffOrPortal middleware:', error);
    return res.status(500).json({ message: 'Authentication error' });
  }
}
