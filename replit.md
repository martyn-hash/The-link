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
-   **Document E-Signature System**: UK eIDAS-compliant electronic signature feature enabling staff to send PDFs for signature via secure public links. Supports multiple signers per document with sequential or parallel workflows. **Multi-page PDF support** with full page navigation during field placement and signing. Features include: interactive PDF viewer (react-pdf) with scrollable all-pages vertical layout for easy document navigation, precise percentage-based coordinate system (2 decimal places) ensuring accurate field positioning across all PDF sizes/devices, signature and typed name fields with visual indicators on correct pages, **public signing page with two-step flow** (full-screen consent disclosure first, then split-screen signing with PDF viewer + signature controls), mandatory consent disclosure showing firm name from company settings, real-time signature drawing with mouse/touch support, automatic PDF processing using pdf-lib to overlay signatures on correct pages, SHA-256 hashing of original and signed documents, complete audit trails capturing signer identity/device/browser/OS/IP/timestamps, **signed URL generation** for secure PDF access via Replit Object Storage (15-minute expiry), secure token-based public access (no authentication required), signed document storage in Replit Object Storage, and downloadable signed PDFs with verifiable hashes. Full database schema includes signature_requests, signature_request_recipients, signature_fields (with decimal coordinates and page numbers), signatures, signature_audit_logs, and signed_documents tables with proper indexing and relationships. Coordinates stored as percentages (0-100 with decimal precision) to ensure consistent rendering across different screen sizes and PDF dimensions. **Global Signature Requests View**: Accessible via "E-Signatures" link in TopNavigation menu at `/signature-requests`, provides staff with system-wide visibility of all signature requests across clients. Displays request status, client information, creator, and dates in consistent "MMM d, yyyy" format. API endpoints properly serialize all timestamp fields (including nested objects) to ISO strings for reliable frontend rendering. Both global view and client-specific views use consistent date formatting via date-fns. **Signature Request Builder (Nov 2025)**: Streamlined 3-step wizard at `/clients/:clientId/signature-requests/new` for creating signature requests: (1) Select Document (upload new or choose existing PDF), (2) Place Fields (click-to-place signature/typed_name fields on scrollable multi-page PDF with improved drag-and-drop repositioning using @dnd-kit), (3) Review & Send (auto-derived recipients, summary and confirmation). Recipients automatically derived from unique personIds in placed fields, eliminating redundant manual selection. Scrollable all-pages PDF viewer displays entire document vertically for easy navigation without page-by-page clicking. Enhanced drag handle (20px GripVertical icon, always-visible page badge, larger click targets) improves field manipulation UX. Implements per-page dimension tracking via Map for accurate coordinate conversion, cross-page field movement via dropdown selector, unsaved changes warning with AlertDialog and beforeunload listener, duplicate field prevention (one signature + one typed_name per recipient). Backend validates requests and rejects duplicates with 422 error. E2e tested with successful database persistence and coordinate accuracy. **Object Storage Integration**: `ObjectStorageService.getSignedDownloadURL` method generates temporary signed URLs (15-min TTL) for secure PDF access without exposing raw storage paths, preventing 401 Unauthorized errors on public signing pages.

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