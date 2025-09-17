import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit2, Trash2, Save, X, Settings } from "lucide-react";
import type { KanbanStage, ChangeReason, ProjectDescription } from "@shared/schema";

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

interface EditingDescription {
  id?: string;
  name: string;
  active: boolean;
  order: number;
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

const DEFAULT_DESCRIPTION: EditingDescription = {
  name: "",
  active: true,
  order: 0,
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "client_manager", label: "Client Manager" },
  { value: "bookkeeper", label: "Bookkeeper" },
];

const REASON_OPTIONS = [
  { value: "first_allocation_of_work", label: "First Allocation of Work" },
  { value: "errors_identified_from_bookkeeper", label: "Errors identified from Bookkeeper" },
  { value: "queries_answered", label: "Queries Answered" },
  { value: "work_completed_successfully", label: "Work Completed Successfully" },
  { value: "clarifications_needed", label: "Clarifications Needed" },
];

const STAGE_COLORS = [
  "#6b7280", "#ef4444", "#f97316", "#eab308", 
  "#22c55e", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"
];

export default function SettingsPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [editingStage, setEditingStage] = useState<EditingStage | null>(null);
  const [editingReason, setEditingReason] = useState<EditingReason | null>(null);
  const [editingDescription, setEditingDescription] = useState<EditingDescription | null>(null);
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [isAddingReason, setIsAddingReason] = useState(false);
  const [isAddingDescription, setIsAddingDescription] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch stages
  const { data: stages, isLoading: stagesLoading } = useQuery<KanbanStage[]>({
    queryKey: ["/api/config/stages"],
  });

  // Fetch change reasons
  const { data: reasons, isLoading: reasonsLoading } = useQuery<ChangeReason[]>({
    queryKey: ["/api/config/reasons"],
  });

  // Fetch project descriptions
  const { data: descriptions, isLoading: descriptionsLoading } = useQuery<ProjectDescription[]>({
    queryKey: ["/api/config/project-descriptions"],
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
      let errorTitle = "Error";
      let errorDescription = "Failed to update stage";
      
      // Handle specific error cases
      if (error.status === 409 || error.code === "STAGE_IN_USE") {
        errorTitle = "Cannot Rename Stage";
        errorDescription = error.message || "This stage cannot be renamed because it has projects assigned to it. Move all projects to other stages first.";
      } else if (error.status === 404) {
        errorTitle = "Stage Not Found";
        errorDescription = "The stage you're trying to update no longer exists.";
      } else if (error.message) {
        errorDescription = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
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
      let errorTitle = "Error";
      let errorDescription = "Failed to delete stage";
      
      // Handle specific error cases
      if (error.status === 409 || error.code === "STAGE_IN_USE") {
        errorTitle = "Cannot Delete Stage";
        errorDescription = error.message || "This stage cannot be deleted because it has projects assigned to it. Move all projects to other stages first.";
      } else if (error.status === 404) {
        errorTitle = "Stage Not Found";
        errorDescription = "The stage you're trying to delete no longer exists.";
      } else if (error.message) {
        errorDescription = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    },
  });

  // Description mutations
  const createDescriptionMutation = useMutation({
    mutationFn: async (description: Omit<EditingDescription, 'id'>) => {
      return await apiRequest("POST", "/api/config/project-descriptions", description);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Description created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-descriptions"] });
      setIsAddingDescription(false);
      setEditingDescription(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create description",
        variant: "destructive",
      });
    },
  });

  const updateDescriptionMutation = useMutation({
    mutationFn: async ({ id, ...description }: EditingDescription) => {
      return await apiRequest("PATCH", `/api/config/project-descriptions/${id}`, description);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Description updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-descriptions"] });
      setEditingDescription(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update description",
        variant: "destructive",
      });
    },
  });

  const deleteDescriptionMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/config/project-descriptions/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Description deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-descriptions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete description",
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
      toast({ title: "Success", description: "Reason created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/reasons"] });
      setIsAddingReason(false);
      setEditingReason(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create reason",
        variant: "destructive",
      });
    },
  });

  const updateReasonMutation = useMutation({
    mutationFn: async ({ id, ...reason }: EditingReason) => {
      return await apiRequest("PATCH", `/api/config/reasons/${id}`, reason);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Reason updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/reasons"] });
      setEditingReason(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update reason",
        variant: "destructive",
      });
    },
  });

  const deleteReasonMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/config/reasons/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Reason deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/reasons"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete reason",
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

  // Handle description operations
  const handleSaveDescription = () => {
    if (!editingDescription) return;

    if (!editingDescription.name) {
      toast({
        title: "Validation Error",
        description: "Please enter a description name",
        variant: "destructive",
      });
      return;
    }

    if (editingDescription.id) {
      updateDescriptionMutation.mutate(editingDescription);
    } else {
      const { id, ...descriptionData } = editingDescription;
      createDescriptionMutation.mutate(descriptionData);
    }
  };

  const handleEditDescription = (description: ProjectDescription) => {
    setEditingDescription({
      id: description.id,
      name: description.name,
      active: description.active ?? true,
      order: description.order,
    });
    setIsAddingDescription(false);
  };

  const handleAddDescription = () => {
    const nextOrder = Math.max(0, ...(descriptions?.map(d => d.order) || [])) + 1;
    setEditingDescription({ ...DEFAULT_DESCRIPTION, order: nextOrder });
    setIsAddingDescription(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar user={user!} />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
                <Settings className="w-8 h-8" />
                Settings
              </h1>
              <p className="text-muted-foreground mt-2">
                Configure kanban stages, change reasons, and project descriptions for your workflow.
              </p>
            </div>
          </div>

          <Tabs defaultValue="stages" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="stages">Kanban Stages</TabsTrigger>
              <TabsTrigger value="reasons">Change Reasons</TabsTrigger>
              <TabsTrigger value="descriptions">Project Descriptions</TabsTrigger>
            </TabsList>
            
            <TabsContent value="stages" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Kanban Stages</h2>
                  <p className="text-muted-foreground">Manage the workflow stages for your projects.</p>
                </div>
                <Button
                  onClick={handleAddStage}
                  data-testid="button-add-stage"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Stage
                </Button>
              </div>

              <div className="grid gap-4">
                {stagesLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : (
                  stages?.map((stage) => (
                    <Card key={stage.id} className="bg-background">
                      <CardContent className="p-6">
                        {editingStage?.id === stage.id ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
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
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="stage-order">Order</Label>
                                <Input
                                  id="stage-order"
                                  type="number"
                                  value={editingStage.order}
                                  onChange={(e) => setEditingStage({
                                    ...editingStage,
                                    order: parseInt(e.target.value) || 0
                                  })}
                                  data-testid="input-stage-order"
                                />
                              </div>
                              
                              <div>
                                <Label>Color</Label>
                                <div className="flex gap-2 mt-2">
                                  {STAGE_COLORS.map(color => (
                                    <button
                                      key={color}
                                      type="button"
                                      className={`w-6 h-6 rounded-full border-2 ${
                                        editingStage.color === color ? 'border-foreground' : 'border-transparent'
                                      }`}
                                      style={{ backgroundColor: color }}
                                      onClick={() => setEditingStage({
                                        ...editingStage,
                                        color
                                      })}
                                      data-testid={`color-${color}`}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                onClick={handleSaveStage}
                                disabled={createStageMutation.isPending || updateStageMutation.isPending}
                                data-testid="button-save-stage"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                Save
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditingStage(null);
                                  setIsAddingStage(false);
                                }}
                                data-testid="button-cancel-stage"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div 
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: stage.color || "#6b7280" }}
                              />
                              <div>
                                <h3 className="font-medium">{stage.name}</h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Badge variant="outline">
                                    {ROLE_OPTIONS.find(r => r.value === stage.assignedRole)?.label || stage.assignedRole}
                                  </Badge>
                                  <span>Order: {stage.order}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditStage(stage)}
                                data-testid={`button-edit-stage-${stage.id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteStageMutation.mutate(stage.id)}
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-delete-stage-${stage.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}

                {/* Add new stage form */}
                {isAddingStage && editingStage && !editingStage.id && (
                  <Card className="bg-background border-dashed">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="new-stage-name">Stage Name</Label>
                            <Input
                              id="new-stage-name"
                              value={editingStage.name}
                              onChange={(e) => setEditingStage({
                                ...editingStage,
                                name: e.target.value
                              })}
                              data-testid="input-new-stage-name"
                              placeholder="Enter stage name"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="new-stage-role">Assigned Role</Label>
                            <select
                              id="new-stage-role"
                              value={editingStage.assignedRole}
                              onChange={(e) => setEditingStage({
                                ...editingStage,
                                assignedRole: e.target.value
                              })}
                              className="w-full px-3 py-2 bg-background border border-input rounded-md"
                              data-testid="select-new-stage-role"
                            >
                              {ROLE_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="new-stage-order">Order</Label>
                            <Input
                              id="new-stage-order"
                              type="number"
                              value={editingStage.order}
                              onChange={(e) => setEditingStage({
                                ...editingStage,
                                order: parseInt(e.target.value) || 0
                              })}
                              data-testid="input-new-stage-order"
                            />
                          </div>
                          
                          <div>
                            <Label>Color</Label>
                            <div className="flex gap-2 mt-2">
                              {STAGE_COLORS.map(color => (
                                <button
                                  key={color}
                                  type="button"
                                  className={`w-6 h-6 rounded-full border-2 ${
                                    editingStage.color === color ? 'border-foreground' : 'border-transparent'
                                  }`}
                                  style={{ backgroundColor: color }}
                                  onClick={() => setEditingStage({
                                    ...editingStage,
                                    color
                                  })}
                                  data-testid={`new-color-${color}`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={handleSaveStage}
                            disabled={createStageMutation.isPending}
                            data-testid="button-create-stage"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Create Stage
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingStage(null);
                              setIsAddingStage(false);
                            }}
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
            </TabsContent>

            <TabsContent value="reasons" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Change Reasons</h2>
                  <p className="text-muted-foreground">Manage the reasons for status changes in your workflow.</p>
                </div>
                <Button
                  onClick={handleAddReason}
                  data-testid="button-add-reason"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Reason
                </Button>
              </div>

              <div className="grid gap-4">
                {reasonsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : (
                  reasons?.map((reason) => (
                    <Card key={reason.id} className="bg-background">
                      <CardContent className="p-6">
                        {editingReason?.id === reason.id ? (
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="reason-value">Reason Value</Label>
                              <select
                                id="reason-value"
                                value={editingReason.reason}
                                onChange={(e) => setEditingReason({
                                  ...editingReason,
                                  reason: e.target.value
                                })}
                                className="w-full px-3 py-2 bg-background border border-input rounded-md"
                                data-testid="select-reason-value"
                              >
                                <option value="">Select reason...</option>
                                {REASON_OPTIONS.map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
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
                                data-testid="input-reason-description"
                                placeholder="Enter description"
                              />
                            </div>

                            <div className="flex gap-2">
                              <Button
                                onClick={handleSaveReason}
                                disabled={createReasonMutation.isPending || updateReasonMutation.isPending}
                                data-testid="button-save-reason"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                Save
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditingReason(null);
                                  setIsAddingReason(false);
                                }}
                                data-testid="button-cancel-reason"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium">
                                {REASON_OPTIONS.find(r => r.value === reason.reason)?.label || reason.reason}
                              </h3>
                              {reason.description && (
                                <p className="text-sm text-muted-foreground mt-1">{reason.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditReason(reason)}
                                data-testid={`button-edit-reason-${reason.id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteReasonMutation.mutate(reason.id)}
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-delete-reason-${reason.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}

                {/* Add new reason form */}
                {isAddingReason && editingReason && !editingReason.id && (
                  <Card className="bg-background border-dashed">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="new-reason-value">Reason Value</Label>
                          <select
                            id="new-reason-value"
                            value={editingReason.reason}
                            onChange={(e) => setEditingReason({
                              ...editingReason,
                              reason: e.target.value
                            })}
                            className="w-full px-3 py-2 bg-background border border-input rounded-md"
                            data-testid="select-new-reason-value"
                          >
                            <option value="">Select reason...</option>
                            {REASON_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
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
                            data-testid="input-new-reason-description"
                            placeholder="Enter description"
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={handleSaveReason}
                            disabled={createReasonMutation.isPending}
                            data-testid="button-create-reason"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Create Reason
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingReason(null);
                              setIsAddingReason(false);
                            }}
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
            </TabsContent>

            <TabsContent value="descriptions" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Project Descriptions</h2>
                  <p className="text-muted-foreground">Manage the project description options for your workflow.</p>
                </div>
                <Button
                  onClick={handleAddDescription}
                  data-testid="button-add-description"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Description
                </Button>
              </div>

              <div className="grid gap-4">
                {descriptionsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : (
                  descriptions?.map((description) => (
                    <Card key={description.id} className="bg-background">
                      <CardContent className="p-6">
                        {editingDescription?.id === description.id ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="description-name">Description Name</Label>
                                <Input
                                  id="description-name"
                                  value={editingDescription.name}
                                  onChange={(e) => setEditingDescription({
                                    ...editingDescription,
                                    name: e.target.value
                                  })}
                                  data-testid="input-description-name"
                                />
                              </div>
                              
                              <div>
                                <Label htmlFor="description-order">Order</Label>
                                <Input
                                  id="description-order"
                                  type="number"
                                  value={editingDescription.order}
                                  onChange={(e) => setEditingDescription({
                                    ...editingDescription,
                                    order: parseInt(e.target.value) || 0
                                  })}
                                  data-testid="input-description-order"
                                />
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="description-active"
                                  checked={editingDescription.active}
                                  onChange={(e) => setEditingDescription({
                                    ...editingDescription,
                                    active: e.target.checked
                                  })}
                                  className="rounded border-input"
                                  data-testid="checkbox-description-active"
                                />
                                <Label htmlFor="description-active">Active</Label>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                onClick={handleSaveDescription}
                                disabled={createDescriptionMutation.isPending || updateDescriptionMutation.isPending}
                                data-testid="button-save-description"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                Save
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditingDescription(null);
                                  setIsAddingDescription(false);
                                }}
                                data-testid="button-cancel-description"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium">{description.name}</h3>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Badge variant={description.active ? "default" : "secondary"}>
                                  {description.active ? "Active" : "Inactive"}
                                </Badge>
                                <span>Order: {description.order}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditDescription(description)}
                                data-testid={`button-edit-description-${description.id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteDescriptionMutation.mutate(description.id)}
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-delete-description-${description.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}

                {/* Add new description form */}
                {isAddingDescription && editingDescription && !editingDescription.id && (
                  <Card className="bg-background border-dashed">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="new-description-name">Description Name</Label>
                            <Input
                              id="new-description-name"
                              value={editingDescription.name}
                              onChange={(e) => setEditingDescription({
                                ...editingDescription,
                                name: e.target.value
                              })}
                              data-testid="input-new-description-name"
                              placeholder="Enter description name"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="new-description-order">Order</Label>
                            <Input
                              id="new-description-order"
                              type="number"
                              value={editingDescription.order}
                              onChange={(e) => setEditingDescription({
                                ...editingDescription,
                                order: parseInt(e.target.value) || 0
                              })}
                              data-testid="input-new-description-order"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="new-description-active"
                              checked={editingDescription.active}
                              onChange={(e) => setEditingDescription({
                                ...editingDescription,
                                active: e.target.checked
                              })}
                              className="rounded border-input"
                              data-testid="checkbox-new-description-active"
                            />
                            <Label htmlFor="new-description-active">Active</Label>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={handleSaveDescription}
                            disabled={createDescriptionMutation.isPending}
                            data-testid="button-create-description"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Create Description
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingDescription(null);
                              setIsAddingDescription(false);
                            }}
                            data-testid="button-cancel-new-description"
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
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}