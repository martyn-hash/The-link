import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ClientTag, PeopleTag } from "@shared/schema";

interface TagManagerProps {
  entityId: string;
  entityType: "client" | "person";
  className?: string;
}

export default function TagManager({ entityId, entityType, className }: TagManagerProps) {
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const { toast } = useToast();

  // Fetch assigned tags
  const { data: assignedTags = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/${entityType === "client" ? "clients" : "people"}/${entityId}/tags`],
  });

  // Fetch available tags for assignment
  const { data: availableTags = [] } = useQuery<ClientTag[] | PeopleTag[]>({
    queryKey: [`/api/${entityType === "client" ? "client" : "people"}-tags`],
  });

  // Assign tag mutation
  const assignMutation = useMutation({
    mutationFn: async (tagId: string) => {
      return apiRequest(
        "POST", 
        `/api/${entityType === "client" ? "clients" : "people"}/${entityId}/tags`,
        { tagId }
      );
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Tag assigned successfully",
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/${entityType === "client" ? "clients" : "people"}/${entityId}/tags`] 
      });
      setAssignDialogOpen(false);
      setSelectedTagId("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign tag",
        variant: "destructive",
      });
    },
  });

  // Unassign tag mutation
  const unassignMutation = useMutation({
    mutationFn: async (tagId: string) => {
      return apiRequest(
        "DELETE", 
        `/api/${entityType === "client" ? "clients" : "people"}/${entityId}/tags/${tagId}`
      );
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Tag removed successfully",
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/${entityType === "client" ? "clients" : "people"}/${entityId}/tags`] 
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove tag",
        variant: "destructive",
      });
    },
  });

  const handleAssignTag = () => {
    if (selectedTagId) {
      assignMutation.mutate(selectedTagId);
    }
  };

  const handleUnassignTag = (tagId: string) => {
    if (confirm("Are you sure you want to remove this tag?")) {
      unassignMutation.mutate(tagId);
    }
  };

  // Get tags that are not already assigned
  const unassignedTags = availableTags.filter(
    (tag) => !assignedTags.some((assigned: any) => assigned.tagId === tag.id)
  );

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading tags...</div>;
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 flex-wrap">
        {assignedTags.map((assignment: any) => (
          <Badge
            key={assignment.id}
            style={{ backgroundColor: assignment.tag.color }}
            className="text-white flex items-center gap-1"
            data-testid={`tag-${assignment.tag.name}`}
          >
            {assignment.tag.name}
            <button
              onClick={() => handleUnassignTag(assignment.tagId)}
              className="ml-1 hover:bg-black/20 rounded-full p-0.5"
              data-testid={`remove-tag-${assignment.tag.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        
        {unassignedTags.length > 0 && (
          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                data-testid="button-add-tag"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Tag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Assign {entityType === "client" ? "Client" : "Person"} Tag
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Select Tag</label>
                  <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                    <SelectTrigger data-testid="select-tag">
                      <SelectValue placeholder="Choose a tag to assign" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedTags.map((tag) => (
                        <SelectItem key={tag.id} value={tag.id} data-testid={`option-${tag.name}`}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                            {tag.description && (
                              <span className="text-muted-foreground text-xs">
                                - {tag.description}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setAssignDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAssignTag}
                    disabled={!selectedTagId || assignMutation.isPending}
                    data-testid="button-assign-tag"
                  >
                    {assignMutation.isPending ? "Assigning..." : "Assign Tag"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}