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
- **Database Schema**: Relational design for users, clients, projects, services, communications, documents, risk assessments, and messaging entities (`client_portal_users`, `message_threads`, `messages`, `client_portal_sessions`).
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

## Recent Fixes & Testing (October 5, 2025)
### Fixed Issues
- **Portal Thread Status Runtime Error**: Fixed statusConfig in PortalThreadDetail and PortalThreadList to use correct thread status values ('open'|'closed'|'archived' instead of 'new'|'in_progress'|'resolved'|'closed')
- **Push Notification Authentication**: Fixed portal push notifications by exporting portalRequest() with JWT token support - portal users can now successfully subscribe to push notifications
- **Portal Messaging Routes**: Corrected thread status enum values and method names throughout portal API
- **Portal Login Persistence (PWA)**: Fixed authentication persistence issues in PWA by adding token expiry validation, visibility change handler for iOS Safari, and proper React hook dependencies
- **Staff-to-Portal Push Notifications**: Added push notification logic to staff message route - portal users now receive instant push notifications when staff sends them messages

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