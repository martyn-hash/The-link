import { db } from '../../db.js';
import { clients, clientServices, clientTagAssignments } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { campaignStorage, campaignTargetStorage } from '../../storage/campaigns/index.js';
import { getMatchingClients } from '../../services/campaigns/campaignTargetingService.js';
import { nanoid } from 'nanoid';

async function debug() {
  console.log('=== DEBUG: Filter Value Storage/Retrieval ===\n');
  
  const campaign = await campaignStorage.create({
    name: 'Debug2 ' + nanoid(4),
    category: 'chase',
    status: 'draft',
    createdByUserId: null,
  });
  console.log('Campaign:', campaign.id);
  
  // Test 1: missing_utr with boolean value
  console.log('\n--- TEST 1: missing_utr filter ---');
  await campaignTargetStorage.bulkCreate(campaign.id, [{
    filterType: 'missing_utr',
    operator: 'equals',
    value: true,
    filterGroup: 0,
    joinLogic: 'AND',
    sortOrder: 0,
  }]);
  
  const criteria1 = await campaignTargetStorage.getByCampaignId(campaign.id);
  console.log('Stored value:', JSON.stringify(criteria1[0]?.value));
  console.log('Value type:', typeof criteria1[0]?.value);
  console.log('Value === true:', criteria1[0]?.value === true);
  console.log('Value == true:', criteria1[0]?.value == true);
  
  // Find clients missing UTR
  const clientsMissingUtr = await db
    .select({ id: clients.id })
    .from(clients)
    .where(sql`(${clients.companyUtr} IS NULL OR ${clients.companyUtr} = '')`)
    .limit(5);
  console.log('Clients missing UTR:', clientsMissingUtr.map(c => c.id));
  
  const matched1 = await getMatchingClients(campaign.id, 1000, 0);
  console.log('Matched clients count:', matched1.length);
  if (clientsMissingUtr.length > 0) {
    const found = matched1.some(c => c.id === clientsMissingUtr[0].id);
    console.log('First expected client in results?', found);
  }
  
  // Cleanup
  await campaignTargetStorage.deleteAllByCampaignId(campaign.id);
  
  // Test 2: has_tag filter
  console.log('\n--- TEST 2: has_tag filter ---');
  const tagAssignment = await db
    .select({ clientId: clientTagAssignments.clientId, tagId: clientTagAssignments.tagId })
    .from(clientTagAssignments)
    .limit(1);
  
  if (tagAssignment.length > 0) {
    const { clientId, tagId } = tagAssignment[0];
    console.log('Test tag:', tagId, 'for client:', clientId);
    
    await campaignTargetStorage.bulkCreate(campaign.id, [{
      filterType: 'has_tag',
      operator: 'in',
      value: [tagId],
      filterGroup: 0,
      joinLogic: 'AND',
      sortOrder: 0,
    }]);
    
    const criteria2 = await campaignTargetStorage.getByCampaignId(campaign.id);
    console.log('Stored value:', JSON.stringify(criteria2[0]?.value));
    console.log('Value is array?', Array.isArray(criteria2[0]?.value));
    
    const matched2 = await getMatchingClients(campaign.id, 1000, 0);
    console.log('Matched clients count:', matched2.length);
    const found = matched2.some(c => c.id === clientId);
    console.log('Expected client in results?', found);
    
    await campaignTargetStorage.deleteAllByCampaignId(campaign.id);
  }
  
  // Test 3: Direct SQL query vs filter engine
  console.log('\n--- TEST 3: Direct SQL vs Filter Engine ---');
  
  const directQuery = await db
    .select({ id: clients.id })
    .from(clients)
    .where(sql`(${clients.companyUtr} IS NULL OR ${clients.companyUtr} = '')`)
    .limit(100);
  console.log('Direct SQL query count:', directQuery.length);
  
  // Final cleanup
  await campaignStorage.delete(campaign.id);
  
  console.log('\n=== END DEBUG ===');
  process.exit(0);
}

debug().catch(e => { console.error(e); process.exit(1); });
