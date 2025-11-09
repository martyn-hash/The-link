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

### Client Notification & Reminder System

A comprehensive automated notification system enables multi-channel communications (email, SMS, push) to clients based on project lifecycle events and client request reminders. The system features:
-   **Project Notifications**: Date-based notifications relative to project start/due dates with configurable offsets, plus stage-based notifications triggered when projects enter/exit workflow stages.
-   **Client Request Reminders**: Automated reminder sequences for client request templates, with configurable intervals and automatic stopping when clients submit or staff cancel.
-   **Dynamic Variable System**: 30+ personalization variables automatically replace placeholders with real data in notification templates. Variables include client info ({client_name}, {client_company_name}), project details ({project_name}, {project_reference}), dates ({project_due_date}, {days_until_due}, {days_overdue}), service info ({service_name}, {service_frequency}), firm settings ({firm_name}, {firm_email}, {portal_url}), and action links ({project_link}, {submit_link}). Variables work across all three channels (email/SMS/push) with graceful fallbacks for missing data. The UI includes a searchable variable reference guide with copy-to-clipboard functionality and channel-specific filtering.
-   **Opt-In/Opt-Out Control**: Two-layer notification control system enables granular management of who receives notifications. Project-type level control (`notificationsActive` boolean, default true) allows admins to globally enable/disable all notifications for a specific project type via UI toggle in project type detail page with yellow visual indicator. Person-level control (`receiveNotifications` boolean, default true) allows individual contacts to opt in/out of email and SMS notifications via checkbox in person edit form. Both flags default to true for backward compatibility. Scheduler applies AND logic: notifications only scheduled if BOTH project type is active AND person is opted-in. Sender performs double-check at delivery time, skipping opted-out recipients with audit logging. All scheduling points (client service creation, service assignment, project creation) automatically fetch all related people for clients and pass to scheduler for filtering.
-   **Multi-Recipient Routing**: Notification scheduling supports multiple recipients per notification type. All active related people for a client are fetched and filtered by opt-in preferences. Each opted-in person receives individual scheduled notification records with their `personId`, enabling personalized delivery using their `primaryEmail` and `primaryPhone` contact details. Opted-out contacts are excluded at both scheduling and delivery stages.
-   **Admin Management**: Scheduled Notifications admin page (`/admin/scheduled-notifications`) with calendar and list views, filtering by client/project/status, and bulk cancellation operations.
-   **Idempotent Scheduling**: Delete-then-insert pattern ensures no duplicate notifications when services are updated. Service assignment is idempotent - existing client/people services are updated instead of throwing duplicate errors.
-   **Retroactive Scheduling**: When project type notifications are created or updated, all existing client services with dates automatically get scheduled notifications. Admin manual re-scheduling tool available on project type detail page with per-service error handling and statistics feedback.
-   **Multi-Channel Delivery**: SendGrid for emails (with configurable sender name), VoodooSMS placeholder for SMS, and integration with existing push notification infrastructure.
-   **Character Limits**: SMS (160 chars), push title (50 chars), push body (120 chars) enforced at validation, schema constraints, and UI levels.
-   **Schema Migration**: Automatic migration system handles schema changes including `super_admin` column in users table, `notificationsActive` in project_types table, `receiveNotifications` in people table, and the transition from legacy `pushContent` (200 chars) to separate `pushTitle` (50 chars) and `pushBody` (120 chars) fields. All migrations feature guard-then-alter pattern with transactional safety and data backfill.
-   **Complete Audit Trail**: All cancellation operations (individual and bulk) consistently populate audit fields: `cancelledBy` (user ID), `cancelledAt` (timestamp), `cancelReason` (description). Schema updated to allow `cancelledAt` in update operations. Authorization properly configured with `resolveEffectiveUser` middleware for manager-level access.
-   **Automated Cleanup**: Service deletion automatically cancels associated notifications; reminder sequences stop on task submission or staff cancellation using proper audit fields.
-   **Hourly Cron**: Background job runs 07:00-19:00 UK time to process due notifications and update delivery history.
-   **Notification Management UI**: Table-based notification display following data_view_guidelines.md pattern with columns for Type, Trigger, Content, Template, and Actions. Edit functionality allows full-page editing of notification templates at route `/settings/project-types/:projectTypeId/notifications/:notificationId/edit` with TopNavigation component for consistent layout, proper form pre-population and PATCH persistence. Preview capability processes dynamic variables against real sample data, fetching active projects (stage notifications filter by `currentStatus === stage.name`, project notifications use any active project), building type-safe context via `buildNotificationContext()` helper, and displaying rendered email/SMS/push content in a modal dialog. Preview returns `hasData: false` with descriptive message when no eligible sample projects are found.

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

## Testing Credentials

For automated browser testing or manual verification, use the following credentials to log in:

-   **URL**: Navigate to the root page (`/`)
-   **Login Method**: Password tab
-   **Email**: `admin@example.com`
-   **Password**: `admin123`

This account has admin permissions to access all features including project types, client management, scheduled notifications, and company settings.