import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GripVertical, Edit2, Trash2, Eye, Library } from "lucide-react";
import { getFieldTypeInfo, type FieldDefinition } from "./types";

interface BaseFieldCardProps {
  field: FieldDefinition;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  isViewOnly?: boolean;
  showDragHandle?: boolean;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function BaseFieldCard({
  field,
  index,
  onEdit,
  onDelete,
  isViewOnly = false,
  showDragHandle = true,
  isDragging = false,
  dragHandleProps,
}: BaseFieldCardProps) {
  const typeInfo = getFieldTypeInfo(field.fieldType);
  const Icon = typeInfo.icon;
  const color = typeInfo.color;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 bg-card border rounded-lg group transition-all",
        isDragging ? "shadow-lg ring-2 ring-primary/20 opacity-80" : "hover:shadow-md"
      )}
      data-testid={`field-card-${index}`}
    >
      {showDragHandle && !isViewOnly && (
        <div 
          {...dragHandleProps}
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
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 shrink-0">
              <Library className="w-3 h-3 mr-1" />
              Library
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge 
            variant="secondary" 
            className="text-xs shrink-0"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {typeInfo.label}
          </Badge>
          {field.isRequired && (
            <Badge variant="outline" className="text-xs shrink-0">Required</Badge>
          )}
          {field.description && (
            <span className="text-xs text-muted-foreground truncate">{field.description}</span>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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

interface SortableFieldCardProps {
  field: FieldDefinition;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  isViewOnly?: boolean;
}

export function SortableFieldCard({
  field,
  index,
  onEdit,
  onDelete,
  isViewOnly = false,
}: SortableFieldCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: field.id || field.tempId || `temp-${field.order}`,
    data: { type: 'field', field },
    disabled: isViewOnly,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <BaseFieldCard
        field={field}
        index={index}
        onEdit={onEdit}
        onDelete={onDelete}
        isViewOnly={isViewOnly}
        showDragHandle={!isViewOnly}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

export function FieldCard(props: SortableFieldCardProps) {
  return <SortableFieldCard {...props} />;
}

interface FieldCardListProps {
  fields: FieldDefinition[];
  onEditField: (index: number) => void;
  onDeleteField: (index: number) => void;
  isViewOnly?: boolean;
  emptyMessage?: string;
}

export function FieldCardList({
  fields,
  onEditField,
  onDeleteField,
  isViewOnly = false,
  emptyMessage = "No fields added yet. Drag fields from the palette or click to add."
}: FieldCardListProps) {
  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg bg-muted/20">
        <div className="text-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <BaseFieldCard
          key={field.id || field.tempId || `field-${index}`}
          field={field}
          index={index}
          onEdit={() => onEditField(index)}
          onDelete={() => onDeleteField(index)}
          isViewOnly={isViewOnly}
          showDragHandle={false}
        />
      ))}
    </div>
  );
}
