import { createInsertSchema } from "drizzle-zod";
import {
  emailMessages,
  mailboxMessageMap,
  emailThreads,
  unmatchedEmails,
  emailAttachments,
  emailMessageAttachments,
  graphWebhookSubscriptions,
  graphSyncState,
  inboxes,
  userInboxAccess,
  inboxEmails,
  emailQuarantine,
  emailClassifications,
  emailWorkflowState,
  emailClassificationOverrides,
} from "./tables";

export const insertEmailMessageSchema = createInsertSchema(emailMessages).omit({
  processedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMailboxMessageMapSchema = createInsertSchema(mailboxMessageMap).omit({
  id: true,
  createdAt: true,
});

export const insertEmailThreadSchema = createInsertSchema(emailThreads).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertUnmatchedEmailSchema = createInsertSchema(unmatchedEmails).omit({
  createdAt: true,
});

export const insertEmailAttachmentSchema = createInsertSchema(emailAttachments).omit({
  id: true,
  createdAt: true,
});

export const insertEmailMessageAttachmentSchema = createInsertSchema(emailMessageAttachments).omit({
  id: true,
  createdAt: true,
});

export const insertGraphWebhookSubscriptionSchema = createInsertSchema(graphWebhookSubscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertGraphSyncStateSchema = createInsertSchema(graphSyncState).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInboxSchema = createInsertSchema(inboxes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserInboxAccessSchema = createInsertSchema(userInboxAccess).omit({
  id: true,
  createdAt: true,
  grantedAt: true,
});

export const insertInboxEmailSchema = createInsertSchema(inboxEmails).omit({
  id: true,
  syncedAt: true,
  createdAt: true,
});

// Comms workflow schemas
export const insertEmailQuarantineSchema = createInsertSchema(emailQuarantine).omit({
  id: true,
  createdAt: true,
});

export const insertEmailClassificationSchema = createInsertSchema(emailClassifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailWorkflowStateSchema = createInsertSchema(emailWorkflowState).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailClassificationOverrideSchema = createInsertSchema(emailClassificationOverrides).omit({
  id: true,
  createdAt: true,
});
