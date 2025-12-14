import { getUncachableOutlookClient } from "../utils/outlookClient";
import { matchEmailToClient } from "../utils/clientEmailMatcher";
import { calculateSlaDeadline, DEFAULT_SLA_SETTINGS } from "../utils/slaCalculator";
import { storage } from "../storage";
import { processEmailThroughGate } from "./customerGateService";

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

        const receivedAt = message.receivedDateTime 
          ? new Date(message.receivedDateTime) 
          : new Date();

        const toRecipients = (message.toRecipients || []).map(r => ({
          address: r.emailAddress?.address || "",
          name: r.emailAddress?.name || "",
        }));

        const ccRecipients = (message.ccRecipients || []).map(r => ({
          address: r.emailAddress?.address || "",
          name: r.emailAddress?.name || "",
        }));

        const gateResult = await processEmailThroughGate({
          inboxId,
          microsoftId: message.id,
          fromAddress,
          fromName: message.from.emailAddress.name || null,
          toRecipients,
          ccRecipients,
          subject: message.subject || null,
          bodyPreview: message.bodyPreview || null,
          receivedAt,
          hasAttachments: message.hasAttachments || false,
        });

        if (gateResult.quarantined) {
          result.skipped++;
          continue;
        }

        const slaDeadline = calculateSlaDeadline(receivedAt, DEFAULT_SLA_SETTINGS);

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
          matchedClientId: gateResult.clientMatch?.clientId || null,
          matchedPersonId: gateResult.clientMatch?.personId || null,
          direction: "inbound" as const,
          slaDeadline,
          status: "pending_reply" as const,
          isRead: message.isRead || false,
        };

        await storage.upsertInboxEmail(emailData);
        result.synced++;
        
        if (gateResult.clientMatch) {
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

export async function syncSentEmails(
  inboxId: string,
  options: {
    maxMessages?: number;
    sinceDays?: number;
  } = {}
): Promise<SyncResult> {
  const { maxMessages = 100, sinceDays = 30 } = options;
  
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
    const sinceFilter = `sentDateTime ge ${sinceDate.toISOString()}`;

    const mailboxPath = inbox.azureUserId 
      ? `/users/${inbox.azureUserId}` 
      : '/me';

    console.log(`[EmailSync] Fetching sent emails for inbox ${inboxId} (${mailboxPath}) since ${sinceDate.toISOString()}`);

    const messagesResponse = await graphClient
      .api(`${mailboxPath}/mailFolders/sentitems/messages`)
      .filter(sinceFilter)
      .top(maxMessages)
      .select("id,conversationId,from,toRecipients,ccRecipients,subject,bodyPreview,body,sentDateTime,hasAttachments,importance")
      .orderby("sentDateTime desc")
      .get();

    const messages: GraphEmailMessage[] = messagesResponse.value || [];
    console.log(`[EmailSync] Fetched ${messages.length} sent messages from Graph API`);

    for (const message of messages) {
      try {
        if (!message.id) {
          result.skipped++;
          continue;
        }

        const existing = await storage.getInboxEmailByMicrosoftId(inboxId, message.id);
        if (existing) {
          result.skipped++;
          continue;
        }

        // For sent emails, match recipients to clients
        const toRecipients = (message.toRecipients || []).map(r => ({
          address: r.emailAddress?.address || "",
          name: r.emailAddress?.name || "",
        }));

        const ccRecipients = (message.ccRecipients || []).map(r => ({
          address: r.emailAddress?.address || "",
          name: r.emailAddress?.name || "",
        }));

        // Try to match any recipient to a client
        let clientMatch = null;
        for (const recipient of toRecipients) {
          if (recipient.address) {
            clientMatch = await matchEmailToClient(recipient.address.toLowerCase());
            if (clientMatch) break;
          }
        }
        if (!clientMatch) {
          for (const recipient of ccRecipients) {
            if (recipient.address) {
              clientMatch = await matchEmailToClient(recipient.address.toLowerCase());
              if (clientMatch) break;
            }
          }
        }

        const sentAt = message.receivedDateTime 
          ? new Date(message.receivedDateTime) 
          : new Date();

        const fromAddress = message.from?.emailAddress?.address?.toLowerCase() || inbox.emailAddress;
        const fromName = message.from?.emailAddress?.name || inbox.displayName || null;

        // Find staff user by inbox email
        const staffUser = inbox.linkedUserId || null;

        const emailData = {
          inboxId,
          microsoftId: message.id,
          conversationId: message.conversationId || null,
          fromAddress,
          fromName,
          toRecipients,
          ccRecipients,
          subject: message.subject || null,
          bodyPreview: message.bodyPreview || null,
          bodyHtml: message.body?.contentType === "html" ? message.body.content : null,
          receivedAt: sentAt,
          hasAttachments: message.hasAttachments || false,
          importance: message.importance || "normal",
          matchedClientId: clientMatch?.clientId || null,
          matchedPersonId: clientMatch?.personId || null,
          direction: "outbound" as const,
          staffUserId: staffUser,
          slaDeadline: null,
          status: "no_action_needed" as const,
          isRead: true,
        };

        await storage.upsertInboxEmail(emailData);
        result.synced++;
        
        if (clientMatch) {
          result.matched++;
        }

      } catch (emailError) {
        const errorMsg = emailError instanceof Error ? emailError.message : "Unknown error";
        result.errors.push(`Email ${message.id}: ${errorMsg}`);
        console.error(`[EmailSync] Error processing sent email ${message.id}:`, emailError);
      }
    }

    console.log(`[EmailSync] Sent sync complete: ${result.synced} synced, ${result.matched} matched, ${result.skipped} skipped`);
    
    return result;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(`Sent sync failed: ${errorMsg}`);
    console.error("[EmailSync] Sent sync failed:", error);
    throw error;
  }
}

export async function syncAllActiveInboxes(options: { includeSent?: boolean } = {}): Promise<Map<string, SyncResult>> {
  const { includeSent = true } = options;
  const results = new Map<string, SyncResult>();
  
  try {
    const inboxes = await storage.getActiveInboxes();
    console.log(`[EmailSync] Starting sync for ${inboxes.length} active inboxes (includeSent: ${includeSent})`);
    
    for (const inbox of inboxes) {
      try {
        // Sync inbox (inbound emails)
        const inboxResult = await syncInboxEmails(inbox.id);
        
        // Sync sent folder (outbound emails)
        let sentResult: SyncResult = { synced: 0, matched: 0, skipped: 0, errors: [] };
        if (includeSent) {
          try {
            sentResult = await syncSentEmails(inbox.id);
          } catch (sentError) {
            console.error(`[EmailSync] Failed to sync sent for inbox ${inbox.id}:`, sentError);
            sentResult.errors.push(sentError instanceof Error ? sentError.message : "Unknown error");
          }
        }
        
        // Combine results
        results.set(inbox.id, {
          synced: inboxResult.synced + sentResult.synced,
          matched: inboxResult.matched + sentResult.matched,
          skipped: inboxResult.skipped + sentResult.skipped,
          errors: [...inboxResult.errors, ...sentResult.errors],
        });
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

export interface HistoricalImportResult {
  inboxId: string;
  inboxEmail: string;
  inboxSynced: number;
  sentSynced: number;
  matched: number;
  skipped: number;
  errors: string[];
}

export async function runHistoricalImport(
  inboxIds: string[],
  options: {
    sinceDays?: number;
    maxMessagesPerFolder?: number;
    markOldAsNoAction?: boolean;
    noActionThresholdDays?: number;
  } = {}
): Promise<HistoricalImportResult[]> {
  const {
    sinceDays = 90,
    maxMessagesPerFolder = 500,
    markOldAsNoAction = true,
    noActionThresholdDays = 7,
  } = options;

  const results: HistoricalImportResult[] = [];
  const noActionThreshold = new Date();
  noActionThreshold.setDate(noActionThreshold.getDate() - noActionThresholdDays);

  console.log(`[HistoricalImport] Starting import for ${inboxIds.length} inbox(es), ${sinceDays} days back`);

  for (const inboxId of inboxIds) {
    const result: HistoricalImportResult = {
      inboxId,
      inboxEmail: '',
      inboxSynced: 0,
      sentSynced: 0,
      matched: 0,
      skipped: 0,
      errors: [],
    };

    try {
      const inbox = await storage.getInboxById(inboxId);
      if (!inbox) {
        result.errors.push(`Inbox not found: ${inboxId}`);
        results.push(result);
        continue;
      }

      result.inboxEmail = inbox.emailAddress;
      console.log(`[HistoricalImport] Processing inbox: ${inbox.emailAddress}`);

      // Sync inbox emails
      try {
        const inboxResult = await syncInboxEmails(inboxId, {
          sinceDays,
          maxMessages: maxMessagesPerFolder,
        });
        result.inboxSynced = inboxResult.synced;
        result.matched += inboxResult.matched;
        result.skipped += inboxResult.skipped;
        result.errors.push(...inboxResult.errors);
      } catch (inboxError) {
        result.errors.push(`Inbox sync failed: ${inboxError instanceof Error ? inboxError.message : 'Unknown'}`);
      }

      // Sync sent emails
      try {
        const sentResult = await syncSentEmails(inboxId, {
          sinceDays,
          maxMessages: maxMessagesPerFolder,
        });
        result.sentSynced = sentResult.synced;
        result.matched += sentResult.matched;
        result.skipped += sentResult.skipped;
        result.errors.push(...sentResult.errors);
      } catch (sentError) {
        result.errors.push(`Sent sync failed: ${sentError instanceof Error ? sentError.message : 'Unknown'}`);
      }

      // Mark old inbound emails as no_action_needed
      if (markOldAsNoAction) {
        try {
          const markedCount = await storage.markOldEmailsAsNoAction(inboxId, noActionThreshold);
          console.log(`[HistoricalImport] Marked ${markedCount} old emails as no_action_needed`);
        } catch (markError) {
          result.errors.push(`Failed to mark old emails: ${markError instanceof Error ? markError.message : 'Unknown'}`);
        }
      }

      results.push(result);
      console.log(`[HistoricalImport] Completed ${inbox.emailAddress}: ${result.inboxSynced} inbox, ${result.sentSynced} sent`);

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      results.push(result);
    }
  }

  console.log(`[HistoricalImport] Import complete for ${results.length} inbox(es)`);
  return results;
}
