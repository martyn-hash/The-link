import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { 
  X, Save, GripVertical, Plus, Trash2, Edit2, Eye,
  ToggleLeft, Hash, Type, FileText, Calendar, CircleDot, CheckSquare,
  ChevronRight, ChevronLeft, Library, Sparkles, ClipboardCheck, Check, Settings,
  ImageIcon
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
  { type: "image_upload", label: "Image Upload", icon: ImageIcon, color: "#0ea5e9" },
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

interface ApprovalWizardProps {
  mode: "create" | "edit" | "view";
  formData: ApprovalFormData;
  projectTypes: ProjectType[];
  stages: KanbanStage[];
  libraryFields?: ApprovalFieldLibrary[];
  onSave: (data: ApprovalFormData) => void;
  onCancel: () => void;
  isSaving?: boolean;
  onProjectTypeChange?: (projectTypeId: string) => void;
  requireStageSelection?: boolean;
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

const WIZARD_STEPS = [
  { id: 1, name: "Basic Information", icon: Settings },
  { id: 2, name: "Approval Fields", icon: ClipboardCheck },
];

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
      {!disabled && (
        <Plus className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}

function SortableFieldItem({
  field,
  index,
  onEdit,
  onDelete,
  isViewOnly = false,
}: {
  field: EditingApprovalField;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  isViewOnly?: boolean;
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
    disabled: isViewOnly,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const fieldTypeInfo = FIELD_TYPES.find(ft => ft.type === field.fieldType);
  const Icon = fieldTypeInfo?.icon || Type;
  const color = fieldTypeInfo?.color || "#6b7280";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-4 bg-card border rounded-lg group hover:shadow-md transition-all"
      data-testid={`field-item-${index}`}
    >
      {!isViewOnly && (
        <div 
          {...attributes} 
          {...listeners}
          className="cursor-grab hover:bg-muted rounded p-1 transition-colors"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{field.fieldName || "Untitled Field"}</span>
          {field.libraryFieldId && (
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
              <Library className="w-3 h-3 mr-1" />
              Library
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-xs" style={{ backgroundColor: `${color}15`, color }}>
            {fieldTypeInfo?.label || field.fieldType}
          </Badge>
          {field.isRequired && (
            <Badge variant="outline" className="text-xs">Required</Badge>
          )}
          {field.description && (
            <span className="text-xs text-muted-foreground truncate">{field.description}</span>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={onEdit}
          data-testid={`button-edit-field-${index}`}
        >
          {isViewOnly ? <Eye className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
        </Button>
        {!isViewOnly && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete}
            data-testid={`button-delete-field-${index}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function FieldConfigModal({
  field,
  isOpen,
  onClose,
  onSave,
  isViewOnly = false,
}: {
  field: EditingApprovalField;
  isOpen: boolean;
  onClose: () => void;
  onSave: (field: EditingApprovalField) => void;
  isViewOnly?: boolean;
}) {
  const [editedField, setEditedField] = useState<EditingApprovalField>(field);
  const [newOption, setNewOption] = useState("");

  const fieldTypeInfo = FIELD_TYPES.find(ft => ft.type === editedField.fieldType);
  const Icon = fieldTypeInfo?.icon || Type;
  const color = fieldTypeInfo?.color || "#6b7280";

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
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
                {isViewOnly ? "View Field" : field.fieldName ? "Edit Field" : "Configure Field"}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">{fieldTypeInfo?.label} field</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="field-name">Field Name *</Label>
            <Input
              id="field-name"
              value={editedField.fieldName}
              onChange={(e) => setEditedField(prev => ({ ...prev, fieldName: e.target.value }))}
              placeholder="e.g., Has client signed off?"
              disabled={isViewOnly}
              data-testid="input-field-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-description">Description (optional)</Label>
            <Textarea
              id="field-description"
              value={editedField.description}
              onChange={(e) => setEditedField(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Additional context for this field..."
              disabled={isViewOnly}
              rows={2}
              data-testid="input-field-description"
            />
          </div>

          <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
            <div>
              <Label htmlFor="field-required" className="font-medium">Required field</Label>
              <p className="text-xs text-muted-foreground">Must be completed before approval</p>
            </div>
            <Switch
              id="field-required"
              checked={editedField.isRequired}
              onCheckedChange={(checked) => setEditedField(prev => ({ ...prev, isRequired: checked }))}
              disabled={isViewOnly}
              data-testid="switch-field-required"
            />
          </div>

          {editedField.fieldType === "boolean" && (
            <div className="space-y-2">
              <Label>Expected Value</Label>
              <Select
                value={editedField.expectedValueBoolean === null ? "any" : editedField.expectedValueBoolean ? "yes" : "no"}
                onValueChange={(value) => setEditedField(prev => ({
                  ...prev,
                  expectedValueBoolean: value === "any" ? null : value === "yes"
                }))}
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

          {editedField.fieldType === "number" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Comparison</Label>
                <Select
                  value={editedField.comparisonType || "none"}
                  onValueChange={(value) => setEditedField(prev => ({
                    ...prev,
                    comparisonType: value === "none" ? null : value as any
                  }))}
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
                  <Label>Expected Value</Label>
                  <Input
                    type="number"
                    value={editedField.expectedValueNumber ?? ""}
                    onChange={(e) => setEditedField(prev => ({
                      ...prev,
                      expectedValueNumber: e.target.value ? parseFloat(e.target.value) : null
                    }))}
                    placeholder="0"
                    disabled={isViewOnly}
                    data-testid="input-expected-number"
                  />
                </div>
              )}
            </div>
          )}

          {(editedField.fieldType === "single_select" || editedField.fieldType === "multi_select") && (
            <div className="space-y-2">
              <Label>Options</Label>
              <div className="space-y-2">
                {editedField.options.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input value={option} disabled className="flex-1" />
                    {!isViewOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveOption(idx)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {!isViewOnly && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      placeholder="Add option..."
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddOption())}
                      data-testid="input-new-option"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={handleAddOption}
                      disabled={!newOption.trim()}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-field">
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

function DropZone({ children, isOver }: { children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef } = useDroppable({
    id: 'fields-drop-zone',
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "min-h-[200px] rounded-lg border-2 border-dashed transition-all p-4",
        isOver 
          ? "border-primary bg-primary/5 ring-2 ring-primary ring-offset-2" 
          : "border-muted-foreground/25"
      )}
    >
      {children}
    </div>
  );
}

export function ApprovalWizard({
  mode,
  formData,
  projectTypes,
  stages,
  libraryFields = [],
  onSave,
  onCancel,
  isSaving = false,
  onProjectTypeChange,
  requireStageSelection = true,
}: ApprovalWizardProps) {
  const [currentStep, setCurrentStep] = useState(mode === "create" ? 1 : 2);
  const [editingFormData, setEditingFormData] = useState<ApprovalFormData>(formData);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [viewingFieldIndex, setViewingFieldIndex] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isOverDropZone, setIsOverDropZone] = useState(false);

  const isViewOnly = mode === "view";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedProjectType = projectTypes.find(pt => pt.id === editingFormData.projectTypeId);
  const filteredStages = stages.filter(s => s.projectTypeId === editingFormData.projectTypeId);
  const selectedStage = filteredStages.find(s => s.id === editingFormData.stageId);

  const canProceedToStep2 = useMemo(() => {
    const hasName = !!editingFormData.name.trim();
    const hasProjectType = !!editingFormData.projectTypeId;
    const hasStage = !requireStageSelection || !!editingFormData.stageId;
    return hasName && hasProjectType && hasStage;
  }, [editingFormData.name, editingFormData.projectTypeId, editingFormData.stageId, requireStageSelection]);

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

    if (active.id.toString().startsWith('library-')) {
      if (over.id !== 'fields-drop-zone' && !over.data?.current?.type) return;
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

    if (active.id.toString().startsWith('palette-')) {
      if (over.id !== 'fields-drop-zone' && !over.data?.current?.type) return;
      const fieldType = active.data.current?.type as FieldType;
      const newField: EditingApprovalField = {
        ...DEFAULT_FIELD,
        fieldType,
        fieldName: "",
        order: editingFormData.fields.length,
      };
      setEditingFormData(prev => ({
        ...prev,
        fields: [...prev.fields, newField]
      }));
      setEditingFieldIndex(editingFormData.fields.length);
      return;
    }

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
    const newField: EditingApprovalField = {
      ...DEFAULT_FIELD,
      fieldType,
      fieldName: "",
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

  const handleSaveField = (field: EditingApprovalField) => {
    if (editingFieldIndex === null) return;
    const newFields = [...editingFormData.fields];
    newFields[editingFieldIndex] = field;
    setEditingFormData(prev => ({
      ...prev,
      fields: newFields
    }));
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

  const handleNextStep = () => {
    if (currentStep === 1 && canProceedToStep2) {
      setCurrentStep(2);
    }
  };

  const handlePrevStep = () => {
    if (currentStep === 2 && mode === "create") {
      setCurrentStep(1);
    }
  };

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

        {/* Step Indicator */}
        <div className="flex items-center gap-3">
          {WIZARD_STEPS.map((step, idx) => {
            const isActive = currentStep === step.id;
            const isComplete = currentStep > step.id;
            const Icon = step.icon;
            
            return (
              <div key={step.id} className="flex items-center gap-2">
                {idx > 0 && (
                  <div className={cn(
                    "w-8 h-px",
                    isComplete || isActive ? "bg-primary" : "bg-muted-foreground/25"
                  )} />
                )}
                <div 
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                    isActive && "bg-primary text-primary-foreground",
                    isComplete && "bg-primary/10 text-primary",
                    !isActive && !isComplete && "bg-muted text-muted-foreground"
                  )}
                >
                  {isComplete ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">{step.name}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {currentStep === 2 && mode === "create" && (
            <Button variant="outline" onClick={handlePrevStep} data-testid="button-prev-step">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          {currentStep === 1 && (
            <Button 
              onClick={handleNextStep} 
              disabled={!canProceedToStep2}
              data-testid="button-next-step"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          {currentStep === 2 && !isViewOnly && (
            <Button 
              onClick={handleSave} 
              disabled={!editingFormData.name.trim() || !editingFormData.projectTypeId || (requireStageSelection && !editingFormData.stageId) || isSaving}
              data-testid="button-save-approval"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Approval"}
            </Button>
          )}
        </div>
      </div>

      {/* Step 1: Basic Information */}
      {currentStep === 1 && (
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto">
            {projectTypes.length === 0 ? (
              <Card className="shadow-lg">
                <CardContent className="py-12 text-center">
                  <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Project Types Available</h3>
                  <p className="text-muted-foreground mb-4">
                    This client needs services with project types before custom approvals can be created.
                  </p>
                  <Button variant="outline" onClick={onCancel}>
                    Go Back
                  </Button>
                </CardContent>
              </Card>
            ) : (
            <Card className="shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Basic Information</CardTitle>
                    <CardDescription>Set up the approval form details</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className={requireStageSelection ? "grid grid-cols-2 gap-4" : ""}>
                  <div className="space-y-2">
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
                      disabled={isViewOnly || mode === "edit" || projectTypes.length === 1}
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
                  {requireStageSelection && (
                    <div className="space-y-2">
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
                  )}
                </div>
                
                <div className="space-y-2">
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

                <div className="space-y-2">
                  <Label htmlFor="approval-description">Description (optional)</Label>
                  <Textarea
                    id="approval-description"
                    value={editingFormData.description}
                    onChange={(e) => setEditingFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this approval is for..."
                    disabled={isViewOnly}
                    rows={3}
                    data-testid="input-approval-description"
                  />
                </div>
              </CardContent>
            </Card>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Field Builder */}
      {currentStep === 2 && (
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
                      {isViewOnly ? "View available fields" : "Drag or click to add"}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
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
              <div className="max-w-3xl mx-auto">
                {/* Summary Card */}
                <Card className="mb-6 shadow-sm">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <ClipboardCheck className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{editingFormData.name || "Untitled Approval"}</h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedProjectType?.name} → {selectedStage?.name}
                        </p>
                      </div>
                      {mode === "create" && (
                        <Button variant="outline" size="sm" onClick={handlePrevStep}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit Details
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Fields Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Approval Fields</h3>
                    <Badge variant="secondary">{editingFormData.fields.length} fields</Badge>
                  </div>

                  <DropZone isOver={isOverDropZone}>
                    {editingFormData.fields.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                          <Plus className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h4 className="font-medium text-muted-foreground mb-1">No fields added yet</h4>
                        <p className="text-sm text-muted-foreground">
                          {isViewOnly ? "This approval has no fields" : "Drag fields from the palette or click to add"}
                        </p>
                      </div>
                    ) : (
                      <SortableContext
                        items={editingFormData.fields.map((f, i) => f.id || `temp-${f.order}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {editingFormData.fields.map((field, index) => (
                            <SortableFieldItem
                              key={field.id || `temp-${field.order}`}
                              field={field}
                              index={index}
                              onEdit={() => isViewOnly ? setViewingFieldIndex(index) : setEditingFieldIndex(index)}
                              onDelete={() => handleDeleteField(index)}
                              isViewOnly={isViewOnly}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    )}
                  </DropZone>
                </div>
              </div>
            </div>
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeId && activeId.toString().startsWith('palette-') && (
              <div className="flex items-center gap-3 px-4 py-3 bg-card border-2 border-primary rounded-lg shadow-lg opacity-90">
                <Type className="w-5 h-5 text-primary" />
                <span className="font-medium">{FIELD_TYPES.find(ft => `palette-${ft.type}` === activeId)?.label}</span>
              </div>
            )}
            {activeId && activeId.toString().startsWith('library-') && (() => {
              const libraryFieldId = activeId.toString().replace('library-', '');
              const libraryField = libraryFields.find(lf => lf.id === libraryFieldId);
              const fieldTypeInfo = libraryField ? FIELD_TYPES.find(ft => ft.type === libraryField.fieldType) : null;
              return libraryField ? (
                <div className="flex items-center gap-3 px-4 py-3 bg-card border-2 border-purple-500 rounded-lg shadow-lg opacity-90">
                  {fieldTypeInfo?.icon && <fieldTypeInfo.icon className="w-5 h-5 text-purple-500" />}
                  <span className="font-medium">{libraryField.fieldName}</span>
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">Library</Badge>
                </div>
              ) : null;
            })()}
          </DragOverlay>
        </DndContext>
      )}

      {/* Field Config Modal */}
      {editingFieldIndex !== null && (
        <FieldConfigModal
          field={editingFormData.fields[editingFieldIndex]}
          isOpen={true}
          onClose={() => setEditingFieldIndex(null)}
          onSave={handleSaveField}
        />
      )}
      {viewingFieldIndex !== null && (
        <FieldConfigModal
          field={editingFormData.fields[viewingFieldIndex]}
          isOpen={true}
          onClose={() => setViewingFieldIndex(null)}
          onSave={() => {}}
          isViewOnly
        />
      )}
    </div>
  );
}
