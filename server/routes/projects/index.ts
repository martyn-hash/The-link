import type { Express } from "express";
import { registerProjectViewsRoutes } from "./views";
import { registerProjectPreferencesRoutes } from "./preferences";
import { registerProjectCoreRoutes } from "./core";
import { registerProjectStatusRoutes } from "./status";
import { registerProjectBulkRoutes } from "./bulk";
import { registerProjectAttachmentsRoutes } from "./attachments";
import { registerProjectNotificationsRoutes } from "./notifications";
import { registerProjectBenchRoutes } from "./bench";
import { registerProjectCsvUploadRoutes } from "./csv-upload";
import { registerProjectApprovalsRoutes } from "./approvals";
import { registerProjectAssigneesRoutes } from "./assignees";
import { registerProjectSchedulingRoutes } from "./scheduling";
import { registerProjectBatchUpdatesRoutes } from "./batch-updates";
import { registerProjectDashboardRoutes } from "./dashboard";

/**
 * Project Routes Module
 * 
 * This module organizes project-related routes into domain-specific files:
 * - views.ts: Project views CRUD
 * - preferences.ts: User project preferences
 * - core.ts: Project CRUD, get, update, complete
 * - status.ts: Status updates, stage change config
 * - bulk.ts: Bulk operations
 * - attachments.ts: Stage change attachments
 * - notifications.ts: Stage change notifications
 * - bench.ts: Bench/unbench operations
 * - csv-upload.ts: CSV project upload
 * - approvals.ts: Stage approval responses
 * - assignees.ts: Assignees, role resolution
 * - scheduling.ts: Project scheduling
 * - batch-updates.ts: Batch due date updates
 * - dashboard.ts: Dashboard metrics and cache
 */

export function registerProjectRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any,
  upload: any
): void {
  registerProjectViewsRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectPreferencesRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectCoreRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectStatusRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectBulkRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectAttachmentsRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectNotificationsRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectBenchRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectCsvUploadRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager, upload);
  registerProjectApprovalsRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectAssigneesRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectSchedulingRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectBatchUpdatesRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerProjectDashboardRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
}
