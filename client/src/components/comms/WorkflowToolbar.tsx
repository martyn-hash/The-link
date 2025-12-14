import { CheckSquare, Reply, AlertTriangle, TrendingUp, Info, Inbox, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type WorkflowFilter = 'requires_task' | 'requires_reply' | 'urgent' | 'opportunities' | 'information_only' | 'all_outstanding' | null;

interface WorkflowStats {
  requiresTask: number;
  requiresReply: number;
  urgent: number;
  opportunities: number;
  informationOnly: number;
  allOutstanding: number;
}

interface ToolbarButton {
  id: WorkflowFilter;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  statKey: keyof WorkflowStats;
  badgeVariant: 'destructive' | 'warning' | 'default';
  tooltip: string;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  {
    id: 'requires_task',
    label: 'Requires Task',
    shortLabel: 'Task',
    icon: CheckSquare,
    statKey: 'requiresTask',
    badgeVariant: 'destructive',
    tooltip: 'Emails that need a task created'
  },
  {
    id: 'requires_reply',
    label: 'Requires Reply',
    shortLabel: 'Reply',
    icon: Reply,
    statKey: 'requiresReply',
    badgeVariant: 'warning',
    tooltip: 'Emails awaiting your response'
  },
  {
    id: 'urgent',
    label: 'Urgent',
    shortLabel: 'Urgent',
    icon: AlertTriangle,
    statKey: 'urgent',
    badgeVariant: 'destructive',
    tooltip: 'Time-sensitive emails'
  },
  {
    id: 'opportunities',
    label: 'Opportunities',
    shortLabel: 'Opps',
    icon: TrendingUp,
    statKey: 'opportunities',
    badgeVariant: 'default',
    tooltip: 'Commercial opportunities detected'
  },
  {
    id: 'information_only',
    label: 'Info Only',
    shortLabel: 'Info',
    icon: Info,
    statKey: 'informationOnly',
    badgeVariant: 'default',
    tooltip: 'Read-only emails, no action needed'
  },
  {
    id: 'all_outstanding',
    label: 'All Outstanding',
    shortLabel: 'All',
    icon: Inbox,
    statKey: 'allOutstanding',
    badgeVariant: 'default',
    tooltip: 'All emails not yet completed'
  }
];

interface WorkflowToolbarProps {
  stats?: WorkflowStats;
  isLoading?: boolean;
  activeFilter: WorkflowFilter;
  onFilterChange: (filter: WorkflowFilter) => void;
  compact?: boolean;
  filterButtons?: WorkflowFilter[];
  hideClearButton?: boolean;
}

export function WorkflowToolbar({
  stats,
  isLoading = false,
  activeFilter,
  onFilterChange,
  compact = false,
  filterButtons,
  hideClearButton = false
}: WorkflowToolbarProps) {
  const buttonsToRender = filterButtons 
    ? TOOLBAR_BUTTONS.filter(btn => filterButtons.includes(btn.id))
    : TOOLBAR_BUTTONS;
  
  const activeFilterInThisToolbar = buttonsToRender.some(btn => btn.id === activeFilter);
  
  const getBadgeVariant = (variant: 'destructive' | 'warning' | 'default', isActive: boolean) => {
    if (isActive) return 'default';
    if (variant === 'warning') return 'outline';
    return variant;
  };

  if (isLoading) {
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid="workflow-toolbar-loading">
        {buttonsToRender.map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
    );
  }

  return (
    <div 
      className="flex flex-wrap items-center gap-2"
      data-testid="workflow-toolbar"
    >
      {buttonsToRender.map(button => {
        const Icon = button.icon;
        const count = stats?.[button.statKey] ?? 0;
        const isActive = activeFilter === button.id;
        
        return (
          <Tooltip key={button.id}>
            <TooltipTrigger asChild>
              <Button
                variant={isActive ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-8 gap-1.5",
                  !isActive && count === 0 && "opacity-60"
                )}
                onClick={() => onFilterChange(isActive ? null : button.id)}
                data-testid={`toolbar-btn-${button.id}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className={cn("hidden sm:inline", compact && "sm:hidden md:inline")}>
                  {compact ? button.shortLabel : button.label}
                </span>
                <span className={cn("sm:hidden", compact && "sm:inline md:hidden")}>
                  {button.shortLabel}
                </span>
                {count > 0 && (
                  <Badge 
                    variant={getBadgeVariant(button.badgeVariant, isActive)}
                    className={cn(
                      "ml-1 h-5 min-w-[20px] px-1.5 text-xs font-medium",
                      isActive && "bg-primary-foreground text-primary",
                      !isActive && button.badgeVariant === 'warning' && "bg-amber-100 text-amber-700 border-amber-200"
                    )}
                  >
                    {count}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{button.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
      
      {activeFilterInThisToolbar && !hideClearButton && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground hover:text-foreground"
          onClick={() => onFilterChange(null)}
          data-testid="toolbar-clear-filter"
        >
          Clear filter
        </Button>
      )}
    </div>
  );
}

export { type WorkflowStats };
