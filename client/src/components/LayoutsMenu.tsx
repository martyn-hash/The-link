import { LayoutGrid, List, Columns3, BarChart3, Calendar, Check, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ViewMode } from "@/types/projects-page";

interface LayoutsMenuProps {
  currentViewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isMobileIconOnly?: boolean;
}

export default function LayoutsMenu({
  currentViewMode,
  onViewModeChange,
  isMobileIconOnly = false,
}: LayoutsMenuProps) {
  const layouts = [
    { id: "list" as const, label: "List", icon: List },
    { id: "kanban" as const, label: "Kanban", icon: Columns3 },
    { id: "dashboard" as const, label: "Dashboard", icon: BarChart3 },
    { id: "calendar" as const, label: "Calendar", icon: Calendar },
    { id: "pivot" as const, label: "Pivot Table", icon: Table2 },
  ];

  const currentLayout = layouts.find(l => l.id === currentViewMode) || layouts[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          data-testid="button-layouts-menu"
          className={isMobileIconOnly ? "h-11 px-3" : "gap-2"}
        >
          <LayoutGrid className="h-4 w-4" />
          {!isMobileIconOnly && <span>Layouts</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {layouts.map((layout) => {
          const Icon = layout.icon;
          const isActive = currentViewMode === layout.id;
          
          return (
            <DropdownMenuItem
              key={layout.id}
              onClick={() => onViewModeChange(layout.id)}
              className={`flex items-center justify-between gap-2 cursor-pointer ${isActive ? 'bg-accent' : ''}`}
              data-testid={`button-layout-${layout.id}`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{layout.label}</span>
              </div>
              {isActive && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
