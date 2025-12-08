# The Link - CRM & Project Management Application

## Overview
The Link is a full-stack CRM and project management application for accounting and bookkeeping firms. It automates recurring service delivery, streamlines client relationship management, and provides a secure client portal. Key features include intelligent scheduling, automated project generation, Companies House integration, and a mobile-first user experience. The application aims to enhance efficiency and client satisfaction through automation, compliance, and robust access controls within a multi-tenant architecture. It focuses on business vision, market potential, and project ambitions to improve firm operations and client engagement.

## User Preferences
Preferred communication style: Simple, everyday language.

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

### Background Prefetch Optimization
Improves perceived performance by preloading data for secondary views during browser idle time using `requestIdleCallback`.

### RingCentral VoIP Integration
Full VoIP phone system integration enabling staff to make and receive calls directly from the CRM with automatic call logging and AI-powered transcription, including a three-tier fallback for transcription services (RingSense, RingCentral Speech-to-Text, OpenAI Whisper).

### AI Magic Call/SMS Integration
Provides natural language voice calling and SMS capabilities through an AI Magic assistant, allowing users to initiate communications using conversational commands with fuzzy contact matching and disambiguation.

### Email Image Paste Feature
Enables pasting and dragging images directly into email composition areas, with automatic upload to object storage and embedding via permanent URLs.

### SMS Templates Feature
Introduces reusable SMS message templates with variable support for personalization, managed by admins and selectable by staff when composing SMS messages.

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