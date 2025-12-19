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