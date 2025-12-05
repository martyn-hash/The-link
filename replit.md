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

## System Architecture

### UI/UX
The application features a modern SaaS aesthetic inspired by Linear, Stripe, and Notion, utilizing a specific brand palette and DM Sans font. Design principles emphasize increased spacing, soft modern shadows, and consistent 1rem border-radius for cards. All components are modernized, mobile-first, responsive, and follow a consistent Phase 3 layout pattern with standardized header blocks, body regions, and tab-based layouts. Data-heavy list/table pages use full-width layouts, while detail/form pages remain centered.

### Technical Implementation
The frontend is built with React, TypeScript, Wouter for routing, TanStack Query for server state, and shadcn/ui with Tailwind CSS for styling. The backend is an Express.js server in TypeScript, providing a modular RESTful API with middleware for authentication, authorization, and validation. It handles service mapping, project creation, sophisticated scheduling with UTC normalization, and comprehensive audit trails. A nightly scheduler automates project generation. The backend storage layer uses 52 domain-focused modules with a facade pattern for backward compatibility.

### System Design
PostgreSQL (Neon) with Drizzle ORM is the primary database, utilizing UUIDs, soft deletes, and JSONB fields. Google Cloud Storage (via Replit App Storage) handles object storage with secure signed URLs. Staff authentication uses Replit Auth (OIDC) with session-based, role-based access control, while the client portal uses passwordless email verification with magic link tokens. The system is multi-tenant and designed for modularity, with extensive database indexing for performance optimization.

Key features include automated project and service management, advanced communication tools (push notifications, internal tasks with quick reminders, email threading via Microsoft Graph, multi-channel client notifications with AI assistance), UK eIDAS-compliant electronic signatures for multi-page PDFs, and comprehensive workflow and status management with Kanban views. The internal tasks system includes a lightweight Quick Reminders feature that allows staff to create simple reminders (name, details, date/time, optional client link) without the overhead of full task creation. The Tasks & Reminders workspace features aligned column layouts between tables, a Linked Entities column displaying connected projects/clients/persons, collapsible sections to focus on specific content, and column header filters for data interrogation with debounced search inputs. Reminders can be converted to full tasks when more detail is needed. When reminders become due, the system automatically sends push notifications and emails to the assigned staff member with the reminder name in the email subject. Reminder notifications are processed every 15 minutes between 07:00-22:00 UK time via a dedicated cron job (server/reminder-notification-cron.ts). The Kanban board supports a Compact View mode that collapses all stages to narrow columns showing just the stage name (vertically), project count, and overdue indicator, allowing users to see all stages at a glance. Users can expand individual stages while keeping others compact, and the preference is persisted to localStorage. Internal Chat includes automatic archiving of message threads when projects are completed and auto-unarchiving when projects are reopened, plus a "Group by Project" view option to organize conversations by their associated projects. Specialized features include a secure "No Longer a Client" process, unified client and people management, and a Project Bench feature for temporarily suspending projects. Feature flags allow for dynamic control of communication features. The application also includes an AI Audio Transcription service (Whisper and GPT-4o-mini), client value notifications with AI-assisted drafting and Microsoft Graph integration, Zapier integration via webhooks, and an enhanced data import system with interactive field mapping. A friendly error handling system replaces technical errors with user-friendly messages. A scheduled notifications calendar provides a comprehensive view and management of automated notifications, with stage-aware notification suppression for intelligent reminder delivery. A resilient project scheduling orchestrator ensures robustness against server restarts and outages, with features like startup catch-up, database-based locking, idempotency protection, and retry logic.

Neon database configuration recommendations for production include disabling auto-pause, increasing idle timeout, and using pooled connection mode for optimal reliability.

## External Dependencies

### Third-Party Services
-   **Companies House API**: For UK company data integration.
-   **Microsoft Graph API**: For tenant-wide email and calendar access (application permissions).
-   **RingCentral**: For VoIP phone system integration.
-   **SendGrid**: For transactional email delivery.
-   **VoodooSMS**: For client SMS delivery.
-   **OpenAI API**: Whisper for audio transcription, GPT-4o-mini for AI text processing, and function-calling for the AI Magic Assistant.
-   **Replit Platform Services**: For object storage, authentication, and deployment.

### Frontend Libraries
-   **UI Components**: `@radix-ui/*`, `@dnd-kit/*`, `@tiptap/*`, `react-hook-form` with `zod`, `sonner`.
-   **Utilities**: `date-fns`, `clsx`, `tailwind-merge`, `@getaddress/autocomplete`.