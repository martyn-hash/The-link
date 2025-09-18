import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Edit2, Trash2, Save, X } from "lucide-react";
import type { KanbanStage, ChangeReason } from "@shared/schema";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EditingStage {
  id?: string;
  name: string;
  assignedRole: string;
  order: number;
  color: string;
}

interface EditingReason {
  id?: string;
  reason: string;
  description: string;
}

const DEFAULT_STAGE: EditingStage = {
  name: "",
  assignedRole: "client_manager",
  order: 0,
  color: "#6b7280",
};

const DEFAULT_REASON: EditingReason = {
  reason: "",
  description: "",
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "client_manager", label: "Client Manager" },
  { value: "bookkeeper", label: "Bookkeeper" },
];


// Note: REASON_OPTIONS removed - now using custom text input like kanban stages

const STAGE_COLORS = [
  "#6b7280", "#ef4444", "#f97316", "#eab308", 
  "#22c55e", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"
];

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [editingStage, setEditingStage] = useState<EditingStage | null>(null);
  const [editingReason, setEditingReason] = useState<EditingReason | null>(null);
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [isAddingReason, setIsAddingReason] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch stages
  const { data: stages, isLoading: stagesLoading } = useQuery<KanbanStage[]>({
    queryKey: ["/api/config/stages"],
    enabled: isOpen,
  });

  // Fetch change reasons
  const { data: reasons, isLoading: reasonsLoading } = useQuery<ChangeReason[]>({
    queryKey: ["/api/config/reasons"],
    enabled: isOpen,
  });

  // Stage mutations
  const createStageMutation = useMutation({
    mutationFn: async (stage: Omit<EditingStage, 'id'>) => {
      return await apiRequest("POST", "/api/config/stages", stage);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/stages"] });
      setIsAddingStage(false);
      setEditingStage(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create stage",
        variant: "destructive",
      });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, ...stage }: EditingStage) => {
      return await apiRequest("PATCH", `/api/config/stages/${id}`, stage);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/stages"] });
      setEditingStage(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update stage",
        variant: "destructive",
      });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/config/stages/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/stages"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete stage",
        variant: "destructive",
      });
    },
  });

  // Reason mutations
  const createReasonMutation = useMutation({
    mutationFn: async (reason: Omit<EditingReason, 'id'>) => {
      return await apiRequest("POST", "/api/config/reasons", reason);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Change reason created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/reasons"] });
      setIsAddingReason(false);
      setEditingReason(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create change reason",
        variant: "destructive",
      });
    },
  });

  const updateReasonMutation = useMutation({
    mutationFn: async ({ id, ...reason }: EditingReason) => {
      return await apiRequest("PATCH", `/api/config/reasons/${id}`, reason);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Change reason updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/reasons"] });
      setEditingReason(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update change reason",
        variant: "destructive",
      });
    },
  });

  const deleteReasonMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/config/reasons/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Change reason deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/reasons"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete change reason",
        variant: "destructive",
      });
    },
  });

  // Handle stage operations
  const handleSaveStage = () => {
    if (!editingStage) return;

    if (!editingStage.name) {
      toast({
        title: "Validation Error",
        description: "Please enter a stage name",
        variant: "destructive",
      });
      return;
    }

    if (editingStage.id) {
      updateStageMutation.mutate(editingStage);
    } else {
      const { id, ...stageData } = editingStage;
      createStageMutation.mutate(stageData);
    }
  };

  const handleEditStage = (stage: KanbanStage) => {
    setEditingStage({
      id: stage.id,
      name: stage.name,
      assignedRole: stage.assignedRole || "client_manager",
      order: stage.order,
      color: stage.color || "#6b7280",
    });
    setIsAddingStage(false);
  };

  const handleAddStage = () => {
    const nextOrder = Math.max(0, ...(stages?.map(s => s.order) || [])) + 1;
    setEditingStage({ ...DEFAULT_STAGE, order: nextOrder });
    setIsAddingStage(true);
  };

  // Handle reason operations
  const handleSaveReason = () => {
    if (!editingReason) return;

    if (!editingReason.reason) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (editingReason.id) {
      updateReasonMutation.mutate(editingReason);
    } else {
      const { id, ...reasonData } = editingReason;
      createReasonMutation.mutate(reasonData);
    }
  };

  const handleEditReason = (reason: ChangeReason) => {
    setEditingReason({
      id: reason.id,
      reason: reason.reason,
      description: reason.description || "",
    });
    setIsAddingReason(false);
  };

  const handleAddReason = () => {
    setEditingReason({ ...DEFAULT_REASON });
    setIsAddingReason(true);
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEditingStage(null);
      setEditingReason(null);
      setIsAddingStage(false);
      setIsAddingReason(false);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden" data-testid="settings-modal">
        <DialogHeader>
          <DialogTitle>System Settings</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
          {/* Kanban Stages Configuration */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-foreground">Kanban Stages</h4>
              <Button
                onClick={handleAddStage}
                size="sm"
                data-testid="button-add-stage"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Stage
              </Button>
            </div>

            <ScrollArea className="h-96">
              <div className="space-y-3">
                {stagesLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : (
                  stages?.map((stage) => (
                    <Card key={stage.id} className="bg-background">
                      <CardContent className="p-4">
                        {editingStage?.id === stage.id ? (
                          <div className="space-y-3">
                            <div>
                              <Label htmlFor="stage-name">Stage Name</Label>
                              <Input
                                id="stage-name"
                                value={editingStage.name}
                                onChange={(e) => setEditingStage({
                                  ...editingStage,
                                  name: e.target.value
                                })}
                                data-testid="input-stage-name"
                              />
                            </div>
                            

                            <div>
                              <Label htmlFor="stage-role">Assigned Role</Label>
                              <select
                                id="stage-role"
                                value={editingStage.assignedRole}
                                onChange={(e) => setEditingStage({
                                  ...editingStage,
                                  assignedRole: e.target.value
                                })}
                                className="w-full px-3 py-2 bg-background border border-input rounded-md"
                                data-testid="select-stage-role"
                              >
                                {ROLE_OPTIONS.map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <Label htmlFor="stage-color">Color</Label>
                              <div className="flex space-x-2 mt-2">
                                {STAGE_COLORS.map(color => (
                                  <button
                                    key={color}
                                    type="button"
                                    onClick={() => setEditingStage({
                                      ...editingStage,
                                      color
                                    })}
                                    className={`w-6 h-6 rounded-full border-2 ${
                                      editingStage.color === color ? 'border-foreground' : 'border-border'
                                    }`}
                                    style={{ backgroundColor: color }}
                                    data-testid={`color-${color}`}
                                  />
                                ))}
                              </div>
                            </div>

                            <div className="flex space-x-2">
                              <Button
                                onClick={handleSaveStage}
                                size="sm"
                                disabled={updateStageMutation.isPending}
                                data-testid="button-save-stage"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                Save
                              </Button>
                              <Button
                                onClick={() => setEditingStage(null)}
                                variant="outline"
                                size="sm"
                                data-testid="button-cancel-stage"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <div 
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: stage.color || "#6b7280" }}
                                />
                                <span className="font-medium">{stage.name}</span>
                                <Badge variant="secondary" className="text-xs">
                                  Order: {stage.order}
                                </Badge>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  onClick={() => handleEditStage(stage)}
                                  variant="ghost"
                                  size="sm"
                                  data-testid={`button-edit-stage-${stage.id}`}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  onClick={() => deleteStageMutation.mutate(stage.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  data-testid={`button-delete-stage-${stage.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Assigned to {ROLE_OPTIONS.find(r => r.value === stage.assignedRole)?.label}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}

                {/* Add new stage form */}
                {isAddingStage && editingStage && !editingStage.id && (
                  <Card className="bg-background border-dashed">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="new-stage-name">Stage Name</Label>
                          <Input
                            id="new-stage-name"
                            value={editingStage.name}
                            onChange={(e) => setEditingStage({
                              ...editingStage,
                              name: e.target.value
                            })}
                            placeholder="Enter stage name..."
                            data-testid="input-new-stage-name"
                          />
                        </div>
                        

                        <div className="flex space-x-2">
                          <Button
                            onClick={handleSaveStage}
                            size="sm"
                            disabled={createStageMutation.isPending}
                            data-testid="button-create-stage"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Create
                          </Button>
                          <Button
                            onClick={() => {
                              setIsAddingStage(false);
                              setEditingStage(null);
                            }}
                            variant="outline"
                            size="sm"
                            data-testid="button-cancel-new-stage"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Change Reasons Configuration */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-foreground">Change Reasons</h4>
              <Button
                onClick={handleAddReason}
                size="sm"
                data-testid="button-add-reason"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Reason
              </Button>
            </div>

            <ScrollArea className="h-96">
              <div className="space-y-3">
                {reasonsLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : (
                  reasons?.map((reason) => (
                    <Card key={reason.id} className="bg-background">
                      <CardContent className="p-4">
                        {editingReason?.id === reason.id ? (
                          <div className="space-y-3">
                            <div>
                              <Label htmlFor="reason-name">Reason Name</Label>
                              <Input
                                id="reason-name"
                                value={editingReason.reason}
                                onChange={(e) => setEditingReason({
                                  ...editingReason,
                                  reason: e.target.value
                                })}
                                data-testid="input-reason-name"
                                placeholder="Enter reason name (e.g., 'Document Review Required')"
                                className="w-full"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="reason-description">Description (Optional)</Label>
                              <Input
                                id="reason-description"
                                value={editingReason.description}
                                onChange={(e) => setEditingReason({
                                  ...editingReason,
                                  description: e.target.value
                                })}
                                placeholder="Enter description..."
                                data-testid="input-reason-description"
                              />
                            </div>

                            <div className="flex space-x-2">
                              <Button
                                onClick={handleSaveReason}
                                size="sm"
                                disabled={updateReasonMutation.isPending}
                                data-testid="button-save-reason"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                Save
                              </Button>
                              <Button
                                onClick={() => setEditingReason(null)}
                                variant="outline"
                                size="sm"
                                data-testid="button-cancel-reason"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-medium">
                                {reason.reason}
                              </span>
                              <div className="flex items-center space-x-2">
                                <Button
                                  onClick={() => handleEditReason(reason)}
                                  variant="ghost"
                                  size="sm"
                                  data-testid={`button-edit-reason-${reason.id}`}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  onClick={() => deleteReasonMutation.mutate(reason.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  data-testid={`button-delete-reason-${reason.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            {reason.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {reason.description}
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}

                {/* Add new reason form */}
                {isAddingReason && editingReason && !editingReason.id && (
                  <Card className="bg-background border-dashed">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="new-reason-name">Reason Name</Label>
                          <Input
                            id="new-reason-name"
                            value={editingReason.reason}
                            onChange={(e) => setEditingReason({
                              ...editingReason,
                              reason: e.target.value
                            })}
                            data-testid="input-new-reason-name"
                            placeholder="Enter reason name (e.g., 'Document Review Required')"
                            className="w-full"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="new-reason-description">Description (Optional)</Label>
                          <Input
                            id="new-reason-description"
                            value={editingReason.description}
                            onChange={(e) => setEditingReason({
                              ...editingReason,
                              description: e.target.value
                            })}
                            placeholder="Enter description..."
                            data-testid="input-new-reason-description"
                          />
                        </div>

                        <div className="flex space-x-2">
                          <Button
                            onClick={handleSaveReason}
                            size="sm"
                            disabled={createReasonMutation.isPending}
                            data-testid="button-create-reason"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Create
                          </Button>
                          <Button
                            onClick={() => {
                              setIsAddingReason(false);
                              setEditingReason(null);
                            }}
                            variant="outline"
                            size="sm"
                            data-testid="button-cancel-new-reason"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
