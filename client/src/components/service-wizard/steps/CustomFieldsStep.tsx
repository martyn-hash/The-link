import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { 
  GripVertical, Plus, Trash2, Edit2, ChevronDown, Library, 
  Type, Hash, Calendar, ToggleLeft, List, Search, FileText
} from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { nanoid } from "nanoid";
import type { ServiceWizardFormData } from "../types";
import type { UdfDefinition, SystemFieldLibrary } from "@shared/schema";
import { ServiceFieldConfigModal } from "../ServiceFieldConfigModal";

interface CustomFieldsStepProps {
  formData: ServiceWizardFormData;
  updateFormData: (updates: Partial<ServiceWizardFormData>) => void;
}

const UDF_FIELD_TYPES = [
  { value: "short_text", label: "Short Text", icon: Type, color: "#3b82f6" },
  { value: "number", label: "Number", icon: Hash, color: "#10b981" },
  { value: "date", label: "Date", icon: Calendar, color: "#f59e0b" },
  { value: "boolean", label: "Yes/No", icon: ToggleLeft, color: "#8b5cf6" },
  { value: "dropdown", label: "Dropdown", icon: List, color: "#ec4899" },
] as const;

type UdfType = typeof UDF_FIELD_TYPES[number]["value"];

const getFieldTypeInfo = (type: string) => {
  return UDF_FIELD_TYPES.find(ft => ft.value === type) || UDF_FIELD_TYPES[0];
};

const mapSystemFieldTypeToUdf = (fieldType: string): UdfType => {
  const typeMap: Record<string, UdfType> = {
    boolean: "boolean",
    number: "number",
    short_text: "short_text",
    long_text: "short_text",
    date: "date",
    single_select: "dropdown",
    multi_select: "dropdown",
    email: "short_text",
    phone: "short_text",
    url: "short_text",
    currency: "number",
    percentage: "number",
  };
  return typeMap[fieldType] || "short_text";
};

function SortableFieldCard({
  field,
  index,
  onEdit,
  onDelete,
}: {
  field: UdfDefinition;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeInfo = getFieldTypeInfo(field.type);
  const Icon = typeInfo.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-4 bg-card border rounded-lg group hover:shadow-md transition-all"
      data-testid={`field-card-${index}`}
    >
      <div 
        {...attributes} 
        {...listeners}
        className="cursor-grab hover:bg-muted rounded p-1 transition-colors"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${typeInfo.color}15` }}
      >
        <Icon className="w-5 h-5" style={{ color: typeInfo.color }} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{field.name || "Untitled Field"}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge 
            variant="secondary" 
            className="text-xs"
            style={{ backgroundColor: `${typeInfo.color}15`, color: typeInfo.color }}
          >
            {typeInfo.label}
          </Badge>
          {field.required && (
            <Badge variant="outline" className="text-xs">Required</Badge>
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
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
          data-testid={`button-delete-field-${index}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function PaletteItem({ 
  type, 
  onClick 
}: { 
  type: typeof UDF_FIELD_TYPES[number];
  onClick: () => void;
}) {
  const Icon = type.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 bg-card border rounded-lg transition-all text-sm group cursor-pointer hover:bg-accent hover:border-primary hover:shadow-sm w-full text-left"
      data-testid={`palette-field-${type.value}`}
    >
      <div 
        className="w-8 h-8 rounded-md flex items-center justify-center transition-transform group-hover:scale-110"
        style={{ backgroundColor: `${type.color}15` }}
      >
        <Icon className="w-4 h-4" style={{ color: type.color }} />
      </div>
      <span className="font-medium flex-1 truncate">{type.label}</span>
      <Plus className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

export function CustomFieldsStep({ formData, updateFormData }: CustomFieldsStepProps) {
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [isSystemLibraryOpen, setIsSystemLibraryOpen] = useState(false);
  const [systemSearchQuery, setSystemSearchQuery] = useState("");

  const { data: systemFields = [], isLoading: systemFieldsLoading } = useQuery<SystemFieldLibrary[]>({
    queryKey: ["/api/system-field-library", { isArchived: false }],
  });

  const filteredSystemFields = useMemo(() => {
    const allowedTypes = ["boolean", "number", "short_text", "long_text", "date", "single_select", "multi_select", "email", "phone", "url", "currency", "percentage"];
    let result = systemFields.filter(f => allowedTypes.includes(f.fieldType));
    
    if (systemSearchQuery.trim()) {
      const query = systemSearchQuery.toLowerCase();
      result = result.filter(f => 
        f.fieldName.toLowerCase().includes(query) ||
        (f.description && f.description.toLowerCase().includes(query))
      );
    }
    
    return result;
  }, [systemFields, systemSearchQuery]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = formData.udfDefinitions.findIndex(f => f.id === active.id);
    const newIndex = formData.udfDefinitions.findIndex(f => f.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      updateFormData({
        udfDefinitions: arrayMove(formData.udfDefinitions, oldIndex, newIndex)
      });
    }
  }, [formData.udfDefinitions, updateFormData]);

  const handleAddField = useCallback((type: UdfType) => {
    const newField: UdfDefinition = {
      id: nanoid(),
      name: "",
      type,
      required: false,
      placeholder: "",
      options: type === "dropdown" ? [] : undefined,
    };
    updateFormData({
      udfDefinitions: [...formData.udfDefinitions, newField]
    });
    setEditingFieldIndex(formData.udfDefinitions.length);
  }, [formData.udfDefinitions, updateFormData]);

  const handleAddFromSystemLibrary = useCallback((systemField: SystemFieldLibrary) => {
    const mappedType = mapSystemFieldTypeToUdf(systemField.fieldType);
    const newField: UdfDefinition = {
      id: nanoid(),
      name: systemField.fieldName,
      type: mappedType,
      required: systemField.isRequired || false,
      placeholder: "",
      options: systemField.options || undefined,
    };
    updateFormData({
      udfDefinitions: [...formData.udfDefinitions, newField]
    });
    setEditingFieldIndex(formData.udfDefinitions.length);
  }, [formData.udfDefinitions, updateFormData]);

  const handleSaveField = useCallback((field: UdfDefinition) => {
    if (editingFieldIndex === null) return;
    const newFields = [...formData.udfDefinitions];
    newFields[editingFieldIndex] = field;
    updateFormData({ udfDefinitions: newFields });
    setEditingFieldIndex(null);
  }, [editingFieldIndex, formData.udfDefinitions, updateFormData]);

  const handleDeleteField = useCallback((index: number) => {
    updateFormData({
      udfDefinitions: formData.udfDefinitions.filter((_, i) => i !== index)
    });
  }, [formData.udfDefinitions, updateFormData]);

  const editingField = editingFieldIndex !== null ? formData.udfDefinitions[editingFieldIndex] : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Custom Fields</h2>
        <p className="text-muted-foreground mt-1">
          Define custom data fields that will be collected when clients use this service
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Fields
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {UDF_FIELD_TYPES.map((type) => (
                <PaletteItem
                  key={type.value}
                  type={type}
                  onClick={() => handleAddField(type.value)}
                />
              ))}
            </CardContent>
          </Card>

          <Collapsible open={isSystemLibraryOpen} onOpenChange={setIsSystemLibraryOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2 text-emerald-700">
                      <Library className="w-4 h-4" />
                      System Library
                    </span>
                    <ChevronDown className={cn(
                      "w-4 h-4 transition-transform",
                      isSystemLibraryOpen && "rotate-180"
                    )} />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search library..."
                      value={systemSearchQuery}
                      onChange={(e) => setSystemSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-system-library-search"
                    />
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2 pr-4">
                      {systemFieldsLoading ? (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          Loading...
                        </div>
                      ) : filteredSystemFields.length === 0 ? (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          No matching fields found
                        </div>
                      ) : (
                        filteredSystemFields.map((field) => {
                          const typeInfo = getFieldTypeInfo(mapSystemFieldTypeToUdf(field.fieldType));
                          const Icon = typeInfo.icon;
                          return (
                            <button
                              key={field.id}
                              type="button"
                              onClick={() => handleAddFromSystemLibrary(field)}
                              className="flex items-center gap-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors w-full text-left text-sm"
                              data-testid={`system-field-${field.id}`}
                            >
                              <Icon className="w-4 h-4 text-emerald-600" />
                              <span className="font-medium truncate flex-1">{field.fieldName}</span>
                              <Plus className="w-4 h-4 text-emerald-600" />
                            </button>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Custom Fields
                  </CardTitle>
                  <CardDescription>
                    Drag to reorder fields. Click to edit.
                  </CardDescription>
                </div>
                {formData.udfDefinitions.length > 0 && (
                  <Badge variant="secondary">
                    {formData.udfDefinitions.length} field{formData.udfDefinitions.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {formData.udfDefinitions.length === 0 ? (
                <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No custom fields yet</p>
                  <p className="text-sm mt-1">
                    Click a field type on the left to add it, or pick from the System Library
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={formData.udfDefinitions.map(f => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {formData.udfDefinitions.map((field, index) => (
                        <SortableFieldCard
                          key={field.id}
                          field={field}
                          index={index}
                          onEdit={() => setEditingFieldIndex(index)}
                          onDelete={() => handleDeleteField(index)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {editingField && (
        <ServiceFieldConfigModal
          field={editingField}
          isOpen={editingFieldIndex !== null}
          onClose={() => setEditingFieldIndex(null)}
          onSave={handleSaveField}
        />
      )}
    </div>
  );
}
