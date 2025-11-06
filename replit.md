# The Link - CRM & Project Management Application

## Overview

The Link is a comprehensive full-stack CRM and project management application designed for accounting and bookkeeping firms. It automates recurring service delivery through intelligent scheduling, manages client relationships, and provides a seamless client portal for communication and document exchange. Key capabilities include client, contact, service, project, and communication management, with a strong focus on automation, compliance, and a mobile-first user experience. The application supports automated project generation, integrates with Companies House for UK company data, and features a multi-tenant architecture with robust access controls.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React and TypeScript, leveraging Wouter for routing, TanStack Query for server state management, and shadcn/ui with Tailwind CSS for design. It adheres to a mobile-first philosophy, ensuring responsive layouts and touch-optimized interactions across all devices.

### Backend

The backend is an Express.js server developed in TypeScript, providing a modular RESTful API. It incorporates middleware for authentication, authorization, and data validation. Core logic encompasses service mapping, project creation, and sophisticated scheduling with UTC date normalization and comprehensive audit trails. A nightly scheduler automates project generation.

### Data Storage

PostgreSQL (Neon) serves as the primary database, managed through Drizzle ORM. The schema utilizes UUIDs, soft deletes, and JSONB fields, with indexing for critical entities such as users, clients, projects, services, and tasks. Google Cloud Storage, facilitated by Replit App Storage, handles object storage, employing signed URLs for secure document access.

### Automatic Schema Migrations

An automatic schema migration system runs on server startup to ensure database schemas are synchronized between development and production environments. The system (`server/utils/schemaMigrations.ts`) checks for missing columns and automatically applies schema changes during deployment. This prevents production failures from schema drift when code changes include updated database schemas. Current migrations include validation for the `super_admin` column in the users table, with a framework in place for future schema updates. Migrations run before any other database operations, logging all changes for audit purposes.

### Authentication & Authorization

Staff authentication is managed via Replit Auth (OIDC) with session-based, role-based access control. The client portal uses passwordless email verification for authentication. Access controls are meticulously implemented to enforce staff roles and ensure client portal users are strictly isolated to their respective clients.

### Service Scheduling & Project Automation

An automated nightly scheduler generates projects from active client and people services based on predefined frequencies. This system includes advanced date logic and integrates with the Companies House API for UK company data, managing syncs and API keys. It also features duplicate prevention and an admin dashboard for monitoring.

### Client Service Role Assignment & Task Cascading

The system efficiently manages role assignments for client services, with automatic task synchronization. Changes in role assignments trigger updates to active projects generated from that service, ensuring corresponding role-based task assignments are cascaded. Backend verification maintains system security.

### Push Notification Template Management

A robust system allows for the management of customizable push notification templates. It supports seven notification types, each capable of having multiple active templates. Notifications utilize dynamic variables for personalization and can include custom icons stored in Google Cloud Storage. An administrative UI enables template management and testing.

### Internal Tasks System

The internal tasks system provides comprehensive staff task management, featuring a collapsible creation form, document attachments integrated with Google Cloud Storage, and enhanced data loading for assignee and creator details. Task detail pages are responsive, and progress notes include user attribution.

### Standalone Staff-to-Staff Messaging

The `/internal-chat` page facilitates independent staff-to-staff message threads using dedicated database tables and API routes. The frontend unifies both project and staff message threads, with a "New Thread" dialog for creating staff-specific conversations. Push notifications are integrated for new staff messages.

### Mobile UI Improvements

Extensive mobile optimizations have been implemented across the application, converting desktop table layouts to mobile-friendly card layouts on viewports smaller than 768px. This includes the client detail page, project detail page, companies page, projects page, and DocumentFolderView. Key improvements focus on touch target compliance (44px minimum height), prevention of horizontal scrolling, and responsive layouts using `flex-col md:flex-row` patterns.

### Email Threading & Deduplication System

The email threading system integrates Microsoft Graph to ingest staff emails and automatically link them to client timelines. It features:
-   **Deduplication**: Uses `internetMessageId` for global unique keying.
-   **Thread Grouping**: Employs canonical IDs, ancestry (`inReplyTo`/`References`), and computed hash keys for robust threading.
-   **Client Association**: Multi-layered matching via email aliases and domain allowlists, with a quarantine system for unmatched emails and a nightly resolver for retroactive matching.
-   **Delta Sync**: Efficient incremental synchronization for mailboxes.
-   **Email Sending**: Supports replying via Graph API with automatic Sent Items ingestion.
-   **Noise Control**: Detects internal-only threads, classifies email direction, and identifies marketing/list emails.
-   **Attachment Deduplication**: Uses SHA-256 content hashing for efficient storage in Google Cloud Storage, skipping inline and oversized attachments.
-   **Complete UI**: Integrated email threads into the client detail page and a dedicated `/messages` page, featuring an EmailThreadViewer modal with rich text reply capabilities.

## External Dependencies

### Third-Party Services

-   **Companies House API**: For UK company data integration.
-   **Microsoft Graph API**: For staff email integration and sending.
-   **RingCentral**: For VoIP phone system integration.
-   **SendGrid**: For transactional email delivery.
-   **VoodooSMS**: Planned for client SMS communications.
-   **Replit Platform Services**: Provides object storage (Google Cloud Storage backend), authentication (OIDC provider), and the deployment environment.

### Frontend Libraries

-   **UI Components**: `@radix-ui/*`, `@dnd-kit/*`, `react-quill`, `react-hook-form` with `zod`, `sonner`.
-   **Utilities**: `date-fns`, `clsx`, `tailwind-merge`, `@getaddress/autocomplete`.

### Build & Development Tools

-   **Build Pipeline**: Vite, esbuild, TypeScript, PostCSS.
-   **Development Enhancements**: `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `tsx`.
-   **Database Tools**: `drizzle-kit`, `drizzle-orm`.