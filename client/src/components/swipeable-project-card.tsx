import { useState, useMemo } from "react";
import { useSwipeable } from "react-swipeable";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Info, MessageSquare, CheckCircle2, Archive, AlertCircle, Clock, User as UserIcon, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ProjectWithRelations, KanbanStage } from "@shared/schema";
import { format } from "date-fns";
import { calculateCurrentInstanceTime } from "@shared/businessTime";
import { normalizeChronology, normalizeDate } from "@/lib/chronology";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SwipeableProjectCardProps {
  project: ProjectWithRelations;
  canComplete?: boolean;
  onShowInfo?: (projectId: string) => void;
  onShowMessages?: (projectId: string) => void;
}

export default function SwipeableProjectCard({ project, canComplete = false, onShowInfo, onShowMessages }: SwipeableProjectCardProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiped, setIsSwiped] = useState(false);
  
  // Calculate maxSwipe based on number of action buttons
  // Info (always) + Messages (always) + Complete (conditional) + Archive (always) = 3-4 buttons
  const buttonCount = canComplete ? 4 : 3;
  const maxSwipe = buttonCount * 80; // 80px per button

  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Fetch stage configuration for this project
  const { data: projectStages = [] } = useQuery<KanbanStage[]>({
    queryKey: ['/api/config/project-types', project.projectTypeId, 'stages'],
    enabled: !!project.projectTypeId,
    staleTime: 5 * 60 * 1000,
  });

  // Get the current stage config
  const currentStageConfig = useMemo(() => {
    return projectStages.find(s => s.name === project.currentStatus);
  }, [projectStages, project.currentStatus]);

  // Calculate current business hours in stage using shared chronology utility
  const currentBusinessHours = useMemo(() => {
    const normalizedChronology = normalizeChronology(project.chronology);
    const createdAt = normalizeDate(project.createdAt);
    
    if (normalizedChronology.length === 0 || !createdAt) {
      return 0;
    }
    
    try {
      return calculateCurrentInstanceTime(
        normalizedChronology,
        project.currentStatus,
        createdAt
      );
    } catch (error) {
      console.error("Error calculating current instance time:", error);
      return 0;
    }
  }, [project.chronology, project.currentStatus, project.createdAt]);

  // Format business hours for display
  const formatBusinessHours = (hours: number): string => {
    if (hours === 0) return "0h";
    if (hours < 1) return "< 1h";
    
    const roundedHours = Math.round(hours * 10) / 10;
    
    if (roundedHours < 24) {
      return `${roundedHours}h`;
    } else {
      const days = Math.floor(roundedHours / 24);
      const remainingHours = Math.round((roundedHours % 24) * 10) / 10;
      
      if (remainingHours === 0) {
        return `${days}d`;
      } else {
        return `${days}d ${remainingHours}h`;
      }
    }
  };

  // Check if project is overdue based on stage configuration
  const overdueStatus = useMemo(() => {
    if (!currentStageConfig?.maxInstanceTime || currentStageConfig.maxInstanceTime === 0) {
      return false;
    }
    return currentBusinessHours >= currentStageConfig.maxInstanceTime;
  }, [currentBusinessHours, currentStageConfig?.maxInstanceTime]);

  const formattedTimeInStage = formatBusinessHours(currentBusinessHours);

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      setIsSwiped(true);
      setSwipeOffset(-maxSwipe);
    },
    onSwipedRight: () => {
      setIsSwiped(false);
      setSwipeOffset(0);
    },
    onSwiping: (eventData) => {
      // deltaX is negative when swiping left, positive when swiping right
      // Clamp between -maxSwipe and 0 to smoothly track finger movement
      const offset = Math.max(-maxSwipe, Math.min(0, eventData.deltaX));
      setSwipeOffset(offset);
    },
    trackMouse: false,
    trackTouch: true,
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('PATCH', `/api/projects/${project.id}/complete`, {
        completionStatus: 'completed_successfully'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id] });
      toast({
        title: "Project completed",
        description: "Project has been marked as successfully completed and archived.",
      });
      setSwipeOffset(0);
      setIsSwiped(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to complete project",
        description: error.message || "An error occurred while completing the project.",
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('PATCH', `/api/projects/${project.id}`, {
        archived: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id] });
      toast({
        title: "Project archived",
        description: "Project has been archived successfully.",
      });
      setSwipeOffset(0);
      setIsSwiped(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to archive project",
        description: error.message || "An error occurred while archiving the project.",
        variant: "destructive",
      });
    },
  });

  const handleInfoClick = () => {
    if (onShowInfo) {
      onShowInfo(project.id);
    }
    setSwipeOffset(0);
    setIsSwiped(false);
  };

  const handleMessagesClick = () => {
    if (onShowMessages) {
      onShowMessages(project.id);
    }
    setSwipeOffset(0);
    setIsSwiped(false);
  };

  const handleComplete = () => {
    setShowCompleteConfirm(true);
  };

  const confirmComplete = () => {
    completeMutation.mutate();
    setShowCompleteConfirm(false);
  };

  const handleArchive = () => {
    setShowArchiveConfirm(true);
  };

  const confirmArchive = () => {
    archiveMutation.mutate();
    setShowArchiveConfirm(false);
  };

  const handleCardClick = () => {
    if (isSwiped) {
      // If swiped, close the swipe instead of navigating
      setIsSwiped(false);
      setSwipeOffset(0);
    } else {
      // Navigate to project detail
      setLocation(`/projects/${project.id}`);
    }
  };

  const getStatusColor = (status: string) => {
    // Simple color mapping for status badges
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('completed') || lowerStatus.includes('done')) return 'bg-green-500 text-white';
    if (lowerStatus.includes('in progress') || lowerStatus.includes('active')) return 'bg-blue-500 text-white';
    if (lowerStatus.includes('pending') || lowerStatus.includes('waiting')) return 'bg-yellow-500 text-white';
    if (lowerStatus.includes('archived')) return 'bg-gray-500 text-white';
    return 'bg-gray-500 text-white';
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return 'N/A';
    try {
      return format(new Date(date), 'MMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <>
      <div className="relative overflow-hidden">
        {/* Action buttons tray (revealed by swiping left) */}
        <div className="absolute right-0 top-0 bottom-0 flex items-stretch">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleInfoClick();
            }}
            className="w-20 flex flex-col items-center justify-center bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
            data-testid={`button-info-${project.id}`}
          >
            <Info className="w-6 h-6" />
            <span className="text-xs mt-1">Info</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleMessagesClick();
            }}
            className="w-20 flex flex-col items-center justify-center bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800 transition-colors"
            data-testid={`button-messages-${project.id}`}
          >
            <MessageSquare className="w-6 h-6" />
            <span className="text-xs mt-1">Messages</span>
          </button>
          {canComplete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleComplete();
              }}
              disabled={completeMutation.isPending}
              className="w-20 flex flex-col items-center justify-center bg-green-600 text-white hover:bg-green-700 active:bg-green-800 disabled:opacity-50 transition-colors"
              data-testid={`button-complete-project-${project.id}`}
            >
              <CheckCircle2 className="w-6 h-6" />
              <span className="text-xs mt-1">Complete</span>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleArchive();
            }}
            disabled={archiveMutation.isPending}
            className="w-20 flex flex-col items-center justify-center bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 transition-colors"
            data-testid={`button-archive-project-${project.id}`}
          >
            <Archive className="w-6 h-6" />
            <span className="text-xs mt-1">Archive</span>
          </button>
        </div>

        {/* Main card content */}
        <div
          {...handlers}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: isSwiped || swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none',
          }}
          className="relative bg-background"
        >
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow mb-3"
            onClick={handleCardClick}
            data-testid={`card-project-${project.id}`}
          >
            <CardContent className="p-4">
              {/* Client Name and Status */}
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-base line-clamp-1" data-testid={`text-client-name-${project.id}`}>
                  {project.client?.name || 'Unknown Client'}
                </h3>
                <Badge className={`ml-2 text-xs ${getStatusColor(project.currentStatus)}`} data-testid={`badge-status-${project.id}`}>
                  {project.currentStatus}
                </Badge>
              </div>

              {/* Project Type */}
              {project.projectType && (
                <div className="text-sm text-muted-foreground mb-2" data-testid={`text-project-type-${project.id}`}>
                  {project.projectType.name}
                </div>
              )}

              {/* Service Owner */}
              {project.projectOwner && (
                <div className="flex items-center text-sm text-muted-foreground mb-2">
                  <UserIcon className="w-4 h-4 mr-1" />
                  <span data-testid={`text-service-owner-${project.id}`}>
                    {project.projectOwner.firstName} {project.projectOwner.lastName}
                  </span>
                </div>
              )}

              {/* Assigned To */}
              {project.currentAssignee && (
                <div className="flex items-center text-sm text-muted-foreground mb-2">
                  <UserIcon className="w-4 h-4 mr-1" />
                  <span data-testid={`text-assigned-to-${project.id}`}>
                    Assigned: {project.currentAssignee.firstName} {project.currentAssignee.lastName}
                  </span>
                </div>
              )}

              {/* Time in Stage and Stage Timer */}
              <div className="flex items-center justify-between text-sm mb-2">
                <div className="flex items-center text-muted-foreground">
                  <Clock className="w-4 h-4 mr-1" />
                  <span data-testid={`text-time-in-stage-${project.id}`}>
                    {formattedTimeInStage}
                  </span>
                </div>
                
                {currentStageConfig?.maxInstanceTime && currentStageConfig.maxInstanceTime > 0 && (
                  <div className="flex items-center">
                    <Timer className={`w-4 h-4 mr-1 ${overdueStatus ? 'text-red-600' : 'text-muted-foreground'}`} />
                    <span className={`text-sm ${overdueStatus ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`} data-testid={`text-stage-timer-${project.id}`}>
                      {overdueStatus ? 'Overdue' : `${formatBusinessHours(currentStageConfig.maxInstanceTime)} limit`}
                    </span>
                  </div>
                )}
              </div>

              {/* Due Date */}
              {project.dueDate && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="w-4 h-4 mr-1" />
                  <span data-testid={`text-due-date-${project.id}`}>
                    Due: {formatDate(project.dueDate)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Complete Confirmation Dialog */}
      <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <AlertDialogContent data-testid={`dialog-complete-confirm-${project.id}`}>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark this project as successfully completed? This will also archive the project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-complete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmComplete}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-complete"
            >
              Complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent data-testid={`dialog-archive-confirm-${project.id}`}>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive this project? Archived projects can be restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-archive">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmArchive}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="button-confirm-archive"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
