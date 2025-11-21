#!/usr/bin/env tsx

import { sendStageChangeNotificationEmail } from './emailService';

async function sendTestEmail() {
  console.log('Sending test stage change notification email...');
  
  try {
    const emailSent = await sendStageChangeNotificationEmail(
      'jamsplan1@gmail.com',
      'Bob Bookkeeper',
      'Weekly Payroll - CAVANAGH BUILDERS LTD',
      'CAVANAGH BUILDERS LTD',
      'Complete',
      'Do_The_Work',
      'test-project-123',
      { maxInstanceTime: 1 }, // 1 business hour
      [
        { toStatus: 'Complete', timestamp: new Date().toISOString() },
        { toStatus: 'Do_The_Work', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }
      ],
      new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      'Work completed successfully',
      'All payroll calculations verified and submitted to HMRC. Everything has been processed and is ready for final review.',
      [
        { fieldName: 'Number of Employees Processed', fieldType: 'number', value: 15 },
        { fieldName: 'Payment Method', fieldType: 'long_text', value: 'BACS Transfer' },
        { fieldName: 'Issues Encountered', fieldType: 'multi_select', value: ['Late Timesheets', 'System Downtime'] }
      ]
    );

    if (emailSent) {
      console.log('✅ Test email sent successfully to jamsplan1@gmail.com');
      console.log('Check your inbox for the email!');
      process.exit(0);
    } else {
      console.error('❌ Failed to send test email');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error sending test email:', error);
    process.exit(1);
  }
}

sendTestEmail();
