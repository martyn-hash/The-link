import { db } from './db';
import { sql } from 'drizzle-orm';

async function backfillLastMessageByStaff() {
  console.log('Starting backfill of lastMessageByStaff field...');
  
  // Update all threads with the last message's isStaff value
  // A message is from staff if it has user_id (not client_portal_user_id)
  const result = await db.execute(sql`
    UPDATE message_threads mt
    SET last_message_by_staff = (
      SELECT (m.user_id IS NOT NULL AND m.client_portal_user_id IS NULL)
      FROM messages m
      WHERE m.thread_id = mt.id
      ORDER BY m.created_at DESC
      LIMIT 1
    )
    WHERE EXISTS (
      SELECT 1
      FROM messages m
      WHERE m.thread_id = mt.id
    )
  `);
  
  console.log(`Backfill complete! Updated threads with messages.`);
  
  // Count threads without messages
  const emptyThreads = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM message_threads mt
    WHERE NOT EXISTS (
      SELECT 1
      FROM messages m
      WHERE m.thread_id = mt.id
    )
  `);
  
  console.log(`Threads without messages: ${emptyThreads.rows[0]?.count || 0}`);
  
  // Show final stats
  const stats = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(last_message_by_staff) as with_value,
      SUM(CASE WHEN last_message_by_staff = true THEN 1 ELSE 0 END) as staff_last,
      SUM(CASE WHEN last_message_by_staff = false THEN 1 ELSE 0 END) as client_last,
      SUM(CASE WHEN last_message_by_staff IS NULL THEN 1 ELSE 0 END) as null_value
    FROM message_threads
  `);
  
  console.log('\nFinal stats:');
  console.log(stats.rows[0]);
  
  process.exit(0);
}

backfillLastMessageByStaff().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
