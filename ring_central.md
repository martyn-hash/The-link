# RingCentral OAuth Integration Analysis - The Link

## 1. RELEVANT FILES & CODE LOCATIONS

### Backend (Server-Side)

| File | Purpose |
|------|---------|
| `server/utils/userRingCentralClient.ts` | Core SDK client, OAuth flow, token management, API wrappers |
| `server/routes/integrations.ts` (lines 193-503) | OAuth routes, SIP provision, call logging, transcription endpoints |
| `server/routes/routeHelpers.ts` (lines 95-114) | Validation schemas for RingCentral requests |
| `server/storage/integrations/integrationStorage.ts` | Database operations for `userIntegrations` table |

### Frontend (Client-Side)

| File | Purpose |
|------|---------|
| `client/src/components/ringcentral-phone.tsx` | WebRTC phone component for making/receiving calls |
| `client/src/pages/profile.tsx` (lines 226-365, 870-934) | Connect/disconnect UI in Integrations tab |
| `client/src/pages/client-detail/components/communications/dialogs/CallDialog.tsx` | Call dialog that embeds RingCentralPhone component |
| `client/src/pages/company-settings.tsx` (line 43) | `ringCentralLive` feature flag toggle |

### Configuration

| File | Purpose |
|------|---------|
| Secrets (via `view_env_vars`) | `RINGCENTRAL_CLIENT_ID`, `RINGCENTRAL_CLIENT_SECRET` exist as secrets |
| Environment | No `RINGCENTRAL_REDIRECT_URI` or `RINGCENTRAL_SERVER_URL` defined |

---

## 2. CURRENT REDIRECT URI LOGIC

**From `server/utils/userRingCentralClient.ts` (lines 19-33):**

```typescript
const getRedirectUri = () => {
  if (process.env.RINGCENTRAL_REDIRECT_URI) {
    return process.env.RINGCENTRAL_REDIRECT_URI;  // Not set
  }
  
  // Replit environment - use REPLIT_DEV_DOMAIN
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}/api/oauth/ringcentral/callback`;
  }
  
  // Default fallback
  return 'http://localhost:5000/api/oauth/ringcentral/callback';
};
```

### What the code generates:

| Environment Variable | Current Value | Generated Redirect URI |
|---------------------|---------------|------------------------|
| `REPLIT_DEV_DOMAIN` | `4ea1c809-0dc0-4747-b1ce-5e1cf8722099-00-1hasz19tdsmu5.worf.replit.dev` | `https://4ea1c809-0dc0-4747-b1ce-5e1cf8722099-00-1hasz19tdsmu5.worf.replit.dev/api/oauth/ringcentral/callback` |
| `APP_URL` | `https://flow.growth.accountants` | **Not used for RingCentral** |

### THE PROBLEM:

**Development vs. Production Mismatch:**

1. `REPLIT_DEV_DOMAIN` points to the Replit **development** URL (`.worf.replit.dev`)
2. Your production domain is `https://flow.growth.accountants`
3. **The code doesn't check for production** - it always uses `REPLIT_DEV_DOMAIN`

When running in production (deployed), `REPLIT_DEV_DOMAIN` may still be set, causing the redirect URI to point to the **development URL** instead of `flow.growth.accountants`.

---

## 3. CAUSE OF `invalid_grant` AND "Redirect URIs do not match" ERRORS

### Root Cause:

RingCentral requires the **exact same redirect URI** to be:
1. Registered in RingCentral Developer Console
2. Sent in the authorization request (`/restapi/oauth/authorize`)
3. Sent in the token exchange request (`platform.login({ code, redirect_uri })`)

**If any of these differ by even one character, you get:**
- `"Redirect URIs do not match"` - during authorization
- `"invalid_grant"` - during token exchange

### Likely Scenario:

The redirect URI registered in RingCentral Developer Console is probably:
- `https://flow.growth.accountants/api/oauth/ringcentral/callback` (production)

But your code is generating:
- `https://4ea1c809-0dc0-4747-b1ce-5e1cf8722099-00-1hasz19tdsmu5.worf.replit.dev/api/oauth/ringcentral/callback` (development)

---

## 4. COMPLETE LIST OF PROBLEMS

### Problem 1: Redirect URI Not Production-Aware
The `getRedirectUri()` function prioritizes `REPLIT_DEV_DOMAIN` over production `APP_URL`. There is no environment variable `RINGCENTRAL_REDIRECT_URI` set to override this.

### Problem 2: Missing Environment Variable
`RINGCENTRAL_REDIRECT_URI` is not configured. You need to explicitly set it for production.

### Problem 3: Server URL Default
`RINGCENTRAL_SERVER_URL` defaults to `SDK.server.production` which is correct for production, but if you're testing against sandbox, this won't work.

### Problem 4: No Transcription Webhook Handling
The transcription flow uses async processing via RingCentral AI API. The `requestCallTranscription` function in line 223-250 accepts an optional `webhookUrl`, but:
- No webhook endpoint is registered for transcription completion callbacks
- The only way to get transcription results is by polling `GET /api/ringcentral/transcript/:jobId`

### Problem 5: State Storage is In-Memory
The OAuth state map (`oauthStates`) on line 41 is in-memory. If the server restarts between authorization and callback, the state will be lost, causing "Invalid or expired OAuth state" errors.

---

## 5. STEP-BY-STEP FIX INSTRUCTIONS

### Step 1: Add `RINGCENTRAL_REDIRECT_URI` Environment Variable

In your Replit environment variables/secrets, add:

**For Production:**
```
RINGCENTRAL_REDIRECT_URI=https://flow.growth.accountants/api/oauth/ringcentral/callback
```

This matches your `APP_URL` and should be registered in RingCentral Developer Console.

### Step 2: Register the Redirect URI in RingCentral Developer Console

1. Log into [RingCentral Developer Console](https://developers.ringcentral.com/)
2. Go to your application
3. Under "OAuth Redirect URI", ensure this exact URL is registered:
   ```
   https://flow.growth.accountants/api/oauth/ringcentral/callback
   ```
4. If you also need development testing, add:
   ```
   https://4ea1c809-0dc0-4747-b1ce-5e1cf8722099-00-1hasz19tdsmu5.worf.replit.dev/api/oauth/ringcentral/callback
   ```

### Step 3: Set Proper Server URL (if using Sandbox)

If you're testing in sandbox environment, add:
```
RINGCENTRAL_SERVER_URL=https://platform.devtest.ringcentral.com
```

For production, don't set this (the default is correct).

### Step 4: Verify RingCentral OAuth Scopes

Your RingCentral app needs these OAuth scopes for full functionality:
- `RingOut` - For making outbound calls
- `ReadCallLog` - For reading call history
- `ReadCallRecording` - For accessing recordings
- `AI` - For transcription via RingCentral AI API
- `VoIP` - For WebRTC phone functionality
- `Glip` - If using messaging features

### Step 5: Test the Connection

1. In The Link, go to **Profile > Integrations tab**
2. Click **Connect** next to RingCentral
3. You should be redirected to RingCentral login
4. After authorizing, you should see "RingCentral Connected Successfully" page
5. The page auto-redirects to `/profile?tab=integrations` showing "Connected" status

---

## 6. WHAT'S ALREADY BUILT (FUNCTIONAL)

| Feature | Status | Notes |
|---------|--------|-------|
| OAuth Authorization URL Generation | Complete | `generateUserRingCentralAuthUrl()` |
| OAuth Callback Handler | Complete | `GET /api/oauth/ringcentral/callback` |
| Token Storage (Encrypted) | Complete | Uses `encryptTokenForStorage()` |
| Token Refresh | Complete | Auto-refreshes when expired |
| Disconnect Integration | Complete | `DELETE /api/oauth/ringcentral/disconnect` |
| Status Check | Complete | `GET /api/ringcentral/status` |
| SIP Provisioning | Complete | `POST /api/ringcentral/sip-provision` |
| WebRTC Phone Component | Complete | `RingCentralPhone` component |
| Make Outbound Calls | Complete | Uses `ringcentral-web-phone` SDK |
| Receive Inbound Calls | Complete | Event listener on `inboundCall` |
| Call Logging | Complete | `POST /api/ringcentral/log-call` |
| Request Transcription | Complete | `POST /api/ringcentral/request-transcript` |
| Get Transcription Result | Complete | `GET /api/ringcentral/transcript/:jobId` |
| Feature Flag Toggle | Complete | `ringCentralLive` in company settings |

---

## 7. WHAT'S MISSING / INCOMPLETE

### Critical Missing Items:

1. **Transcription Webhook Endpoint** - No POST endpoint to receive async transcription completion callbacks from RingCentral AI API

2. **Transcription UI** - No UI component to display transcription text on communication records

3. **Call Summary Generation** - No AI-powered call summary generation from transcriptions

4. **Persistent OAuth State** - State stored in memory, vulnerable to server restarts

### Nice-to-Have:

1. **Call Recording Playback UI** - The recording URL is fetched but not displayed in UI
2. **Transcription Auto-Polling** - Currently requires manual polling for transcription results

---

## 8. RECOMMENDATIONS

### Immediate Fixes (Required):

1. **Set `RINGCENTRAL_REDIRECT_URI` environment variable** to your production URL
2. **Register all redirect URIs in RingCentral Developer Console** (both dev and prod if needed)
3. **Test OAuth flow end-to-end** after configuration

### Short-Term Improvements:

1. **Add transcription webhook endpoint** at `/api/ringcentral/transcription-webhook`
2. **Store OAuth state in database** instead of in-memory Map
3. **Display transcription text** in communication detail view

### Long-Term Enhancements:

1. **AI call summarization** using GPT to summarize transcriptions
2. **Call recording audio player** in the UI
3. **Automatic transcription requests** after call completion

---

## Summary

The RingCentral integration is **architecturally complete** but has a **configuration mismatch** causing OAuth failures. The fix is straightforward:

1. Add `RINGCENTRAL_REDIRECT_URI=https://flow.growth.accountants/api/oauth/ringcentral/callback` to your environment
2. Ensure this exact URL is registered in RingCentral Developer Console
3. Test the OAuth flow

Once OAuth works, outbound calling and transcription requests will function as designed.
