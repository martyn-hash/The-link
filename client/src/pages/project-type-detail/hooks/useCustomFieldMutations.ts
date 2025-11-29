import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";

interface CustomFieldMutationCallbacks {
  onFieldCreated?: () => void;
  onFieldUpdated?: () => void;
  onFieldDeleted?: () => void;
}

export function useCustomFieldMutations(
  callbacks: CustomFieldMutationCallbacks = {}
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateFields = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/config/custom-fields"] });
  };

  const createCustomFieldMutation = useMutation({
    mutationFn: async (field: any) => {
      return await apiRequest("POST", "/api/config/custom-fields", field);
    },
    onSuccess: async () => {
      await invalidateFields();
      toast({
        title: "Success",
        description: "Custom field added successfully",
      });
      callbacks.onFieldCreated?.();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const updateCustomFieldMutation = useMutation({
    mutationFn: async ({ id, ...field }: any) => {
      return await apiRequest("PATCH", `/api/config/custom-fields/${id}`, field);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/custom-fields"] });
      callbacks.onFieldUpdated?.();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const deleteCustomFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/config/custom-fields/${id}`);
    },
    onSuccess: async () => {
      await invalidateFields();
      toast({
        title: "Success",
        description: "Custom field deleted successfully",
      });
      callbacks.onFieldDeleted?.();
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  return {
    createCustomFieldMutation,
    updateCustomFieldMutation,
    deleteCustomFieldMutation,
  };
}
