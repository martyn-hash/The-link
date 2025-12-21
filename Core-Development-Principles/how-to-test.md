# How to Test - Testing Runbook

## Purpose

This runbook ensures the app is reachable and ready before browser tests. Following this guide prevents the recurring "couldn't reach this app" failures.

## Preconditions

### Workflow Commands

The application runs with these workflow commands:

- **Web server**: `PROCESS_ROLE=web NODE_ENV=development tsx server/index.ts`
- **Cron worker**: `PROCESS_ROLE=cron-worker NODE_ENV=development tsx server/cron-worker.ts`

### Boot Time

The app is multi-process. Allow **10-15 seconds** for full boot, especially when database needs to warm up.

## Quick "Is it up?" Checklist (Internal)

Run these commands to verify the app is running:

```bash
# Check what port the app should be on
echo $PORT

# Check if server is listening (immediate response expected)
curl -I http://127.0.0.1:$PORT/healthz

# Check if app is fully initialized (may take a few seconds after boot)
curl -I http://127.0.0.1:$PORT/readyz
```

### Expected Results

| Endpoint | Expected Status | Meaning |
|----------|----------------|---------|
| `/healthz` | 200 | Server is listening and accepting connections |
| `/readyz` | 200 | App is fully initialized and ready for tests |
| `/readyz` | 503 | App is still initializing (wait and retry) |

### Using the Wait Script

For automated waiting:

```bash
./scripts/wait-for-ready.sh 60  # Wait up to 60 seconds
```

## External Reachability Checklist

After internal checks pass, verify external access:

1. Hit the public Replit URL:
   - `/healthz` should return 200 immediately
   - `/readyz` should return 200 after boot completes

**Important**: Internal curl success alone is NOT proof of external reachability. The Replit proxy layer must also be working.

## Golden Rule for Browser Tests

**Do NOT start browser tests until `/readyz` returns 200.**

If tests report "couldn't reach this app", follow the troubleshooting tree below.

## Troubleshooting Tree

### 1. `/healthz` fails internally

**Symptoms**: `curl http://127.0.0.1:$PORT/healthz` times out or refuses connection

**Causes**:
- Server not started
- Wrong port (check `$PORT` matches what server is using)
- Server crashed during startup

**Fix**:
- Check workflow logs for errors
- Confirm `server.listen()` uses `host: "0.0.0.0"` and `port: $PORT`
- Look for `BOOT_STATE=web_listening` in logs

### 2. `/healthz` works internally but fails externally

**Symptoms**: curl works locally, but browser/test agent gets 502

**Causes**:
- Server bound to `127.0.0.1` instead of `0.0.0.0`
- Port mismatch between app and Replit proxy
- Replit proxy transient issue

**Fix**:
- Confirm logs show: `READY host=0.0.0.0 port=<PORT>`
- Verify `.replit` file has correct port configuration
- Restart workflow and wait for full boot

### 3. `/healthz` works but `/readyz` doesn't

**Symptoms**: `/healthz` returns 200, but `/readyz` returns 503 indefinitely

**Causes**:
- Startup tasks are hanging (database issue, slow external service)
- Startup timeout not configured

**Fix**:
- Check logs for `BOOT_STATE=` transitions
- Look for stuck `BOOT_STATE=initialising_background`
- If stuck > 60s, app should auto-exit (startup timeout)

### 4. Ready is OK but UI route fails

**Symptoms**: Health checks pass but navigating to app pages fails

**Causes**:
- Routing issue (wrong path)
- Feature flag blocking access
- Authentication required

**Note - Correct Routes**:
- Project types list: `/project-types` (NOT `/admin/project-types`)
- Project type detail: `/settings/project-types/:id`
- Clients list: `/clients`
- Client detail: `/clients/:id`

## Dev Login Endpoint (Fast Auth for Testing)

In development mode, a special `/api/dev-login` endpoint is available that bypasses the login form.

### Usage

**Browser URL (redirects to dashboard):**
```
https://YOUR-REPLIT-URL/api/dev-login?token=dev-test-token-2025
```

Example:
```
https://4ea1c809-0dc0-4747-b1ce-5e1cf8722099-00-1hasz19tdsmu5.worf.replit.dev/api/dev-login?token=dev-test-token-2025
```

**curl (API style, returns JSON):**
```bash
# Login and get JSON response (pass redirect=none to skip redirect)
curl -X POST http://127.0.0.1:$PORT/api/dev-login \
  -H "Authorization: Bearer dev-test-token-2025" \
  -H "Content-Type: application/json" \
  -d '{"redirect": "none"}' \
  -c cookies.txt
```

### Security Notes

- **Only available when NODE_ENV !== 'production'**
- Requires `DEV_LOGIN_TOKEN` environment variable (or uses default)
- All uses are logged with IP and user ID
- The session cookies work exactly like regular login

### For Browser Tests

The testing agent can call this API endpoint before navigating to authenticated pages, eliminating the need to interact with the login form.

## Standard Browser Test Steps (Manual Login)

For situations where the dev-login endpoint cannot be used:

1. **Wait for readiness**: Verify `/readyz` returns 200
2. **Navigate to root**: Go to `/`
3. **Login**: 
   - Click "Passwords" tab
   - Enter: `admin@example.com` / `admin123`
   - Submit login form


## Instructions for Testing Agent (Browser Tests)

When running browser tests via the `run_test` tool, follow these steps:

### E2E Mode: Production-Like Testing Environment

**How It Works**: When `E2E=1` is set, the server skips Vite/HMR entirely and serves pre-built static assets. This eliminates browser-triggered server restarts - the root cause of test instability.

**Key Principle**: Don't "wait and pray" - run in E2E mode where restarts don't happen.

### Pre-Test Setup (ONE TIME per test session)

Before running any browser tests, ensure:

1. **Frontend is built**: `npm run build`
2. **Server is running with E2E=1**: The workflow should use `E2E=1` environment variable

If the build is missing, the server will exit with:
```
[E2E] Build not found at dist/public. Run 'npm run build' first.
```

### Mandatory Test Sequence

#### Step 1: Create browser context
```
[New Context] Create a new browser context
```
- Safe in E2E mode: no Vite/HMR restart will occur

#### Step 2: Verify external readiness (3 consecutive 200s)
```
[API] Poll GET /readyz until 3 consecutive 200 responses
```
- Wait 2 seconds between checks
- Max 30 retries (60 seconds total)
- This guards against Replit proxy flaps
- Capture `boot_id` from the stable response

#### Step 3: Authenticate
```
[API] POST /api/dev-login with header "Authorization: Bearer dev-test-token-2025"
```
- Expect 200 response
- Session cookies are now set

#### Step 4: Navigate and test
```
[Browser] Navigate to the target page
[Verify] Verify page content and take screenshots
```

### Standard Test Plan Template (E2E Mode)

```
1. [New Context] Create a new browser context
   - Safe: no Vite/HMR restart will occur in E2E mode

2. [API] Poll GET /readyz until 3 consecutive 200 responses (2s apart, max 30 retries)
   - Capture boot_id from the stable response

3. [API] POST /api/dev-login with header "Authorization: Bearer dev-test-token-2025"
   - Expect 200, session cookies will be set

4. [Browser] Navigate to the target page (e.g., /campaigns, /clients)

5. [Verify] Verify page content and take screenshots as needed
```

### Failure Handling

| Symptom | Cause | Action |
|---------|-------|--------|
| "Not Found" / blank page | Build is stale | Run `npm run build` |
| boot_id changed mid-test | Real stability bug | Investigate (not test flakiness) |
| 502 after consecutive 200s | Replit proxy instability | Retry once, then report blocked |
| "Browser closed" | Playwright infrastructure | Report blocked, stop testing |

### Key Principles

1. **Any restart in E2E mode is a real bug** - not test flakiness
2. **External /readyz must be stable** - 3 consecutive 200s, not just one
3. **Stale build = broken test** - always verify build is current
4. **Don't wait and pray** - E2E mode eliminates the problem at the source

### Correct Route Paths (IMPORTANT)

These are the actual routes - do NOT use `/admin/` prefixes:

| Page | Correct Path | Wrong Path |
|------|-------------|------------|
| Project types list | `/project-types` | `/admin/project-types` |
| Project type detail | `/settings/project-types/:id` | N/A |
| Clients list | `/clients` | `/admin/clients` |
| Client detail | `/clients/:id` | N/A |

### Authentication Options

**Option 1: API dev-login (preferred)**
```
[API] POST /api/dev-login with Authorization: Bearer dev-test-token-2025
```

**Option 2: Manual login (fallback)**
```
[Browser] Navigate to /
[Browser] Click "Passwords" tab
[Browser] Enter admin@example.com and admin123
[Browser] Click submit
```

### Troubleshooting Test Failures

If tests fail with "couldn't reach this app":
1. Verify `/healthz` responds (server is running)
2. Verify `/readyz` responds with 200 (app is ready)
3. If both pass but tests still fail, it may be a transient Replit proxy issue - retry once

## Boot State Log Reference

The server logs these states during startup:

| State | Meaning |
|-------|---------|
| `BOOT_STATE=starting` | Process starting |
| `BOOT_STATE=web_listening` | Server bound to port, accepting connections |
| `BOOT_STATE=initialising_background` | Running deferred startup tasks |
| `BOOT_STATE=ready` | App fully initialized, `/readyz` will return 200 |

## What Changed Recently

_This section tracks changes affecting tests. Update when making relevant changes._

| Date | Change | Impact |
|------|--------|--------|
| 2025-12-20 | Added `/healthz`, `/readyz` endpoints | Tests should wait for `/readyz` |
| 2025-12-20 | Added `BOOT_STATE` logging | Easier debugging of startup issues |
| 2025-12-20 | Added startup timeout (60s) | Server exits if not ready in time |
| 2025-12-20 | Added `scripts/wait-for-ready.sh` | Automated readiness waiting |
| 2025-12-20 | Added `/api/dev-login` endpoint | Fast auth for testing, bypasses login form |
| 2025-12-20 | Added "Instructions for Testing Agent" section | Explicit browser test steps |
| 2025-12-20 | Added mandatory external readiness gate | Browser tests MUST wait for public URL `/readyz` before starting |
| 2025-12-20 | Added Proxy Error Retry Protocol | Wait 5-10s and retry once if first navigation fails after readyz passed |
| 2025-12-20 | Added `boot_id` to `/readyz` response | Detects app restarts between health checks and browser session launch |
| 2025-12-20 | Added Boot ID Stability Check section | Documents how to verify app didn't restart during test setup |
| 2025-12-21 | **MAJOR UPDATE**: Added E2E mode | Set `E2E=1` to skip Vite/HMR and serve built assets - eliminates browser-triggered restarts entirely |
