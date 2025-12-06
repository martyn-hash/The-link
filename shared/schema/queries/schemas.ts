import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { bookkeepingQueries, queryResponseTokens, scheduledQueryReminders } from './tables';

const baseInsertSchema = createInsertSchema(bookkeepingQueries).omit({
  id: true,
  createdAt: true,
  answeredAt: true,
  resolvedAt: true,
});

export const insertBookkeepingQuerySchema = baseInsertSchema.extend({
  date: z.union([z.string(), z.date(), z.null()]).optional().transform((val) => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  moneyIn: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    return String(val);
  }),
  moneyOut: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === '') return null;
    return String(val);
  }),
  hasVat: z.union([z.boolean(), z.null()]).optional(),
});

export const updateBookkeepingQuerySchema = insertBookkeepingQuerySchema.partial().extend({
  status: z.enum(["open", "answered_by_staff", "sent_to_client", "answered_by_client", "resolved"]).optional(),
});

export const bulkCreateQueriesSchema = z.object({
  queries: z.array(insertBookkeepingQuerySchema.omit({
    projectId: true,
    createdById: true,
    status: true,
  })),
});

// Query Response Token schemas
const baseTokenInsertSchema = createInsertSchema(queryResponseTokens).omit({
  id: true,
  createdAt: true,
  accessedAt: true,
  completedAt: true,
});

export const insertQueryResponseTokenSchema = baseTokenInsertSchema.extend({
  expiresAt: z.union([z.string(), z.date()]).transform((val) => {
    if (val instanceof Date) return val;
    return new Date(val);
  }),
});

export const sendToClientSchema = z.object({
  queryIds: z.array(z.string()).min(1, "At least one query is required"),
  recipientEmail: z.string().email("Valid email required"),
  recipientName: z.string().optional(),
  expiryDays: z.number().min(1).max(30).default(14),
  sendEmail: z.boolean().default(true),
  emailSubject: z.string().optional(),
  emailMessage: z.string().optional(),
});

// Scheduled Query Reminder schemas
const baseReminderInsertSchema = createInsertSchema(scheduledQueryReminders).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  cancelledAt: true,
  cancelledById: true,
  errorMessage: true,
  dialoraCallId: true,
});

export const insertScheduledQueryReminderSchema = baseReminderInsertSchema.extend({
  scheduledAt: z.union([z.string(), z.date()]).transform((val) => {
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  channel: z.enum(['email', 'sms', 'voice']),
  status: z.enum(['pending', 'sent', 'failed', 'cancelled', 'skipped']).optional().default('pending'),
});

export const updateScheduledQueryReminderSchema = z.object({
  scheduledAt: z.union([z.string(), z.date()]).optional().transform((val) => {
    if (!val) return undefined;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
  channel: z.enum(['email', 'sms', 'voice']).optional(),
  status: z.enum(['pending', 'sent', 'failed', 'cancelled', 'skipped']).optional(),
  message: z.string().optional(),
});

// Schema for generating reminder schedule from the UI
export const reminderScheduleItemSchema = z.object({
  scheduledAt: z.string(),
  channel: z.enum(['email', 'sms', 'voice']),
  enabled: z.boolean().default(true),
});

export const createRemindersSchema = z.object({
  tokenId: z.string(),
  projectId: z.string(),
  recipientPhone: z.string().optional(),
  recipientEmail: z.string().email(),
  recipientName: z.string().optional(),
  queriesTotal: z.number(),
  schedule: z.array(reminderScheduleItemSchema),
});
