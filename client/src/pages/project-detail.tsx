import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, AlertCircle } from "lucide-react";
import ProjectInfo from "@/components/project-info";
import StatusChangeForm from "@/components/status-change-form";
import ProjectChronology from "@/components/project-chronology";
import type { ProjectWithRelations } from "@shared/schema";
import { useEffect } from "react";

export default function ProjectDetail() {
  const { id: projectId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

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
    // Navigate back to the appropriate projects page based on user role
    if (user?.role === 'admin' || user?.role === 'manager') {
      setLocation("/all-projects");
    } else {
      setLocation("/projects");
    }
  };

  const handleStatusUpdated = () => {
    // Refetch project data when status is updated
    refetch();
  };

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
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
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
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
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
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
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
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
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
          
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-project-title">
            {project.client.name} - {project.description} - {project.currentStatus.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
          </h1>
        </div>

        {/* Two-row layout */}
        <div className="space-y-6">
          {/* Row 1: 2-column grid (responsive) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Project Info */}
            <div className="bg-card border border-border rounded-lg p-6">
              <ProjectInfo project={project} user={user} />
            </div>

            {/* Status Controls */}
            <div className="bg-card border border-border rounded-lg p-6">
              <StatusChangeForm 
                project={project} 
                user={user} 
                onStatusUpdated={handleStatusUpdated}
              />
            </div>
          </div>

          {/* Row 2: Full-width chronology */}
          <div className="bg-card border border-border rounded-lg p-6">
            <ProjectChronology project={project} />
          </div>
        </div>
      </div>
    </div>
  );
}