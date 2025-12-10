import { useState, useEffect, useMemo } from "react";
import PivotTableUI from "react-pivottable/PivotTableUI";
import "react-pivottable/pivottable.css";
import TableRenderers from "react-pivottable/TableRenderers";
import type { ProjectWithRelations } from "@shared/schema";
import type { PivotConfig } from "@/types/projects-page";
import { format } from "date-fns";
import { Filter, Info } from "lucide-react";

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
      <div className="flex items-center gap-2 mb-4 px-2 py-2 bg-muted/50 rounded-md text-sm text-muted-foreground" data-testid="pivot-filter-hint">
        <Filter className="h-4 w-4 text-primary" />
        <span><strong>Filters:</strong> Click the arrow on any field to filter values</span>
        <span className="mx-2">|</span>
        <Info className="h-4 w-4" />
        <span>Drag fields between areas to reorganize the table</span>
      </div>
      <style>{`
        .pvtUi {
          font-family: inherit;
          background: transparent;
        }
        .pvtUi > tbody > tr > td {
          vertical-align: top;
          padding: 8px;
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
        
        /* Attribute containers - better spacing */
        .pvtAxisContainer, .pvtVals {
          background: hsl(var(--card)) !important;
          border: 1px solid hsl(var(--border)) !important;
          padding: 12px !important;
          margin: 4px !important;
          border-radius: 6px;
          min-width: 150px;
        }
        .pvtAxisContainer li {
          margin: 4px 0 !important;
        }
        .pvtAxisContainer li span.pvtAttr {
          background: hsl(var(--accent)) !important;
          border: 1px solid hsl(var(--border)) !important;
          color: hsl(var(--accent-foreground)) !important;
          border-radius: 4px;
          padding: 4px 10px;
          display: inline-block;
          margin: 2px;
          cursor: pointer;
          position: relative;
        }
        .pvtAxisContainer li span.pvtAttr:hover {
          background: hsl(var(--accent) / 0.8) !important;
        }
        
        /* Triangle filter indicator - make it more visible */
        .pvtAxisContainer li span.pvtAttr .pvtTriangle {
          margin-left: 6px;
          color: hsl(var(--primary));
          font-weight: bold;
        }
        
        /* Dropdown styling */
        .pvtDropdown {
          background: hsl(var(--background)) !important;
          color: hsl(var(--foreground)) !important;
        }
        
        /* Filter box - HIGH z-index and better positioning */
        .pivot-table-container .pvtFilterBox,
        .pvtUi .pvtFilterBox,
        .pvtFilterBox {
          background: #ffffff !important;
          background-color: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          border-style: solid !important;
          border-width: 1px !important;
          border-color: #e2e8f0 !important;
          color: #1e293b !important;
          z-index: 9999 !important;
          position: absolute !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0, 0, 0, 0.15) !important;
          border-radius: 8px !important;
          padding: 16px !important;
          min-width: 220px !important;
          max-height: 350px !important;
          overflow-y: auto !important;
        }
        .pvtFilterBox h4 {
          margin: 0 0 12px 0 !important;
          padding-bottom: 10px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          color: #1e293b !important;
        }
        .pvtFilterBox .pvtSearch {
          width: 100% !important;
          padding: 8px 12px !important;
          margin-bottom: 12px !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 6px !important;
          background: #f8fafc !important;
          color: #1e293b !important;
          font-size: 13px !important;
        }
        .pvtFilterBox .pvtSearch:focus {
          outline: none !important;
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
        }
        .pvtFilterBox .pvtCheckContainer {
          max-height: 200px !important;
          overflow-y: auto !important;
          padding: 4px 0 !important;
        }
        .pvtFilterBox .pvtCheckContainer p {
          padding: 6px 10px !important;
          margin: 2px 0 !important;
          border-radius: 4px !important;
          cursor: pointer !important;
          font-size: 13px !important;
        }
        .pvtFilterBox .pvtCheckContainer p:hover {
          background: #f1f5f9 !important;
        }
        .pvtFilterBox .pvtCheckContainer p label {
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }
        .pvtFilterBox button,
        .pvtFilterBox a {
          padding: 6px 14px !important;
          margin: 4px !important;
          border-radius: 6px !important;
          border: 1px solid #e2e8f0 !important;
          background: #f1f5f9 !important;
          color: #1e293b !important;
          cursor: pointer !important;
          font-weight: 500 !important;
          font-size: 13px !important;
          text-decoration: none !important;
          display: inline-block !important;
        }
        .pvtFilterBox button:hover,
        .pvtFilterBox a:hover {
          background: #e2e8f0 !important;
        }
        
        /* Renderers and aggregator dropdowns */
        .pvtRenderers, .pvtAggregator {
          background: hsl(var(--background)) !important;
          border: 1px solid hsl(var(--border)) !important;
          color: hsl(var(--foreground)) !important;
          border-radius: 4px;
          padding: 6px 10px;
          margin: 4px;
        }
        
        /* Rows and cols drop zones - better spacing */
        .pvtRows, .pvtCols {
          min-height: 70px;
          padding: 8px !important;
          margin: 4px !important;
        }
        .pvtRows {
          min-width: 160px;
        }
        
        /* Unused attributes area */
        .pvtUnused {
          padding: 8px !important;
          max-width: 200px;
        }
        .pvtUnused.pvtHorizList {
          max-width: none;
        }
        .pvtUnused.pvtVertList {
          max-height: 300px;
          overflow-y: auto;
        }
        
        /* Table data area - add margin to separate from controls */
        .pvtOutput {
          margin-top: 16px !important;
        }
        
        .pvtTable tbody tr:nth-child(even) td {
          background: hsl(var(--muted) / 0.5);
        }
        .pvtTotal, .pvtGrandTotal {
          font-weight: 600;
          background: hsl(var(--muted)) !important;
        }
        
        /* Vals container - aggregator selection */
        .pvtVals {
          padding: 8px 12px !important;
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
