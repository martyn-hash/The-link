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

### Mandatory Pre-Test Sequence (NON-NEGOTIABLE)

Before starting **any** browser test (`run_test`), you MUST perform the following steps **in order**:

#### Step 1: Internal Readiness Check (capture boot_id)
```bash
curl -s http://127.0.0.1:$PORT/readyz
```
- Expect HTTP 200 with `{"status":"ready","boot_id":"<ID>","uptime_ms":<N>}`
- **Capture the `boot_id` value** - you will need it later
- If this fails, STOP and fix the app startup

#### Step 2: External (Public) Readiness Check — REQUIRED
```bash
# Poll the public Replit URL - retry every 2 seconds, timeout after 60 seconds
for i in {1..30}; do
  if curl -sf https://4ea1c809-0dc0-4747-b1ce-5e1cf8722099-00-1hasz19tdsmu5.worf.replit.dev/readyz; then
    echo "External readiness OK"
    break
  fi
  sleep 2
done
```
- Expect HTTP 200 with `{"status":"ready","boot_id":"<ID>"}`
- **Verify `boot_id` matches the internal check** - if different, the app restarted between checks
- If this does NOT return 200 within 60 seconds:
  - DO NOT start browser tests
  - Record failure as **"Blocked: external Replit proxy not ready"**
  - Do NOT retry browser tests automatically
  - Report status and stop

#### Step 3: Proceed with Browser Tests
Only after BOTH internal AND external readiness checks pass with matching `boot_id`:
1. Authenticate via API: `POST /api/dev-login` with `Authorization: Bearer dev-test-token-2025`
2. Start browser navigation and verification steps

### Critical Rules

- **Internal readiness alone is NOT sufficient**
- Browser tests must never be used to "probe" app availability
- Do not restart the workflow unless explicitly instructed

### Proxy Error Retry Protocol

If external `/readyz` returns 200 but the **first browser navigation** fails with a proxy error (502 / "couldn't reach this app"):

1. **Wait 5–10 seconds** before retrying
2. **Retry the browser test ONCE only**
3. If the **second attempt also fails**:
   - STOP testing immediately
   - Record failure as **"Blocked: proxy instability detected"**
   - Do NOT retry further
   - Report the failure and stop

### Rationale

We have confirmed repeated false failures caused by transient Replit proxy routing.
This gate exists to separate **infrastructure availability** from **application correctness**.

A browser test that starts before external `/readyz` is green is invalid by definition.

### Boot ID Stability Check (Detecting Browser-Induced Restarts)

**Problem Discovered**: Opening a browser session can sometimes trigger the development server's file watcher to restart the app. This means health checks pass, but by the time the browser connects, the app is mid-restart and returns 502.

**Solution**: The `/readyz` endpoint now includes a `boot_id` field - a unique identifier generated once at startup.

**How to verify stability**:

1. **Before browser opens**: Capture `boot_id` from `/readyz`
2. **After browser session starts**: Check `/readyz` again
3. **Compare**: If `boot_id` changed, the app restarted and pre-checks are invalid

```bash
# Example: Capture boot_id before and after
BOOT1=$(curl -s http://127.0.0.1:$PORT/readyz | jq -r '.boot_id')
# ... browser session opens ...
BOOT2=$(curl -s http://127.0.0.1:$PORT/readyz | jq -r '.boot_id')

if [ "$BOOT1" != "$BOOT2" ]; then
  echo "WARNING: App restarted during browser launch (boot_id changed)"
  echo "  Before: $BOOT1"
  echo "  After:  $BOOT2"
fi
```

**If boot_id changes**:
- The pre-test health checks are stale
- Wait for the new boot to complete (poll `/readyz` until 200)
- Re-verify external `/readyz` with matching `boot_id`
- Then proceed with browser tests

This ensures health checks remain meaningful even when browser session launch triggers restarts.

### Standard Test Plan Template

```
1. [New Context] Create a new browser context

2. [API] GET /readyz to confirm app is ready - expect 200 with status "ready"

3. [API] POST /api/dev-login with header "Authorization: Bearer dev-test-token-2025" 
   - Expect 200, session cookies will be set automatically

4. [Browser] Navigate to the target page (e.g., /project-types, /clients)

5. [Verify] Verify page content and take screenshots as needed
```

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
