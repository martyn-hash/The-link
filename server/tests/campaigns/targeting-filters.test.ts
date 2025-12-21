/**
 * Campaign Targeting Filter Tests
 * 
 * Atomic tests for all 17+ targeting filter types as defined in
 * server/services/campaigns/campaignTargetingService.ts
 * 
 * Run with: npx tsx server/tests/campaigns/targeting-filters.test.ts
 * 
 * Test Principles (from Testing-Principles.md):
 * - Each test verifies ONE thing
 * - Each test has a binary outcome: Pass / Fail
 * - Each test is independently repeatable
 */

import { db } from '../../db.js';
import { 
  clients, 
  clientServices, 
  services,
  projects, 
  projectTypes,
  clientTagAssignments,
  clientTags,
  clientPeople,
  people,
  clientPortalUsers,
  campaigns,
  campaignRecipients,
  campaignTargetCriteria,
  users,
  clientEngagementScores
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { 
  getMatchingClients, 
  getMatchingClientCount,
  FILTER_REGISTRY 
} from '../../services/campaigns/campaignTargetingService.js';
import { campaignStorage, campaignTargetStorage } from '../../storage/campaigns/index.js';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];
let testCampaignId: string | null = null;

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`  ✅ ${name}`);
  } catch (error: any) {
    results.push({ name, passed: false, error: error.message, duration: Date.now() - start });
    console.log(`  ❌ ${name}: ${error.message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertContains(arr: any[], item: any): void {
  const found = arr.includes(item);
  if (!found) throw new Error(`Expected array to contain ${item}`);
}

function assertNotContains(arr: any[], item: any): void {
  const found = arr.includes(item);
  if (found) throw new Error(`Expected array to NOT contain ${item}`);
}

async function setup(): Promise<void> {
  console.log('\n🔧 Setting up test environment...');
  
  const campaign = await campaignStorage.create({
    name: `Test Campaign ${nanoid(6)}`,
    category: 'chase',
    status: 'draft',
    createdByUserId: null,
  });
  testCampaignId = campaign.id;
  console.log(`   Created test campaign: ${testCampaignId}`);
}

async function cleanup(): Promise<void> {
  console.log('\n🧹 Cleaning up test data...');
  if (testCampaignId) {
    await campaignTargetStorage.deleteAllByCampaignId(testCampaignId);
    await campaignStorage.delete(testCampaignId);
  }
}

async function setFilters(filters: Array<{ filterType: string; operator: string; value: any; filterGroup?: number }>): Promise<void> {
  if (!testCampaignId) throw new Error('Test campaign not set up');
  
  await campaignTargetStorage.deleteAllByCampaignId(testCampaignId);
  
  const criteria = filters.map((f, i) => ({
    filterType: f.filterType,
    operator: f.operator,
    value: f.value,
    filterGroup: f.filterGroup ?? 0,
    joinLogic: 'AND' as const,
    sortOrder: i,
  }));
  
  await campaignTargetStorage.bulkCreate(testCampaignId, criteria);
}

async function getMatchedClientIds(): Promise<string[]> {
  if (!testCampaignId) throw new Error('Test campaign not set up');
  const matched = await getMatchingClients(testCampaignId, 1000, 0);
  return matched.map(c => c.id);
}

// ============================================================================
// TEST SUITES
// ============================================================================

async function testHasServiceFilter(): Promise<void> {
  console.log('\n📦 Testing: has_service filter');
  
  const [testService] = await db.select().from(services).limit(1);
  if (!testService) {
    console.log('   ⚠️ Skipping: No services in database');
    return;
  }
  
  const clientsWithService = await db
    .select({ clientId: clientServices.clientId })
    .from(clientServices)
    .where(and(
      eq(clientServices.serviceId, testService.id),
      eq(clientServices.isActive, true)
    ))
    .limit(5);
  
  if (clientsWithService.length === 0) {
    console.log('   ⚠️ Skipping: No clients with active services');
    return;
  }
  
  const testClientId = clientsWithService[0].clientId;
  
  await runTest('should match clients with active service', async () => {
    await setFilters([{ filterType: 'has_service', operator: 'in', value: [testService.id] }]);
    const matched = await getMatchedClientIds();
    assertContains(matched, testClientId);
  });
  
  const inactiveAssignments = await db
    .select({ clientId: clientServices.clientId })
    .from(clientServices)
    .where(and(
      eq(clientServices.serviceId, testService.id),
      eq(clientServices.isActive, false)
    ))
    .limit(1);
  
  if (inactiveAssignments.length > 0) {
    await runTest('should NOT match clients with inactive service', async () => {
      await setFilters([{ filterType: 'has_service', operator: 'in', value: [testService.id] }]);
      const matched = await getMatchedClientIds();
      assertNotContains(matched, inactiveAssignments[0].clientId);
    });
  }
}

async function testMissingServiceFilter(): Promise<void> {
  console.log('\n📦 Testing: missing_service filter');
  
  const [testService] = await db.select().from(services).limit(1);
  if (!testService) {
    console.log('   ⚠️ Skipping: No services in database');
    return;
  }
  
  const clientsWithoutService = await db
    .select({ id: clients.id })
    .from(clients)
    .where(sql`NOT EXISTS (
      SELECT 1 FROM ${clientServices} 
      WHERE ${clientServices.clientId} = ${clients.id} 
      AND ${clientServices.serviceId} = ${testService.id}
      AND ${clientServices.isActive} = true
    )`)
    .limit(5);
  
  if (clientsWithoutService.length === 0) {
    console.log('   ⚠️ Skipping: All clients have this service');
    return;
  }
  
  const testClientId = clientsWithoutService[0].id;
  
  await runTest('should match clients WITHOUT the service', async () => {
    await setFilters([{ filterType: 'missing_service', operator: 'in', value: [testService.id] }]);
    const matched = await getMatchedClientIds();
    assertContains(matched, testClientId);
  });
  
  const clientsWithService = await db
    .select({ clientId: clientServices.clientId })
    .from(clientServices)
    .where(and(
      eq(clientServices.serviceId, testService.id),
      eq(clientServices.isActive, true)
    ))
    .limit(1);
  
  if (clientsWithService.length > 0) {
    await runTest('should NOT match clients WITH the service', async () => {
      await setFilters([{ filterType: 'missing_service', operator: 'in', value: [testService.id] }]);
      const matched = await getMatchedClientIds();
      assertNotContains(matched, clientsWithService[0].clientId);
    });
  }
}

async function testHasServiceNotOtherFilter(): Promise<void> {
  console.log('\n📦 Testing: has_service_not_other filter');
  
  const allServices = await db.select().from(services).limit(3);
  if (allServices.length < 2) {
    console.log('   ⚠️ Skipping: Need at least 2 services');
    return;
  }
  
  const serviceA = allServices[0];
  const serviceB = allServices[1];
  
  const clientsWithANotB = await db
    .select({ id: clients.id })
    .from(clients)
    .where(sql`
      EXISTS (SELECT 1 FROM ${clientServices} WHERE ${clientServices.clientId} = ${clients.id} AND ${clientServices.serviceId} = ${serviceA.id} AND ${clientServices.isActive} = true)
      AND NOT EXISTS (SELECT 1 FROM ${clientServices} WHERE ${clientServices.clientId} = ${clients.id} AND ${clientServices.serviceId} = ${serviceB.id} AND ${clientServices.isActive} = true)
    `)
    .limit(5);
  
  if (clientsWithANotB.length === 0) {
    console.log('   ⚠️ Skipping: No clients with service A but not B');
    return;
  }
  
  await runTest('should match clients with service A but NOT service B', async () => {
    await setFilters([{ 
      filterType: 'has_service_not_other', 
      operator: 'equals', 
      value: { has: [serviceA.id], notHas: [serviceB.id] } 
    }]);
    const matched = await getMatchedClientIds();
    assertContains(matched, clientsWithANotB[0].id);
  });
}

async function testHasProjectTypeFilter(): Promise<void> {
  console.log('\n📁 Testing: has_project_type filter');
  
  const [testProjectType] = await db.select().from(projectTypes).limit(1);
  if (!testProjectType) {
    console.log('   ⚠️ Skipping: No project types in database');
    return;
  }
  
  const clientsWithProjectType = await db
    .select({ clientId: projects.clientId })
    .from(projects)
    .where(and(
      eq(projects.projectTypeId, testProjectType.id),
      eq(projects.archived, false),
      eq(projects.inactive, false)
    ))
    .limit(5);
  
  if (clientsWithProjectType.length === 0) {
    console.log('   ⚠️ Skipping: No clients with active projects of this type');
    return;
  }
  
  await runTest('should match clients with active project of type', async () => {
    await setFilters([{ filterType: 'has_project_type', operator: 'in', value: [testProjectType.id] }]);
    const matched = await getMatchedClientIds();
    assertContains(matched, clientsWithProjectType[0].clientId);
  });
  
  await runTest('should NOT match clients when using not_in operator', async () => {
    await setFilters([{ filterType: 'has_project_type', operator: 'not_in', value: [testProjectType.id] }]);
    const matched = await getMatchedClientIds();
    assertNotContains(matched, clientsWithProjectType[0].clientId);
  });
}

async function testProjectAtStageFilter(): Promise<void> {
  console.log('\n📁 Testing: project_at_stage filter');
  
  const projectWithStage = await db
    .select({
      clientId: projects.clientId,
      projectTypeId: projects.projectTypeId,
      currentStatus: projects.currentStatus,
    })
    .from(projects)
    .where(and(
      eq(projects.archived, false),
      eq(projects.inactive, false),
      sql`${projects.currentStatus} IS NOT NULL`
    ))
    .limit(1);
  
  if (projectWithStage.length === 0) {
    console.log('   ⚠️ Skipping: No projects with current_status set');
    return;
  }
  
  const { clientId, projectTypeId, currentStatus } = projectWithStage[0];
  
  await runTest('should match clients with project at specific stage', async () => {
    await setFilters([{ 
      filterType: 'project_at_stage', 
      operator: 'equals', 
      value: { projectTypeId, stage: currentStatus } 
    }]);
    const matched = await getMatchedClientIds();
    assertContains(matched, clientId);
  });
  
  await runTest('should NOT match clients with project at wrong stage', async () => {
    await setFilters([{ 
      filterType: 'project_at_stage', 
      operator: 'equals', 
      value: { projectTypeId, stage: 'NonExistentStage_' + nanoid(4) } 
    }]);
    const matched = await getMatchedClientIds();
    assertNotContains(matched, clientId);
  });
}

async function testAccountsDueRangeFilter(): Promise<void> {
  console.log('\n📅 Testing: accounts_due_range filter');
  
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  const clientsDueWithin30 = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(
      sql`${clients.nextAccountsDue} >= ${now}`,
      sql`${clients.nextAccountsDue} <= ${in30Days}`
    ))
    .limit(5);
  
  if (clientsDueWithin30.length === 0) {
    console.log('   ⚠️ Skipping: No clients with accounts due within 30 days');
    return;
  }
  
  await runTest('should match clients with accounts due within 30 days', async () => {
    await setFilters([{ 
      filterType: 'accounts_due_range', 
      operator: 'within', 
      value: { preset: 30 } 
    }]);
    const matched = await getMatchedClientIds();
    assertContains(matched, clientsDueWithin30[0].id);
  });
}

async function testConfirmationStatementDueRangeFilter(): Promise<void> {
  console.log('\n📅 Testing: confirmation_statement_due_range filter');
  
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  const clientsDueWithin30 = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(
      sql`${clients.confirmationStatementNextDue} >= ${now}`,
      sql`${clients.confirmationStatementNextDue} <= ${in30Days}`
    ))
    .limit(5);
  
  if (clientsDueWithin30.length === 0) {
    console.log('   ⚠️ Skipping: No clients with confirmation statement due within 30 days');
    return;
  }
  
  await runTest('should match clients with confirmation statement due within 30 days', async () => {
    await setFilters([{ 
      filterType: 'confirmation_statement_due_range', 
      operator: 'within', 
      value: { preset: 30 } 
    }]);
    const matched = await getMatchedClientIds();
    assertContains(matched, clientsDueWithin30[0].id);
  });
}

async function testMissingUtrFilter(): Promise<void> {
  console.log('\n⚠️ Testing: missing_utr filter');
  
  const clientsMissingUtr = await db
    .select({ id: clients.id })
    .from(clients)
    .where(sql`(${clients.companyUtr} IS NULL OR ${clients.companyUtr} = '')`)
    .limit(5);
  
  const clientsWithUtr = await db
    .select({ id: clients.id })
    .from(clients)
    .where(sql`${clients.companyUtr} IS NOT NULL AND ${clients.companyUtr} != ''`)
    .limit(5);
  
  if (clientsMissingUtr.length > 0) {
    await runTest('should match clients missing UTR', async () => {
      await setFilters([{ filterType: 'missing_utr', operator: 'equals', value: true }]);
      const matched = await getMatchedClientIds();
      assertContains(matched, clientsMissingUtr[0].id);
    });
  } else {
    console.log('   ⚠️ Skipping: No clients missing UTR');
  }
  
  if (clientsWithUtr.length > 0) {
    await runTest('should NOT match clients with UTR when filtering for missing', async () => {
      await setFilters([{ filterType: 'missing_utr', operator: 'equals', value: true }]);
      const matched = await getMatchedClientIds();
      assertNotContains(matched, clientsWithUtr[0].id);
    });
  }
}

async function testMissingAuthCodeFilter(): Promise<void> {
  console.log('\n⚠️ Testing: missing_auth_code filter');
  
  const clientsMissingAuthCode = await db
    .select({ id: clients.id })
    .from(clients)
    .where(sql`(${clients.companiesHouseAuthCode} IS NULL OR ${clients.companiesHouseAuthCode} = '')`)
    .limit(5);
  
  if (clientsMissingAuthCode.length > 0) {
    await runTest('should match clients missing Companies House auth code', async () => {
      await setFilters([{ filterType: 'missing_auth_code', operator: 'equals', value: true }]);
      const matched = await getMatchedClientIds();
      assertContains(matched, clientsMissingAuthCode[0].id);
    });
  } else {
    console.log('   ⚠️ Skipping: No clients missing auth code');
  }
}

async function testHasTagFilter(): Promise<void> {
  console.log('\n🏷️ Testing: has_tag filter');
  
  const tagAssignment = await db
    .select({ 
      clientId: clientTagAssignments.clientId, 
      tagId: clientTagAssignments.tagId 
    })
    .from(clientTagAssignments)
    .limit(1);
  
  if (tagAssignment.length === 0) {
    console.log('   ⚠️ Skipping: No tag assignments in database');
    return;
  }
  
  const { clientId, tagId } = tagAssignment[0];
  
  await runTest('should match clients with specific tag', async () => {
    await setFilters([{ filterType: 'has_tag', operator: 'in', value: [tagId] }]);
    const matched = await getMatchedClientIds();
    assertContains(matched, clientId);
  });
  
  await runTest('should NOT match clients when using not_in operator', async () => {
    await setFilters([{ filterType: 'has_tag', operator: 'not_in', value: [tagId] }]);
    const matched = await getMatchedClientIds();
    assertNotContains(matched, clientId);
  });
}

async function testClientManagerFilter(): Promise<void> {
  console.log('\n👤 Testing: client_manager filter');
  
  const clientWithManager = await db
    .select({ id: clients.id, managerId: clients.managerId })
    .from(clients)
    .where(sql`${clients.managerId} IS NOT NULL`)
    .limit(1);
  
  if (clientWithManager.length === 0) {
    console.log('   ⚠️ Skipping: No clients with assigned managers');
    return;
  }
  
  const { id: clientId, managerId } = clientWithManager[0];
  
  await runTest('should match clients with specific manager', async () => {
    await setFilters([{ filterType: 'client_manager', operator: 'in', value: [managerId] }]);
    const matched = await getMatchedClientIds();
    assertContains(matched, clientId);
  });
  
  await runTest('should NOT match clients when using not_in operator', async () => {
    await setFilters([{ filterType: 'client_manager', operator: 'not_in', value: [managerId] }]);
    const matched = await getMatchedClientIds();
    assertNotContains(matched, clientId);
  });
}

async function testPortalLoginDaysFilter(): Promise<void> {
  console.log('\n🔐 Testing: portal_login_days filter');
  
  const recentLogin = await db
    .select({ clientId: clientPortalUsers.clientId })
    .from(clientPortalUsers)
    .where(sql`${clientPortalUsers.lastLogin} > NOW() - INTERVAL '30 days'`)
    .limit(1);
  
  if (recentLogin.length === 0) {
    console.log('   ⚠️ Skipping: No clients with recent portal login');
    return;
  }
  
  await runTest('should match clients with portal login within 30 days', async () => {
    await setFilters([{ filterType: 'portal_login_days', operator: 'within', value: 30 }]);
    const matched = await getMatchedClientIds();
    assertContains(matched, recentLogin[0].clientId);
  });
}

async function testEngagementScoreFilter(): Promise<void> {
  console.log('\n📊 Testing: engagement_score filter');
  
  const clientWithScore = await db
    .select({ clientId: clientEngagementScores.clientId, totalScore: clientEngagementScores.totalScore })
    .from(clientEngagementScores)
    .where(sql`${clientEngagementScores.totalScore} IS NOT NULL`)
    .limit(1);
  
  if (clientWithScore.length === 0) {
    console.log('   ⚠️ Skipping: No clients with engagement scores');
    return;
  }
  
  const { clientId, totalScore } = clientWithScore[0];
  const score = Number(totalScore) || 0;
  
  await runTest('should match clients with engagement score in range', async () => {
    const minScore = Math.max(0, score - 10);
    const maxScore = Math.min(100, score + 10);
    await setFilters([{ 
      filterType: 'engagement_score', 
      operator: 'between', 
      value: { min: minScore, max: maxScore } 
    }]);
    const matched = await getMatchedClientIds();
    assertContains(matched, clientId);
  });
}

async function testFilterCombination(): Promise<void> {
  console.log('\n🔗 Testing: Filter combination (AND logic)');
  
  const [testService] = await db.select().from(services).limit(1);
  if (!testService) {
    console.log('   ⚠️ Skipping: No services');
    return;
  }
  
  const clientsWithService = await db
    .select({ clientId: clientServices.clientId })
    .from(clientServices)
    .where(and(
      eq(clientServices.serviceId, testService.id),
      eq(clientServices.isActive, true)
    ))
    .limit(5);
  
  if (clientsWithService.length === 0) {
    console.log('   ⚠️ Skipping: No test data');
    return;
  }
  
  await runTest('should apply multiple filters with AND logic within group', async () => {
    await setFilters([
      { filterType: 'has_service', operator: 'in', value: [testService.id], filterGroup: 0 },
      { filterType: 'missing_utr', operator: 'equals', value: true, filterGroup: 0 },
    ]);
    const matched = await getMatchedClientIds();
    for (const clientId of matched) {
      const hasService = await db
        .select()
        .from(clientServices)
        .where(and(
          eq(clientServices.clientId, clientId),
          eq(clientServices.serviceId, testService.id),
          eq(clientServices.isActive, true)
        ));
      const [clientRecord] = await db.select().from(clients).where(eq(clients.id, clientId));
      
      assert(hasService.length > 0, `Client ${clientId} should have the service`);
      assert(!clientRecord?.companyUtr || clientRecord.companyUtr === '', `Client ${clientId} should be missing UTR`);
    }
  });
}

async function testFilterGroupOrLogic(): Promise<void> {
  console.log('\n🔗 Testing: Filter groups (OR logic between groups)');
  
  const allServices = await db.select().from(services).limit(2);
  if (allServices.length < 2) {
    console.log('   ⚠️ Skipping: Need at least 2 services');
    return;
  }
  
  const serviceA = allServices[0];
  const serviceB = allServices[1];
  
  const clientsWithA = await db
    .select({ clientId: clientServices.clientId })
    .from(clientServices)
    .where(and(eq(clientServices.serviceId, serviceA.id), eq(clientServices.isActive, true)))
    .limit(2);
  
  const clientsWithB = await db
    .select({ clientId: clientServices.clientId })
    .from(clientServices)
    .where(and(eq(clientServices.serviceId, serviceB.id), eq(clientServices.isActive, true)))
    .limit(2);
  
  if (clientsWithA.length === 0 || clientsWithB.length === 0) {
    console.log('   ⚠️ Skipping: Need clients with different services');
    return;
  }
  
  await runTest('should combine filter groups with OR logic', async () => {
    await setFilters([
      { filterType: 'has_service', operator: 'in', value: [serviceA.id], filterGroup: 0 },
      { filterType: 'has_service', operator: 'in', value: [serviceB.id], filterGroup: 1 },
    ]);
    const matched = await getMatchedClientIds();
    
    const hasAnyFromA = clientsWithA.some(c => matched.includes(c.clientId));
    const hasAnyFromB = clientsWithB.some(c => matched.includes(c.clientId));
    
    assert(hasAnyFromA || hasAnyFromB, 'Should match clients from either group');
  });
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CAMPAIGN TARGETING FILTER TESTS');
  console.log('  Atomic validation of all filter types');
  console.log('═══════════════════════════════════════════════════════════════');
  
  try {
    await setup();
    
    await testHasServiceFilter();
    await testMissingServiceFilter();
    await testHasServiceNotOtherFilter();
    await testHasProjectTypeFilter();
    await testProjectAtStageFilter();
    await testAccountsDueRangeFilter();
    await testConfirmationStatementDueRangeFilter();
    await testMissingUtrFilter();
    await testMissingAuthCodeFilter();
    await testHasTagFilter();
    await testClientManagerFilter();
    await testPortalLoginDaysFilter();
    await testEngagementScoreFilter();
    await testFilterCombination();
    await testFilterGroupOrLogic();
    
    await cleanup();
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  TEST RESULTS SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    
    console.log(`\n  Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\n  FAILED TESTS:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`    ❌ ${r.name}`);
        console.log(`       Error: ${r.error}`);
      });
    }
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    
    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n💥 Test runner error:', error.message);
    await cleanup().catch(() => {});
    process.exit(1);
  }
}

main();
