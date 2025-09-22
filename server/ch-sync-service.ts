import { storage } from "./storage";
import type { Client, ChChangeRequest } from "../shared/schema";

// Mock Companies House API data structure
interface ChApiData {
  companyNumber: string;
  nextAccountsPeriodEnd: string | null;
  nextAccountsDue: string | null;
  confirmationStatementNextDue: string | null;
  confirmationStatementNextMadeUpTo: string | null;
}

// CH fields that we monitor for changes
const CH_MONITORED_FIELDS = [
  'nextAccountsPeriodEnd',
  'nextAccountsDue', 
  'confirmationStatementNextDue',
  'confirmationStatementNextMadeUpTo'
] as const;

type ChMonitoredField = typeof CH_MONITORED_FIELDS[number];

/**
 * Mock function to simulate fetching data from Companies House API
 * In a real implementation, this would make HTTP requests to the CH API
 */
async function fetchChDataMock(companyNumber: string): Promise<ChApiData | null> {
  console.log(`[CH Sync] Fetching data for company: ${companyNumber}`);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Mock data that might have changes
  const mockData: ChApiData = {
    companyNumber,
    nextAccountsPeriodEnd: null,
    nextAccountsDue: null,
    confirmationStatementNextDue: null,
    confirmationStatementNextMadeUpTo: null,
  };

  // Simulate some companies having updated data (random chance)
  const hasUpdates = Math.random() < 0.3; // 30% chance of updates
  
  if (hasUpdates) {
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setMonth(futureDate.getMonth() + 12); // Add 1 year
    
    // Randomly update some fields
    if (Math.random() < 0.5) {
      mockData.nextAccountsPeriodEnd = futureDate.toISOString().split('T')[0];
    }
    if (Math.random() < 0.5) {
      const dueDate = new Date(futureDate);
      dueDate.setMonth(dueDate.getMonth() + 3); // Due 3 months after period end
      mockData.nextAccountsDue = dueDate.toISOString().split('T')[0];
    }
    if (Math.random() < 0.3) {
      const confDate = new Date(now);
      confDate.setFullYear(confDate.getFullYear() + 1);
      mockData.confirmationStatementNextDue = confDate.toISOString().split('T')[0];
    }
  }
  
  return mockData;
}

/**
 * Compare client CH data with fetched CH data and return differences
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
    const chDateStr = chValue || null;
    
    // Detect changes
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
 * Process a single client for CH data sync
 */
async function syncClientData(client: Client): Promise<number> {
  if (!client.companiesHouseName) {
    console.log(`[CH Sync] Skipping client ${client.name} - no CH name`);
    return 0;
  }
  
  try {
    console.log(`[CH Sync] Processing client: ${client.name} (CH: ${client.companiesHouseName})`);
    
    // Fetch latest CH data
    const chData = await fetchChDataMock(client.companiesHouseName);
    if (!chData) {
      console.log(`[CH Sync] No CH data found for ${client.companiesHouseName}`);
      return 0;
    }
    
    // Detect changes
    const changes = detectChanges(client, chData);
    if (changes.length === 0) {
      console.log(`[CH Sync] No changes detected for ${client.name}`);
      return 0;
    }
    
    console.log(`[CH Sync] Detected ${changes.length} changes for ${client.name}:`, changes);
    
    // Create change requests for detected changes
    let createdRequests = 0;
    for (const change of changes) {
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
        newValue: change.newValue || '',
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
 * Main sync function - processes all clients with CH numbers
 */
export async function runChSync(): Promise<{
  processedClients: number;
  createdRequests: number;
  errors: string[];
}> {
  const startTime = Date.now();
  console.log('[CH Sync] Starting Companies House data synchronization...');
  
  const result = {
    processedClients: 0,
    createdRequests: 0,
    errors: [] as string[],
  };
  
  try {
    // Get all clients with CH names
    const allClients = await storage.getAllClients();
    const chClients = allClients.filter((client: any) => client.companiesHouseName);
    
    console.log(`[CH Sync] Found ${chClients.length} clients with Companies House names`);
    
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