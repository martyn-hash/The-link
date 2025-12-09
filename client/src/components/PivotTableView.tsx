import { useState, useEffect, useMemo } from "react";
import PivotTableUI from "react-pivottable/PivotTableUI";
import "react-pivottable/pivottable.css";
import TableRenderers from "react-pivottable/TableRenderers";
import type { ProjectWithRelations } from "@shared/schema";
import type { PivotConfig } from "@/types/projects-page";
import { format } from "date-fns";

interface PivotTableViewProps {
  projects: ProjectWithRelations[];
  pivotConfig?: PivotConfig | null;
  onPivotConfigChange?: (config: PivotConfig) => void;
}

function transformProjectsForPivot(projects: ProjectWithRelations[]): Record<string, any>[] {
  return projects.map((project) => {
    const dueDate = project.dueDate ? new Date(project.dueDate) : null;
    const targetDate = project.targetDeliveryDate ? new Date(project.targetDeliveryDate) : null;
    const dueDateStr = dueDate ? format(dueDate, "MMM yyyy") : "No Due Date";
    const targetDateStr = targetDate ? format(targetDate, "MMM yyyy") : "No Target Date";
    
    const getDaysToTarget = () => {
      if (!targetDate) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(targetDate);
      target.setHours(0, 0, 0, 0);
      return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };
    
    return {
      "Client": project.client?.name || "Unknown",
      "Project Type": project.projectType?.name || "Unknown",
      "Status": project.currentStatus || "Unknown",
      "Service Owner": project.projectOwner 
        ? `${project.projectOwner.firstName || ""} ${project.projectOwner.lastName || ""}`.trim() || "Unassigned"
        : "Unassigned",
      "Assigned To": project.currentAssignee 
        ? `${project.currentAssignee.firstName || ""} ${project.currentAssignee.lastName || ""}`.trim() || "Unassigned"
        : "Unassigned",
      "Due Month": dueDateStr,
      "Target Month": targetDateStr,
      "Year": dueDate ? format(dueDate, "yyyy") : "N/A",
      "Quarter": dueDate ? `Q${Math.ceil((dueDate.getMonth() + 1) / 3)}` : "N/A",
      "Days to Target": getDaysToTarget() ?? 0,
      "Project Month": project.projectMonth || "N/A",
      "Is Archived": project.archived ? "Yes" : "No",
      "Count": 1,
    };
  });
}

export default function PivotTableView({
  projects,
  pivotConfig,
  onPivotConfigChange,
}: PivotTableViewProps) {
  const [pivotState, setPivotState] = useState<Record<string, any>>({});
  const [initialized, setInitialized] = useState(false);

  const pivotData = useMemo(() => transformProjectsForPivot(projects), [projects]);

  useEffect(() => {
    if (pivotConfig && !initialized) {
      setPivotState({
        rows: pivotConfig.rows || [],
        cols: pivotConfig.cols || [],
        vals: pivotConfig.vals || [],
        aggregatorName: pivotConfig.aggregatorName || "Count",
        rendererName: pivotConfig.rendererName || "Table",
        valueFilter: pivotConfig.valueFilter || {},
        rowOrder: pivotConfig.rowOrder || "key_a_to_z",
        colOrder: pivotConfig.colOrder || "key_a_to_z",
      });
      setInitialized(true);
    } else if (!initialized) {
      setPivotState({
        rows: ["Project Type"],
        cols: ["Status"],
        aggregatorName: "Count",
        rendererName: "Table",
      });
      setInitialized(true);
    }
  }, [pivotConfig, initialized]);

  const handlePivotChange = (state: Record<string, any>) => {
    setPivotState(state);
    
    if (onPivotConfigChange) {
      const config: PivotConfig = {
        rows: state.rows || [],
        cols: state.cols || [],
        vals: state.vals || [],
        aggregatorName: state.aggregatorName || "Count",
        rendererName: state.rendererName || "Table",
        valueFilter: state.valueFilter,
        rowOrder: state.rowOrder,
        colOrder: state.colOrder,
      };
      onPivotConfigChange(config);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">No projects to display in pivot table</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pivot-table-container p-4 overflow-auto bg-background" data-testid="pivot-table-view">
      <style>{`
        .pvtUi {
          font-family: inherit;
          background: transparent;
        }
        .pvtUi table {
          border-collapse: collapse;
        }
        .pvtUi td, .pvtUi th {
          padding: 4px 8px;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card));
          color: hsl(var(--card-foreground));
        }
        .pvtUi th {
          background: hsl(var(--muted));
          font-weight: 600;
        }
        .pvtAxisContainer, .pvtVals {
          background: hsl(var(--card)) !important;
          border: 1px solid hsl(var(--border)) !important;
        }
        .pvtAxisContainer li span.pvtAttr {
          background: hsl(var(--accent)) !important;
          border: 1px solid hsl(var(--border)) !important;
          color: hsl(var(--accent-foreground)) !important;
          border-radius: 4px;
          padding: 2px 8px;
        }
        .pvtDropdown {
          background: hsl(var(--background)) !important;
          color: hsl(var(--foreground)) !important;
        }
        .pvtFilterBox {
          background: hsl(var(--popover)) !important;
          border: 1px solid hsl(var(--border)) !important;
          color: hsl(var(--popover-foreground)) !important;
        }
        .pvtRenderers, .pvtAggregator {
          background: hsl(var(--background)) !important;
          border: 1px solid hsl(var(--border)) !important;
          color: hsl(var(--foreground)) !important;
          border-radius: 4px;
          padding: 4px 8px;
        }
        .pvtRows, .pvtCols {
          min-height: 60px;
        }
        .pvtTable tbody tr:nth-child(even) td {
          background: hsl(var(--muted) / 0.5);
        }
        .pvtTotal, .pvtGrandTotal {
          font-weight: 600;
          background: hsl(var(--muted)) !important;
        }
      `}</style>
      <PivotTableUI
        data={pivotData}
        onChange={handlePivotChange}
        renderers={TableRenderers}
        hiddenAttributes={["Count"]}
        hiddenFromDragDrop={["Count"]}
        {...pivotState}
      />
    </div>
  );
}
