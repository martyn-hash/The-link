import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import type { DialoraSettings } from "@shared/schema";

interface ProjectTypeSettingsCallbacks {
  onServiceLinkageUpdated?: () => void;
  onNotificationsActiveUpdated?: () => void;
  onActiveStatusUpdated?: () => void;
  onSingleProjectUpdated?: () => void;
  onDialoraSettingsUpdated?: () => void;
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
      showFriendlyError({ error });
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
      showFriendlyError({ error });
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
      showFriendlyError({ error });
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
      showFriendlyError({ error });
    },
  });

  const updateDialoraSettingsMutation = useMutation({
    mutationFn: async (dialoraSettings: DialoraSettings) => {
      if (!projectTypeId) throw new Error("No project type ID");
      return await apiRequest("PATCH", `/api/config/project-types/${projectTypeId}`, {
        dialoraSettings
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Voice AI settings updated successfully",
      });
      invalidateProjectType();
      callbacks.onDialoraSettingsUpdated?.();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  return {
    updateProjectTypeServiceLinkageMutation,
    toggleNotificationsActiveMutation,
    updateProjectTypeActiveMutation,
    updateProjectTypeSingleProjectMutation,
    updateDialoraSettingsMutation,
  };
}
