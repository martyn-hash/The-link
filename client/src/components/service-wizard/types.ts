import type { UdfDefinition, ServiceClientType, WorkRole, Service } from "@shared/schema";

export interface ServiceWizardFormData {
  id?: string;
  name: string;
  description: string;
  applicableClientTypes: ServiceClientType;
  isStaticService: boolean;
  isCompaniesHouseConnected: boolean;
  chStartDateField: string;
  chDueDateField: string;
  chTargetDeliveryDaysOffset: number | null;
  isVatService: boolean;
  roleIds: string[];
  priorityIndicatorTargets: string[];
  udfDefinitions: UdfDefinition[];
  isActive: boolean;
}

export interface ServiceWithDetails extends Service {
  roles: WorkRole[];
  projectType?: { name: string; id: string; description?: string; active: boolean };
}

export interface ServiceWizardProps {
  mode: "create" | "edit";
  initialData?: ServiceWithDetails;
  onSave: (data: ServiceWizardFormData) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export const WIZARD_STEPS = [
  { id: 1, name: "Basic Details", description: "Name and client types" },
  { id: 2, name: "Service Settings", description: "Integrations and features" },
  { id: 3, name: "Work Roles", description: "Team assignments" },
  { id: 4, name: "Display Settings", description: "Priority indicators" },
  { id: 5, name: "Custom Fields", description: "Data collection" },
] as const;

export type WizardStepId = typeof WIZARD_STEPS[number]["id"];

export const CH_DATE_FIELD_OPTIONS = [
  { value: "accountsNextDueDate", label: "Accounts Next Due Date" },
  { value: "accountsNextMadeUpToDate", label: "Accounts Next Made Up To Date" },
  { value: "confirmationStatementNextDue", label: "Confirmation Statement Next Due" },
  { value: "confirmationStatementNextMadeUpTo", label: "Confirmation Statement Next Made Up To" },
];

export const DEFAULT_WIZARD_FORM_DATA: ServiceWizardFormData = {
  name: "",
  description: "",
  applicableClientTypes: "company",
  isStaticService: false,
  isCompaniesHouseConnected: false,
  chStartDateField: "",
  chDueDateField: "",
  chTargetDeliveryDaysOffset: null,
  isVatService: false,
  roleIds: [],
  priorityIndicatorTargets: [],
  udfDefinitions: [],
  isActive: true,
};
