export interface EditingStage {
  id?: string;
  name: string;
  assignedRole?: string;
  assignedWorkRoleId?: string;
  assignedUserId?: string;
  order: number;
  color: string;
  maxInstanceTime?: number;
  maxTotalTime?: number;
  stageApprovalId?: string;
  canBeFinalStage?: boolean;
}

export interface EditingReason {
  id?: string;
  reason: string;
  description: string;
  showCountInProject: boolean;
  countLabel: string;
  stageApprovalId?: string;
}

export interface EditingStageApproval {
  id?: string;
  name: string;
  description: string;
}

export interface EditingStageApprovalField {
  id?: string;
  stageApprovalId: string;
  fieldName: string;
  fieldType: 'boolean' | 'number' | 'long_text' | 'multi_select';
  isRequired: boolean;
  order: number;
  placeholder?: string;
  expectedValueBoolean?: boolean;
  comparisonType?: 'equal_to' | 'less_than' | 'greater_than';
  expectedValueNumber?: number;
  options?: string[];
}

export interface RoleOption {
  value: string;
  label: string;
}
