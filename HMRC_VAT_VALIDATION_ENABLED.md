# HMRC VAT Validation Toggle

## Current Status
**SANDBOX MODE** - VAT validation is active and connected to HMRC sandbox environment for testing.

- Environment: `https://test-api.service.hmrc.gov.uk`
- Last tested: 30 November 2025
- Status: ✅ Working - OAuth authentication and VAT lookups confirmed

## Sandbox Test VAT Numbers
Use these VAT numbers to test in the sandbox:
- `553557881` - Returns valid company: "Credite Sberger Donal Inc."
- Other valid sandbox numbers can be found in HMRC Developer Hub documentation

## Purpose
This temporary toggle was implemented to allow VAT service functionality (UDF field creation, service assignment) to continue working while production HMRC API credentials are being set up.

## How It Works
When `HMRC_VAT_VALIDATION_ENABLED=false`:
- Users can still add VAT services to clients
- The "Validate" button remains visible and functional
- Clicking "Validate" returns an auto-accepted status (bypassed) without calling HMRC
- UI shows amber "Accepted" styling instead of green "Valid"
- All VAT data is stored with `bypassed: true` metadata for future reference
- Form submission proceeds normally

When `HMRC_VAT_VALIDATION_ENABLED=true` (or not set):
- Full HMRC VAT validation is active
- Real API calls are made to verify VAT numbers
- UI shows green "Valid" styling for verified numbers

## Re-enabling HMRC Validation

### Step 1: Ensure API Credentials Are Ready
Make sure your production HMRC VAT API credentials are configured:
- `HMRC_CLIENT_ID`
- `HMRC_CLIENT_SECRET`

### Step 2: Enable the Toggle
Set the environment variable to enable validation:
```
HMRC_VAT_VALIDATION_ENABLED=true
```

Or simply delete the `HMRC_VAT_VALIDATION_ENABLED` variable entirely (defaults to enabled).

### Step 3: Restart the Application
Restart the application for the changes to take effect.

### Step 4: Test the Integration
Test VAT validation with a known valid UK VAT number to confirm the HMRC API connection is working.

## Files Involved
- `server/hmrc-vat-service.ts` - Contains `isVatValidationEnabled()` function and validation logic
- `server/routes/services.ts` - API endpoints for VAT validation
- `client/src/pages/client-detail/components/services/AddServiceModal.tsx` - UI for adding VAT services
- `client/src/pages/client-detail/components/tabs/services/ServicesDataSubTab.tsx` - Display of VAT validation status

## Bypassed Records
Services assigned while validation was disabled have `bypassed: true` in their validation metadata. You may want to re-validate these after enabling HMRC validation:
1. Navigate to the client's service details
2. The VAT number field will show "Bypassed" status
3. Click "Validate" to perform actual HMRC validation

## Rollback
If issues occur after re-enabling, set `HMRC_VAT_VALIDATION_ENABLED=false` to return to bypassed mode.

## Switching from Sandbox to Production

Once HMRC approves your production credentials:

### Step 1: Update Environment Variables
Remove or update these development environment variables:
```
HMRC_API_BASE_URL=https://api.service.hmrc.gov.uk  (or remove to use default)
HMRC_AUTH_URL=https://api.service.hmrc.gov.uk/oauth/token  (or remove to use default)
```

### Step 2: Update Credentials
Replace sandbox credentials with production credentials:
- `HMRC_CLIENT_ID` - Your production client ID
- `HMRC_CLIENT_SECRET` - Your production client secret

### Step 3: Restart Application
Restart the application for changes to take effect.

### Step 4: Verify
Test with a real UK VAT number to confirm production access is working.

---

## HMRC VAT Sandbox API Test Results

**Test Date:** 2025-11-30T19:51:49.001Z

**Environment:** `https://test-api.service.hmrc.gov.uk`

**Total Requests Made:** 20

---

### Request 1

- **VAT Number Queried:** `553557881`
- **Timestamp:** 2025-11-30T19:51:49.003Z
- **Status:** ✅ Valid
- **Company Name:** Credite Sberger Donal Inc.
- **Address:** 131B Barton Hamlet
- **Postcode:** SW97 5CK
- **Validated At:** 2025-11-30T19:51:50+00:00

### Request 2

- **VAT Number Queried:** `123456789`
- **Timestamp:** 2025-11-30T19:51:50.444Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 3

- **VAT Number Queried:** `987654321`
- **Timestamp:** 2025-11-30T19:51:51.023Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 4

- **VAT Number Queried:** `111111111`
- **Timestamp:** 2025-11-30T19:51:51.693Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 5

- **VAT Number Queried:** `222222222`
- **Timestamp:** 2025-11-30T19:51:52.355Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 6

- **VAT Number Queried:** `333333333`
- **Timestamp:** 2025-11-30T19:51:52.999Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 7

- **VAT Number Queried:** `444444444`
- **Timestamp:** 2025-11-30T19:51:53.369Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 8

- **VAT Number Queried:** `555555555`
- **Timestamp:** 2025-11-30T19:51:54.057Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 9

- **VAT Number Queried:** `666666666`
- **Timestamp:** 2025-11-30T19:51:54.481Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 10

- **VAT Number Queried:** `777777777`
- **Timestamp:** 2025-11-30T19:51:55.133Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 11

- **VAT Number Queried:** `888888888`
- **Timestamp:** 2025-11-30T19:51:55.780Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 12

- **VAT Number Queried:** `999999999`
- **Timestamp:** 2025-11-30T19:51:56.168Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 13

- **VAT Number Queried:** `100000001`
- **Timestamp:** 2025-11-30T19:51:56.819Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 14

- **VAT Number Queried:** `200000002`
- **Timestamp:** 2025-11-30T19:51:57.468Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 15

- **VAT Number Queried:** `300000003`
- **Timestamp:** 2025-11-30T19:51:57.837Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 16

- **VAT Number Queried:** `400000004`
- **Timestamp:** 2025-11-30T19:51:58.221Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 17

- **VAT Number Queried:** `500000005`
- **Timestamp:** 2025-11-30T19:51:58.604Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 18

- **VAT Number Queried:** `600000006`
- **Timestamp:** 2025-11-30T19:51:59.250Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 19

- **VAT Number Queried:** `700000007`
- **Timestamp:** 2025-11-30T19:51:59.617Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

### Request 20

- **VAT Number Queried:** `800000008`
- **Timestamp:** 2025-11-30T19:52:00.298Z
- **Status:** ❌ Not Found
- **Error Code:** NOT_FOUND
- **Message:** VAT number not found in HMRC records.

---

## Test Summary

| Metric | Count |
|--------|-------|
| Total Requests | 20 |
| Valid VAT Numbers | 1 |
| Not Found | 19 |
| Errors | 0 |

---

*All 20 requests successfully made to HMRC VAT Check API sandbox environment on 30 November 2025. OAuth authentication working correctly. API responding as expected for both valid and invalid VAT numbers.*
