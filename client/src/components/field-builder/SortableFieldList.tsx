import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { SortableFieldCard, BaseFieldCard } from "./FieldCard";
import { type FieldDefinition } from "./types";
import { MousePointer } from "lucide-react";

interface SortableFieldListProps {
  fields: FieldDefinition[];
  onReorder: (fields: FieldDefinition[]) => void;
  onEditField: (index: number) => void;
  onDeleteField: (index: number) => void;
  isViewOnly?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function SortableFieldList({
  fields,
  onReorder,
  onEditField,
  onDeleteField,
  isViewOnly = false,
  emptyMessage = "No fields added yet",
  className
}: SortableFieldListProps) {
  const [draggedField, setDraggedField] = useState<FieldDefinition | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: any) => {
    const { active } = event;
    const field = fields.find(f => (f.id || f.tempId || `temp-${f.order}`) === active.id);
    if (field) {
      setDraggedField(field);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedField(null);

    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex(f => (f.id || f.tempId || `temp-${f.order}`) === active.id);
    const newIndex = fields.findIndex(f => (f.id || f.tempId || `temp-${f.order}`) === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(fields, oldIndex, newIndex).map((f, i) => ({ ...f, order: i }));
      onReorder(reordered);
    }
  };

  const fieldIds = fields.map(f => f.id || f.tempId || `temp-${f.order}`);

  if (fields.length === 0) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg bg-muted/20",
        className
      )}>
        <MousePointer className="w-10 h-10 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground text-center">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
        <div className={cn("space-y-3", className)}>
          {fields.map((field, index) => (
            <SortableFieldCard
              key={field.id || field.tempId || `field-${index}`}
              field={field}
              index={index}
              onEdit={() => onEditField(index)}
              onDelete={() => onDeleteField(index)}
              isViewOnly={isViewOnly}
            />
          ))}
        </div>
      </SortableContext>
      
      <DragOverlay>
        {draggedField && (
          <div className="opacity-90">
            <BaseFieldCard
              field={draggedField}
              index={-1}
              onEdit={() => {}}
              onDelete={() => {}}
              showDragHandle={false}
              isDragging
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
