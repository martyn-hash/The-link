import { useState, useCallback } from "react";
import type { ReasonCustomField } from "@shared/schema";
import type { CustomFieldResponse } from "@/types/changeStatus";

interface UseCustomFieldsParams {
  customFields: ReasonCustomField[];
}

interface CustomFieldValidationResult {
  isValid: boolean;
  errors: string[];
}

interface UseCustomFieldsReturn {
  customFieldResponses: Record<string, any>;
  setCustomFieldResponses: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  validateCustomFields: () => CustomFieldValidationResult;
  handleCustomFieldChange: (fieldId: string, value: any) => void;
  handleMultiSelectChange: (fieldId: string, option: string, checked: boolean) => void;
  formatFieldResponses: () => CustomFieldResponse[];
  resetCustomFields: () => void;
}

export function useCustomFields({
  customFields,
}: UseCustomFieldsParams): UseCustomFieldsReturn {
  const [customFieldResponses, setCustomFieldResponses] = useState<Record<string, any>>({});

  const validateCustomFields = useCallback((): CustomFieldValidationResult => {
    const errors: string[] = [];
    const requiredFields = customFields.filter((field) => field.isRequired);

    for (const field of requiredFields) {
      const response = customFieldResponses[field.id];
      if (field.fieldType === "multi_select") {
        if (!response || !Array.isArray(response) || response.length === 0) {
          errors.push(
            `${field.fieldName} is required - please select at least one option`
          );
        }
      } else if (
        !response ||
        response === "" ||
        response === null ||
        response === undefined
      ) {
        errors.push(`${field.fieldName} is required`);
      } else if (field.fieldType === "number" && isNaN(Number(response))) {
        errors.push(`${field.fieldName} must be a valid number`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [customFields, customFieldResponses]);

  const handleCustomFieldChange = useCallback((fieldId: string, value: any) => {
    setCustomFieldResponses((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  }, []);

  const handleMultiSelectChange = useCallback(
    (fieldId: string, option: string, checked: boolean) => {
      setCustomFieldResponses((prev) => {
        const currentValues = prev[fieldId] || [];
        const updatedValues = checked
          ? [...currentValues, option]
          : currentValues.filter((item: string) => item !== option);
        return {
          ...prev,
          [fieldId]: updatedValues,
        };
      });
    },
    []
  );

  const formatFieldResponses = useCallback((): CustomFieldResponse[] => {
    return customFields
      .map((field) => {
        const value = customFieldResponses[field.id];
        const baseResponse = {
          customFieldId: field.id,
          fieldType: field.fieldType as
            | "number"
            | "short_text"
            | "long_text"
            | "multi_select",
        };

        if (field.fieldType === "number") {
          return { ...baseResponse, valueNumber: value ? Number(value) : undefined };
        } else if (field.fieldType === "short_text") {
          return { ...baseResponse, valueShortText: value || undefined };
        } else if (field.fieldType === "long_text") {
          return { ...baseResponse, valueLongText: value || undefined };
        } else if (field.fieldType === "multi_select") {
          return {
            ...baseResponse,
            valueMultiSelect:
              Array.isArray(value) && value.length > 0 ? value : undefined,
          };
        }

        return baseResponse;
      })
      .filter((response) => {
        if ("valueNumber" in response && response.valueNumber !== undefined) return true;
        if ("valueShortText" in response && response.valueShortText !== undefined)
          return true;
        if ("valueLongText" in response && response.valueLongText !== undefined)
          return true;
        if ("valueMultiSelect" in response && response.valueMultiSelect !== undefined)
          return true;
        return false;
      });
  }, [customFields, customFieldResponses]);

  const resetCustomFields = useCallback(() => {
    setCustomFieldResponses({});
  }, []);

  return {
    customFieldResponses,
    setCustomFieldResponses,
    validateCustomFields,
    handleCustomFieldChange,
    handleMultiSelectChange,
    formatFieldResponses,
    resetCustomFields,
  };
}
