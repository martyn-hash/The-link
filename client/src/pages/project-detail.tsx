import { useParams, useLocation, Link as RouterLink } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, AlertCircle, User as UserIcon, CheckCircle2, XCircle, Info, Plus, CheckSquare, Ban, Calendar, PauseCircle, PlayCircle } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import TopNavigation from "@/components/top-navigation";
import BottomNav from "@/components/bottom-nav";
import SuperSearch from "@/components/super-search";
import ProjectInfo from "@/components/project-info";
import ChangeStatusModal from "@/components/ChangeStatusModal";
import ProjectChronology from "@/components/project-chronology";
import ProjectMessaging from "@/components/ProjectMessaging";
import { ProjectProgressNotes } from "@/components/project-progress-notes";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwipeableTabsWrapper } from "@/components/swipeable-tabs";
import type { ProjectWithRelations, User } from "@shared/schema";
import { useEffect, useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useActivityTracker } from "@/lib/activityTracker";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface RoleAssigneeResponse {
  user: User | null;
  roleUsed: string | null;
  usedFallback: boolean;
  source: 'role_assignment' | 'fallback_user' | 'direct_assignment' | 'none';
}

// Form schema for making project inactive
const makeProjectInactiveSchema = z.object({
  inactiveReason: z.enum(["created_in_error", "no_longer_required", "client_doing_work_themselves"], {
    required_error: "Please select a reason for marking this project inactive",
  }),
});

type MakeProjectInactiveData = z.infer<typeof makeProjectInactiveSchema>;

// Form schema for moving project to bench
const benchProjectSchema = z.object({
  benchReason: z.enum(["legacy_work", "missing_data", "other"], {
    required_error: "Please select a reason for benching this project",
  }),
  benchReasonOtherText: z.string().optional(),
}).refine((data) => {
  // If reason is "other", notes are required
  if (data.benchReason === "other" && (!data.benchReasonOtherText || data.benchReasonOtherText.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Please provide details for the 'Other' reason",
  path: ["benchReasonOtherText"],
});

type BenchProjectData = z.infer<typeof benchProjectSchema>;

// Utility function to format dates
function formatDate(date: string | Date | null): string {
  if (!date) return 'Not provided';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'Invalid date';
  
  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export default function ProjectDetail() {
  const { id: projectId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { trackProjectView } = useActivityTracker();
  const isMobile = useIsMobile();
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completionType, setCompletionType] = useState<'completed_successfully' | 'completed_unsuccessfully' | null>(null);
  const [showStageErrorDialog, setShowStageErrorDialog] = useState(false);
  const [stageErrorMessage, setStageErrorMessage] = useState<{ currentStage: string; validStages: string[] } | null>(null);
  const [showChangeStatusModal, setShowChangeStatusModal] = useState(false);
  const [currentTab, setCurrentTab] = useState<string>("overview");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [showInactiveDialog, setShowInactiveDialog] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showBenchDialog, setShowBenchDialog] = useState(false);
  const [showUnbenchConfirm, setShowUnbenchConfirm] = useState(false);
  
  // Form for making project inactive
  const inactiveForm = useForm<MakeProjectInactiveData>({
    resolver: zodResolver(makeProjectInactiveSchema),
    defaultValues: {
      inactiveReason: undefined,
    },
  });
  
  // Form for benching project
  const benchForm = useForm<BenchProjectData>({
    resolver: zodResolver(benchProjectSchema),
    defaultValues: {
      benchReason: undefined,
      benchReasonOtherText: "",
    },
  });

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
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Pre-fetch stage change config in background (will be used when modal opens)
  // This eliminates the 5-6 second delay when clicking "Change Status"
  useQuery({
    queryKey: ["/api/projects", projectId, "stage-change-config"],
    enabled: isAuthenticated && !!user && !!projectId && !!project,
    staleTime: 5 * 60 * 1000, // 5 minutes - config rarely changes
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
        showFriendlyError({ error });
      }
    }
  });
  
  // Mutation to make project inactive
  const makeInactiveMutation = useMutation({
    mutationFn: async (data: MakeProjectInactiveData) => {
      return await apiRequest('PATCH', `/api/projects/${projectId}`, {
        inactive: true,
        inactiveReason: data.inactiveReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      // Invalidate client-specific projects queries to update the projects list on client detail page
      if (project?.clientId) {
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey[0] as string;
            return key?.includes(`/api/clients/${project.clientId}/projects`);
          }
        });
      }
      toast({
        title: "Project marked inactive",
        description: "The project has been successfully marked as inactive.",
      });
      setShowInactiveDialog(false);
      inactiveForm.reset();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });
  
  // Handler for making project inactive
  const handleMakeInactive = (data: MakeProjectInactiveData) => {
    makeInactiveMutation.mutate(data);
  };
  
  // Mutation to bench project
  const benchMutation = useMutation({
    mutationFn: async (data: BenchProjectData) => {
      // Trim the text before sending to ensure no whitespace-only values
      const trimmedText = data.benchReasonOtherText?.trim();
      return await apiRequest('POST', `/api/projects/${projectId}/bench`, {
        benchReason: data.benchReason,
        benchReasonOtherText: trimmedText || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      if (project?.clientId) {
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey[0] as string;
            return key?.includes(`/api/clients/${project.clientId}/projects`);
          }
        });
      }
      toast({
        title: "Project moved to bench",
        description: "The project has been temporarily suspended.",
      });
      setShowBenchDialog(false);
      benchForm.reset();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });
  
  // Mutation to unbench project
  const unbenchMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/projects/${projectId}/unbench`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      if (project?.clientId) {
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey[0] as string;
            return key?.includes(`/api/clients/${project.clientId}/projects`);
          }
        });
      }
      toast({
        title: "Project taken off bench",
        description: "The project has been reactivated and returned to its previous status.",
      });
      setShowUnbenchConfirm(false);
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });
  
  // Handler for benching project
  const handleBench = (data: BenchProjectData) => {
    benchMutation.mutate(data);
  };
  
  // Handler for unbenching project
  const handleUnbench = () => {
    unbenchMutation.mutate();
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      showFriendlyError({ error: "You are logged out. Logging in again..." });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading]);

  // Handle query errors
  useEffect(() => {
    if (projectError && isUnauthorizedError(projectError)) {
      showFriendlyError({ error: "You are logged out. Logging in again..." });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [projectError]);

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
      
      <div className="page-container py-6 md:py-8">
        {/* Header with back navigation */}
        <div className="mb-8">
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <RouterLink to={`/clients/${project.clientId}`}>
                  <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground hover:text-primary cursor-pointer transition-colors" data-testid="text-client-name">
                    {project.client?.name || 'Unknown Client'}
                  </h1>
                </RouterLink>
                {project.projectType?.name && (
                  <span className="text-lg md:text-xl font-medium text-meta" data-testid="text-project-type">
                    {project.projectType.name}
                  </span>
                )}
              </div>
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
              
              {/* Make Inactive Button - Only visible for non-inactive projects with permission */}
              {user?.canMakeProjectsInactive && !project.inactive && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowInactiveDialog(true)}
                  data-testid="button-make-inactive"
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Make Inactive
                </Button>
              )}
              
              {/* Move to Bench Button - Only visible when user has permission, project is not benched, and not completed/inactive */}
              {user?.canBenchProjects && !project.isBenched && !project.completionStatus && !project.inactive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBenchDialog(true)}
                  disabled={benchMutation.isPending}
                  data-testid="button-move-to-bench"
                  className="border-amber-500 text-amber-700 hover:bg-amber-50 dark:border-amber-400 dark:text-amber-400 dark:hover:bg-amber-950"
                >
                  <PauseCircle className="w-4 h-4 mr-2" />
                  Move to Bench
                </Button>
              )}
              
              {/* Take Off Bench Button - Only visible when user has permission and project is benched */}
              {user?.canBenchProjects && project.isBenched && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowUnbenchConfirm(true)}
                  disabled={unbenchMutation.isPending}
                  data-testid="button-take-off-bench"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Take Off Bench
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {/* Inactive Status Display */}
        {project.inactive && project.inactiveReason && (
          <div className="mb-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4" data-testid="section-inactive-status">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Ban className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-900 dark:text-red-100 mb-2" data-testid="text-inactive-status">
                  Inactive
                </h3>
                <div className="space-y-1 text-sm text-red-800 dark:text-red-200">
                  <div>
                    <span className="font-medium">Reason:</span>{" "}
                    <span data-testid="text-inactive-reason-value">
                      {project.inactiveReason
                        ?.split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ')}
                    </span>
                  </div>
                  {project.inactiveAt && (
                    <div>
                      <span className="font-medium">Marked Inactive On:</span>{" "}
                      <span data-testid="text-inactive-date-value">{formatDate(project.inactiveAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Bench Status Display */}
        {project.isBenched && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4" data-testid="section-bench-status">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <PauseCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-2" data-testid="text-bench-status">
                  On The Bench
                </h3>
                <div className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
                  <div>
                    <span className="font-medium">Reason:</span>{" "}
                    <span data-testid="text-bench-reason-value">
                      {project.benchReason === 'legacy_work' && 'Legacy Work'}
                      {project.benchReason === 'missing_data' && 'Missing Data'}
                      {project.benchReason === 'other' && 'Other'}
                    </span>
                  </div>
                  {project.benchReasonOtherText && (
                    <div>
                      <span className="font-medium">Notes:</span>{" "}
                      <span data-testid="text-bench-notes-value">{project.benchReasonOtherText}</span>
                    </div>
                  )}
                  {project.benchedAt && (
                    <div>
                      <span className="font-medium">Benched On:</span>{" "}
                      <span data-testid="text-bench-date-value">{formatDate(project.benchedAt)}</span>
                    </div>
                  )}
                  {project.preBenchStatus && (
                    <div>
                      <span className="font-medium">Previous Status:</span>{" "}
                      <span data-testid="text-pre-bench-status-value">{project.preBenchStatus}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Layout - Outside all constrained containers for full-width */}
      <div className="flex-1 overflow-y-auto">
      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full" data-client-tabs="project">
          {/* Desktop Tabs - Centered */}
          <div className="hidden md:block mx-auto max-w-screen-2xl px-4 md:px-6 lg:px-8">
            <TabsList className="grid w-full max-w-4xl grid-cols-4">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="messages" data-testid="tab-messages">Messages</TabsTrigger>
              <TabsTrigger value="tasks" data-testid="tab-tasks">Internal Tasks</TabsTrigger>
              <TabsTrigger value="progress-notes" data-testid="tab-progress-notes">Progress Notes</TabsTrigger>
            </TabsList>
          </div>

          {/* Mobile Tabs - Carousel */}
          <div className="md:hidden w-full overflow-x-auto snap-x snap-mandatory scroll-smooth -mx-4 px-[10vw]" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <TabsList className="inline-flex gap-2 h-auto">
              <TabsTrigger 
                value="overview" 
                data-testid="tab-overview" 
                className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" 
                style={{ width: '80vw' }}
              >
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="messages" 
                data-testid="tab-messages" 
                className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" 
                style={{ width: '80vw' }}
              >
                Messages
              </TabsTrigger>
              <TabsTrigger 
                value="tasks" 
                data-testid="tab-tasks" 
                className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" 
                style={{ width: '80vw' }}
              >
                Internal Tasks
              </TabsTrigger>
              <TabsTrigger 
                value="progress-notes" 
                data-testid="tab-progress-notes" 
                className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" 
                style={{ width: '80vw' }}
              >
                Progress Notes
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Mobile Section Title */}
          {isMobile && (
            <div className="mt-4 mb-2 mx-auto max-w-screen-2xl px-4 md:px-6 lg:px-8">
              <h2 className="text-lg font-semibold text-foreground" data-testid="mobile-section-title">
                {currentTab === "overview" && "Overview"}
                {currentTab === "messages" && "Messages"}
                {currentTab === "tasks" && "Internal Tasks"}
                {currentTab === "progress-notes" && "Progress Notes"}
              </h2>
            </div>
          )}

          {isMobile ? (
            <SwipeableTabsWrapper
              tabs={["overview", "messages", "tasks", "progress-notes"]}
              currentTab={currentTab}
              onTabChange={setCurrentTab}
              enabled={true}
              dataAttribute="project"
            >
              <TabsContent value="overview" className="mt-6">
              <div className="mx-auto max-w-screen-2xl px-4 md:px-6 lg:px-8 space-y-6">
                {/* Row 1: Full-width project info */}
                <div className="bg-card border border-border rounded-lg p-6">
                <ProjectInfo 
                  project={project} 
                  user={user} 
                  currentStage={currentStage}
                  currentAssignee={currentAssignee}
                />
              </div>

                {/* Row 2: Full-width chronology */}
                <div className="bg-card border border-border rounded-lg p-6">
                  <ProjectChronology project={project} />
                </div>
              </div>
            </TabsContent>

          <TabsContent value="messages" className="!max-w-none w-full px-4 md:px-6 lg:px-8 py-6 md:py-8">
            <ProjectMessaging projectId={project.id} project={project} />
          </TabsContent>

          <TabsContent value="tasks" className="!max-w-none w-full px-4 md:px-6 lg:px-8 py-6 md:py-8">
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
                  <>
                    {/* Desktop Table */}
                    <div className="hidden md:block border rounded-lg">
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
                                <RouterLink to={`/internal-tasks?task=${task.id}`}>
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
                                <RouterLink to={`/internal-tasks/${task.id}?from=project&projectId=${projectId}`}>
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

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                      {projectInternalTasks.map((task: any) => (
                        <Card key={task.id} data-testid={`card-internal-task-${task.id}`}>
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="font-medium text-base">{task.title}</div>
                              
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Type:</span>
                                  <p className="font-medium">{task.taskType?.name || '-'}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Assigned To:</span>
                                  <p className="font-medium">
                                    {task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : 'Unassigned'}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Priority:</span>
                                  <div className="mt-1">
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
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Status:</span>
                                  <div className="mt-1">
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
                                  </div>
                                </div>
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Created:</span>
                                  <p className="font-medium">{format(new Date(task.createdAt), 'MMM d, yyyy')}</p>
                                </div>
                              </div>

                              <RouterLink to={`/internal-tasks/${task.id}?from=project&projectId=${projectId}`}>
                                <Button
                                  variant="outline"
                                  className="w-full h-11"
                                  data-testid={`button-view-task-${task.id}`}
                                >
                                  View Task
                                </Button>
                              </RouterLink>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="progress-notes" className="!max-w-none w-full px-4 md:px-6 lg:px-8 py-6 md:py-8">
            <ProjectProgressNotes 
              projectId={projectId!} 
              clientId={project?.clientId || ''} 
              clientPeople={clientPeople}
            />
          </TabsContent>
            </SwipeableTabsWrapper>
          ) : (
            <>
              <TabsContent value="overview" className="mt-6">
                <div className="mx-auto max-w-screen-2xl px-4 md:px-6 lg:px-8 space-y-6">
                  <div className="bg-card border border-border rounded-lg p-6">
                    <ProjectInfo 
                      project={project} 
                      user={user} 
                      currentStage={currentStage}
                      currentAssignee={currentAssignee}
                    />
                  </div>
                  <div className="bg-card border border-border rounded-lg p-6">
                    <ProjectChronology project={project} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="messages" className="!max-w-none w-full px-4 md:px-6 lg:px-8 py-6 md:py-8">
                <ProjectMessaging projectId={project.id} project={project} />
              </TabsContent>

              <TabsContent value="tasks" className="!max-w-none w-full px-4 md:px-6 lg:px-8 py-6 md:py-8">
                <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <CheckSquare className="w-5 h-5" />
                          Internal Tasks
                        </CardTitle>
                        <Button
                          onClick={() => setShowTaskModal(true)}
                          size="sm"
                          data-testid="button-create-task"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Task
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {projectInternalTasksLoading ? (
                        <div className="space-y-4">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-20" />
                          ))}
                        </div>
                      ) : projectInternalTasks && projectInternalTasks.length > 0 ? (
                        <>
                          <div className="text-sm text-muted-foreground mb-4">
                            {projectInternalTasks.length} {projectInternalTasks.length === 1 ? 'task' : 'tasks'}
                          </div>
                          <div className="space-y-4">
                            {projectInternalTasks.map((task) => (
                              <Card key={task.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                  <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                          <div className="font-medium text-base">{task.title}</div>
                                          <Badge variant={
                                            task.priority === 'urgent' ? 'destructive' :
                                            task.priority === 'high' ? 'default' :
                                            task.priority === 'medium' ? 'secondary' :
                                            'outline'
                                          } data-testid={`badge-priority-${task.id}`}>
                                            {task.priority}
                                          </Badge>
                                          <Badge variant={
                                            task.status === 'completed' ? 'default' :
                                            task.status === 'in_progress' ? 'secondary' :
                                            'outline'
                                          } data-testid={`badge-status-${task.id}`}>
                                            {task.status.replace('_', ' ')}
                                          </Badge>
                                        </div>
                                        {task.description && (
                                          <p className="text-sm text-muted-foreground line-clamp-2">
                                            {task.description}
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                      {task.assignedTo && (
                                        <div className="flex items-center gap-1" data-testid={`text-assigned-${task.id}`}>
                                          <UserIcon className="w-3 h-3" />
                                          <span>{task.assignedTo.firstName} {task.assignedTo.lastName}</span>
                                        </div>
                                      )}
                                      {task.dueDate && (
                                        <div className="flex items-center gap-1" data-testid={`text-due-${task.id}`}>
                                          <Calendar className="w-3 h-3" />
                                          <span>Due: {format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex justify-end">
                                      <RouterLink to={`/internal-tasks/${task.id}?from=project&projectId=${projectId}`}>
                                        <Button
                                          variant="outline"
                                          className="w-full h-11"
                                          data-testid={`button-view-task-${task.id}`}
                                        >
                                          View Task
                                        </Button>
                                      </RouterLink>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-12 text-muted-foreground">
                          <CheckSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No internal tasks for this project yet.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
              </TabsContent>

              <TabsContent value="progress-notes" className="!max-w-none w-full px-4 md:px-6 lg:px-8 py-6 md:py-8">
                <ProjectProgressNotes 
                  projectId={projectId!} 
                  clientId={project?.clientId || ''} 
                  clientPeople={clientPeople}
                />
              </TabsContent>
            </>
          )}
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
      
      {/* Make Inactive Dialog */}
      <Dialog open={showInactiveDialog} onOpenChange={setShowInactiveDialog}>
        <DialogContent data-testid="dialog-make-inactive">
          <DialogHeader>
            <DialogTitle>Make Project Inactive</DialogTitle>
            <DialogDescription>
              Please select a reason for marking this project as inactive. The project will no longer be included in scheduling.
            </DialogDescription>
          </DialogHeader>
          <Form {...inactiveForm}>
            <form onSubmit={inactiveForm.handleSubmit(handleMakeInactive)} className="space-y-4">
              <FormField
                control={inactiveForm.control}
                name="inactiveReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inactive Reason</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} data-testid="select-inactive-reason">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a reason" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="created_in_error">Created in Error</SelectItem>
                        <SelectItem value="no_longer_required">No Longer Required</SelectItem>
                        <SelectItem value="client_doing_work_themselves">Client Doing Work Themselves</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowInactiveDialog(false);
                    inactiveForm.reset();
                  }}
                  data-testid="button-cancel-inactive"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={makeInactiveMutation.isPending}
                  data-testid="button-confirm-inactive"
                >
                  Make Inactive
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Move to Bench Dialog */}
      <Dialog open={showBenchDialog} onOpenChange={setShowBenchDialog}>
        <DialogContent data-testid="dialog-move-to-bench">
          <DialogHeader>
            <DialogTitle>Move Project to Bench</DialogTitle>
            <DialogDescription>
              Temporarily suspend this project. It will be excluded from deadline tracking and overdue calculations.
            </DialogDescription>
          </DialogHeader>
          <Form {...benchForm}>
            <form onSubmit={benchForm.handleSubmit(handleBench)} className="space-y-4">
              <FormField
                control={benchForm.control}
                name="benchReason"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Reason for Benching</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <div className="flex items-center space-x-3 space-y-0">
                          <RadioGroupItem value="legacy_work" id="legacy_work" data-testid="radio-legacy-work" />
                          <label htmlFor="legacy_work" className="font-normal cursor-pointer">
                            Legacy Work - Work from before the service started
                          </label>
                        </div>
                        <div className="flex items-center space-x-3 space-y-0">
                          <RadioGroupItem value="missing_data" id="missing_data" data-testid="radio-missing-data" />
                          <label htmlFor="missing_data" className="font-normal cursor-pointer">
                            Missing Data - Waiting for client to provide information
                          </label>
                        </div>
                        <div className="flex items-center space-x-3 space-y-0">
                          <RadioGroupItem value="other" id="other" data-testid="radio-other" />
                          <label htmlFor="other" className="font-normal cursor-pointer">
                            Other - Specify reason in notes
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={benchForm.control}
                name="benchReasonOtherText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Notes {benchForm.watch("benchReason") === "other" && <span className="text-destructive">*</span>}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any additional details about why this project is being benched..."
                        className="resize-none"
                        {...field}
                        data-testid="textarea-bench-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowBenchDialog(false);
                    benchForm.reset();
                  }}
                  data-testid="button-cancel-bench"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={benchMutation.isPending}
                  data-testid="button-confirm-bench"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <PauseCircle className="w-4 h-4 mr-2" />
                  Move to Bench
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Unbench Confirmation Dialog */}
      <AlertDialog open={showUnbenchConfirm} onOpenChange={setShowUnbenchConfirm}>
        <AlertDialogContent data-testid="dialog-unbench-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Take Project Off Bench</AlertDialogTitle>
            <AlertDialogDescription>
              This project will be reactivated and returned to its previous status: <strong className="text-foreground">{project.preBenchStatus || "the first stage"}</strong>.
              Deadline tracking will resume.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setShowUnbenchConfirm(false)}
              data-testid="button-cancel-unbench"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnbench}
              disabled={unbenchMutation.isPending}
              data-testid="button-confirm-unbench"
              className="bg-amber-600 hover:bg-amber-700"
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              Take Off Bench
            </AlertDialogAction>
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

      {/* Mobile Bottom Navigation */}
      <BottomNav onSearchClick={() => setMobileSearchOpen(true)} />

      {/* Mobile Search Modal */}
      <SuperSearch
        isOpen={mobileSearchOpen}
        onOpenChange={setMobileSearchOpen}
      />
    </div>
  );
}