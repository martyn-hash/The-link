import { z } from 'zod';
import { auditChangelog } from './tables';
import { insertAuditChangelogSchema } from './schemas';

export type AuditChangelog = typeof auditChangelog.$inferSelect;
export type InsertAuditChangelog = z.infer<typeof insertAuditChangelogSchema>;
