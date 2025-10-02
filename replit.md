# Overview

The Link is a comprehensive bookkeeping project workflow management system designed to streamline collaboration between client managers, bookkeepers, and administrative staff. It features role-based access control (Admin, Manager, Client Manager, Bookkeeper) and a kanban-style workflow to track projects through five stages. The system supports project assignment, task tracking, status updates with mandatory change reasons, and automated email notifications. Key capabilities include bulk client data uploads, kanban board and task list views, project chronology tracking, time governance for SLA compliance, enhanced service management, advanced project filtering with saved views, a column customization system, and a dashboard builder for analytics. The application is also configured as a Progressive Web App (PWA) with push notification support.

# When You Need Permission

The scheduling aspects of this system - ie how projects are created and how client and person services have their next start dates and next due dates set is the foundation of this this and any changes can cause the system as a whole to not work properly. 
Therefore before you make any changes to code that could impact on how the scheduling works, you must seeks prior approval from the user before doing so. 

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
The frontend is a React SPA built with TypeScript and Vite. It utilizes shadcn/ui (based on Radix UI) for components, React Query for server state management, wouter for routing, Tailwind CSS for styling, React Hook Form with Zod for form handling, and @dnd-kit for drag-and-drop functionalities.

## Backend
The backend is a Node.js/Express application written in TypeScript (ES modules). It provides RESTful API endpoints, integrates Replit's OpenID Connect for authentication via Passport.js, uses express-session with a PostgreSQL session store, and incorporates multer with Papa Parse for CSV processing. SendGrid is used for email services, and custom middleware handles logging, error handling, and authentication.

## Data Storage
PostgreSQL serves as the primary database, managed with Drizzle ORM for type-safe operations and migrations. Neon serverless PostgreSQL is used as the database provider, and PostgreSQL-backed session storage is implemented.

## Authentication and Authorization
Security is multi-layered with role-based access control. Replit OpenID Connect handles authentication, with secure HTTP-only cookies and PostgreSQL session persistence. Role-based middleware enforces authorization across four user types (Admin, Manager, Client Manager, Bookkeeper). Both server-side route guards and client-side authentication checks are in place, with user context managed via React hooks.

## Key Features & Design
- **SuperSearch System**: Mega-menu style interface with cross-entity search (clients, people, projects, communications, services), smart categorization, enhanced context (related people with clients), and intelligent navigation.
- **Service Management**: Accordion-style interface displaying service overview, detailed information, and editing capabilities. Includes Companies House integration for date management and role assignment management. Supports static services for informational/tracking purposes (e.g., "Registered Office Service", "QuickBooks License Provided") that don't require workflows - marked with gray "Static" badge and excluded from project type mappings. When assigning static services to clients, frequency and service owner fields are optional since these services are for display/tracking only.
- **Time Governance**: Configurable "Max Instance Time" and "Max Total Time" limits per kanban stage for SLA monitoring, calculated using business hours.
- **Service Kanban Board**: Dynamic kanban board on the dashboard, filterable by active services, displaying all configured stages with project counts, adapting grid layout, and persistent service selection via localStorage.
- **Advanced Project Filtering & Saved Views**: Collapsible filter panel with date-based, multi-dimensional filtering (service, assignee, owner, archived status). Users can save, load, and manage custom filter configurations.
- **Column Customization**: Users can toggle visibility, reorder (drag-and-drop), and resize columns in the project list view. Preferences are persisted per user in the database. Six new optional columns (Created Date, Last Updated, Days Until Due, Overdue Indicator, Project Month, Current Stage) are available.
- **Dashboard Builder & Analytics**: Reorganized with independent list and dashboard views as peer entities. Dashboard view features independent filter system (separate from list view filters) configured within the dashboard creation modal. Supports bar, pie, line charts, and number cards. Users can create, save, edit, and load dashboards with custom filter configurations and widget layouts. Backend analytics endpoint (`/api/analytics`) aggregates data by various dimensions. Features Save/Edit dashboard buttons when dashboard is loaded, interactive widget management, clickable charts for data table filtering, and mini kanban board integration when a service filter is active. Dashboard filters are properly persisted and loaded to ensure widgets fetch data correctly. Service filters use service IDs (UUIDs) internally for accurate filtering, with legacy compatibility for dashboards created with service names. The `showArchived` filter is always transmitted to the backend to ensure consistent filtering behavior.
- **Progressive Web App (PWA) & Push Notifications**: PWA installation support via manifest and service worker. Integrates Web Push API for real-time notifications using VAPID keys, with user subscription management and admin-only send capabilities.
- **Project Completion System**: Manual project completion with "Mark as Successfully/Unsuccessfully Completed" buttons on project detail pages. Completed projects are archived with full chronology audit trail and separated in client views. Optional single-project-per-client constraint at project type level auto-archives existing active projects when scheduling new ones. Completed projects are read-only with backend safeguards preventing further status updates.

# External Dependencies

- **Database**: Neon serverless PostgreSQL
- **Authentication**: Replit OpenID Connect service
- **Email Service**: SendGrid API
- **UI Components**: shadcn/ui (built on Radix UI)
- **Development Tools**: Vite, TypeScript
- **File Processing**: Papa Parse (for CSV)
- **Monitoring**: Replit-specific development plugins