// ============================================================================
// STAGE 0: Foundation - Simple re-export (temporary)
// ============================================================================
// This is a temporary facade that maintains compatibility while we build
// the new modular structure. It will evolve through stages 1-14 and be
// finalized in stage 15.

// IMPORTANT: The IStorage interface MUST be re-exported at all times
// This ensures routes/services can continue using the same import:
// import { IStorage, DatabaseStorage } from './storage'
import { IStorage, DatabaseStorage, storage, initializeDefaultNotificationTemplates } from '../storage';

export { IStorage, DatabaseStorage, storage, initializeDefaultNotificationTemplates };

// Export shared types (new modular architecture)
export * from './base/types';

// ============================================================================
// EVOLUTION ACROSS STAGES:
// ============================================================================
// Stage 1+: Import new domain storage classes and create composite DatabaseStorage
// Stage 15: Move IStorage to ./base/IStorage.ts and fully remove old storage.ts
// ============================================================================