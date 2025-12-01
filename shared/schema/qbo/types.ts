import { z } from 'zod';
import { qboConnections, qboOAuthStates, qboQcRuns, qboQcResults, qboQcResultItems, qboQcApprovalHistory } from './tables';
import { 
  insertQboConnectionSchema, 
  updateQboConnectionSchema, 
  insertQboOAuthStateSchema,
  insertQboQcRunSchema,
  updateQboQcRunSchema,
  insertQboQcResultSchema,
  insertQboQcResultItemSchema,
  updateQboQcResultItemSchema,
  insertQboQcApprovalHistorySchema,
  qcRunStatusEnum,
  qcCheckStatusEnum,
  qcApprovalStatusEnum,
  qcApprovalActionEnum,
} from './schemas';

export type QboConnection = typeof qboConnections.$inferSelect;
export type InsertQboConnection = z.infer<typeof insertQboConnectionSchema>;
export type UpdateQboConnection = z.infer<typeof updateQboConnectionSchema>;

export type QboOAuthState = typeof qboOAuthStates.$inferSelect;
export type InsertQboOAuthState = z.infer<typeof insertQboOAuthStateSchema>;

export type QboQcRun = typeof qboQcRuns.$inferSelect;
export type InsertQboQcRun = z.infer<typeof insertQboQcRunSchema>;
export type UpdateQboQcRun = z.infer<typeof updateQboQcRunSchema>;

export type QboQcResult = typeof qboQcResults.$inferSelect;
export type InsertQboQcResult = z.infer<typeof insertQboQcResultSchema>;

export type QboQcResultItem = typeof qboQcResultItems.$inferSelect;
export type InsertQboQcResultItem = z.infer<typeof insertQboQcResultItemSchema>;
export type UpdateQboQcResultItem = z.infer<typeof updateQboQcResultItemSchema>;

export type QboQcApprovalHistory = typeof qboQcApprovalHistory.$inferSelect;
export type InsertQboQcApprovalHistory = z.infer<typeof insertQboQcApprovalHistorySchema>;

export type QcRunStatus = z.infer<typeof qcRunStatusEnum>;
export type QcCheckStatus = z.infer<typeof qcCheckStatusEnum>;
export type QcApprovalStatus = z.infer<typeof qcApprovalStatusEnum>;
export type QcApprovalAction = z.infer<typeof qcApprovalActionEnum>;

export interface QboConnectionWithClient extends QboConnection {
  client?: {
    id: string;
    name: string;
    companyNumber?: string | null;
  };
  connectedByUser?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  };
}

export interface QboTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  realmId: string;
  scope?: string;
}

export interface QboQcRunWithDetails extends QboQcRun {
  results: QboQcResultWithItems[];
  triggeredByUser?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  };
}

export interface QboQcResultWithItems extends QboQcResult {
  items: QboQcResultItem[];
}

export interface QcPeriod {
  periodStart: string;
  periodEnd: string;
  closeDate?: string;
  priorPeriodEnd?: string;
}

export interface QcCheckDefinition {
  code: string;
  name: string;
  section: string;
  description: string;
  estimatedApiCalls: number;
}

export interface QcCheckResult {
  checkCode: string;
  checkName: string;
  section: string;
  status: QcCheckStatus;
  value: string | null;
  expected: string | null;
  summary: string | null;
  metadata?: Record<string, unknown>;
  items?: QcFlaggedItem[];
}

export interface QcFlaggedItem {
  externalId?: string;
  externalType?: string;
  label: string;
  description?: string;
  amount?: number;
  txnDate?: string;
  metadata?: Record<string, unknown>;
}

export interface QcRunSummary {
  id: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  status: QcRunStatus;
  totalChecks: number;
  passedChecks: number;
  warningChecks: number;
  failedChecks: number;
  blockedChecks: number;
  score: number | null;
  completedAt: Date | null;
  pendingApprovals: number;
}
