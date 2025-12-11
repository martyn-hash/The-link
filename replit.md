# The Link - CRM & Project Management Application

## Overview
The Link is a full-stack CRM and project management application designed for accounting and bookkeeping firms. Its primary purpose is to automate recurring service delivery, streamline client relationship management, and provide a secure client portal. The application aims to enhance efficiency and client satisfaction through features like intelligent scheduling, automated project generation, Companies House integration, and a mobile-first user experience, all within a multi-tenant architecture. It focuses on improving firm operations and client engagement, recognizing market potential and ambitious project goals.

## User Preferences
Preferred communication style: Simple, everyday language.

## Testing Credentials
- **Staff Login**: Root page → Passwords tab → admin@example.com | admin123

## System Architecture

### UI/UX
The application's UI/UX is inspired by modern SaaS platforms like Linear, Stripe, and Notion, utilizing a specific brand palette and DM Sans font. Design principles emphasize increased spacing, soft modern shadows, and consistent 1rem border-radius. Components are mobile-first, responsive, and adhere to a consistent Phase 3 layout with standardized header blocks, body regions, and tab-based designs. Full-width layouts are used for data-heavy pages, while detail and form pages remain centered.

### Technical Implementation
The frontend is built with React, TypeScript, Wouter for routing, TanStack Query for server state management, and `shadcn/ui` with Tailwind CSS for styling. The backend is an Express.js server in TypeScript, providing a modular RESTful API with middleware for authentication, authorization, and validation. It handles service mapping, project creation, sophisticated scheduling with UTC normalization, and comprehensive audit trails. A nightly scheduler automates project generation. The backend storage layer employs 52 domain-focused modules using a facade pattern. Performance optimizations include batch operations and optimistic updates for stage changes, background prefetching, and state persistence for list view settings.

### Feature Specifications
The system includes advanced communication tools like RingCentral VoIP integration with AI transcription, AI Magic Call/SMS for natural language interactions, email image pasting, and a new SMS Templates feature with variable support. It supports shared Outlook inbox access via Microsoft Graph API with granular permissions and a dedicated Comms Workspace for email management. Project management features include a dynamic "Client Also Has" filter, Tasks filter ownership permissions, and Bookkeeping Query Grouping. For data analysis, a drag-and-drop Pivot Table builder is available.

### System Design
The application uses PostgreSQL (Neon) with Drizzle ORM for data persistence, employing UUIDs, soft deletes, and JSONB fields. Google Cloud Storage (via Replit App Storage) manages object storage with secure signed URLs. Authentication for staff uses Replit Auth (OIDC) with session-based, role-based access control, while the client portal uses passwordless email verification. The multi-tenant system emphasizes modularity, extensive database indexing, and a resilient project scheduling orchestrator. Additional features include UK eIDAS-compliant electronic signatures, workflow and status management with Kanban views, AI Audio Transcription, AI-assisted client value notifications, Zapier integration, and an enhanced data import system. A user-friendly error handling system replaces technical errors.

## External Dependencies

### Third-Party Services
-   **Companies House API**: UK company data integration.
-   **Microsoft Graph API**: Email and calendar access.
-   **RingCentral**: VoIP phone system.
-   **SendGrid**: Transactional email.
-   **VoodooSMS**: Client SMS delivery.
-   **Dialora.ai**: AI-powered voice call reminders.
-   **OpenAI API**: Audio transcription (Whisper), AI text processing (GPT-4o-mini), and AI Magic Assistant.
-   **Replit Platform Services**: Object storage, authentication, and deployment.

### Frontend Libraries
-   **UI Components**: `@radix-ui/*`, `@dnd-kit/*`, `@tiptap/*`, `react-hook-form` with `zod`, `sonner`.
-   **Utilities**: `date-fns`, `clsx`, `tailwind-merge`, `@getaddress/autocomplete`.