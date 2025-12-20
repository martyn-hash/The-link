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

```bash
# Login as default admin user
curl -X POST http://127.0.0.1:$PORT/api/dev-login \
  -H "Authorization: Bearer dev-test-token-2025" \
  -H "Content-Type: application/json" \
  -c cookies.txt

# Login as specific user
curl -X POST http://127.0.0.1:$PORT/api/dev-login \
  -H "Authorization: Bearer dev-test-token-2025" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com"}' \
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
4. **Navigate to correct paths**:
   - Project types: `/project-types`
   - Project type settings: `/settings/project-types/:id`
   - Clients: `/clients`
   - Client detail: `/clients/:id`

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
