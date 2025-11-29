import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";

interface StageReasonMapMutationCallbacks {
  onMappingCreated?: () => void;
  onMappingDeleted?: () => void;
}

export function useStageReasonMapMutations(
  callbacks: StageReasonMapMutationCallbacks = {}
) {
  const queryClient = useQueryClient();

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
      showFriendlyError({ error });
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
      showFriendlyError({ error });
    },
  });

  return {
    createStageReasonMapMutation,
    deleteStageReasonMapMutation,
  };
}
