import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Calendar,
  Clock,
  User,
  ArrowRight,
  CheckCircle,
  Link2,
  Loader2,
  X,
} from "lucide-react";
import type { InternalTask, TaskType, User as UserType, Client, Project } from "@shared/schema";
import { format } from "date-fns";

interface InternalTaskWithRelations extends InternalTask {
  taskType?: TaskType | null;
  assignee?: UserType | null;
  creator?: UserType | null;
}

interface TaskConnection {
  id: string;
  entityType: string;
  entityId: string;
  client?: Client | null;
  project?: Project | null;
}

interface ReminderViewModalProps {
  reminder: InternalTaskWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReminderViewModal({ reminder, open, onOpenChange }: ReminderViewModalProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: connections = [] } = useQuery<TaskConnection[]>({
    queryKey: [`/api/internal-tasks/${reminder?.id}/connections`],
    enabled: !!reminder?.id && open,
  });

  const convertToTaskMutation = useMutation({
    mutationFn: async () => {
      if (!reminder) throw new Error("No reminder selected");
      return await apiRequest("PATCH", `/api/internal-tasks/${reminder.id}`, {
        isQuickReminder: false,
      });
    },
    onSuccess: async () => {
      toast({
        title: "Converted to task",
        description: "This reminder is now a full task. Opening task details...",
      });
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/internal-tasks');
        }
      });
      onOpenChange(false);
      if (reminder) {
        setLocation(`/internal-tasks/${reminder.id}`);
      }
    },
    onError: (error: Error) => {
      showFriendlyError({ error: error.message || "Failed to convert reminder to task" });
    },
  });

  const completeReminderMutation = useMutation({
    mutationFn: async () => {
      if (!reminder) throw new Error("No reminder selected");
      return await apiRequest("PATCH", `/api/internal-tasks/${reminder.id}`, {
        status: "closed",
      });
    },
    onSuccess: () => {
      toast({
        title: "Reminder completed",
        description: "The reminder has been marked as done.",
      });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/internal-tasks');
        }
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      showFriendlyError({ error: error.message || "Failed to complete reminder" });
    },
  });

  if (!reminder) return null;

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return 'Not set';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, "EEEE, d MMMM yyyy 'at' h:mm a");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-500 text-white";
      case "in_progress":
        return "bg-yellow-500 text-white";
      case "closed":
        return "bg-green-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const isCompleted = reminder.status === "closed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="modal-reminder-view">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <DialogTitle className="text-xl" data-testid="text-reminder-title">
                  {reminder.title}
                </DialogTitle>
                <Badge 
                  variant="outline" 
                  className={`mt-1 text-xs ${getStatusColor(reminder.status)}`}
                  data-testid="badge-reminder-status"
                >
                  {reminder.status === "in_progress" ? "In Progress" : reminder.status}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {reminder.description && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Details</p>
              <p className="text-sm" data-testid="text-reminder-description">
                {reminder.description}
              </p>
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Due Date
              </p>
              <p className="text-sm font-medium" data-testid="text-reminder-due">
                {formatDateTime(reminder.dueDate)}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" />
                Assigned To
              </p>
              <p className="text-sm font-medium" data-testid="text-reminder-assignee">
                {reminder.assignee 
                  ? `${reminder.assignee.firstName} ${reminder.assignee.lastName}` 
                  : 'Unassigned'}
              </p>
            </div>
          </div>

          {connections.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  Linked To
                </p>
                <div className="space-y-1">
                  {connections.map((conn) => (
                    <div 
                      key={conn.id} 
                      className="text-sm"
                      data-testid={`link-connection-${conn.id}`}
                    >
                      {conn.entityType === 'client' && conn.client && (
                        <span className="text-primary">{conn.client.name}</span>
                      )}
                      {conn.entityType === 'project' && conn.project && (
                        <span className="text-primary">{conn.project.description || 'Project'}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="flex flex-col sm:flex-row gap-2">
            {!isCompleted && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => completeReminderMutation.mutate()}
                disabled={completeReminderMutation.isPending}
                data-testid="button-complete-reminder"
              >
                {completeReminderMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Mark Complete
              </Button>
            )}
            <Button
              className="flex-1"
              onClick={() => convertToTaskMutation.mutate()}
              disabled={convertToTaskMutation.isPending}
              data-testid="button-convert-to-task"
            >
              {convertToTaskMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              Convert to Task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
