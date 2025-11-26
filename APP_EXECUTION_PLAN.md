# The Link - Application Execution Plan

**Created:** November 26, 2025  
**Source:** Analysis of `app_observations.md` Architecture Review  
**Status:** Active

---

## Overview

This document extracts and prioritizes the remaining work identified in the application architecture review. Tasks are organized by priority level with estimated effort and acceptance criteria.

---

## Phase 1: Critical Issues (Before Scaling)

These issues must be resolved before adding more users to the system.

### 1.1 Fix Type Mismatches in Storage Facade

**Priority:** P0 - Critical  
**Estimated Effort:** 1-2 days  
**Location:** `server/storage/index.ts`

**Current State:** 3 LSP diagnostics remaining (down from 13 originally identified)

**Tasks:**
- [ ] Review and fix remaining type mismatches between `DatabaseStorage` and `IStorage` interface
- [ ] Verify `setFallbackUser` return type (Promise<User> vs Promise<void>)
- [ ] Fix `updateProjectStatus` parameter compatibility
- [ ] Fix `updateSectionOrders` field name (order vs sortOrder)
- [ ] Ensure `getClientCustomRequestById` returns all required properties
- [ ] Ensure `getTaskInstanceById` returns all required properties
- [ ] Ensure `getInternalTaskById` returns all required properties
- [ ] Fix `prepareStageChangeNotification` missing properties

**Acceptance Criteria:**
- Zero LSP diagnostics in `server/storage/index.ts`
- All methods in `DatabaseStorage` match `IStorage` interface signatures
- No TypeScript errors when running `tsc --noEmit`

---

### 1.2 Complete Schema Migration

**Priority:** P0 - Critical  
**Estimated Effort:** 2-3 days  
**Location:** `shared/schema.ts` (legacy) → `shared/schema/` (modular)

**Current State:** Dual schema system exists - legacy `schema.ts` (3,928 lines) alongside modular domain modules

**Tasks:**
- [ ] Audit all imports across codebase that reference `shared/schema.ts`
- [ ] Update imports to use domain modules from `shared/schema/`
- [ ] Verify modular schema exports match legacy schema exports exactly
- [ ] Run database migrations to confirm schema parity
- [ ] Delete `shared/schema.ts` after full verification
- [ ] Update documentation to reflect final schema structure

**Acceptance Criteria:**
- All imports use modular schema (`shared/schema/[domain]`)
- Legacy `shared/schema.ts` file is deleted
- Database migrations run successfully
- No runtime errors related to schema imports

---

### 1.3 Remove Legacy Storage Dependency

**Priority:** P0 - Critical  
**Estimated Effort:** 3-5 days  
**Location:** `server/storage/` (OldDatabaseStorage references)

**Current State:** `DatabaseStorage` facade still constructs `OldDatabaseStorage` for some cross-domain lookups

**Tasks:**
- [ ] Identify all usages of `OldDatabaseStorage` in the codebase
- [ ] Replace legacy storage methods with typed service interfaces
- [ ] Update portal routes that use legacy storage methods
- [ ] Ensure return types are consistent across all storage methods
- [ ] Remove `OldDatabaseStorage` class after migration
- [ ] Comprehensive testing after removal

**Acceptance Criteria:**
- No references to `OldDatabaseStorage` in codebase
- All storage methods use the new modular storage pattern
- Portal routes return consistent data shapes
- No double-writes or data inconsistencies

---

## Phase 2: Short-term Improvements (1-2 Weeks)

These improvements enhance performance and maintainability.

### 2.1 Implement Route-Level Code Splitting

**Priority:** P1 - High  
**Estimated Effort:** 1 day  
**Location:** `client/src/App.tsx`

**Current State:** All routes eagerly loaded (~9MB bundle estimated)

**Tasks:**
- [ ] Implement `React.lazy()` for admin routes
- [ ] Implement `React.lazy()` for portal routes
- [ ] Add `<Suspense>` boundaries with loading states
- [ ] Configure dynamic imports for page components
- [ ] Test lazy loading works correctly in production build

**Acceptance Criteria:**
- Initial bundle size reduced by at least 40%
- Routes load on demand without visible delay
- Loading states appear during chunk loading

---

### 2.2 Optimize Query Waterfalls

**Priority:** P1 - High  
**Estimated Effort:** 1-2 days  
**Location:** `client/src/pages/client-detail/hooks/useClientData.ts`

**Current State:** Complex pages issue 6-10 sequential queries

**Tasks:**
- [ ] Identify query waterfall patterns in client-detail page
- [ ] Consolidate related queries into batched endpoints
- [ ] Implement `Promise.all` for independent queries
- [ ] Consider creating composite API endpoints for complex pages
- [ ] Review and optimize stale time configuration (currently 30s)

**Acceptance Criteria:**
- Client detail page makes 3-4 parallel requests instead of 6-10 sequential
- Page load time reduced by measurable amount
- No increase in backend complexity

---

### 2.3 Consolidate Documentation

**Priority:** P1 - Medium  
**Estimated Effort:** 0.5 days  
**Location:** Various `.md` files

**Current State:** Multiple fragmented refactoring documents

**Tasks:**
- [ ] Review all existing `.md` documentation files
- [ ] Merge refactoring docs into single architecture document
- [ ] Update `replit.md` with final architecture
- [ ] Remove redundant stage-specific `.md` files in `client/src/pages/client-detail/`
- [ ] Ensure all documentation is current and accurate

**Acceptance Criteria:**
- Single authoritative architecture document
- `replit.md` reflects current system state
- No orphaned or outdated documentation files

---

### 2.4 Clean Up Orphaned Files

**Priority:** P2 - Low  
**Estimated Effort:** 0.5 days  
**Locations:** 
- `server/routes.ts.backup`
- `attached_assets/`

**Tasks:**
- [ ] Verify `server/routes.ts.backup` is no longer needed
- [ ] Delete backup file after verification
- [ ] Review 150+ screenshots/paste files in `attached_assets/`
- [ ] Archive or remove development artifacts not needed in production
- [ ] Document which attached assets are actually used

**Acceptance Criteria:**
- No `.backup` files in codebase
- `attached_assets/` contains only production-required files

---

## Phase 3: Database Optimizations

### 3.1 Add Missing Indexes

**Priority:** P1 - Medium  
**Estimated Effort:** 0.5 days

**Tasks:**
- [ ] Add index on `scheduled_notifications(status, scheduled_for)` - HIGH priority
- [ ] Add indexes on `project_type_notifications` foreign keys - MEDIUM priority
- [ ] Add index on `notification_history(client_id, created_at)` - MEDIUM priority
- [ ] Run performance tests to verify improvements

**Acceptance Criteria:**
- New indexes created without locking production
- Query performance improved for notification-related queries
- No negative impact on write performance

---

## Phase 4: Long-term Improvements (1+ Month)

These are strategic improvements for production readiness.

### 4.1 Add Comprehensive Test Coverage

**Priority:** P2 - Medium  
**Estimated Effort:** 2+ weeks

**Tasks:**
- [ ] Add unit tests for storage modules
- [ ] Add integration tests for API routes
- [ ] Add E2E tests for critical user flows
- [ ] Set up CI/CD pipeline for automated testing
- [ ] Establish minimum code coverage thresholds

---

### 4.2 Implement Server-Side Caching

**Priority:** P2 - Medium  
**Estimated Effort:** 2-3 days

**Tasks:**
- [ ] Evaluate Redis for session storage
- [ ] Implement response caching for read-heavy endpoints
- [ ] Configure cache invalidation strategy
- [ ] Monitor cache hit rates

---

### 4.3 Add Monitoring and Alerting

**Priority:** P2 - Medium  
**Estimated Effort:** 1 week

**Tasks:**
- [ ] Integrate error tracking (Sentry or similar)
- [ ] Add performance monitoring
- [ ] Set up alerting for critical errors
- [ ] Create operational dashboards

---

### 4.4 Evaluate Real-time Updates

**Priority:** P3 - Low  
**Estimated Effort:** 1 week

**Tasks:**
- [ ] Evaluate WebSocket for real-time notifications
- [ ] Design event-driven update architecture
- [ ] Implement for high-value use cases first

---

## Progress Tracking

| Phase | Items | Completed | Status |
|-------|-------|-----------|--------|
| Phase 1 - Critical | 3 | 0 | Not Started |
| Phase 2 - Short-term | 4 | 0 | Not Started |
| Phase 3 - Database | 1 | 0 | Not Started |
| Phase 4 - Long-term | 4 | 0 | Not Started |

---

## Notes

- **LSP Diagnostics:** Currently showing 3 errors (reduced from 13 mentioned in review)
- **Schema Migration Plan:** See `SCHEMA_MIGRATION_EXECUTION_PLAN.md` for detailed migration steps
- **Performance Baseline:** See `speed_time.md` for resolved performance issues
- **Database Optimization Details:** See `database_optimisations.md` for index strategy

---

## Quick Reference

**Key Files:**
- Storage facade: `server/storage/index.ts`
- Storage interface: `server/storage/base/IStorage.ts`
- Legacy schema: `shared/schema.ts` (to be deleted)
- Modular schema: `shared/schema/index.ts`
- Frontend routing: `client/src/App.tsx`
- Query client: `client/src/lib/queryClient.ts`

**Related Documentation:**
- Architecture review: `app_observations.md`
- Developer guide: `read_me_before_developing.md`
- High-level architecture: `replit.md`
