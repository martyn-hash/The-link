import { useMemo } from "react";
import { z } from "zod";
import { formatComparisonType } from "@/lib/changeStatusUtils";
import type { StageApprovalField } from "@shared/schema";

interface UseApprovalFormSchemaParams {
  targetStageApprovalFields: StageApprovalField[];
}

interface UseApprovalFormSchemaReturn {
  schema: z.ZodObject<Record<string, z.ZodTypeAny>>;
}

export function useApprovalFormSchema({
  targetStageApprovalFields,
}: UseApprovalFormSchemaParams): UseApprovalFormSchemaReturn {
  const schema = useMemo(() => {
    if (!targetStageApprovalFields.length) return z.object({});

    const schemaFields: Record<string, z.ZodTypeAny> = {};

    targetStageApprovalFields.forEach((field) => {
      if (field.fieldType === "boolean") {
        schemaFields[field.id] = z.boolean().refine(
          (value) => value === field.expectedValueBoolean,
          {
            message: `This field must be set to ${
              field.expectedValueBoolean ? "Yes" : "No"
            }`,
          }
        );
      } else if (field.fieldType === "number") {
        const baseNumberSchema = z.number({
          required_error: field.isRequired ? "This field is required" : undefined,
          invalid_type_error: "Please enter a valid number",
        });

        if (field.comparisonType && field.expectedValueNumber !== null) {
          schemaFields[field.id] = baseNumberSchema.refine(
            (value) => {
              switch (field.comparisonType) {
                case "equal_to":
                  return value === field.expectedValueNumber;
                case "less_than":
                  return value < field.expectedValueNumber!;
                case "greater_than":
                  return value > field.expectedValueNumber!;
                default:
                  return true;
              }
            },
            {
              message: `Value must be ${formatComparisonType(
                field.comparisonType
              )} ${field.expectedValueNumber}`,
            }
          );
        } else {
          schemaFields[field.id] = field.isRequired
            ? baseNumberSchema
            : baseNumberSchema.optional();
        }
      } else if (field.fieldType === "long_text") {
        schemaFields[field.id] = field.isRequired
          ? z.string().min(1, "This field is required")
          : z.string().optional();
      } else if (field.fieldType === "multi_select") {
        schemaFields[field.id] = field.isRequired
          ? z
              .array(z.string())
              .min(1, "Please select at least one option")
          : z.array(z.string()).optional();
      }
    });

    return z.object(schemaFields);
  }, [targetStageApprovalFields]);

  return {
    schema,
  };
}
