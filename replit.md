# Overview

The Link is a comprehensive bookkeeping project workflow management system designed to streamline the collaboration between client managers, bookkeepers, and administrative staff. The application provides role-based access control with four distinct user types (Admin, Manager, Client Manager, and Bookkeeper) and implements a kanban-style workflow to track bookkeeping projects through five defined stages: "No Latest Action," "Bookkeeping Work Required," "In Review," "Needs Input from Client," and "Completed."

The system facilitates project assignment, task tracking, status updates with mandatory change reasons, and automated email notifications. Administrators can bulk-upload client data via CSV files, which automatically creates initial tasks for client managers. The application features both kanban board and task list views, comprehensive project chronology tracking, time governance for SLA compliance monitoring, enhanced service management with accordion-style interfaces for detailed service information, and a responsive design built with modern web technologies.

## Enhanced SuperSearch System
The dashboard features a comprehensive search system designed to provide quick access to all entities across the platform:

- **Mega-Menu Style Interface**: Three-column layout organizing search results by category for better visual organization
- **Cross-Entity Search**: Searches across clients, people, projects, communications, and services from a single input field
- **Smart Result Categorization**: Results are organized into logical categories with distinct color coding:
  - Clients: Blue theme with building icons
  - People: Emerald theme with user icons  
  - Projects: Violet theme with folder icons
  - Communications: Amber theme with message icons
  - Services: Rose theme with service icons
- **Enhanced Context**: Related people are automatically included when searching for clients, providing comprehensive search results
- **Intelligent Navigation**: Each result type navigates to appropriate detail pages or filtered list views
- **People Management**: Dedicated people page at `/people` route with role-based access controls and search capabilities

## Service Management Enhancement
The services tab provides comprehensive service management capabilities with an accordion-style interface similar to the "Related People" section:

- **Service Overview**: Displays next start date, next due date, and service owner in expandable summary rows
- **Detailed Service Information**: Expandable tabs show roles & responsibilities and related projects
- **Service Editing**: Full edit functionality with conditional restrictions based on service type
- **Companies House Integration**: Automatic frequency and date management for Companies House-connected services
- **Role Assignment Management**: Users can edit role assignees while role definitions remain admin-controlled

## Time Governance System
The application includes a comprehensive time governance system to monitor project efficiency and ensure SLA compliance:

- **Stage Time Limits**: Each kanban stage can be configured with two optional time limits:
  - **Max Instance Time**: Maximum hours a project should remain in a stage during any single visit
  - **Max Total Time**: Maximum cumulative hours a project should spend in a stage across all visits
- **Time Calculation**: Automated calculation of current instance time and total time spent using business hours logic
- **SLA Monitoring**: Helper functions enable identification of projects exceeding stage time limits for management intervention

## Dashboard Service Kanban Board
The dashboard includes a service-filtered kanban board for quick project visualization:

- **Service Filtering**: Dropdown selector displays only active services (consistent with the projects page)
- **Persistent Selection**: Selected service is remembered across page refreshes using localStorage
- **Initially Empty**: Board displays an empty state until a service is selected
- **Status Columns**: Projects are organized into 5 status columns (No Latest Action, Bookkeeping Work Required, In Review, Needs Client Input, Completed)
- **Project Display**: Each project card shows client name, project type, and due date with clickable navigation to project details
- **Full Width Layout**: Board spans the full width below the dashboard panels for maximum visibility

## Recent Changes (September 30, 2025)
- Fixed project navigation URLs from `/project/` to `/projects/` to eliminate 404 errors
- Removed Quick Actions Panel from dashboard layout
- Added service-filtered kanban board to dashboard with localStorage state persistence
- Enhanced backend `/api/projects` endpoint to support service-based filtering via `serviceId` query parameter
- Updated `getProjectsByUser` storage function to include `projectType` and `service` relations for proper filtering
- Modified dashboard services query to fetch only active services using `/api/services?active=true`

# User Preferences

Preferred communication style: Simple, everyday language.

## Test Credentials

For testing and development purposes:
- **Email**: admin@example.com
- **Password**: admin123

These credentials provide admin-level access for testing all application features and admin-only functionality.

# System Architecture

## Frontend Architecture
The frontend is built as a React Single Page Application (SPA) using TypeScript and Vite for development and build tooling. The architecture follows modern React patterns with functional components and hooks:

- **Component Structure**: Uses shadcn/ui component library built on Radix UI primitives for consistent, accessible UI components
- **State Management**: Leverages React Query (@tanstack/react-query) for server state management, caching, and synchronization
- **Routing**: Implements wouter for lightweight client-side routing
- **Styling**: Uses Tailwind CSS with CSS custom properties for theming and responsive design
- **Form Handling**: Integrates React Hook Form with Zod validation for type-safe form management
- **Drag and Drop**: Implements @dnd-kit for kanban board functionality with sortable interactions

## Backend Architecture  
The backend follows a Node.js/Express architecture with TypeScript and ES modules:

- **API Layer**: RESTful API endpoints organized by feature domains (auth, projects, users, clients)
- **Authentication**: Integrates Replit's OpenID Connect authentication system with Passport.js
- **Session Management**: Uses express-session with PostgreSQL session store for secure session handling
- **File Processing**: Implements multer for CSV file uploads with Papa Parse for data processing
- **Email Service**: Integrates SendGrid for automated task assignment notifications
- **Middleware**: Custom logging, error handling, and authentication middleware

## Data Storage Solutions
The application uses PostgreSQL as the primary database with Drizzle ORM for type-safe database operations:

- **Database Provider**: Neon serverless PostgreSQL with WebSocket connections
- **ORM**: Drizzle ORM provides type-safe queries and migrations
- **Schema Design**: Normalized relational schema with proper foreign key relationships
- **Session Storage**: PostgreSQL-backed session storage for authentication state
- **Migration Management**: Drizzle Kit handles database schema migrations

## Authentication and Authorization
Multi-layered security approach with role-based access control:

- **Authentication Provider**: Replit OpenID Connect integration
- **Session Management**: Secure HTTP-only cookies with PostgreSQL session persistence
- **Authorization**: Role-based middleware enforcing access controls (Admin, Manager, Client Manager, Bookkeeper)
- **Route Protection**: Server-side route guards and client-side authentication checks
- **User Context**: React context and hooks for user state management across components

## External Dependencies

- **Database**: Neon serverless PostgreSQL for data persistence and session storage
- **Authentication**: Replit OpenID Connect service for secure user authentication
- **Email Service**: SendGrid API for automated task assignment and notification emails
- **File Processing**: CSV file upload and parsing for bulk client data import
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Development Tools**: Vite for development server and build optimization, TypeScript for type safety
- **Monitoring**: Replit-specific development plugins for debugging and performance monitoring