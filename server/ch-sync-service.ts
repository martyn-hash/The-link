import { storage } from "./storage/index";
import { companiesHouseService } from "./companies-house-service";
import type { Client, ChChangeRequest } from "../shared/schema";

// Companies House API data structure
interface ChApiData {
  companyNumber: string;
  nextAccountsPeriodEnd: Date | null;
  nextAccountsDue: Date | null;
  confirmationStatementNextDue: Date | null;
  confirmationStatementNextMadeUpTo: Date | null;
  companyStatusDetail: string | null;
  registeredAddress1: string | null;
  registeredAddress2: string | null;
  registeredAddress3: string | null;
  registeredPostcode: string | null;
  registeredCountry: string | null;
}

// CH fields that we monitor for changes (date fields)
const CH_MONITORED_FIELDS = [
  'nextAccountsPeriodEnd',
  'nextAccountsDue', 
  'confirmationStatementNextDue',
  'confirmationStatementNextMadeUpTo'
] as const;

type ChMonitoredField = typeof CH_MONITORED_FIELDS[number];

// Special field name for combined address tracking
const ADDRESS_FIELD_NAME = 'registeredOfficeAddress';

/**
 * Format address components into a single displayable string
 */
function formatAddress(
  address1: string | null | undefined,
  address2: string | null | undefined,
  address3: string | null | undefined,
  postcode: string | null | undefined,
  country: string | null | undefined
): string | null {
  const parts = [address1, address2, address3, postcode, country]
    .filter(Boolean)
    .map(s => s?.trim())
    .filter(s => s && s.length > 0);
  
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Fetch data from Companies House API
 */
async function fetchChData(companyNumber: string): Promise<ChApiData | null> {
  console.log(`[CH Sync] Fetching data for company: ${companyNumber}`);
  
  try {
    const profile = await companiesHouseService.getCompanyProfile(companyNumber);
    
    // Log raw API response for debugging data accuracy issues
    console.log(`[CH Sync] RAW API response for ${companyNumber}:`, JSON.stringify({
      accounts: profile.accounts,
      confirmation_statement: profile.confirmation_statement,
      company_status: profile.company_status,
      company_status_detail: profile.company_status_detail,
      registered_office_address: profile.registered_office_address
    }, null, 2));
    
    // Parse the registered office address
    const address = profile.registered_office_address || {};
    const registeredAddress1 = address.premises 
      ? `${address.premises} ${address.address_line_1 || ''}`.trim() 
      : (address.address_line_1 || null);
    
    return {
      companyNumber,
      nextAccountsPeriodEnd: profile.accounts?.next_made_up_to ? new Date(profile.accounts.next_made_up_to) : null,
      nextAccountsDue: profile.accounts?.next_due ? new Date(profile.accounts.next_due) : null,
      confirmationStatementNextDue: profile.confirmation_statement?.next_due ? new Date(profile.confirmation_statement.next_due) : null,
      confirmationStatementNextMadeUpTo: profile.confirmation_statement?.next_made_up_to ? new Date(profile.confirmation_statement.next_made_up_to) : null,
      companyStatusDetail: profile.company_status_detail || null,
      registeredAddress1: registeredAddress1,
      registeredAddress2: address.address_line_2 || null,
      registeredAddress3: address.care_of || address.locality || null,
      registeredPostcode: address.postal_code || null,
      registeredCountry: address.country || null,
    };
  } catch (error) {
    console.error(`[CH Sync] Error fetching data for company ${companyNumber}:`, error);
    return null;
  }
}

/**
 * Compare client CH data with fetched CH data and return differences for date fields
 */
function detectChanges(client: Client, chData: ChApiData): Array<{
  fieldName: ChMonitoredField;
  oldValue: string | null;
  newValue: string | null;
}> {
  const changes: Array<{
    fieldName: ChMonitoredField;
    oldValue: string | null;
    newValue: string | null;
  }> = [];
  
  for (const field of CH_MONITORED_FIELDS) {
    const clientValue = client[field];
    const chValue = chData[field];
    
    // Convert dates to strings for comparison
    const clientDateStr = clientValue ? 
      (clientValue instanceof Date ? clientValue.toISOString().split('T')[0] : clientValue) : null;
    const chDateStr = chValue ? 
      (chValue instanceof Date ? chValue.toISOString().split('T')[0] : chValue) : null;
    
    // Skip if Companies House returns null/empty (field not available in API response)
    // This prevents false positives where we have a value but CH doesn't provide one
    if (!chDateStr && clientDateStr) {
      console.log(`[CH Sync] Skipping ${field}: CH returned null but we have ${clientDateStr}`);
      continue;
    }
    
    // Skip if both values are null (no change)
    if (!chDateStr && !clientDateStr) {
      continue;
    }
    
    // Detect actual changes (both have values but they differ)
    if (clientDateStr !== chDateStr) {
      changes.push({
        fieldName: field,
        oldValue: clientDateStr,
        newValue: chDateStr,
      });
    }
  }
  
  return changes;
}

/**
 * Address data structure for storage (JSON stringified in newValue)
 */
interface AddressData {
  formatted: string;
  components: {
    registeredAddress1: string | null;
    registeredAddress2: string | null;
    registeredAddress3: string | null;
    registeredPostcode: string | null;
    registeredCountry: string | null;
  };
}

/**
 * Compare client address with CH address and detect changes
 * For address changes, we store the components as JSON for proper reconstruction on approval
 */
function detectAddressChange(client: Client, chData: ChApiData): {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
} | null {
  // Format current client address
  const clientAddress = formatAddress(
    client.registeredAddress1,
    client.registeredAddress2,
    client.registeredAddress3,
    client.registeredPostcode,
    client.registeredCountry
  );
  
  // Format CH address
  const chAddress = formatAddress(
    chData.registeredAddress1,
    chData.registeredAddress2,
    chData.registeredAddress3,
    chData.registeredPostcode,
    chData.registeredCountry
  );
  
  // Skip if CH returns no address
  if (!chAddress && clientAddress) {
    console.log(`[CH Sync] Skipping address: CH returned null but we have an address`);
    return null;
  }
  
  // Skip if both are null
  if (!chAddress && !clientAddress) {
    return null;
  }
  
  // Normalize for comparison (lowercase, remove extra whitespace)
  const normalizedClientAddress = clientAddress?.toLowerCase().replace(/\s+/g, ' ').trim() || null;
  const normalizedChAddress = chAddress?.toLowerCase().replace(/\s+/g, ' ').trim() || null;
  
  // Detect actual changes
  if (normalizedClientAddress !== normalizedChAddress) {
    // Store both the formatted display value and the components for reconstruction
    const newAddressData: AddressData = {
      formatted: chAddress!,
      components: {
        registeredAddress1: chData.registeredAddress1,
        registeredAddress2: chData.registeredAddress2,
        registeredAddress3: chData.registeredAddress3,
        registeredPostcode: chData.registeredPostcode,
        registeredCountry: chData.registeredCountry,
      }
    };
    
    return {
      fieldName: ADDRESS_FIELD_NAME,
      oldValue: clientAddress,
      newValue: JSON.stringify(newAddressData),
    };
  }
  
  return null;
}

/**
 * Process a single client for CH data sync
 */
async function syncClientData(client: Client): Promise<number> {
  if (!client.companyNumber) {
    console.log(`[CH Sync] Skipping client ${client.name} - no company number`);
    return 0;
  }
  
  try {
    console.log(`[CH Sync] Processing client: ${client.name} (Company: ${client.companyNumber})`);
    
    // Fetch latest CH data
    const chData = await fetchChData(client.companyNumber);
    if (!chData) {
      console.log(`[CH Sync] No CH data found for ${client.companyNumber}`);
      return 0;
    }
    
    // Log raw CH data for debugging
    console.log(`[CH Sync] Raw CH data for ${client.name} (${client.companyNumber}):`, {
      nextAccountsPeriodEnd: chData.nextAccountsPeriodEnd,
      nextAccountsDue: chData.nextAccountsDue,
      confirmationStatementNextDue: chData.confirmationStatementNextDue,
      confirmationStatementNextMadeUpTo: chData.confirmationStatementNextMadeUpTo,
      companyStatusDetail: chData.companyStatusDetail,
      registeredAddress: formatAddress(chData.registeredAddress1, chData.registeredAddress2, chData.registeredAddress3, chData.registeredPostcode, chData.registeredCountry),
    });
    
    // Update company status detail immediately (doesn't require approval)
    // This captures strike-off proposals and other status changes
    if (chData.companyStatusDetail !== client.companyStatusDetail) {
      console.log(`[CH Sync] Updating companyStatusDetail for ${client.name}: ${client.companyStatusDetail} → ${chData.companyStatusDetail}`);
      await storage.updateClient(client.id, {
        companyStatusDetail: chData.companyStatusDetail,
      });
      // Update local client object to reflect the change
      client.companyStatusDetail = chData.companyStatusDetail;
    }
    
    // Detect changes in monitored date fields
    const dateChanges = detectChanges(client, chData);
    
    // Detect address changes
    const addressChange = detectAddressChange(client, chData);
    
    // Combine all changes
    const changes: Array<{ fieldName: string; oldValue: string | null; newValue: string | null }> = [
      ...dateChanges,
      ...(addressChange ? [addressChange] : []),
    ];
    
    if (changes.length === 0) {
      console.log(`[CH Sync] No changes detected for ${client.name}`);
      return 0;
    }
    
    console.log(`[CH Sync] Detected ${changes.length} changes for ${client.name}:`, changes);
    
    // Separate changes into first-time imports (oldValue is null) and actual changes
    const firstTimeImports = changes.filter(c => c.oldValue === null);
    const actualChanges = changes.filter(c => c.oldValue !== null);
    
    // For first-time imports (oldValue is null), apply directly without creating change requests
    // This handles cases where clients are imported and we're just setting initial data
    if (firstTimeImports.length > 0) {
      const directUpdates: Record<string, any> = {};
      for (const change of firstTimeImports) {
        if (change.newValue) {
          // Handle address fields differently (they're strings, not dates)
          if (change.fieldName === ADDRESS_FIELD_NAME) {
            // For address, we need to update individual address components
            directUpdates.registeredAddress1 = chData.registeredAddress1;
            directUpdates.registeredAddress2 = chData.registeredAddress2;
            directUpdates.registeredAddress3 = chData.registeredAddress3;
            directUpdates.registeredPostcode = chData.registeredPostcode;
            directUpdates.registeredCountry = chData.registeredCountry;
            console.log(`[CH Sync] First import - applying address directly for ${client.name}: null → ${change.newValue}`);
          } else {
            // Date fields
            directUpdates[change.fieldName] = new Date(change.newValue);
            console.log(`[CH Sync] First import - applying ${change.fieldName} directly for ${client.name}: null → ${change.newValue}`);
          }
        }
      }
      
      if (Object.keys(directUpdates).length > 0) {
        await storage.updateClient(client.id, directUpdates);
        console.log(`[CH Sync] Applied ${Object.keys(directUpdates).length} first-time field(s) directly for ${client.name}`);
      }
    }
    
    // Create change requests only for actual changes (where we had a previous value)
    let createdRequests = 0;
    for (const change of actualChanges) {
      // VALIDATION: Skip if newValue is null or empty
      // This is a safety net - detectChanges should already filter these out
      if (!change.newValue || change.newValue.trim() === '') {
        console.warn(`[CH Sync] Skipping invalid change for ${client.name}.${change.fieldName}: newValue is empty`);
        continue;
      }
      
      // Check if there's already a pending request for this field/client
      const existingRequests = await storage.getAllChChangeRequests();
      const existingRequest = existingRequests.find((req: any) => 
        req.clientId === client.id && 
        req.fieldName === change.fieldName && 
        req.status === 'pending'
      );
      
      if (existingRequest) {
        console.log(`[CH Sync] Skipping duplicate request for ${client.name}.${change.fieldName}`);
        continue;
      }
      
      // Create new change request
      const changeRequest = {
        clientId: client.id,
        changeType: 'ch_sync',
        fieldName: change.fieldName,
        oldValue: change.oldValue,
        newValue: change.newValue,
        detectedAt: new Date(),
        status: 'pending' as const,
        notes: `Detected during nightly sync on ${new Date().toISOString().split('T')[0]}`,
      };
      
      await storage.createChChangeRequest(changeRequest);
      createdRequests++;
      
      console.log(`[CH Sync] Created change request for ${client.name}.${change.fieldName}: ${change.oldValue} → ${change.newValue}`);
    }
    
    return createdRequests;
    
  } catch (error) {
    console.error(`[CH Sync] Error processing client ${client.name}:`, error);
    return 0;
  }
}

/**
 * Main sync function - processes all clients or specific clients with CH numbers
 * @param clientIds - Optional array of client IDs to sync. If not provided, syncs all clients.
 */
export async function runChSync(clientIds?: string[]): Promise<{
  processedClients: number;
  createdRequests: number;
  errors: string[];
}> {
  const startTime = Date.now();
  console.log(`[CH Sync] Starting Companies House data synchronization${clientIds ? ` for ${clientIds.length} specific client(s)` : ''}...`);
  
  const result = {
    processedClients: 0,
    createdRequests: 0,
    errors: [] as string[],
  };
  
  try {
    // Get clients to sync
    let chClients;
    if (clientIds && clientIds.length > 0) {
      // Sync specific clients
      const clientPromises = await Promise.all(
        clientIds.map(id => storage.getClientById(id))
      );
      chClients = clientPromises.filter((client): client is NonNullable<typeof client> => 
        client !== undefined && client.companyNumber !== null && client.companyNumber !== undefined
      );
    } else {
      // Sync all clients with company numbers
      const allClients = await storage.getAllClients();
      chClients = allClients.filter((client: any) => client.companyNumber);
    }
    
    console.log(`[CH Sync] Found ${chClients.length} clients with Companies House numbers to sync`);
    
    if (chClients.length === 0) {
      console.log('[CH Sync] No clients to process');
      return result;
    }
    
    // Process each client sequentially to avoid API rate limits
    for (const client of chClients) {
      try {
        const requestsCreated = await syncClientData(client);
        result.processedClients++;
        result.createdRequests += requestsCreated;
      } catch (error) {
        const errorMsg = `Error processing ${client.name}: ${error}`;
        result.errors.push(errorMsg);
        console.error(`[CH Sync] ${errorMsg}`);
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`[CH Sync] Completed in ${duration}ms. Processed ${result.processedClients} clients, created ${result.createdRequests} change requests, ${result.errors.length} errors`);
    
    return result;
    
  } catch (error) {
    const errorMsg = `Fatal error during CH sync: ${error}`;
    result.errors.push(errorMsg);
    console.error(`[CH Sync] ${errorMsg}`);
    return result;
  }
}

/**
 * Schedule nightly sync (in a real app, this would use a cron job or task scheduler)
 * For demo purposes, we'll just export this function to be called manually
 */
export function scheduleNightlySync() {
  console.log('[CH Sync] Nightly sync scheduler started');
  
  // In a real implementation, you would use:
  // - node-cron for in-process scheduling
  // - A separate worker process/service
  // - Cloud functions with timers
  // - External cron jobs
  
  // For demo, we'll just log that it's scheduled
  console.log('[CH Sync] Would schedule to run every day at 2:00 AM');
}