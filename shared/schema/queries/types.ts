import { z } from 'zod';
import { bookkeepingQueries, queryResponseTokens, scheduledQueryReminders, queryGroups, queryAnswerHistory } from './tables';
import {
  insertBookkeepingQuerySchema,
  updateBookkeepingQuerySchema,
  bulkCreateQueriesSchema,
  insertQueryResponseTokenSchema,
  sendToClientSchema,
  insertScheduledQueryReminderSchema,
  updateScheduledQueryReminderSchema,
  createRemindersSchema,
  reminderScheduleItemSchema,
} from './schemas';
import type { User } from '../users/types';
import type { Project } from '../projects/types';

export type BookkeepingQuery = typeof bookkeepingQueries.$inferSelect;
export type InsertBookkeepingQuery = z.infer<typeof insertBookkeepingQuerySchema>;
export type UpdateBookkeepingQuery = z.infer<typeof updateBookkeepingQuerySchema>;
export type BulkCreateQueries = z.infer<typeof bulkCreateQueriesSchema>;

// Query Group type
export type QueryGroup = typeof queryGroups.$inferSelect;

export type BookkeepingQueryWithRelations = BookkeepingQuery & {
  createdBy?: User;
  answeredBy?: User;
  resolvedBy?: User;
  project?: Project;
  group?: QueryGroup | null;
};

export type QueryResponseToken = typeof queryResponseTokens.$inferSelect;
export type InsertQueryResponseToken = z.infer<typeof insertQueryResponseTokenSchema>;
export type SendToClientInput = z.infer<typeof sendToClientSchema>;

export type QueryResponseTokenWithRelations = QueryResponseToken & {
  createdBy?: User;
  project?: Project;
  queries?: BookkeepingQuery[];
};

// Scheduled Query Reminder types
export type ScheduledQueryReminder = typeof scheduledQueryReminders.$inferSelect;
export type InsertScheduledQueryReminder = z.infer<typeof insertScheduledQueryReminderSchema>;
export type UpdateScheduledQueryReminder = z.infer<typeof updateScheduledQueryReminderSchema>;
export type CreateRemindersInput = z.infer<typeof createRemindersSchema>;
export type ReminderScheduleItem = z.infer<typeof reminderScheduleItemSchema>;

export type ScheduledQueryReminderWithRelations = ScheduledQueryReminder & {
  token?: QueryResponseToken;
  project?: Project;
  cancelledBy?: User;
};

// Reminder channel type
export type ReminderChannel = 'email' | 'sms' | 'voice';

// Reminder status type
export type ReminderStatus = 'pending' | 'sent' | 'failed' | 'cancelled' | 'skipped';

// On completion trigger type (for auto-stage-change)
export type OnCompletionTrigger = 'all_answered' | 'submitted';

// Query Answer History types (for auto-suggest feature)
export type QueryAnswerHistory = typeof queryAnswerHistory.$inferSelect;

export type AnsweredByType = 'staff' | 'client';

export interface QuerySuggestion {
  id: string;
  answerText: string;
  answeredByType: AnsweredByType;
  answeredAt: Date;
  sourceQueryId: string;
  sourceQueryDescription?: string;
  matchScore: number;
  isFromSameClient: boolean;
}
