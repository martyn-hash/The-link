import { db } from './db';
import { messageThreads, messages } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';

async function backfillLastMessageByStaff() {
  console.log('Starting backfill of lastMessageByStaff field...');
  
  // Get all threads
  const threads = await db.select().from(messageThreads);
  console.log(`Found ${threads.length} threads to process`);
  
  let updated = 0;
  let skipped = 0;
  
  for (const thread of threads) {
    // Get the most recent message for this thread
    const lastMessage = await db
      .select()
      .from(messages)
      .where(eq(messages.threadId, thread.id))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    
    if (lastMessage.length === 0) {
      console.log(`Thread ${thread.id} has no messages, setting to null`);
      // Update thread with null value for threads with no messages
      await db
        .update(messageThreads)
        .set({ lastMessageByStaff: null })
        .where(eq(messageThreads.id, thread.id));
      skipped++;
      continue;
    }
    
    const isStaffMessage = lastMessage[0].userId !== null;
    
    // Update the thread
    await db
      .update(messageThreads)
      .set({ lastMessageByStaff: isStaffMessage })
      .where(eq(messageThreads.id, thread.id));
    
    console.log(`Updated thread ${thread.id}: lastMessageByStaff = ${isStaffMessage}`);
    updated++;
  }
  
  console.log(`\nBackfill complete!`);
  console.log(`- Updated: ${updated} threads`);
  console.log(`- Skipped: ${skipped} threads (no messages)`);
  
  process.exit(0);
}

backfillLastMessageByStaff().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
