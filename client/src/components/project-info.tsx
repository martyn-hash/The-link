import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ProjectWithRelations, User } from "@shared/schema";

interface ProjectInfoProps {
  project: ProjectWithRelations;
  user: User;
}

interface ServiceRolesResponse {
  bookkeeper: User | null;
  clientManager: User | null;
  serviceOwner: User | null;
}

// Helper function to format stage names for display
const formatStageName = (stageName: string): string => {
  return stageName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getCurrentTimeInStage = (project: ProjectWithRelations) => {
  const lastEntry = project.chronology?.[0];
  if (!lastEntry || !lastEntry.timestamp) return "0h";
  
  const timeDiff = Date.now() - new Date(lastEntry.timestamp).getTime();
  const hours = Math.floor(timeDiff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h`;
};

export default function ProjectInfo({ project, user }: ProjectInfoProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current service roles for this project
  const { data: serviceRoles, isLoading: isLoadingServiceRoles } = useQuery<ServiceRolesResponse>({
    queryKey: ['/api/projects', project.id, 'service-roles'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${project.id}/service-roles`);
      if (!response.ok) throw new Error('Failed to fetch service roles');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Check if user has permission to modify projects
  const canModifyProject = () => {
    return (
      user.role === 'admin' ||
      user.role === 'manager' ||
      project.currentAssigneeId === user.id ||
      (user.role === 'client_manager' && project.clientManagerId === user.id) ||
      (user.role === 'bookkeeper' && project.bookkeeperId === user.id)
    );
  };

  // Mutation for updating project inactive status
  const updateProjectMutation = useMutation({
    mutationFn: async (inactive: boolean) => {
      return await apiRequest("PATCH", `/api/projects/${project.id}`, {
        inactive
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Project ${project.inactive ? 'activated' : 'deactivated'} successfully`,
      });
      // Invalidate queries to refresh the project data
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update project status",
        variant: "destructive",
      });
    },
  });

  const handleInactiveToggle = (checked: boolean) => {
    updateProjectMutation.mutate(checked);
  };

  return (
    <div className="space-y-6">
      {/* Progress Metrics Section - Row 1, Column 1 */}
      {project.progressMetrics && project.progressMetrics.length > 0 && (
        <div>
          <h4 className="font-semibold text-foreground mb-4">Progress Metrics</h4>
          <div className="space-y-3">
            {project.progressMetrics.map((metric) => (
              <div key={metric.reasonId} className="flex justify-between">
                <span className="text-muted-foreground">{metric.label}:</span>
                <span className="font-medium" data-testid={`text-progress-metric-${metric.reasonId}`}>
                  {metric.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project Details Section */}
      <div>
        <h4 className="font-semibold text-foreground mb-4">Project Details</h4>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bookkeeper:</span>
            {isLoadingServiceRoles ? (
              <span className="font-medium">Loading...</span>
            ) : serviceRoles?.bookkeeper ? (
              <span className="font-medium">
                {serviceRoles.bookkeeper.firstName} {serviceRoles.bookkeeper.lastName}
              </span>
            ) : (
              <span className="font-medium text-muted-foreground">Not assigned</span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Client Manager:</span>
            {isLoadingServiceRoles ? (
              <span className="font-medium">Loading...</span>
            ) : serviceRoles?.clientManager ? (
              <span className="font-medium">
                {serviceRoles.clientManager.firstName} {serviceRoles.clientManager.lastName}
              </span>
            ) : (
              <span className="font-medium text-muted-foreground">Not assigned</span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Service Owner:</span>
            {isLoadingServiceRoles ? (
              <span className="font-medium">Loading...</span>
            ) : serviceRoles?.serviceOwner ? (
              <span className="font-medium" data-testid="text-service-owner">
                {serviceRoles.serviceOwner.firstName} {serviceRoles.serviceOwner.lastName}
              </span>
            ) : (
              <span className="font-medium text-muted-foreground" data-testid="text-service-owner-none">
                Not assigned
              </span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Time in Current Stage:</span>
            <span className="font-medium" data-testid="text-time-in-stage">
              {getCurrentTimeInStage(project)}
            </span>
          </div>
          {canModifyProject() && (
            <div className="flex justify-between items-center">
              <Label 
                htmlFor="inactive-toggle" 
                className="text-muted-foreground cursor-pointer"
              >
                Mark as Inactive:
              </Label>
              <Switch
                id="inactive-toggle"
                checked={project.inactive || false}
                onCheckedChange={handleInactiveToggle}
                disabled={updateProjectMutation.isPending}
                data-testid="switch-inactive-project"
                className="ml-2"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}