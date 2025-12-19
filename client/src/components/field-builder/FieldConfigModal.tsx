import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Library } from "lucide-react";
import { getFieldTypeInfo, FIELD_TYPES, type FieldDefinition, type SystemFieldType } from "./types";
import type { FieldCapabilities } from "./adapters";

interface FieldConfigModalProps {
  field: FieldDefinition | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (field: FieldDefinition) => void;
  isViewOnly?: boolean;
  allowedFieldTypes?: SystemFieldType[];
  showExpectedValues?: boolean;
  capabilities?: FieldCapabilities;
}

export function FieldConfigModal({
  field,
  isOpen,
  onClose,
  onSave,
  isViewOnly = false,
  allowedFieldTypes,
  showExpectedValues = false,
  capabilities,
}: FieldConfigModalProps) {
  const supportsPlaceholder = capabilities?.supportsPlaceholder ?? true;
  const supportsExpectedValue = capabilities?.supportsExpectedValue ?? showExpectedValues;
  const supportsOptions = capabilities?.supportsOptions ?? true;
  const [editedField, setEditedField] = useState<FieldDefinition | null>(null);
  const [newOption, setNewOption] = useState("");

  useEffect(() => {
    if (field) {
      setEditedField({ ...field });
    }
  }, [field]);

  if (!editedField) return null;

  const typeInfo = getFieldTypeInfo(editedField.fieldType);
  const Icon = typeInfo.icon;
  const color = typeInfo.color;

  const availableTypes = allowedFieldTypes 
    ? FIELD_TYPES.filter(ft => allowedFieldTypes.includes(ft.type))
    : FIELD_TYPES;

  const needsOptions = ["single_select", "multi_select", "dropdown"].includes(editedField.fieldType);

  const handleAddOption = () => {
    if (newOption.trim()) {
      setEditedField(prev => prev ? ({
        ...prev,
        options: [...(prev.options || []), newOption.trim()]
      }) : null);
      setNewOption("");
    }
  };

  const handleRemoveOption = (index: number) => {
    setEditedField(prev => prev ? ({
      ...prev,
      options: (prev.options || []).filter((_, i) => i !== index)
    }) : null);
  };

  const handleSave = () => {
    if (editedField && editedField.fieldName.trim()) {
      onSave(editedField);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${color}15` }}
            >
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <DialogTitle>
                {isViewOnly ? "View Field" : editedField.fieldName ? "Edit Field" : "Configure Field"}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground">{typeInfo.label} field</p>
                {editedField.libraryFieldId && (
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                    <Library className="w-3 h-3 mr-1" />
                    From Library
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="field-name">Field Name *</Label>
            <Input
              id="field-name"
              value={editedField.fieldName}
              onChange={(e) => setEditedField(prev => prev ? { ...prev, fieldName: e.target.value } : null)}
              placeholder="e.g., Bank Reconciliation Checked"
              disabled={isViewOnly}
              data-testid="input-field-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-type">Field Type</Label>
            <Select
              value={editedField.fieldType}
              onValueChange={(value) => setEditedField(prev => prev ? { 
                ...prev, 
                fieldType: value as SystemFieldType,
                options: ["single_select", "multi_select", "dropdown"].includes(value) ? prev.options : []
              } : null)}
              disabled={isViewOnly}
            >
              <SelectTrigger data-testid="select-field-type">
                <SelectValue placeholder="Select field type" />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map((ft) => {
                  const FtIcon = ft.icon;
                  return (
                    <SelectItem key={ft.type} value={ft.type}>
                      <div className="flex items-center gap-2">
                        <FtIcon className="w-4 h-4" style={{ color: ft.color }} />
                        {ft.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-description">Description (optional)</Label>
            <Textarea
              id="field-description"
              value={editedField.description || ""}
              onChange={(e) => setEditedField(prev => prev ? { ...prev, description: e.target.value } : null)}
              placeholder="Additional context for this field..."
              disabled={isViewOnly}
              rows={2}
              data-testid="input-field-description"
            />
          </div>

          {supportsPlaceholder && (
            <div className="space-y-2">
              <Label htmlFor="field-placeholder">Placeholder (optional)</Label>
              <Input
                id="field-placeholder"
                value={editedField.placeholder || ""}
                onChange={(e) => setEditedField(prev => prev ? { ...prev, placeholder: e.target.value } : null)}
                placeholder="e.g., Enter value here..."
                disabled={isViewOnly}
                data-testid="input-field-placeholder"
              />
            </div>
          )}

          <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
            <div>
              <Label htmlFor="field-required" className="font-medium">Required field</Label>
              <p className="text-xs text-muted-foreground">Must be completed before submission</p>
            </div>
            <Switch
              id="field-required"
              checked={editedField.isRequired}
              onCheckedChange={(checked) => setEditedField(prev => prev ? { ...prev, isRequired: checked } : null)}
              disabled={isViewOnly}
              data-testid="switch-field-required"
            />
          </div>

          {supportsOptions && needsOptions && (
            <div className="space-y-3">
              <Label>Options</Label>
              <div className="space-y-2">
                {(editedField.options || []).map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...(editedField.options || [])];
                        newOptions[index] = e.target.value;
                        setEditedField(prev => prev ? { ...prev, options: newOptions } : null);
                      }}
                      disabled={isViewOnly}
                      data-testid={`input-option-${index}`}
                    />
                    {!isViewOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOption(index)}
                        data-testid={`button-remove-option-${index}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {!isViewOnly && (
                <div className="flex gap-2">
                  <Input
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder="Add new option..."
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddOption())}
                    data-testid="input-new-option"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddOption}
                    data-testid="button-add-option"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {supportsExpectedValue && editedField.fieldType === "boolean" && (
            <div className="space-y-2">
              <Label>Expected Value</Label>
              <Select
                value={editedField.expectedValueBoolean === null ? "any" : editedField.expectedValueBoolean ? "yes" : "no"}
                onValueChange={(value) => setEditedField(prev => prev ? ({
                  ...prev,
                  expectedValueBoolean: value === "any" ? null : value === "yes"
                }) : null)}
                disabled={isViewOnly}
              >
                <SelectTrigger data-testid="select-expected-boolean">
                  <SelectValue placeholder="Select expected value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any value (no validation)</SelectItem>
                  <SelectItem value="yes">Must be Yes</SelectItem>
                  <SelectItem value="no">Must be No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {supportsExpectedValue && editedField.fieldType === "number" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Comparison</Label>
                <Select
                  value={editedField.comparisonType || "none"}
                  onValueChange={(value) => setEditedField(prev => prev ? ({
                    ...prev,
                    comparisonType: value === "none" ? null : value as any
                  }) : null)}
                  disabled={isViewOnly}
                >
                  <SelectTrigger data-testid="select-comparison-type">
                    <SelectValue placeholder="Comparison type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No validation</SelectItem>
                    <SelectItem value="equal_to">Equal to</SelectItem>
                    <SelectItem value="less_than">Less than</SelectItem>
                    <SelectItem value="greater_than">Greater than</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editedField.comparisonType && (
                <div className="space-y-2">
                  <Label>Expected Number</Label>
                  <Input
                    type="number"
                    value={editedField.expectedValueNumber ?? ""}
                    onChange={(e) => setEditedField(prev => prev ? ({
                      ...prev,
                      expectedValueNumber: e.target.value ? Number(e.target.value) : null
                    }) : null)}
                    disabled={isViewOnly}
                    data-testid="input-expected-number"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel">
            {isViewOnly ? "Close" : "Cancel"}
          </Button>
          {!isViewOnly && (
            <Button 
              onClick={handleSave}
              disabled={!editedField.fieldName.trim()}
              data-testid="button-save-field"
            >
              Save Field
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
