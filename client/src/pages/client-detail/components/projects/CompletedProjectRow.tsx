import { useLocation } from "wouter";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableRow, TableCell } from "@/components/ui/table";
import type { ProjectWithRelations } from "@shared/schema";
import { formatDate } from "../../utils/formatters";
import { getStatusColor, formatStatus } from "../../utils/projectHelpers";

interface CompletedProjectRowProps {
  project: ProjectWithRelations;
  clientId?: string;
}

export function CompletedProjectRow({ project, clientId }: CompletedProjectRowProps) {
  const [, setLocation] = useLocation();

  const navigateToProject = () => {
    const url = clientId ? `/projects/${project.id}?from=client&clientId=${clientId}` : `/projects/${project.id}`;
    setLocation(url);
  };

  const assigneeName = project.currentAssignee 
    ? `${project.currentAssignee.firstName} ${project.currentAssignee.lastName}`
    : '-';

  const completionStatusDisplay = project.completionStatus 
    ? (project.completionStatus === 'completed_successfully' ? 'Successful' : 'Unsuccessful')
    : '-';

  const completionStatusColor = project.completionStatus === 'completed_successfully'
    ? 'text-green-600 dark:text-green-400'
    : project.completionStatus === 'completed_unsuccessfully'
    ? 'text-red-600 dark:text-red-400'
    : 'text-muted-foreground';

  return (
    <TableRow data-testid={`row-project-${project.id}`}>
      <TableCell className="font-medium">
        <span data-testid={`text-name-${project.id}`}>
          {project.description}
        </span>
      </TableCell>
      
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge className={`text-xs ${getStatusColor(project.currentStatus)}`} data-testid={`badge-status-${project.id}`}>
            {formatStatus(project.currentStatus)}
          </Badge>
          {project.inactive && (
            <Badge 
              className="text-xs bg-muted text-muted-foreground dark:bg-slate-800 dark:text-slate-200 border border-border"
              data-testid={`badge-inactive-${project.id}`}
            >
              Inactive
            </Badge>
          )}
        </div>
      </TableCell>
      
      <TableCell>
        <span className="text-sm text-purple-700 dark:text-purple-400" data-testid={`text-targetdate-${project.id}`}>
          {project.targetDeliveryDate ? formatDate(project.targetDeliveryDate) : '-'}
        </span>
      </TableCell>
      
      <TableCell>
        <span className="text-sm" data-testid={`text-duedate-${project.id}`}>
          {project.dueDate ? formatDate(project.dueDate) : '-'}
        </span>
      </TableCell>
      
      <TableCell>
        <span className="text-sm" data-testid={`text-assignee-${project.id}`}>
          {assigneeName}
        </span>
      </TableCell>
      
      <TableCell>
        <span className={`text-sm font-medium ${completionStatusColor}`} data-testid={`text-completion-${project.id}`}>
          {completionStatusDisplay}
        </span>
      </TableCell>
      
      <TableCell className="text-right">
        <Button
          variant="default"
          size="sm"
          onClick={navigateToProject}
          data-testid={`button-view-${project.id}`}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}
