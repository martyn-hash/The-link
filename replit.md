# The Link - CRM & Project Management Application

## Overview
The Link is a comprehensive full-stack CRM and project management application for accounting and bookkeeping firms. Its core purpose is to automate recurring service delivery, streamline client relationship management, and provide a secure client portal for communication and document exchange. Key capabilities include intelligent scheduling, automated project generation, integration with Companies House, and a mobile-first user experience, enhancing efficiency and client satisfaction through automation, compliance, and robust access controls within a multi-tenant architecture.

## User Preferences
Preferred communication style: Simple, everyday language.

## Testing Credentials
For testing, login via the root page using the password tab:
- Email: admin@example.com
- Password: admin123

## System Architecture

### UI/UX
The application features a modern SaaS aesthetic inspired by Linear, Stripe, and Notion, using a specific brand palette and DM Sans font. Design principles include increased spacing, soft modern shadows, and consistent 1rem border-radius for cards. All components are modernized with consistent styling, are mobile-first and responsive, and follow a consistent Phase 3 layout pattern with standardized header blocks, body regions, and tab-based layouts. Data-heavy list/table pages use full-width layouts, while detail/form pages remain centered.

### Technical Implementation
The frontend uses React, TypeScript, Wouter for routing, TanStack Query for server state, and shadcn/ui with Tailwind CSS for styling. The backend is an Express.js server in TypeScript, providing a modular RESTful API with middleware for authentication, authorization, and validation. It handles service mapping, project creation, sophisticated scheduling with UTC normalization, and comprehensive audit trails. A nightly scheduler automates project generation. The backend storage layer has been refactored into 52 domain-focused modules using a facade pattern for backward compatibility.

### System Design
PostgreSQL (Neon) with Drizzle ORM is the primary database, utilizing UUIDs, soft deletes, and JSONB fields. Google Cloud Storage (via Replit App Storage) handles object storage with secure signed URLs. Staff authentication uses Replit Auth (OIDC) with session-based, role-based access control. The client portal uses passwordless email verification with magic link tokens. The system supports a multi-tenant architecture and is designed for modularity. Database indexing is extensively used for performance optimization.

### Key Features
-   **Automated Project & Service Management**: Includes automatic schema migrations, service scheduling, project automation, and client service role assignment with task cascading.
-   **Communication & Collaboration**: Features push notification template management, internal tasks, staff-to-staff messaging, email threading via Microsoft Graph, and a multi-channel client notification system with rich-text editor, file attachments, Office document conversion, and intelligent message expansion.
-   **Document Management & E-Signatures**: A UK eIDAS-compliant electronic signature system for multi-page PDFs, supporting multiple signers, precise field placement, public signing page with two-step consent, real-time signature drawing, and automatic PDF processing with SHA-256 hashing and audit trails.
-   **Workflow & Status Management**: Offers project timeline color coding, permission-controlled inactive management for services and projects, and specific handling for completed projects. Provides desktop kanban view and mobile access with optimized stage change popup layouts.
-   **NLAC (No Longer a Client)**: Secure multi-step process for marking clients as inactive, with password protection (configurable by Super Admins in Company Settings), reason selection (moving to new accountant, ceasing trading, no longer using accountant, taking accounts in house, or other), automatic deactivation of associated projects, services, and portal users, and comprehensive audit logging.
-   **Client & People Management**: Unified Clients page with tabbed interfaces for "Companies" (Companies House data) and "People" (contacts), featuring pagination and customizable columns.
-   **Navigation**: Streamlined navigation with unread messages badges and improved messaging page tabs.
-   **Feature Flags**: Company settings include toggleable feature flags (Ring Central Live, App Is Live) that control visibility of communication features. Super Admins can manage these via the Company Settings page.
-   **Communications UI**: Refactored communication filters to use a compact dropdown popover with multi-select checkboxes. The Add Communication dialog uses a TipTap rich text editor for content entry.
-   **AI Audio Transcription**: Voice-to-text feature in the Comms tab powered by OpenAI. Users can record audio which is transcribed via Whisper and processed by GPT-4o-mini for low latency. Two modes: (1) Notes mode creates summarized bullet-point notes from voice recordings, (2) Email mode drafts professional emails with subject and body from spoken content. System prompts are configurable in Company Settings by Super Admins.
-   **Client Value Notifications**: When changing a project's stage, staff can send CLIENT-FACING notifications to client contacts (directors, shareholders, etc.). Features include: (1) Per-channel controls for email and SMS (SMS marked "Coming Soon"), (2) Recipient selection from client contacts via people table linked through clientPeople, with role badges, primary contact indicators, and opt-out status shown, (3) Outlook integration - emails sent from staff's connected Outlook account with SendGrid fallback, (4) AI-assisted message drafting using voice recording for context-aware value messaging with automatic inclusion of completed work items from stage approval questionnaires and existing email template merge fields, (5) Rich text editing with TipTap for email body, (6) Sender status indicator showing Outlook connection. This replaces the legacy internal staff notification system with a client-focused communication channel.
-   **Webhook Data Sharing**: Zapier integration for sharing client data with legacy systems via configurable webhooks with conditional activation rules and audit logging.
-   **Enhanced Data Import System**: Comprehensive import capabilities including standalone service imports (matching by company number/name for clients, email/full name for people), interactive field mapping UI for CSV files with auto-matching, and detailed audit reporting with downloadable CSV showing created/updated/skipped/failed records with reasons.
-   **Friendly Error Handling System**: Comprehensive user-friendly error messaging that replaces technical errors with personality-filled messages. Features: (1) 200 witty/sarcastic opening phrases stored in database across 4 categories (dry_british, one_liner, dramatic, meta), (2) per-user phrase tracking to keep messages fresh, (3) error mapping system translating technical errors to specific actionable guidance, (4) custom amber/orange "friendly" toast styling replacing scary red destructive toasts. Database tables: `funny_error_phrases`, `user_seen_phrases`. Frontend utility: `showFriendlyError()` in `client/src/lib/friendlyErrors.ts`.
-   **Scheduled Notifications Calendar**: Comprehensive calendar view for automated notifications with vertical slide-out filter panel (Sheet-based, similar to Projects page). Features: (1) Calendar and List view toggle, (2) Color-coded notification types (email=blue, SMS=green, push=amber), (3) Advanced filtering by status, notification channel, project type, client, project, source, and date range, (4) 60-second polling for real-time status updates, (5) Quick actions for retry/cancel. New endpoint `/api/project-types` provides read-only access for non-admin users.
-   **Stage-Aware Notification Suppression**: Intelligent reminder suppression for due-date notifications based on project stage. Admins can configure which stages a notification is "active" for when creating/editing project notifications. Features: (1) Optional whitelist of eligible stages per notification template - if set, notifications only send when project is in an eligible stage, (2) Automatic suppression when project moves to ineligible stage (status="suppressed" instead of deletion for potential re-activation), (3) Automatic re-activation if project moves back to eligible stage before scheduled send time, (4) Double-check on send: cron verifies stage eligibility even for "scheduled" status, (5) UI shows stage restriction badges on notification rows with tooltips listing eligible stages. Only applies to due-date reminders (start-date reminders always send as heads-up about upcoming work). Database fields: `eligible_stage_ids` on templates, `eligible_stage_ids_snapshot`, `suppressed_at`, `reactivated_at` on scheduled notifications.

## External Dependencies

### Third-Party Services
-   **Companies House API**: For UK company data integration.
-   **Microsoft Graph API**: For staff email integration.
-   **RingCentral**: For VoIP phone system integration.
-   **SendGrid**: For transactional email delivery.
-   **VoodooSMS**: For client SMS delivery with UK phone formatting (+44).
-   **OpenAI API**: Whisper for audio transcription and GPT-4o-mini for AI text processing (notes summarization and email drafting).
-   **Replit Platform Services**: For object storage, authentication, and deployment.

### Frontend Libraries
-   **UI Components**: `@radix-ui/*`, `@dnd-kit/*`, `@tiptap/*`, `react-hook-form` with `zod`, `sonner`.
-   **Utilities**: `date-fns`, `clsx`, `tailwind-merge`, `@getaddress/autocomplete`.