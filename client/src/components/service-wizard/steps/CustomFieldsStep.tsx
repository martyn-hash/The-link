import { useCallback, useMemo, useRef } from "react";
import { FieldBuilder, type FieldDefinition, type SystemFieldType } from "@/components/field-builder";
import type { ServiceWizardFormData } from "../types";
import type { UdfDefinition } from "@shared/schema";
import { nanoid } from "nanoid";

interface CustomFieldsStepProps {
  formData: ServiceWizardFormData;
  updateFormData: (updates: Partial<ServiceWizardFormData>) => void;
}

interface UdfMetadata {
  regex?: string;
  regexError?: string;
}

function udfToFieldDefinition(udf: UdfDefinition, index: number): FieldDefinition {
  return {
    id: udf.id,
    fieldName: udf.name,
    fieldType: udf.type as SystemFieldType,
    description: udf.description || "",
    isRequired: udf.required,
    order: index,
    options: udf.options || [],
    placeholder: udf.placeholder || "",
    helpText: udf.helpText || "",
    validationRules: udf.regex ? { regex: udf.regex, regexError: udf.regexError } : undefined,
  };
}

function fieldDefinitionToUdf(field: FieldDefinition, existingId?: string): UdfDefinition {
  const id = existingId || field.id || field.tempId || nanoid();
  const validationRules = field.validationRules as UdfMetadata | undefined;
  
  return {
    id,
    name: field.fieldName,
    type: field.fieldType as UdfDefinition["type"],
    required: field.isRequired,
    placeholder: field.placeholder || undefined,
    options: field.options?.length ? field.options : undefined,
    description: field.description || undefined,
    helpText: field.helpText || undefined,
    regex: validationRules?.regex || undefined,
    regexError: validationRules?.regexError || undefined,
  };
}

export function CustomFieldsStep({ formData, updateFormData }: CustomFieldsStepProps) {
  const idMapRef = useRef<Map<string, string>>(new Map());
  
  const fields = useMemo(() => {
    idMapRef.current.clear();
    return formData.udfDefinitions.map((udf, index) => {
      const field = udfToFieldDefinition(udf, index);
      const fieldKey = field.id || field.tempId || `idx-${index}`;
      idMapRef.current.set(fieldKey, udf.id);
      return field;
    });
  }, [formData.udfDefinitions]);

  const handleFieldsChange = useCallback((newFields: FieldDefinition[]) => {
    const newUdfDefinitions = newFields.map((field) => {
      const fieldKey = field.id || field.tempId || "";
      const existingId = idMapRef.current.get(fieldKey);
      return fieldDefinitionToUdf(field, existingId);
    });
    updateFormData({ udfDefinitions: newUdfDefinitions });
  }, [updateFormData]);

  return (
    <div className="flex flex-col h-full">
      <FieldBuilder
        fields={fields}
        onFieldsChange={handleFieldsChange}
        showLibraryTab={true}
        showSystemLibraryInline={true}
        canvasTitle="Service Fields"
        canvasDescription="Drag to reorder fields. Click to edit."
        className="h-full"
      />
    </div>
  );
}
