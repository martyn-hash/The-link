import { useParams, useLocation, Link as RouterLink } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, AlertCircle, User as UserIcon, CheckCircle2, XCircle, Info, Plus, CheckSquare } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import TopNavigation from "@/components/top-navigation";
import ProjectInfo from "@/components/project-info";
import ChangeStatusModal from "@/components/ChangeStatusModal";
import ProjectChronology from "@/components/project-chronology";
import ProjectMessaging from "@/components/ProjectMessaging";
import { ProjectProgressNotes } from "@/components/project-progress-notes";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProjectWithRelations, User } from "@shared/schema";
import { useEffect, useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useActivityTracker } from "@/lib/activityTracker";
import { format } from "date-fns";

interface RoleAssigneeResponse {
  user: User | null;
  roleUsed: string | null;
  usedFallback: boolean;
  source: 'role_assignment' | 'fallback_user' | 'direct_assignment' | 'none';
}

export default function ProjectDetail() {
  const { id: projectId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { trackProjectView } = useActivityTracker();
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completionType, setCompletionType] = useState<'completed_successfully' | 'completed_unsuccessfully' | null>(null);
  const [showStageErrorDialog, setShowStageErrorDialog] = useState(false);
  const [stageErrorMessage, setStageErrorMessage] = useState<{ currentStage: string; validStages: string[] } | null>(null);
  const [showChangeStatusModal, setShowChangeStatusModal] = useState(false);

  // Track project view activity when component mounts
  useEffect(() => {
    if (projectId) {
      trackProjectView(projectId);
    }
  }, [projectId, trackProjectView]);

  // Fetch single project data
  const { 
    data: project, 
    isLoading: projectLoading, 
    error: projectError,
    refetch 
  } = useQuery<ProjectWithRelations>({
    queryKey: ['/api/projects', projectId],
    enabled: isAuthenticated && !!user && !!projectId,
    retry: false,
  });

  // Fetch current stage assignee
  const { data: currentAssignee, isLoading: assigneeLoading } = useQuery<RoleAssigneeResponse>({
    queryKey: ['/api/projects', projectId, 'role-assignee'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/role-assignee`);
      if (!response.ok) throw new Error('Failed to fetch role assignee');
      return response.json();
    },
    enabled: isAuthenticated && !!user && !!projectId && !!project,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch project type stages to check if current stage allows completion
  const { data: stages } = useQuery<any[]>({
    queryKey: ['/api/config/project-types', project?.projectTypeId, 'stages'],
    enabled: !!project?.projectTypeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch internal tasks for this project
  const { data: projectInternalTasks, isLoading: projectInternalTasksLoading } = useQuery<any[]>({
    queryKey: [`/api/internal-tasks/project/${projectId}`],
    enabled: !!projectId,
  });

  // Fetch client people for progress notes
  const { data: clientPeople } = useQuery<any[]>({
    queryKey: [`/api/clients/${project?.clientId}/people`],
    enabled: !!project?.clientId,
  });

  // Find current stage and check if it allows completion
  // Note: project.currentStatus stores the stage name, not the stage ID
  const currentStage = stages?.find((stage: any) => stage.name === project?.currentStatus);
  const currentStageAllowsCompletion = currentStage?.canBeFinalStage === true;

  // Mutation to complete project
  const completeMutation = useMutation({
    mutationFn: async (status: 'completed_successfully' | 'completed_unsuccessfully') => {
      return await apiRequest('PATCH', `/api/projects/${projectId}/complete`, {
        completionStatus: status
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "Project completed",
        description: `Project has been marked as ${variables === 'completed_successfully' ? 'successfully' : 'unsuccessfully'} completed and archived.`,
      });
      setShowCompleteDialog(false);
      setCompletionType(null);
    },
    onError: (error: any) => {
      // Handle the specific case of trying to complete at non-final stage
      if (error.code === 'INVALID_COMPLETION_STAGE') {
        // Find all final stages for a user-friendly message
        const finalStages = stages?.filter((s: any) => s.canBeFinalStage === true) || [];
        setStageErrorMessage({
          currentStage: project?.currentStatus || 'Unknown',
          validStages: finalStages.map((s: any) => s.name)
        });
        setShowStageErrorDialog(true);
        setShowCompleteDialog(false);
        setCompletionType(null);
      } else {
        // Show generic error for other cases
        toast({
          title: "Failed to complete project",
          description: error.message || "An unexpected error occurred",
          variant: "destructive",
        });
      }
    }
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Handle query errors
  useEffect(() => {
    if (projectError && isUnauthorizedError(projectError)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [projectError, toast]);

  const handleBack = () => {
    // Check if we came from a client detail page
    const urlParams = new URLSearchParams(window.location.search);
    const from = urlParams.get('from');
    const clientId = urlParams.get('clientId');
    
    if (from === 'client' && clientId) {
      // Navigate back to the client detail page
      setLocation(`/clients/${clientId}`);
    } else {
      // Navigate back to the appropriate projects page based on user permissions
      if (user?.isAdmin || user?.canSeeAdminMenu) {
        setLocation("/all-projects");
      } else {
        setLocation("/projects");
      }
    }
  };

  const handleStatusUpdated = () => {
    // Refetch project data when status is updated
    refetch();
  };

  const handleConfirmComplete = (status: 'completed_successfully' | 'completed_unsuccessfully') => {
    completeMutation.mutate(status);
    setShowCompleteDialog(false);
  };

  // Check if user has permission to complete
  const hasPermissionToComplete = project && !project.completionStatus && (
    user?.isAdmin ||
    project.currentAssigneeId === user?.id ||
    project.clientManagerId === user?.id ||
    project.bookkeeperId === user?.id
  );

  // User can only complete if they have permission AND current stage allows it
  const canComplete = hasPermissionToComplete && currentStageAllowsCompletion;

  // Loading state
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Project loading state
  if (projectLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopNavigation user={user} />
        
        <div className="max-w-7xl mx-auto p-6 w-full">
          {/* Header skeleton */}
          <div className="mb-6">
            <div className="flex items-center space-x-4 mb-4">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-8 w-64" />
            </div>
          </div>

          {/* Content skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-32" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          {/* Chronology skeleton */}
          <div>
            <Skeleton className="h-6 w-40 mb-4" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border-l-2 border-muted pl-4 pb-4">
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (projectError) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopNavigation user={user} />
        
        <div className="max-w-7xl mx-auto p-6 w-full">
          <div className="flex items-center space-x-4 mb-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBack}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>
          </div>

          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-destructive/10 rounded-full">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Failed to load project
              </h3>
              <p className="text-muted-foreground mb-4">
                {projectError instanceof Error ? projectError.message : 'An unknown error occurred'}
              </p>
              <Button onClick={() => refetch()} data-testid="button-retry">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!project) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopNavigation user={user} />
        
        <div className="max-w-7xl mx-auto p-6 w-full">
          <div className="flex items-center space-x-4 mb-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBack}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>
          </div>

          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Project not found
              </h3>
              <p className="text-muted-foreground">
                The project you're looking for doesn't exist or you don't have access to it.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      
      <div className="max-w-7xl mx-auto p-6 w-full">
        {/* Header with back navigation */}
        <div className="mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBack}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>
          </div>
          
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-client-name">
                {project.client?.name || 'Unknown Client'}
              </h1>
            </div>
            
            <div className="flex gap-2">
              {/* Change Status Button */}
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowChangeStatusModal(true)}
                data-testid="button-change-status"
                className="bg-[#3e7195] hover:bg-[#325b7a] text-white"
              >
                Change Status
              </Button>

              {/* Complete Project Button - Only visible when at a completable stage */}
              {canComplete && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowCompleteDialog(true)}
                  disabled={completeMutation.isPending}
                  data-testid="button-complete"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Complete
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs Layout */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full max-w-4xl grid-cols-4">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="messages" data-testid="tab-messages">Messages</TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-tasks">Internal Tasks</TabsTrigger>
            <TabsTrigger value="progress-notes" data-testid="tab-progress-notes">Progress Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="space-y-6">
              {/* Row 1: Full-width project info */}
              <div className="bg-card border border-border rounded-lg p-6">
                <ProjectInfo project={project} user={user} />
              </div>

              {/* Row 2: Full-width chronology */}
              <div className="bg-card border border-border rounded-lg p-6">
                <ProjectChronology project={project} currentAssignee={currentAssignee} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="messages" className="mt-6">
            <ProjectMessaging projectId={project.id} project={project} />
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            {/* Internal Tasks Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5" />
                    Internal Tasks
                  </CardTitle>
                  <CreateTaskDialog
                    trigger={
                      <Button
                        variant="default"
                        size="sm"
                        data-testid="button-new-internal-task"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Task
                      </Button>
                    }
                    defaultConnections={{ projectId }}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {projectInternalTasksLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : !projectInternalTasks || projectInternalTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No internal tasks for this project yet.</p>
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Assigned To</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projectInternalTasks.map((task: any) => (
                          <TableRow key={task.id} data-testid={`row-internal-task-${task.id}`}>
                            <TableCell className="font-medium">
                              <RouterLink href={`/internal-tasks?task=${task.id}`}>
                                <button className="hover:underline text-left" data-testid={`link-task-${task.id}`}>
                                  {task.title}
                                </button>
                              </RouterLink>
                            </TableCell>
                            <TableCell className="text-sm">{task.taskType?.name || '-'}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  task.priority === 'urgent' ? 'destructive' :
                                  task.priority === 'high' ? 'default' :
                                  'secondary'
                                }
                                data-testid={`badge-priority-${task.id}`}
                              >
                                {task.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  task.status === 'closed' ? 'outline' :
                                  task.status === 'in_progress' ? 'default' :
                                  'secondary'
                                }
                                data-testid={`badge-status-${task.id}`}
                              >
                                {task.status === 'in_progress' ? 'In Progress' : task.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : 'Unassigned'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(task.createdAt), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell className="text-right">
                              <RouterLink href={`/internal-tasks/${task.id}?from=project&projectId=${projectId}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  data-testid={`button-view-task-${task.id}`}
                                >
                                  View
                                </Button>
                              </RouterLink>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="progress-notes" className="mt-6">
            <ProjectProgressNotes 
              projectId={projectId!} 
              clientId={project?.clientId || ''} 
              clientPeople={clientPeople}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Completion Selection Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent data-testid="dialog-complete-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Project</AlertDialogTitle>
            <AlertDialogDescription>
              How would you like to complete this project? The project will be archived and will no longer appear in active project lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 py-4">
            <Button
              variant="default"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => handleConfirmComplete('completed_successfully')}
              disabled={completeMutation.isPending}
              data-testid="button-complete-success"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark as Successfully Completed
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => handleConfirmComplete('completed_unsuccessfully')}
              disabled={completeMutation.isPending}
              data-testid="button-complete-fail"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Mark as Unsuccessfully Completed
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowCompleteDialog(false);
                setCompletionType(null);
              }}
              data-testid="button-cancel-complete"
            >
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Status Modal */}
      <ChangeStatusModal
        isOpen={showChangeStatusModal}
        onClose={() => setShowChangeStatusModal(false)}
        project={project}
        user={user}
        onStatusUpdated={handleStatusUpdated}
      />

      {/* Stage Requirement Error Dialog */}
      <AlertDialog open={showStageErrorDialog} onOpenChange={setShowStageErrorDialog}>
        <AlertDialogContent data-testid="dialog-stage-error" className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
                <Info className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <AlertDialogTitle className="text-xl">Project Cannot Be Completed Yet</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-4 text-base">
              <p>
                This project is currently at the <strong className="text-foreground">"{stageErrorMessage?.currentStage}"</strong> stage, 
                which doesn't allow completion.
              </p>
              <p>
                To complete this project, please first move it to one of the following stages:
              </p>
              {stageErrorMessage && stageErrorMessage.validStages.length > 0 ? (
                <ul className="space-y-2 ml-4">
                  {stageErrorMessage.validStages.map((stageName, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <span className="text-foreground font-medium">{stageName}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-orange-600 dark:text-orange-400">
                  No completion stages are configured for this project type. Please contact your administrator.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setShowStageErrorDialog(false);
                setStageErrorMessage(null);
              }}
              data-testid="button-close-stage-error"
              className="bg-primary hover:bg-primary/90"
            >
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}