import { db } from '../../db.js';
import { campaignTargetCriteria, clients, services, clientServices } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { campaignStorage, campaignTargetStorage } from '../../storage/campaigns/index.js';
import { getMatchingClients, buildTargetQuery } from '../../services/campaigns/campaignTargetingService.js';
import { nanoid } from 'nanoid';

async function debug() {
  console.log('=== DEBUG: Filter Storage and Query ===\n');
  
  const [service] = await db.select().from(services).limit(1);
  console.log('Test service:', service?.id, service?.name);
  
  const clientWithoutService = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(sql`NOT EXISTS (
      SELECT 1 FROM ${clientServices} 
      WHERE ${clientServices.clientId} = ${clients.id} 
      AND ${clientServices.serviceId} = ${service?.id}
      AND ${clientServices.isActive} = true
    )`)
    .limit(3);
  console.log('Clients without service:', clientWithoutService.map(c => c.id));
  
  // Check what services client 011f944b has
  const testClientId = '011f944b-9ec5-4db9-b224-32d9e4b68d65';
  const clientServicesData = await db
    .select({ serviceId: clientServices.serviceId, isActive: clientServices.isActive })
    .from(clientServices)
    .where(eq(clientServices.clientId, testClientId));
  console.log('\nClient', testClientId, 'has', clientServicesData.length, 'service assignments');
  clientServicesData.forEach(cs => console.log('  Service:', cs.serviceId, 'active:', cs.isActive));
  
  // Check if this client has the test service
  const hasTestService = clientServicesData.some(cs => cs.serviceId === service?.id && cs.isActive);
  console.log('Has test service active?', hasTestService);
  
  const campaign = await campaignStorage.create({
    name: 'Debug Campaign ' + nanoid(4),
    category: 'chase',
    status: 'draft',
    createdByUserId: null,
  });
  
  const filterValue = [service?.id];
  await campaignTargetStorage.bulkCreate(campaign.id, [{
    filterType: 'missing_service',
    operator: 'in',
    value: filterValue,
    filterGroup: 0,
    joinLogic: 'AND',
    sortOrder: 0,
  }]);
  
  // Get ALL matching clients to verify if expected client is there
  const allMatched = await getMatchingClients(campaign.id, 1000, 0);
  console.log('\nTotal matched clients:', allMatched.length);
  
  const isExpectedInResults = allMatched.some(c => c.id === testClientId);
  console.log('Is test client in results?', isExpectedInResults);
  
  // If not, why? Check if it has the service
  if (!isExpectedInResults) {
    console.log('\n--- Investigating why test client not in results ---');
    const hasService = clientServicesData.some(cs => cs.serviceId === service?.id && cs.isActive);
    if (hasService) {
      console.log('Client HAS the service, so correctly excluded from missing_service filter');
    } else {
      console.log('ERROR: Client does NOT have the service but was not matched!');
    }
  }
  
  await campaignTargetStorage.deleteAllByCampaignId(campaign.id);
  await campaignStorage.delete(campaign.id);
  
  console.log('\n=== END DEBUG ===');
  process.exit(0);
}

debug().catch(e => { console.error(e); process.exit(1); });
