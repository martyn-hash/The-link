import { useState, useEffect, useMemo, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
  closestCenter,
  rectIntersection,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  CollisionDetection,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import PivotTableUI from "react-pivottable/PivotTableUI";
import "react-pivottable/pivottable.css";
import TableRenderers from "react-pivottable/TableRenderers";
import type { ProjectWithRelations } from "@shared/schema";
import type { PivotConfig } from "@/types/projects-page";
import { format } from "date-fns";
import {
  Filter,
  Rows3,
  Columns3,
  Calculator,
  GripVertical,
  ChevronDown,
  ChevronRight,
  X,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PivotBuilderProps {
  projects: ProjectWithRelations[];
  pivotConfig?: PivotConfig | null;
  onPivotConfigChange?: (config: PivotConfig) => void;
}

interface FieldDefinition {
  id: string;
  label: string;
  values: string[];
}

interface LayoutState {
  rows: string[];
  columns: string[];
  values: string[];
  filters: Record<string, Record<string, boolean>>;
  aggregatorName: string;
}

function transformProjectsForPivot(
  projects: ProjectWithRelations[]
): Record<string, any>[] {
  return projects.map((project) => {
    const dueDate = project.dueDate ? new Date(project.dueDate) : null;
    const targetDate = project.targetDeliveryDate
      ? new Date(project.targetDeliveryDate)
      : null;
    const dueDateStr = dueDate ? format(dueDate, "MMM yyyy") : "No Due Date";
    const targetDateStr = targetDate
      ? format(targetDate, "MMM yyyy")
      : "No Target Date";

    const getDaysToTarget = () => {
      if (!targetDate) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(targetDate);
      target.setHours(0, 0, 0, 0);
      return Math.ceil(
        (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
    };

    return {
      Client: project.client?.name || "Unknown",
      "Project Type": project.projectType?.name || "Unknown",
      Status: project.currentStatus || "Unknown",
      "Service Owner": project.projectOwner
        ? `${project.projectOwner.firstName || ""} ${project.projectOwner.lastName || ""}`.trim() ||
          "Unassigned"
        : "Unassigned",
      "Assigned To": project.currentAssignee
        ? `${project.currentAssignee.firstName || ""} ${project.currentAssignee.lastName || ""}`.trim() ||
          "Unassigned"
        : "Unassigned",
      "Due Month": dueDateStr,
      "Target Month": targetDateStr,
      Year: dueDate ? format(dueDate, "yyyy") : "N/A",
      Quarter: dueDate ? `Q${Math.ceil((dueDate.getMonth() + 1) / 3)}` : "N/A",
      "Days to Target": getDaysToTarget() ?? 0,
      "Project Month": project.projectMonth || "N/A",
      "Is Archived": project.archived ? "Yes" : "No",
      Count: 1,
    };
  });
}

function DraggableFieldChip({
  id,
  label,
  zone,
  onRemove,
  isUsed,
}: {
  id: string;
  label: string;
  zone?: string;
  onRemove?: () => void;
  isUsed?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: zone ? `${zone}:${id}` : `field:${id}`,
      data: { fieldId: id, label, fromZone: zone },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  // Chips in zones (with onRemove) use lighter styling than library chips
  const inZone = !!onRemove;
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
        ${inZone 
          ? "bg-primary/15 border-primary/30 text-foreground" 
          : isUsed 
            ? "bg-primary/10 border-primary/30" 
            : "bg-muted border-border"
        }
        border cursor-grab active:cursor-grabbing
        hover:bg-primary/20 transition-colors select-none
        ${isDragging ? "shadow-lg ring-2 ring-primary" : ""}
      `}
      data-testid={`field-chip-${id}`}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" />
      <span>{label}</span>
      {isUsed && !inZone && <span className="text-xs text-primary">●</span>}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:bg-destructive/20 rounded p-0.5"
          data-testid={`remove-field-${id}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function DraggableValueChip({
  fieldId,
  value,
}: {
  fieldId: string;
  value: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `value:${fieldId}:${value}`,
      data: { fieldId, value, type: "value" },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        inline-flex items-center gap-1 px-2 py-1 rounded text-xs
        bg-muted border border-border/50 cursor-grab active:cursor-grabbing
        hover:bg-muted/80 transition-colors select-none
        ${isDragging ? "shadow-md ring-1 ring-primary" : ""}
      `}
      data-testid={`value-chip-${fieldId}-${value}`}
    >
      <span className="truncate max-w-[120px]">{value}</span>
    </div>
  );
}

function DropZone({
  id,
  label,
  icon: Icon,
  items,
  onRemoveItem,
  placeholder,
  className,
}: {
  id: string;
  label: string;
  icon: React.ElementType;
  items: string[];
  onRemoveItem: (item: string) => void;
  placeholder: string;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-lg border-2 border-dashed p-4 min-h-[100px] transition-all
        ${isOver ? "border-primary bg-primary/5" : "border-border bg-card"}
        ${className || ""}
      `}
      data-testid={`dropzone-${id}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{label}</span>
        {items.length > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {items.length}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-2 min-h-[40px]">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">{placeholder}</p>
        ) : (
          items.map((item) => (
            <DraggableFieldChip
              key={item}
              id={item}
              label={item}
              zone={id}
              onRemove={() => onRemoveItem(item)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ValuesZone({
  items,
  onRemoveItem,
  aggregatorName,
  onAggregatorChange,
}: {
  items: string[];
  onRemoveItem: (item: string) => void;
  aggregatorName: string;
  onAggregatorChange: (value: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "values" });

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-lg border-2 border-dashed p-4 min-h-[100px] transition-all
        ${isOver ? "border-primary bg-primary/5" : "border-border bg-card"}
      `}
      data-testid="dropzone-values"
    >
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Values</span>
        {items.length > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {items.length}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-2 min-h-[40px]">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Drop fields here to aggregate (defaults to Count)
          </p>
        ) : (
          items.map((item) => (
            <DraggableFieldChip
              key={item}
              id={item}
              label={item}
              zone="values"
              onRemove={() => onRemoveItem(item)}
            />
          ))
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Aggregate by:</span>
          <Select value={aggregatorName} onValueChange={onAggregatorChange}>
            <SelectTrigger className="h-7 text-xs w-[120px]" data-testid="aggregator-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Count">Count</SelectItem>
              <SelectItem value="Count Unique Values">Count Unique</SelectItem>
              <SelectItem value="Sum">Sum</SelectItem>
              <SelectItem value="Average">Average</SelectItem>
              <SelectItem value="Minimum">Minimum</SelectItem>
              <SelectItem value="Maximum">Maximum</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function FilterZone({
  filters,
  onRemoveFilter,
  onRemoveFilterValue,
}: {
  filters: Record<string, Record<string, boolean>>;
  onRemoveFilter: (field: string) => void;
  onRemoveFilterValue: (field: string, value: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "filters" });
  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-lg border-2 border-dashed p-4 min-h-[100px] transition-all
        ${isOver ? "border-primary bg-primary/5" : "border-border bg-card"}
      `}
      data-testid="dropzone-filters"
    >
      <div className="flex items-center gap-2 mb-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Filters</span>
        {hasFilters && (
          <Badge variant="secondary" className="ml-auto">
            {Object.keys(filters).length}
          </Badge>
        )}
      </div>
      <div className="space-y-2 min-h-[40px]">
        {!hasFilters ? (
          <p className="text-xs text-muted-foreground italic">
            Drag values here to filter
          </p>
        ) : (
          Object.entries(filters).map(([field, valueMap]) => {
            const values = Object.keys(valueMap).filter((v) => valueMap[v]);
            return (
              <div
                key={field}
                className="flex items-start gap-2 p-2 bg-muted/50 rounded"
              >
                <span className="text-xs font-medium text-muted-foreground min-w-[80px]">
                  {field}:
                </span>
                <div className="flex flex-wrap gap-1 flex-1">
                  {values.map((value) => (
                    <Badge
                      key={value}
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-destructive/10"
                      onClick={() => onRemoveFilterValue(field, value)}
                      data-testid={`filter-value-${field}-${value}`}
                    >
                      {value}
                      <X className="h-2.5 w-2.5 ml-1" />
                    </Badge>
                  ))}
                </div>
                <button
                  onClick={() => onRemoveFilter(field)}
                  className="text-muted-foreground hover:text-destructive"
                  data-testid={`remove-filter-${field}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function FieldLibrary({
  fields,
  usedFields,
}: {
  fields: FieldDefinition[];
  usedFields: Set<string>;
}) {
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  const toggleExpanded = (fieldId: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  };

  return (
    <div
      className="bg-card border rounded-lg p-4"
      data-testid="field-library"
    >
      <h3 className="text-sm font-semibold mb-3 text-foreground">
        Available Fields
      </h3>
      <div className="space-y-2">
        {fields.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            No fields available
          </p>
        )}
        {fields.map((field) => {
          const isUsed = usedFields.has(field.id);
          return (
            <Collapsible
              key={field.id}
              open={expandedFields.has(field.id)}
              onOpenChange={() => toggleExpanded(field.id)}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <DraggableFieldChip id={field.id} label={field.label} isUsed={isUsed} />
                  {field.values.length > 0 && (
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        data-testid={`expand-field-${field.id}`}
                      >
                        {expandedFields.has(field.id) ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  )}
                </div>
                <CollapsibleContent>
                  <div className="ml-4 mt-1 flex flex-wrap gap-1 max-h-[150px] overflow-y-auto">
                    {field.values.slice(0, 20).map((value) => (
                      <DraggableValueChip
                        key={value}
                        fieldId={field.id}
                        value={value}
                      />
                    ))}
                    {field.values.length > 20 && (
                      <span className="text-xs text-muted-foreground">
                        +{field.values.length - 20} more
                      </span>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

export default function PivotBuilder({
  projects,
  pivotConfig,
  onPivotConfigChange,
}: PivotBuilderProps) {
  const [layout, setLayout] = useState<LayoutState>({
    rows: [],
    columns: [],
    values: [],
    filters: {},
    aggregatorName: "Count",
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const pivotData = useMemo(
    () => transformProjectsForPivot(projects),
    [projects]
  );

  const fields: FieldDefinition[] = useMemo(() => {
    const fieldMap: Record<string, Set<string>> = {};
    const fieldLabels = [
      "Client",
      "Project Type",
      "Status",
      "Service Owner",
      "Assigned To",
      "Due Month",
      "Target Month",
      "Year",
      "Quarter",
      "Project Month",
      "Is Archived",
    ];

    fieldLabels.forEach((label) => {
      fieldMap[label] = new Set();
    });

    pivotData.forEach((row) => {
      fieldLabels.forEach((label) => {
        if (row[label] !== undefined && row[label] !== null) {
          fieldMap[label].add(String(row[label]));
        }
      });
    });

    return fieldLabels.map((label) => ({
      id: label,
      label,
      values: Array.from(fieldMap[label]).sort(),
    }));
  }, [pivotData]);

  const usedFields = useMemo(() => {
    const used = new Set<string>();
    layout.rows.forEach((r) => used.add(r));
    layout.columns.forEach((c) => used.add(c));
    layout.values.forEach((v) => used.add(v));
    return used;
  }, [layout.rows, layout.columns, layout.values]);

  // Track the last applied config to detect changes from saved views
  const [lastAppliedConfigJson, setLastAppliedConfigJson] = useState<string | null>(null);
  
  useEffect(() => {
    const currentConfigJson = pivotConfig ? JSON.stringify(pivotConfig) : null;
    
    // Apply config when it changes from outside (loading a saved view)
    if (pivotConfig && currentConfigJson !== lastAppliedConfigJson) {
      setLayout({
        rows: pivotConfig.rows || [],
        columns: pivotConfig.cols || [],
        values: pivotConfig.vals || [],
        filters: pivotConfig.valueFilter || {},
        aggregatorName: pivotConfig.aggregatorName || "Count",
      });
      setLastAppliedConfigJson(currentConfigJson);
      setInitialized(true);
    } else if (!pivotConfig && lastAppliedConfigJson !== null) {
      // Reset to default when pivotConfig is cleared (switching away from saved pivot)
      setLayout({
        rows: [],
        columns: [],
        values: [],
        filters: {},
        aggregatorName: "Count",
      });
      setLastAppliedConfigJson(null);
      setInitialized(true);
    } else if (!initialized) {
      setInitialized(true);
    }
  }, [pivotConfig, initialized, lastAppliedConfigJson]);

  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    const intersections = rectIntersection(args);
    if (intersections.length > 0) {
      const dropZoneIds = ["rows", "columns", "values", "filters", "field-library"];
      const validIntersections = intersections.filter((collision) =>
        dropZoneIds.includes(collision.id as string)
      );
      if (validIntersections.length > 0) {
        return validIntersections;
      }
    }
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    return closestCenter(args);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeData = active.data.current;
    const overId = over.id as string;

    if (activeData?.type === "value") {
      if (overId === "filters") {
        const { fieldId, value } = activeData;
        setLayout((prev) => {
          const fieldFilters = prev.filters[fieldId] || {};
          if (!fieldFilters[value]) {
            return {
              ...prev,
              filters: {
                ...prev.filters,
                [fieldId]: { ...fieldFilters, [value]: true },
              },
            };
          }
          return prev;
        });
      }
      return;
    }

    const fieldId = activeData?.fieldId;
    const fromZone = activeData?.fromZone;

    if (!fieldId) return;

    setLayout((prev) => {
      const newLayout = { ...prev };

      if (fromZone) {
        if (fromZone === "rows") {
          newLayout.rows = prev.rows.filter((r) => r !== fieldId);
        } else if (fromZone === "columns") {
          newLayout.columns = prev.columns.filter((c) => c !== fieldId);
        } else if (fromZone === "values") {
          newLayout.values = prev.values.filter((v) => v !== fieldId);
        }
      }

      if (overId === "rows" && !newLayout.rows.includes(fieldId)) {
        newLayout.rows = [...newLayout.rows, fieldId];
        newLayout.columns = newLayout.columns.filter((c) => c !== fieldId);
        newLayout.values = newLayout.values.filter((v) => v !== fieldId);
      } else if (overId === "columns" && !newLayout.columns.includes(fieldId)) {
        newLayout.columns = [...newLayout.columns, fieldId];
        newLayout.rows = newLayout.rows.filter((r) => r !== fieldId);
        newLayout.values = newLayout.values.filter((v) => v !== fieldId);
      } else if (overId === "values" && !newLayout.values.includes(fieldId)) {
        newLayout.values = [...newLayout.values, fieldId];
        newLayout.rows = newLayout.rows.filter((r) => r !== fieldId);
        newLayout.columns = newLayout.columns.filter((c) => c !== fieldId);
      } else if (overId === "field-library") {
        newLayout.rows = newLayout.rows.filter((r) => r !== fieldId);
        newLayout.columns = newLayout.columns.filter((c) => c !== fieldId);
        newLayout.values = newLayout.values.filter((v) => v !== fieldId);
      }

      return newLayout;
    });
  };

  useEffect(() => {
    if (onPivotConfigChange && initialized) {
      const config: PivotConfig = {
        rows: layout.rows,
        cols: layout.columns,
        vals: layout.values,
        aggregatorName: layout.aggregatorName,
        rendererName: "Table",
        valueFilter: layout.filters,
        rowOrder: "key_a_to_z",
        colOrder: "key_a_to_z",
      };
      onPivotConfigChange(config);
    }
  }, [layout, onPivotConfigChange, initialized]);

  const removeFromRows = useCallback((field: string) => {
    setLayout((prev) => ({
      ...prev,
      rows: prev.rows.filter((r) => r !== field),
    }));
  }, []);

  const removeFromColumns = useCallback((field: string) => {
    setLayout((prev) => ({
      ...prev,
      columns: prev.columns.filter((c) => c !== field),
    }));
  }, []);

  const removeFromValues = useCallback((field: string) => {
    setLayout((prev) => ({
      ...prev,
      values: prev.values.filter((v) => v !== field),
    }));
  }, []);

  const removeFilter = useCallback((field: string) => {
    setLayout((prev) => {
      const { [field]: _, ...rest } = prev.filters;
      return { ...prev, filters: rest };
    });
  }, []);

  const removeFilterValue = useCallback((field: string, value: string) => {
    setLayout((prev) => {
      const fieldFilters = { ...prev.filters[field] };
      delete fieldFilters[value];
      const remainingValues = Object.keys(fieldFilters).filter((v) => fieldFilters[v]);
      if (remainingValues.length === 0) {
        const { [field]: _, ...rest } = prev.filters;
        return { ...prev, filters: rest };
      }
      return {
        ...prev,
        filters: { ...prev.filters, [field]: fieldFilters },
      };
    });
  }, []);

  const canShowPivot = layout.rows.length > 0 || layout.columns.length > 0;

  const filteredPivotData = useMemo(() => {
    if (Object.keys(layout.filters).length === 0) {
      return pivotData;
    }
    return pivotData.filter((row) => {
      for (const [field, valueMap] of Object.entries(layout.filters)) {
        const activeValues = Object.keys(valueMap).filter((v) => valueMap[v]);
        if (activeValues.length > 0 && !activeValues.includes(row[field])) {
          return false;
        }
      }
      return true;
    });
  }, [pivotData, layout.filters]);

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">
            No projects to display in pivot table
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="pivot-builder p-4 bg-background"
      data-testid="pivot-builder"
    >
      <div className="flex items-center gap-2 mb-4 px-2 py-2 bg-muted/50 rounded-md text-sm text-muted-foreground">
        <Info className="h-4 w-4 text-primary" />
        <span>
          Drag fields from the library into Rows or Columns to build your pivot
          table. Drag specific values into Filters to narrow results.
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3">
            <FieldLibrary fields={fields} usedFields={usedFields} />
          </div>

          <div className="col-span-9 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <DropZone
                id="rows"
                label="Rows"
                icon={Rows3}
                items={layout.rows}
                onRemoveItem={removeFromRows}
                placeholder="Drop fields here for row grouping"
              />
              <DropZone
                id="columns"
                label="Columns"
                icon={Columns3}
                items={layout.columns}
                onRemoveItem={removeFromColumns}
                placeholder="Drop fields here for column headers"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ValuesZone
                items={layout.values}
                onRemoveItem={removeFromValues}
                aggregatorName={layout.aggregatorName}
                onAggregatorChange={(value) =>
                  setLayout((prev) => ({ ...prev, aggregatorName: value }))
                }
              />

              <FilterZone
                filters={layout.filters}
                onRemoveFilter={removeFilter}
                onRemoveFilterValue={removeFilterValue}
              />
            </div>

            {canShowPivot ? (
              <div
                className="pivot-table-output border rounded-lg p-4 bg-card overflow-auto"
                data-testid="pivot-table-output"
              >
                <style>{`
                  .pvtUi {
                    font-family: inherit;
                    background: transparent;
                  }
                  .pvtUi > tbody > tr:first-child {
                    display: none;
                  }
                  .pvtUi > tbody > tr > td:first-child {
                    display: none;
                  }
                  .pvtUi table {
                    border-collapse: collapse;
                  }
                  .pvtUi td, .pvtUi th {
                    padding: 6px 12px;
                    border: 1px solid hsl(var(--border));
                    background: hsl(var(--card));
                    color: hsl(var(--card-foreground));
                    font-size: 13px;
                  }
                  .pvtUi th {
                    background: hsl(var(--muted));
                    font-weight: 600;
                  }
                  .pvtTable tbody tr:nth-child(even) td {
                    background: hsl(var(--muted) / 0.3);
                  }
                  .pvtTotal, .pvtGrandTotal {
                    font-weight: 600;
                    background: hsl(var(--muted)) !important;
                  }
                  .pvtAxisContainer, .pvtVals, .pvtRenderers {
                    display: none !important;
                  }
                  .pvtTable {
                    width: 100%;
                  }
                `}</style>
                <PivotTableUI
                  data={filteredPivotData}
                  rows={layout.rows}
                  cols={layout.columns}
                  vals={layout.values}
                  aggregatorName={layout.aggregatorName}
                  rendererName="Table"
                  renderers={TableRenderers}
                  hiddenAttributes={["Count"]}
                  hiddenFromDragDrop={["Count"]}
                  onChange={() => {}}
                />
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-12 text-center bg-muted/20">
                <p className="text-muted-foreground">
                  Drag at least one field into Rows or Columns to generate the
                  pivot table
                </p>
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeId && (
            <div className="px-3 py-1.5 rounded-md text-sm font-medium bg-primary/20 border border-primary/40 text-foreground shadow-lg">
              {activeId.includes(":") ? activeId.split(":").pop() : activeId}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
