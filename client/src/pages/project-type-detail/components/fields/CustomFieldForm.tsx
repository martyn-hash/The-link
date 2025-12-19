import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Library } from "lucide-react";
import { SystemFieldLibraryPicker } from "@/components/system-field-library-picker";
import type { SystemFieldLibrary } from "@shared/schema";

interface CustomFieldFormProps {
  reasonId: string;
  onSuccess: () => void;
  onCancel: () => void;
  createMutation: any;
  existingFields: any[];
}

const ALLOWED_SYSTEM_FIELD_TYPES = ["boolean", "number", "short_text", "long_text", "date", "single_select", "multi_select", "email", "phone", "url", "currency", "percentage", "file_upload", "image_upload", "user_select"];

type CustomFieldType = "boolean" | "number" | "short_text" | "long_text" | "multi_select";

const mapSystemFieldTypeToCustomFieldType = (fieldType: string): CustomFieldType => {
  const typeMap: Record<string, CustomFieldType> = {
    boolean: "boolean",
    number: "number",
    short_text: "short_text",
    long_text: "long_text",
    multi_select: "multi_select",
    single_select: "multi_select",
    email: "short_text",
    phone: "short_text",
    url: "short_text",
    currency: "number",
    percentage: "number",
    date: "short_text",
    file_upload: "short_text",
    image_upload: "short_text",
    user_select: "multi_select",
  };
  return typeMap[fieldType] || "short_text";
};

export function CustomFieldForm({ 
  reasonId, 
  onSuccess, 
  onCancel, 
  createMutation,
  existingFields 
}: CustomFieldFormProps) {
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("short_text");
  const [isRequired, setIsRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<string[]>([""]);
  const [systemLibraryPickerOpen, setSystemLibraryPickerOpen] = useState(false);

  const handleSelectFromLibrary = (systemField: SystemFieldLibrary) => {
    const mappedType = mapSystemFieldTypeToCustomFieldType(systemField.fieldType);
    setFieldName(systemField.fieldName);
    setFieldType(mappedType);
    setIsRequired(systemField.isRequired || false);
    setDescription(systemField.description || "");
    if (systemField.options && systemField.options.length > 0) {
      setOptions(systemField.options);
    }
    setSystemLibraryPickerOpen(false);
  };

  const handleSubmit = () => {
    if (!fieldName.trim()) {
      return;
    }

    const fieldData = {
      reasonId,
      fieldName: fieldName.trim(),
      fieldType,
      isRequired,
      placeholder: placeholder.trim() || undefined,
      description: description.trim() || undefined,
      options: fieldType === "multi_select" ? options.filter(o => o.trim()) : undefined,
      order: existingFields.length
    };

    createMutation.mutate(fieldData, {
      onSuccess: () => {
        onSuccess();
      }
    });
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
      <div className="flex justify-end mb-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setSystemLibraryPickerOpen(true)}
          className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 hover:text-purple-800"
          data-testid="button-pick-from-library"
        >
          <Library className="w-4 h-4 mr-2" />
          Pick from Library
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="field-name">Field Name</Label>
          <Input
            id="field-name"
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            placeholder="Enter field name"
            data-testid="input-custom-field-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="field-type">Field Type</Label>
          <Select
            value={fieldType}
            onValueChange={(value: any) => setFieldType(value)}
          >
            <SelectTrigger data-testid="select-custom-field-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="boolean">Boolean (Yes/No)</SelectItem>
              <SelectItem value="short_text">Short Text</SelectItem>
              <SelectItem value="long_text">Long Text</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="multi_select">Multi Select</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="field-placeholder">Placeholder (Optional)</Label>
        <Input
          id="field-placeholder"
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          placeholder="Enter placeholder text"
          data-testid="input-custom-field-placeholder"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="field-description">Description (Optional)</Label>
        <Textarea
          id="field-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter help text or description for this field"
          rows={2}
          data-testid="textarea-custom-field-description"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="field-required"
          checked={isRequired}
          onCheckedChange={(checked) => setIsRequired(!!checked)}
          data-testid="checkbox-custom-field-required"
        />
        <Label htmlFor="field-required">Required field</Label>
      </div>

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
                  data-testid={`input-custom-field-option-${index}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= 1}
                  data-testid={`button-remove-option-${index}`}
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
            data-testid="button-add-option"
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
          data-testid="button-cancel-custom-field"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!fieldName.trim() || (fieldType === "multi_select" && options.filter(o => o.trim()).length === 0)}
          data-testid="button-save-custom-field"
        >
          Add Field
        </Button>
      </div>

      <SystemFieldLibraryPicker
        open={systemLibraryPickerOpen}
        onOpenChange={setSystemLibraryPickerOpen}
        onSelectField={handleSelectFromLibrary}
        allowedFieldTypes={ALLOWED_SYSTEM_FIELD_TYPES}
        title="Pick from System Field Library"
        description="Select a pre-defined field from your company's reusable field library"
      />
    </div>
  );
}
