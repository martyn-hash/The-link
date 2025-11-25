# The Link - CRM & Project Management Application

## Overview
The Link is a comprehensive full-stack CRM and project management application designed for accounting and bookkeeping firms. Its primary purpose is to automate recurring service delivery, streamline client relationship management, and provide a secure client portal for communication and document exchange. Key capabilities include intelligent scheduling, automated project generation, integration with Companies House for UK company data, and a mobile-first user experience. The application emphasizes automation, compliance, and a multi-tenant architecture with robust access controls, aiming to enhance efficiency and client satisfaction for accounting professionals.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
The application features a modern SaaS aesthetic inspired by Linear, Stripe, and Notion, utilizing a specific brand palette and the DM Sans font family. Design principles include increased spacing, soft modern shadows, and consistent 1rem border-radius for cards. All components are modernized with consistent styling and are mobile-first and responsive. The UI follows a consistent Phase 3 layout pattern across all pages, with standardized header blocks, body regions, and tab-based layouts, employing specific typography and spacing standards. Data-heavy list/table pages utilize full-width layouts, while detail/form pages remain centered for readability.

### Technical Implementation
The frontend is built with React and TypeScript, using Wouter for routing, TanStack Query for server state management, and shadcn/ui with Tailwind CSS for styling. The backend is an Express.js server in TypeScript, offering a modular RESTful API. It incorporates middleware for authentication, authorization, and data validation, handling core logic for service mapping, project creation, sophisticated scheduling with UTC date normalization, and comprehensive audit trails. A nightly scheduler automates project generation. The backend storage layer has been fully refactored from a monolithic file into 52 domain-focused modules using a facade pattern that maintains backward compatibility.

### System Design
PostgreSQL (Neon) is the primary database, managed via Drizzle ORM, utilizing UUIDs, soft deletes, and JSONB fields. Google Cloud Storage, accessed through Replit App Storage, handles object storage with secure signed URLs for documents. Staff authentication uses Replit Auth (OIDC) with session-based, role-based access control. The client portal employs passwordless email verification with magic link tokens. The system supports a multi-tenant architecture and is designed for modularity.

**Storage Layer Architecture (Completed November 25, 2025):**
The storage layer has been fully refactored from a monolithic 13,630-line file into a modern modular architecture:
- **52 domain-focused storage modules** across 14 domains (Users, Clients, People, Projects, Services, Tags, Communications, Integrations, Documents/Portal, Messages, Requests, Tasks, Notifications, Settings)
- **535+ methods** delegated with type-safe facades
- **IStorage interface** defined in `server/storage/base/IStorage.ts` (820 lines)
- **Backward-compatible facade** at `server/storage/index.ts` maintains the same API
- **Complete decoupling** from the old monolithic storage.ts which has been deleted

**Client Detail Page Refactoring (All 10 Stages Complete, November 25, 2025):**
The client-detail.tsx page (originally 9,347 lines) has been refactored into a modular component architecture:
- **Current Status:** 320 lines (96.6% reduction achieved)
- **Completed Stages:** All 10 (Utilities, Directory Structure, Projects, People, Services, Communications, Tab Components, Dialogs, Main Page Container, Final Cleanup)
- **Stage 10 Extractions:** ClientModalsContainer component, barrel exports for all directories
- **Key Patterns:** Prop drilling over Context for explicit dependencies, mutations in parent, grouped props, discriminated union types
- **Location:** `client/src/pages/client-detail/` with subdirectories: `components/tabs/`, `components/services/`, `components/modals/`, `dialogs/`, `forms/`, `hooks/`, `utils/`
- **Documentation:** See `client-detail_refactor.md` and stage-specific `.md` files for detailed architecture

**Client Routes Refactoring (Completed November 25, 2025):**
The monolithic server/routes/clients.ts (2,348 lines) has been refactored into a modular structure:
- **Main file reduced** from 2,348 lines to 295 lines (core CRUD only)
- **7 domain modules** in `server/routes/clients/` directory
- **Module breakdown:** companiesHouse.ts (698 lines), services.ts (837 lines), documents.ts (242 lines), people.ts (151 lines), portalUsers.ts (117 lines), riskAssessments.ts (62 lines), index.ts (31 lines)
- **Pattern:** Each module exports a `register*Routes` function with consistent middleware parameters
- **Backward compatible** - main registerClientRoutes function delegates to all modules
- **Documentation:** See `clients_refactor.md` for detailed plan and results

**Schema Layer Refactoring (All 12 Stages Complete, November 25, 2025):**
The monolithic shared/schema.ts (3,920 lines) has been refactored into domain-focused modules:
- **10 domain modules** in `shared/schema/` directory: Users, Clients, Projects, Services, Communications, Notifications, Documents, Email, Tasks, Requests
- **Backward-compatible barrel** at `shared/schema/index.ts` re-exports from legacy schema.ts
- **Domain modules available** as alternative import paths for tree-shaking (e.g., `import { users } from '@shared/schema/users'`)
- **Cross-domain dependencies** use temporary shims importing from legacy schema until final migration
- **Documentation:** See `schema_refactor.md` for detailed architecture and migration plan
- **Note:** Legacy schema.ts remains source of truth; domain modules provide optional targeted imports

**Database Performance Optimization (Completed November 25, 2025):**
Comprehensive database indexing strategy implemented to improve query performance:
- **Critical indexes added:** `project_chronology(project_id)`, `project_chronology(project_id, timestamp DESC)`, `kanban_stages(project_type_id, name)`, `client_people(client_id)`, `client_people(person_id)`
- **Composite indexes:** `projects(client_id, project_month)`, `projects(current_status, archived, inactive)`, `client_services(client_id, is_active)`, `scheduled_notifications(status, scheduled_for)`, `internal_tasks(assigned_to, status, is_archived)`
- **Role-based system optimized:** Existing `client_service_role_assignments(clientServiceId, workRoleId, isActive)` composite index already optimal
- **Health check endpoints:** `/api/super-admin/db-health` and `/api/super-admin/db-health/slow-queries` for monitoring
- **Documentation:** See `database_optimisations.md` for full analysis and recommendations
- **Note:** `bookkeeper_id` and `client_manager_id` indexes NOT needed - display-only fields, all filtering uses role-based lookup chain

### Key Features
-   **Automated Project & Service Management**: Includes automatic schema migrations, service scheduling, project automation, and client service role assignment with task cascading.
-   **Communication & Collaboration**: Features push notification template management, an internal tasks system, standalone staff-to-staff messaging, email threading and deduplication via Microsoft Graph, and a multi-channel client notification and reminder system. This includes a rich-text Tiptap editor for messages, file attachments, Office document conversion for in-app preview, and intelligent message expand/collapse functionality. Email notifications support rich HTML formatting with DOMPurify sanitization and dual HTML/plain text formats. Project message thread creation permissions have been refined.
-   **Document Management & E-Signatures**: A UK eIDAS-compliant electronic signature system for multi-page PDFs, supporting multiple signers, precise field placement, a public signing page with two-step consent, real-time signature drawing, and automatic PDF processing. It includes SHA-256 hashing, audit trails, secure signed URL generation, and a streamlined 3-step wizard for creating signature requests.
-   **Workflow & Status Management**: Offers project timeline color coding, permission-controlled inactive management for services and projects with audit trails, and specific handling for completed projects. Provides both desktop kanban view and mobile access with optimized stage change popup layouts and rich text notes with automatic message thread creation.
-   **Client & People Management**: A unified Clients page with tabbed interfaces for "Companies" (Companies House data) and "People" (contacts). Both tabs feature pagination and advanced column customization (visibility, reordering, resizing) with user preferences saved.
-   **Navigation**: Streamlined navigation menus, including an unread messages badge in the top navigation, and improved messaging page tabs for clear separation of internal and client chat.

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