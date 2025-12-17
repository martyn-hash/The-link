import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import type { EditingStage } from "../utils/types";

interface StageMutationCallbacks {
  onStageCreated?: () => void;
  onStageUpdated?: () => void;
  onStageDeleted?: () => void;
  onStagesReordered?: () => void;
}

export function useStageMutations(
  projectTypeId: string | undefined,
  callbacks: StageMutationCallbacks = {}
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateStages = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "stages"] });
  };

  const createStageMutation = useMutation({
    mutationFn: async (stage: Omit<EditingStage, 'id'>) => {
      if (!projectTypeId) throw new Error("No project type selected");
      return await apiRequest("POST", "/api/config/stages", { ...stage, projectTypeId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage created successfully" });
      invalidateStages();
      callbacks.onStageCreated?.();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      return await apiRequest("PATCH", `/api/config/stages/${id}`, data);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/config/project-types", projectTypeId, "stages"] });
      const previousStages = queryClient.getQueryData(["/api/config/project-types", projectTypeId, "stages"]) as any[] | undefined;
      
      if (previousStages) {
        const updatedStages = previousStages.map(stage => 
          stage.id === id ? { ...stage, ...data } : stage
        );
        queryClient.setQueryData(["/api/config/project-types", projectTypeId, "stages"], updatedStages);
      }
      
      return { previousStages };
    },
    onSuccess: (response, { id, data }) => {
      toast({ title: "Success", description: "Stage updated successfully" });
      queryClient.setQueryData(["/api/config/project-types", projectTypeId, "stages"], (old: any[] | undefined) => {
        if (!old) return old;
        return old.map(stage => stage.id === id ? { ...stage, ...data, ...(response || {}) } : stage);
      });
      callbacks.onStageUpdated?.();
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousStages) {
        queryClient.setQueryData(["/api/config/project-types", projectTypeId, "stages"], context.previousStages);
      }
      showFriendlyError({ error });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/config/stages/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage deleted successfully" });
      invalidateStages();
      callbacks.onStageDeleted?.();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const reorderStagesMutation = useMutation({
    mutationFn: async ({ updates }: { updates: Array<{ id: string; order: number }>; orderedIds: string[] }) => {
      await Promise.all(
        updates.map(({ id, order }) => 
          apiRequest("PATCH", `/api/config/stages/${id}`, { order })
        )
      );
    },
    onMutate: async ({ updates, orderedIds }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/config/project-types", projectTypeId, "stages"] });
      const previousStages = queryClient.getQueryData(["/api/config/project-types", projectTypeId, "stages"]) as any[] | undefined;
      
      if (previousStages) {
        const orderMap = new Map(updates.map(s => [s.id, s.order]));
        const stageMap = new Map(previousStages.map(s => [s.id, s]));
        const reorderedStages = orderedIds.map(id => {
          const stage = stageMap.get(id);
          const newOrder = orderMap.get(id);
          return stage ? { ...stage, order: newOrder ?? stage.order } : null;
        }).filter(Boolean);
        
        queryClient.setQueryData(["/api/config/project-types", projectTypeId, "stages"], reorderedStages);
      }
      
      return { previousStages };
    },
    onSuccess: () => {
      invalidateStages();
      callbacks.onStagesReordered?.();
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousStages) {
        queryClient.setQueryData(["/api/config/project-types", projectTypeId, "stages"], context.previousStages);
      }
      showFriendlyError({ error });
    },
  });

  return {
    createStageMutation,
    updateStageMutation,
    deleteStageMutation,
    reorderStagesMutation,
  };
}
