/**
 * Schema Migrations Utility
 * Automatically checks and applies missing schema changes on server startup
 * This prevents production deployment issues when schema changes aren't migrated
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Check if a column exists in a table
 */
async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = ${tableName} 
        AND column_name = ${columnName}
      ) as exists;
    `);
    
    return (result.rows[0] as any)?.exists || false;
  } catch (error) {
    console.error(`Error checking if column ${columnName} exists in ${tableName}:`, error);
    return false;
  }
}

/**
 * Add super_admin column to users table if it doesn't exist
 */
async function ensureSuperAdminColumn(): Promise<void> {
  const exists = await columnExists('users', 'super_admin');
  
  if (!exists) {
    console.log('[Schema Migration] Adding missing super_admin column to users table...');
    try {
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN super_admin BOOLEAN DEFAULT false;
      `);
      console.log('[Schema Migration] ✓ Successfully added super_admin column');
    } catch (error) {
      console.error('[Schema Migration] ✗ Failed to add super_admin column:', error);
      throw error;
    }
  } else {
    console.log('[Schema Migration] ✓ super_admin column already exists');
  }
}

/**
 * Migrate push notifications from single pushContent to separate pushTitle/pushBody
 */
async function migratePushNotificationFields(): Promise<void> {
  const tablesWithConstraints = [
    {
      name: 'project_type_notifications',
      constraint: 'check_push_notification_content'
    },
    {
      name: 'client_request_reminders',
      constraint: 'check_push_reminder_content'
    }
  ];
  
  for (const table of tablesWithConstraints) {
    const titleExists = await columnExists(table.name, 'push_title');
    const bodyExists = await columnExists(table.name, 'push_body');
    const contentExists = await columnExists(table.name, 'push_content');
    
    // Skip if already fully migrated (both new columns exist and old column is gone)
    if (titleExists && bodyExists && !contentExists) {
      console.log(`[Schema Migration] ✓ Push notification fields already migrated for ${table.name}`);
      continue;
    }
    
    console.log(`[Schema Migration] Migrating push notification fields for ${table.name}...`);
    try {
      // Use db.transaction to ensure atomicity on same connection
      await db.transaction(async (tx) => {
        // Add new columns if they don't exist
        if (!titleExists) {
          await tx.execute(sql.raw(`
            ALTER TABLE ${table.name} 
            ADD COLUMN push_title VARCHAR(50)
          `));
        }
        
        if (!bodyExists) {
          await tx.execute(sql.raw(`
            ALTER TABLE ${table.name} 
            ADD COLUMN push_body VARCHAR(120)
          `));
        }
        
        // Backfill data from push_content if it exists
        if (contentExists) {
          await tx.execute(sql.raw(`
            UPDATE ${table.name}
            SET 
              push_title = COALESCE(push_title, LEFT(push_content, 50)),
              push_body = COALESCE(push_body, SUBSTRING(push_content FROM 51 FOR 120))
            WHERE push_content IS NOT NULL 
              AND (push_title IS NULL OR push_body IS NULL)
          `));
          
          // Drop old column
          await tx.execute(sql.raw(`
            ALTER TABLE ${table.name} 
            DROP COLUMN push_content
          `));
        }
        
        // Ensure correct constraint exists (drop old if present, add new)
        await tx.execute(sql.raw(`
          ALTER TABLE ${table.name}
          DROP CONSTRAINT IF EXISTS ${table.constraint}
        `));
        
        await tx.execute(sql.raw(`
          ALTER TABLE ${table.name}
          ADD CONSTRAINT ${table.constraint}
          CHECK (notification_type != 'push' OR (push_title IS NOT NULL AND push_body IS NOT NULL))
        `));
      });
      
      console.log(`[Schema Migration] ✓ Successfully migrated push notification fields for ${table.name}`);
    } catch (error) {
      console.error(`[Schema Migration] ✗ Failed to migrate push notification fields for ${table.name}:`, error);
      throw error;
    }
  }
  
  // Handle scheduled_notifications table (no constraint)
  const scheduledTable = 'scheduled_notifications';
  const titleExists = await columnExists(scheduledTable, 'push_title');
  const bodyExists = await columnExists(scheduledTable, 'push_body');
  const contentExists = await columnExists(scheduledTable, 'push_content');
  
  if (titleExists && bodyExists && !contentExists) {
    console.log(`[Schema Migration] ✓ Push notification fields already migrated for ${scheduledTable}`);
  } else {
    console.log(`[Schema Migration] Migrating push notification fields for ${scheduledTable}...`);
    try {
      await db.transaction(async (tx) => {
        if (!titleExists) {
          await tx.execute(sql.raw(`
            ALTER TABLE ${scheduledTable} 
            ADD COLUMN push_title VARCHAR(50)
          `));
        }
        
        if (!bodyExists) {
          await tx.execute(sql.raw(`
            ALTER TABLE ${scheduledTable} 
            ADD COLUMN push_body VARCHAR(120)
          `));
        }
        
        if (contentExists) {
          await tx.execute(sql.raw(`
            UPDATE ${scheduledTable}
            SET 
              push_title = COALESCE(push_title, LEFT(push_content, 50)),
              push_body = COALESCE(push_body, SUBSTRING(push_content FROM 51 FOR 120))
            WHERE push_content IS NOT NULL 
              AND (push_title IS NULL OR push_body IS NULL)
          `));
          
          await tx.execute(sql.raw(`
            ALTER TABLE ${scheduledTable} 
            DROP COLUMN push_content
          `));
        }
      });
      
      console.log(`[Schema Migration] ✓ Successfully migrated push notification fields for ${scheduledTable}`);
    } catch (error) {
      console.error(`[Schema Migration] ✗ Failed to migrate push notification fields for ${scheduledTable}:`, error);
      throw error;
    }
  }
}

/**
 * Run all schema migrations
 * Called on server startup to ensure database schema is up to date
 */
export async function runSchemaMigrations(): Promise<void> {
  console.log('[Schema Migration] Starting schema migration checks...');
  
  try {
    // Add more migration checks here as needed
    await ensureSuperAdminColumn();
    await migratePushNotificationFields();
    
    console.log('[Schema Migration] All schema migrations completed successfully');
  } catch (error) {
    console.error('[Schema Migration] Schema migration failed:', error);
    // Don't throw - allow server to start even if migration fails
    // This prevents total outage if there's a migration issue
    console.error('[Schema Migration] WARNING: Server starting with incomplete schema migrations');
  }
}
