import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as tables from "@shared/schema/drizzle";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const schemaWithRelations = {
  ...tables,
  ...Object.fromEntries(
    Object.entries(schema).filter(([key, value]) => {
      if (value === null || value === undefined) return false;
      if (key.endsWith('Relations')) return true;
      return false;
    })
  ),
};

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema: schemaWithRelations });