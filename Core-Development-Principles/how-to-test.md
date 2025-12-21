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

### CRITICAL: Browser Launch WILL Trigger Server Restart

**This is expected behavior, not a bug.** Opening a Playwright browser session triggers the Vite development server's file watcher to restart the application. This happens EVERY time.

**The solution**: All health checks and test steps must happen AFTER the browser-induced restart completes. The test sequence must account for this restart.

### Mandatory Test Sequence (NON-NEGOTIABLE)

Follow these steps **exactly in order**. Do NOT skip any step.

#### Phase 1: Create Browser Context and Trigger Restart

**Step 1: Create browser context**
```
[New Context] Create a new browser context
```
- This will trigger a server restart via Vite HMR
- Do NOT navigate anywhere yet
- Do NOT make any API calls yet

**Step 2: Wait for restart to complete**
```
[Wait] Wait 30 seconds
```
- This delay allows the server restart to complete
- Do NOT navigate or make API calls during this wait
- This is the most critical step - skipping it causes all subsequent steps to fail

#### Phase 2: Post-Restart Health Checks

**Step 3: Verify internal readiness**
```
[API] GET /readyz - expect 200 with status "ready"
```
- Capture the `boot_id` value (call it STABLE_BOOT_ID)
- If status is "not_ready", wait 5 seconds and retry (max 12 retries = 60 seconds)
- If still not ready after 60 seconds: STOP and report "Blocked: server failed to become ready after restart"

**Step 4: Verify external readiness**
```
[API] GET https://4ea1c809-0dc0-4747-b1ce-5e1cf8722099-00-1hasz19tdsmu5.worf.replit.dev/readyz
```
- Verify `boot_id` matches STABLE_BOOT_ID from Step 3
- If boot_id differs, the server restarted again - go back to Step 2 (wait 30 seconds)
- If external is not ready, wait 5 seconds and retry (max 12 retries)

#### Phase 3: Authentication and Testing

**Step 5: Authenticate**
```
[API] POST /api/dev-login with header "Authorization: Bearer dev-test-token-2025"
```
- Expect 200 response
- Session cookies are now set

**Step 6: Navigate and test**
```
[Browser] Navigate to the target page
[Verify] Verify page content and take screenshots
```
- All actual test steps happen here, AFTER the restart has completed

### Failure Handling

**If navigation fails with 502 or "couldn't reach this app"**:
1. Check `/readyz` - if boot_id changed, server restarted again
2. If restarted: wait 30 seconds, poll `/readyz` until ready, then retry navigation
3. If boot_id unchanged but still 502: wait 10 seconds, retry ONCE
4. If second attempt fails: STOP and report "Blocked: proxy instability"

**If browser context creation fails with "Browser closed"**:
- This is an infrastructure issue, not a test issue
- Report "Blocked: Playwright browser unavailable" and stop

### Standard Test Plan Template (UPDATED)

```
1. [New Context] Create a new browser context
   - This triggers a server restart - DO NOT PANIC

2. [Wait] Wait 30 seconds for server restart to complete
   - Do nothing during this wait - no navigation, no API calls

3. [API] GET /readyz - poll until status "ready" (max 60 seconds)
   - Capture boot_id as STABLE_BOOT_ID

4. [API] GET external /readyz - verify boot_id matches STABLE_BOOT_ID
   - If boot_id differs, go back to step 2

5. [API] POST /api/dev-login with header "Authorization: Bearer dev-test-token-2025"
   - Expect 200, session cookies will be set

6. [Browser] Navigate to the target page (e.g., /campaigns, /clients)

7. [Verify] Verify page content and take screenshots as needed
```

### Why This Works

1. **Step 1** creates the browser context, which triggers Vite HMR restart
2. **Step 2** waits for the restart to complete (this is the key insight)
3. **Steps 3-4** verify the NEW server instance is ready (not the old one)
4. **Steps 5-6** run against the stable, post-restart server

Previous failures happened because tests tried to use the pre-restart server state, which became invalid the moment the browser connected.

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
| 2025-12-21 | **MAJOR UPDATE**: Rewrote testing agent instructions | Browser launch WILL trigger restart - tests must wait 30s after context creation, then poll /readyz before proceeding |
