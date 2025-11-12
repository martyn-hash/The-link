# The Link - CRM & Project Management Application

## Overview

The Link is a comprehensive full-stack CRM and project management application designed for accounting and bookkeeping firms. It automates recurring service delivery through intelligent scheduling, manages client relationships, and provides a secure client portal for communication and document exchange. The application focuses on automation, compliance, and a mobile-first user experience, supporting automated project generation, integration with Companies House for UK company data, and features a multi-tenant architecture with robust access controls.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React and TypeScript, using Wouter for routing, TanStack Query for server state management, and shadcn/ui with Tailwind CSS for a mobile-first, responsive design.

### Backend

The backend is an Express.js server in TypeScript, offering a modular RESTful API with middleware for authentication, authorization, and data validation. It includes core logic for service mapping, project creation, sophisticated scheduling with UTC date normalization, and comprehensive audit trails. A nightly scheduler automates project generation.

### Data Storage

PostgreSQL (Neon) is the primary database, managed via Drizzle ORM, utilizing UUIDs, soft deletes, and JSONB fields. Google Cloud Storage, accessed through Replit App Storage, handles object storage with secure signed URLs for documents.

### Authentication & Authorization

Staff authentication uses Replit Auth (OIDC) with session-based, role-based access control. The client portal employs passwordless email verification.

### Core Features

-   **Automatic Schema Migrations**: Ensures database schema synchronization on server startup.
-   **Service Scheduling & Project Automation**: Automated nightly scheduler generates projects from active client services, integrating with Companies House API.
-   **Client Service Role Assignment & Task Cascading**: Manages role assignments for client services with automatic task synchronization to projects.
-   **Push Notification Template Management**: Customizable push notification templates with dynamic variables.
-   **Internal Tasks System**: Comprehensive staff task management with document attachments.
-   **Standalone Staff-to-Staff Messaging**: Dedicated `/internal-chat` for direct staff communication.
-   **Mobile UI Improvements**: Desktop tables convert to mobile-friendly card layouts.
-   **Project Timeline Color Coding**: Intelligent color coding (Red, Amber, Green) for immediate visual feedback on project status.
-   **Email Threading & Deduplication**: Integrates Microsoft Graph for email ingestion, linking to client timelines with deduplication, threading, and a full UI.
-   **Client Notification & Reminder System**: Automated multi-channel (email, SMS, push) notifications based on project lifecycle events and client request reminders, with dynamic variables, opt-in/opt-out controls, and robust pre-validation.
-   **Service Inactive Management**: Permission-controlled system for marking client services inactive with required reasons, audit trails, and automatic exclusion from scheduling.
-   **Project Inactive Management**: Permission-controlled system for marking projects inactive with required reasons, audit trails, and automatic exclusion from scheduling, mirroring service inactive management.
-   **Completed Projects Filtering**: Ensures completed projects are always visible in kanban view and properly managed across all project views, bypassing standard filters.
-   **Hover-Activated Stage Information**: Desktop kanban view displays project stage change details via hover popover (300ms delay), while mobile maintains tap-to-view modal access. Popover shows latest status transition, change reason, assignee, and time in previous stage. Automatically dismisses on drag operations for seamless interaction.

## External Dependencies

### Third-Party Services

-   **Companies House API**: UK company data.
-   **Microsoft Graph API**: Staff email integration.
-   **RingCentral**: VoIP phone system.
-   **SendGrid**: Transactional email delivery.
-   **VoodooSMS**: Planned for client SMS.
-   **Replit Platform Services**: Object storage, authentication, and deployment.

### Frontend Libraries

-   **UI Components**: `@radix-ui/*`, `@dnd-kit/*`, `react-quill`, `react-hook-form` with `zod`, `sonner`.
-   **Utilities**: `date-fns`, `clsx`, `tailwind-merge`, `@getaddress/autocomplete`.