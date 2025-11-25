import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";

interface TaskProgress {
  completed: number;
  total: number;
  percentage: number;
}

interface TaskInstance {
  id: string;
  status: 'not_started' | 'in_progress' | 'submitted' | 'approved';
  createdAt: string | Date;
  dueDate?: string | Date;
  categoryName?: string;
  progress?: TaskProgress;
  template?: {
    name?: string;
  };
  customRequest?: {
    name?: string;
  };
  relatedPerson?: {
    fullName?: string;
  };
}

interface ClientRequestsListProps {
  instances: TaskInstance[] | undefined;
  isLoading: boolean;
  isMobile: boolean;
}

function formatPersonName(fullName?: string): string {
  if (!fullName) return '-';
  const parts = fullName.split(' ');
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1]}`;
  }
  return fullName;
}

function formatDate(date: string | Date | undefined): string {
  if (!date) return '-';
  try {
    return format(new Date(date), 'dd/MM/yyyy');
  } catch {
    return '-';
  }
}

function getStatusVariant(status: string): 'outline' | 'default' | 'secondary' {
  if (status === 'submitted') return 'outline';
  if (status === 'approved' || status === 'in_progress') return 'default';
  return 'secondary';
}

function formatStatus(status: string): string {
  if (status === 'not_started') return 'Not Started';
  if (status === 'in_progress') return 'In Progress';
  if (status === 'submitted') return 'Submitted';
  if (status === 'approved') return 'Approved';
  return status;
}

export function ClientRequestsList({ instances, isLoading, isMobile }: ClientRequestsListProps) {
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!instances || instances.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No client requests yet. Click "New Client Request" to create one.</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {instances.map((instance) => (
          <Card key={instance.id} data-testid={`card-request-${instance.id}`}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-base" data-testid={`text-name-${instance.id}`}>
                    {instance.template?.name || instance.customRequest?.name || 'Untitled Request'}
                  </h4>
                  {instance.categoryName && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {instance.categoryName}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={getStatusVariant(instance.status)} data-testid={`badge-status-${instance.id}`}>
                    {formatStatus(instance.status)}
                  </Badge>
                </div>

                {instance.status === 'in_progress' && instance.progress && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>
                        {instance.progress.completed}/{instance.progress.total} ({instance.progress.percentage}%)
                      </span>
                    </div>
                    <Progress value={instance.progress.percentage} className="h-2" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-border">
                  <div>
                    <span className="text-muted-foreground text-xs">Assigned To</span>
                    <p className="font-medium" data-testid={`text-assignee-${instance.id}`}>
                      {formatPersonName(instance.relatedPerson?.fullName)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Created</span>
                    <p className="font-medium" data-testid={`text-created-${instance.id}`}>
                      {formatDate(instance.createdAt)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground text-xs">Due Date</span>
                    <p className="font-medium">
                      {instance.dueDate ? formatDate(instance.dueDate) : '-'}
                    </p>
                  </div>
                </div>

                <Button
                  variant="default"
                  className="w-full h-11 mt-2"
                  onClick={() => setLocation(`/task-instances/${instance.id}`)}
                  data-testid={`button-view-${instance.id}`}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Request
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Request Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {instances.map((instance) => (
            <TableRow key={instance.id} data-testid={`row-task-${instance.id}`}>
              <TableCell className="font-medium">
                <span data-testid={`text-name-${instance.id}`}>
                  {instance.template?.name || instance.customRequest?.name || 'Untitled Request'}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm">{instance.categoryName || '-'}</span>
              </TableCell>
              <TableCell>
                <span className="text-sm" data-testid={`text-assignee-${instance.id}`}>
                  {formatPersonName(instance.relatedPerson?.fullName)}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground" data-testid={`text-created-${instance.id}`}>
                  {formatDate(instance.createdAt)}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {instance.dueDate ? formatDate(instance.dueDate) : '-'}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(instance.status)} data-testid={`badge-status-${instance.id}`}>
                  {formatStatus(instance.status)}
                </Badge>
              </TableCell>
              <TableCell>
                {instance.status === 'in_progress' && instance.progress ? (
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <Progress value={instance.progress.percentage} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground">
                      {instance.progress.completed}/{instance.progress.total} ({instance.progress.percentage}%)
                    </span>
                  </div>
                ) : (
                  '-'
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setLocation(`/task-instances/${instance.id}`)}
                  data-testid={`button-view-${instance.id}`}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
