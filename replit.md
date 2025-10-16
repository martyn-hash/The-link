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
- **Task Templates**: Admin interface for creating reusable form templates with 10+ question types, organized by categories and visual sections with drag-and-drop reordering. Staff can apply templates to clients/contacts, creating task instances. Portal users can complete assigned forms, including file uploads, with progress saving and submission. File uploads automatically create documents linked to task responses. Staff can review submissions.
- **Custom Client Requests**: Staff can create client-specific, one-off requests without using templates. These mirror the template structure (requests → sections → questions) but are client-scoped and non-reusable. Task instances can be created from either templates or custom requests (enforced via database CHECK constraint). Full CRUD API available for managing custom requests.
- **Client Portal & Messaging**: Primary 6-digit email verification for authentication, real-time messaging threads with topics, status tracking, dual authorship, unread tracking, file attachments, and archive functionality. Includes PWA installation flow.
- **Advanced Table Features**: Dynamic column management (reorder, resize, show/hide), service owner display, color-coded tags, filtering, bulk selection.
- **Risk Assessment**: Multi-version assessments with checklists, unique response storage, color-coded risk levels.
- **Data Import System**: Admin-only CSV import for clients, people, services, and role assignments with a multi-step workflow.
- **Mobile Optimizations**: Dedicated mobile components for navigation (BottomNav), search (SuperSearch), and responsive layouts. Custom hooks (`useMediaQuery`, `useIsMobile`, `useBreakpoint`) for adaptive rendering.

### System Design Choices
- **Monorepo Structure**: `client/`, `server/`, and `shared/` directories.
- **Database Schema**: Relational design for users, clients, projects, services, communications, documents, risk assessments, messaging entities, task templates, and custom client requests. Task instances support dual sources (template OR custom request) via CHECK constraint.
- **API Design**: RESTful API routes with Zod for validation.
- **Client Portal Architecture**: Dedicated messaging system with separate JWT/session cookie authentication (`/api/portal/*` routes) from staff OIDC auth (`/api/internal/*` routes).
- **Security Model**: Tenant isolation by `clientId`, project-based access for staff unread counts, and separate authentication flows for staff and clients.

## External Dependencies
- **SendGrid**: Email sending and tracking.
- **RingCentral**: VoIP calling and SMS integration.
- **Outlook**: Calendar and email synchronization.
- **Google Cloud Storage (GCS)**: Object storage for documents and files.
- **Companies House**: UK company data lookup.
- **Neon**: Managed PostgreSQL database service.