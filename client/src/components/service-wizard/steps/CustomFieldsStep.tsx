import { useCallback, useMemo, useRef } from "react";
import { FieldBuilder, type FieldDefinition, type SystemFieldType } from "@/components/field-builder";
import type { ServiceWizardFormData } from "../types";
import type { UdfDefinition } from "@shared/schema";
import { nanoid } from "nanoid";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CustomFieldsStepProps {
  formData: ServiceWizardFormData;
  updateFormData: (updates: Partial<ServiceWizardFormData>) => void;
}

const VAT_FIELDS_PREVIEW = [
  { id: 'vat_number_auto', name: 'VAT Number', type: 'short_text', required: true },
  { id: 'vat_company_name_auto', name: 'VAT Company Name', type: 'short_text', required: false, readOnly: true },
  { id: 'vat_address_auto', name: 'VAT Address', type: 'long_text', required: false, readOnly: true },
];

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
    // Filter out VAT auto-fields from the editable list (they're shown separately)
    const vatFieldIds = VAT_FIELDS_PREVIEW.map(f => f.id);
    return formData.udfDefinitions
      .filter(udf => !vatFieldIds.includes(udf.id))
      .map((udf, index) => {
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
        headerContent={formData.isVatService ? (
          <Card className="mb-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="w-4 h-4 text-amber-600" />
                <span className="font-medium text-amber-800 dark:text-amber-200">VAT Integration Fields</span>
                <Lock className="w-3 h-3 text-amber-600 ml-auto" />
                <span className="text-xs text-amber-600">Auto-added</span>
              </div>
              <div className="space-y-1.5">
                {VAT_FIELDS_PREVIEW.map((field) => (
                  <div key={field.id} className="flex items-center gap-2 text-sm">
                    <span className="text-amber-700 dark:text-amber-300">{field.name}</span>
                    {field.required && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-300 text-amber-700">
                        Required
                      </Badge>
                    )}
                    {field.readOnly && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-300 text-amber-600">
                        Read-only
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-amber-600 mt-2">
                These fields are automatically added for HMRC VAT validation
              </p>
            </CardContent>
          </Card>
        ) : undefined}
      />
    </div>
  );
}
