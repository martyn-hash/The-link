# Database Optimizations Document

This document provides a comprehensive analysis of database optimization opportunities for the application, covering indexing strategies, query patterns, and architectural improvements.

---

## 1. Foreign Key Index Audit

### Currently Indexed Foreign Keys (Good)

The following foreign keys already have indexes defined in the schema:

| Table | Column | Index Name |
|-------|--------|------------|
| `user_sessions` | `user_id` | `idx_user_sessions_user_id` |
| `login_attempts` | `email` | `idx_login_attempts_email` |
| `user_oauth_accounts` | `user_id` | `idx_user_oauth_accounts_user_id` |
| `project_views` | `user_id` | `idx_project_views_user_id` |
| `company_views` | `user_id` | `idx_company_views_user_id` |
| `user_column_preferences` | `user_id` | `idx_user_column_preferences_user_id` |
| `dashboards` | `user_id` | `idx_dashboards_user_id` |
| `dashboard_cache` | `user_id` | `idx_dashboard_cache_user_id` |
| `user_project_preferences` | `user_id` | `idx_user_project_preferences_user_id` |
| `projects` | `client_id` | `idx_projects_client_id` |
| `projects` | `project_type_id` | `idx_projects_project_type_id` |
| `projects` | `project_owner_id` | `idx_projects_project_owner_id` |
| `projects` | `current_assignee_id` | `idx_projects_current_assignee_id` |
| `client_chronology` | `client_id` | `idx_client_chronology_client_id` |
| `stage_approvals` | `project_type_id` | `idx_stage_approvals_project_type_id` |
| `stage_approval_fields` | `stage_approval_id` | `idx_stage_approval_fields_stage_approval_id` |
| `stage_approval_responses` | `project_id` | `idx_stage_approval_responses_project_id` |
| `stage_approval_responses` | `field_id` | `idx_stage_approval_responses_field_id` |
| `kanban_stages` | `project_type_id` | `idx_kanban_stages_project_type_id` |
| `kanban_stages` | `assigned_work_role_id` | `idx_kanban_stages_assigned_work_role_id` |
| `kanban_stages` | `assigned_user_id` | `idx_kanban_stages_assigned_user_id` |
| `change_reasons` | `project_type_id` | `idx_change_reasons_project_type_id` |
| `change_reasons` | `stage_approval_id` | `idx_change_reasons_stage_approval_id` |
| `stage_reason_maps` | `stage_id` | `idx_stage_reason_maps_stage_id` |
| `stage_reason_maps` | `reason_id` | `idx_stage_reason_maps_reason_id` |
| `reason_custom_fields` | `reason_id` | `idx_reason_custom_fields_reason_id` |
| `reason_field_responses` | `chronology_id` | `idx_reason_field_responses_chronology_id` |
| `reason_field_responses` | `custom_field_id` | `idx_reason_field_responses_custom_field_id` |
| `client_services` | `client_id` | `idx_client_services_client_id` |
| `client_services` | `service_id` | `idx_client_services_service_id` |
| `client_services` | `service_owner_id` | `idx_client_services_service_owner_id` |
| `client_services` | `inactive_by_user_id` | `idx_client_services_inactive_by_user_id` |
| `people_services` | `person_id` | `idx_people_services_person_id` |
| `people_services` | `service_id` | `idx_people_services_service_id` |
| `people_services` | `service_owner_id` | `idx_people_services_service_owner_id` |
| `client_service_role_assignments` | `client_service_id` | `idx_client_service_role_assignments_client_service_id` |
| `client_service_role_assignments` | `work_role_id` | `idx_client_service_role_assignments_work_role_id` |
| `client_service_role_assignments` | `user_id` | `idx_client_service_role_assignments_user_id` |
| `ch_change_requests` | `client_id` | `idx_ch_change_requests_client_id` |
| `message_threads` | `client_id, last_message_at` | `message_threads_client_id_last_message_idx` |
| `messages` | `thread_id, created_at` | `messages_thread_id_created_at_idx` |
| `push_subscriptions` | `user_id` | `push_subscriptions_user_id_idx` |
| `push_subscriptions` | `client_portal_user_id` | `push_subscriptions_client_portal_user_id_idx` |
| `project_message_threads` | `project_id, last_message_at` | `project_message_threads_project_id_last_message_idx` |
| `project_messages` | `thread_id, created_at` | `project_messages_thread_id_created_at_idx` |
| `project_messages` | `user_id` | `project_messages_user_id_idx` |
| `project_message_participants` | `thread_id` | `project_message_participants_thread_id_idx` |
| `project_message_participants` | `user_id` | `project_message_participants_user_id_idx` |
| `staff_messages` | `thread_id, created_at` | `staff_messages_thread_id_created_at_idx` |
| `staff_messages` | `user_id` | `staff_messages_user_id_idx` |
| `staff_message_participants` | `thread_id` | `staff_message_participants_thread_id_idx` |
| `staff_message_participants` | `user_id` | `staff_message_participants_user_id_idx` |
| `document_folders` | `client_id` | `idx_document_folders_client_id` |
| `documents` | `client_id` | `idx_documents_client_id` |
| `documents` | `folder_id` | `idx_documents_folder_id` |
| `documents` | `client_portal_user_id` | `idx_documents_client_portal_user_id` |
| `documents` | `message_id` | `idx_documents_message_id` |
| `documents` | `thread_id` | `idx_documents_thread_id` |
| `signature_requests` | `client_id` | `idx_signature_requests_client_id` |
| `signature_requests` | `document_id` | `idx_signature_requests_document_id` |
| `signature_requests` | `created_by` | `idx_signature_requests_created_by` |
| `signature_fields` | `signature_request_id` | `idx_signature_fields_request_id` |
| `signature_fields` | `recipient_person_id` | `idx_signature_fields_recipient_id` |
| `signature_request_recipients` | `signature_request_id` | `idx_signature_request_recipients_request_id` |
| `signature_request_recipients` | `person_id` | `idx_signature_request_recipients_person_id` |
| `internal_tasks` | `created_by` | `idx_internal_tasks_created_by` |
| `internal_tasks` | `assigned_to` | `idx_internal_tasks_assigned_to` |
| `internal_tasks` | `task_type_id` | `idx_internal_tasks_task_type_id` |
| `task_connections` | `task_id` | `idx_task_connections_task_id` |
| `task_progress_notes` | `task_id` | `idx_task_progress_notes_task_id` |
| `task_progress_notes` | `user_id` | `idx_task_progress_notes_user_id` |
| `task_time_entries` | `task_id` | `idx_task_time_entries_task_id` |
| `task_time_entries` | `user_id` | `idx_task_time_entries_user_id` |
| `task_documents` | `task_id` | `idx_task_documents_task_id` |
| `task_documents` | `uploaded_by` | `idx_task_documents_uploaded_by` |
| `project_type_notifications` | `project_type_id` | `idx_project_type_notifications_project_type_id` |
| `project_type_notifications` | `stage_id` | `idx_project_type_notifications_stage_id` |
| `client_request_reminders` | `project_type_notification_id` | `idx_client_request_reminders_notification_id` |
| `scheduled_notifications` | `client_id` | `idx_scheduled_notifications_client_id` |
| `task_instances` | `template_id` | `idx_task_instances_template_id` |
| `task_instances` | `custom_request_id` | `idx_task_instances_custom_request_id` |
| `task_instances` | `client_id` | `idx_task_instances_client_id` |
| `task_instances` | `person_id` | `idx_task_instances_person_id` |
| `task_instances` | `client_portal_user_id` | `idx_task_instances_client_portal_user_id` |

### Missing Foreign Key Indexes (Action Required)

The following foreign keys lack indexes and will cause sequential scans:

| Table | Column | Recommended Index | Priority | Rationale |
|-------|--------|-------------------|----------|-----------|
| `projects` | `bookkeeper_id` | `idx_projects_bookkeeper_id` | **HIGH** | Used in project filtering by team member |
| `projects` | `client_manager_id` | `idx_projects_client_manager_id` | **HIGH** | Used in "My Projects" views, user filtering |
| `projects` | `inactive_by_user_id` | `idx_projects_inactive_by_user_id` | LOW | Rarely queried |
| `project_chronology` | `project_id` | `idx_project_chronology_project_id` | **CRITICAL** | Powers timeline views - heavily queried |
| `project_chronology` | `assignee_id` | `idx_project_chronology_assignee_id` | MEDIUM | Used in activity tracking |
| `project_chronology` | `changed_by_id` | `idx_project_chronology_changed_by_id` | MEDIUM | Used in audit trails |
| `client_chronology` | `user_id` | `idx_client_chronology_user_id` | LOW | Rarely filtered by user |
| `client_people` | `client_id` | `idx_client_people_client_id` | **HIGH** | Used when loading client details |
| `client_people` | `person_id` | `idx_client_people_person_id` | **HIGH** | Used when loading person details |
| `magic_link_tokens` | `user_id` | `idx_magic_link_tokens_user_id` | LOW | Low volume table |
| `service_roles` | `service_id` | `idx_service_roles_service_id` | MEDIUM | Used in role lookups |
| `service_roles` | `work_role_id` | `idx_service_roles_work_role_id` | MEDIUM | Used in role lookups |
| `user_activity_tracking` | `user_id` | Exists via composite | - | Already covered |
| `client_portal_users` | `client_id` | `client_portal_users_client_id_idx` | Exists | Already indexed |
| `client_portal_users` | `person_id` | `client_portal_users_person_id_idx` | Exists | Already indexed |

---

## 2. Composite Index Recommendations

### High-Priority Composite Indexes

These indexes target common multi-column query patterns:

| Table | Columns | Index Name | Query Pattern |
|-------|---------|------------|---------------|
| `project_chronology` | `(project_id, timestamp DESC)` | `idx_project_chronology_project_timestamp` | Timeline views ordered by recency |
| `projects` | `(client_id, project_month)` | `idx_projects_client_month` | Monthly project filtering by client |
| `projects` | `(current_status, archived, inactive)` | `idx_projects_status_filters` | Kanban board filtering |
| `projects` | `(project_type_id, archived, inactive)` | `idx_projects_type_filters` | Service-based project listing |
| `client_services` | `(client_id, is_active)` | `idx_client_services_client_active` | Active services per client |
| `client_services` | `(service_id, is_active)` | `idx_client_services_service_active` | Active client count per service |
| `scheduled_notifications` | `(status, scheduled_for)` | `idx_scheduled_notifications_pending` | Notification cron job queries |
| `message_threads` | `(client_id, status, last_message_at DESC)` | `idx_message_threads_client_status` | Client inbox views |
| `internal_tasks` | `(assigned_to, status, is_archived)` | `idx_internal_tasks_assignee_status` | My Tasks view |

### Implementation SQL

```sql
-- Critical: Project chronology timeline index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_chronology_project_timestamp 
ON project_chronology (project_id, timestamp DESC);

-- High: Projects foreign key indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_bookkeeper_id 
ON projects (bookkeeper_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_client_manager_id 
ON projects (client_manager_id);

-- High: Client-People relationship indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_people_client_id 
ON client_people (client_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_people_person_id 
ON client_people (person_id);

-- Composite: Common filter patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_client_month 
ON projects (client_id, project_month);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_status_filters 
ON projects (current_status, archived, inactive) WHERE archived = false AND inactive = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_services_client_active 
ON client_services (client_id, is_active) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_notifications_pending 
ON scheduled_notifications (status, scheduled_for) WHERE status = 'scheduled';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_internal_tasks_assignee_status 
ON internal_tasks (assigned_to, status, is_archived) WHERE is_archived = false;
```

---

## 3. `/projects` Page Query Analysis

When users navigate to the `/projects` page, the `GET /api/projects` endpoint calls `storage.getAllProjects(filters)`.

### Current Query Pattern

```typescript
db.query.projects.findMany({
  where: whereClause,  // filters: month, archived, inactive, serviceId, assigneeId, etc.
  with: {
    client: true,              // JOIN via client_id ✅ indexed
    bookkeeper: true,          // JOIN via bookkeeper_id ❌ MISSING INDEX
    clientManager: true,       // JOIN via client_manager_id ❌ MISSING INDEX
    currentAssignee: true,     // JOIN via current_assignee_id ✅ indexed
    projectOwner: true,        // JOIN via project_owner_id ✅ indexed
    projectType: {
      with: { service: true }  // JOIN via project_type_id ✅ indexed
    },
    chronology: {              // JOIN via project_id ❌ MISSING INDEX (CRITICAL)
      orderBy: desc(timestamp),
      with: {
        assignee: true,
        changedBy: true,
      }
    }
  }
})
```

### Performance Issues

| Issue | Impact | Solution |
|-------|--------|----------|
| Missing `project_chronology.project_id` index | Sequential scan on every project load | Add `idx_project_chronology_project_id` |
| Missing composite `(project_id, timestamp DESC)` | Slow ORDER BY for chronology | Add `idx_project_chronology_project_timestamp` |
| Missing `projects.bookkeeper_id` index | Slow JOIN for bookkeeper data | Add `idx_projects_bookkeeper_id` |
| Missing `projects.client_manager_id` index | Slow JOIN for client manager data | Add `idx_projects_client_manager_id` |
| N+1 for `resolveStageRoleAssignee()` | 1 extra query per project | Batch lookup or pre-fetch |
| Full chronology loaded for list view | Unnecessary data transfer | Only load in detail view |

### Recommended Indexes for `/projects` Page

```sql
-- CRITICAL: These directly impact /projects page performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_chronology_project_id 
ON project_chronology (project_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_chronology_project_timestamp 
ON project_chronology (project_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_bookkeeper_id 
ON projects (bookkeeper_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_client_manager_id 
ON projects (client_manager_id);
```

### Query Optimization Opportunities

1. **Remove chronology from list view**: The chronology is already loaded but only shows the latest entry in the UI. Consider:
   - Only loading chronology in the detail view (`getProject()`)
   - Or using a subquery to fetch just the most recent entry

2. **Batch stageRoleAssignee lookups**: Instead of N+1 queries, pre-fetch all role assignments for visible project types

3. **Add pagination**: For large datasets, implement cursor-based pagination

---

## 4. Heavy Queries Requiring Isolation

The following queries are complex and should be moved to dedicated repository modules:

### 4.1 Project Listing Query (`projectStorage.ts`)

**Location:** `server/storage/projects/projectStorage.ts` - `getAllProjects()`

**Issue:** This query loads projects with multiple nested relations:
- `client`
- `bookkeeper`
- `clientManager`
- `currentAssignee`
- `projectOwner`
- `projectType.service`
- `chronology.assignee`
- `chronology.changedBy`

**Optimization:**
1. Remove `chronology` from list queries (already done - good)
2. Consider pagination for large result sets
3. Use projection to select only needed columns

### 4.2 Project Progress Metrics (`projectChronologyStorage.ts`)

**Location:** `server/storage/projects/projectChronologyStorage.ts` - `getProjectProgressMetrics()`

**Issue:** Multi-table aggregation with SUM and GROUP BY across 4 tables:
- `reasonFieldResponses`
- `reasonCustomFields`
- `changeReasons`
- `projectChronology`

**Recommendation:** 
- Consider caching results in `dashboardCache` table
- Add index: `CREATE INDEX idx_reason_field_responses_field_type ON reason_field_responses (field_type) WHERE field_type = 'number'`

### 4.3 Dashboard Statistics

**Location:** `server/dashboard-cache-service.ts`

**Status:** Already using caching - good pattern to follow elsewhere.

---

## 5. ORM Over-Fetching Patterns

### 5.1 Avoid Deep Nesting in List Views

**Anti-pattern identified in `getAllProjects()`:**
```typescript
with: {
  client: true,              // Full client object
  projectType: {
    with: { service: true }  // Nested service
  },
  chronology: {
    with: {
      assignee: true,
      changedBy: true,
      fieldResponses: {...}   // Heavy nested data
    }
  }
}
```

**Recommendation:**
```typescript
// For list views, use minimal projection
with: {
  client: {
    columns: { id: true, name: true }
  },
  projectType: {
    columns: { id: true, name: true }
  }
}
// Load chronology only in detail view
```

### 5.2 Selective Column Loading

For high-traffic endpoints, specify exactly which columns are needed:

```typescript
// Instead of:
const clients = await db.query.clients.findMany();

// Use:
const clients = await db
  .select({
    id: clients.id,
    name: clients.name,
    email: clients.email
  })
  .from(clients);
```

### 5.3 N+1 Query Detection

Current pattern in `getAllProjects()` that causes N+1:
```typescript
const projectsWithAssignees = await Promise.all(results.map(async (project) => {
  const stageRoleAssignee = await this.helpers.resolveStageRoleAssignee(project);
  // ...
}));
```

**Recommendation:** Batch these lookups or use a single query with proper JOINs.

---

## 6. Database Health Check Endpoint

### Recommended Implementation

Create `/api/admin/db-health` endpoint:

```typescript
// server/routes/health.ts
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

export async function registerHealthRoutes(app: Express) {
  app.get('/api/admin/db-health', async (req, res) => {
    const start = Date.now();
    
    try {
      // Basic connectivity check
      await db.execute(sql`SELECT 1`);
      const latency = Date.now() - start;
      
      // Pool statistics (if available from connection)
      const poolStats = {
        // These would come from your pool configuration
        totalConnections: process.env.PGPOOL_MAX || 'unknown',
        idleConnections: 'check pool library'
      };
      
      res.json({
        status: 'healthy',
        latency_ms: latency,
        timestamp: new Date().toISOString(),
        pool: poolStats
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Extended health check with table statistics
  app.get('/api/admin/db-health/extended', requireAdmin, async (req, res) => {
    try {
      const tableStats = await db.execute(sql`
        SELECT 
          schemaname,
          relname as table_name,
          n_live_tup as row_count,
          n_dead_tup as dead_rows,
          last_vacuum,
          last_autovacuum,
          last_analyze
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
        LIMIT 20
      `);
      
      const indexUsage = await db.execute(sql`
        SELECT 
          schemaname,
          relname as table_name,
          indexrelname as index_name,
          idx_scan as times_used,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        ORDER BY idx_scan DESC
        LIMIT 20
      `);
      
      res.json({
        status: 'healthy',
        tables: tableStats.rows,
        indexes: indexUsage.rows,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get extended stats' });
    }
  });
}
```

---

## 7. Implementation Priority

### Phase 1: Critical (Immediate)
1. Add index on `project_chronology.project_id` 
2. Add composite index `(project_id, timestamp DESC)` on `project_chronology`
3. Add indexes on `projects.bookkeeper_id` and `projects.client_manager_id`
4. Add indexes on `client_people.client_id` and `client_people.person_id`

### Phase 2: High Priority (This Sprint)
1. Implement DB health check endpoint
2. Add remaining composite indexes for common query patterns
3. Review and optimize `getAllProjects()` query

### Phase 3: Medium Priority (Next Sprint)
1. Add projection-based queries for list views
2. Implement batch loading for N+1 patterns
3. Add caching for progress metrics

### Phase 4: Ongoing
1. Monitor slow query logs
2. Review index usage with `pg_stat_user_indexes`
3. Regular VACUUM ANALYZE scheduling

---

## 8. Monitoring Queries

### Check Index Usage
```sql
SELECT 
  schemaname,
  relname as table_name,
  indexrelname as index_name,
  idx_scan as times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Find Sequential Scans
```sql
SELECT 
  schemaname,
  relname as table_name,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan
ORDER BY seq_tup_read DESC
LIMIT 10;
```

### Identify Missing Indexes
```sql
SELECT 
  schemaname,
  relname as table_name,
  seq_scan,
  seq_tup_read / seq_scan as avg_rows_per_scan
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC
LIMIT 10;
```

---

## 9. Summary

| Category | Issues Found | Priority |
|----------|-------------|----------|
| Missing FK Indexes | 12 | HIGH |
| Missing Composite Indexes | 9 | HIGH |
| Heavy Queries | 3 | MEDIUM |
| ORM Over-fetching | 3 patterns | MEDIUM |
| Health Check | Missing | HIGH |

Total estimated effort: 2-3 days for Phase 1 and 2 implementations.
