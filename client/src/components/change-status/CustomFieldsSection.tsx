import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ReasonCustomField } from "@shared/schema";

interface CustomFieldsSectionProps {
  customFields: ReasonCustomField[];
  customFieldResponses: Record<string, any>;
  onFieldChange: (fieldId: string, value: any) => void;
  onMultiSelectChange: (fieldId: string, option: string, checked: boolean) => void;
}

export function CustomFieldsSection({
  customFields,
  customFieldResponses,
  onFieldChange,
  onMultiSelectChange,
}: CustomFieldsSectionProps) {
  if (customFields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Separator />
      <div className="space-y-4">
        {customFields.map((field) => (
          <div key={field.id} className="space-y-2">
            <div>
              <Label htmlFor={`custom-field-${field.id}`}>
                {field.fieldName}
                {field.isRequired && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </Label>
              {field.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {field.description}
                </p>
              )}
            </div>

            {field.fieldType === "boolean" && (
              <div className="flex items-center space-x-3">
                <Checkbox
                  id={`custom-field-${field.id}`}
                  checked={customFieldResponses[field.id] || false}
                  onCheckedChange={(checked) =>
                    onFieldChange(field.id, checked)
                  }
                  data-testid={`checkbox-custom-field-${field.id}`}
                />
                <Label htmlFor={`custom-field-${field.id}`} className="font-normal">
                  {customFieldResponses[field.id] ? "Yes" : "No"}
                </Label>
              </div>
            )}

            {field.fieldType === "number" && (
              <Input
                id={`custom-field-${field.id}`}
                type="number"
                value={customFieldResponses[field.id] || ""}
                onChange={(e) =>
                  onFieldChange(field.id, e.target.value)
                }
                placeholder={`Enter ${field.fieldName.toLowerCase()}`}
                data-testid={`input-custom-field-${field.id}`}
              />
            )}

            {field.fieldType === "short_text" && (
              <Input
                id={`custom-field-${field.id}`}
                type="text"
                value={customFieldResponses[field.id] || ""}
                onChange={(e) =>
                  onFieldChange(field.id, e.target.value)
                }
                placeholder={`Enter ${field.fieldName.toLowerCase()}`}
                data-testid={`input-custom-field-${field.id}`}
              />
            )}

            {field.fieldType === "long_text" && (
              <Textarea
                id={`custom-field-${field.id}`}
                value={customFieldResponses[field.id] || ""}
                onChange={(e) =>
                  onFieldChange(field.id, e.target.value)
                }
                placeholder={`Enter ${field.fieldName.toLowerCase()}`}
                rows={3}
                data-testid={`textarea-custom-field-${field.id}`}
              />
            )}

            {field.fieldType === "multi_select" &&
              field.options &&
              field.options.length > 0 && (
                <div className="space-y-2">
                  {field.options.map((option: string) => (
                    <div
                      key={option}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`${field.id}-${option}`}
                        checked={
                          customFieldResponses[field.id]?.includes(
                            option
                          ) || false
                        }
                        onCheckedChange={(checked) =>
                          onMultiSelectChange(
                            field.id,
                            option,
                            checked as boolean
                          )
                        }
                        data-testid={`checkbox-${field.id}-${option}`}
                      />
                      <label
                        htmlFor={`${field.id}-${option}`}
                        className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}
