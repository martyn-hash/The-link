# The Link - CRM & Project Management Application

## Overview

The Link is a comprehensive full-stack CRM and project management application for accounting and bookkeeping firms. It automates recurring service delivery through intelligent scheduling, manages client relationships, and provides a seamless client portal for communication and document exchange. Key capabilities include client, contact, service, project, and communication management, with a strong focus on automation, compliance, and a mobile-first user experience. The application supports automated project generation, integrates with Companies House for UK company data, and features a multi-tenant architecture with robust access controls.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React and TypeScript, utilizing Wouter for routing, TanStack Query for server state management, and shadcn/ui with Tailwind CSS for design. It adheres to a mobile-first philosophy, ensuring responsive layouts and touch-optimized interactions.

### Backend

The backend is an Express.js server in TypeScript, providing a modular RESTful API. It incorporates middleware for authentication, authorization, and data validation. Core logic includes service mapping, project creation, and sophisticated scheduling with UTC date normalization and comprehensive audit trails. A nightly scheduler automates project generation.

### Data Storage

PostgreSQL (Neon) serves as the primary database, managed through Drizzle ORM. The schema utilizes UUIDs, soft deletes, and JSONB fields, with indexing for critical entities. Google Cloud Storage, facilitated by Replit App Storage, handles object storage, employing signed URLs for secure document access.

### Automatic Schema Migrations

An automatic schema migration system runs on server startup to synchronize database schemas between environments, preventing production failures from schema drift.

### Authentication & Authorization

Staff authentication uses Replit Auth (OIDC) with session-based, role-based access control. The client portal uses passwordless email verification. Access controls enforce staff roles and isolate client portal users.

### Service Scheduling & Project Automation

An automated nightly scheduler generates projects from active client and people services based on predefined frequencies. This system includes advanced date logic and integrates with the Companies House API for UK company data, managing syncs and API keys, with duplicate prevention and an admin dashboard.

### Client Service Role Assignment & Task Cascading

The system manages role assignments for client services with automatic task synchronization. Changes in role assignments trigger updates to active projects, cascading corresponding role-based task assignments.

### Push Notification Template Management

A robust system allows for the management of customizable push notification templates, supporting seven types with multiple active templates. Notifications use dynamic variables for personalization and custom icons.

### Internal Tasks System

The internal tasks system provides comprehensive staff task management with a collapsible creation form, document attachments integrated with Google Cloud Storage, and enhanced data loading for assignee and creator details.

### Standalone Staff-to-Staff Messaging

A dedicated `/internal-chat` page facilitates independent staff-to-staff message threads with push notifications for new messages.

### Mobile UI Improvements

Extensive mobile optimizations convert desktop table layouts to mobile-friendly card layouts on small viewports, ensuring touch target compliance and responsive designs across key pages.

### Email Threading & Deduplication System

The email threading system integrates Microsoft Graph to ingest staff emails and link them to client timelines, featuring deduplication, thread grouping, multi-layered client association, delta sync, email sending, noise control, and attachment deduplication. It includes a complete UI for viewing and replying to email threads.

### Client Notification & Reminder System

A comprehensive automated multi-channel (email, SMS, push) notification system triggers communications based on project lifecycle events and client request reminders. It features:
- Project Notifications: Date-based and stage-based notifications with configurable offsets.
- Client Request Reminders: Automated sequences with configurable intervals.
- Dynamic Variable System: 30+ personalization variables for templates across all channels.
- Opt-In/Opt-Out Control: Two-layer system for granular management at project type and person levels.
- Multi-Recipient Routing: Supports multiple recipients per notification type based on opt-in preferences.
- Admin Management: UI for managing scheduled notifications with bulk actions.
- Idempotent and Retroactive Scheduling: Ensures no duplicates and allows scheduling for existing services.
- Multi-Channel Delivery: SendGrid for emails, VoodooSMS placeholder for SMS, and existing push infrastructure.
- Character Limits: Enforced for SMS and push notifications.
- Audit Trail: Comprehensive logging for all cancellation operations.
- Automated Cleanup: Service deletion cancels associated notifications.
- Hourly Cron: Background job processes due notifications.
- Notification Management UI: Table-based display with edit functionality and a preview capability.
- Client-Specific Notifications View: Dedicated interface for managing scheduled notifications for a specific client.

## External Dependencies

### Third-Party Services

-   **Companies House API**: UK company data integration.
-   **Microsoft Graph API**: Staff email integration and sending.
-   **RingCentral**: VoIP phone system integration.
-   **SendGrid**: Transactional email delivery.
-   **VoodooSMS**: Planned for client SMS communications.
-   **Replit Platform Services**: Object storage (Google Cloud Storage backend), authentication (OIDC provider), and deployment environment.

### Frontend Libraries

-   **UI Components**: `@radix-ui/*`, `@dnd-kit/*`, `react-quill`, `react-hook-form` with `zod`, `sonner`.
-   **Utilities**: `date-fns`, `clsx`, `tailwind-merge`, `@getaddress/autocomplete`.