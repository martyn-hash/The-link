import { CheckSquare, Target, Clock, AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CalendarEvent as CalendarEventType } from "@shared/schema";
import { format, differenceInDays } from "date-fns";

interface CalendarEventProps {
  event: CalendarEventType;
  onClick: (event: CalendarEventType) => void;
  compact?: boolean;
}

function getEventIcon(type: CalendarEventType["type"]) {
  switch (type) {
    case "task_due":
      return <CheckSquare className="h-3 w-3 flex-shrink-0" />;
    case "project_target":
      return <Target className="h-3 w-3 flex-shrink-0" />;
    case "stage_deadline":
      return <Clock className="h-3 w-3 flex-shrink-0" />;
    default:
      return null;
  }
}

function getEventTypeLabel(type: CalendarEventType["type"]) {
  switch (type) {
    case "project_due":
      return "Project Due Date";
    case "project_target":
      return "Target Delivery";
    case "stage_deadline":
      return "Stage Deadline";
    case "task_due":
      return "Task Due Date";
    default:
      return "Event";
  }
}

export default function CalendarEvent({ event, onClick, compact = false }: CalendarEventProps) {
  const eventDate = new Date(event.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const daysUntil = differenceInDays(eventDate, today);
  const isTask = event.entityType === "task";
  
  let daysText = "";
  if (event.isOverdue) {
    daysText = `${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} overdue`;
  } else if (daysUntil === 0) {
    daysText = "Due today";
  } else if (daysUntil === 1) {
    daysText = "Due tomorrow";
  } else {
    daysText = `${daysUntil} days remaining`;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            onClick={() => onClick(event)}
            className={cn(
              "w-full text-left px-1.5 py-0.5 rounded text-xs truncate flex items-center gap-1 transition-opacity hover:opacity-80",
              event.isOverdue && "ring-1 ring-red-500/50",
              isTask && "border-l-2 border-dashed"
            )}
            style={{ 
              backgroundColor: `${event.color}20`,
              color: event.color,
              borderLeftColor: isTask ? event.color : undefined,
            }}
            data-testid={`calendar-event-${event.id}`}
          >
            {getEventIcon(event.type)}
            {event.isOverdue && <AlertCircle className="h-3 w-3 flex-shrink-0 text-red-500" />}
            <span className="truncate">{event.title}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge 
                variant={isTask ? "secondary" : "default"} 
                className="text-xs"
              >
                {isTask ? "Task" : "Project"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {getEventTypeLabel(event.type)}
              </span>
            </div>
            
            <div className="font-medium">{event.title}</div>
            
            {event.clientName && (
              <div className="text-sm text-muted-foreground">
                Client: {event.clientName}
              </div>
            )}
            
            {event.assigneeName && (
              <div className="text-sm text-muted-foreground">
                Assigned to: {event.assigneeName}
              </div>
            )}
            
            <div className="text-sm">
              Status: <span className="font-medium">{event.status}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <span>{format(eventDate, "MMM d, yyyy")}</span>
              <span className={cn(
                "text-xs",
                event.isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
              )}>
                ({daysText})
              </span>
            </div>

            {event.meta?.description && (
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {event.meta.description}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
