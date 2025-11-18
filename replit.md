# The Link - CRM & Project Management Application

## Overview
The Link is a comprehensive full-stack CRM and project management application designed for accounting and bookkeeping firms. Its primary purpose is to automate recurring service delivery, streamline client relationship management, and provide a secure client portal for communication and document exchange. Key capabilities include intelligent scheduling, automated project generation, integration with Companies House for UK company data, and a mobile-first user experience. The application emphasizes automation, compliance, and a multi-tenant architecture with robust access controls.

## Recent Changes (November 18, 2025)
-   **Rich Text Stage Change Notes**: Enhanced project stage change functionality with rich text editing
    -   Replaced plain textarea with TiptapEditor in both ChangeStatusModal and status-change-form
    -   Database schema updated with `notes_html` (text) and `attachments` (jsonb) columns in projectChronology table
    -   Backend automatically backfills plain text `notes` field from HTML for backward compatibility
    -   Stage change popup (StageChangeContent) now renders rich HTML using DOMPurify sanitization
    -   Supports bold, italic, underline, tables, headings, and other formatting in stage change notes
    -   Auto-creates message threads titled "{Old Stage} to {New Stage} chat" when stage assignee changes
    -   Message thread creation includes guards to prevent crashes when stages lack assignees
    -   Migration 0004 cleanly adds new columns with IF NOT EXISTS clauses
    -   TiptapEditor uses named export pattern for consistency with codebase

## Recent Changes (November 17, 2025)
-   **Unread Messages Badge**: Added notification badge to top navigation bar
    -   Pink badge with MessageCircle icon displays count of unread internal (staff-to-staff) message threads
    -   Counts both standalone staff threads and project message threads
    -   Badge automatically hides when count is zero
    -   Clicking badge navigates to /messages page
    -   Updates every 30 seconds via `/api/project-messages/unread-count` endpoint
    -   Excludes client-staff threads (those are tracked separately in Client Chat tab)
    -   **Fixed badge count mismatch**: Internal Chat tab badge now correctly matches top navigation badge by including both staff and project threads in calculation
-   **Messages Page Tab Improvements**: Fixed Client Chat tab to display correct data
    -   Client Chat tab now correctly fetches and displays client-to-staff communication threads from `/api/internal/messages/threads`
    -   Previously incorrectly showed project message threads (staff-to-staff)
    -   Internal Chat and Client Chat tabs now properly separated with independent unread counts
    -   **Added project thread fetching**: Messages page now fetches both staff and project threads to ensure accurate badge counts
-   **Clients Page Redesign**: Transformed the Companies page into a unified Clients page with tabbed interface
    -   Two tabs: "Companies" (Companies House data) and "People" (contacts)
    -   Both tabs feature 30-row pagination for improved performance
    -   Navigation label updated from "Companies" to "Clients"
    -   /people route now redirects to /companies with automatic tab switching
    -   People tab includes advanced column customization:
        -   Column visibility toggles
        -   Drag-and-drop column reordering with @dnd-kit
        -   Resizable columns with single-save-on-mouseup optimization
        -   Preferences saved per user via /api/column-preferences endpoint
-   **Navigation Menu Standardization**: Streamlined all navigation menus for consistency and reduced redundancy
    -   Removed "Internal Chat" from desktop and mobile menus (accessible via Messages page)
    -   Removed "People" from desktop and mobile menus (accessible via Clients page → People tab)
    -   Desktop logo dropdown reorganized into balanced 3-column layout (3-3-2 items)
    -   Mobile menu updated to display "Clients" label for consistency
    -   All menus now funnel users through core destinations: Dashboard, Projects, Messages, Clients

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
The application features a modern SaaS aesthetic inspired by Linear, Stripe, and Notion, utilizing a specific brand palette and the DM Sans font family. Design principles include increased spacing, soft modern shadows, and consistent 1rem border-radius for cards. All components are modernized with consistent styling and are mobile-first and responsive. The UI follows a consistent Phase 3 layout pattern across all pages, with standardized header blocks, body regions, and tab-based layouts, employing specific typography and spacing standards. Data-heavy list/table pages utilize full-width layouts, while detail/form pages remain centered for readability.

### Frontend
The frontend is built with React and TypeScript, using Wouter for routing, TanStack Query for server state management, and shadcn/ui with Tailwind CSS for styling.

### Backend
The backend is an Express.js server in TypeScript, offering a modular RESTful API. It incorporates middleware for authentication, authorization, and data validation, handling core logic for service mapping, project creation, sophisticated scheduling with UTC date normalization, and comprehensive audit trails. A nightly scheduler automates project generation.

### Data Storage
PostgreSQL (Neon) is the primary database, managed via Drizzle ORM, utilizing UUIDs, soft deletes, and JSONB fields. Google Cloud Storage, accessed through Replit App Storage, handles object storage with secure signed URLs for documents.

### Authentication & Authorization
Staff authentication uses Replit Auth (OIDC) with session-based, role-based access control. The client portal employs passwordless email verification.

### Key Features
-   **Automated Project & Service Management**: Includes automatic schema migrations, service scheduling, project automation, and client service role assignment with task cascading.
-   **Communication & Collaboration**: Features push notification template management, an internal tasks system, standalone staff-to-staff messaging, email threading and deduplication via Microsoft Graph, and a multi-channel client notification and reminder system. This includes a rich-text Tiptap editor for messages, file attachments, Office document conversion for in-app preview, and intelligent message expand/collapse functionality.
-   **Document Management & E-Signatures**: A UK eIDAS-compliant electronic signature system for multi-page PDFs, supporting multiple signers, precise field placement, a public signing page with two-step consent, real-time signature drawing, and automatic PDF processing. It includes SHA-256 hashing, audit trails, secure signed URL generation, and a streamlined 3-step wizard for creating signature requests.
-   **Workflow & Status Management**: Offers project timeline color coding, permission-controlled inactive management for services and projects with audit trails, and specific handling for completed projects. Provides both desktop kanban view and mobile access.

## External Dependencies

### Third-Party Services
-   **Companies House API**: For UK company data integration.
-   **Microsoft Graph API**: For staff email integration.
-   **RingCentral**: For VoIP phone system integration.
-   **SendGrid**: For transactional email delivery.
-   **VoodooSMS**: Planned for client SMS services.
-   **Replit Platform Services**: For object storage, authentication, and deployment.

### Frontend Libraries
-   **UI Components**: `@radix-ui/*`, `@dnd-kit/*`, `@tiptap/*`, `react-hook-form` with `zod`, `sonner`.
-   **Utilities**: `date-fns`, `clsx`, `tailwind-merge`, `@getaddress/autocomplete`.