# HMRC VAT Validation Toggle

## Current Status
**DISABLED** - VAT validation is currently bypassed (API calls to HMRC are not being made)

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
