/**
 * Test script for tenant-wide Microsoft Graph access
 * 
 * Run with: npx tsx server/scripts/testTenantAccess.ts
 * 
 * Tests:
 * 1. Client credentials authentication
 * 2. User lookup by email
 * 3. Reading emails from user's mailbox
 */

import {
  isApplicationGraphConfigured,
  getUserByEmail,
  getUserEmails,
  getUserMailFolders,
  listTenantUsers,
} from '../utils/applicationGraphClient';

async function testTenantAccess() {
  console.log('='.repeat(60));
  console.log('Microsoft Graph Tenant-Wide Access Test');
  console.log('='.repeat(60));
  console.log();

  // Check configuration
  console.log('Step 1: Checking configuration...');
  if (!isApplicationGraphConfigured()) {
    console.error('❌ Microsoft application credentials not configured');
    console.log('Required environment variables:');
    console.log('  - MICROSOFT_CLIENT_ID:', process.env.MICROSOFT_CLIENT_ID ? '✓ Set' : '✗ Missing');
    console.log('  - MICROSOFT_CLIENT_SECRET:', process.env.MICROSOFT_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
    console.log('  - MICROSOFT_TENANT_ID:', process.env.MICROSOFT_TENANT_ID ? '✓ Set' : '✗ Missing');
    process.exit(1);
  }
  console.log('✓ Configuration OK');
  console.log();

  // Test email to look up
  const testEmail = process.argv[2] || 'martyn@growth.accountants';
  console.log(`Step 2: Looking up user: ${testEmail}`);
  
  try {
    const user = await getUserByEmail(testEmail);
    
    if (!user) {
      console.error(`❌ User not found in Azure AD: ${testEmail}`);
      process.exit(1);
    }
    
    console.log('✓ User found:');
    console.log(`  Azure AD GUID: ${user.id}`);
    console.log(`  Display Name: ${user.displayName}`);
    console.log(`  Email: ${user.mail || user.userPrincipalName}`);
    console.log();
    
    // Get mail folders
    console.log('Step 3: Getting mail folders...');
    const folders = await getUserMailFolders(user.id);
    console.log(`✓ Retrieved ${folders.length} mail folders:`);
    folders.forEach(f => {
      console.log(`  - ${f.displayName}: ${f.totalItemCount} items (${f.unreadItemCount} unread)`);
    });
    console.log();
    
    // Get recent emails
    console.log('Step 4: Reading recent emails from Inbox...');
    const emails = await getUserEmails(user.id, {
      folder: 'Inbox',
      top: 5,
      orderBy: 'receivedDateTime desc'
    });
    
    console.log(`✓ Retrieved ${emails.messages.length} recent emails:`);
    emails.messages.forEach((msg: any, i: number) => {
      console.log(`  ${i + 1}. [${msg.receivedDateTime}]`);
      console.log(`     From: ${msg.from?.emailAddress?.address || 'Unknown'}`);
      console.log(`     Subject: ${msg.subject || '(no subject)'}`);
      console.log(`     Read: ${msg.isRead ? 'Yes' : 'No'}`);
      console.log();
    });
    
    console.log('='.repeat(60));
    console.log('🎉 SUCCESS! Tenant-wide email access is working!');
    console.log('='.repeat(60));
    
    // Summary
    console.log();
    console.log('Summary:');
    console.log(`  User Azure AD ID: ${user.id}`);
    console.log(`  User Email: ${user.mail || user.userPrincipalName}`);
    console.log(`  Total Folders: ${folders.length}`);
    console.log(`  Inbox Emails Retrieved: ${emails.messages.length}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.statusCode) {
      console.error('  Status Code:', error.statusCode);
    }
    if (error.body) {
      console.error('  Response:', JSON.stringify(error.body, null, 2));
    }
    process.exit(1);
  }
}

// Run the test
testTenantAccess().catch(console.error);
