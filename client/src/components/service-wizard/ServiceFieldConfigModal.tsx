import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Save, Plus, Trash2 } from "lucide-react";
import type { UdfDefinition } from "@shared/schema";

interface ServiceFieldConfigModalProps {
  field: UdfDefinition;
  isOpen: boolean;
  onClose: () => void;
  onSave: (field: UdfDefinition) => void;
}

const FIELD_TYPE_OPTIONS = [
  { value: "short_text", label: "Short Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes/No" },
  { value: "dropdown", label: "Dropdown" },
];

export function ServiceFieldConfigModal({
  field,
  isOpen,
  onClose,
  onSave,
}: ServiceFieldConfigModalProps) {
  const [editingField, setEditingField] = useState<UdfDefinition>(field);
  const [newOption, setNewOption] = useState("");

  useEffect(() => {
    setEditingField(field);
  }, [field]);

  const handleSave = () => {
    if (!editingField.name.trim()) {
      return;
    }
    onSave(editingField);
  };

  const handleAddOption = () => {
    if (!newOption.trim()) return;
    const currentOptions = editingField.options || [];
    setEditingField({
      ...editingField,
      options: [...currentOptions, newOption.trim()]
    });
    setNewOption("");
  };

  const handleRemoveOption = (index: number) => {
    const currentOptions = editingField.options || [];
    setEditingField({
      ...editingField,
      options: currentOptions.filter((_, i) => i !== index)
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddOption();
    }
  };

  const isDropdown = editingField.type === "dropdown";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure Field</DialogTitle>
          <DialogDescription>
            Set up the properties for this custom field
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="field-name">
              Field Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="field-name"
              placeholder="e.g., Client Reference, Tax Year"
              value={editingField.name}
              onChange={(e) => setEditingField({ ...editingField, name: e.target.value })}
              data-testid="input-field-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-type">Field Type</Label>
            <Select
              value={editingField.type}
              onValueChange={(value: UdfDefinition["type"]) => {
                setEditingField({ 
                  ...editingField, 
                  type: value,
                  options: value === "dropdown" ? (editingField.options || []) : undefined
                });
              }}
            >
              <SelectTrigger id="field-type" data-testid="select-field-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-placeholder">Placeholder Text</Label>
            <Input
              id="field-placeholder"
              placeholder="e.g., Enter value..."
              value={editingField.placeholder || ""}
              onChange={(e) => setEditingField({ ...editingField, placeholder: e.target.value })}
              data-testid="input-field-placeholder"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="field-required">Required Field</Label>
              <p className="text-sm text-muted-foreground">
                Users must fill this field when adding the service
              </p>
            </div>
            <Switch
              id="field-required"
              checked={editingField.required}
              onCheckedChange={(checked) => setEditingField({ ...editingField, required: checked })}
              data-testid="switch-field-required"
            />
          </div>

          {isDropdown && (
            <div className="space-y-3 pt-2 border-t">
              <Label>Dropdown Options</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add an option..."
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyPress={handleKeyPress}
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
              {(editingField.options || []).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {editingField.options!.map((option, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      {option}
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="ml-1 hover:bg-muted rounded p-0.5"
                        data-testid={`button-remove-option-${index}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No options added yet. Add at least one option for the dropdown.
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 pt-2 border-t">
            <Label>Validation (Optional)</Label>
            <div className="space-y-2">
              <Input
                placeholder="Regex pattern, e.g., ^GB[0-9]{9}$"
                value={editingField.regex || ""}
                onChange={(e) => setEditingField({ ...editingField, regex: e.target.value })}
                data-testid="input-field-regex"
              />
              <Input
                placeholder="Error message if validation fails"
                value={editingField.regexError || ""}
                onChange={(e) => setEditingField({ ...editingField, regexError: e.target.value })}
                data-testid="input-field-regex-error"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-field">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!editingField.name.trim()}
            data-testid="button-save-field"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
