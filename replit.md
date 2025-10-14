# Project Management Application

## Overview
This full-stack project management application provides a comprehensive solution for managing projects, clients, and services. It aims for a seamless, app-like experience across devices, prioritizing mobile responsiveness and intuitive user interfaces. The application integrates with third-party services to streamline communication, document management, and compliance tracking, offering a robust platform for efficient business operations. Key capabilities include core project management, client and contact management, service and communication tracking, and a client portal with secure messaging.

## User Preferences
- Mobile-first responsive design
- Touch-friendly interactions
- App-like mobile experience
- Bottom navigation on mobile
- Horizontal scrolling where appropriate

## System Architecture
The application is built with a modern tech stack designed for scalability and performance, emphasizing a mobile-first design approach.

### UI/UX Decisions
- **Responsive Layouts**: Dynamic adjustments for different screen sizes, with desktop tables transforming into card-based layouts on mobile.
- **Mobile Navigation**: Fixed bottom navigation bar for core functionalities and touch-friendly horizontal scrolling for tabs.
- **Search Experience**: Full-screen, bottom-sheet search modal optimized for mobile.
- **Interactive Elements**: Movable/resizable columns, dynamic service columns with owner info, color-coded tags, and comprehensive filtering.
- **Visual Feedback**: Indeterminate states for checkboxes, color-coded badges for status indicators, and clear visual affordances.

### Technical Implementations
- **Frontend**: React, Wouter (routing), TanStack Query (data fetching), Tailwind CSS, and shadcn/ui.
- **Backend**: Express.js with TypeScript.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Authentication**: OIDC (Replit Auth) for staff, code-based email verification for client portal.

### Feature Specifications
- **Core Project Management**: Kanban, list, and dashboard views.
- **Client & Contact Management**: Comprehensive profiles, risk assessment.
- **Service & Communication Tracking**: Scheduled services, communication logging, document management.
- **Task Templates (October 14, 2025)**: 
    - **Admin Interface**: Create reusable form templates with 10+ question types (text, email, number, textarea, date, radio, checkbox, dropdown, yes/no, file upload), organize with categories, multiple visual sections with drag-drop reordering.
    - **Client Application**: Staff apply templates to clients/contacts through client detail page Tasks tab, creating task instances assigned to specific persons.
    - **Portal Completion**: Portal users see assigned tasks in Tasks tab, complete forms with all question types including file uploads, save progress or submit.
    - **File Upload Integration**: File uploads automatically create documents in "Task Uploads" folder, linked to task responses.
    - **Staff Review**: Submissions list with status filtering, detailed review page showing all responses, mark-as-reviewed functionality.
- **Client Portal & Messaging**:
    - **Authentication**: Primary 6-digit email verification codes (10-minute expiry); magic links (deprecated but functional).
    - **Messaging**: Real-time threads with topics, status tracking (new, in_progress, resolved, closed), dual authorship, unread tracking, file attachments, and archive functionality.
    - **PWA**: Mobile-first design, PWA installation flow (QR code to instructions, then code-based login).
- **Advanced Table Features**: Dynamic column management (reorder, resize, show/hide), service owner display, color-coded tags, filtering, bulk selection.
- **Risk Assessment**: Multi-version assessments with checklists, unique response storage, color-coded risk levels.
- **Data Import System**: Admin-only CSV import (`/admin/import`) for clients, people, services, and role assignments. Multi-step workflow: Upload → Validate → Preview → Import → Results.
- **Mobile Optimizations**: Dedicated mobile components for navigation (BottomNav), search (SuperSearch), and responsive layouts for main pages.
- **Hooks**: Custom `useMediaQuery`, `useIsMobile`, and `useBreakpoint` for adaptive rendering.

### System Design Choices
- **Monorepo Structure**: `client/`, `server/`, and `shared/` directories.
- **Database Schema**: Relational design for users, clients, projects, services, communications, documents, risk assessments, messaging entities (`client_portal_users`, `message_threads`, `messages`, `client_portal_sessions`), and task templates (`task_template_categories`, `task_templates`, `task_template_sections`, `task_template_questions`, `task_instances`, `task_responses`).
- **API Design**: RESTful API routes with Zod for validation.
- **Client Portal Architecture**: Dedicated messaging system with separate authentication (`/api/portal/*` routes with JWT/session cookies) from staff OIDC auth (`/api/internal/*` routes).
- **Security Model**: Tenant isolation by `clientId`, project-based access for staff unread counts, and separate authentication flows for staff and clients.

## External Dependencies
- **SendGrid**: Email sending and tracking.
- **RingCentral**: VoIP calling and SMS integration.
- **Outlook**: Calendar and email synchronization.
- **Google Cloud Storage (GCS)**: Object storage for documents and files.
- **Companies House**: UK company data lookup.
- **Neon**: Managed PostgreSQL database service.

## Recent Changes

### Task Templates Feature Implementation (October 14, 2025)
Complete implementation of dynamic form templates system:
- **Database Schema**: 7 tables (`task_template_categories`, `task_templates`, `task_template_sections`, `task_template_questions`, `task_instances`, `task_responses`, plus "Task Uploads" folder integration)
- **Backend**: 39+ storage methods, 30+ API routes with full CRUD operations
- **Admin Interface**: 
  - Category management (`/task-template-categories`)
  - Template list and editor (`/task-templates`, `/task-templates/:id/edit`)
  - Visual section builder with drag-drop reordering
  - Question builder supporting 10 types: text, email, number, textarea, date, radio, checkbox, dropdown, yes/no, file
- **Client Portal**: 
  - Task assignment through client detail page Tasks tab
  - Portal Tasks page (`/portal/tasks`) with status filtering
  - Dynamic form completion (`/portal/tasks/:id`) with save/submit
  - File upload integration with presigned GCS URLs
- **Staff Review**: 
  - Submissions list (`/task-submissions`) with filtering
  - Detailed review page with all responses and mark-as-reviewed
- **Bug Fixes**: 
  - Fixed queryFn for detail pages to avoid list endpoint calls
  - Removed empty SelectItem value causing Radix UI error

## Previous Updates

### Recent Fixes & Testing (October 5, 2025)
### Fixed Issues
- **Portal Thread Status Runtime Error**: Fixed statusConfig in PortalThreadDetail and PortalThreadList to use correct thread status values ('open'|'closed'|'archived' instead of 'new'|'in_progress'|'resolved'|'closed')
- **Push Notification Authentication**: Fixed portal push notifications by exporting portalRequest() with JWT token support - portal users can now successfully subscribe to push notifications
- **Portal Messaging Routes**: Corrected thread status enum values and method names throughout portal API
- **Portal Login Persistence (PWA)**: Fixed authentication persistence issues in PWA by adding token expiry validation, visibility change handler for iOS Safari, and proper React hook dependencies
- **Staff-to-Portal Push Notifications**: Added push notification logic to staff message route - portal users now receive instant push notifications when staff sends them messages
- **N+1 Query Performance Issue**: Replaced per-thread message fetching with single optimized SQL query using LEFT JOIN and COUNT - eliminates performance bottleneck for large thread lists

### Latest Enhancements
- **Enhanced Push Notifications**: Added icon and badge images to push notification payloads for richer visual experience
- **Staff Name Display**: Portal messages now show actual staff member names instead of generic "Staff" label
- **Thread Titles**: Portal thread list displays subject/title instead of just status for better context
- **PWA App Badge**: Implemented navigator.setAppBadge() to show unread message count on PWA app icon
- **Visual Unread Indicators**: Threads display unread count badges with responsive styling (blue dot + count)
- **Auto Mark-as-Read**: Messages automatically marked as read when portal user views a thread
- **Push Notification Templates**: Created database schema for admin-configurable notification templates (foundation for future admin UI)
- **Session Persistence Improvements**: Extended JWT expiry to 30 days, implemented dual storage (localStorage + sessionStorage fallback) for iOS Safari PWA compatibility, added comprehensive logging for diagnostics

### Performance Optimizations
- **getMessageThreadsWithUnreadCount()**: Single SQL query with LEFT JOIN replaces N+1 pattern for calculating unread counts
- **Query Efficiency**: Handles thousands of threads efficiently with grouped COUNT and proper filtering

### ✅ Comprehensive E2E Testing Completed
Successfully tested full messaging flow from portal user (Sergei Jelissenko - martyn@accountantmatch.uk) to staff dashboard:
1. Portal code-based authentication ✅
2. Thread creation and instant messaging ✅
3. Message delivery to staff /messages page ✅
4. Client/staff message differentiation ✅
5. Push notification subscription for portal users ✅

### Testing Credentials
- **Staff**: admin@example.com / admin123 (via Password tab at /login)
- **Portal User**: martyn@accountantmatch.uk (code-based auth at /portal/login)