/**
 * TEMPORARY SHIM: Relations re-exported from legacy schema
 * 
 * These relation definitions depend on tables from other domains (Users, Clients, Services)
 * that need cross-domain references. Once all domains are extracted (Stages 5+),
 * these relations will be re-implemented with clean intra-module imports.
 * 
 * This shim maintains backward compatibility during the staged migration.
 */
export {
  projectsRelations,
  projectChronologyRelations,
  projectTypesRelations,
  kanbanStagesRelations,
  changeReasonsRelations,
  stageReasonMapsRelations,
  stageApprovalsRelations,
  stageApprovalFieldsRelations,
  stageApprovalResponsesRelations,
  projectSchedulingHistoryRelations,
  reasonCustomFieldsRelations,
  reasonFieldResponsesRelations,
} from '../../schema';
