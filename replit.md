# The Link - CRM & Project Management Application

## Overview
The Link is a full-stack CRM and project management application designed for accounting and bookkeeping firms. Its primary goal is to automate recurring service delivery, optimize client relationship management, and offer a secure client portal. Key capabilities include intelligent scheduling, automated project generation, Companies House integration, and a mobile-first user experience within a multi-tenant architecture, aiming to enhance firm efficiency and client satisfaction.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
The UI/UX is inspired by modern SaaS platforms, utilizing a specific brand palette and DM Sans font. It follows design principles such as increased spacing, soft modern shadows, and consistent 1rem border-radius. Components are mobile-first, responsive, and maintain a consistent layout with standardized headers, body regions, and tab-based designs. Full-width layouts are used for data-heavy pages, while detail and form pages are centered.

### Technical Implementation
The frontend is built with React, TypeScript, Wouter for routing, TanStack Query for server state management, and `shadcn/ui` with Tailwind CSS for styling. The backend is an Express.js server in TypeScript, providing a modular RESTful API with middleware for authentication, authorization, and validation. It supports sophisticated scheduling with UTC normalization, comprehensive audit trails, and automated nightly project generation. The storage layer comprises 52 domain-focused modules using a facade pattern. Performance is optimized through batch operations, optimistic updates, background prefetching, and state persistence.

### Feature Specifications
The system includes advanced communication tools like RingCentral VoIP integration with AI transcription, AI Magic Call/SMS, email image pasting, and SMS Templates. It offers shared Outlook inbox access via Microsoft Graph API with granular permissions and a dedicated Comms Workspace. MS Calendar integration allows authorized users to view and create calendar events (including Teams meetings), with super admins managing shared calendar access. Project management features include a dynamic "Client Also Has" filter, Tasks filter ownership permissions, and Bookkeeping Query Grouping, alongside a drag-and-drop Pivot Table builder. A multi-channel outbound campaign system supports email (SendGrid), SMS (VoodooSMS), and Voice (Dialora.ai) with client-first targeting, personalized action pages, and analytics, featuring a 7-step creation wizard and multi-step sequences. The application also provides a System Field Library for field reuse across various form builder contexts, supporting 9 form contexts (e.g., Stage Approvals, Client Tasks, Campaign Pages) with consistent wizard-style UI components.

The query reminder service incorporates fail-fast validation and individual error isolation to ensure resilience. RingCentral integration includes automatic token management with auto-disconnection on expiry, proactive token refreshes via a daily cron job, and `lastUsedAt` tracking. The Client Project Tasks system enables service owners to send customizable pre-work checklists to clients via token-based forms, supporting template management, client-level overrides, conditional logic, automated stage changes, notification integration, and optional OTP security.

### System Design
The application utilizes PostgreSQL (Neon) with Drizzle ORM for data persistence, incorporating UUIDs, soft deletes, and JSONB fields. Google Cloud Storage (via Replit App Storage) handles object storage with secure signed URLs. Staff authentication uses Replit Auth (OIDC) with session-based, role-based access control, while the client portal uses passwordless email verification. The multi-tenant architecture emphasizes modularity, extensive database indexing, and a resilient project scheduling orchestrator. Additional features include UK eIDAS-compliant electronic signatures, workflow and status management with Kanban views, AI Audio Transcription, AI-assisted client value notifications, Zapier integration, and an enhanced data import system. A user-friendly error handling system is also implemented.

The application employs a dual-process architecture for web server and cron worker, separating HTTP request handling from scheduled background jobs. A comprehensive cron job telemetry system monitors job execution, detects drift and overlap, coordinates distributed execution using PostgreSQL advisory locks, and handles errors with automatic retries and structured JSON telemetry. Heavy jobs are staggered and protected by execution timeouts.

Cron Lock Acquisition Resilience (Dec 2025):
-   `tryAcquireJobLock` uses retry logic with exponential backoff (3 attempts, 250ms/500ms/1s + jitter) for transient Neon WebSocket connectivity errors
-   Fail-closed semantics: if DB is unreachable after retries, job is SKIPPED (not run) to prevent potential duplicate execution
-   Lock contention (lock held by another instance) is not retried - returns immediately with `HELD_BY_OTHER` reason
-   CRON_INSTANCE_ID generated at cron-worker boot to detect duplicate runner instances during deploys/restarts
-   Structured log markers: `[CRON_BOOT]` at startup, `LOCK_SKIP reason=DB_UNAVAILABLE` on connectivity failures
-   All cron telemetry includes `instance_id` for correlation

Project Message Reminders Optimization (Dec 2025):
-   Fixed "timeout exceeded when trying to connect" errors caused by fake batch queries (N parallel individual queries)
-   `batchGetUsers` and `batchGetProjects` now use TRUE SQL batch queries (`WHERE id IN (...)`) - 2 indexed queries instead of N connections
-   Candidate LIMIT reduced from 100 to 25 to minimize hydration work per run
-   Per-user timeout isolation: 8-second timeout per user prevents one slow email from blocking others
-   Global budget increased from 8s to 25s (appropriate since query phase is now sub-second)
-   Hydration miss logging: warns when users/projects are skipped due to missing data for observability

## External Dependencies

### Third-Party Services
-   **Companies House API**: UK company data integration.
-   **Microsoft Graph API**: Email and calendar access.
-   **RingCentral**: VoIP phone system.
-   **SendGrid**: Transactional email and email campaigns.
-   **VoodooSMS**: Client SMS delivery and SMS campaigns.
-   **Dialora.ai**: AI-powered voice call reminders and voice campaigns.
-   **OpenAI API**: Audio transcription (Whisper), AI text processing (GPT-4o-mini), and AI Magic Assistant.
-   **Replit Platform Services**: Object storage, authentication, and deployment.

### Frontend Libraries
-   **UI Components**: `@radix-ui/*`, `@dnd-kit/*`, `@tiptap/*`, `react-hook-form` with `zod`, `sonner`.
-   **Utilities**: `date-fns`, `clsx`, `tailwind-merge`, `@getaddress/autocomplete`.

### Shared Components

#### System Field Library Components (`client/src/components/field-builder/`)
Reusable wizard-style form builder components providing consistent drag-and-drop UI across 12 form contexts:
-   **types.ts**: 16 unified field types with icons and colors (boolean, short_text, single_select, multi_select, etc.)
-   **adapters.ts**: Adapter pattern for bridging context-specific field types to unified system types with capability flags and mapping functions
-   **FieldConfigModal.tsx**: Shared configuration modal that accepts a capabilities object for context-specific UI feature toggling
-   **FieldCard.tsx**: Split into BaseFieldCard (presentational) and SortableFieldCard (with DnD hooks)
-   **SortableFieldList.tsx**: Standalone DnD list for field reordering
-   **FieldBuilder.tsx**: Composite component combining palette, canvas, and config modal

Adapter Architecture:
-   Each context adapter provides `mapToFieldDefinition(field)` to convert context-specific fields to unified FieldDefinition
-   Each context adapter provides `mapFromFieldDefinition(field)` to convert back to context-specific format with explicit defaults
-   Capability flags (`supportsConditionalLogic`, `supportsExpectedValue`, `supportsValidationRules`, `supportsOptions`, `supportsPlaceholder`, `supportsHelpText`, `supportsLibraryPicker`) toggle UI features per context
-   `normalizeFieldType()` handles legacy field type aliases (yes_no → boolean, single_choice → single_select) with fallback icons for unknown types

Conditional Logic Support:
-   **ConditionalLogicEditor.tsx**: Standalone reusable component for configuring question visibility based on previous answers
-   Data structure: `{ showIf: { questionId, operator, value } }` stored as JSONB in database
-   Operators: equals, not_equals, contains, is_empty, is_not_empty
-   Supports cross-section question references (questions sorted by section order, then question order)
-   Integration pattern: Render ConditionalLogicEditor when `previousQuestions.length > 0`, manage state via useState

Migrated Contexts:
-   Stage Approvals: Uses ApprovalFieldConfigModal wrapper with stageApprovalFieldAdapter
-   Client Tasks: Uses ClientTaskQuestionConfigModal wrapper with clientTaskQuestionAdapter, preserving conditionalLogic and sectionId
-   Request Templates: Full conditional logic support in request-template-edit.tsx with centralized questions query, System Library integration with collapsible section/search/filter, colorful field type icons
-   Custom Requests: Full conditional logic support in custom-request-edit.tsx with flattened questions from sections, System Library integration with collapsible section/search/filter, colorful field type icons

Field Type Color Scheme (consistent across form builders):
-   short_text: #3b82f6 (blue), long_text: #8b5cf6 (purple), email: #06b6d4 (cyan)
-   number: #22c55e (green), date: #f59e0b (orange), single_choice: #ec4899 (pink)
-   multi_choice: #14b8a6 (teal), dropdown: #6366f1 (indigo), yes_no: #84cc16 (lime), file_upload: #f43f5e (rose)