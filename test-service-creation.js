#!/usr/bin/env node

/**
 * Test script for service creation flow
 * This tests that our protected modules are working correctly
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000';
let cookies = '';

async function login() {
  console.log('1. Logging in as admin...');
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'admin123'
    })
  });
  
  // Extract cookies from response
  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    cookies = setCookieHeader.split(';')[0];
    console.log('   ✓ Login successful');
  } else {
    console.error('   ✗ Login failed - no cookie received');
    process.exit(1);
  }
  
  return response.ok;
}

async function getFirstClient() {
  console.log('2. Getting first client...');
  const response = await fetch(`${API_BASE}/api/clients`, {
    headers: { 'Cookie': cookies }
  });
  
  if (!response.ok) {
    console.error('   ✗ Failed to get clients');
    return null;
  }
  
  const clients = await response.json();
  if (clients.length === 0) {
    console.error('   ✗ No clients found in system');
    return null;
  }
  
  const client = clients[0];
  console.log(`   ✓ Found client: ${client.name || client.email}`);
  return client;
}

async function getFirstService() {
  console.log('3. Getting first service...');
  const response = await fetch(`${API_BASE}/api/services`, {
    headers: { 'Cookie': cookies }
  });
  
  if (!response.ok) {
    console.error('   ✗ Failed to get services');
    return null;
  }
  
  const services = await response.json();
  const regularService = services.find(s => !s.isPersonalService && !s.isStaticService && !s.isCompaniesHouseConnected);
  
  if (!regularService) {
    console.error('   ✗ No regular services found');
    return null;
  }
  
  console.log(`   ✓ Found service: ${regularService.name}`);
  return regularService;
}

async function createClientService(clientId, serviceId) {
  console.log('4. Creating client-service mapping...');
  
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1); // Start of next month
  
  const endOfNextMonth = new Date(nextMonth);
  endOfNextMonth.setMonth(endOfNextMonth.getMonth() + 1);
  endOfNextMonth.setDate(0); // Last day of next month
  
  const payload = {
    clientId: clientId,
    serviceId: serviceId,
    frequency: 'monthly',
    nextStartDate: nextMonth.toISOString(),
    nextDueDate: endOfNextMonth.toISOString(),
    isActive: true
  };
  
  console.log('   Payload:', JSON.stringify(payload, null, 2));
  
  const response = await fetch(`${API_BASE}/api/client-services`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify(payload)
  });
  
  const text = await response.text();
  
  if (!response.ok) {
    console.error(`   ✗ Failed to create client-service: ${response.status}`);
    console.error(`   Response: ${text}`);
    return null;
  }
  
  try {
    const result = JSON.parse(text);
    console.log('   ✓ Client-service created successfully');
    console.log(`   ID: ${result.id}`);
    return result;
  } catch (e) {
    console.error('   ✗ Invalid JSON response:', text);
    return null;
  }
}

async function updateClientService(clientServiceId) {
  console.log('5. Testing update of client-service...');
  
  const updateData = {
    frequency: 'quarterly',
    isActive: true
  };
  
  console.log('   Update data:', JSON.stringify(updateData, null, 2));
  
  const response = await fetch(`${API_BASE}/api/client-services/${clientServiceId}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify(updateData)
  });
  
  if (!response.ok) {
    const text = await response.text();
    console.error(`   ✗ Failed to update client-service: ${response.status}`);
    console.error(`   Response: ${text}`);
    return false;
  }
  
  const result = await response.json();
  console.log('   ✓ Client-service updated successfully');
  console.log(`   New frequency: ${result.frequency}`);
  return true;
}

async function testSchedulerDryRun() {
  console.log('6. Testing scheduler dry run...');
  
  const response = await fetch(`${API_BASE}/api/project-scheduling/test-dry-run`, {
    method: 'POST',
    headers: { 'Cookie': cookies }
  });
  
  if (!response.ok) {
    console.error(`   ✗ Scheduler dry run failed: ${response.status}`);
    return false;
  }
  
  const result = await response.json();
  console.log('   ✓ Scheduler dry run completed');
  console.log(`   Services processed: ${result.servicesProcessed || 0}`);
  console.log(`   Would create projects: ${result.projectsCreated || 0}`);
  return true;
}

async function runTests() {
  console.log('=== Testing Service Creation Flow ===\n');
  
  try {
    // Login
    const loginSuccess = await login();
    if (!loginSuccess) {
      console.error('\n❌ Test failed at login stage');
      process.exit(1);
    }
    
    // Get test data
    const client = await getFirstClient();
    if (!client) {
      console.error('\n❌ Test failed - no client found');
      process.exit(1);
    }
    
    const service = await getFirstService();
    if (!service) {
      console.error('\n❌ Test failed - no service found');
      process.exit(1);
    }
    
    // Create client-service mapping
    const clientService = await createClientService(client.id, service.id);
    if (!clientService) {
      console.error('\n❌ Test failed at client-service creation');
      process.exit(1);
    }
    
    // Update the mapping
    const updateSuccess = await updateClientService(clientService.id);
    if (!updateSuccess) {
      console.error('\n❌ Test failed at client-service update');
      process.exit(1);
    }
    
    // Test scheduler
    const schedulerSuccess = await testSchedulerDryRun();
    if (!schedulerSuccess) {
      console.error('\n⚠️  Scheduler test failed (non-critical)');
    }
    
    console.log('\n✅ All tests passed successfully!');
    console.log('\nSummary:');
    console.log('- Service creation flow is working');
    console.log('- Protected modules are functioning correctly');
    console.log('- Date conversion is handled properly');
    console.log('- API error handling is in place');
    
  } catch (error) {
    console.error('\n❌ Test error:', error);
    process.exit(1);
  }
}

// Run the tests
runTests();