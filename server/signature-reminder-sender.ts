import { db } from "./db";
import { signatureRequests, signatureRequestRecipients, signatures, people, companySettings, signatureAuditLogs } from "@shared/schema";
import { eq, and, lte, lt, isNull, sql } from "drizzle-orm";
import { sendReminderEmail } from "./lib/sendgrid";

/**
 * Signature Reminder Sender Service
 * 
 * This service processes pending signature reminders and sends email notifications
 * to recipients who haven't signed yet.
 */

const MAX_REMINDERS = 5; // eIDAS compliance cap

interface ReminderResult {
  processed: number;
  reminders_sent: number;
  errors: number;
}

/**
 * Process all pending signature reminders
 * 
 * This function:
 * 1. Finds signature requests where next_reminder_date is due
 * 2. Sends reminder emails to unsigned recipients
 * 3. Updates reminder tracking and enforces the 5-reminder cap
 * 4. Creates audit log entries for compliance
 */
export async function processPendingReminders(): Promise<ReminderResult> {
  const startTime = Date.now();
  console.log("[SignatureReminderSender] Starting reminder processing...");

  const result: ReminderResult = {
    processed: 0,
    reminders_sent: 0,
    errors: 0
  };

  try {
    // Get company settings for firm name
    const [settings] = await db.select().from(companySettings).limit(1);
    const firmName = settings?.firmName || "Your Firm";

    // Find signature requests that are due for reminders
    const now = new Date();
    const dueRequests = await db
      .select()
      .from(signatureRequests)
      .where(
        and(
          eq(signatureRequests.reminderEnabled, true),
          lte(signatureRequests.nextReminderDate, now),
          lt(signatureRequests.remindersSentCount, MAX_REMINDERS),
          sql`${signatureRequests.status} IN ('pending', 'partially_signed')`
        )
      );

    console.log(`[SignatureReminderSender] Found ${dueRequests.length} requests due for reminders`);

    for (const request of dueRequests) {
      result.processed++;

      try {
        // Get all recipients for this request
        const recipients = await db
          .select({
            recipientId: signatureRequestRecipients.id,
            recipientPersonId: signatureRequestRecipients.personId,
            secureToken: signatureRequestRecipients.secureToken, // CRITICAL: Need secure token for signing URL
            personEmail: people.email,
            personName: people.fullName,
          })
          .from(signatureRequestRecipients)
          .leftJoin(people, eq(signatureRequestRecipients.personId, people.id))
          .where(eq(signatureRequestRecipients.signatureRequestId, request.id));

        // Find which recipients haven't signed yet - check by counting signatures for each recipient
        const unsignedRecipients = [];
        for (const recipient of recipients) {
          const existingSignatures = await db
            .select()
            .from(signatures)
            .where(eq(signatures.signatureRequestRecipientId, recipient.recipientId))
            .limit(1);

          if (existingSignatures.length === 0) {
            unsignedRecipients.push(recipient);
          }
        }

        if (unsignedRecipients.length === 0) {
          console.log(`[SignatureReminderSender] Request ${request.id} has no unsigned recipients, skipping`);
          continue;
        }

        // Send reminder email to each unsigned recipient
        for (const recipient of unsignedRecipients) {
          if (!recipient.personEmail) {
            console.warn(`[SignatureReminderSender] Recipient ${recipient.recipientId} has no email, skipping`);
            continue;
          }

          // CRITICAL FIX: Use secure token instead of database ID for signing URL
          const signUrl = `${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPLIT_DOMAINS}` : 'http://localhost:5000'}/sign?token=${recipient.secureToken}`;

          // Calculate days since request was created
          const createdAt = request.createdAt || now;
          const daysSinceSent = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
          const reminderNumber = request.remindersSentCount + 1;

          try {
            await sendReminderEmail(
              recipient.personEmail,
              recipient.personName || recipient.personEmail,
              firmName,
              request.friendlyName,
              daysSinceSent,
              reminderNumber,
              signUrl
            );
            
            // eIDAS COMPLIANCE: Persist audit trail in database for each recipient reminder
            await db.insert(signatureAuditLogs).values({
              signatureRequestRecipientId: recipient.recipientId,
              eventType: 'reminder_sent',
              eventDetails: `Automated reminder #${reminderNumber} sent after ${daysSinceSent} days`,
              signerName: recipient.personName || 'Unknown',
              signerEmail: recipient.personEmail,
              ipAddress: 'system', // System-generated event
              userAgent: 'signature-reminder-cron', // Identifies the source
              deviceInfo: 'server',
              browserInfo: 'automated-reminder-system',
              osInfo: 'server',
              consentAccepted: false, // Not a consent event
              consentAcceptedAt: null,
              signedAt: null, // Not a signing event
              documentHash: 'reminder-event-no-document-hash', // Placeholder for reminder events
              documentVersion: request.documentId, // Reference to document ID for traceability
              authMethod: 'system',
              metadata: {
                reminderNumber,
                daysSinceSent,
                maxReminders: MAX_REMINDERS,
                reminderIntervalDays: request.reminderIntervalDays,
                timestamp: now.toISOString(),
              },
            });
            
            result.reminders_sent++;
            console.log(`[SignatureReminderSender] Sent reminder #${reminderNumber} to ${recipient.personEmail} for request ${request.id} (token: ${recipient.secureToken})`);
          } catch (emailError) {
            console.error(`[SignatureReminderSender] Failed to send reminder email to ${recipient.personEmail}:`, emailError);
            result.errors++;
          }
        }

        // Update reminder tracking
        const newReminderCount = request.remindersSentCount + 1;
        const shouldDisableReminders = newReminderCount >= MAX_REMINDERS;

        // Calculate next reminder date with timezone normalization
        let nextReminderDate: Date | null = null;
        if (!shouldDisableReminders && request.reminderIntervalDays) {
          // CRITICAL FIX: Create fresh Date object based on last reminder or creation time
          const baseDate = request.lastReminderSentAt || request.createdAt || now;
          const nextDate = new Date(baseDate);
          
          // Add reminder interval days
          nextDate.setDate(nextDate.getDate() + request.reminderIntervalDays);
          
          // Normalize to 09:00 UK time (using UTC for consistency with cron)
          // The cron job runs at 09:00 UK time (08:00 UTC in winter, 09:00 UTC in summer)
          // We'll set to 09:00 UTC which aligns with UK business hours year-round
          nextDate.setUTCHours(9, 0, 0, 0);
          
          nextReminderDate = nextDate;
        }

        await db
          .update(signatureRequests)
          .set({
            remindersSentCount: newReminderCount,
            lastReminderSentAt: now,
            nextReminderDate: nextReminderDate,
            reminderEnabled: !shouldDisableReminders,
            updatedAt: now
          })
          .where(eq(signatureRequests.id, request.id));

        console.log(`[SignatureReminderSender] Updated request ${request.id}: reminders_sent=${newReminderCount}, next_reminder=${nextReminderDate?.toISOString() || 'null'}, enabled=${!shouldDisableReminders}`);

        // eIDAS COMPLIANCE: Log reminder activity for audit trail
        // Note: Using console logs instead of signature_audit_logs table because:
        // - signature_audit_logs is designed for individual recipient signing events
        // - Reminder events are system-level actions affecting multiple recipients
        // - Console logs provide timestamped audit trail accessible via server logs
        console.log(`[SignatureReminderSender] [COMPLIANCE AUDIT] Reminder #${newReminderCount} sent for request ${request.id} to ${unsignedRecipients.length} unsigned recipients at ${now.toISOString()}`);

        if (shouldDisableReminders) {
          console.log(`[SignatureReminderSender] Request ${request.id} reached max reminders (${MAX_REMINDERS}), reminders disabled`);
        }

      } catch (requestError) {
        console.error(`[SignatureReminderSender] Error processing request ${request.id}:`, requestError);
        result.errors++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[SignatureReminderSender] Reminder processing complete in ${duration}ms:`, {
      processed: result.processed,
      reminders_sent: result.reminders_sent,
      errors: result.errors
    });

  } catch (error) {
    console.error("[SignatureReminderSender] Fatal error during reminder processing:", error);
    throw error;
  }

  return result;
}
