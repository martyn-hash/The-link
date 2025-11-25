import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";

interface ApprovalFieldFormProps {
  stageApprovalId: string;
  onSuccess: () => void;
  onCancel: () => void;
  createMutation: any;
  updateMutation?: any;
  existingFields: any[];
  editingField?: any;
}

export function ApprovalFieldForm({ 
  stageApprovalId, 
  onSuccess, 
  onCancel, 
  createMutation,
  updateMutation,
  existingFields,
  editingField 
}: ApprovalFieldFormProps) {
  const [fieldName, setFieldName] = useState(editingField?.fieldName || "");
  const [description, setDescription] = useState(editingField?.description || "");
  const [fieldType, setFieldType] = useState<"boolean" | "number" | "long_text" | "multi_select">(editingField?.fieldType || "boolean");
  const [isRequired, setIsRequired] = useState(editingField?.isRequired || false);
  const [placeholder, setPlaceholder] = useState(editingField?.placeholder || "");
  const [options, setOptions] = useState<string[]>(editingField?.options || [""]);
  
  const [expectedValueBoolean, setExpectedValueBoolean] = useState<boolean>(editingField?.expectedValueBoolean !== undefined ? editingField.expectedValueBoolean : true);
  
  const [comparisonType, setComparisonType] = useState<"equal_to" | "less_than" | "greater_than">(editingField?.comparisonType || "equal_to");
  const [expectedValueNumber, setExpectedValueNumber] = useState<number>(editingField?.expectedValueNumber || 0);

  const handleSubmit = () => {
    if (!fieldName.trim()) {
      return;
    }

    if (fieldType === "boolean" && expectedValueBoolean === undefined) {
      return;
    }
    if (fieldType === "number" && (!comparisonType || expectedValueNumber === undefined)) {
      return;
    }
    if (fieldType === "multi_select" && options.filter(o => o.trim()).length === 0) {
      return;
    }

    const fieldData = {
      stageApprovalId,
      fieldName: fieldName.trim(),
      description: description.trim() || undefined,
      fieldType,
      isRequired,
      placeholder: placeholder.trim() || undefined,
      expectedValueBoolean: fieldType === "boolean" ? expectedValueBoolean : undefined,
      comparisonType: fieldType === "number" ? comparisonType : undefined,
      expectedValueNumber: fieldType === "number" ? expectedValueNumber : undefined,
      options: fieldType === "multi_select" ? options.filter(o => o.trim()) : undefined,
      order: editingField ? editingField.order : existingFields.length
    };

    if (editingField) {
      updateMutation.mutate({ id: editingField.id, field: fieldData }, {
        onSuccess: () => {
          onSuccess();
        }
      });
    } else {
      createMutation.mutate(fieldData, {
        onSuccess: () => {
          onSuccess();
        }
      });
    }
  };

  const addOption = () => {
    setOptions([...options, ""]);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="approval-field-name">Field Name</Label>
          <Input
            id="approval-field-name"
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            placeholder="Enter field name"
            data-testid="input-approval-field-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="approval-field-type">Field Type</Label>
          <Select
            value={fieldType}
            onValueChange={(value: any) => setFieldType(value)}
          >
            <SelectTrigger data-testid="select-approval-field-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="boolean">Boolean</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="long_text">Long Text</SelectItem>
              <SelectItem value="multi_select">Multi Select</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="approval-field-description">Description (Optional)</Label>
        <Textarea
          id="approval-field-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter help text or description for this field"
          data-testid="textarea-approval-field-description"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="approval-field-placeholder">Placeholder (Optional)</Label>
        <Input
          id="approval-field-placeholder"
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          placeholder="Enter placeholder text"
          data-testid="input-approval-field-placeholder"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="approval-field-required"
          checked={isRequired}
          onCheckedChange={(checked) => setIsRequired(!!checked)}
          data-testid="checkbox-approval-field-required"
        />
        <Label htmlFor="approval-field-required">Required field</Label>
      </div>

      {fieldType === "boolean" && (
        <div className="space-y-2">
          <Label>Expected Value for Approval</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="expected-value-boolean"
              checked={expectedValueBoolean}
              onCheckedChange={setExpectedValueBoolean}
              data-testid="switch-expected-value-boolean"
            />
            <Label htmlFor="expected-value-boolean">
              Field must be {expectedValueBoolean ? "true" : "false"} for approval
            </Label>
          </div>
        </div>
      )}

      {fieldType === "number" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comparison-type">Comparison Type</Label>
            <Select
              value={comparisonType}
              onValueChange={(value: any) => setComparisonType(value)}
            >
              <SelectTrigger data-testid="select-comparison-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal_to">Equal to</SelectItem>
                <SelectItem value="less_than">Less than</SelectItem>
                <SelectItem value="greater_than">Greater than</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expected-value-number">Expected Value</Label>
            <Input
              id="expected-value-number"
              type="number"
              value={expectedValueNumber}
              onChange={(e) => setExpectedValueNumber(parseInt(e.target.value) || 0)}
              placeholder="Enter expected value"
              data-testid="input-expected-value-number"
            />
          </div>
        </div>
      )}

      {fieldType === "multi_select" && (
        <div className="space-y-2">
          <Label>Options</Label>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  data-testid={`input-approval-field-option-${index}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= 1}
                  data-testid={`button-remove-approval-option-${index}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addOption}
            data-testid="button-add-approval-option"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Option
          </Button>
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          data-testid="button-cancel-approval-field"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={
            !fieldName.trim() || 
            (fieldType === "boolean" && expectedValueBoolean === undefined) ||
            (fieldType === "number" && (!comparisonType || expectedValueNumber === undefined)) ||
            (fieldType === "multi_select" && options.filter(o => o.trim()).length === 0)
          }
          data-testid="button-save-approval-field"
        >
          {editingField ? "Update Field" : "Add Field"}
        </Button>
      </div>
    </div>
  );
}
