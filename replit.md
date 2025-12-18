# The Link - CRM & Project Management Application

## Overview
The Link is a full-stack CRM and project management application for accounting and bookkeeping firms. Its core purpose is to automate recurring service delivery, streamline client relationship management, and provide a secure client portal. It aims to boost efficiency and client satisfaction through features like intelligent scheduling, automated project generation, Companies House integration, and a mobile-first user experience within a multi-tenant architecture. The project emphasizes improving firm operations and client engagement, recognizing its market potential and ambitious goals.

## User Preferences
Preferred communication style: Simple, everyday language.

## Testing Credentials

**HOW TO LOGIN (IMPORTANT):**
1. Go to root page (/)
2. Click on "Passwords" tab (NOT Replit Auth)
3. Enter: admin@example.com | admin123

- **Login page**: Root page (/) → Passwords tab
- **Admin user**: admin@example.com | admin123

Note: The login page has multiple auth methods. For development testing, always use the "Passwords" tab.

## System Architecture

### UI/UX
The UI/UX is inspired by modern SaaS platforms, using a specific brand palette and DM Sans font. Design principles include increased spacing, soft modern shadows, and consistent 1rem border-radius. Components are mobile-first, responsive, and follow a consistent layout with standardized headers, body regions, and tab-based designs. Full-width layouts are used for data-heavy pages, while detail and form pages are centered.

### Technical Implementation
The frontend uses React, TypeScript, Wouter for routing, TanStack Query for server state management, and `shadcn/ui` with Tailwind CSS for styling. The backend is an Express.js server in TypeScript, providing a modular RESTful API with middleware for authentication, authorization, and validation. It handles service mapping, project creation, sophisticated scheduling with UTC normalization, and comprehensive audit trails. A nightly scheduler automates project generation. The storage layer employs 52 domain-focused modules using a facade pattern. Performance is optimized with batch operations, optimistic updates, background prefetching, and state persistence.

### Feature Specifications
The system includes advanced communication tools like RingCentral VoIP integration with AI transcription, AI Magic Call/SMS, email image pasting, and SMS Templates. It supports shared Outlook inbox access via Microsoft Graph API with granular permissions and a dedicated Comms Workspace. MS Calendar integration allows viewing and creating calendar events (with Teams meeting support) for authorized users, with shared calendar access managed by super admins. Project management features include a dynamic "Client Also Has" filter, Tasks filter ownership permissions, and Bookkeeping Query Grouping. A drag-and-drop Pivot Table builder is available for data analysis. The system also features a multi-channel outbound campaign system with client-first targeting, personalized action pages, and comprehensive analytics, supporting email (SendGrid), SMS (VoodooSMS), and Voice (Dialora.ai). This campaign system includes a 7-step creation wizard, multi-step campaign sequences, and detailed analytics.

### Query Reminder System Resilience
The query reminder service (`server/services/queryReminderService.ts`) includes fail-fast validation to catch schema mismatches early. Key features:
-   **validateSelectColumns()**: Validates all Drizzle select column definitions before query execution, surfacing clear error messages like "Invalid select column: X" instead of cryptic Drizzle stack traces.
-   **markReminderFailed()**: Marks individual reminders as failed in the database without crashing the entire cron job, allowing other reminders to proceed.
-   **Individual error isolation**: Each reminder is processed in a try/catch block so one failure doesn't prevent other reminders from being sent.

### RingCentral Token Resilience (December 2024)
The RingCentral integration (`server/utils/userRingCentralClient.ts`) includes automatic token management to prevent expired refresh tokens:
-   **Auto-disconnect on expiry**: When a refresh token fails with "Token is expired", the integration is automatically disconnected and the user is prompted to re-authenticate.
-   **RingCentralReauthRequiredError**: Custom error class that triggers proper 401 responses with `reauthRequired: true` flag for frontend handling.
-   **lastUsedAt tracking**: Token usage is tracked in integration metadata to detect potentially stale connections (not used in 7+ days).
-   **Proactive token refresh**: Daily cron job at 03:30 UTC (`RingCentralTokenRefresh`) refreshes tokens for integrations not used in the last 5 days to prevent 7-day refresh token expiry.
-   **Status endpoint enhancement**: `/api/ringcentral/status` now returns `mayBeStale` flag to warn users before tokens expire.

### Client Project Tasks
The Client Project Tasks system enables service owners to send customizable pre-work checklists to clients via token-based forms. Key features:
-   **Template Management**: Create reusable task templates at project type level with various question types (short text, long text, email, number, date, single/multiple choice, file upload).
-   **Client-Level Overrides**: Customize templates per client with additional questions or modified settings.
-   **Conditional Logic**: Dynamic form questions that appear/hide based on previous answers.
-   **Automated Stage Changes**: Projects automatically progress to next stage when tasks are completed.
-   **Notification Integration**: Task notifications can include template attachments.
-   **OTP Security (Optional)**: Email verification with 6-digit one-time passwords before form access. OTP codes stored in database (`client_project_task_otps` table), expire after 10 minutes, with automatic resend functionality. In development mode (no SendGrid), codes are logged to console.

### System Design
The application uses PostgreSQL (Neon) with Drizzle ORM for data persistence, employing UUIDs, soft deletes, and JSONB fields. Google Cloud Storage (via Replit App Storage) manages object storage with secure signed URLs. Authentication for staff uses Replit Auth (OIDC) with session-based, role-based access control, while the client portal uses passwordless email verification. The multi-tenant system emphasizes modularity, extensive database indexing, and a resilient project scheduling orchestrator. Additional features include UK eIDAS-compliant electronic signatures, workflow and status management with Kanban views, AI Audio Transcription, AI-assisted client value notifications, Zapier integration, and an enhanced data import system. A user-friendly error handling system is also implemented.

## External Dependencies

### Third-Party Services
-   **Companies House API**: UK company data integration.
-   **Microsoft Graph API**: Email and calendar access.
-   **RingCentral**: VoIP phone system.
-   **SendGrid**: Transactional email and email campaigns.
-   **VoodooSMS**: Client SMS delivery and SMS campaigns.
-   **Dialora.ai**: AI-powered voice call reminders and voice campaigns.
-   **OpenAI API**: Audio transcription (Whisper), AI text processing (GPT-4o-mini), and AI Magic Assistant.
-   **Replit Platform Services**: Object storage, authentication, and deployment.

### Frontend Libraries
-   **UI Components**: `@radix-ui/*`, `@dnd-kit/*`, `@tiptap/*`, `react-hook-form` with `zod`, `sonner`.
-   **Utilities**: `date-fns`, `clsx`, `tailwind-merge`, `@getaddress/autocomplete`.

## Cron Job Telemetry & Scheduling

### Architecture (Updated December 2024)

**Dual-Process Architecture**: The application runs as two separate processes:
1. **Web Server** (`server/index.ts`): Handles HTTP requests only, no cron scheduling
2. **Cron Worker** (`server/cron-worker.ts`): Handles all scheduled background jobs

This separation prevents heavy cron jobs from blocking web requests and vice versa.

**Process Configuration**:
- Development: Configured via Replit Workflows (parallel mode running both `tsx server/index.ts` and `tsx server/cron-worker.ts`)
- Production: Uses Reserved VM deployment with custom run command (see Production Deployment section)
- Database pools are isolated: Web (15 connections), Cron (8 connections)

## Production Deployment

### Deployment Steps

1. **Click "Publish" button** in the Replit workspace (top right)

2. **Select "Reserved VM"** deployment type
   - This is required for dual-process architecture (web + cron worker)
   - Autoscale deployments only run one process per instance

3. **Configure Build Command** (if not already set):
   ```bash
   npm run build
   ```

4. **Configure Run Command**:
   ```bash
   NODE_ENV=production node dist/index.js & NODE_ENV=production npx tsx server/cron-worker.ts & wait
   ```
   This starts both the web server (compiled) and cron worker in parallel.
   
   Alternative using tsx for both (slower startup, but consistent):
   ```bash
   NODE_ENV=production npx tsx server/index.ts & NODE_ENV=production npx tsx server/cron-worker.ts & wait
   ```

5. **Set Machine Power**: Choose based on client load
   - 0.5 vCPU / 512MB: Light usage (<50 clients)
   - 1 vCPU / 1GB: Medium usage (50-200 clients)
   - 2 vCPU / 2GB: Heavy usage (200+ clients)

6. **Verify Secrets**: Ensure all production secrets are configured:
   - DATABASE_URL (production Neon database)
   - All third-party API keys (SendGrid, RingCentral, etc.)

7. **Click "Publish"** to deploy

### Post-Deployment Verification

1. **Check web server**: Visit your deployed URL, confirm login works
2. **Check cron worker**: Look for `[CronTelemetry] Process role set to: cron-worker` in logs
3. **Monitor cron jobs**: Search logs for `[CronTelemetry:JSON]` to see structured telemetry

### Emergency Controls

- **Disable all crons**: Set `CRONS_ENABLED=false` in Secrets (no redeploy needed)
- **Rollback**: Use Replit's checkpoint system to restore previous version

**Process Role Telemetry**: All logs include `process_role` tag ("web" or "cron-worker") for filtering.

### Overview
The application uses node-cron for scheduling background jobs. A comprehensive telemetry system (`server/cron-telemetry.ts`) monitors job execution, detects drift, coordinates distributed execution, and handles errors with automatic retries.

### Key Features
-   **Event Loop Monitoring**: 20ms resolution delay histogram (min, p50, p95, max) reported every 5 minutes.
-   **Drift Detection**: Accurate drift calculation using cron-parser to find expected tick vs actual start time.
-   **Job Overlap Detection**: Tracks concurrent jobs via run IDs to detect resource contention.
-   **Distributed Locking**: PostgreSQL advisory locks prevent duplicate execution in autoscaled deployments. All side-effect jobs use `useLock: true`.
-   **Automatic Retries**: 2 retries with exponential backoff (1s, 2s, 4s) on failure. Errors never crash the process.
-   **Structured JSON Telemetry**: Each job emits `[CronTelemetry:JSON] {...}` with actionable metrics.

### JSON Telemetry Schema
```json
{
  "job_name": "string",
  "run_id": "string",
  "timestamp": "ISO8601",
  "status": "started|success|error|skipped|retrying",
  "drift_ms": 0,
  "duration_ms": 0,
  "lock_acquired": true,
  "lock_wait_ms": 0,
  "retry_count": 0,
  "error_message": "string",
  "event_loop": { "p50_ms": 0, "p95_ms": 0, "max_ms": 0 },
  "memory": { "heap_used_mb": 0, "heap_total_mb": 0, "rss_mb": 0 },
  "process_uptime_sec": 0,
  "concurrent_jobs": ["JobA", "JobB"]
}
```

### Schedule Staggering (UK Timezone)
Heavy jobs are staggered to avoid collisions:
-   **HH:02, :32**: Project Message Reminders (every 30 min, locked)
-   **HH:02**: Dashboard Cache (hourly, locked)
-   **HH:04, :19, :34, :49**: Reminder Notifications (locked)
-   **HH:08, :23, :38, :53**: Sent Items Detection (every 15 min during 08:00-19:00, locked)
-   **HH:10**: Query Reminder (hourly, locked)
-   **HH:14, :29, :44, :59**: SLA Breach Detection (locked)
-   **04:20, 08:45, 12:25, 15:25**: View Cache runs (locked)
-   Heavy jobs (Dashboard Cache, View Cache) are 43+ minutes apart.

### Timeout Protection
Heavy jobs are wrapped with execution timeouts to prevent runaway execution:
-   **Cache rebuilds**: 60 second timeout
-   **Detection jobs**: 45 second timeout  
-   **Notification jobs**: 30 second timeout
-   Jobs log warnings when using >80% of their time budget.

### Usage
Wrap cron handlers with `wrapCronHandler(name, expression, handler, options)` for automatic telemetry, error handling, and retries:
```typescript
wrapCronHandler('JobName', '0 * * * *', async () => {
  // Job logic - no try/catch needed
}, { useLock: true, timezone: 'Europe/London', maxRetries: 2 })
```

All side-effect jobs (notifications, reminders, sync, etc.) use `useLock: true` for distributed coordination.