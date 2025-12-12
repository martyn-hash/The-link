/**
 * Modular Schema Barrel Export
 * 
 * This barrel file exports all schema definitions from domain-specific modules.
 * The legacy monolithic schema.ts is deprecated - all new code should import from here.
 * 
 * Domain modules are organized by business domain:
 * - enums: Shared enumeration types
 * - common: Helper functions and utilities
 * - users: User management, sessions, preferences
 * - clients: Client/company entities
 * - services: Service definitions and assignments
 * - projects: Project management, stages, approvals
 * - communications: Messaging, threads
 * - documents: Document storage, folders, signatures
 * - email: Email integration, threading
 * - tasks: Task management, time tracking
 * - requests: Client request templates
 * - notifications: Push notifications, scheduled alerts
 */

// Enums (shared across domains)
export * from './enums';

// Common utilities
export * from './common/helpers';
export * from './common/imports';

// Domain modules (in dependency order)
export * from './users';
export * from './clients';
export * from './services';
export * from './projects';
export * from './communications';
export * from './documents';
export * from './email';
export * from './tasks';
export * from './requests';
export * from './notifications';
export * from './webhooks';
export * from './errors';
export * from './qbo';
export * from './calendar';
export * from './queries';
export * from './ai-interactions';
export * from './audit';
