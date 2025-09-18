import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, AlertCircle } from "lucide-react";
import type { ProjectWithRelations } from "@shared/schema";
import { calculateBusinessHours } from "@shared/businessTime";

interface ProjectCardProps {
  project: ProjectWithRelations;
  timeInStage: string;
  onOpenModal: () => void;
  isDragging?: boolean;
}

export default function ProjectCard({ 
  project, 
  timeInStage, 
  onOpenModal, 
  isDragging = false 
}: ProjectCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ 
    id: project.id,
    disabled: isDragging,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getPriorityColor = () => {
    switch (project.priority) {
      case "urgent": return "text-red-500";
      case "high": return "text-orange-500";
      case "medium": return "text-yellow-500";
      case "low": return "text-green-500";
      default: return "text-gray-500";
    }
  };

  const getStatusBadgeVariant = () => {
    switch (project.currentStatus) {
      case "no_latest_action": return "secondary";
      case "bookkeeping_work_required": return "default";
      case "in_review": return "outline";
      case "needs_client_input": return "destructive";
      case "completed": return "default";
      default: return "secondary";
    }
  };

  const getStatusLabel = () => {
    const labels: Record<string, string> = {
      no_latest_action: "New",
      bookkeeping_work_required: "In Progress",
      in_review: "Review",
      needs_client_input: "Waiting",
      completed: "Done",
    };
    return labels[project.currentStatus] || "Unknown";
  };

  const assigneeInitials = project.currentAssignee
    ? `${project.currentAssignee.firstName?.charAt(0) || ''}${project.currentAssignee.lastName?.charAt(0) || ''}`
    : project.clientManager
    ? `${project.clientManager.firstName?.charAt(0) || ''}${project.clientManager.lastName?.charAt(0) || ''}`
    : "?";

  // Calculate business hours for current stage
  const getBusinessHoursForCurrentStage = (): string => {
    if (!project.chronology || project.chronology.length === 0) {
      return "0 business hours";
    }

    // Find the most recent chronology entry (current stage start)
    const sortedChronology = [...project.chronology].sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    const lastEntry = sortedChronology[0];
    if (!lastEntry?.timestamp) {
      return "0 business hours";
    }

    try {
      const startTime: string = typeof lastEntry.timestamp === 'string' 
        ? lastEntry.timestamp 
        : new Date(lastEntry.timestamp).toISOString();
      const currentTime: string = new Date().toISOString();
      const businessHours = calculateBusinessHours(startTime, currentTime);
      return formatBusinessHours(businessHours);
    } catch (error) {
      console.error('Error calculating business hours:', error);
      return "0 business hours";
    }
  };

  // Format business hours for display
  const formatBusinessHours = (hours: number): string => {
    if (hours === 0) return "0 business hours";
    if (hours < 1) return "< 1 business hour";
    
    const roundedHours = Math.round(hours * 10) / 10; // Round to 1 decimal place
    
    if (roundedHours === 1) {
      return "1 business hour";
    } else if (roundedHours < 24) {
      return `${roundedHours} business hours`;
    } else {
      const days = Math.floor(roundedHours / 24);
      const remainingHours = Math.round((roundedHours % 24) * 10) / 10;
      
      if (remainingHours === 0) {
        return days === 1 ? "1 business day" : `${days} business days`;
      } else {
        const dayText = days === 1 ? "day" : "days";
        const hourText = remainingHours === 1 ? "hour" : "hours";
        return `${days} business ${dayText}, ${remainingHours} ${hourText}`;
      }
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
        isSortableDragging ? "opacity-50" : ""
      } ${isDragging ? "rotate-5 shadow-lg" : ""}`}
      onClick={onOpenModal}
      data-testid={`project-card-${project.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <h4 className="font-medium text-foreground line-clamp-1" title={project.client.name}>
            {project.client.name}
          </h4>
          <div className="flex items-center space-x-1 flex-shrink-0">
            {project.priority === "urgent" && (
              <AlertCircle className="w-3 h-3 text-red-500" />
            )}
            <MoreHorizontal 
              {...listeners}
              className="w-4 h-4 text-muted-foreground cursor-move hover:text-foreground transition-colors" 
            />
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2" title={project.description}>
          {project.description}
        </p>
        
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-3 text-muted-foreground">
            <span className="flex items-center space-x-1">
              <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-xs font-medium">
                {assigneeInitials}
              </div>
            </span>
            <div className="flex flex-col space-y-1">
              <span data-testid={`time-in-stage-${project.id}`}>{timeInStage}</span>
              <span data-testid={`business-hours-${project.id}`} className="text-blue-600 dark:text-blue-400">
                {getBusinessHoursForCurrentStage()}
              </span>
            </div>
          </div>
          <Badge variant={getStatusBadgeVariant()} className="text-xs">
            {getStatusLabel()}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
