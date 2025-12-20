import type { FieldDefinition, SystemFieldType } from "./types";

export interface FieldCapabilities {
  supportsExpectedValue?: boolean;
  supportsValidationRules?: boolean;
  supportsConditionalLogic?: boolean;
  supportsOptions?: boolean;
  supportsPlaceholder?: boolean;
  supportsHelpText?: boolean;
  supportsLibraryPicker?: boolean;
}

export interface FieldAdapter<TDomainField> {
  context: string;
  capabilities: FieldCapabilities;
  
  allowedFieldTypes: SystemFieldType[];
  
  mapToFieldDefinition: (domainField: TDomainField, index: number) => FieldDefinition;
  
  mapFromFieldDefinition: (field: FieldDefinition) => Partial<TDomainField>;
  
  mapSystemFieldType?: (systemType: SystemFieldType) => string;
  
  mapToSystemFieldType?: (contextType: string) => SystemFieldType;
}

export const ALL_SYSTEM_FIELD_TYPES: SystemFieldType[] = [
  "boolean", "number", "short_text", "long_text", "date",
  "single_select", "multi_select", "dropdown",
  "email", "phone", "url", "currency", "percentage",
  "user_select", "file_upload", "image_upload"
];

export const FIELD_TYPE_ALIASES: Record<string, SystemFieldType> = {
  yes_no: "boolean",
  single_choice: "single_select",
  multi_choice: "multi_select",
  text: "short_text",
  textarea: "long_text",
};

export const REVERSE_FIELD_TYPE_ALIASES: Record<SystemFieldType, string[]> = {
  boolean: ["yes_no", "boolean"],
  single_select: ["single_choice", "single_select"],
  multi_select: ["multi_choice", "multi_select"],
  short_text: ["text", "short_text"],
  long_text: ["textarea", "long_text"],
  number: ["number"],
  date: ["date"],
  email: ["email"],
  phone: ["phone"],
  url: ["url"],
  currency: ["currency"],
  percentage: ["percentage"],
  user_select: ["user_select"],
  file_upload: ["file_upload"],
  image_upload: ["image_upload"],
  dropdown: ["dropdown"],
};

export function normalizeFieldType(contextType: string): SystemFieldType {
  const alias = FIELD_TYPE_ALIASES[contextType];
  if (alias) return alias;
  
  if (Object.keys(REVERSE_FIELD_TYPE_ALIASES).includes(contextType as SystemFieldType)) {
    return contextType as SystemFieldType;
  }
  
  return "short_text";
}

export function denormalizeFieldType(systemType: SystemFieldType, targetAlias?: string): string {
  if (targetAlias) {
    const aliases = REVERSE_FIELD_TYPE_ALIASES[systemType];
    if (aliases?.includes(targetAlias)) return targetAlias;
  }
  return systemType;
}

export const changeReasonCustomFieldAdapter: FieldAdapter<{
  id?: string;
  fieldName: string;
  fieldType: string;
  description?: string | null;
  isRequired?: boolean;
  order: number;
  options?: string[] | null;
  placeholder?: string | null;
}> = {
  context: "change_reason_custom_field",
  
  capabilities: {
    supportsExpectedValue: false,
    supportsValidationRules: false,
    supportsConditionalLogic: false,
    supportsOptions: true,
    supportsPlaceholder: true,
    supportsHelpText: true,
    supportsLibraryPicker: true,
  },
  
  allowedFieldTypes: ALL_SYSTEM_FIELD_TYPES,
  
  mapToFieldDefinition: (domainField, index) => ({
    id: domainField.id,
    fieldName: domainField.fieldName,
    fieldType: normalizeFieldType(domainField.fieldType),
    description: domainField.description || "",
    isRequired: domainField.isRequired || false,
    order: domainField.order ?? index,
    options: domainField.options || [],
    placeholder: domainField.placeholder || "",
  }),
  
  mapFromFieldDefinition: (field) => ({
    fieldName: field.fieldName,
    fieldType: denormalizeFieldType(field.fieldType),
    description: field.description || undefined,
    isRequired: field.isRequired,
    order: field.order,
    options: field.options?.length ? field.options : undefined,
    placeholder: field.placeholder || undefined,
  }),
};

export const requestTemplateQuestionAdapter: FieldAdapter<{
  id?: string;
  label: string;
  questionType: string;
  helpText?: string | null;
  isRequired: boolean;
  sortOrder: number;
  options?: string[] | null;
  validationRules?: Record<string, any> | null;
  conditionalLogic?: Record<string, any> | null;
  sectionId?: string | null;
}> = {
  context: "request_template_question",
  
  capabilities: {
    supportsExpectedValue: false,
    supportsValidationRules: true,
    supportsConditionalLogic: true,
    supportsOptions: true,
    supportsPlaceholder: false,
    supportsHelpText: true,
    supportsLibraryPicker: true,
  },
  
  allowedFieldTypes: ALL_SYSTEM_FIELD_TYPES,
  
  mapToFieldDefinition: (domainField, index) => ({
    id: domainField.id,
    fieldName: domainField.label,
    fieldType: normalizeFieldType(domainField.questionType),
    description: domainField.helpText || "",
    isRequired: domainField.isRequired,
    order: domainField.sortOrder ?? index,
    options: domainField.options || [],
    validationRules: domainField.validationRules || undefined,
    conditionalLogic: domainField.conditionalLogic as any || null,
    sectionId: domainField.sectionId || null,
  }),
  
  mapFromFieldDefinition: (field) => ({
    label: field.fieldName,
    questionType: denormalizeFieldType(field.fieldType, 
      field.fieldType === "boolean" ? "yes_no" :
      field.fieldType === "single_select" ? "single_choice" :
      field.fieldType === "multi_select" ? "multi_choice" :
      undefined
    ),
    helpText: field.description || undefined,
    isRequired: field.isRequired,
    sortOrder: field.order,
    options: field.options?.length ? field.options : undefined,
    validationRules: field.validationRules,
    conditionalLogic: field.conditionalLogic || undefined,
    sectionId: field.sectionId || undefined,
  }),
  
  mapSystemFieldType: (systemType) => {
    const mapping: Record<SystemFieldType, string> = {
      boolean: "yes_no",
      single_select: "single_choice",
      multi_select: "multi_choice",
      short_text: "short_text",
      long_text: "long_text",
      number: "number",
      date: "date",
      email: "email",
      phone: "short_text",
      url: "short_text",
      currency: "number",
      percentage: "number",
      user_select: "dropdown",
      file_upload: "file_upload",
      image_upload: "file_upload",
      dropdown: "dropdown",
    };
    return mapping[systemType] || "short_text";
  },
  
  mapToSystemFieldType: (contextType) => normalizeFieldType(contextType),
};

export const clientTaskQuestionAdapter: FieldAdapter<{
  id?: string;
  label: string;
  questionType: string;
  helpText?: string | null;
  isRequired: boolean;
  order: number;
  options?: string[] | null;
  placeholder?: string | null;
  conditionalLogic?: Record<string, any> | null;
  libraryFieldId?: string | null;
  sectionId?: string | null;
}> = {
  context: "client_task_question",
  
  capabilities: {
    supportsExpectedValue: false,
    supportsValidationRules: false,
    supportsConditionalLogic: true,
    supportsOptions: true,
    supportsPlaceholder: true,
    supportsHelpText: true,
    supportsLibraryPicker: true,
  },
  
  allowedFieldTypes: ALL_SYSTEM_FIELD_TYPES,
  
  mapToFieldDefinition: (domainField, index) => ({
    id: domainField.id,
    fieldName: domainField.label,
    fieldType: normalizeFieldType(domainField.questionType),
    description: domainField.helpText || "",
    isRequired: domainField.isRequired,
    order: domainField.order ?? index,
    options: domainField.options || [],
    placeholder: domainField.placeholder || "",
    libraryFieldId: domainField.libraryFieldId,
    conditionalLogic: domainField.conditionalLogic as any || null,
    sectionId: domainField.sectionId || null,
  }),
  
  mapFromFieldDefinition: (field) => ({
    label: field.fieldName,
    questionType: denormalizeFieldType(field.fieldType,
      field.fieldType === "boolean" ? "yes_no" :
      field.fieldType === "single_select" ? "single_choice" :
      field.fieldType === "multi_select" ? "multi_choice" :
      undefined
    ),
    helpText: field.description || undefined,
    isRequired: field.isRequired,
    order: field.order,
    options: field.options?.length ? field.options : undefined,
    placeholder: field.placeholder || undefined,
    libraryFieldId: field.libraryFieldId,
    conditionalLogic: field.conditionalLogic || null,
    sectionId: field.sectionId || null,
  }),
  
  mapSystemFieldType: (systemType) => {
    const mapping: Record<SystemFieldType, string> = {
      boolean: "yes_no",
      single_select: "single_choice",
      multi_select: "multi_choice",
      short_text: "short_text",
      long_text: "long_text",
      number: "number",
      date: "date",
      email: "email",
      phone: "short_text",
      url: "short_text",
      currency: "number",
      percentage: "number",
      user_select: "dropdown",
      file_upload: "file_upload",
      image_upload: "file_upload",
      dropdown: "dropdown",
    };
    return mapping[systemType] || "short_text";
  },
  
  mapToSystemFieldType: (contextType) => normalizeFieldType(contextType),
};

export const stageApprovalFieldAdapter: FieldAdapter<{
  id?: string;
  fieldName: string;
  fieldType: string;
  description?: string | null;
  isRequired: boolean;
  order: number;
  options?: string[] | null;
  libraryFieldId?: string | null;
  expectedValueBoolean?: boolean | null;
  expectedValueNumber?: number | null;
  comparisonType?: "equal_to" | "less_than" | "greater_than" | null;
}> = {
  context: "stage_approval_field",
  
  capabilities: {
    supportsExpectedValue: true,
    supportsValidationRules: false,
    supportsConditionalLogic: false,
    supportsOptions: true,
    supportsPlaceholder: false,
    supportsHelpText: true,
    supportsLibraryPicker: true,
  },
  
  allowedFieldTypes: ALL_SYSTEM_FIELD_TYPES,
  
  mapToFieldDefinition: (domainField, index) => ({
    id: domainField.id,
    fieldName: domainField.fieldName,
    fieldType: normalizeFieldType(domainField.fieldType),
    description: domainField.description || "",
    isRequired: domainField.isRequired,
    order: domainField.order ?? index,
    options: domainField.options || [],
    libraryFieldId: domainField.libraryFieldId,
    expectedValueBoolean: domainField.expectedValueBoolean,
    expectedValueNumber: domainField.expectedValueNumber,
    comparisonType: domainField.comparisonType,
  }),
  
  mapFromFieldDefinition: (field) => ({
    fieldName: field.fieldName,
    fieldType: field.fieldType,
    description: field.description || "",
    isRequired: field.isRequired,
    order: field.order,
    options: field.options || [],
    libraryFieldId: field.libraryFieldId,
    expectedValueBoolean: field.expectedValueBoolean,
    expectedValueNumber: field.expectedValueNumber,
    comparisonType: field.comparisonType,
  }),
};

export const signatureFieldAdapter: FieldAdapter<{
  id?: string;
  fieldName: string;
  fieldType: string;
  description?: string | null;
  isRequired: boolean;
  order: number;
  options?: string[] | null;
  placeholder?: string | null;
}> = {
  context: "signature_field",
  
  capabilities: {
    supportsExpectedValue: false,
    supportsValidationRules: false,
    supportsConditionalLogic: false,
    supportsOptions: true,
    supportsPlaceholder: true,
    supportsHelpText: true,
    supportsLibraryPicker: false,
  },
  
  allowedFieldTypes: ALL_SYSTEM_FIELD_TYPES,
  
  mapToFieldDefinition: (domainField, index) => ({
    id: domainField.id,
    fieldName: domainField.fieldName,
    fieldType: normalizeFieldType(domainField.fieldType),
    description: domainField.description || "",
    isRequired: domainField.isRequired,
    order: domainField.order ?? index,
    options: domainField.options || [],
    placeholder: domainField.placeholder || "",
  }),
  
  mapFromFieldDefinition: (field) => ({
    fieldName: field.fieldName,
    fieldType: field.fieldType,
    description: field.description || undefined,
    isRequired: field.isRequired,
    order: field.order,
    options: field.options?.length ? field.options : undefined,
    placeholder: field.placeholder || undefined,
  }),
};

export const serviceUdfAdapter: FieldAdapter<{
  id?: string;
  fieldName: string;
  fieldType: string;
  description?: string | null;
  isRequired: boolean;
  order: number;
  options?: string[] | null;
  defaultValue?: any;
}> = {
  context: "service_udf",
  
  capabilities: {
    supportsExpectedValue: false,
    supportsValidationRules: false,
    supportsConditionalLogic: false,
    supportsOptions: true,
    supportsPlaceholder: false,
    supportsHelpText: true,
    supportsLibraryPicker: true,
  },
  
  allowedFieldTypes: ALL_SYSTEM_FIELD_TYPES,
  
  mapToFieldDefinition: (domainField, index) => ({
    id: domainField.id,
    fieldName: domainField.fieldName,
    fieldType: normalizeFieldType(domainField.fieldType),
    description: domainField.description || "",
    isRequired: domainField.isRequired,
    order: domainField.order ?? index,
    options: domainField.options || [],
    defaultValue: domainField.defaultValue,
  }),
  
  mapFromFieldDefinition: (field) => ({
    fieldName: field.fieldName,
    fieldType: field.fieldType,
    description: field.description || undefined,
    isRequired: field.isRequired,
    order: field.order,
    options: field.options?.length ? field.options : undefined,
    defaultValue: field.defaultValue,
  }),
};

export const campaignPageFieldAdapter: FieldAdapter<{
  id?: string;
  fieldName: string;
  fieldType: string;
  description?: string | null;
  isRequired: boolean;
  order: number;
  options?: string[] | null;
  placeholder?: string | null;
}> = {
  context: "campaign_page_field",
  
  capabilities: {
    supportsExpectedValue: false,
    supportsValidationRules: false,
    supportsConditionalLogic: false,
    supportsOptions: true,
    supportsPlaceholder: true,
    supportsHelpText: true,
    supportsLibraryPicker: true,
  },
  
  allowedFieldTypes: ALL_SYSTEM_FIELD_TYPES,
  
  mapToFieldDefinition: (domainField, index) => ({
    id: domainField.id,
    fieldName: domainField.fieldName,
    fieldType: normalizeFieldType(domainField.fieldType),
    description: domainField.description || "",
    isRequired: domainField.isRequired,
    order: domainField.order ?? index,
    options: domainField.options || [],
    placeholder: domainField.placeholder || "",
  }),
  
  mapFromFieldDefinition: (field) => ({
    fieldName: field.fieldName,
    fieldType: field.fieldType,
    description: field.description || undefined,
    isRequired: field.isRequired,
    order: field.order,
    options: field.options?.length ? field.options : undefined,
    placeholder: field.placeholder || undefined,
  }),
};
