import { createInsertSchema } from 'drizzle-zod';
import { auditChangelog } from './tables';

export const insertAuditChangelogSchema = createInsertSchema(auditChangelog).omit({
  id: true,
  timestamp: true,
});
