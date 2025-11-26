/**
 * Drizzle Kit Compatibility Shim
 * 
 * This file exists to satisfy drizzle.config.ts which expects ./shared/schema.ts
 * All actual schema definitions are in the modular ./shared/schema/ directory
 * 
 * For application code, import from '@shared/schema' (the barrel export)
 */
export * from './schema/index';
