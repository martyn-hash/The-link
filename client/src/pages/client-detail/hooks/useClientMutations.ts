import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import type { UpdatePersonData, InsertPersonData } from "../utils/types";

export interface UseClientMutationsCallbacks {
  onPersonUpdated?: () => void;
  onPersonCreated?: () => void;
  onDocumentDeleted?: () => void;
}

export function useClientMutations(
  clientId: string | undefined,
  callbacks: UseClientMutationsCallbacks = {}
) {
  const { toast } = useToast();

  const updatePersonMutation = useMutation({
    mutationFn: async ({ personId, data }: { personId: string; data: UpdatePersonData }) => {
      return await apiRequest("PATCH", `/api/people/${personId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'people'] });
      callbacks.onPersonUpdated?.();
      toast({
        title: "Success",
        description: "Person details updated successfully",
      });
    },
    onError: (error: any) => {
      showFriendlyError({
        error,
        fallbackTitle: "Couldn't Update Person",
        fallbackDescription: "Something went wrong while updating the person details. Please check the information and try again."
      });
    },
  });

  const createPersonMutation = useMutation({
    mutationFn: async (data: InsertPersonData) => {
      return await apiRequest("POST", `/api/clients/${clientId}/people`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'people'] });
      callbacks.onPersonCreated?.();
      toast({
        title: "Success",
        description: "Person added successfully",
      });
    },
    onError: (error: any) => {
      showFriendlyError({
        error,
        fallbackTitle: "Couldn't Add Person",
        fallbackDescription: "Something went wrong while adding the person. Please check the information and try again."
      });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return await apiRequest('DELETE', `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'documents'] });
      callbacks.onDocumentDeleted?.();
      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });
    },
    onError: (error: any) => {
      showFriendlyError({
        error,
        fallbackTitle: "Couldn't Delete Document",
        fallbackDescription: "Something went wrong while deleting the document. It may still be in use or connected to other items."
      });
    },
  });

  return {
    updatePersonMutation,
    createPersonMutation,
    deleteDocumentMutation,
  };
}
