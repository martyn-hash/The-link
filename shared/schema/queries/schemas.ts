import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { bookkeepingQueries } from './tables';

export const insertBookkeepingQuerySchema = createInsertSchema(bookkeepingQueries).omit({
  id: true,
  createdAt: true,
  answeredAt: true,
  resolvedAt: true,
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
