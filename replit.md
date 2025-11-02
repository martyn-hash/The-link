# The Link - CRM & Project Management Application

## Overview

The Link is a comprehensive full-stack CRM and project management application tailored for accounting and bookkeeping firms. Its primary purpose is to automate recurring service delivery through intelligent scheduling, manage client relationships, and provide a seamless client portal experience for communications and document exchange. Key capabilities include managing clients, contacts, services, projects, and communications, with a strong focus on automation, compliance tracking, and a mobile-first, app-like user experience. It features automated project generation from scheduled services, Companies House integration for UK company data, and a multi-tenant architecture with robust access controls.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with **React and TypeScript**, utilizing **Wouter** for client-side routing and **TanStack Query** for server state management and caching. The design system leverages **shadcn/ui** components built on Radix UI primitives and **Tailwind CSS**. A mobile-first design approach ensures responsive layouts, transforming desktop tables into mobile card views, with a fixed bottom navigation, touch-optimized interactions, and full-screen bottom-sheet modals. State management primarily relies on TanStack Query for server state and local React state for UI interactions, intentionally avoiding a global state management library.

### Backend Architecture

The backend is an **Express.js** server written in **TypeScript**, featuring a modular RESTful API structure. It includes a robust middleware stack for authentication, authorization, request validation, and error handling. Core business logic is encapsulated in protected modules for service mapping, project creation, and scheduling, ensuring centralized control and idempotency. Critical design decisions include UTC date normalization for all date operations and comprehensive audit trails for scheduling. The system also includes a nightly automated project creation scheduler.

### Data Storage

The primary database is **PostgreSQL (Neon)**, accessed via **Drizzle ORM** for type-safe operations and managed with manual migrations. The schema design uses UUIDs for primary keys, soft deletes, JSONB fields for flexible metadata, and comprehensive indexing. It supports entities like users, clients, projects, services, communications, documents, and a task system, with specific tables for scheduling audit and access control. **Google Cloud Storage** is used for object storage, managed through Replit App Storage, with signed URLs for secure file access and metadata stored in the `documents` table.

### Authentication & Authorization

The system employs a dual authentication system: **Staff Authentication** using Replit Auth (OIDC) with session-based, role-based access control, and **Client Portal Authentication** using passwordless email verification with 6-digit codes and magic links. Access control patterns ensure staff have full access with role-based restrictions, while portal users are strictly isolated to their associated clients, with all queries filtered by `clientId`.

### Service Scheduling & Project Automation

An automated nightly scheduler processes active `clientServices` and `peopleServices` to automatically generate projects based on defined frequencies (daily, weekly, monthly, etc.). It includes advanced date advancement logic that tracks "intended days" to prevent skipping billing/payroll cycles in shorter months. **Companies House API** is integrated for UK company data, with special handling for CH-connected services (e.g., accounts, confirmation statements), including nightly syncs and API key rotation for rate limit management. The system incorporates multiple layers of duplicate prevention and provides an admin dashboard for monitoring and manual triggers, alongside detailed audit logging (`projectSchedulingHistory`, `schedulingRunLogs`).

### Internal Tasks System

The internal tasks system provides comprehensive staff task management with advanced features for organization and collaboration:

**Recent Enhancements (November 2025):**
-   **Collapsible Task Creation Form**: The `CreateTaskDialog` component features a collapsible form UI powered by Radix UI Collapsible. When users begin searching for entity connections (clients, people, projects, messages), the form fields automatically collapse to provide more space for search results, improving UX. An "Show form fields" button appears to re-expand the form when needed.
-   **Document Attachments**: Full document/file attachment capability integrated with Google Cloud Storage. Staff can upload documents to tasks via the task detail page, with files stored in the `.private/task-documents/{taskId}/` path in the GCS bucket. The `taskDocuments` table tracks metadata (fileName, fileSize, uploadedBy, uploadedAt), and signed URLs enable secure downloads. API routes support upload (POST), download (GET with signed URL), and deletion (DELETE) operations.
-   **Enhanced Data Loading**: Backend API routes (`getAllInternalTasks`, `getInternalTasksByAssignee`, `getInternalTasksByCreator`) now include left joins to return full `taskType`, `assignee`, and `creator` objects with each task. This uses Drizzle ORM's `alias()` function (imported from `drizzle-orm/pg-core`) to join the `users` table multiple times under different aliases, ensuring rich relational data in responses for improved UI display.
-   **Project Chronology Integration**: Tasks connected to projects automatically log activities to the project chronology. A `logTaskActivityToProject` helper function creates chronology entries for task creation, updates, note additions, and status changes to 'closed'. This provides full visibility of task-related activities within project timelines, facilitating better project tracking and accountability.

## External Dependencies

### Third-Party Services

-   **Companies House API**: For UK company data, filing deadlines, and officer information.
-   **Microsoft Graph API**: For staff email integration (Outlook/Office 365), enabling sending and logging emails.
-   **RingCentral**: For VoIP phone system integration, including call logging.
-   **SendGrid**: For transactional email delivery (e.g., magic links, notifications).
-   **VoodooSMS**: Planned integration for client SMS communications.
-   **Replit Platform Services**: Utilized for Object Storage (Google Cloud Storage backend), Auth (OIDC provider), and the overall deployment environment.

### Frontend Libraries

-   **UI Components**: `@radix-ui/*` (accessible primitives), `@dnd-kit/*` (drag-and-drop), `react-quill` (rich text editor), `react-hook-form` with `zod` (form management and validation), `sonner` (toast notifications).
-   **Utilities**: `date-fns` (date manipulation), `clsx` + `tailwind-merge` (utility class management), `@getaddress/autocomplete` (UK address lookup).

### Build & Development Tools

-   **Build Pipeline**: **Vite** (frontend build), **esbuild** (server bundling), **TypeScript** (type safety), **PostCSS** (CSS processing).
-   **Development Enhancements**: `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `tsx`.
-   **Database Tools**: `drizzle-kit` (schema management), `drizzle-orm` (type-safe query builder).