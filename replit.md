# Project Management Application

## Overview
Full-stack project management application built with Express, React, PostgreSQL, and integrated with various services (SendGrid, RingCentral, Outlook, Object Storage).

## Recent Changes

### October 3, 2025 - Risk Assessment Feature
Added comprehensive risk assessment functionality for client compliance tracking:

1. **Database Schema**
   - Created `risk_assessments` table with one-to-many relationship to clients
   - Fields for AML preparation, AML review, risk levels, dates, and notes
   - Created `risk_assessment_responses` table for storing checklist answers
   - Enum types: `risk_level` (low/medium/high), `risk_response` (yes/no/na)
   - Proper indexing and cascade deletion for data integrity

2. **Backend Implementation**
   - 6 storage methods for CRUD operations (create, read, update, delete, get by client, save responses)
   - RESTful API routes with authentication and authorization
   - Proper validation using Zod schemas
   - Authorization checks ensure users can only access assessments for clients they have permission to view

3. **Frontend Components**
   - New Risk tab as 8th tab in client detail view (desktop grid-cols-8, mobile carousel)
   - RiskAssessmentTab component with full CRUD functionality
   - 5 accordion sections with ~26 questions total:
     * AML Preparation (5 questions)
     * AML Review (4 questions)
     * Individuals Checklist (5 questions)
     * Business Checklist (6 questions)
     * Risk Areas (5 questions)
   - Create assessment dialog with version, date, risk level, and notes fields
   - View/edit dialog with question responses using radio buttons
   - Mobile-responsive design with proper tab navigation

4. **Features**
   - Support for multiple assessments per client (annual reviews)
   - Risk level badges (low/medium/high) with color coding
   - Persistent response storage with unique constraint per question
   - Toast notifications for user feedback
   - Proper React Query cache invalidation

### October 3, 2025 - Mobile Tab Navigation Enhancements
Enhanced tab navigation on mobile for better clarity and usability:

1. **Client Detail Tabs**
   - Added left/right arrow navigation buttons for clear affordance
   - Fixed active tab indicator to scroll into view when swiping
   - Implemented scoped selectors (data-client-tabs="main") to prevent interference
   - Arrow buttons disabled at first/last tab with visual feedback

2. **Person Detail Tabs (Related People)**
   - Applied carousel treatment with 80vw width and peek previews
   - Added arrow navigation buttons (left/right)
   - Implemented swipe gesture support (50px threshold)
   - Scoped with unique IDs (data-person-tabs="${id}") for multi-instance isolation
   - Active tab scrolls into view on swipe or button click

3. **Search Modal Repositioning**
   - Moved to bottom sheet layout (slides up from bottom)
   - Input positioned at bottom, results above to avoid keyboard overlap
   - Height set to 85vh with rounded top corners for native feel

### October 2, 2025 - Mobile Responsive Transformation
Transformed the desktop-focused PWA into a fully responsive, mobile-optimized application with an app-like experience on phones.

#### Pages Optimized for Mobile
1. **Dashboard (Home Screen)** - Fully responsive with mobile-first layout
   - Responsive header with adaptive padding and typography
   - Horizontal scrolling "Recently Viewed" section
   - Mobile bottom navigation integration
   - Mobile search modal integration
   - Proper bottom padding (pb-20) to avoid nav overlap

2. **SuperSearch (Mega Search)** - Full-screen modal on mobile
   - Fixed critical bug where typing would close the modal
   - Decoupled mobile/desktop visibility logic
   - Full-screen experience on mobile (h-screen w-screen)
   - Tabs for different search types
   - Touch-friendly interactions

3. **Projects Page** - Comprehensive mobile optimization
   - Responsive header with icon-only view toggles on mobile
   - Filter button with badge showing active filters
   - Three view modes work on mobile (list, kanban, dashboard)
   - Mobile search integration
   - Bottom navigation support

4. **Scheduled Services** - Card-based mobile layout
   - Desktop table view preserved (hidden md:block)
   - Mobile card view with colored left borders (green for active, gray for inactive)
   - Responsive filters (column layout on mobile, row on desktop)
   - Full-width controls on mobile
   - Bottom nav and search integrated

5. **Client Detail** - Strategic mobile enhancements
   - Responsive header with truncation for long client names
   - Horizontally scrollable tabs (7 tabs accessible via swipe)
   - All tabs remain accessible on mobile (no hidden sections)
   - Shortened tab labels on mobile (Comms, History, Docs)
   - Bottom nav and search integrated
   - Proper bottom padding (4rem) for nav clearance

#### Mobile Navigation Components
- **BottomNav**: Fixed bottom navigation bar (64px height) with 4 items:
  - Home (/) 
  - Projects (/projects)
  - Search (triggers SuperSearch modal)
  - Profile (/profile)
  - Touch-friendly 44px minimum touch targets
  - Active state indicators

- **MobileMenu**: Hamburger slide-out menu (not currently used, but available)

#### Responsive Hooks
- **useMediaQuery**: Generic media query hook using matchMedia API
- **useIsMobile**: Convenience hook for mobile detection (< 768px)
- **useBreakpoint**: Multi-breakpoint detection (mobile, tablet, desktop)

#### Mobile Design Patterns
- Icon-only buttons on mobile with text on desktop (hidden md:inline pattern)
- Horizontal scrolling for cards and tabs
- Card-based layouts instead of tables on mobile
- Full-width buttons and controls on mobile
- Responsive padding and typography throughout
- Bottom padding on all pages to avoid fixed nav overlap
- Touch-friendly interactions (minimum 44px touch targets)

## Architecture

### Tech Stack
- **Frontend**: React, Wouter (routing), TanStack Query, Tailwind CSS, shadcn/ui
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL (Neon), Drizzle ORM
- **Authentication**: OIDC (Replit Auth)
- **Integrations**: SendGrid (email), RingCentral (phone), Outlook (calendar/email), Google Cloud Storage (object storage)

### Project Structure
```
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── bottom-nav.tsx          # Mobile bottom navigation
│   │   │   ├── mobile-menu.tsx         # Mobile hamburger menu
│   │   │   ├── super-search.tsx        # Mobile-optimized search
│   │   │   └── top-navigation.tsx      # Desktop/mobile top nav
│   │   ├── hooks/
│   │   │   ├── use-mobile.ts           # Mobile detection hooks
│   │   │   └── useMediaQuery.ts        # Generic media query hook
│   │   ├── pages/
│   │   │   ├── dashboard.tsx           # Mobile-responsive dashboard
│   │   │   ├── projects.tsx            # Mobile-responsive projects
│   │   │   ├── client-detail.tsx       # Mobile-responsive client detail
│   │   │   └── scheduled-services.tsx  # Mobile-responsive scheduled services
│   │   └── App.tsx
│   └── index.html
├── server/
│   ├── routes.ts         # API routes
│   ├── storage.ts        # Database storage interface
│   └── index.ts          # Express server
└── shared/
    └── schema.ts         # Shared types and schemas
```

### Responsive Breakpoints
- **Mobile**: < 768px (md: prefix in Tailwind)
- **Desktop**: >= 768px

### Database Schema
The application uses PostgreSQL with Drizzle ORM. Key tables:
- `users` - User accounts with OIDC authentication
- `clients` - Company/client information
- `people` - Individuals associated with clients
- `projects` - Project tracking
- `services` - Service definitions
- `client_services` - Client-service relationships
- `communications` - Communication log
- `documents` - Document storage metadata
- `dashboards` - Custom dashboard configurations
- `risk_assessments` - Risk assessments for client compliance (one-to-many with clients)
- `risk_assessment_responses` - Responses to risk assessment checklist questions

## Development

### Running the Application
```bash
npm run dev
```
This starts both the Express server and Vite development server on port 5000.

### Database Migrations
```bash
npm run db:push          # Push schema changes to database
npm run db:push --force  # Force push (for data-loss warnings)
```

### Key Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Express session secret
- `SENDGRID_API_KEY` - SendGrid email API key
- `RINGCENTRAL_*` - RingCentral phone integration credentials
- `GCS_*` - Google Cloud Storage credentials
- `ISSUER_URL` - OIDC authentication issuer

## Features

### Mobile-First Features (New)
- Touch-friendly navigation with bottom bar
- Full-screen search modal optimized for mobile
- Horizontal scrolling for cards and tabs
- Responsive typography and spacing
- Card-based layouts on mobile (vs tables on desktop)
- Icon-only buttons to save mobile screen space
- Proper bottom padding to avoid nav overlap

### Core Features
- Project management with kanban/list/dashboard views
- Client and contact management
- Service scheduling and tracking
- Communication logging (calls, emails, SMS)
- Document management with object storage
- Risk assessment and compliance tracking
- Custom dashboards with widgets
- Role-based access control
- Companies House integration for UK companies
- Real-time notifications

### Integrations
- **SendGrid**: Email sending and tracking
- **RingCentral**: VoIP calling and SMS
- **Outlook**: Calendar and email sync
- **Object Storage**: Document and file storage
- **Companies House**: UK company data lookup

## User Preferences
- Mobile-first responsive design
- Touch-friendly interactions
- App-like mobile experience
- Bottom navigation on mobile
- Horizontal scrolling where appropriate

## Testing
- E2E testing with Playwright
- Mobile viewport testing (375x667 - iPhone SE)
- Verified responsive layouts across breakpoints
- Touch interaction testing

## Notes
- Admin pages remain desktop-focused (accessed on larger screens only)
- All user-facing pages optimized for mobile
- Critical bug fix: Search modal no longer closes when typing on mobile
- Client Detail page uses horizontal scrollable tabs on mobile to maintain access to all sections
