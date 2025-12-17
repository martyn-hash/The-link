import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  GripVertical, 
  Edit2, 
  Trash2, 
  Plus, 
  Clock, 
  User, 
  CheckCircle2,
  ChevronRight,
  AlertCircle
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface StageItem {
  id: string;
  name: string;
  color: string;
  order: number;
  assigneeLabel?: string;
  slaHours?: number;
  totalTimeHours?: number;
  isFinal?: boolean;
  hasApproval?: boolean;
  reasonCount?: number;
}

interface StagePipelineProps {
  stages: StageItem[];
  onReorder: (stages: StageItem[]) => void;
  onEdit: (stage: StageItem) => void;
  onDelete: (stageId: string) => void;
  onAdd: () => void;
  orientation?: "horizontal" | "vertical";
  showConnectors?: boolean;
  isLoading?: boolean;
  className?: string;
}

interface SortableStageNodeProps {
  stage: StageItem;
  onEdit: (stage: StageItem) => void;
  onDelete: (stageId: string) => void;
  isLast: boolean;
  showConnector: boolean;
  orientation: "horizontal" | "vertical";
}

function SortableStageNode({
  stage,
  onEdit,
  onDelete,
  isLast,
  showConnector,
  orientation,
}: SortableStageNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        orientation === "horizontal" ? "flex items-center" : "flex flex-col items-center",
        isDragging && "z-50"
      )}
    >
      <Card
        className={cn(
          "relative flex items-center gap-3 p-3 border-2 transition-all duration-200",
          isDragging && "shadow-lg ring-2 ring-primary opacity-90",
          !isDragging && "hover:shadow-md hover:border-primary/50",
          orientation === "horizontal" ? "min-w-[180px]" : "w-full"
        )}
        style={{ borderColor: isDragging ? undefined : `${stage.color}40` }}
        data-testid={`pipeline-stage-${stage.id}`}
      >
        <button
          className={cn(
            "touch-none cursor-grab p-1 rounded hover:bg-muted -ml-1",
            isDragging && "cursor-grabbing"
          )}
          {...attributes}
          {...listeners}
          data-testid={`drag-handle-stage-${stage.id}`}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        <div
          className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-white font-semibold text-sm shadow-inner"
          style={{ backgroundColor: stage.color }}
        >
          {stage.order + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm truncate">{stage.name}</span>
            {stage.isFinal && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>Can be final stage</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {stage.hasApproval && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>Requires approval</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            {stage.assigneeLabel && (
              <span className="flex items-center gap-0.5">
                <User className="h-3 w-3" />
                {stage.assigneeLabel}
              </span>
            )}
            {stage.slaHours && (
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {stage.slaHours}h
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(stage)}
            data-testid={`button-edit-pipeline-stage-${stage.id}`}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(stage.id)}
            data-testid={`button-delete-pipeline-stage-${stage.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>

      {showConnector && !isLast && (
        <div
          className={cn(
            "flex items-center justify-center text-muted-foreground/50",
            orientation === "horizontal" ? "px-2" : "py-2 rotate-90"
          )}
        >
          <ChevronRight className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

function AddStageButton({ 
  onClick, 
  orientation 
}: { 
  onClick: () => void; 
  orientation: "horizontal" | "vertical";
}) {
  return (
    <Button
      variant="outline"
      className={cn(
        "border-dashed border-2 h-auto",
        orientation === "horizontal" 
          ? "min-w-[120px] flex-col gap-1 py-4" 
          : "w-full py-3"
      )}
      onClick={onClick}
      data-testid="button-add-pipeline-stage"
    >
      <Plus className="h-4 w-4" />
      <span className="text-xs">Add Stage</span>
    </Button>
  );
}

export function StagePipeline({
  stages,
  onReorder,
  onEdit,
  onDelete,
  onAdd,
  orientation = "horizontal",
  showConnectors = true,
  isLoading = false,
  className,
}: StagePipelineProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.order - b.order),
    [stages]
  );

  const stageIds = useMemo(
    () => sortedStages.map((s) => s.id),
    [sortedStages]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedStages.findIndex((s) => s.id === active.id);
      const newIndex = sortedStages.findIndex((s) => s.id === over.id);

      const reorderedStages = arrayMove(sortedStages, oldIndex, newIndex).map(
        (stage, index) => ({
          ...stage,
          order: index,
        })
      );

      onReorder(reorderedStages);
    }
  };

  if (isLoading) {
    return (
      <div className={cn(
        "flex gap-4",
        orientation === "vertical" ? "flex-col" : "flex-row flex-wrap",
        className
      )}>
        {[1, 2, 3].map((i) => (
          <Card
            key={i}
            className={cn(
              "animate-pulse bg-muted",
              orientation === "horizontal" ? "min-w-[180px] h-[72px]" : "w-full h-[72px]"
            )}
          />
        ))}
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8", className)}>
        <div className="text-center mb-4">
          <h3 className="text-lg font-medium mb-1">No stages configured</h3>
          <p className="text-sm text-muted-foreground">
            Create your first workflow stage to get started
          </p>
        </div>
        <Button onClick={onAdd} data-testid="button-add-first-stage">
          <Plus className="h-4 w-4 mr-2" />
          Add First Stage
        </Button>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={stageIds}
        strategy={
          orientation === "horizontal"
            ? horizontalListSortingStrategy
            : verticalListSortingStrategy
        }
      >
        <div
          className={cn(
            "flex gap-2",
            orientation === "vertical" ? "flex-col" : "flex-row flex-wrap items-start",
            className
          )}
        >
          {sortedStages.map((stage, index) => (
            <SortableStageNode
              key={stage.id}
              stage={stage}
              onEdit={onEdit}
              onDelete={onDelete}
              isLast={index === sortedStages.length - 1}
              showConnector={showConnectors}
              orientation={orientation}
            />
          ))}
          <AddStageButton onClick={onAdd} orientation={orientation} />
        </div>
      </SortableContext>
    </DndContext>
  );
}

export function StagePipelineCompact({
  stages,
  className,
}: {
  stages: StageItem[];
  className?: string;
}) {
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.order - b.order),
    [stages]
  );

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {sortedStages.map((stage, index) => (
        <div key={stage.id} className="flex items-center">
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 px-2 py-0.5"
            style={{
              borderColor: `${stage.color}60`,
              backgroundColor: `${stage.color}10`,
            }}
          >
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            <span className="text-xs">{stage.name}</span>
          </Badge>
          {index < sortedStages.length - 1 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground/40 mx-0.5" />
          )}
        </div>
      ))}
    </div>
  );
}
