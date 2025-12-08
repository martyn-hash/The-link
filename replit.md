# The Link - CRM & Project Management Application

## Overview
The Link is a full-stack CRM and project management application designed for accounting and bookkeeping firms. It aims to automate recurring service delivery, streamline client relationship management, and provide a secure client portal. Key capabilities include intelligent scheduling, automated project generation, Companies House integration, and a mobile-first user experience. The application focuses on enhancing efficiency and client satisfaction through automation, compliance, and robust access controls within a multi-tenant architecture.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
The application features a modern SaaS aesthetic inspired by Linear, Stripe, and Notion, using a specific brand palette and DM Sans font. Design principles emphasize increased spacing, soft modern shadows, and consistent 1rem border-radius. Components are modernized, mobile-first, responsive, and follow a consistent Phase 3 layout with standardized header blocks, body regions, and tab-based layouts. Data-heavy pages use full-width layouts, while detail/form pages remain centered.

### Technical Implementation
The frontend uses React, TypeScript, Wouter for routing, TanStack Query for server state, and shadcn/ui with Tailwind CSS for styling. The backend is an Express.js server in TypeScript, providing a modular RESTful API with middleware for authentication, authorization, and validation. It handles service mapping, project creation, sophisticated scheduling with UTC normalization, and comprehensive audit trails. A nightly scheduler automates project generation. The backend storage layer uses 52 domain-focused modules with a facade pattern.

### Backend Route Architecture
Routes are organized into modular files in `server/routes/` covering core functionalities such as authentication, user management, client and people management, project and service management, document handling, communication tools, configuration, and administrative tasks.

### Stage Change Optimization (December 2025)
The stage change flow has been optimized across 5 waves to reduce database operations from 25-55+ to 10-20 per change (~65-75% reduction), achieving sub-300ms response times:
- **Wave 1**: Batch field response insertions, static imports, data passthrough to background operations
- **Wave 2**: Consolidated validation queries with JOINs, batch notification status updates
- **Wave 3**: Frontend optimistic updates with pendingMove state, backend async operations via setImmediate
- **Wave 4**: TTL cache for stage config with 5-minute expiration and comprehensive invalidation (admin endpoints at `/api/admin/cache-stats` and `/api/admin/cache-invalidate`)
- **Wave 5**: Batch query creation during stage changes (uses `/api/projects/:id/queries/bulk`)

Key files: `server/utils/ttlCache.ts`, `server/routes/projects/status.ts`, `server/storage/projects/projectStatusStorage.ts`, `client/src/hooks/change-status/useStatusChangeMutations.ts`

### Client Also Has Filter (December 2025)
A dynamic filter that allows users to filter projects based on whether the same client has other active projects of specified types. This enables prioritizing work for clients with multiple service needs (e.g., show bookkeeping projects only for clients who also have active VAT projects).

- **Filter UI**: Multi-select checkboxes in the FilterPanel showing all project types, with badges displaying selected types
- **Filter Logic**: Client-side filtering in `filterByClientHasProjectTypes()` checks if the client has other active projects matching selected types
- **Persistence**: Filter state saved in views' `filters` JSON field as `clientHasProjectTypeIds` array
- **Integration**: Works with saved views, URL sync, and filter count calculations

Key files: `client/src/lib/projectFilterUtils.ts`, `client/src/components/filter-panel.tsx`, `client/src/hooks/projects-page/useProjectsPageState.ts`

### Background Prefetch Optimization (December 2025)
Improves perceived performance by preloading data for secondary views after the primary content loads. When the user loads the Projects view, tasks data is prefetched in the background during browser idle time.

- **Hook**: `useBackgroundPrefetch` - reusable hook for scheduling background data fetches
- **Idle Scheduling**: Uses `requestIdleCallback` with `setTimeout` fallback for cross-browser support
- **Cache Awareness**: Checks cache freshness before prefetching to avoid redundant network requests
- **Trigger**: Prefetch starts 500ms after projects finish loading, only when authenticated

Key files: `client/src/hooks/useBackgroundPrefetch.ts`, `client/src/hooks/projects-page/useProjectsPageState.ts`

### RingCentral VoIP Integration (December 2025)
Full VoIP phone system integration enabling staff to make and receive calls directly from the CRM with automatic call logging and AI-powered transcription.

- **OAuth Authentication**: Per-user OAuth flow stores tokens in database, auto-refreshes before expiry
- **WebRTC Calling**: SIP-based WebPhone with WebSocket signaling for real-time calls
- **Call Logging**: Automatic creation of communication records with call metadata (direction, duration, session ID)
- **Automatic Transcription**: Calls >5 seconds trigger background transcription via RingCentral AI API
  - Status flow: `pending` → `requesting` → `processing` → `completed`/`failed`
  - Short calls get `not_available` status immediately
  - Uses polling approach (30s wait, then queries every 10s up to 5 minutes)
- **AI Summaries**: Two-tier approach for generating call summaries:
  1. **RingSense API** (if available): Provides transcript + AI summary + action items in one call
  2. **Fallback**: Speech-to-Text API + Text Summarization API (abstractive/extractive summaries)
- **UI Display**: ViewCommunicationDialog shows transcript status, summary, and expandable full transcript

Key files: `client/src/components/ringcentral-phone.tsx`, `server/routes/integrations.ts`, `server/utils/userRingCentralClient.ts`, `server/transcription-service.ts`

Required OAuth scopes: RingOut, ReadCallLog, ReadCallRecording, AI, VoIP, WebSocket

### System Design
PostgreSQL (Neon) with Drizzle ORM is the primary database, utilizing UUIDs, soft deletes, and JSONB fields. Google Cloud Storage (via Replit App Storage) handles object storage with secure signed URLs. Staff authentication uses Replit Auth (OIDC) with session-based, role-based access control; the client portal uses passwordless email verification. The system is multi-tenant and designed for modularity, with extensive database indexing. Key features include automated project management, advanced communication tools (push notifications, internal tasks with quick reminders, email threading via Microsoft Graph, multi-channel client notifications with AI assistance, RingCentral VoIP with automatic transcription), UK eIDAS-compliant electronic signatures, comprehensive workflow and status management with Kanban views, and Bookkeeping Queries for managing transaction-related questions. It also includes an AI Audio Transcription service, client value notifications with AI-assisted drafting, Zapier integration via webhooks, and an enhanced data import system. A friendly error handling system replaces technical errors with user-friendly messages. A scheduled notifications calendar provides comprehensive management of automated notifications, with stage-aware suppression. A resilient project scheduling orchestrator ensures robustness against server restarts and outages.

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