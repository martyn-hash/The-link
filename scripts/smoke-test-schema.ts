import { db } from '../server/db';
import { users, clients, projects, services, projectTypes, kanbanStages } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function runSmokeTests() {
  const results: { test: string; status: string; details?: string }[] = [];
  
  // Test 1: User query
  try {
    const userList = await db.select({ id: users.id, email: users.email }).from(users).limit(3);
    results.push({ test: 'User query', status: 'PASS', details: `Found ${userList.length} users` });
  } catch (e) {
    results.push({ test: 'User query', status: 'FAIL', details: String(e) });
  }
  
  // Test 2: Client query
  try {
    const clientList = await db.select({ id: clients.id, name: clients.name }).from(clients).limit(3);
    results.push({ test: 'Client query', status: 'PASS', details: `Found ${clientList.length} clients` });
  } catch (e) {
    results.push({ test: 'Client query', status: 'FAIL', details: String(e) });
  }
  
  // Test 3: Project query with join
  try {
    const projectList = await db
      .select({ 
        id: projects.id, 
        clientName: clients.name,
        status: projects.currentStatus 
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .limit(3);
    results.push({ test: 'Project with join', status: 'PASS', details: `Found ${projectList.length} projects` });
  } catch (e) {
    results.push({ test: 'Project with join', status: 'FAIL', details: String(e) });
  }
  
  // Test 4: Service query
  try {
    const serviceList = await db.select({ id: services.id, name: services.name }).from(services).limit(3);
    results.push({ test: 'Service query', status: 'PASS', details: `Found ${serviceList.length} services` });
  } catch (e) {
    results.push({ test: 'Service query', status: 'FAIL', details: String(e) });
  }
  
  // Test 5: Project type with stages (relation)
  try {
    const ptWithStages = await db
      .select({
        ptId: projectTypes.id,
        ptName: projectTypes.name,
        stageId: kanbanStages.id,
        stageName: kanbanStages.name
      })
      .from(projectTypes)
      .leftJoin(kanbanStages, eq(kanbanStages.projectTypeId, projectTypes.id))
      .limit(5);
    results.push({ test: 'ProjectType with stages', status: 'PASS', details: `Found ${ptWithStages.length} rows` });
  } catch (e) {
    results.push({ test: 'ProjectType with stages', status: 'FAIL', details: String(e) });
  }
  
  // Test 6: Query.findFirst with relations
  try {
    const clientWithPeople = await db.query.clients.findFirst({
      with: { clientPeople: { limit: 2 } }
    });
    results.push({ 
      test: 'Client with relations (findFirst)', 
      status: 'PASS', 
      details: clientWithPeople ? `Client: ${clientWithPeople.name}` : 'No clients found'
    });
  } catch (e) {
    results.push({ test: 'Client with relations (findFirst)', status: 'FAIL', details: String(e) });
  }
  
  // Print results
  console.log('\n=== SMOKE TEST RESULTS ===\n');
  let passed = 0, failed = 0;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✓' : '✗';
    console.log(`${icon} ${r.test}: ${r.status}`);
    if (r.details) console.log(`  → ${r.details}`);
    if (r.status === 'PASS') passed++; else failed++;
  }
  
  console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
  
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runSmokeTests().catch(e => {
  console.error('Smoke test error:', e);
  process.exit(1);
});
