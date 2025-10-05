
# Project Management Application

## Overview
This full-stack project management application aims to provide a comprehensive solution for managing projects, clients, and services. It focuses on delivering a seamless, app-like experience across devices, with a strong emphasis on mobile responsiveness and intuitive user interfaces. The application integrates with various third-party services to streamline communication, document management, and compliance tracking, offering a robust platform for efficient business operations.

### Recent Updates (October 2025)
- **Messaging System Enhancements** (October 5, 2025):
  - **Archive Functionality**: Staff can archive/unarchive message threads with full audit trail (archivedAt, archivedBy)
  - **File Attachments**: Support for images, PDFs with presigned URL upload to object storage (10MB limit per file)
  - **Communications Tab Integration**: Message threads now appear in client detail Communications tab alongside other communications (calls, emails, SMS)
  - **Staff Messages Page**: New `/messages` page with Active/Archived tabs, status filters (Open/In Progress/Resolved), unread badges, and quick thread navigation
  - **Instant Message Button**: Communications tab includes "Instant Message" button to create new threads directly from client detail page
  - **Enhanced UI**: File upload with preview, attachment display in messages, and responsive mobile design
  - **Portal Push Notifications**: Full-screen branded prompt for portal users to enable push notifications with Growth Accountants branding
  - **Bug Fixes**: Fixed portal messaging routes (thread status enum, method names), now using correct 'open', 'closed', 'archived' statuses
  - **Testing Credentials**: Staff login at `/login` using `admin@example.com` / `admin123`
- **Data Import System**: Added comprehensive CSV import functionality at `/admin/import` for bulk importing client data, people, services, and role assignments. Supports multi-step workflow with validation, preview, and execution phases. System successfully creates clients, people, client-person relationships, service mappings, and role assignments from CSV files.
- **Client Portal Authentication Upgrade** (October 4, 2025):
  - **Code-based authentication**: Replaced magic links with secure 6-digit email verification codes
  - Two-step login flow: email entry → code verification (10-minute expiry, one-time use)
  - Beautiful `/portal/install` page with device-specific PWA installation instructions
  - QR codes now point to install page instead of auto-login magic links
  - Updated login UI with InputOTP component for code entry, brand gradient styling
  - Branded email templates for verification codes using "The Link" sender (requires FROM_EMAIL secret)
  - Backend: `sendVerificationCode()` and `verifyCode()` functions in `server/portalAuth.ts`
  - API routes: `POST /api/portal/auth/request-code`, `POST /api/portal/auth/verify-code`
  - Database: Added `verificationCode` and `codeExpiry` fields to `client_portal_users` table
  - Magic link system deprecated but kept functional for backward compatibility
  - Cookie-based dynamic manifest selection for proper PWA behavior
- **Client Portal UI Enhancements** (October 4, 2025):
  - Fixed QR code login UX: already-authenticated users are immediately redirected without showing verification error flash
  - Portal-specific PWA manifest (`/portal-manifest.json`) with `/portal/login` start URL and `/portal/` scope
  - iOS 26+ detection for updated PWA install instructions (3-dot menu instead of share button) with pulsing animations
  - New 5-button bottom navigation: Hamburger menu (future features), Tasks, Chats (center position for messaging), Profile, and TBD placeholder
  - Portal Tasks page (`/portal/tasks`) with coming soon placeholder for task management and organizers
  - Portal Profile page (`/portal/profile`) displaying user email, client ID, and logout functionality
  - Device detection utility supporting iOS Safari and Android Chrome for optimal PWA experience

## User Preferences
- Mobile-first responsive design
- Touch-friendly interactions
- App-like mobile experience
- Bottom navigation on mobile
- Horizontal scrolling where appropriate

## System Architecture
The application is built with a modern tech stack designed for scalability and performance.

### UI/UX Decisions
The application features a mobile-first design approach, ensuring an optimal experience on smaller screens while providing a rich desktop interface. Key UI/UX patterns include:
- **Responsive Layouts**: Dynamic adjustments for different screen sizes, with desktop-style tables transforming into card-based layouts on mobile.
- **Mobile Navigation**: Fixed bottom navigation bar for core functionalities and touch-friendly horizontal scrolling for tabs and card sections.
- **Search Experience**: Full-screen, bottom-sheet search modal optimized for mobile with adaptive input positioning.
- **Interactive Elements**: Movable and resizable columns, dynamic service columns with owner information, color-coded tags, and comprehensive filtering options in tables.
- **Visual Feedback**: Indeterminate states for checkboxes, color-coded badges for status indicators (e.g., risk levels, due dates), and clear visual affordances for search and navigation.

### Technical Implementations
- **Frontend**: React with Wouter for routing, TanStack Query for data fetching, Tailwind CSS for styling, and shadcn/ui for UI components.
- **Backend**: Express.js with TypeScript for robust API development.
- **Database**: PostgreSQL hosted on Neon, managed with Drizzle ORM.
- **Authentication**: OIDC (Replit Auth) for secure user authentication.

### Feature Specifications
- **Core Project Management**: Kanban, list, and dashboard views for project tracking.
- **Client & Contact Management**: Comprehensive client and individual profiles, including risk assessment.
- **Service & Communication Tracking**: Scheduled services, communication logging (email, call, SMS), and document management.
- **Client Portal & Messaging**: 
  - **Code-based authentication** (Primary): 6-digit email verification codes with 10-minute expiry
  - Magic link authentication (Deprecated but functional for backward compatibility)
  - Message threads with topics and status tracking (new, in_progress, resolved, closed)
  - Real-time messaging between clients and staff
  - Dual authorship support (staff users OR portal clients)
  - Unread message tracking with tenant-scoped security
  - Integration with communications table for unified staff visibility
  - Mobile-first portal design with app-like experience
  - **PWA Installation Flow**: QR code → Install instructions → Code-based login
- **Advanced Table Features**: Dynamic column management (reorder, resize, show/hide), service owner display, color-coded tags with filtering, and bulk selection.
- **Risk Assessment**: Multi-version risk assessments with detailed checklists, unique response storage, and color-coded risk levels.
- **Data Import System**: 
  - Admin-only CSV import at `/admin/import`
  - Three-spreadsheet format: Clients & People, Client Services, Role Assignments
  - Multi-step workflow: Upload → Validate → Preview → Import → Results
  - Downloadable templates with correct service/role names
  - Comprehensive validation with helpful error messages suggesting available services/roles
  - Creates clients, people, client-people relationships, service mappings, and role assignments
- **Mobile Optimizations**: Dedicated mobile components for navigation (BottomNav), search (SuperSearch), and responsive layouts for all main pages (Dashboard, Projects, Client Detail, Scheduled Services).
- **Hooks**: Custom `useMediaQuery`, `useIsMobile`, and `useBreakpoint` hooks for adaptive rendering.

### System Design Choices
- **Monorepo Structure**: Separate `client/`, `server/`, and `shared/` directories for clear separation of concerns.
- **Database Schema**: Relational database design supporting `users`, `clients`, `people`, `projects`, `services`, `client_services`, `communications`, `documents`, `dashboards`, `risk_assessments`, and `risk_assessment_responses` tables.
- **API Design**: RESTful API routes with Zod for validation and authentication/authorization middleware.
- **Client Portal Architecture**: Dedicated messaging system with magic link authentication, separate from staff OIDC auth. Portal uses `/api/portal/*` routes with JWT/session cookies, while staff uses `/api/internal/*` routes with OIDC middleware.

## External Dependencies
- **SendGrid**: Email sending and tracking.
- **RingCentral**: VoIP calling and SMS integration.
- **Outlook**: Calendar and email synchronization.
- **Google Cloud Storage (GCS)**: Object storage for documents and files.
- **Companies House**: Integration for UK company data lookup and synchronization.
- **Neon**: Managed PostgreSQL database service.

## Messaging System Architecture

### Overview
The messaging system provides a comprehensive client portal with instant messaging and ticketing capabilities, enabling direct communication between clients and staff through a mobile-first, app-like interface.

### Database Schema
**Client Portal Users** (`client_portal_users`)
- Unique email-based authentication (no passwords)
- Linked to main client records via `clientId`
- Stores name, phone, and last login tracking
- Supports multiple portal users per client

**Message Threads** (`message_threads`)
- Topic-based conversation organization
- Status tracking: `new`, `in_progress`, `resolved`, `closed`
- **Archive Support**: `isArchived`, `archivedAt`, `archivedBy` fields for staff workflow management
- Creator tracking (staff user OR portal client)
- Optional project/service association for context
- Automatic `lastMessageAt` timestamp updates
- Client-scoped for multi-tenant security

**Messages** (`messages`)
- Thread-based message storage
- Dual authorship: `userId` (staff) OR `clientPortalUserId` (client)
- Separate read receipts for staff and clients (`isReadByStaff`, `isReadByClient`)
- **File Attachments**: JSONB field storing attachment metadata (name, type, size, url, key)
- Timestamps for message creation and read tracking
- Enforces: exactly one author type per message

**Portal Sessions** (`client_portal_sessions`)
- JWT-based session management
- Expiry tracking and revocation support
- Client-scoped access control

### Security Model
**Tenant Isolation**
- All queries filter by `clientId` for data isolation
- Staff unread counts scoped to user's assigned projects:
  - Admin users: see all messages
  - Non-admin users: only see messages from clients where they are bookkeeper, client manager, project owner, or current assignee
- Portal authentication completely separate from staff OIDC

**Authentication Flow**
- **Clients (Primary)**: Email → 6-digit code → JWT → `/api/portal/*` routes
  - QR code scans lead to `/portal/install` (PWA installation instructions)
  - Login at `/portal/login` uses two-step flow: email entry → code verification
  - Verification codes expire after 10 minutes, one-time use
  - Codes stored in `verificationCode` and `codeExpiry` fields
  - API routes: `POST /api/portal/auth/request-code`, `POST /api/portal/auth/verify-code`
- **Clients (Deprecated)**: Magic link → JWT/session cookie → `/api/portal/*` routes
  - Still functional for backward compatibility with old QR codes
  - Routes marked as DEPRECATED: `POST /api/portal/auth/request-magic-link`, `GET /api/portal/auth/verify`
- **Staff**: OIDC (Replit Auth) → `/api/internal/*` routes
- Route prefixes enforce role-based access

### Integration Points
**Communications Table**
- Message threads optionally link to communications via `threadId`
- Enables unified staff visibility across all client interactions
- Communications audit log remains separate from messaging domain

**Storage Layer Security**
- All messaging CRUD operations tenant-scoped
- `getUnreadMessageCountForStaff(userId, isAdmin)` enforces project-based access
- Automatic `lastMessageAt` updates on message creation
- Read receipt tracking separate for staff and clients

### Testing Credentials
**Staff Access**:
- URL: `/login`
- Email: `admin@example.com`
- Password: `admin123`
- Access: Full admin access to all messaging features, client data, and archive functionality

**Client Portal Access**:
- Generate 6-digit code via portal login page
- Alternatively, use deprecated magic link token from client portal users table
- Access: Client-scoped messages, profile, and tasks (coming soon)

### API Endpoints
**Staff Routes** (`/api/internal/messages/*`):
- `GET /threads` - List all message threads with filters
- `POST /threads` - Create new thread
- `GET /threads/:id/messages` - Get thread messages
- `POST /threads/:id/messages` - Send message with optional attachments
- `PATCH /threads/:id/status` - Update thread status
- `PUT /threads/:id/archive` - Archive thread (staff only)
- `PUT /threads/:id/unarchive` - Restore archived thread
- `POST /upload-url` - Generate presigned URL for file upload
- `GET /threads/client/:clientId` - Get threads for specific client

**Portal Routes** (`/api/portal/messages/*`):
- `GET /threads` - List client's threads
- `POST /threads` - Create new thread
- `GET /threads/:id/messages` - Get messages
- `POST /threads/:id/messages` - Send message with attachments
- `POST /upload-url` - Generate presigned URL for file upload

### Future Extensibility
The schema supports planned portal features:
- ✅ File attachments (images, PDFs) - IMPLEMENTED
- ⏳ Voice notes via MediaRecorder API
- ⏳ Push notifications with email fallback
- ⏳ PWA share target for bank statements
- ⏳ Task templates for clients
- ⏳ Document e-signing
- ⏳ Calendly booking integration
- ⏳ Key dates and organizers