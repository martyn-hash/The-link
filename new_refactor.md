# Codebase Refactoring Assessment Report

## Executive Summary

- **Total Source Files:** 633
- **Total Lines of Code:** 217,606
- **Files over 800 lines (RED zone):** 78 files  
- **Files 400-800 lines (AMBER zone):** 82 files
- **Critical Finding:** 11.6% of files contain significantly oversized code that will severely impact agent performance and maintainability

---

## RED - URGENT REFACTORING REQUIRED (77 files over 800 lines)

### 1. `server/storage/index.ts` - 3,645 lines
**Why it needs refactoring:**
- Acts as a "God Facade" delegating 535+ methods to 52 storage modules
- Massive constructor initializing 60+ storage instances
- Every method is a one-liner delegation, creating extreme file length
- Hard to navigate and understand

**Specific recommended refactors:**
- Extract into domain-specific facades (e.g., `UserStorageFacade`, `ProjectStorageFacade`)
- Use dynamic module loading/registration pattern instead of explicit delegation
- Consider removing facade entirely and importing domain storage directly

**Suggested new files:**
- `server/storage/facades/userFacade.ts`
- `server/storage/facades/projectFacade.ts`
- `server/storage/facades/serviceFacade.ts`

**Risk:** HIGH - Central to entire backend; changes propagate everywhere  
**Effort:** L (Large)

---

### 2. `server/routes/projects.ts` - 3,114 lines
**Why it needs refactoring:**
- Contains 40+ route handlers mixed together
- Multiple concerns: views, preferences, scheduling, CSV import, status changes
- Helper functions embedded inline (e.g., `htmlToPlainText`)
- Deep nesting in route handlers

**Specific recommended refactors:**
- Split into domain-focused route files:
  - `routes/projects/views.ts` (project views CRUD)
  - `routes/projects/preferences.ts` (user preferences)
  - `routes/projects/scheduling.ts` (scheduling operations)
  - `routes/projects/import.ts` (CSV import)
- Extract helpers to `server/utils/textUtils.ts`

**Risk:** HIGH - Core functionality; many frontend dependencies  
**Effort:** L

---

### 3. `server/routes/auth.ts` - 2,984 lines
**Why it needs refactoring:**
- Kitchen sink file: auth + users + dashboards + documents + risk assessments
- Contains analytics, impersonation, QR codes, magic links all in one file
- Duplicate validation schemas defined inline
- Not related to just "auth" despite the name

**Specific recommended refactors:**
- Split by domain:
  - `routes/auth/authentication.ts` (login, magic links, impersonation)
  - `routes/auth/users.ts` (user CRUD)
  - `routes/dashboards.ts` (dashboard management)
  - `routes/documents.ts` (document management)
  - `routes/riskAssessments.ts` (risk assessments)
- Move validation schemas to `shared/schema/validation/`

**Risk:** HIGH - Authentication is critical path  
**Effort:** L

---

### 4. `client/src/components/ai-magic/AIMagicActionCards.tsx` - 2,734 lines
**Why it needs refactoring:**
- Single component with 20+ sub-components embedded
- Mixed concerns: UI rendering, API calls, business logic, form handling
- Multiple custom hooks embedded inline (`SearchableSelect`, `RecipientSelector`)
- Very long functions (some 100+ lines)

**Specific recommended refactors:**
- Extract reusable components:
  - `components/ai-magic/SearchableSelect.tsx`
  - `components/ai-magic/RecipientSelector.tsx`
  - `components/ai-magic/ActionCard.tsx`
- Extract action handlers to custom hooks:
  - `hooks/useAIMagicActions.ts`
- Split card types into separate files:
  - `components/ai-magic/cards/EmailCard.tsx`
  - `components/ai-magic/cards/TaskCard.tsx`
  - `components/ai-magic/cards/ReminderCard.tsx`

**Risk:** MEDIUM - Isolated to AI Magic feature  
**Effort:** L

---

### 5. `server/routes/signatures.ts` - 2,571 lines
**Why it needs refactoring:**
- Mixes PDF processing, email sending, geo-lookup, session management
- Contains certificate generation logic inline
- Very long functions (e.g., `createAuditLog` handles too much)
- Hard-coded constants scattered throughout

**Specific recommended refactors:**
- Extract services:
  - `server/services/signatureService.ts` (core signing logic)
  - `server/services/pdfService.ts` (PDF manipulation)
  - `server/services/geoService.ts` (IP geo-lookup)
- Move constants to `server/config/signatures.ts`
- Create `server/routes/signatures/` directory with split routes

**Risk:** HIGH - Legal/compliance feature  
**Effort:** L

---

### 6. `client/src/pages/projects.tsx` - 2,507 lines
**Why it needs refactoring:**
- Page component with 30+ useState calls
- Multiple workspace modes, filter states, view modes combined
- Contains inline component definitions
- Manages both projects and tasks workspaces

**Specific recommended refactors:**
- Extract state management into custom hooks:
  - `hooks/useProjectFilters.ts`
  - `hooks/useTaskFilters.ts`
  - `hooks/useWorkspaceMode.ts`
- Create view mode components:
  - `pages/projects/KanbanView.tsx`
  - `pages/projects/ListView.tsx`
  - `pages/projects/CalendarView.tsx`
- Use reducer pattern for complex state

**Risk:** HIGH - Main application view  
**Effort:** L

---

### 7. `server/storage/services/serviceAssignmentStorage.ts` - 2,403 lines
**Why it needs refactoring:**
- Single class with 50+ methods
- Duplicate query patterns repeated throughout
- Complex joins repeated in multiple methods
- Debug console.log statements scattered

**Specific recommended refactors:**
- Split by entity:
  - `clientServiceStorage.ts` (client service CRUD)
  - `peopleServiceStorage.ts` (people service CRUD)
  - `roleAssignmentStorage.ts` (role assignments)
- Extract query builders for common joins
- Remove debug logging or use proper logger

**Risk:** MEDIUM - Storage layer is well-isolated  
**Effort:** M

---

### 8. `server/storage/projects/projectStorage.ts` - 2,323 lines
**Why it needs refactoring:**
- Monolithic project storage with all project operations
- Complex aggregation queries mixed with simple CRUD
- Analytics queries mixed with basic operations

**Specific recommended refactors:**
- Split into:
  - `projectCrudStorage.ts` (basic CRUD)
  - `projectQueryStorage.ts` (complex queries/aggregations)
  - `projectAnalyticsStorage.ts` (dashboard analytics)

**Risk:** MEDIUM  
**Effort:** M

---

### 9. `client/src/components/ChangeStatusModal.tsx` - 2,188 lines
**Why it needs refactoring:**
- Massive modal with 15+ internal helper functions
- Form handling, validation, file uploads, notifications all combined
- Deep component nesting
- Multiple sub-forms embedded

**Specific recommended refactors:**
- Extract sub-components:
  - `ChangeStatusModal/StageSelector.tsx`
  - `ChangeStatusModal/ReasonSelector.tsx`
  - `ChangeStatusModal/ApprovalForm.tsx`
  - `ChangeStatusModal/NotificationPreview.tsx`
- Move form logic to `hooks/useStatusChangeForm.ts`

**Risk:** HIGH - Core workflow functionality  
**Effort:** L

---

### 10. `client/src/pages/service-assignments.tsx` - 2,165 lines
**Why it needs refactoring:**
- Page with extensive inline table rendering
- Multiple filter states without abstraction
- Duplicate rendering patterns

**Specific recommended refactors:**
- Extract `ServiceAssignmentTable.tsx`
- Extract filter logic to custom hook
- Create reusable table column definitions

**Risk:** MEDIUM  
**Effort:** M

---

### Additional RED Files (800-2,000 lines) - Quick Summary:

| File | Lines | Primary Issues | Effort |
|------|-------|----------------|--------|
| `client/src/components/queries/QueriesTab.tsx` | 2,000 | Multiple dialogs inline, mixed concerns | M |
| `client/src/pages/services.tsx` | 1,979 | Similar to service-assignments | M |
| `server/routes/queries.ts` | 1,942 | Token handling + CRUD + email mixed | M |
| `server/project-scheduler.ts` | 1,862 | Complex scheduling logic, test seeding | M |
| `client/src/components/InternalChatView.tsx` | 1,793 | Chat UI + logic combined | M |
| `server/routes/messages.ts` | 1,734 | Multiple message systems in one file | M |
| `client/src/pages/request-template-edit.tsx` | 1,629 | Complex form, DnD, previews | M |
| `client/src/pages/admin.tsx` | 1,608 | Multiple admin panels combined | M |
| `server/services/ai-magic-service.ts` | 1,591 | 20+ function definitions in one file | M |
| `server/routes/notifications.ts` | 1,570 | Multiple notification types mixed | M |
| `server/routes/integrations.ts` | 1,566 | Multiple integrations in one file | M |
| `client/src/pages/messages.tsx` | 1,559 | Complex messaging UI | M |
| `server/routes/tasks.ts` | 1,524 | Task types + instances + templates | M |
| `client/src/pages/custom-request-edit.tsx` | 1,452 | Complex form builder | M |
| `server/routes/superAdmin.ts` | 1,380 | Super admin operations | M |
| `server/routes/excelImport.ts` | 1,379 | Import logic + validation | M |
| `client/src/pages/client-detail/components/people/AddPersonModal.tsx` | 1,363 | Complex form modal | M |
| `server/services/qboQcService.ts` | 1,355 | QBO quality control service | M |
| `client/src/components/settings-modal.tsx` | 1,316 | Multiple settings panels | M |
| `client/src/pages/project-detail.tsx` | 1,305 | Project detail page | M |
| `server/emailService.ts` | 1,296 | All email sending logic | M |
| `client/src/pages/scheduled-notifications.tsx` | 1,228 | Notification scheduling UI | M |
| `client/src/pages/client-detail/components/services/AddServiceModal.tsx` | 1,214 | Service assignment modal | M |
| `client/src/components/companies-house-client-modal.tsx` | 1,206 | CH client creation | M |
| `client/src/pages/internal-task-detail.tsx` | 1,198 | Task detail page | M |
| `client/src/pages/person-detail.tsx` | 1,181 | Person detail page | M |
| `client/src/pages/internal-tasks.tsx` | 1,152 | Internal tasks list | M |
| `client/src/pages/client-detail/components/communications/dialogs/EmailDialog.tsx` | 1,141 | Email composition dialog | M |
| `server/notification-scheduler.ts` | 1,138 | Notification scheduling logic | M |
| `server/utils/applicationGraphClient.ts` | 1,132 | Microsoft Graph integration | M |
| `client/src/pages/companies.tsx` | 1,126 | Companies list page | M |
| `client/src/components/project-chronology.tsx` | 1,123 | Project timeline | M |
| `client/src/pages/excel-import.tsx` | 1,120 | Excel import UI | M |
| `client/src/pages/query-response.tsx` | 1,085 | Query response page | M |
| `client/src/components/kanban-board.tsx` | 1,082 | Kanban board component | M |
| `client/src/components/tasks/TasksWorkspace.tsx` | 1,072 | Tasks workspace | M |
| `client/src/pages/sign.tsx` | 1,070 | Signature page | M |
| `client/src/components/companies-table.tsx` | 1,069 | Companies table | M |
| `client/src/pages/profile.tsx` | 1,061 | User profile page | M |
| `client/src/components/ai-magic/AIMagicChatPanel.tsx` | 1,052 | AI chat panel | M |
| `server/routes/portal.ts` | 1,050 | Portal routes | M |
| `client/src/pages/users.tsx` | 1,050 | Users management | M |
| `server/routes/ai.ts` | 1,032 | AI routes | M |
| `server/routes/serviceImport.ts` | 1,026 | Service import routes | M |
| `server/routes/config.ts` | 1,025 | Configuration routes | M |
| `client/src/pages/client-detail/components/people/PersonTabbedView.tsx` | 1,018 | Person tabbed view | M |
| `server/services/emailIngestionService.ts` | 1,010 | Email ingestion | M |
| `server/notification-sender.ts` | 997 | Notification sending | M |
| `server/storage/notifications/stageChangeNotificationStorage.ts` | 985 | Stage change notifications | M |
| `client/src/pages/signature-request-builder.tsx` | 970 | Signature builder | M |
| `client/src/pages/dashboard.tsx` | 969 | Dashboard page | M |
| `server/storage/base/IStorage.ts` | 950 | Storage interface | M |
| `client/src/components/ClientNotificationsView.tsx` | 936 | Client notifications | S |
| `client/src/components/task-list.tsx` | 929 | Task list component | S |
| `server/routes/internalTasks.ts` | 920 | Internal tasks routes | S |
| `server/routes/clients/services.ts` | 902 | Client services routes | S |
| `client/src/components/DocumentFolderView.tsx` | 894 | Document folder view | S |
| `client/src/pages/company-settings.tsx` | 890 | Company settings | S |
| `server/routes/services.ts` | 880 | Services routes | S |
| `client/src/components/status-change-form.tsx` | 872 | Status change form | S |
| `client/src/components/client-management-modal.tsx` | 872 | Client management | S |
| `client/src/components/queries/ScheduledRemindersPanel.tsx` | 864 | Scheduled reminders | S |
| `client/src/pages/portal/PortalThreadDetail.tsx` | 855 | Portal thread detail | S |
| `client/src/pages/service-import.tsx` | 853 | Service import page | S |
| `client/src/components/calendar/CalendarDayModal.tsx` | 832 | Calendar day modal | S |
| `server/services/queryReminderService.ts` | 824 | Query reminders | S |
| `client/src/components/ProjectMessaging.tsx` | 807 | Project messaging | S |
| `server/routes/clients/companiesHouse.ts` | 801 | Companies House routes | S |

---

## AMBER - SHOULD REFACTOR SOON (82 files, 400-800 lines)

### Notable Files Requiring Attention:

| File | Lines | Issue | Suggested Action |
|------|-------|-------|------------------|
| `client/src/components/ui/sidebar.tsx` | 771 | UI component too complex | Split into parts |
| `client/src/components/project-modal.tsx` | 748 | Form + validation + UI | Extract form logic |
| `client/src/components/dashboard-builder.tsx` | 742 | Complex builder logic | Extract widget components |
| `client/src/pages/ch-changes.tsx` | 731 | CH changes UI | M |
| `client/src/pages/graph-test.tsx` | 728 | Test page, can defer | S |
| `client/src/pages/qbo-qc.tsx` | 726 | QBO QC page | S |
| `client/src/pages/people.tsx` | 726 | People list page | S |
| `server/routes/quickbooks.ts` | 715 | QBO integration routes | S |
| `server/routes/documents.ts` | ~700 | Document management | Split upload/download |
| `server/routes/scheduling.ts` | ~682 | Scheduling endpoints | Can stay |
| Various storage files | 400-700 | Single responsibility issues | S-M |
| Various page components | 400-700 | State management complexity | S-M |

---

## GREEN - MINOR IMPROVEMENTS (Optional)

The remaining ~473 files under 400 lines generally follow good practices. Minor improvements:

1. **Consistent Helper Extraction:** Some route files have validation helpers duplicated (e.g., `validateParams`, `paramUuidSchema`). These should be centralized in `server/routes/routeHelpers.ts` (partially done).

2. **Type Re-exports:** Many index files are just re-exports. This is acceptable but could use barrel exports more consistently.

3. **UI Component Consolidation:** Some shadcn UI components could share more utilities.

---

## Risk Assessment Summary

### High-Risk Areas (Break if touched incorrectly):
1. **`server/storage/index.ts`** - Backend facade; all routes depend on it
2. **`server/routes/auth.ts`** - Authentication critical path
3. **`server/routes/projects.ts`** - Core business logic
4. **`server/routes/signatures.ts`** - Legal compliance feature
5. **`client/src/pages/projects.tsx`** - Primary user interface

### Complexity Hotspots:
1. **Project scheduling system** (`project-scheduler.ts`, `notification-scheduler.ts`)
2. **Status change workflow** (`ChangeStatusModal.tsx`, status-related routes)
3. **Signature/PDF processing** (signatures routes and services)
4. **AI Magic system** (action cards, chat panel, service)

---

## Recommended Refactoring Priority Order

### Phase 1 - Quick Wins (1-2 days each):
1. Extract validation schemas to shared location
2. Split `server/routes/auth.ts` into domain files
3. Extract helper functions from route files

### Phase 2 - High Impact (3-5 days each):
1. Refactor `server/routes/projects.ts` into modules
2. Split `server/storage/index.ts` into facades
3. Decompose `AIMagicActionCards.tsx`

### Phase 3 - Thorough Cleanup (1 week each):
1. Restructure all route files by domain
2. Consolidate storage patterns
3. Extract reusable UI components from pages

---

## Effort Estimates Summary

| Priority | Files | Effort |
|----------|-------|--------|
| RED (Urgent) | 77 | L: 12 files, M: 65 files |
| AMBER (Soon) | 82 | Mostly S-M |
| GREEN (Optional) | 474 | S or none |

---

## Conclusion

This assessment identifies the key files that would most benefit from refactoring. The storage facade and main route files are the highest priority as they affect agent performance and maintainability across the entire system.

**Key Recommendations:**
1. Prioritize splitting the top 10 largest files first
2. Use domain-driven organization for route files
3. Extract reusable components from large page files
4. Consider facade pattern alternatives for storage layer
5. Standardize validation and helper patterns across routes
