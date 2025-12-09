# The Link - CRM & Project Management Application

## Overview
The Link is a full-stack CRM and project management application for accounting and bookkeeping firms. It automates recurring service delivery, streamlines client relationship management, and provides a secure client portal. Key features include intelligent scheduling, automated project generation, Companies House integration, and a mobile-first user experience. The application aims to enhance efficiency and client satisfaction through automation, compliance, and robust access controls within a multi-tenant architecture. It focuses on business vision, market potential, and project ambitions to improve firm operations and client engagement.

## User Preferences
Preferred communication style: Simple, everyday language.

### Development Login
- URL: Root page `/`, use the "Passwords" tab
- Credentials: `admin@example.com` / `admin123`

## System Architecture

### UI/UX
The application features a modern SaaS aesthetic inspired by Linear, Stripe, and Notion, using a specific brand palette and DM Sans font. Design principles emphasize increased spacing, soft modern shadows, and consistent 1rem border-radius. Components are modernized, mobile-first, responsive, and follow a consistent Phase 3 layout with standardized header blocks, body regions, and tab-based layouts. Data-heavy pages use full-width layouts, while detail/form pages remain centered.

### Technical Implementation
The frontend uses React, TypeScript, Wouter for routing, TanStack Query for server state, and shadcn/ui with Tailwind CSS for styling. The backend is an Express.js server in TypeScript, providing a modular RESTful API with middleware for authentication, authorization, and validation. It handles service mapping, project creation, sophisticated scheduling with UTC normalization, and comprehensive audit trails. A nightly scheduler automates project generation. The backend storage layer uses 52 domain-focused modules with a facade pattern.

### Backend Route Architecture
Routes are organized into modular files in `server/routes/` covering core functionalities such as authentication, user management, client and people management, project and service management, document handling, communication tools, configuration, and administrative tasks.

### Stage Change Optimization
The stage change flow has been optimized to reduce database operations and achieve sub-300ms response times through batch operations, optimized validation, frontend optimistic updates, and caching.

### Client Also Has Filter
A dynamic filter allows users to filter projects based on whether the same client has other active projects of specified types, enabling prioritization of work for clients with multiple service needs.

### List View Settings Persistence
Ensures consistent display of columns, pagination, and sort settings in project management list views through defensive validation and state management.

- **Per-View Column Preferences**: Saved views now store column visibility, order, and widths alongside filters. When loading a saved list view, the column preferences are restored automatically.
- **Unique viewType Isolation**: The main projects list uses `viewType="projects-list"` to prevent column preference conflicts with other table components.
- **Robust Validation**: Column preferences are validated to require the 'client' column and at least 3 visible columns. Invalid/corrupted preferences fallback to defaults.

Key files: `client/src/components/task-list.tsx`, `client/src/hooks/projects-page/useViewManagement.ts`, `client/src/hooks/projects-page/useProjectsPageState.ts`

### Background Prefetch Optimization
Improves perceived performance by preloading data for secondary views during browser idle time using `requestIdleCallback`.

### RingCentral VoIP Integration
Full VoIP phone system integration enabling staff to make and receive calls directly from the CRM with automatic call logging and AI-powered transcription, including a three-tier fallback for transcription services (RingSense, RingCentral Speech-to-Text, OpenAI Whisper).

### AI Magic Call/SMS Integration
Provides natural language voice calling and SMS capabilities through an AI Magic assistant, allowing users to initiate communications using conversational commands with fuzzy contact matching and disambiguation.

### Email Image Paste Feature
Enables pasting and dragging images directly into email composition areas, with automatic upload to object storage and embedding via permanent URLs.

### SMS Templates Feature (December 2025)
Reusable SMS message templates with variable support for personalization. Admins create templates at `/sms-templates`; staff select them when composing SMS messages.

- **Variable Support**: Three variables available:
  - `{firstName}` - Recipient's first name (from person.firstName field)
  - `{userFirstName}` - Sender's first name (from user profile)
  - `{calendlyLink}` - Sender's Calendly booking link (from user profile)
- **Auto-Substitution**: Variables replaced when template selected; updates when recipient changes
- **Placeholder Alerts**: Contextual warnings for missing data (no recipient, incomplete user profile)
- **Audit Trail**: Template ID captured when sending SMS for tracking

Key files: `client/src/pages/sms-templates.tsx`, `client/src/components/SmsTemplatePicker.tsx`, `client/src/pages/client-detail/components/communications/dialogs/SMSDialog.tsx`

### Shared Outlook Inbox Access (December 2025)
System for accessing shared Outlook inboxes (like payroll@growth.accountants) and allowing managers to access staff inboxes via Microsoft Graph API application permissions.

- **Global Inbox Registry**: Super admins manage a central registry of all available inboxes (both user-linked and shared mailboxes) at `/inbox-management`
- **User Inbox Access**: Super admins grant users access to specific inboxes via the user-detail page. Users can only access inboxes explicitly granted to them
- **Access Levels**: Three levels available - `read`, `write`, `full`
- **Auto-Population**: When users log in, their personal inbox is automatically added to the registry if not already present
- **My Inboxes**: Users can view their accessible inboxes via `/api/my-inboxes` endpoint

Key files: `shared/schema/email/tables.ts`, `server/storage/integrations/emailStorage.ts`, `server/routes/emails.ts`, `client/src/pages/inbox-management.tsx`, `client/src/pages/user-detail.tsx`

### Comms Workspace (December 2025)
A dedicated workspace mode for email communications, accessible via toggle alongside Projects/Tasks in the main navigation.

- **Feature Flag**: Controlled by `emailModuleActive` company setting (super admin toggle at `/company-settings`)
- **Public Settings API**: `GET /api/company-settings` returns feature flags for all authenticated users
- **Inbox Selector**: Users see only inboxes they've been granted access to
- **2-Column Layout**: Left column for inbox list, right column for email view (top) and AI Assist (bottom)
- **Email Fetching**: `GET /api/comms/inbox/:inboxId/messages` and `GET /api/comms/inbox/:inboxId/messages/:messageId` query Microsoft Graph API directly with access control and feature flag checks
- **Multi-Select Inbox Assignment**: `POST /api/users/:userId/inbox-access/bulk` allows granting access to multiple inboxes at once with validation
- **Person Matching**: Only emails from/to contacts matching CRM person records are displayed (planned)
- **AI Assist Panel**: Context-aware briefing notes and suggested replies powered by OpenAI (planned)

Key files: `client/src/components/comms/CommsWorkspace.tsx`, `client/src/components/projects-page/ProjectsContent.tsx`, `server/routes/emails.ts`, `server/routes/superAdmin.ts`

### Tasks Filter Ownership Permission (December 2025)
Tasks page filter button supports filtering by ownership with permission-based visibility.

- **Filter Options**: Three ownership filter values:
  - "My tasks / reminders" - Tasks assigned to the current user
  - "Created by me - for others" - Tasks created by user but assigned to others
  - "All (can see all tasks)" - View all tasks (requires permission)
- **canSeeAllTasks Permission**: Boolean field on users table; only users with this flag set to true can see and use the "All" filter option
- **Security**: Permission defaults to false; admins must explicitly grant access

Key files: `client/src/components/projects-page/ProjectsHeader.tsx`, `shared/schema/users/tables.ts`, `migrations/0011_add_can_see_all_tasks.sql`

### System Design
PostgreSQL (Neon) with Drizzle ORM is the primary database, utilizing UUIDs, soft deletes, and JSONB fields. Google Cloud Storage (via Replit App Storage) handles object storage with secure signed URLs. Staff authentication uses Replit Auth (OIDC) with session-based, role-based access control; the client portal uses passwordless email verification. The system is multi-tenant and designed for modularity, with extensive database indexing. Key features include automated project management, advanced communication tools (push notifications, internal tasks, email threading via Microsoft Graph, multi-channel client notifications with AI assistance, RingCentral VoIP with automatic transcription), UK eIDAS-compliant electronic signatures, comprehensive workflow and status management with Kanban views, and Bookkeeping Queries. It also includes an AI Audio Transcription service, client value notifications with AI-assisted drafting, Zapier integration via webhooks, and an enhanced data import system. A friendly error handling system replaces technical errors with user-friendly messages. A scheduled notifications calendar provides comprehensive management of automated notifications, with stage-aware suppression. A resilient project scheduling orchestrator ensures robustness against server restarts and outages.

## External Dependencies

### Third-Party Services
-   **Companies House API**: For UK company data integration.
-   **Microsoft Graph API**: For tenant-wide email and calendar access.
-   **RingCentral**: For VoIP phone system integration.
-   **SendGrid**: For transactional email delivery.
-   **VoodooSMS**: For client SMS delivery.
-   **Dialora.ai**: For AI-powered voice call reminders via webhook.
-   **OpenAI API**: Whisper for audio transcription, GPT-4o-mini for AI text processing, and function-calling for AI Magic Assistant.
-   **Replit Platform Services**: For object storage, authentication, and deployment.

### Frontend Libraries
-   **UI Components**: `@radix-ui/*`, `@dnd-kit/*`, `@tiptap/*`, `react-hook-form` with `zod`, `sonner`.
-   **Utilities**: `date-fns`, `clsx`, `tailwind-merge`, `@getaddress/autocomplete`.