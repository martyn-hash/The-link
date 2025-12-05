import { z } from 'zod';
import { bookkeepingQueries, queryResponseTokens } from './tables';
import {
  insertBookkeepingQuerySchema,
  updateBookkeepingQuerySchema,
  bulkCreateQueriesSchema,
  insertQueryResponseTokenSchema,
  sendToClientSchema,
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

export type QueryResponseToken = typeof queryResponseTokens.$inferSelect;
export type InsertQueryResponseToken = z.infer<typeof insertQueryResponseTokenSchema>;
export type SendToClientInput = z.infer<typeof sendToClientSchema>;

export type QueryResponseTokenWithRelations = QueryResponseToken & {
  createdBy?: User;
  project?: Project;
  queries?: BookkeepingQuery[];
};
