# The Link - CRM & Project Management Application

## Overview
The Link is a comprehensive full-stack CRM and project management application designed for accounting and bookkeeping firms. Its primary goal is to automate recurring service delivery, streamline client relationship management, and provide a secure client portal for communication and document exchange. Key features include intelligent scheduling, automated project generation, integration with Companies House, and a mobile-first user experience. The application aims to enhance efficiency and client satisfaction through automation, compliance, and robust access controls within a multi-tenant architecture.

## User Preferences
Preferred communication style: Simple, everyday language.

## Testing & Development
**Staff Login Credentials (Development):**
- URL: / (root)
- Navigate to Passwords tab
- Email: admin@example.com
- Password: admin123

## TypeScript Refactoring Status
**Current Error Count:** 9 (down from 1,829 - 99.5% reduction)

**Remaining Errors (non-blocking):**
- 3 client-side: Form field type inference issues in AddServiceModal.tsx, EditServiceModal.tsx, profile.tsx (unknown → ReactNode)
- 6 server-side: Service type shape mismatches in project-scheduler.ts and schedule-calculator.ts

**Completed Refactoring:**
- Storage facade TypeScript mixin composition with AllStorageDeps intersection type
- StorageBase properties changed from protected to public readonly for proper facade mixin typing
- All 52 storage instances properly typed across 14 facade mixins
- Form component typing fixes for nationality enum fields (using targeted field-level casts)
- Type guard pattern for optional user properties (e.g., `'hasPassword' in user`)

**Known Type Patterns:**
- Nationality fields use `(value ?? undefined) as UpdatePersonData['nationality']` for enum compatibility
- Service entity has different type shapes in scheduler vs. storage - requires schema-level unification for full fix

## System Architecture

### UI/UX
The application features a modern SaaS aesthetic inspired by Linear, Stripe, and Notion, utilizing a specific brand palette and DM Sans font. Design principles emphasize increased spacing, soft modern shadows, and consistent 1rem border-radius for cards. All components are modernized, mobile-first, responsive, and follow a consistent Phase 3 layout pattern with standardized header blocks, body regions, and tab-based layouts. Data-heavy list/table pages use full-width layouts, while detail/form pages remain centered.

### Technical Implementation
The frontend is built with React, TypeScript, Wouter for routing, TanStack Query for server state, and shadcn/ui with Tailwind CSS for styling. The backend is an Express.js server in TypeScript, providing a modular RESTful API with middleware for authentication, authorization, and validation. It handles service mapping, project creation, sophisticated scheduling with UTC normalization, and comprehensive audit trails. A nightly scheduler automates project generation. The backend storage layer uses 52 domain-focused modules with a facade pattern for backward compatibility.

### Backend Route Architecture
Routes are organized into modular files in `server/routes/` for maintainability. Key route modules include:

**Core & Authentication:**
- `system.ts` - Health check, feature flags
- `auth/index.ts`, `auth/core.ts`, `auth/bootstrap.ts` - Staff authentication, impersonation, bootstrap admin
- `users.ts` - User CRUD, profiles, notifications, session management
- `portal.ts` - Client portal authentication and access
- `portal-users.ts` - Portal user management, magic links, QR codes

**Data Management:**
- `clients.ts` - Client management, Companies House integration, tags
- `people.ts` - People management, relationships, contact details
- `projects.ts` - Project CRUD, scheduling, Kanban views, CSV upload
- `services.ts` - Service management, work roles, assignments
- `tasks.ts` - Task templates and instances
- `internalTasks.ts` - Staff tasks and quick reminders
- `queries.ts` - Bookkeeping queries management

**Documents & Storage:**
- `documents.ts` - Document CRUD, folder management
- `objects.ts` - Object storage upload/download with signed URLs
- `signatures.ts` - Electronic signature workflows

**Communication:**
- `messages.ts` - Internal messaging, project communications
- `emails.ts` - Email composition and sending
- `notifications.ts` - Push notifications, scheduled reminders
- `integrations.ts` - OAuth (Outlook, RingCentral), external services

**Configuration & Admin:**
- `config.ts` - System settings, stages, approvals, project types
- `dashboards.ts` - Dashboard CRUD
- `analytics.ts` - Dashboard data, analytics endpoints
- `views.ts` - Custom company views
- `preferences.ts` - User column and project preferences
- `superAdmin.ts` - Super admin operations
- `admin/misc.ts` - Admin utilities (test data cleanup, scheduling exceptions)

**Utilities:**
- `search.ts` - Global super search
- `activity.ts` - Activity tracking
- `address.ts` - UK address lookup (getaddress.io)
- `import.ts` - Data import validation/execution
- `ai.ts` - AI transcription and text processing
- `calendar.ts` - Calendar integration
- `friendlyErrors.ts` - User-friendly error handling

### System Design
PostgreSQL (Neon) with Drizzle ORM is the primary database, utilizing UUIDs, soft deletes, and JSONB fields. Google Cloud Storage (via Replit App Storage) handles object storage with secure signed URLs. Staff authentication uses Replit Auth (OIDC) with session-based, role-based access control, while the client portal uses passwordless email verification with magic link tokens. The system is multi-tenant and designed for modularity, with extensive database indexing for performance optimization.

Key features include automated project and service management, advanced communication tools (push notifications, internal tasks with quick reminders, email threading via Microsoft Graph, multi-channel client notifications with AI assistance), UK eIDAS-compliant electronic signatures for multi-page PDFs, comprehensive workflow and status management with Kanban views, and Bookkeeping Queries for managing transaction-related questions between staff and clients. The Bookkeeping Queries system captures full transaction details (date, description, money in/out amounts, VAT status) alongside query text, internal staff comments, and client responses. Features include status tracking from open through to resolved, inline VAT editing, bulk actions for sending queries to clients or marking them resolved, and integration with the email composer for sending queries via Outlook (with SendGrid fallback). When queries are sent to clients, the system generates a secure token-based access link and logs the event to project chronology. The EmailDialog uses a tabbed layout when sending query emails: the Compose tab contains recipients, subject, and message content, while the Scheduling tab shows the link expiry date, channel availability (Email/SMS/Voice counts based on recipient phone numbers), and reminder schedule configuration. Users must visit the Scheduling tab before sending to ensure they review the automated follow-up settings. The internal tasks system includes a lightweight Quick Reminders feature that allows staff to create simple reminders (name, details, date/time, optional client link) without the overhead of full task creation. The Tasks & Reminders workspace features aligned column layouts between tables, a Linked Entities column displaying connected projects/clients/persons, collapsible sections to focus on specific content, and column header filters for data interrogation with debounced search inputs. Reminders can be converted to full tasks when more detail is needed. When reminders become due, the system automatically sends push notifications and emails to the assigned staff member with the reminder name in the email subject. Reminder notifications are processed every 15 minutes between 07:00-22:00 UK time via a dedicated cron job (server/reminder-notification-cron.ts). The Kanban board supports a Compact View mode that collapses all stages to narrow columns showing just the stage name (vertically), project count, and overdue indicator, allowing users to see all stages at a glance. Users can expand individual stages while keeping others compact, and the preference is persisted to localStorage. Internal Chat includes automatic archiving of message threads when projects are completed and auto-unarchiving when projects are reopened, plus a "Group by Project" view option to organize conversations by their associated projects. Specialized features include a secure "No Longer a Client" process, unified client and people management, and a Project Bench feature for temporarily suspending projects. Feature flags allow for dynamic control of communication features. The application also includes an AI Audio Transcription service (Whisper and GPT-4o-mini), client value notifications with AI-assisted drafting and Microsoft Graph integration, Zapier integration via webhooks, and an enhanced data import system with interactive field mapping. A friendly error handling system replaces technical errors with user-friendly messages. A scheduled notifications calendar provides a comprehensive view and management of automated notifications, with stage-aware notification suppression for intelligent reminder delivery. A resilient project scheduling orchestrator ensures robustness against server restarts and outages, with features like startup catch-up, database-based locking, idempotency protection, and retry logic.

Neon database configuration recommendations for production include disabling auto-pause, increasing idle timeout, and using pooled connection mode for optimal reliability.

## External Dependencies

### Third-Party Services
-   **Companies House API**: For UK company data integration.
-   **Microsoft Graph API**: For tenant-wide email and calendar access (application permissions).
-   **RingCentral**: For VoIP phone system integration.
-   **SendGrid**: For transactional email delivery.
-   **VoodooSMS**: For client SMS delivery.
-   **Dialora.ai**: For AI-powered voice call reminders via webhook integration.
-   **OpenAI API**: Whisper for audio transcription, GPT-4o-mini for AI text processing, and function-calling for the AI Magic Assistant.
-   **Replit Platform Services**: For object storage, authentication, and deployment.

### Frontend Libraries
-   **UI Components**: `@radix-ui/*`, `@dnd-kit/*`, `@tiptap/*`, `react-hook-form` with `zod`, `sonner`.
-   **Utilities**: `date-fns`, `clsx`, `tailwind-merge`, `@getaddress/autocomplete`.

### Projects Page Architecture (Refactored)
The Projects page (`client/src/pages/projects.tsx`) has been refactored into modular hooks and components for better maintainability. The main file is now 270 lines (reduced from 2,507 lines).

**Hooks** (`client/src/hooks/projects-page/`):
- `useProjectsData.ts` - Data fetching with useQuery for projects, users, services
- `useProjectFiltering.ts` - Project filtering logic and state
- `useProjectsUrlSync.ts` - URL synchronization for filters
- `useProjectsMutations.ts` - All mutation operations (create/update/delete)
- `useViewManagement.ts` - Saved views load/save handlers
- `useDashboardManagement.ts` - Dashboard CRUD and state management
- `useProjectsPageState.ts` - Main state coordinator that combines all hooks

**Components** (`client/src/components/projects-page/`):
- `ProjectsHeader.tsx` - Toolbar, view mode buttons, filters toolbar
- `ProjectsContent.tsx` - Main content area showing projects
- `modals/CreateDashboardModal.tsx` - Dashboard creation/editing modal
- `modals/AddWidgetDialog.tsx` - Widget type selection dialog
- `modals/SaveViewDialog.tsx` - Save view dialog
- `modals/DeleteConfirmDialogs.tsx` - Confirmation dialogs for deletion

**Types** (`client/src/types/projects-page.ts`):
- Shared types for Widget, Dashboard, CalendarSettings, etc.

### ChangeStatusModal Architecture (Refactored)
The ChangeStatusModal (`client/src/components/ChangeStatusModal.tsx`) has been refactored into modular hooks and components for better maintainability. The main file is now 526 lines (reduced from 1,224 lines).

**Hooks** (`client/src/hooks/change-status/`):
- `useStageChangeConfig.ts` - Config fetching for stages, reasons, approvals, and derived data
- `useStatusChangeMutations.ts` - All 4 mutation operations (updateStatus, submitApprovalResponses, sendStaffNotification, sendClientNotification)
- `useApprovalFormSchema.ts` - Dynamic Zod schema generation for stage approval forms
- `useCustomFields.ts` - Custom field state management and validation
- `useFileUpload.ts` - File upload handling with Object Storage integration
- `useQueriesManagement.ts` - Query entry state management (add/update/remove/bulk import)

**Components** (`client/src/components/change-status/`):
- `StatusChangeFormContent.tsx` - Main form content (stage selector, reason, custom fields, notes, attachments)
- `StageApprovalForm.tsx` - Dynamic approval form with boolean, number, text, and multi-select fields
- `CustomFieldsSection.tsx` - Custom field inputs based on reason configuration
- `AttachmentsSection.tsx` - File upload UI with drag-and-drop support
- `QueriesForm.tsx` - Query entry form with bulk CSV import
- `StaffNotificationContent.tsx` - Staff notification preview and send UI with audio recording

**Types** (`client/src/types/changeStatus.ts`):
- Shared types for StatusChangeFormValues, ApprovalFormData, QueryEntry, etc.

**Utilities** (`client/src/lib/changeStatusUtils.ts`):
- Helper functions: formatStageName, formatChangeReason, formatRoleName, getSenderName, extractFirstName, formatRecipientFirstNames