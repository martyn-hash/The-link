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

## HMRC VAT Sandbox API Test Results (Official Test Numbers)

**Test Date:** 2025-11-30T20:06:45.736Z

**Environment:** `https://test-api.service.hmrc.gov.uk`

**Test Data Source:** [HMRC Official GitHub Repository](https://github.com/hmrc/vat-registered-companies-api/blob/main/public/api/conf/2.0/test-data/vrn.csv)

**Total Requests Made:** 20

---

### Request 1

- **VAT Number Queried:** `553557881`
- **Timestamp:** 2025-11-30T20:06:45.739Z
- **Status:** ✅ Valid
- **Company Name:** Credite Sberger Donal Inc.
- **Address:** 131B Barton Hamlet
- **Postcode:** SW97 5CK
- **Validated At:** 2025-11-30T20:06:46+00:00

### Request 2

- **VAT Number Queried:** `436189915`
- **Timestamp:** 2025-11-30T20:06:47.084Z
- **Status:** ✅ Valid
- **Company Name:** Phillia Communics Cor
- **Address:** 129A Drumfearn Road
- **Postcode:** HA60 4RO
- **Validated At:** 2025-11-30T20:06:47+00:00

### Request 3

- **VAT Number Queried:** `011591667`
- **Timestamp:** 2025-11-30T20:06:47.507Z
- **Status:** ✅ Valid
- **Company Name:** Lufthay
- **Address:** 104 Butler's Road
- **Postcode:** NG01 0ZM
- **Validated At:** 2025-11-30T20:06:47+00:00

### Request 4

- **VAT Number Queried:** `961925638`
- **Timestamp:** 2025-11-30T20:06:48.174Z
- **Status:** ✅ Valid
- **Company Name:** SABIC Fuel
- **Address:** 12 Torrisholme Road
- **Postcode:** CT84 7VH
- **Validated At:** 2025-11-30T20:06:48+00:00

### Request 5

- **VAT Number Queried:** `710882182`
- **Timestamp:** 2025-11-30T20:06:48.846Z
- **Status:** ✅ Valid
- **Company Name:** Louiss Shipponko
- **Address:** 121 Redcar Road East
- **Postcode:** MK29 5GQ
- **Validated At:** 2025-11-30T20:06:48+00:00

### Request 6

- **VAT Number Queried:** `792920366`
- **Timestamp:** 2025-11-30T20:06:49.240Z
- **Status:** ✅ Valid
- **Company Name:** Nippon Bankin
- **Address:** 42 Westmorland Place
- **Postcode:** TA98 3JT
- **Validated At:** 2025-11-30T20:06:49+00:00

### Request 7

- **VAT Number Queried:** `567152344`
- **Timestamp:** 2025-11-30T20:06:49.813Z
- **Status:** ✅ Valid
- **Company Name:** China Ltd.
- **Address:** 98 Swinston Hill Gardens
- **Postcode:** L22 8NY
- **Validated At:** 2025-11-30T20:06:50+00:00

### Request 8

- **VAT Number Queried:** `293129633`
- **Timestamp:** 2025-11-30T20:06:50.377Z
- **Status:** ✅ Valid
- **Company Name:** MS&AD Insurance
- **Address:** 82 Clemie Close
- **Postcode:** RM37 4KI
- **Validated At:** 2025-11-30T20:06:50+00:00

### Request 9

- **VAT Number Queried:** `036139833`
- **Timestamp:** 2025-11-30T20:06:51.043Z
- **Status:** ✅ Valid
- **Company Name:** Exxon Bradesco
- **Address:** 59 Wheelwrights Lane
- **Postcode:** LS40 7CO
- **Validated At:** 2025-11-30T20:06:51+00:00

### Request 10

- **VAT Number Queried:** `133431885`
- **Timestamp:** 2025-11-30T20:06:51.707Z
- **Status:** ✅ Valid
- **Company Name:** Bergy Health
- **Address:** 86 Tokio Gardens
- **Postcode:** WR15 2EW
- **Validated At:** 2025-11-30T20:06:51+00:00

### Request 11

- **VAT Number Queried:** `462794985`
- **Timestamp:** 2025-11-30T20:06:52.099Z
- **Status:** ✅ Valid
- **Company Name:** Communitex
- **Address:** 71B Sea Forth Drive
- **Postcode:** HS01 3QY
- **Validated At:** 2025-11-30T20:06:52+00:00

### Request 12

- **VAT Number Queried:** `051798906`
- **Timestamp:** 2025-11-30T20:06:52.756Z
- **Status:** ✅ Valid
- **Company Name:** Yance Shantari Holdings
- **Address:** 23 Elm Road West
- **Postcode:** HA96 5DF
- **Validated At:** 2025-11-30T20:06:53+00:00

### Request 13

- **VAT Number Queried:** `698814748`
- **Timestamp:** 2025-11-30T20:06:53.315Z
- **Status:** ✅ Valid
- **Company Name:** Arconic Inc.
- **Address:** 135 Blatchington Close
- **Postcode:** HX82 4EJ
- **Validated At:** 2025-11-30T20:06:53+00:00

### Request 14

- **VAT Number Queried:** `256676991`
- **Timestamp:** 2025-11-30T20:06:53.873Z
- **Status:** ✅ Valid
- **Company Name:** Améric Power
- **Address:** 100 Ashtree Mews
- **Postcode:** CB05 7UT
- **Validated At:** 2025-11-30T20:06:54+00:00

### Request 15

- **VAT Number Queried:** `494521394`
- **Timestamp:** 2025-11-30T20:06:54.327Z
- **Status:** ✅ Valid
- **Company Name:** Statoil Hess
- **Address:** 68 Croft Baker Way
- **Postcode:** DN56 0QJ
- **Validated At:** 2025-11-30T20:06:54+00:00

### Request 16

- **VAT Number Queried:** `486691505`
- **Timestamp:** 2025-11-30T20:06:54.991Z
- **Status:** ✅ Valid
- **Company Name:** Enel Engie
- **Address:** 16 Barnt Green Road
- **Postcode:** WD83 8EZ
- **Validated At:** 2025-11-30T20:06:55+00:00

### Request 17

- **VAT Number Queried:** `282415407`
- **Timestamp:** 2025-11-30T20:06:55.383Z
- **Status:** ✅ Valid
- **Company Name:** Banking Cathay
- **Address:** 140 Horton Street
- **Postcode:** ML69 7XA
- **Validated At:** 2025-11-30T20:06:55+00:00

### Request 18

- **VAT Number Queried:** `309335202`
- **Timestamp:** 2025-11-30T20:06:55.876Z
- **Status:** ✅ Valid
- **Company Name:** Old Fujitsub
- **Address:** 103 Mill Brooks
- **Postcode:** TN16 7VB
- **Validated At:** 2025-11-30T20:06:55+00:00

### Request 19

- **VAT Number Queried:** `775917660`
- **Timestamp:** 2025-11-30T20:06:56.238Z
- **Status:** ✅ Valid
- **Company Name:** Markets Mini Inc.
- **Address:** 100 Wren Hollow
- **Postcode:** TN65 7OJ
- **Validated At:** 2025-11-30T20:06:56+00:00

### Request 20

- **VAT Number Queried:** `726129090`
- **Timestamp:** 2025-11-30T20:06:56.912Z
- **Status:** ✅ Valid
- **Company Name:** Amers Sumi
- **Address:** 90 Fen Bight Circle
- **Postcode:** NN64 1LE
- **Validated At:** 2025-11-30T20:06:57+00:00

---

## Test Summary

| Metric | Count |
|--------|-------|
| Total Requests | 20 |
| Valid VAT Numbers | 20 |
| Not Found | 0 |
| Errors | 0 |

---

*All 20 requests successfully made to HMRC VAT Check API sandbox environment on 30 November 2025 using official HMRC test data. OAuth authentication working correctly. All VAT number lookups returned valid company data as expected.*
