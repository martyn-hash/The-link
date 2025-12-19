import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  X, Save, GripVertical, Plus, Trash2, Edit2, Eye,
  ToggleLeft, Hash, Type, FileText, Calendar, CircleDot, CheckSquare,
  ChevronDown, ChevronUp, Library, Sparkles, ClipboardCheck
} from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ApprovalFieldLibrary, ProjectType, KanbanStage } from "@shared/schema";

const FIELD_TYPES = [
  { type: "boolean", label: "Yes/No", icon: ToggleLeft, color: "#84cc16" },
  { type: "number", label: "Number", icon: Hash, color: "#22c55e" },
  { type: "short_text", label: "Short Text", icon: Type, color: "#3b82f6" },
  { type: "long_text", label: "Long Text", icon: FileText, color: "#8b5cf6" },
  { type: "date", label: "Date", icon: Calendar, color: "#f59e0b" },
  { type: "single_select", label: "Single Select", icon: CircleDot, color: "#ec4899" },
  { type: "multi_select", label: "Multi Select", icon: CheckSquare, color: "#14b8a6" },
] as const;

type FieldType = typeof FIELD_TYPES[number]["type"];

export interface EditingApprovalField {
  id?: string;
  fieldName: string;
  fieldType: FieldType;
  description: string;
  isRequired: boolean;
  order: number;
  options: string[];
  libraryFieldId?: string | null;
  expectedValueBoolean?: boolean | null;
  expectedValueNumber?: number | null;
  comparisonType?: "equal_to" | "less_than" | "greater_than" | null;
}

export interface ApprovalFormData {
  id?: string;
  name: string;
  description: string;
  projectTypeId: string;
  stageId: string;
  fields: EditingApprovalField[];
}

interface ApprovalFieldBuilderProps {
  mode: "create" | "edit" | "view";
  formData: ApprovalFormData;
  projectTypes: ProjectType[];
  stages: KanbanStage[];
  libraryFields?: ApprovalFieldLibrary[];
  onSave: (data: ApprovalFormData) => void;
  onCancel: () => void;
  isSaving?: boolean;
  onProjectTypeChange?: (projectTypeId: string) => void;
}

const DEFAULT_FIELD: EditingApprovalField = {
  fieldName: "",
  fieldType: "boolean",
  description: "",
  isRequired: true,
  order: 0,
  options: [],
  libraryFieldId: null,
  expectedValueBoolean: null,
  expectedValueNumber: null,
  comparisonType: null,
};

function PaletteItem({ 
  type, 
  label, 
  icon: Icon, 
  color, 
  onClick,
  isLibrary = false,
  disabled = false
}: { 
  type: string; 
  label: string; 
  icon: React.ElementType; 
  color: string; 
  onClick?: () => void;
  isLibrary?: boolean;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: isLibrary ? `library-${type}` : `palette-${type}`,
    data: { type, label, isNew: true, isLibrary },
    disabled,
  });

  const handleClick = (e: React.MouseEvent) => {
    if (onClick && !disabled) {
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      {...(disabled ? {} : listeners)}
      {...(disabled ? {} : attributes)}
      onClick={handleClick}
      className={`flex items-center gap-3 px-3 py-2.5 bg-card border rounded-lg transition-all text-sm group ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-accent hover:border-primary hover:shadow-sm'}`}
      data-testid={`palette-field-${type}`}
    >
      <div 
        className="w-8 h-8 rounded-md flex items-center justify-center transition-transform group-hover:scale-110"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <span className="font-medium flex-1 truncate">{label}</span>
      {isLibrary && (
        <Badge variant="secondary" className="text-xs">Library</Badge>
      )}
    </div>
  );
}

function FieldsDropZone({ children, isOver }: { children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef } = useDroppable({
    id: 'fields-drop-zone',
  });

  return (
    <div 
      ref={setNodeRef} 
      className={`transition-all duration-200 ${isOver ? 'ring-2 ring-primary ring-offset-2 rounded-lg' : ''}`}
    >
      {children}
    </div>
  );
}

function SortableFieldItem({
  field,
  onEdit,
  onDelete,
  onView,
  disabled = false,
}: {
  field: EditingApprovalField;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: field.id || `temp-${field.order}`,
    data: { type: 'field', field },
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const fieldTypeInfo = FIELD_TYPES.find(ft => ft.type === field.fieldType);
  const FieldIcon = fieldTypeInfo?.icon || Type;
  const iconColor = fieldTypeInfo?.color || "#6b7280";

  const getExpectedValueDisplay = () => {
    if (field.fieldType === "boolean" && field.expectedValueBoolean !== null && field.expectedValueBoolean !== undefined) {
      return `Expected: ${field.expectedValueBoolean ? "Yes" : "No"}`;
    }
    if (field.fieldType === "number" && field.expectedValueNumber !== null && field.expectedValueNumber !== undefined) {
      const comparisons: Record<string, string> = {
        equal_to: "=",
        less_than: "<",
        greater_than: ">"
      };
      const comp = field.comparisonType ? comparisons[field.comparisonType] : "=";
      return `Expected: ${comp} ${field.expectedValueNumber}`;
    }
    return null;
  };

  const expectedValue = getExpectedValueDisplay();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between px-4 py-3 bg-card border rounded-lg hover:border-primary/50 hover:shadow-md transition-all group"
      data-testid={`field-item-${field.id || field.order}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {!disabled && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
          style={{ backgroundColor: `${iconColor}15` }}
        >
          <FieldIcon className="w-5 h-5" style={{ color: iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{field.fieldName || "Untitled field"}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {fieldTypeInfo?.label || field.fieldType}
            </Badge>
            {field.isRequired && (
              <Badge variant="secondary" className="text-xs">Required</Badge>
            )}
            {field.libraryFieldId && (
              <Badge variant="outline" className="text-xs border-purple-300 text-purple-600">
                <Library className="w-3 h-3 mr-1" />
                Library
              </Badge>
            )}
            {expectedValue && (
              <Badge variant="outline" className="text-xs border-green-300 text-green-600">
                {expectedValue}
              </Badge>
            )}
          </div>
          {field.description && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{field.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {disabled ? (
          <Button variant="ghost" size="sm" onClick={onView} data-testid={`button-view-field-${field.order}`}>
            <Eye className="w-4 h-4" />
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={onEdit} data-testid={`button-edit-field-${field.order}`}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive" data-testid={`button-delete-field-${field.order}`}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function FieldEditorModal({
  field,
  onSave,
  onCancel,
  isViewOnly = false,
}: {
  field: EditingApprovalField;
  onSave: (f: EditingApprovalField) => void;
  onCancel: () => void;
  isViewOnly?: boolean;
}) {
  const [editedField, setEditedField] = useState<EditingApprovalField>(field);
  const [newOption, setNewOption] = useState("");

  const needsOptions = ["single_select", "multi_select"].includes(editedField.fieldType);
  const needsExpectedBoolean = editedField.fieldType === "boolean";
  const needsExpectedNumber = editedField.fieldType === "number";

  const handleAddOption = () => {
    if (newOption.trim()) {
      setEditedField(prev => ({
        ...prev,
        options: [...prev.options, newOption.trim()]
      }));
      setNewOption("");
    }
  };

  const handleRemoveOption = (index: number) => {
    setEditedField(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const fieldTypeInfo = FIELD_TYPES.find(ft => ft.type === editedField.fieldType);

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {fieldTypeInfo && (
              <div 
                className="w-8 h-8 rounded-md flex items-center justify-center"
                style={{ backgroundColor: `${fieldTypeInfo.color}15` }}
              >
                <fieldTypeInfo.icon className="w-4 h-4" style={{ color: fieldTypeInfo.color }} />
              </div>
            )}
            {isViewOnly ? "View Field" : field.id ? "Edit Field" : "Configure Field"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="field-type">Field Type</Label>
            <Select
              value={editedField.fieldType}
              onValueChange={(value) => setEditedField(prev => ({ 
                ...prev, 
                fieldType: value as FieldType,
                expectedValueBoolean: null,
                expectedValueNumber: null,
                comparisonType: null,
                options: [],
              }))}
              disabled={isViewOnly || !!field.libraryFieldId}
            >
              <SelectTrigger id="field-type" data-testid="select-field-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(ft => (
                  <SelectItem key={ft.type} value={ft.type}>
                    <div className="flex items-center gap-2">
                      <ft.icon className="w-4 h-4" style={{ color: ft.color }} />
                      {ft.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="field-name">Field Name *</Label>
            <Input
              id="field-name"
              value={editedField.fieldName}
              onChange={(e) => setEditedField(prev => ({ ...prev, fieldName: e.target.value }))}
              placeholder="e.g., Has director approved?"
              disabled={isViewOnly}
              data-testid="input-field-name"
            />
          </div>

          <div>
            <Label htmlFor="field-description">Description / Help Text</Label>
            <Textarea
              id="field-description"
              value={editedField.description}
              onChange={(e) => setEditedField(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description shown to staff"
              rows={2}
              disabled={isViewOnly}
              data-testid="input-field-description"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="field-required"
              checked={editedField.isRequired}
              onCheckedChange={(checked) => setEditedField(prev => ({ ...prev, isRequired: checked }))}
              disabled={isViewOnly}
              data-testid="switch-field-required"
            />
            <Label htmlFor="field-required">Required field</Label>
          </div>

          {needsExpectedBoolean && (
            <div className="border-t pt-4 mt-4">
              <Label className="text-sm font-medium mb-3 block">Expected Answer</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="expectedBoolean"
                    checked={editedField.expectedValueBoolean === true}
                    onChange={() => setEditedField(prev => ({ ...prev, expectedValueBoolean: true }))}
                    disabled={isViewOnly}
                    className="w-4 h-4"
                  />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="expectedBoolean"
                    checked={editedField.expectedValueBoolean === false}
                    onChange={() => setEditedField(prev => ({ ...prev, expectedValueBoolean: false }))}
                    disabled={isViewOnly}
                    className="w-4 h-4"
                  />
                  <span>No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="expectedBoolean"
                    checked={editedField.expectedValueBoolean === null}
                    onChange={() => setEditedField(prev => ({ ...prev, expectedValueBoolean: null }))}
                    disabled={isViewOnly}
                    className="w-4 h-4"
                  />
                  <span className="text-muted-foreground">Any</span>
                </label>
              </div>
            </div>
          )}

          {needsExpectedNumber && (
            <div className="border-t pt-4 mt-4">
              <Label className="text-sm font-medium mb-3 block">Expected Value</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="comparison-type" className="text-xs text-muted-foreground">Comparison</Label>
                  <Select
                    value={editedField.comparisonType || "none"}
                    onValueChange={(value) => setEditedField(prev => ({ 
                      ...prev, 
                      comparisonType: value === "none" ? null : value as "equal_to" | "less_than" | "greater_than"
                    }))}
                    disabled={isViewOnly}
                  >
                    <SelectTrigger id="comparison-type" data-testid="select-comparison-type">
                      <SelectValue placeholder="No comparison" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No comparison</SelectItem>
                      <SelectItem value="equal_to">Equal to (=)</SelectItem>
                      <SelectItem value="greater_than">Greater than (&gt;)</SelectItem>
                      <SelectItem value="less_than">Less than (&lt;)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="expected-number" className="text-xs text-muted-foreground">Value</Label>
                  <Input
                    id="expected-number"
                    type="number"
                    value={editedField.expectedValueNumber ?? ""}
                    onChange={(e) => setEditedField(prev => ({ 
                      ...prev, 
                      expectedValueNumber: e.target.value ? parseFloat(e.target.value) : null 
                    }))}
                    placeholder="Enter value"
                    disabled={isViewOnly || !editedField.comparisonType}
                    data-testid="input-expected-number"
                  />
                </div>
              </div>
            </div>
          )}

          {needsOptions && (
            <div className="border-t pt-4 mt-4">
              <Label className="text-sm font-medium mb-3 block">Options</Label>
              <div className="space-y-2">
                {editedField.options.map((opt, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 bg-muted rounded-md text-sm">{opt}</div>
                    {!isViewOnly && (
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveOption(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {!isViewOnly && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      placeholder="Add option"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                      data-testid="input-new-option"
                    />
                    <Button variant="outline" size="sm" onClick={handleAddOption} data-testid="button-add-option">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-field">
            {isViewOnly ? "Close" : "Cancel"}
          </Button>
          {!isViewOnly && (
            <Button 
              onClick={() => onSave(editedField)} 
              disabled={!editedField.fieldName.trim()}
              data-testid="button-save-field"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Field
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApprovalFieldBuilder({
  mode,
  formData,
  projectTypes,
  stages,
  libraryFields = [],
  onSave,
  onCancel,
  isSaving = false,
  onProjectTypeChange,
}: ApprovalFieldBuilderProps) {
  const [editingFormData, setEditingFormData] = useState<ApprovalFormData>(formData);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [viewingFieldIndex, setViewingFieldIndex] = useState<number | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(mode === "create");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isOverDropZone, setIsOverDropZone] = useState(false);

  const isViewOnly = mode === "view";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedProjectType = projectTypes.find(pt => pt.id === editingFormData.projectTypeId);
  const filteredStages = stages.filter(s => s.projectTypeId === editingFormData.projectTypeId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: any) => {
    const { over } = event;
    setIsOverDropZone(over?.id === 'fields-drop-zone' || over?.data?.current?.type === 'field');
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setIsOverDropZone(false);

    if (!over) return;

    // Handle dropping library field
    if (active.id.toString().startsWith('library-')) {
      const libraryFieldId = active.id.toString().replace('library-', '');
      const libraryField = libraryFields.find(lf => lf.id === libraryFieldId);
      if (libraryField) {
        const newField: EditingApprovalField = {
          ...DEFAULT_FIELD,
          fieldName: libraryField.fieldName,
          fieldType: libraryField.fieldType as FieldType,
          description: libraryField.description || "",
          libraryFieldId: libraryField.id,
          options: libraryField.options || [],
          order: editingFormData.fields.length,
        };
        setEditingFormData(prev => ({
          ...prev,
          fields: [...prev.fields, newField]
        }));
        setEditingFieldIndex(editingFormData.fields.length);
      }
      return;
    }

    // Handle dropping palette item
    if (active.id.toString().startsWith('palette-')) {
      if (over.id !== 'fields-drop-zone' && !over.data?.current?.type) return;
      const fieldType = active.data.current?.type as FieldType;
      const fieldTypeInfo = FIELD_TYPES.find(ft => ft.type === fieldType);
      const newField: EditingApprovalField = {
        ...DEFAULT_FIELD,
        fieldType,
        fieldName: fieldTypeInfo?.label || "",
        order: editingFormData.fields.length,
      };
      setEditingFormData(prev => ({
        ...prev,
        fields: [...prev.fields, newField]
      }));
      setEditingFieldIndex(editingFormData.fields.length);
      return;
    }

    // Handle reordering
    const activeIndex = editingFormData.fields.findIndex(
      f => (f.id || `temp-${f.order}`) === active.id
    );
    const overIndex = editingFormData.fields.findIndex(
      f => (f.id || `temp-${f.order}`) === over.id
    );

    if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
      setEditingFormData(prev => ({
        ...prev,
        fields: arrayMove(prev.fields, activeIndex, overIndex).map((f, i) => ({ ...f, order: i }))
      }));
    }
  };

  const handleAddFieldFromPalette = (fieldType: FieldType) => {
    if (isViewOnly) return;
    const fieldTypeInfo = FIELD_TYPES.find(ft => ft.type === fieldType);
    const newField: EditingApprovalField = {
      ...DEFAULT_FIELD,
      fieldType,
      fieldName: fieldTypeInfo?.label || "",
      order: editingFormData.fields.length,
    };
    setEditingFormData(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));
    setEditingFieldIndex(editingFormData.fields.length);
  };

  const handleAddFieldFromLibrary = (libraryField: ApprovalFieldLibrary) => {
    if (isViewOnly) return;
    const newField: EditingApprovalField = {
      ...DEFAULT_FIELD,
      fieldName: libraryField.fieldName,
      fieldType: libraryField.fieldType as FieldType,
      description: libraryField.description || "",
      libraryFieldId: libraryField.id,
      options: libraryField.options || [],
      order: editingFormData.fields.length,
    };
    setEditingFormData(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));
    setEditingFieldIndex(editingFormData.fields.length);
  };

  const handleSaveField = (updatedField: EditingApprovalField) => {
    if (editingFieldIndex === null) return;
    setEditingFormData(prev => {
      const newFields = [...prev.fields];
      newFields[editingFieldIndex] = updatedField;
      return { ...prev, fields: newFields };
    });
    setEditingFieldIndex(null);
  };

  const handleDeleteField = (index: number) => {
    setEditingFormData(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index).map((f, i) => ({ ...f, order: i }))
    }));
  };

  const handleSave = () => {
    onSave(editingFormData);
  };

  const selectedStage = filteredStages.find(s => s.id === editingFormData.stageId);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onCancel} data-testid="button-cancel-builder">
            <X className="w-4 h-4 mr-2" />
            {isViewOnly ? "Close" : "Cancel"}
          </Button>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {mode === "create" ? "Create Approval Form" : mode === "edit" ? "Edit Approval Form" : "View Approval Form"}
              </h2>
              {selectedProjectType && selectedStage && (
                <p className="text-sm text-muted-foreground">
                  {selectedProjectType.name} → {selectedStage.name}
                </p>
              )}
            </div>
          </div>
        </div>
        {!isViewOnly && (
          <Button 
            onClick={handleSave} 
            disabled={!editingFormData.name.trim() || !editingFormData.projectTypeId || !editingFormData.stageId || isSaving}
            data-testid="button-save-approval"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Approval"}
          </Button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex overflow-hidden">
          {/* Left Palette */}
          <div className="w-72 border-r border-border bg-muted/30 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Field Palette</h3>
                  <p className="text-xs text-muted-foreground">
                    {isViewOnly ? "View available fields" : "Click or drag to add"}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Field Library Section */}
              {libraryFields.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Library className="w-4 h-4 text-purple-500" />
                    <h4 className="text-sm font-semibold text-purple-700">Field Library</h4>
                  </div>
                  <div className="space-y-2">
                    {libraryFields.map(lf => {
                      const fieldTypeInfo = FIELD_TYPES.find(ft => ft.type === lf.fieldType);
                      return (
                        <PaletteItem
                          key={lf.id}
                          type={lf.id}
                          label={lf.fieldName}
                          icon={fieldTypeInfo?.icon || Type}
                          color={fieldTypeInfo?.color || "#6b7280"}
                          onClick={() => handleAddFieldFromLibrary(lf)}
                          isLibrary
                          disabled={isViewOnly}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Custom Fields Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Plus className="w-4 h-4 text-blue-500" />
                  <h4 className="text-sm font-semibold text-blue-700">Custom Fields</h4>
                </div>
                <div className="space-y-2">
                  {FIELD_TYPES.map(ft => (
                    <PaletteItem
                      key={ft.type}
                      type={ft.type}
                      label={ft.label}
                      icon={ft.icon}
                      color={ft.color}
                      onClick={() => handleAddFieldFromPalette(ft.type)}
                      disabled={isViewOnly}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto bg-muted/10">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Settings Accordion */}
              <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <Card className="shadow-sm">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-base">Approval Settings</CardTitle>
                          {!isSettingsOpen && editingFormData.name && (
                            <Badge variant="outline" className="font-normal">
                              {editingFormData.name}
                            </Badge>
                          )}
                        </div>
                        {isSettingsOpen ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="project-type">Project Type *</Label>
                          <Select
                            value={editingFormData.projectTypeId || "none"}
                            onValueChange={(value) => {
                              const newProjectTypeId = value === "none" ? "" : value;
                              setEditingFormData(prev => ({ 
                                ...prev, 
                                projectTypeId: newProjectTypeId,
                                stageId: ""
                              }));
                              if (newProjectTypeId && onProjectTypeChange) {
                                onProjectTypeChange(newProjectTypeId);
                              }
                            }}
                            disabled={isViewOnly || mode === "edit"}
                          >
                            <SelectTrigger id="project-type" data-testid="select-project-type">
                              <SelectValue placeholder="Select project type" />
                            </SelectTrigger>
                            <SelectContent>
                              {projectTypes.map(pt => (
                                <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="stage">Stage *</Label>
                          <Select
                            value={editingFormData.stageId || "none"}
                            onValueChange={(value) => setEditingFormData(prev => ({ 
                              ...prev, 
                              stageId: value === "none" ? "" : value 
                            }))}
                            disabled={isViewOnly || !editingFormData.projectTypeId || mode === "edit"}
                          >
                            <SelectTrigger id="stage" data-testid="select-stage">
                              <SelectValue placeholder="Select stage" />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredStages.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="approval-name">Approval Name *</Label>
                        <Input
                          id="approval-name"
                          value={editingFormData.name}
                          onChange={(e) => setEditingFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Client VAT Sign-off"
                          disabled={isViewOnly}
                          data-testid="input-approval-name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="approval-description">Description</Label>
                        <Textarea
                          id="approval-description"
                          value={editingFormData.description}
                          onChange={(e) => setEditingFormData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Internal description of this approval form"
                          rows={2}
                          disabled={isViewOnly}
                          data-testid="input-approval-description"
                        />
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Fields Section */}
              <FieldsDropZone isOver={isOverDropZone}>
                <Card className="shadow-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Approval Fields</CardTitle>
                        <CardDescription>
                          {isViewOnly 
                            ? "Fields required for this approval" 
                            : "Drag fields from the palette or click to add"}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">{editingFormData.fields.length} fields</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {editingFormData.fields.length === 0 ? (
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center transition-colors hover:border-primary/50">
                        <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
                        <p className="text-sm text-muted-foreground font-medium mb-1">
                          {isViewOnly ? "No fields configured" : "No fields added yet"}
                        </p>
                        {!isViewOnly && (
                          <p className="text-xs text-muted-foreground">
                            Drag fields from the left panel to get started
                          </p>
                        )}
                      </div>
                    ) : (
                      <SortableContext
                        items={editingFormData.fields.map((f, i) => f.id || `temp-${i}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {editingFormData.fields.map((field, index) => (
                            <SortableFieldItem
                              key={field.id || `temp-${index}`}
                              field={field}
                              onEdit={() => setEditingFieldIndex(index)}
                              onDelete={() => handleDeleteField(index)}
                              onView={() => setViewingFieldIndex(index)}
                              disabled={isViewOnly}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    )}
                  </CardContent>
                </Card>
              </FieldsDropZone>
            </div>
          </div>
        </div>
      </DndContext>

      {/* Field Editor Modal */}
      {editingFieldIndex !== null && (
        <FieldEditorModal
          field={editingFormData.fields[editingFieldIndex]}
          onSave={handleSaveField}
          onCancel={() => setEditingFieldIndex(null)}
        />
      )}

      {/* View Field Modal */}
      {viewingFieldIndex !== null && (
        <FieldEditorModal
          field={editingFormData.fields[viewingFieldIndex]}
          onSave={() => {}}
          onCancel={() => setViewingFieldIndex(null)}
          isViewOnly
        />
      )}
    </div>
  );
}
