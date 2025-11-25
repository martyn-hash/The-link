import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { EditingStage } from "../utils/types";

interface StageMutationCallbacks {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useStageMutations(
  projectTypeId: string | undefined,
  callbacks: StageMutationCallbacks = {}
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = callbacks;

  const invalidateStages = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "stages"] });
  };

  const createStageMutation = useMutation({
    mutationFn: async (stage: Omit<EditingStage, 'id'>) => {
      if (!projectTypeId) throw new Error("No project type selected");
      return await apiRequest("POST", "/api/config/stages", { ...stage, projectTypeId });
    },
    onSuccess: () => {
      invalidateStages();
      onSuccess?.();
    },
    onError: (error: Error) => onError?.(error),
  });

  const updateStageMutation = useMutation({
    mutationFn: async (stage: EditingStage) => {
      if (!stage.id) throw new Error("Stage ID is required");
      return await apiRequest("PATCH", `/api/config/stages/${stage.id}`, stage);
    },
    onSuccess: () => {
      invalidateStages();
      onSuccess?.();
    },
    onError: (error: Error) => onError?.(error),
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (stageId: string) => {
      return await apiRequest("DELETE", `/api/config/stages/${stageId}`);
    },
    onSuccess: () => {
      invalidateStages();
      onSuccess?.();
    },
    onError: (error: Error) => onError?.(error),
  });

  return {
    createStageMutation,
    updateStageMutation,
    deleteStageMutation,
  };
}
