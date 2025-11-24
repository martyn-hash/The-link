/**
 * Projects Domain - Barrel Export
 * 
 * Stage 4: Projects & Chronology (13 methods)
 * - ProjectStorage: 5 methods (core CRUD, filtering)
 * - ProjectChronologyStorage: 8 methods (chronology tracking, complex queries, analytics)
 * 
 * Stage 5: Projects Configuration (51 methods)
 * - ProjectTypesStorage: 9 methods (project type CRUD, dependencies, force delete)
 * - ProjectStagesStorage: 28 methods (kanban stages, validation, change reasons, mappings, custom fields)
 * - ProjectApprovalsStorage: 14 methods (stage approvals, fields, responses, validation)
 */

// Storage classes
export { ProjectStorage } from './projectStorage.js';
export { ProjectChronologyStorage } from './projectChronologyStorage.js';
export { ProjectTypesStorage } from './projectTypesStorage.js';
export { ProjectStagesStorage } from './projectStagesStorage.js';
export { ProjectApprovalsStorage } from './projectApprovalsStorage.js';

// Helper functions for cross-domain dependencies
export { getProjectTypeByName } from './projectTypesStorage.js';
export { 
  validateStageReasonMapping, 
  validateRequiredFields, 
  getDefaultStage, 
  validateProjectStatus 
} from './projectStagesStorage.js';
