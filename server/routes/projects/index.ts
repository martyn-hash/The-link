import type { Express } from "express";

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

// Route registration imports will be added as modules are extracted

export function registerProjectRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any,
  upload: any
): void {
  // Route registrations will be added as modules are extracted
  // For now, this is a placeholder that will be populated incrementally
}
