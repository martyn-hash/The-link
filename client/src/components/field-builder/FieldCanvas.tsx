import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FieldCard } from "./FieldCard";
import { type FieldDefinition } from "./types";
import { ClipboardCheck, MousePointer } from "lucide-react";

interface FieldCanvasProps {
  fields: FieldDefinition[];
  onEditField: (index: number) => void;
  onDeleteField: (index: number) => void;
  isViewOnly?: boolean;
  title?: string;
  description?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  className?: string;
}

export function FieldCanvas({
  fields,
  onEditField,
  onDeleteField,
  isViewOnly = false,
  title = "Form Fields",
  description = "Drag and drop fields to reorder them",
  emptyStateTitle = "No fields added yet",
  emptyStateDescription = "Drag fields from the palette on the left, or click a field type to add it",
  className
}: FieldCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "canvas",
  });

  const fieldIds = fields.map(f => f.id || f.tempId || `temp-${f.order}`);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div
          ref={setNodeRef}
          className={cn(
            "p-4 min-h-[400px] transition-colors",
            isOver && "bg-primary/5"
          )}
        >
          {fields.length === 0 ? (
            <div className={cn(
              "flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg transition-colors",
              isOver ? "border-primary bg-primary/5" : "border-muted-foreground/20 bg-muted/20"
            )}>
              <MousePointer className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="font-medium text-muted-foreground">{emptyStateTitle}</p>
              <p className="text-sm text-muted-foreground/70 text-center mt-1 max-w-xs">
                {emptyStateDescription}
              </p>
            </div>
          ) : (
            <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <FieldCard
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
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
