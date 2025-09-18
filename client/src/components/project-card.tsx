import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, AlertCircle } from "lucide-react";
import type { ProjectWithRelations } from "@shared/schema";

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
            <span data-testid={`time-in-stage-${project.id}`}>{timeInStage}</span>
          </div>
          <Badge variant={getStatusBadgeVariant()} className="text-xs">
            {getStatusLabel()}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
