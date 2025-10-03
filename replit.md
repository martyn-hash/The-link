
# Project Management Application

## Overview
This full-stack project management application aims to provide a comprehensive solution for managing projects, clients, and services. It focuses on delivering a seamless, app-like experience across devices, with a strong emphasis on mobile responsiveness and intuitive user interfaces. The application integrates with various third-party services to streamline communication, document management, and compliance tracking, offering a robust platform for efficient business operations.

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
- **Advanced Table Features**: Dynamic column management (reorder, resize, show/hide), service owner display, color-coded tags with filtering, and bulk selection.
- **Risk Assessment**: Multi-version risk assessments with detailed checklists, unique response storage, and color-coded risk levels.
- **Mobile Optimizations**: Dedicated mobile components for navigation (BottomNav), search (SuperSearch), and responsive layouts for all main pages (Dashboard, Projects, Client Detail, Scheduled Services).
- **Hooks**: Custom `useMediaQuery`, `useIsMobile`, and `useBreakpoint` hooks for adaptive rendering.

### System Design Choices
- **Monorepo Structure**: Separate `client/`, `server/`, and `shared/` directories for clear separation of concerns.
- **Database Schema**: Relational database design supporting `users`, `clients`, `people`, `projects`, `services`, `client_services`, `communications`, `documents`, `dashboards`, `risk_assessments`, and `risk_assessment_responses` tables.
- **API Design**: RESTful API routes with Zod for validation and authentication/authorization middleware.

## External Dependencies
- **SendGrid**: Email sending and tracking.
- **RingCentral**: VoIP calling and SMS integration.
- **Outlook**: Calendar and email synchronization.
- **Google Cloud Storage (GCS)**: Object storage for documents and files.
- **Companies House**: Integration for UK company data lookup and synchronization.
- **Neon**: Managed PostgreSQL database service.