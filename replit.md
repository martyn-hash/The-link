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

## Service Kanban Board (Dashboard)
The dashboard features a service-specific kanban board for focused project management:

- **Service Filter**: Dropdown displays only services that have active client services, ensuring relevant service selection
- **Complete Stage Display**: All configured kanban stages for the selected service's project type are displayed as columns, including empty stages with "0 projects" count
- **Dynamic Grid Layout**: Grid automatically adapts to the number of stages (1-5 columns) for optimal visualization
- **Project Filtering**: Seamlessly filters and displays projects based on selected service for focused workflow management  
- **Stage-to-Project Mapping**: Projects are matched to stages by comparing project.currentStatus to stage.name
- **Persistent Selection**: Selected service is saved in localStorage for consistent user experience across sessions
- **Smart Data Integration**: Backend correctly joins kanbanStages → projectTypes (via project_type_id) → WHERE projectTypes.service_id matches selected service

## Advanced Project Filtering & Saved Views
The projects page features a comprehensive filtering system with saved view functionality:

- **Collapsible Filter Panel**: Sheet/Drawer UI component accessed via "Filters" button in header, showing active filter count badge
- **Date-Based Filtering**: Dynamic date options (Overdue, Due Today, Next 7/14/30 Days) plus custom date range picker using react-day-picker
- **Multi-Dimensional Filters**: Filter by service, task assignee, service owner, user assignment, and archived status
- **Saved Project Views**: Users can save current filter configurations with custom names for quick access
- **View Management**: Load previously saved views to instantly reapply filter combinations, delete outdated views
- **Clear All Filters**: Single-click reset to default filter state
- **Active Filter Indication**: Badge on Filters button displays count of currently active filters
- **Backend Persistence**: Saved views stored per user in PostgreSQL with filters as JSON strings

## Column Customization System
The projects page features comprehensive column customization capabilities allowing users to personalize their task list view:

- **Column Visibility Toggle**: Dialog-based interface to show/hide individual columns via checkboxes, providing a cleaner view focused on relevant data
- **Drag-and-Drop Reordering**: Table headers are draggable using @dnd-kit library, allowing users to rearrange columns in their preferred order
- **Column Width Resizing**: Resize handles on column headers enable precise width adjustments for optimal data visibility
- **Per-User Persistence**: All customization preferences (visibility, order, widths) are stored per user in the `user_column_preferences` database table
- **Six New Optional Columns**: In addition to default columns (Project, Client, Service, Time in Stage, Due Date, Status), users can enable:
  - **Created Date**: When the project was initially created
  - **Last Updated**: Most recent modification timestamp
  - **Days Until Due**: Calculated countdown to due date (or negative for overdue)
  - **Overdue Indicator**: Visual icon for projects past their due date
  - **Project Month**: Month designation for the project
  - **Current Stage**: The current kanban stage name
- **Automatic Synchronization**: Changes are immediately saved via API and persist across browser sessions and page reloads
- **RESTful API**: GET/POST endpoints at `/api/column-preferences` handle loading and saving preferences with proper authentication

## Dashboard Builder & Analytics
The projects page features a comprehensive dashboard builder for data visualization and analytics:

- **Multiple Visualization Types**: Supports four chart types - bar charts, pie charts, line charts, and number cards
- **Analytics Engine**: Backend analytics endpoint (`/api/analytics`) aggregates project data by various dimensions (projectType, status, assignee, serviceOwner, daysOverdue)
- **Interactive Widget Management**: Drag-and-drop widget creation with customizable chart types and groupBy options in edit mode
- **Saved Dashboards**: Persistent dashboard configurations stored per user in PostgreSQL with widget layouts and filter settings
- **Live Filter Integration**: Dashboard charts automatically update when filters change through React Query cache invalidation
  - Query keys include filter values: `['/api/analytics', { groupBy, filters: {...} }]`
  - Changing any filter (service, assignee, owner, date) triggers immediate chart refresh
  - Mini kanban board visibility tied to service filter state
- **Days Overdue Analysis**: Special groupBy option that buckets projects into ranges:
  - 1-9 days overdue
  - 10-31 days overdue  
  - 32-60 days overdue
  - 60+ days overdue
  - Not Overdue (due in future or on time)
- **Service Owner Grouping**: Analytics correctly groups by `projects.projectOwnerId` field for service owner visualizations
- **Service Filtering**: Properly joins with `projectTypes` table since projects don't have direct `serviceId` field
- **Mini Kanban Integration**: When a service filter is active, displays compact kanban board showing up to 5 projects per stage
- **Saved Views Integration**: Dropdown in header allows loading saved project views, which updates both filters and dashboard data

### Dashboard Filter Behavior
The dashboard builder implements a reactive filter system where all visualizations respond to filter changes in real-time:

1. **Filter State Management**: Filters are stored in parent component (projects.tsx) and passed to DashboardBuilder as props
2. **Query Key Integration**: React Query keys include all filter values to ensure cache invalidation on filter changes
3. **Analytics API**: Backend `/api/analytics` endpoint accepts filters object and applies them before data aggregation
4. **Automatic Refresh**: When filters change:
   - All chart queries re-fetch with new filter parameters
   - Number cards recalculate based on filtered dataset
   - Mini kanban board shows/hides based on service filter presence
5. **Filter Persistence**: Dashboard saves include current filter state as JSON, allowing complete dashboard restoration
6. **Cross-View Consistency**: Same filter state applies to list view, dashboard view, and kanban view for consistent data

## Progressive Web App (PWA) & Push Notifications
The application is configured as a Progressive Web App with push notification support:

- **PWA Installation**: Users can install The Link as a native-like app on their device from their browser
  - Manifest file (`client/public/manifest.json`) defines app name, icons, theme colors, and display mode
  - SVG icons provided for various device sizes (192x192, 512x512) with maskable variants for adaptive icons
  - Service worker (`client/public/sw.js`) enables offline capabilities and caching strategies
- **Push Notification System**: Web Push API integration allows real-time notifications to users
  - VAPID keys (stored in environment variables) for secure push notification authentication
  - Backend push service (`server/push-service.ts`) handles notification sending with web-push library
  - Database table stores user subscriptions with unique endpoints and security keys
  - API routes for subscribe/unsubscribe operations with proper authentication
  - Admin-only send endpoint for triggering notifications to specific users
- **User Experience**:
  - Floating prompt appears for authenticated users to opt-in to push notifications
  - Profile page Notifications tab includes push notification management section
  - Users can enable/disable push notifications at any time
  - Clear status indicators (Enabled/Disabled/Blocked) with appropriate alerts
  - Handles permission denied state with guidance to update browser settings
- **Service Worker Features**:
  - Message handling for skip waiting behavior during updates
  - Push event handler displays notifications with custom icons, badges, and actions
  - Notification click handler focuses existing app windows or opens new ones
  - Cache management for offline functionality and performance
- **Future Enhancement Ready**: Infrastructure in place to send notifications when projects change status, tasks are assigned, or other important events occur

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