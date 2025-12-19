import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { 
  X, Save, GripVertical, Plus, Trash2, Edit2, Eye,
  ChevronRight, ChevronLeft, Library, Sparkles, ClipboardCheck, Check, Settings,
  BookOpen, Type, Search
} from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ProjectType, KanbanStage, SystemFieldLibrary } from "@shared/schema";
import { FIELD_TYPES, getFieldTypeInfo, type SystemFieldType, type FieldDefinition } from "@/components/field-builder/types";
import { stageApprovalFieldAdapter, normalizeFieldType } from "@/components/field-builder/adapters";
import { FieldConfigModal as SharedFieldConfigModal } from "@/components/field-builder/FieldConfigModal";

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "general", label: "General" },
  { value: "contact", label: "Contact" },
  { value: "financial", label: "Financial" },
  { value: "compliance", label: "Compliance" },
  { value: "documentation", label: "Documentation" },
  { value: "scheduling", label: "Scheduling" },
  { value: "custom", label: "Custom" },
];

const APPROVAL_FIELD_TYPES = FIELD_TYPES.filter(ft => 
  stageApprovalFieldAdapter.allowedFieldTypes.includes(ft.type)
);

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

  const normalizedType = normalizeFieldType(field.fieldType);
  const fieldTypeInfo = getFieldTypeInfo(normalizedType);
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

function ApprovalFieldConfigModal({
  field,
  index,
  isOpen,
  onClose,
  onSave,
  isViewOnly = false,
}: {
  field: EditingApprovalField;
  index: number;
  isOpen: boolean;
  onClose: () => void;
  onSave: (field: EditingApprovalField) => void;
  isViewOnly?: boolean;
}) {
  const fieldDefinition = useMemo(() => 
    stageApprovalFieldAdapter.mapToFieldDefinition(field, index),
    [field, index]
  );

  const handleSave = useCallback((savedField: FieldDefinition) => {
    const mappedBack = stageApprovalFieldAdapter.mapFromFieldDefinition(savedField);
    onSave({
      id: field.id,
      order: field.order,
      fieldName: mappedBack.fieldName!,
      fieldType: mappedBack.fieldType as FieldType,
      description: mappedBack.description || "",
      isRequired: mappedBack.isRequired!,
      options: mappedBack.options || [],
      libraryFieldId: mappedBack.libraryFieldId,
      expectedValueBoolean: mappedBack.expectedValueBoolean,
      expectedValueNumber: mappedBack.expectedValueNumber,
      comparisonType: mappedBack.comparisonType,
    });
  }, [field, onSave]);

  return (
    <SharedFieldConfigModal
      field={fieldDefinition}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      isViewOnly={isViewOnly}
      allowedFieldTypes={stageApprovalFieldAdapter.allowedFieldTypes}
      capabilities={stageApprovalFieldAdapter.capabilities}
    />
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
  const [systemCategoryFilter, setSystemCategoryFilter] = useState<string>("all");
  const [systemSearchQuery, setSystemSearchQuery] = useState("");

  const isViewOnly = mode === "view";

  const ALLOWED_SYSTEM_FIELD_TYPES = ["boolean", "number", "short_text", "long_text", "date", "single_select", "multi_select", "image_upload"];

  const { data: systemFields = [], isLoading: systemFieldsLoading } = useQuery<SystemFieldLibrary[]>({
    queryKey: ["/api/system-field-library", { isArchived: false }],
  });

  const filteredSystemFields = useMemo(() => {
    let result = systemFields.filter(f => ALLOWED_SYSTEM_FIELD_TYPES.includes(f.fieldType));
    
    if (systemCategoryFilter !== "all") {
      result = result.filter(f => f.category === systemCategoryFilter);
    }
    
    if (systemSearchQuery.trim()) {
      const query = systemSearchQuery.toLowerCase();
      result = result.filter(f => 
        f.fieldName.toLowerCase().includes(query) ||
        (f.description && f.description.toLowerCase().includes(query))
      );
    }
    
    return result;
  }, [systemFields, systemCategoryFilter, systemSearchQuery, ALLOWED_SYSTEM_FIELD_TYPES]);

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

  const handleAddFieldFromSystemLibrary = (systemField: SystemFieldLibrary) => {
    if (isViewOnly) return;
    const mappedFieldType = ALLOWED_SYSTEM_FIELD_TYPES.includes(systemField.fieldType) 
      ? systemField.fieldType as FieldType 
      : "short_text" as FieldType;
    
    const newField: EditingApprovalField = {
      ...DEFAULT_FIELD,
      fieldName: systemField.fieldName,
      fieldType: mappedFieldType,
      description: systemField.description || "",
      libraryFieldId: null,
      options: systemField.options || [],
      isRequired: systemField.isRequired || false,
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
            {/* Left Palette - Wider panel with 50/50 split */}
            <div className="w-[400px] border-r border-border bg-muted/30 flex flex-col overflow-hidden">
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
              
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* System Library Section - Top 50% */}
                {!isViewOnly && (
                  <div className="h-1/2 flex flex-col border-b border-border">
                    <div className="p-3 border-b border-border/50 bg-emerald-50/50 dark:bg-emerald-950/20">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">System Library</h4>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {filteredSystemFields.length}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Search..."
                            value={systemSearchQuery}
                            onChange={(e) => setSystemSearchQuery(e.target.value)}
                            className="h-8 pl-7 text-sm"
                            data-testid="input-search-system-fields"
                          />
                        </div>
                        <Select value={systemCategoryFilter} onValueChange={setSystemCategoryFilter}>
                          <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="select-category-filter">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORY_OPTIONS.map(cat => (
                              <SelectItem key={cat.value} value={cat.value} className="text-xs">
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-3 space-y-1.5">
                        {systemFieldsLoading ? (
                          <>
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                          </>
                        ) : filteredSystemFields.length === 0 ? (
                          <div className="text-center py-4 text-sm text-muted-foreground">
                            <Library className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No matching fields</p>
                          </div>
                        ) : (
                          filteredSystemFields.map(sf => {
                            const normalizedType = normalizeFieldType(sf.fieldType);
                            const fieldTypeInfo = getFieldTypeInfo(normalizedType);
                            return (
                              <button
                                key={sf.id}
                                className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors text-left group"
                                onClick={() => handleAddFieldFromSystemLibrary(sf)}
                                data-testid={`button-add-system-field-${sf.id}`}
                              >
                                <div 
                                  className="w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0"
                                  style={{ backgroundColor: fieldTypeInfo?.color || "#6b7280" }}
                                >
                                  {fieldTypeInfo?.icon ? <fieldTypeInfo.icon className="w-3.5 h-3.5" /> : <Type className="w-3.5 h-3.5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{sf.fieldName}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {fieldTypeInfo?.label || sf.fieldType}
                                  </p>
                                </div>
                                <Plus className="w-4 h-4 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                              </button>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Custom Fields Section - Bottom 50% (or full height if view only) */}
                <div className={cn("flex flex-col", !isViewOnly ? "h-1/2" : "h-full")}>
                  <div className="p-3 border-b border-border/50 bg-blue-50/50 dark:bg-blue-950/20">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-blue-500" />
                      <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400">Custom Fields</h4>
                    </div>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-3 space-y-1.5">
                      {APPROVAL_FIELD_TYPES.map(ft => (
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
                  </ScrollArea>
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
            {activeId && activeId.toString().startsWith('palette-') && (() => {
              const rawFieldType = activeId.toString().replace('palette-', '');
              const normalizedType = normalizeFieldType(rawFieldType);
              const fieldTypeInfo = getFieldTypeInfo(normalizedType);
              const IconComponent = fieldTypeInfo?.icon || Type;
              return (
                <div className="flex items-center gap-3 px-4 py-3 bg-card border-2 border-primary rounded-lg shadow-lg opacity-90">
                  <IconComponent className="w-5 h-5 text-primary" />
                  <span className="font-medium">{fieldTypeInfo?.label || rawFieldType}</span>
                </div>
              );
            })()}
          </DragOverlay>
        </DndContext>
      )}

      {/* Field Config Modal */}
      {editingFieldIndex !== null && (
        <ApprovalFieldConfigModal
          key={`edit-${editingFormData.fields[editingFieldIndex]?.id || editingFieldIndex}`}
          field={editingFormData.fields[editingFieldIndex]}
          index={editingFieldIndex}
          isOpen={true}
          onClose={() => setEditingFieldIndex(null)}
          onSave={handleSaveField}
        />
      )}
      {viewingFieldIndex !== null && (
        <ApprovalFieldConfigModal
          key={`view-${editingFormData.fields[viewingFieldIndex]?.id || viewingFieldIndex}`}
          field={editingFormData.fields[viewingFieldIndex]}
          index={viewingFieldIndex}
          isOpen={true}
          onClose={() => setViewingFieldIndex(null)}
          onSave={() => {}}
          isViewOnly
        />
      )}

    </div>
  );
}
