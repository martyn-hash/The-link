import { z } from 'zod';
import {
  projects,
  projectChronology,
  projectTypes,
  kanbanStages,
  changeReasons,
  stageApprovals,
  stageApprovalFields,
  stageApprovalResponses,
  stageReasonMaps,
  reasonCustomFields,
  reasonFieldResponses,
  projectSchedulingHistory,
  schedulingRunLogs,
} from './tables';
import {
  insertProjectSchema,
  updateProjectSchema,
  insertProjectChronologySchema,
  insertProjectTypeSchema,
  updateProjectTypeSchema,
  insertKanbanStageSchema,
  updateKanbanStageSchema,
  insertChangeReasonSchema,
  updateChangeReasonSchema,
  insertStageApprovalSchema,
  updateStageApprovalSchema,
  insertStageApprovalFieldSchema,
  updateStageApprovalFieldSchema,
  insertStageApprovalResponseSchema,
  insertStageReasonMapSchema,
  insertReasonCustomFieldSchema,
  insertReasonFieldResponseSchema,
  insertProjectSchedulingHistorySchema,
  insertSchedulingRunLogSchema,
  completeProjectSchema,
  updateProjectStatusSchema,
  csvProjectSchema,
} from './schemas';
import type { Client } from '../clients/types';
import type { User } from '../users/types';
import type { Service } from '../services/types';

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;

export type ProjectChronology = typeof projectChronology.$inferSelect;
export type InsertProjectChronology = z.infer<typeof insertProjectChronologySchema>;

export type ProjectType = typeof projectTypes.$inferSelect;
export type InsertProjectType = z.infer<typeof insertProjectTypeSchema>;
export type UpdateProjectType = z.infer<typeof updateProjectTypeSchema>;

export type KanbanStage = typeof kanbanStages.$inferSelect;
export type InsertKanbanStage = z.infer<typeof insertKanbanStageSchema>;
export type UpdateKanbanStage = z.infer<typeof updateKanbanStageSchema>;

export type ChangeReason = typeof changeReasons.$inferSelect;
export type InsertChangeReason = z.infer<typeof insertChangeReasonSchema>;
export type UpdateChangeReason = z.infer<typeof updateChangeReasonSchema>;

export type StageApproval = typeof stageApprovals.$inferSelect;
export type InsertStageApproval = z.infer<typeof insertStageApprovalSchema>;
export type UpdateStageApproval = z.infer<typeof updateStageApprovalSchema>;

export type StageApprovalField = typeof stageApprovalFields.$inferSelect;
export type InsertStageApprovalField = z.infer<typeof insertStageApprovalFieldSchema>;
export type UpdateStageApprovalField = z.infer<typeof updateStageApprovalFieldSchema>;

export type StageApprovalResponse = typeof stageApprovalResponses.$inferSelect;
export type InsertStageApprovalResponse = z.infer<typeof insertStageApprovalResponseSchema>;

export type StageReasonMap = typeof stageReasonMaps.$inferSelect;
export type InsertStageReasonMap = z.infer<typeof insertStageReasonMapSchema>;

export type ReasonCustomField = typeof reasonCustomFields.$inferSelect;
export type InsertReasonCustomField = z.infer<typeof insertReasonCustomFieldSchema>;

export type ReasonFieldResponse = typeof reasonFieldResponses.$inferSelect;
export type InsertReasonFieldResponse = z.infer<typeof insertReasonFieldResponseSchema>;

export type ProjectSchedulingHistory = typeof projectSchedulingHistory.$inferSelect;
export type InsertProjectSchedulingHistory = z.infer<typeof insertProjectSchedulingHistorySchema>;

export type SchedulingRunLog = typeof schedulingRunLogs.$inferSelect;
export type InsertSchedulingRunLog = z.infer<typeof insertSchedulingRunLogSchema>;

export type CompleteProject = z.infer<typeof completeProjectSchema>;
export type UpdateProjectStatus = z.infer<typeof updateProjectStatusSchema>;
export type CSVProject = z.infer<typeof csvProjectSchema>;

export {
  ProjectView,
  InsertProjectView,
  UserProjectPreference,
  InsertUserProjectPreference,
  UpdateUserProjectPreference,
} from '../users/types';

// Backward compatibility aliases (legacy used plural names)
export type SchedulingRunLogs = SchedulingRunLog;
export type InsertSchedulingRunLogs = InsertSchedulingRunLog;

// ProjectWithRelations type for projects with expanded relations
export type ProjectWithRelations = Project & {
  client: Client;
  bookkeeper: User;
  clientManager: User;
  currentAssignee?: User;
  projectOwner?: User;
  projectType: ProjectType & {
    service?: Service;
  };
  chronology: (ProjectChronology & { 
    assignee?: User;
    changedBy?: User;
    fieldResponses: (ReasonFieldResponse & { customField: ReasonCustomField })[];
  })[];
  stageApprovalResponses?: (StageApprovalResponse & { 
    field: StageApprovalField;
  })[];
  progressMetrics?: {
    reasonId: string;
    label: string;
    total: number;
  }[];
  stageRoleAssignee?: User;
};
