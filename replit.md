# The Link - CRM & Project Management Application

## Overview
The Link is a full-stack CRM and project management application for accounting and bookkeeping firms. Its core purpose is to automate recurring service delivery, streamline client relationship management, and provide a secure client portal. It aims to boost efficiency and client satisfaction through features like intelligent scheduling, automated project generation, Companies House integration, and a mobile-first user experience within a multi-tenant architecture. The project emphasizes improving firm operations and client engagement, recognizing its market potential and ambitious goals.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
The UI/UX is inspired by modern SaaS platforms, using a specific brand palette and DM Sans font. Design principles include increased spacing, soft modern shadows, and consistent 1rem border-radius. Components are mobile-first, responsive, and follow a consistent layout with standardized headers, body regions, and tab-based designs. Full-width layouts are used for data-heavy pages, while detail and form pages are centered.

### Technical Implementation
The frontend uses React, TypeScript, Wouter for routing, TanStack Query for server state management, and `shadcn/ui` with Tailwind CSS for styling. The backend is an Express.js server in TypeScript, providing a modular RESTful API with middleware for authentication, authorization, and validation. It handles service mapping, project creation, sophisticated scheduling with UTC normalization, and comprehensive audit trails. A nightly scheduler automates project generation. The storage layer employs 52 domain-focused modules using a facade pattern. Performance is optimized with batch operations, optimistic updates, background prefetching, and state persistence.

### Feature Specifications
The system includes advanced communication tools like RingCentral VoIP integration with AI transcription, AI Magic Call/SMS, email image pasting, and SMS Templates. It supports shared Outlook inbox access via Microsoft Graph API with granular permissions and a dedicated Comms Workspace. MS Calendar integration allows viewing and creating calendar events (with Teams meeting support) for authorized users, with shared calendar access managed by super admins. Project management features include a dynamic "Client Also Has" filter, Tasks filter ownership permissions, and Bookkeeping Query Grouping. A drag-and-drop Pivot Table builder is available for data analysis. The system also features a multi-channel outbound campaign system with client-first targeting, personalized action pages, and comprehensive analytics, supporting email (SendGrid), SMS (VoodooSMS), and Voice (Dialora.ai). This campaign system includes a 7-step creation wizard, multi-step campaign sequences, and detailed analytics.

### System Design
The application uses PostgreSQL (Neon) with Drizzle ORM for data persistence, employing UUIDs, soft deletes, and JSONB fields. Google Cloud Storage (via Replit App Storage) manages object storage with secure signed URLs. Authentication for staff uses Replit Auth (OIDC) with session-based, role-based access control, while the client portal uses passwordless email verification. The multi-tenant system emphasizes modularity, extensive database indexing, and a resilient project scheduling orchestrator. Additional features include UK eIDAS-compliant electronic signatures, workflow and status management with Kanban views, AI Audio Transcription, AI-assisted client value notifications, Zapier integration, and an enhanced data import system. A user-friendly error handling system is also implemented.

## External Dependencies

### Third-Party Services
-   **Companies House API**: UK company data integration.
-   **Microsoft Graph API**: Email and calendar access.
-   **RingCentral**: VoIP phone system.
-   **SendGrid**: Transactional email and email campaigns.
-   **VoodooSMS**: Client SMS delivery and SMS campaigns.
-   **Dialora.ai**: AI-powered voice call reminders and voice campaigns.
-   **OpenAI API**: Audio transcription (Whisper), AI text processing (GPT-4o-mini), and AI Magic Assistant.
-   **Replit Platform Services**: Object storage, authentication, and deployment.

### Frontend Libraries
-   **UI Components**: `@radix-ui/*`, `@dnd-kit/*`, `@tiptap/*`, `react-hook-form` with `zod`, `sonner`.
-   **Utilities**: `date-fns`, `clsx`, `tailwind-merge`, `@getaddress/autocomplete`.