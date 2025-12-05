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
 * Add date_reference column to project_type_notifications and scheduled_notifications tables
 */
async function ensureDateReferenceColumn(): Promise<void> {
  // Create enum type if it doesn't exist
  try {
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'date_reference') THEN
          CREATE TYPE date_reference AS ENUM ('start_date', 'due_date');
        END IF;
      END$$;
    `);
    console.log('[Schema Migration] ✓ date_reference enum type ensured');
  } catch (error) {
    console.error('[Schema Migration] ✗ Failed to create date_reference enum:', error);
    throw error;
  }
  
  // Add date_reference column to project_type_notifications
  const ptnExists = await columnExists('project_type_notifications', 'date_reference');
  if (!ptnExists) {
    console.log('[Schema Migration] Adding date_reference column to project_type_notifications...');
    try {
      await db.execute(sql`
        ALTER TABLE project_type_notifications 
        ADD COLUMN date_reference date_reference;
      `);
      console.log('[Schema Migration] ✓ Added date_reference to project_type_notifications');
    } catch (error) {
      console.error('[Schema Migration] ✗ Failed to add date_reference to project_type_notifications:', error);
      throw error;
    }
  } else {
    console.log('[Schema Migration] ✓ date_reference column already exists in project_type_notifications');
  }
  
  // Add date_reference column to scheduled_notifications
  const snExists = await columnExists('scheduled_notifications', 'date_reference');
  if (!snExists) {
    console.log('[Schema Migration] Adding date_reference column to scheduled_notifications...');
    try {
      await db.execute(sql`
        ALTER TABLE scheduled_notifications 
        ADD COLUMN date_reference date_reference;
      `);
      console.log('[Schema Migration] ✓ Added date_reference to scheduled_notifications');
      
      // Backfill date_reference for existing rows
      // Heuristic: If projectId is set, it's likely due_date; otherwise start_date
      console.log('[Schema Migration] Backfilling date_reference for existing scheduled_notifications...');
      await db.execute(sql`
        UPDATE scheduled_notifications
        SET date_reference = CASE
          WHEN project_id IS NOT NULL THEN 'due_date'::date_reference
          ELSE 'start_date'::date_reference
        END
        WHERE date_reference IS NULL;
      `);
      console.log('[Schema Migration] ✓ Backfilled date_reference for existing scheduled_notifications');
    } catch (error) {
      console.error('[Schema Migration] ✗ Failed to add/backfill date_reference to scheduled_notifications:', error);
      throw error;
    }
  } else {
    console.log('[Schema Migration] ✓ date_reference column already exists in scheduled_notifications');
    
    // Even if column exists, backfill any NULL values
    try {
      const result = await db.execute(sql`
        UPDATE scheduled_notifications
        SET date_reference = CASE
          WHEN project_id IS NOT NULL THEN 'due_date'::date_reference
          ELSE 'start_date'::date_reference
        END
        WHERE date_reference IS NULL;
      `);
      const rowCount = (result as any).rowCount || 0;
      if (rowCount > 0) {
        console.log(`[Schema Migration] ✓ Backfilled date_reference for ${rowCount} existing scheduled_notifications`);
      }
    } catch (error) {
      console.warn('[Schema Migration] ⚠️  Could not backfill date_reference:', error);
    }
  }
}

/**
 * Add notificationsActive column to project_types table if it doesn't exist
 */
async function ensureNotificationsActiveColumn(): Promise<void> {
  const exists = await columnExists('project_types', 'notifications_active');
  
  if (!exists) {
    console.log('[Schema Migration] Adding notifications_active column to project_types table...');
    try {
      await db.execute(sql`
        ALTER TABLE project_types 
        ADD COLUMN notifications_active BOOLEAN DEFAULT true;
      `);
      console.log('[Schema Migration] ✓ Successfully added notifications_active column');
    } catch (error) {
      console.error('[Schema Migration] ✗ Failed to add notifications_active column:', error);
      throw error;
    }
  } else {
    console.log('[Schema Migration] ✓ notifications_active column already exists in project_types');
  }
}

/**
 * Add receiveNotifications column to people table if it doesn't exist
 */
async function ensureReceiveNotificationsColumn(): Promise<void> {
  const exists = await columnExists('people', 'receive_notifications');
  
  if (!exists) {
    console.log('[Schema Migration] Adding receive_notifications column to people table...');
    try {
      await db.execute(sql`
        ALTER TABLE people 
        ADD COLUMN receive_notifications BOOLEAN DEFAULT true;
      `);
      console.log('[Schema Migration] ✓ Successfully added receive_notifications column');
    } catch (error) {
      console.error('[Schema Migration] ✗ Failed to add receive_notifications column:', error);
      throw error;
    }
  } else {
    console.log('[Schema Migration] ✓ receive_notifications column already exists in people');
  }
}

/**
 * Add firm settings columns to company_settings table if they don't exist
 */
async function ensureFirmSettingsColumns(): Promise<void> {
  const firmNameExists = await columnExists('company_settings', 'firm_name');
  const firmPhoneExists = await columnExists('company_settings', 'firm_phone');
  const firmEmailExists = await columnExists('company_settings', 'firm_email');
  const portalUrlExists = await columnExists('company_settings', 'portal_url');
  
  if (firmNameExists && firmPhoneExists && firmEmailExists && portalUrlExists) {
    console.log('[Schema Migration] ✓ Firm settings columns already exist in company_settings');
    return;
  }
  
  console.log('[Schema Migration] Adding firm settings columns to company_settings table...');
  
  try {
    await db.transaction(async (tx) => {
      if (!firmNameExists) {
        await tx.execute(sql`
          ALTER TABLE company_settings 
          ADD COLUMN firm_name VARCHAR DEFAULT 'The Link';
        `);
      }
      
      if (!firmPhoneExists) {
        await tx.execute(sql`
          ALTER TABLE company_settings 
          ADD COLUMN firm_phone VARCHAR;
        `);
      }
      
      if (!firmEmailExists) {
        await tx.execute(sql`
          ALTER TABLE company_settings 
          ADD COLUMN firm_email VARCHAR;
        `);
      }
      
      if (!portalUrlExists) {
        await tx.execute(sql`
          ALTER TABLE company_settings 
          ADD COLUMN portal_url VARCHAR;
        `);
      }
    });
    
    console.log('[Schema Migration] ✓ Successfully added firm settings columns to company_settings');
  } catch (error) {
    console.error('[Schema Migration] ✗ Failed to add firm settings columns:', error);
    throw error;
  }
}

/**
 * Add push_notifications_enabled column to company_settings table
 */
async function ensurePushNotificationsEnabledColumn(): Promise<void> {
  const exists = await columnExists('company_settings', 'push_notifications_enabled');
  
  if (exists) {
    console.log('[Schema Migration] ✓ push_notifications_enabled column already exists in company_settings');
    return;
  }
  
  console.log('[Schema Migration] Adding push_notifications_enabled column to company_settings...');
  try {
    await db.execute(sql`
      ALTER TABLE company_settings 
      ADD COLUMN push_notifications_enabled BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log('[Schema Migration] ✓ Successfully added push_notifications_enabled to company_settings');
  } catch (error) {
    console.error('[Schema Migration] ✗ Failed to add push_notifications_enabled to company_settings:', error);
    throw error;
  }
}

/**
 * Add can_make_services_inactive column to users table
 */
async function ensureCanMakeServicesInactiveColumn(): Promise<void> {
  const exists = await columnExists('users', 'can_make_services_inactive');
  
  if (!exists) {
    console.log('[Schema Migration] Adding can_make_services_inactive column to users table...');
    try {
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN can_make_services_inactive BOOLEAN DEFAULT false;
      `);
      console.log('[Schema Migration] ✓ Successfully added can_make_services_inactive column');
    } catch (error) {
      console.error('[Schema Migration] ✗ Failed to add can_make_services_inactive column:', error);
      throw error;
    }
  } else {
    console.log('[Schema Migration] ✓ can_make_services_inactive column already exists in users');
  }
}

/**
 * Add inactive service columns to client_services table
 */
async function ensureInactiveServiceColumns(): Promise<void> {
  // Create enum type if it doesn't exist
  try {
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inactive_reason') THEN
          CREATE TYPE inactive_reason AS ENUM ('created_in_error', 'no_longer_required', 'client_doing_work_themselves');
        END IF;
      END$$;
    `);
    console.log('[Schema Migration] ✓ inactive_reason enum type ensured');
  } catch (error) {
    console.error('[Schema Migration] ✗ Failed to create inactive_reason enum:', error);
    throw error;
  }
  
  const reasonExists = await columnExists('client_services', 'inactive_reason');
  const atExists = await columnExists('client_services', 'inactive_at');
  const byUserExists = await columnExists('client_services', 'inactive_by_user_id');
  
  if (reasonExists && atExists && byUserExists) {
    console.log('[Schema Migration] ✓ Inactive service columns already exist in client_services');
    return;
  }
  
  console.log('[Schema Migration] Adding inactive service columns to client_services table...');
  
  try {
    await db.transaction(async (tx) => {
      if (!reasonExists) {
        await tx.execute(sql`
          ALTER TABLE client_services 
          ADD COLUMN inactive_reason inactive_reason;
        `);
      }
      
      if (!atExists) {
        await tx.execute(sql`
          ALTER TABLE client_services 
          ADD COLUMN inactive_at TIMESTAMP WITH TIME ZONE;
        `);
      }
      
      if (!byUserExists) {
        await tx.execute(sql`
          ALTER TABLE client_services 
          ADD COLUMN inactive_by_user_id VARCHAR REFERENCES users(id);
        `);
      }
    });
    
    console.log('[Schema Migration] ✓ Successfully added inactive service columns to client_services');
  } catch (error) {
    console.error('[Schema Migration] ✗ Failed to add inactive service columns:', error);
    throw error;
  }
}

/**
 * Add can_make_projects_inactive column to users table if it doesn't exist
 */
async function ensureCanMakeProjectsInactiveColumn(): Promise<void> {
  const exists = await columnExists('users', 'can_make_projects_inactive');
  
  if (!exists) {
    console.log('[Schema Migration] Adding missing can_make_projects_inactive column to users table...');
    try {
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN can_make_projects_inactive BOOLEAN DEFAULT false;
      `);
      console.log('[Schema Migration] ✓ Successfully added can_make_projects_inactive column');
    } catch (error) {
      console.error('[Schema Migration] ✗ Failed to add can_make_projects_inactive column:', error);
      throw error;
    }
  } else {
    console.log('[Schema Migration] ✓ can_make_projects_inactive column already exists');
  }
}

/**
 * Add ai_button_enabled column to company_settings table if it doesn't exist
 */
async function ensureAiButtonEnabledColumn(): Promise<void> {
  const exists = await columnExists('company_settings', 'ai_button_enabled');
  
  if (!exists) {
    console.log('[Schema Migration] Adding ai_button_enabled column to company_settings table...');
    try {
      await db.execute(sql`
        ALTER TABLE company_settings 
        ADD COLUMN ai_button_enabled BOOLEAN NOT NULL DEFAULT false;
      `);
      console.log('[Schema Migration] ✓ Successfully added ai_button_enabled column');
    } catch (error) {
      console.error('[Schema Migration] ✗ Failed to add ai_button_enabled column:', error);
      throw error;
    }
  } else {
    console.log('[Schema Migration] ✓ ai_button_enabled column already exists in company_settings');
  }
}

/**
 * Add inactive project columns to projects table
 * Uses the same inactive_reason enum created for client services
 */
async function ensureInactiveProjectColumns(): Promise<void> {
  // Ensure enum type exists (created by ensureInactiveServiceColumns)
  try {
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inactive_reason') THEN
          CREATE TYPE inactive_reason AS ENUM ('created_in_error', 'no_longer_required', 'client_doing_work_themselves');
        END IF;
      END$$;
    `);
    console.log('[Schema Migration] ✓ inactive_reason enum type ensured for projects');
  } catch (error) {
    console.error('[Schema Migration] ✗ Failed to ensure inactive_reason enum:', error);
    throw error;
  }
  
  const reasonExists = await columnExists('projects', 'inactive_reason');
  const atExists = await columnExists('projects', 'inactive_at');
  const byUserExists = await columnExists('projects', 'inactive_by_user_id');
  
  if (reasonExists && atExists && byUserExists) {
    console.log('[Schema Migration] ✓ Inactive project columns already exist in projects');
    return;
  }
  
  console.log('[Schema Migration] Adding inactive project columns to projects table...');
  
  try {
    await db.transaction(async (tx) => {
      if (!reasonExists) {
        await tx.execute(sql`
          ALTER TABLE projects 
          ADD COLUMN inactive_reason inactive_reason;
        `);
      }
      
      if (!atExists) {
        await tx.execute(sql`
          ALTER TABLE projects 
          ADD COLUMN inactive_at TIMESTAMP WITH TIME ZONE;
        `);
      }
      
      if (!byUserExists) {
        await tx.execute(sql`
          ALTER TABLE projects 
          ADD COLUMN inactive_by_user_id VARCHAR REFERENCES users(id);
        `);
      }
    });
    
    console.log('[Schema Migration] ✓ Successfully added inactive project columns to projects');
  } catch (error) {
    console.error('[Schema Migration] ✗ Failed to add inactive project columns:', error);
    throw error;
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
    await ensureDateReferenceColumn();
    await ensureFirmSettingsColumns();
    await ensurePushNotificationsEnabledColumn(); // Must run early - used by notification scheduler
    await ensureNotificationsActiveColumn();
    await ensureReceiveNotificationsColumn();
    await ensureCanMakeServicesInactiveColumn();
    await ensureInactiveServiceColumns();
    await ensureCanMakeProjectsInactiveColumn();
    await ensureInactiveProjectColumns();
    await ensureAiButtonEnabledColumn();
    
    console.log('[Schema Migration] All schema migrations completed successfully');
  } catch (error) {
    console.error('[Schema Migration] Schema migration failed:', error);
    // Don't throw - allow server to start even if migration fails
    // This prevents total outage if there's a migration issue
    console.error('[Schema Migration] WARNING: Server starting with incomplete schema migrations');
  }
}
