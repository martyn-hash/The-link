import { 
  ToggleLeft, Hash, Type, FileText, Calendar, CircleDot, CheckSquare,
  ImageIcon, Mail, Phone, Link, DollarSign, Percent, Users, Upload, ChevronDown
} from "lucide-react";

export const FIELD_TYPES = [
  { type: "boolean", label: "Yes/No", icon: ToggleLeft, color: "#84cc16", category: "basic" },
  { type: "number", label: "Number", icon: Hash, color: "#22c55e", category: "basic" },
  { type: "short_text", label: "Short Text", icon: Type, color: "#3b82f6", category: "basic" },
  { type: "long_text", label: "Long Text", icon: FileText, color: "#8b5cf6", category: "basic" },
  { type: "date", label: "Date", icon: Calendar, color: "#f59e0b", category: "basic" },
  { type: "single_select", label: "Single Select", icon: CircleDot, color: "#ec4899", category: "selection" },
  { type: "multi_select", label: "Multi Select", icon: CheckSquare, color: "#14b8a6", category: "selection" },
  { type: "dropdown", label: "Dropdown", icon: ChevronDown, color: "#6366f1", category: "selection" },
  { type: "email", label: "Email", icon: Mail, color: "#06b6d4", category: "contact" },
  { type: "phone", label: "Phone", icon: Phone, color: "#10b981", category: "contact" },
  { type: "url", label: "URL", icon: Link, color: "#8b5cf6", category: "contact" },
  { type: "currency", label: "Currency", icon: DollarSign, color: "#22c55e", category: "numeric" },
  { type: "percentage", label: "Percentage", icon: Percent, color: "#f59e0b", category: "numeric" },
  { type: "user_select", label: "User Select", icon: Users, color: "#3b82f6", category: "selection" },
  { type: "file_upload", label: "File Upload", icon: Upload, color: "#64748b", category: "files" },
  { type: "image_upload", label: "Image Upload", icon: ImageIcon, color: "#0ea5e9", category: "files" },
] as const;

export type SystemFieldType = typeof FIELD_TYPES[number]["type"];

export interface ConditionalLogicCondition {
  questionId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty';
  value?: string | number | boolean | string[];
}

export interface ConditionalLogic {
  showIf?: ConditionalLogicCondition;
  logic?: 'and' | 'or';
  conditions?: ConditionalLogicCondition[];
}

export interface FieldDefinition {
  id?: string;
  tempId?: string;
  fieldName: string;
  fieldType: SystemFieldType;
  description?: string;
  isRequired: boolean;
  order: number;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  libraryFieldId?: string | null;
  validationRules?: Record<string, any>;
  defaultValue?: any;
  expectedValueBoolean?: boolean | null;
  expectedValueNumber?: number | null;
  comparisonType?: "equal_to" | "less_than" | "greater_than" | null;
  conditionalLogic?: ConditionalLogic | null;
  sectionId?: string | null;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  order: number;
  isCollapsible?: boolean;
  fields: FieldDefinition[];
}

export function getFieldTypeInfo(fieldType: string) {
  return FIELD_TYPES.find(ft => ft.type === fieldType) || {
    type: fieldType,
    label: fieldType,
    icon: Type,
    color: "#6b7280",
    category: "basic"
  };
}

export function createEmptyField(fieldType: SystemFieldType = "short_text", order: number = 0): FieldDefinition {
  return {
    tempId: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    fieldName: "",
    fieldType,
    description: "",
    isRequired: false,
    order,
    options: [],
    libraryFieldId: null,
  };
}
