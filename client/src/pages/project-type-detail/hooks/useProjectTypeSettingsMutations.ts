import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ProjectTypeSettingsCallbacks {
  onServiceLinkageUpdated?: () => void;
  onNotificationsActiveUpdated?: () => void;
  onActiveStatusUpdated?: () => void;
  onSingleProjectUpdated?: () => void;
}

export function useProjectTypeSettingsMutations(
  projectTypeId: string | undefined,
  callbacks: ProjectTypeSettingsCallbacks = {}
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateProjectType = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/config/project-types"] });
    queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId] });
  };

  const updateProjectTypeServiceLinkageMutation = useMutation({
    mutationFn: async (serviceId: string | null) => {
      if (!projectTypeId) throw new Error("No project type selected");
      return await apiRequest("PATCH", `/api/config/project-types/${projectTypeId}`, { 
        serviceId: serviceId 
      });
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Service linkage updated successfully. Please review your stage assignments." 
      });
      invalidateProjectType();
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "roles"] });
      callbacks.onServiceLinkageUpdated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update service linkage",
        variant: "destructive",
      });
    },
  });

  const toggleNotificationsActiveMutation = useMutation({
    mutationFn: async (notificationsActive: boolean) => {
      if (!projectTypeId) throw new Error("No project type selected");
      return await apiRequest("PATCH", `/api/config/project-types/${projectTypeId}`, { 
        notificationsActive 
      });
    },
    onSuccess: () => {
      invalidateProjectType();
      toast({ 
        title: "Success", 
        description: "Notifications setting updated successfully" 
      });
      callbacks.onNotificationsActiveUpdated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update notifications setting",
        variant: "destructive",
      });
    },
  });

  const updateProjectTypeActiveMutation = useMutation({
    mutationFn: async (active: boolean) => {
      if (!projectTypeId) throw new Error("No project type ID");
      return await apiRequest("PATCH", `/api/config/project-types/${projectTypeId}`, {
        active
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Project type status updated successfully",
      });
      invalidateProjectType();
      callbacks.onActiveStatusUpdated?.();
    },
    onError: (error: any) => {
      if (error.status === 409 && error.code === "PROJECTS_USING_TYPE") {
        toast({
          title: "Cannot Deactivate Project Type",
          description: error.message,
          variant: "destructive",
        });
      } else if (error.status === 400 && error.code === "NO_FINAL_STAGE") {
        toast({
          title: "Cannot Activate Project Type",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to update project type status",
          variant: "destructive",
        });
      }
    },
  });

  const updateProjectTypeSingleProjectMutation = useMutation({
    mutationFn: async (singleProjectPerClient: boolean) => {
      if (!projectTypeId) throw new Error("No project type ID");
      return await apiRequest("PATCH", `/api/config/project-types/${projectTypeId}`, {
        singleProjectPerClient
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Project type setting updated successfully",
      });
      invalidateProjectType();
      callbacks.onSingleProjectUpdated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update project type setting",
        variant: "destructive",
      });
    },
  });

  return {
    updateProjectTypeServiceLinkageMutation,
    toggleNotificationsActiveMutation,
    updateProjectTypeActiveMutation,
    updateProjectTypeSingleProjectMutation,
  };
}
