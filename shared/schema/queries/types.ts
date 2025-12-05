import { z } from 'zod';
import { bookkeepingQueries } from './tables';
import {
  insertBookkeepingQuerySchema,
  updateBookkeepingQuerySchema,
  bulkCreateQueriesSchema,
} from './schemas';
import type { User } from '../users/types';
import type { Project } from '../projects/types';

export type BookkeepingQuery = typeof bookkeepingQueries.$inferSelect;
export type InsertBookkeepingQuery = z.infer<typeof insertBookkeepingQuerySchema>;
export type UpdateBookkeepingQuery = z.infer<typeof updateBookkeepingQuerySchema>;
export type BulkCreateQueries = z.infer<typeof bulkCreateQueriesSchema>;

export type BookkeepingQueryWithRelations = BookkeepingQuery & {
  createdBy?: User;
  answeredBy?: User;
  resolvedBy?: User;
  project?: Project;
};
