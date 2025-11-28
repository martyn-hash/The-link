# The Link - CRM & Project Management Application

## Overview
The Link is a comprehensive full-stack CRM and project management application for accounting and bookkeeping firms. Its core purpose is to automate recurring service delivery, streamline client relationship management, and provide a secure client portal for communication and document exchange. Key capabilities include intelligent scheduling, automated project generation, integration with Companies House, and a mobile-first user experience, enhancing efficiency and client satisfaction through automation, compliance, and robust access controls within a multi-tenant architecture.

## User Preferences
Preferred communication style: Simple, everyday language.

## Testing Credentials
For testing, login via the root page using the password tab:
- Email: admin@example.com
- Password: admin123

## System Architecture

### UI/UX
The application features a modern SaaS aesthetic inspired by Linear, Stripe, and Notion, using a specific brand palette and DM Sans font. Design principles include increased spacing, soft modern shadows, and consistent 1rem border-radius for cards. All components are modernized with consistent styling, are mobile-first and responsive, and follow a consistent Phase 3 layout pattern with standardized header blocks, body regions, and tab-based layouts. Data-heavy list/table pages use full-width layouts, while detail/form pages remain centered.

### Technical Implementation
The frontend uses React, TypeScript, Wouter for routing, TanStack Query for server state, and shadcn/ui with Tailwind CSS for styling. The backend is an Express.js server in TypeScript, providing a modular RESTful API with middleware for authentication, authorization, and validation. It handles service mapping, project creation, sophisticated scheduling with UTC normalization, and comprehensive audit trails. A nightly scheduler automates project generation. The backend storage layer has been refactored into 52 domain-focused modules using a facade pattern for backward compatibility.

### System Design
PostgreSQL (Neon) with Drizzle ORM is the primary database, utilizing UUIDs, soft deletes, and JSONB fields. Google Cloud Storage (via Replit App Storage) handles object storage with secure signed URLs. Staff authentication uses Replit Auth (OIDC) with session-based, role-based access control. The client portal uses passwordless email verification with magic link tokens. The system supports a multi-tenant architecture and is designed for modularity. Database indexing is extensively used for performance optimization.

### Key Features
-   **Automated Project & Service Management**: Includes automatic schema migrations, service scheduling, project automation, and client service role assignment with task cascading.
-   **Communication & Collaboration**: Features push notification template management, internal tasks, staff-to-staff messaging, email threading via Microsoft Graph, and a multi-channel client notification system with rich-text editor, file attachments, Office document conversion, and intelligent message expansion.
-   **Document Management & E-Signatures**: A UK eIDAS-compliant electronic signature system for multi-page PDFs, supporting multiple signers, precise field placement, public signing page with two-step consent, real-time signature drawing, and automatic PDF processing with SHA-256 hashing and audit trails.
-   **Workflow & Status Management**: Offers project timeline color coding, permission-controlled inactive management for services and projects, and specific handling for completed projects. Provides desktop kanban view and mobile access with optimized stage change popup layouts.
-   **NLAC (No Longer a Client)**: Secure multi-step process for marking clients as inactive, with password protection (configurable by Super Admins in Company Settings), reason selection (moving to new accountant, ceasing trading, no longer using accountant, taking accounts in house, or other), automatic deactivation of associated projects, services, and portal users, and comprehensive audit logging.
-   **Client & People Management**: Unified Clients page with tabbed interfaces for "Companies" (Companies House data) and "People" (contacts), featuring pagination and customizable columns.
-   **Navigation**: Streamlined navigation with unread messages badges and improved messaging page tabs.
-   **Feature Flags**: Company settings include toggleable feature flags (Ring Central Live, App Is Live) that control visibility of communication features. Super Admins can manage these via the Company Settings page.
-   **Communications UI**: Refactored communication filters to use a compact dropdown popover with multi-select checkboxes. The Add Communication dialog uses a TipTap rich text editor for content entry.
-   **AI Audio Transcription**: Voice-to-text feature in the Comms tab powered by OpenAI. Users can record audio which is transcribed via Whisper and processed by GPT-4o-mini for low latency. Two modes: (1) Notes mode creates summarized bullet-point notes from voice recordings, (2) Email mode drafts professional emails with subject and body from spoken content. System prompts are configurable in Company Settings by Super Admins.
-   **Webhook Data Sharing**: Zapier integration for sharing client data with legacy systems via configurable webhooks with conditional activation rules and audit logging.
-   **Enhanced Data Import System**: Comprehensive import capabilities including standalone service imports (matching by company number/name for clients, email/full name for people), interactive field mapping UI for CSV files with auto-matching, and detailed audit reporting with downloadable CSV showing created/updated/skipped/failed records with reasons.

## External Dependencies

### Third-Party Services
-   **Companies House API**: For UK company data integration.
-   **Microsoft Graph API**: For staff email integration.
-   **RingCentral**: For VoIP phone system integration.
-   **SendGrid**: For transactional email delivery.
-   **VoodooSMS**: Planned for client SMS services.
-   **OpenAI API**: Whisper for audio transcription and GPT-4o-mini for AI text processing (notes summarization and email drafting).
-   **Replit Platform Services**: For object storage, authentication, and deployment.

### Frontend Libraries
-   **UI Components**: `@radix-ui/*`, `@dnd-kit/*`, `@tiptap/*`, `react-hook-form` with `zod`, `sonner`.
-   **Utilities**: `date-fns`, `clsx`, `tailwind-merge`, `@getaddress/autocomplete`.