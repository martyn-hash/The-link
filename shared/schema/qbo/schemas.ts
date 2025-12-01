import { createInsertSchema } from 'drizzle-zod';
import { qboConnections, qboOAuthStates, qboQcRuns, qboQcResults, qboQcResultItems, qboQcApprovalHistory } from './tables';
import { z } from 'zod';

export const insertQboConnectionSchema = createInsertSchema(qboConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateQboConnectionSchema = insertQboConnectionSchema.partial();

export const insertQboOAuthStateSchema = createInsertSchema(qboOAuthStates).omit({
  id: true,
  createdAt: true,
});

export const insertQboQcRunSchema = createInsertSchema(qboQcRuns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateQboQcRunSchema = insertQboQcRunSchema.partial();

export const insertQboQcResultSchema = createInsertSchema(qboQcResults).omit({
  id: true,
  createdAt: true,
});

export const insertQboQcResultItemSchema = createInsertSchema(qboQcResultItems).omit({
  id: true,
  createdAt: true,
});

export const updateQboQcResultItemSchema = insertQboQcResultItemSchema.partial();

export const insertQboQcApprovalHistorySchema = createInsertSchema(qboQcApprovalHistory).omit({
  id: true,
});

export const qcRunStatusEnum = z.enum(['pending', 'running', 'completed', 'failed']);
export const qcCheckStatusEnum = z.enum(['pass', 'warning', 'fail', 'blocked', 'skipped']);
export const qcApprovalStatusEnum = z.enum(['pending', 'approved', 'escalated', 'resolved']);
export const qcApprovalActionEnum = z.enum(['approve', 'escalate', 'resolve', 'reopen']);
