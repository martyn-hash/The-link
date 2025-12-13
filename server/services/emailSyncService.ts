import { getUncachableOutlookClient } from "../utils/outlookClient";
import { matchEmailToClient } from "../utils/clientEmailMatcher";
import { calculateSlaDeadline, DEFAULT_SLA_SETTINGS } from "../utils/slaCalculator";
import { storage } from "../storage";

interface GraphEmailMessage {
  id: string;
  conversationId?: string;
  from?: {
    emailAddress?: {
      address?: string;
      name?: string;
    };
  };
  toRecipients?: Array<{
    emailAddress?: {
      address?: string;
      name?: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress?: {
      address?: string;
      name?: string;
    };
  }>;
  subject?: string;
  bodyPreview?: string;
  body?: {
    contentType?: string;
    content?: string;
  };
  receivedDateTime?: string;
  hasAttachments?: boolean;
  importance?: string;
  isRead?: boolean;
}

interface SyncResult {
  synced: number;
  matched: number;
  skipped: number;
  errors: string[];
}

export async function syncInboxEmails(
  inboxId: string,
  options: {
    maxMessages?: number;
    folderId?: string;
    sinceDays?: number;
  } = {}
): Promise<SyncResult> {
  const { maxMessages = 100, folderId = "inbox", sinceDays = 30 } = options;
  
  const result: SyncResult = {
    synced: 0,
    matched: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const inbox = await storage.getInboxById(inboxId);
    if (!inbox) {
      throw new Error(`Inbox not found: ${inboxId}`);
    }

    const graphClient = await getUncachableOutlookClient();
    
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - sinceDays);
    const sinceFilter = `receivedDateTime ge ${sinceDate.toISOString()}`;

    const mailboxPath = inbox.azureUserId 
      ? `/users/${inbox.azureUserId}` 
      : '/me';

    console.log(`[EmailSync] Fetching emails for inbox ${inboxId} (${mailboxPath}) since ${sinceDate.toISOString()}`);

    const messagesResponse = await graphClient
      .api(`${mailboxPath}/mailFolders/${folderId}/messages`)
      .filter(sinceFilter)
      .top(maxMessages)
      .select("id,conversationId,from,toRecipients,ccRecipients,subject,bodyPreview,body,receivedDateTime,hasAttachments,importance,isRead")
      .orderby("receivedDateTime desc")
      .get();

    const messages: GraphEmailMessage[] = messagesResponse.value || [];
    console.log(`[EmailSync] Fetched ${messages.length} messages from Graph API`);

    for (const message of messages) {
      try {
        if (!message.id || !message.from?.emailAddress?.address) {
          result.skipped++;
          continue;
        }

        const existing = await storage.getInboxEmailByMicrosoftId(inboxId, message.id);
        if (existing) {
          result.skipped++;
          continue;
        }

        const fromAddress = message.from.emailAddress.address.toLowerCase();
        const clientMatch = await matchEmailToClient(fromAddress);

        const receivedAt = message.receivedDateTime 
          ? new Date(message.receivedDateTime) 
          : new Date();

        const slaDeadline = calculateSlaDeadline(receivedAt, DEFAULT_SLA_SETTINGS);

        const toRecipients = (message.toRecipients || []).map(r => ({
          address: r.emailAddress?.address || "",
          name: r.emailAddress?.name || "",
        }));

        const ccRecipients = (message.ccRecipients || []).map(r => ({
          address: r.emailAddress?.address || "",
          name: r.emailAddress?.name || "",
        }));

        const emailData = {
          inboxId,
          microsoftId: message.id,
          conversationId: message.conversationId || null,
          fromAddress,
          fromName: message.from.emailAddress.name || null,
          toRecipients,
          ccRecipients,
          subject: message.subject || null,
          bodyPreview: message.bodyPreview || null,
          bodyHtml: message.body?.contentType === "html" ? message.body.content : null,
          receivedAt,
          hasAttachments: message.hasAttachments || false,
          importance: message.importance || "normal",
          matchedClientId: clientMatch?.clientId || null,
          slaDeadline,
          status: "pending_reply" as const,
          isRead: message.isRead || false,
        };

        await storage.upsertInboxEmail(emailData);
        result.synced++;
        
        if (clientMatch) {
          result.matched++;
        }

      } catch (emailError) {
        const errorMsg = emailError instanceof Error ? emailError.message : "Unknown error";
        result.errors.push(`Email ${message.id}: ${errorMsg}`);
        console.error(`[EmailSync] Error processing email ${message.id}:`, emailError);
      }
    }

    console.log(`[EmailSync] Sync complete: ${result.synced} synced, ${result.matched} matched, ${result.skipped} skipped`);
    
    return result;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(`Sync failed: ${errorMsg}`);
    console.error("[EmailSync] Sync failed:", error);
    throw error;
  }
}

export async function syncAllActiveInboxes(): Promise<Map<string, SyncResult>> {
  const results = new Map<string, SyncResult>();
  
  try {
    const inboxes = await storage.getActiveInboxes();
    console.log(`[EmailSync] Starting sync for ${inboxes.length} active inboxes`);
    
    for (const inbox of inboxes) {
      try {
        const result = await syncInboxEmails(inbox.id);
        results.set(inbox.id, result);
      } catch (error) {
        console.error(`[EmailSync] Failed to sync inbox ${inbox.id}:`, error);
        results.set(inbox.id, {
          synced: 0,
          matched: 0,
          skipped: 0,
          errors: [error instanceof Error ? error.message : "Unknown error"],
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error("[EmailSync] Failed to sync all inboxes:", error);
    throw error;
  }
}

export async function markOverdueEmails(): Promise<number> {
  try {
    const count = await storage.markOverdueEmails();
    if (count > 0) {
      console.log(`[EmailSync] Marked ${count} emails as overdue`);
    }
    return count;
  } catch (error) {
    console.error("[EmailSync] Failed to mark overdue emails:", error);
    throw error;
  }
}
