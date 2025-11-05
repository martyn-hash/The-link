# The Link - CRM & Project Management Application

## Overview

The Link is a comprehensive full-stack CRM and project management application designed for accounting and bookkeeping firms. It automates recurring service delivery through intelligent scheduling, manages client relationships, and provides a seamless client portal for communication and document exchange. Key features include client, contact, service, project, and communication management, with a focus on automation, compliance, and a mobile-first user experience. It supports automated project generation, Companies House integration for UK company data, and a multi-tenant architecture with robust access controls.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React and TypeScript, using Wouter for routing, TanStack Query for server state, and shadcn/ui with Tailwind CSS for design. It follows a mobile-first approach with responsive layouts and touch-optimized interactions.

### Backend

The backend is an Express.js server in TypeScript, providing a modular RESTful API. It includes middleware for authentication, authorization, and validation. Core logic handles service mapping, project creation, and scheduling, with UTC date normalization and audit trails. A nightly scheduler automates project creation.

### Data Storage

PostgreSQL (Neon) is the primary database, accessed via Drizzle ORM. The schema uses UUIDs, soft deletes, JSONB fields, and indexing for entities like users, clients, projects, services, and tasks. Google Cloud Storage, managed through Replit App Storage, handles object storage with signed URLs for secure document access.

### Authentication & Authorization

Staff authentication uses Replit Auth (OIDC) with session-based, role-based access control. Client portal authentication uses passwordless email verification. Access controls ensure staff roles are respected and portal users are isolated to their clients.

### Service Scheduling & Project Automation

An automated nightly scheduler generates projects from active client and people services based on defined frequencies. It includes advanced date logic and integrates with the Companies House API for UK company data, managing syncs and API keys. Duplicate prevention and an admin dashboard for monitoring are included.

### Client Service Role Assignment & Task Cascading

The system manages role assignments for client services with automatic task synchronization. When role assignments change, active projects generated from that service are updated with corresponding role-based task assignments. Backend verification ensures security. The client service detail page displays related projects.

### Push Notification Template Management

A system for managing customizable push notification templates allows for seven types of notifications with multiple active templates per type. Notifications use dynamic variables for personalization and can include custom icons stored in Google Cloud Storage. An admin UI allows management and testing of templates.

### Internal Tasks System

The internal tasks system provides comprehensive staff task management. Features include a collapsible task creation form, document attachments integrated with Google Cloud Storage for secure file handling, and enhanced data loading for tasks including assignee and creator details. The task detail page has a responsive layout, and progress notes include user attribution. Client detail pages integrate relevant internal tasks.

### Standalone Staff-to-Staff Messaging

The `/internal-chat` page supports independent staff-to-staff message threads. It uses dedicated database tables and API routes for thread creation, messaging, and archiving. The frontend unifies both project and staff message threads, with a "New Thread" dialog for creating staff-specific conversations. Push notifications are integrated for new staff messages.

### Email Threading & Deduplication System

**Implementation Status: Phase 8 Complete (80%)** (Core backend + email sending + noise control + attachments ready)

The email threading system integrates Microsoft Graph to ingest staff emails and automatically link them to client timelines. 

**✅ Implemented Features (Phases 1-8):**

-   **Database Schema**: 10 tables including `email_messages`, `mailbox_message_map`, `email_threads`, `unmatched_emails`, `client_email_aliases`, `client_domain_allowlist`, `email_attachments`, `email_message_attachments`, `graph_webhook_subscriptions`, `graph_sync_state`
-   **Deduplication**: Global unique key using `internetMessageId` to prevent duplicate entries when multiple staff are CC'd on the same email
-   **Thread Grouping**: Three-layer approach - (1) `canonicalConversationId` grouping, (2) ancestry-based threading via `inReplyTo`/`References` headers, (3) computed `threadKey` hash for orphaned messages
-   **Client Association**: Multi-layered matching - (1) exact email match against `client_email_aliases` (high confidence), (2) domain match against `client_domain_allowlist` (medium confidence), (3) quarantine for unmatched emails (low confidence)
-   **Delta Sync**: Efficient incremental sync for Inbox and Sent Items folders per staff mailbox, with proper Graph API delta token handling
-   **Mailbox Mapping**: Tracks which staff mailboxes contain copies of each message for proper attribution
-   **Webhook Management**: Create, renew, and delete Graph webhook subscriptions with expiry tracking
-   **Quarantine System**: Message-level quarantine with duplicate prevention via `getUnmatchedEmailByMessageId` check
-   **Nightly Resolver**: Scheduled job (3:00 AM UTC) that retroactively matches quarantined emails when new aliases/domains added, includes ancestry-based promotion (entire thread promoted when any message matches) and auto-cleanup of resolved/old entries (>90 days + >5 retries)
-   **Optimized Queries**: `getThreadsWithoutClient()` for scalable client association at scale
-   **Email Sending**: POST /api/emails/:messageId/reply endpoint with HTML/plain text support, user access validation, reply/reply-all functionality via Graph API (creates draft, updates body, sends), automatic Sent Items ingestion
-   **Noise Control (Phase 8.1-8.2)**: Internal-only thread detection (isInternalOnly flag for @growth-accountants.com/@thelink.uk.com), email direction classification (inbound/outbound/internal/external), participant counting, marketing/list email detection (list-id headers, auto-reply indicators, large distribution >10 recipients)
-   **Attachment Deduplication (Phase 8.3)**: SHA-256 content hashing for dedup, automatic download from Graph API, Google Cloud Storage upload with hash-based paths (`attachments/{contentHash}/{filename}`), idempotent message-attachment linking via `checkEmailMessageAttachmentExists()`, unique constraint on `(internetMessageId, attachmentId)` for database-level enforcement, skips inline attachments and oversized files (>25MB), fetches attachments explicitly during incremental delta syncs when metadata missing

**📋 Planned Features (Phases 9-10):**

-   **UI Implementation (Phase 9)**: Email timeline on client detail page, thread view, reply interface, quarantine review
-   **Monitoring & Testing (Phase 10)**: Webhook resilience, error handling, e2e tests, admin dashboard

**Service Location:** `server/services/emailIngestionService.ts`

**Key Design Decisions:**
- `internetMessageId` chosen as global dedup key (not Graph `id` which is mailbox-specific)
- Idempotent upsert preserves enrichment fields (`threadId`, `clientId`) across delta syncs
- Normalized email addresses (lowercase) for consistent matching
- Multi-layered threading handles broken/missing conversation IDs gracefully
- Content-based attachment dedup using SHA-256 hash - same file content stored once, linked multiple times
- Application-level dedup check (`checkEmailMessageAttachmentExists`) + database-level unique constraint for race condition safety
- Delta sync doesn't expand attachments by default - must fetch explicitly when `hasAttachments=true` but metadata missing

## External Dependencies

### Third-Party Services

-   **Companies House API**: UK company data.
-   **Microsoft Graph API**: Staff email integration.
-   **RingCentral**: VoIP phone system integration.
-   **SendGrid**: Transactional email delivery.
-   **VoodooSMS**: Planned client SMS communications.
-   **Replit Platform Services**: Object Storage (Google Cloud Storage backend), Auth (OIDC provider), deployment environment.

### Frontend Libraries

-   **UI Components**: `@radix-ui/*`, `@dnd-kit/*`, `react-quill`, `react-hook-form` with `zod`, `sonner`.
-   **Utilities**: `date-fns`, `clsx`, `tailwind-merge`, `@getaddress/autocomplete`.

### Build & Development Tools

-   **Build Pipeline**: Vite, esbuild, TypeScript, PostCSS.
-   **Development Enhancements**: `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `tsx`.
-   **Database Tools**: `drizzle-kit`, `drizzle-orm`.