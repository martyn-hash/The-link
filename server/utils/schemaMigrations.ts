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
 * Run all schema migrations
 * Called on server startup to ensure database schema is up to date
 */
export async function runSchemaMigrations(): Promise<void> {
  console.log('[Schema Migration] Starting schema migration checks...');
  
  try {
    // Add more migration checks here as needed
    await ensureSuperAdminColumn();
    
    console.log('[Schema Migration] All schema migrations completed successfully');
  } catch (error) {
    console.error('[Schema Migration] Schema migration failed:', error);
    // Don't throw - allow server to start even if migration fails
    // This prevents total outage if there's a migration issue
    console.error('[Schema Migration] WARNING: Server starting with incomplete schema migrations');
  }
}
