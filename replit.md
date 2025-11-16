# The Link - CRM & Project Management Application

## Overview
The Link is a comprehensive full-stack CRM and project management application tailored for accounting and bookkeeping firms. It automates recurring service delivery through intelligent scheduling, streamlines client relationship management, and offers a secure client portal for communication and document exchange. The application emphasizes automation, compliance, and a mobile-first user experience, featuring automated project generation, integration with Companies House for UK company data, and a multi-tenant architecture with robust access controls.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
The application features a modern SaaS aesthetic inspired by Linear, Stripe, and Notion. It utilizes a brand palette with specific blues, greens, purple, and yellow, a light gray background, and the DM Sans font family. Design principles include increased spacing for airiness, soft modern shadows, and a 1rem border-radius for cards. Components like buttons, tabs, cards, forms, and tables have been modernized with consistent styling, including rounded shapes, semibold weights, and smooth transitions. The design is mobile-first and responsive.

#### Phase 3 UI Pattern (Approved November 2025)
The application follows a consistent layout pattern across all pages:

**Page Structure:**
- Header blocks: `<div className="border-b border-border bg-card"><div className="page-container py-6 md:py-8">...</div></div>`
- Body regions (detail/form pages): `<div className="page-container py-6 md:py-8 space-y-8">...</div>`
- Body regions (data/list pages): `<div className="w-full px-4 md:px-6 lg:px-8 py-6 md:py-8 space-y-8">...</div>`
- Tab-based layouts: `<TabsContent className="space-y-8"><div className="page-container py-6 md:py-8">...</div></TabsContent>`

**Typography Standards:**
- Primary headings: `text-2xl md:text-3xl font-semibold tracking-tight`
- Subtitles: `text-meta mt-1`

**Spacing Standards:**
- Vertical rhythm: `space-y-8` for main sections, `gap-6` for grids
- Responsive padding: `py-6 md:py-8` for page-level containers
- Responsive horizontal padding (data pages): `px-4 md:px-6 lg:px-8`

**Full-Width Data View Pattern (November 2025):**
Data-heavy list/table pages use full-width layouts while maintaining Phase 3 styling. Detail/form pages remain centered for readability.
- **Standard full-width:** Header centered, body full-width with responsive padding
- **Special case (company-settings):** Header centered, form cards in centered wrapper, table sections full-width

#### Phase 3 Completion Status (November 2025)
**Completed: 47 pages** across all major application areas with consistent Phase 3 pattern:

**Core Workflow (11 pages - Baseline):** clients, companies, people, person-detail, services, client-service-detail, scheduled-services, project-detail, project-types, project-type-detail, task-instance-detail

**Communication (4 pages):** internal-tasks, internal-task-detail, internal-chat, messages

**Requests & Templates (6 pages):** client-requests, request-templates, request-template-edit, request-template-categories, request-template-section-questions, custom-request-edit

**Workflow & Submissions (3 pages):** signature-requests, task-submissions, task-submission-detail

**Settings & Configuration (5 pages):** profile, company-settings, tags, admin-task-types, (settings redirect)

**Notifications & Admin (3 pages):** scheduled-notifications, push-notification-templates, push-diagnostics

**Full-Width Data Updates (November 2025):**
Enhanced 18 pages with full-width data views for improved table/list readability. All pages retain Phase 3 typography and spacing while maximizing horizontal space for data-heavy content:
- **Core entities (5):** clients, companies, people, services, scheduled-services
- **Workflow (4):** projects, internal-tasks, client-requests, request-templates
- **Submissions (2):** signature-requests, task-submissions
- **Admin (3):** tags, admin-task-types, request-template-categories
- **Notifications (3):** scheduled-notifications, push-notification-templates, push-diagnostics
- **Settings (1):** company-settings (granular: centered forms + full-width tables)

**Remaining pages for future work (~8 pages):** notification-edit, signature-request-builder, ch-changes, upload

### Frontend
The frontend is built with React and TypeScript, using Wouter for routing, TanStack Query for server state management, and shadcn/ui with Tailwind CSS for styling.

### Backend
The backend is an Express.js server in TypeScript, providing a modular RESTful API. It includes middleware for authentication, authorization, and data validation, and handles core logic for service mapping, project creation, sophisticated scheduling with UTC date normalization, and comprehensive audit trails. A nightly scheduler automates project generation.

### Data Storage
PostgreSQL (Neon) is the primary database, managed via Drizzle ORM, utilizing UUIDs, soft deletes, and JSONB fields. Google Cloud Storage, accessed through Replit App Storage, handles object storage with secure signed URLs for documents.

### Authentication & Authorization
Staff authentication uses Replit Auth (OIDC) with session-based, role-based access control. The client portal employs passwordless email verification.

### Key Features
-   **Automated Project & Service Management**: Includes automatic schema migrations, service scheduling, project automation, and client service role assignment with task cascading.
-   **Communication & Collaboration**: Features push notification template management, an internal tasks system, standalone staff-to-staff messaging, email threading and deduplication via Microsoft Graph, and a multi-channel client notification and reminder system.
-   **Document Management & E-Signatures**: A UK eIDAS-compliant electronic signature system enables staff to send multi-page PDFs for signature via secure public links. It supports multiple signers, precise field placement using percentage-based coordinates, a public signing page with two-step consent, real-time signature drawing, and automatic PDF processing. It includes SHA-256 hashing, comprehensive audit trails, secure signed URL generation for PDF access, and a global signature requests view. A streamlined 3-step wizard for creating signature requests includes document selection, interactive field placement with drag-and-drop, and automated recipient derivation. The system ensures robust single-session protection to prevent duplicate submissions.
-   **Workflow & Status Management**: Offers project timeline color coding, permission-controlled inactive management for services and projects with audit trails, and specific handling for completed projects. Desktop kanban view provides hover-activated stage information, while mobile offers tap-to-view modal access.

## External Dependencies

### Third-Party Services
-   **Companies House API**: For UK company data integration.
-   **Microsoft Graph API**: For staff email integration.
-   **RingCentral**: For VoIP phone system integration.
-   **SendGrid**: For transactional email delivery.
-   **VoodooSMS**: Planned for client SMS services.
-   **Replit Platform Services**: For object storage, authentication, and deployment.

### Frontend Libraries
-   **UI Components**: `@radix-ui/*`, `@dnd-kit/*`, `react-quill`, `react-hook-form` with `zod`, `sonner`.
-   **Utilities**: `date-fns`, `clsx`, `tailwind-merge`, `@getaddress/autocomplete`.