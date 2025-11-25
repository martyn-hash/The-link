import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface StageReasonMapMutationCallbacks {
  onMappingCreated?: () => void;
  onMappingDeleted?: () => void;
}

export function useStageReasonMapMutations(
  callbacks: StageReasonMapMutationCallbacks = {}
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateMaps = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/config/stage-reason-maps"] });
  };

  const createStageReasonMapMutation = useMutation({
    mutationFn: async ({ stageId, reasonId }: { stageId: string; reasonId: string }) => {
      return await apiRequest("POST", "/api/config/stage-reason-maps", { stageId, reasonId });
    },
    onSuccess: () => {
      invalidateMaps();
      callbacks.onMappingCreated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create stage-reason mapping",
        variant: "destructive",
      });
    },
  });

  const deleteStageReasonMapMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/config/stage-reason-maps/${id}`);
    },
    onSuccess: () => {
      invalidateMaps();
      callbacks.onMappingDeleted?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete stage-reason mapping",
        variant: "destructive",
      });
    },
  });

  return {
    createStageReasonMapMutation,
    deleteStageReasonMapMutation,
  };
}
