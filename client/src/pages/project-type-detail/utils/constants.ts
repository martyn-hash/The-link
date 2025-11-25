import type { EditingStage, EditingReason, EditingStageApproval, EditingStageApprovalField } from './types';

export const DEFAULT_STAGE: EditingStage = {
  name: "",
  assignedRole: "client_manager",
  order: 0,
  color: "#6b7280",
  canBeFinalStage: false,
};

export const DEFAULT_REASON: EditingReason = {
  reason: "",
  description: "",
  showCountInProject: false,
  countLabel: "",
  stageApprovalId: undefined,
};

export const DEFAULT_STAGE_APPROVAL: EditingStageApproval = { 
  name: "", 
  description: "" 
};

export const DEFAULT_STAGE_APPROVAL_FIELD: EditingStageApprovalField = { 
  stageApprovalId: "", 
  fieldName: "", 
  fieldType: "boolean", 
  isRequired: false, 
  order: 0 
};

export const SYSTEM_ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "client_manager", label: "Client Manager" },
  { value: "bookkeeper", label: "Bookkeeper" },
];

export const STAGE_COLORS = [
  "#6b7280", "#ef4444", "#f97316", "#eab308", 
  "#22c55e", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"
];
