# The Link - CRM & Project Management Application

## Overview

The Link is a comprehensive full-stack CRM and project management application designed specifically for accounting and bookkeeping firms. It manages clients, contacts, services, projects, communications, and document workflows with a strong emphasis on automation and compliance tracking.

**Core Purpose**: Automate recurring service delivery through intelligent scheduling, manage client relationships, and provide a seamless portal experience for client communications and document exchange.

**Key Characteristics**:
- Mobile-first, app-like experience
- Automated project generation from scheduled services
- Companies House integration for UK company data
- Client portal with messaging and document management
- Multi-tenant architecture with strict access controls

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Routing**
- **React with TypeScript**: Component-based UI with full type safety
- **Wouter**: Lightweight client-side routing
- **TanStack Query**: Server state management, caching, and data fetching
- **Design System**: shadcn/ui components with Radix UI primitives and Tailwind CSS

**Mobile-First Design Pattern**
- Responsive layouts that transform desktop tables into mobile card views
- Fixed bottom navigation bar for core mobile functionality
- Touch-optimized interactions with horizontal scrolling tabs
- Full-screen bottom-sheet modals for search and forms
- Custom hooks (`useIsMobile`, `useMediaQuery`, `useBreakpoint`) for adaptive rendering

**State Management**
- TanStack Query for server state with aggressive caching
- Local React state for UI interactions
- No global state management library (intentional architectural choice)

### Backend Architecture

**Server Framework**
- **Express.js with TypeScript**: RESTful API server
- **Modular Route Structure**: Routes organized by domain (auth, clients, projects, services, etc.)
- **Middleware Stack**: Authentication, authorization, request validation, error handling

**Core Business Logic Modules**
- `server/core/service-mapper.ts`: Service-to-client/people mapping with date conversion
- `server/core/project-creator.ts`: Project generation from services with duplicate prevention
- `server/core/schedule-calculator.ts`: Date calculation and frequency management
- `server/project-scheduler.ts`: Nightly automated project creation scheduler

**Critical Design Decisions**
1. **Protected Core Modules**: Service mapping, project creation, and scheduling logic are centralized and protected from modification without thorough review
2. **UTC Date Normalization**: All date operations normalized to UTC to prevent timezone issues
3. **Idempotency Protection**: Multiple layers of duplicate prevention for project creation
4. **Audit Trails**: Complete history tracking via `projectSchedulingHistory` and `schedulingRunLogs` tables

### Data Storage

**Primary Database**
- **PostgreSQL (Neon)**: Serverless Postgres with connection pooling via `@neondatabase/serverless`
- **Drizzle ORM**: Type-safe database operations with schema-first approach
- **Migration Strategy**: Manual migrations in `migrations/` directory, applied via `drizzle-kit push`

**Database Schema Design**
- **Users & Authentication**: `users`, `userOauthAccounts`, `clientPortalUsers`
- **Core Entities**: `clients`, `people`, `projects`, `services`, `projectTypes`
- **Relationships**: `clientServices`, `peopleServices`, `serviceRoles`, `clientPeople`
- **Communications**: `communications`, `messageThreads`, `messages`, `messageAttachments`
- **Documents**: `documents`, `documentFolders` with hierarchical folder structure
- **Task System**: `taskTemplates`, `taskTemplateSections`, `taskTemplateQuestions`, `clientRequests` with instance tracking
- **Scheduling**: `projectSchedulingHistory`, `schedulingRunLogs` for automation audit trails
- **Access Control**: `clientPortalUserClients` for multi-company access

**Key Schema Patterns**
- UUIDs for all primary keys
- Soft deletes with `deletedAt` timestamps where applicable
- JSONB fields for flexible metadata (`udfValues`, `attachments`, `metadata`)
- Cascading deletes for referential integrity
- Comprehensive indexing on foreign keys and frequently queried fields

**Object Storage**
- **Google Cloud Storage**: Via Replit App Storage integration
- **File Management**: `server/objectStorage.ts` with signed URL generation (15-min TTL)
- **Document Tracking**: Files stored in GCS, metadata in `documents` table with `objectPath` references
- **Attachment Workflow**: Message attachments auto-create document records in "Message Attachments" folder

### Authentication & Authorization

**Dual Authentication System**

1. **Staff Authentication (OIDC)**
   - Replit Auth integration for staff users
   - Session-based with secure cookies
   - Role-based access control (Admin, Manager, Staff)
   - Impersonation capability for admin debugging

2. **Client Portal Authentication**
   - Email verification with 6-digit codes
   - Passwordless authentication flow
   - Magic link delivery via `/portal` route
   - Session tokens stored in `clientPortalUsers` table
   - Multi-company access via `clientPortalUserClients` junction table

**Access Control Patterns**
- **Staff**: Full access to all clients, role-based feature restrictions
- **Portal Users**: Strictly isolated to their associated clients
- **Data Isolation**: All queries filtered by `clientId` for portal users
- **Helper Functions**: `userHasClientAccess()` and similar guards in route handlers

### Service Scheduling & Project Automation

**Automated Scheduling System**
- **Nightly Scheduler**: Runs at 1:00 AM UTC via `node-cron`
- **Service Discovery**: Queries all active `clientServices` and `peopleServices` with `nextStartDate = today`
- **Project Creation**: Automatically generates projects linked to services
- **Frequency Support**: Daily, weekly, fortnightly, monthly, quarterly, annually
- **Date Advancement**: Updates `nextStartDate` and `nextDueDate` based on service frequency

**Companies House Integration**
- Special handling for CH-connected services (accounts, confirmation statements)
- Dates sourced from Companies House API, not auto-advanced
- Nightly sync updates client records with latest CH data
- Multiple API keys with rotation every 150 requests to avoid rate limits
- Change tracking in `companiesHouseChanges` table

**Duplicate Prevention Strategy**
1. Primary check against `projects` table by client + projectType + createdAt date
2. Secondary check via `projectSchedulingHistory` table
3. Single-project-type constraints for certain project types
4. Idempotent design allows safe re-runs

**Audit & Monitoring**
- `projectSchedulingHistory`: Complete record of every project creation
- `schedulingRunLogs`: Nightly run metrics, success/failure tracking
- Admin dashboard at `/admin` for monitoring and manual triggers
- Dry-run capability for testing without database writes

## External Dependencies

### Third-Party Services

**Companies House API**
- **Purpose**: Authoritative UK company data, filing deadlines, officer information
- **Integration**: `server/companies-house.ts` service wrapper
- **Data Synced**: Company details, registered office, SIC codes, accounting dates, confirmation statement dates
- **Rate Limiting**: Multiple API keys rotated every 150 requests
- **Update Strategy**: Nightly sync with intelligent change detection

**Microsoft Graph API (Outlook/Office 365)**
- **Purpose**: Email integration for staff users
- **OAuth Flow**: Per-user connections stored in `userOauthAccounts`
- **Capabilities**: Send emails, log sent emails as communications
- **Client Library**: `@microsoft/microsoft-graph-client`
- **Future**: Inbound email monitoring via webhooks to auto-create tickets

**RingCentral**
- **Purpose**: VoIP phone system integration
- **SDK**: `@ringcentral/sdk` and `@ringcentral/subscriptions`
- **Capabilities**: Call logging, phone number management
- **Component**: `client/src/components/ringcentral-phone.tsx`

**SendGrid**
- **Purpose**: Transactional email delivery (magic links, notifications)
- **Client**: `@sendgrid/mail`
- **Use Cases**: Portal login codes, project notifications

**VoodooSMS**
- **Purpose**: SMS messaging for client communications
- **Integration**: Planned for communications tab
- **Use Case**: Send SMS from client detail view, log in communications timeline

**Replit Platform Services**
- **Object Storage**: Google Cloud Storage backend via Replit sidecar
- **Auth**: OIDC provider for staff authentication
- **Environment**: Deployment and runtime environment

### Frontend Libraries

**UI Components**
- `@radix-ui/*`: 25+ accessible component primitives (dialogs, dropdowns, popovers, etc.)
- `@dnd-kit/*`: Drag-and-drop for Kanban boards, sortable lists, task template reordering
- `react-quill`: Rich text editor for notes and communications
- `react-hook-form`: Form state management with `@hookform/resolvers` for Zod validation
- `sonner`: Toast notifications

**Utilities**
- `date-fns`: Date manipulation and formatting
- `clsx` + `tailwind-merge`: Utility class management
- `zod`: Runtime schema validation
- `@getaddress/autocomplete`: UK address lookup

### Build & Development Tools

**Build Pipeline**
- **Vite**: Frontend build tool with React plugin
- **esbuild**: Server bundling for production
- **TypeScript**: Full type coverage across client/server/shared
- **PostCSS**: CSS processing with Tailwind and Autoprefixer

**Development Enhancements**
- `@replit/vite-plugin-runtime-error-modal`: Enhanced error overlays
- `@replit/vite-plugin-cartographer`: Code navigation
- `tsx`: TypeScript execution for development server

**Database Tools**
- `drizzle-kit`: Schema management and migrations
- `drizzle-orm`: Type-safe query builder