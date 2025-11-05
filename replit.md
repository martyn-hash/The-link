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

The email threading system integrates Microsoft Graph to ingest staff emails and automatically link them to client timelines. Key features include:

-   **Deduplication**: Uses `internetMessageId` as global unique key to prevent duplicate entries when multiple staff are CC'd on the same email
-   **Thread Grouping**: Groups messages using `canonicalConversationId` with fallback to ancestry-based threading (`inReplyTo`, `References` headers) and computed `threadKey` hash
-   **Client Matching**: Automatically associates emails with clients using email aliases and domain allowlists, with confidence scoring (high/medium/low)
-   **Quarantine System**: Unmatched emails stored in quarantine with nightly resolver for retroactive matching when new client aliases are added
-   **Delta Sync**: Efficient webhook subscriptions and delta sync for Inbox and Sent Items folders per staff mailbox
-   **Mailbox Mapping**: Tracks which staff mailboxes contain copies of each message for proper attribution
-   **Attachment Deduplication**: Content-hash based storage to avoid duplicate attachment files
-   **Noise Control**: Filters internal-only threads and marketing emails from client timelines

Database tables: `email_messages`, `mailbox_message_map`, `email_threads`, `unmatched_emails`, `client_email_aliases`, `client_domain_allowlist`, `email_attachments`, `email_message_attachments`, `graph_webhook_subscriptions`, `graph_sync_state`.

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