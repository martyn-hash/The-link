import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Edit2, Trash2, Save, X } from "lucide-react";
import type { KanbanStage, ChangeReason, ProjectType, StageApproval } from "@shared/schema";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EditingStage {
  id?: string;
  name: string;
  assignedRole?: string;  // Legacy field
  assignedWorkRoleId?: string;  // For service-linked project types
  assignedUserId?: string;  // For non-service project types
  order: number;
  color: string;
}

interface EditingReason {
  id?: string;
  reason: string;
  description: string;
}

interface EditingProjectType {
  id?: string;
  name: string;
  description: string;
  active: boolean;
  order: number;
}

const DEFAULT_STAGE: EditingStage = {
  name: "",
  assignedRole: undefined,
  assignedWorkRoleId: undefined,
  assignedUserId: undefined,
  order: 0,
  color: "#6b7280",
};

const DEFAULT_REASON: EditingReason = {
  reason: "",
  description: "",
};

const DEFAULT_PROJECT_TYPE: EditingProjectType = {
  name: "",
  description: "",
  active: true,
  order: 0,
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
  const [selectedProjectTypeId, setSelectedProjectTypeId] = useState<string | null>(null);
  const [editingProjectType, setEditingProjectType] = useState<EditingProjectType | null>(null);
  const [isAddingProjectType, setIsAddingProjectType] = useState(false);
  const [editingStage, setEditingStage] = useState<EditingStage | null>(null);
  const [editingReason, setEditingReason] = useState<EditingReason | null>(null);
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [isAddingReason, setIsAddingReason] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch project types
  const { data: projectTypes, isLoading: projectTypesLoading } = useQuery<ProjectType[]>({
    queryKey: ["/api/config/project-types"],
    enabled: isOpen,
  });

  // Set default project type when data loads
  useEffect(() => {
    if (projectTypes && projectTypes.length > 0 && !selectedProjectTypeId) {
      // Default to "Monthly Bookkeeping" or first project type
      const defaultType = projectTypes.find(pt => pt.name === "Monthly Bookkeeping") || projectTypes[0];
      setSelectedProjectTypeId(defaultType.id);
    }
  }, [projectTypes, selectedProjectTypeId]);

  // Fetch stages for selected project type
  const { data: stages, isLoading: stagesLoading } = useQuery<KanbanStage[]>({
    queryKey: ["/api/config/project-types", selectedProjectTypeId, "stages"],
    enabled: isOpen && !!selectedProjectTypeId,
  });

  // Fetch change reasons for selected project type
  const { data: reasons, isLoading: reasonsLoading } = useQuery<ChangeReason[]>({
    queryKey: ["/api/config/project-types", selectedProjectTypeId, "reasons"],
    enabled: isOpen && !!selectedProjectTypeId,
  });

  // Fetch stage approvals for selected project type
  const { data: stageApprovals, isLoading: stageApprovalsLoading } = useQuery<StageApproval[]>({
    queryKey: ["/api/config/project-types", selectedProjectTypeId, "stage-approvals"],
    enabled: isOpen && !!selectedProjectTypeId,
  });

  // Get selected project type to check if it has a service
  const selectedProjectType = projectTypes?.find(pt => pt.id === selectedProjectTypeId);

  // Fetch service roles if project type is linked to a service
  const { data: serviceRoles } = useQuery<any[]>({
    queryKey: ["/api/config/services", selectedProjectType?.serviceId, "roles"],
    enabled: isOpen && !!selectedProjectType?.serviceId,
    queryFn: async () => {
      const response = await fetch(`/api/config/services/${selectedProjectType?.serviceId}/roles`);
      if (!response.ok) throw new Error('Failed to fetch service roles');
      return response.json();
    },
  });

  // Fetch all users if project type is not linked to a service
  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: isOpen && !!selectedProjectType && !selectedProjectType.serviceId,
  });

  // Project Type mutations
  const createProjectTypeMutation = useMutation({
    mutationFn: async (projectType: Omit<EditingProjectType, 'id'>) => {
      return await apiRequest("POST", "/api/config/project-types", projectType);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Project type created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types"] });
      setIsAddingProjectType(false);
      setEditingProjectType(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create project type",
        variant: "destructive",
      });
    },
  });

  const updateProjectTypeMutation = useMutation({
    mutationFn: async ({ id, ...projectType }: EditingProjectType) => {
      return await apiRequest("PATCH", `/api/config/project-types/${id}`, projectType);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Project type updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types"] });
      setEditingProjectType(null);
    },
    onError: (error: any) => {
      // Handle specific project type deactivation validation error
      if (error.code === "PROJECTS_USING_TYPE") {
        toast({
          title: "Cannot Deactivate Project Type",
          description: (
            <div className="space-y-2">
              <p>{error.message}</p>
              <div className="text-sm font-medium">
                📊 {error.activeProjectCount} active project{error.activeProjectCount === 1 ? '' : 's'} using "{error.projectTypeName}"
              </div>
              <div className="text-sm text-muted-foreground">
                💡 To deactivate this project type, first complete, archive, or reassign the active projects.
              </div>
            </div>
          ),
          variant: "destructive",
          duration: 8000, // Show longer for detailed message
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to update project type",
          variant: "destructive",
        });
      }
    },
  });

  const deleteProjectTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/config/project-types/${id}`);
    },
    onSuccess: (_, deletedId) => {
      toast({ title: "Success", description: "Project type deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types"] });
      // Reset selected project type if it was deleted
      if (selectedProjectTypeId === deletedId) {
        setSelectedProjectTypeId(null);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete project type",
        variant: "destructive",
      });
    },
  });

  // Force delete mutations
  const [forceDeleteDialog, setForceDeleteDialog] = useState<{ 
    open: boolean; 
    projectType: any | null; 
    dependencies: any | null;
    confirmName: string;
  }>({
    open: false,
    projectType: null,
    dependencies: null,
    confirmName: '',
  });

  const getDependencySummaryMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("GET", `/api/config/project-types/${id}/dependency-summary`);
    },
    onSuccess: (data) => {
      setForceDeleteDialog(prev => ({
        ...prev,
        dependencies: data,
      }));
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to get dependency summary",
        variant: "destructive",
      });
      setForceDeleteDialog(prev => ({ ...prev, open: false }));
    },
  });

  const forceDeleteProjectTypeMutation = useMutation({
    mutationFn: async ({ id, confirmName }: { id: string; confirmName: string }) => {
      return await apiRequest("POST", `/api/config/project-types/${id}/force-delete`, { confirmName });
    },
    onSuccess: (data: any, { id: deletedId }) => {
      toast({ 
        title: "Success", 
        description: data?.message || "Project type and all dependencies deleted successfully",
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config/kanban-stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config/change-reasons"] });
      // Reset selected project type if it was deleted
      if (selectedProjectTypeId === deletedId) {
        setSelectedProjectTypeId(null);
      }
      // Close the dialog
      setForceDeleteDialog({ open: false, projectType: null, dependencies: null, confirmName: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to force delete project type",
        variant: "destructive",
      });
    },
  });

  const handleForceDelete = (projectType: any) => {
    setForceDeleteDialog({
      open: true,
      projectType,
      dependencies: null,
      confirmName: '',
    });
    getDependencySummaryMutation.mutate(projectType.id);
  };

  const handleConfirmForceDelete = () => {
    if (forceDeleteDialog.projectType && forceDeleteDialog.confirmName === forceDeleteDialog.projectType.name) {
      forceDeleteProjectTypeMutation.mutate({
        id: forceDeleteDialog.projectType.id,
        confirmName: forceDeleteDialog.confirmName,
      });
    }
  };

  // Stage mutations
  const createStageMutation = useMutation({
    mutationFn: async (stage: Omit<EditingStage, 'id'>) => {
      if (!selectedProjectTypeId) throw new Error("No project type selected");
      return await apiRequest("POST", `/api/config/project-types/${selectedProjectTypeId}/stages`, stage);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", selectedProjectTypeId, "stages"] });
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
      if (!selectedProjectTypeId) throw new Error("No project type selected");
      return await apiRequest("PATCH", `/api/config/project-types/${selectedProjectTypeId}/stages/${id}`, stage);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", selectedProjectTypeId, "stages"] });
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
      if (!selectedProjectTypeId) throw new Error("No project type selected");
      return await apiRequest("DELETE", `/api/config/project-types/${selectedProjectTypeId}/stages/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", selectedProjectTypeId, "stages"] });
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
      if (!selectedProjectTypeId) throw new Error("No project type selected");
      return await apiRequest("POST", `/api/config/project-types/${selectedProjectTypeId}/reasons`, reason);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Change reason created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", selectedProjectTypeId, "reasons"] });
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
      if (!selectedProjectTypeId) throw new Error("No project type selected");
      return await apiRequest("PATCH", `/api/config/project-types/${selectedProjectTypeId}/reasons/${id}`, reason);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Change reason updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", selectedProjectTypeId, "reasons"] });
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
      if (!selectedProjectTypeId) throw new Error("No project type selected");
      return await apiRequest("DELETE", `/api/config/project-types/${selectedProjectTypeId}/reasons/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Change reason deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", selectedProjectTypeId, "reasons"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete change reason",
        variant: "destructive",
      });
    },
  });

  // Handle project type operations
  const handleSaveProjectType = () => {
    if (!editingProjectType) return;

    if (!editingProjectType.name) {
      toast({
        title: "Validation Error",
        description: "Please enter a project type name",
        variant: "destructive",
      });
      return;
    }

    if (editingProjectType.id) {
      updateProjectTypeMutation.mutate(editingProjectType);
    } else {
      const { id, ...projectTypeData } = editingProjectType;
      createProjectTypeMutation.mutate(projectTypeData);
    }
  };

  const handleEditProjectType = (projectType: ProjectType) => {
    setEditingProjectType({
      id: projectType.id,
      name: projectType.name,
      description: projectType.description || "",
      active: projectType.active ?? true,
      order: projectType.order,
    });
    setIsAddingProjectType(false);
  };

  const handleAddProjectType = () => {
    const nextOrder = Math.max(0, ...(projectTypes?.map(pt => pt.order) || [])) + 1;
    setEditingProjectType({ ...DEFAULT_PROJECT_TYPE, order: nextOrder });
    setIsAddingProjectType(true);
  };

  // Handle stage operations
  const handleSaveStage = () => {
    if (!editingStage) return;
    if (!selectedProjectTypeId) {
      toast({
        title: "Validation Error",
        description: "Please select a project type first",
        variant: "destructive",
      });
      return;
    }

    if (!editingStage.name) {
      toast({
        title: "Validation Error",
        description: "Please enter a stage name",
        variant: "destructive",
      });
      return;
    }

    // Prepare stage data with correct assignment fields
    const { id, ...stageData } = editingStage;
    
    // Clean up assignment fields based on project type
    if (selectedProjectType?.serviceId) {
      // Service-linked: ensure only assignedWorkRoleId is set
      stageData.assignedRole = undefined;
      stageData.assignedUserId = undefined;
      
      if (!stageData.assignedWorkRoleId) {
        toast({
          title: "Validation Error",
          description: "Please select a service role",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Non-service: ensure only assignedUserId is set
      stageData.assignedRole = undefined;
      stageData.assignedWorkRoleId = undefined;
      
      if (!stageData.assignedUserId) {
        toast({
          title: "Validation Error",
          description: "Please select a user",
          variant: "destructive",
        });
        return;
      }
    }

    console.log("Submitting stage data:", stageData);

    if (editingStage.id) {
      updateStageMutation.mutate(stageData);
    } else {
      createStageMutation.mutate(stageData);
    }
  };

  const handleEditStage = (stage: KanbanStage) => {
    setEditingStage({
      id: stage.id,
      name: stage.name,
      assignedRole: stage.assignedRole || undefined,
      assignedWorkRoleId: (stage as any).assignedWorkRoleId,
      assignedUserId: (stage as any).assignedUserId,
      order: stage.order,
      color: stage.color || "#6b7280",
    });
    setIsAddingStage(false);
  };

  const handleAddStage = () => {
    const nextOrder = Math.max(0, ...(stages?.map(s => s.order) || [])) + 1;
    
    // Initialize with appropriate default assignment based on project type
    const defaultStage = {
      ...DEFAULT_STAGE,
      order: nextOrder,
    };
    
    // Set default assignment based on project type service linkage
    if (selectedProjectType?.serviceId) {
      // Service-linked: will select service role in dropdown
      defaultStage.assignedWorkRoleId = undefined;
      defaultStage.assignedUserId = undefined;
      defaultStage.assignedRole = undefined;
    } else {
      // Non-service: will select user in dropdown
      defaultStage.assignedUserId = undefined;
      defaultStage.assignedWorkRoleId = undefined;
      defaultStage.assignedRole = undefined;
    }
    
    setEditingStage(defaultStage);
    setIsAddingStage(true);
  };

  // Handle reason operations
  const handleSaveReason = () => {
    if (!editingReason) return;
    if (!selectedProjectTypeId) {
      toast({
        title: "Validation Error",
        description: "Please select a project type first",
        variant: "destructive",
      });
      return;
    }

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
      setEditingProjectType(null);
      setIsAddingProjectType(false);
      setEditingStage(null);
      setEditingReason(null);
      setIsAddingStage(false);
      setIsAddingReason(false);
    }
  }, [isOpen]);

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden" data-testid="settings-modal">
        <DialogHeader>
          <DialogTitle>System Settings</DialogTitle>
          <DialogDescription>
            Configure project types, stages, and change reasons for your system workflows.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-100px)] overflow-y-auto">
          {/* Project Type Management */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Project Types</h3>
              <Button
                onClick={handleAddProjectType}
                size="sm"
                data-testid="button-add-project-type"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Project Type
              </Button>
            </div>

            {/* Project Type Selection */}
            {projectTypes && projectTypes.length > 0 && (
              <div className="mb-6">
                <Label htmlFor="project-type-select">Current Project Type</Label>
                <select
                  id="project-type-select"
                  value={selectedProjectTypeId || ""}
                  onChange={(e) => setSelectedProjectTypeId(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md mt-2"
                  data-testid="select-project-type"
                >
                  <option value="">Select a project type...</option>
                  {projectTypes.map(pt => (
                    <option key={pt.id} value={pt.id}>
                      {pt.name} {!pt.active && "(Inactive)"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Project Types List */}
            <div className="space-y-3">
              {projectTypesLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : (
                projectTypes?.map((projectType) => (
                  <Card key={projectType.id} className="bg-background">
                    <CardContent className="p-4">
                      {editingProjectType?.id === projectType.id ? (
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="project-type-name">Project Type Name</Label>
                            <Input
                              id="project-type-name"
                              value={editingProjectType.name}
                              onChange={(e) => setEditingProjectType({
                                ...editingProjectType,
                                name: e.target.value
                              })}
                              data-testid="input-project-type-name"
                            />
                          </div>

                          <div>
                            <Label htmlFor="project-type-description">Description</Label>
                            <Input
                              id="project-type-description"
                              value={editingProjectType.description}
                              onChange={(e) => setEditingProjectType({
                                ...editingProjectType,
                                description: e.target.value
                              })}
                              data-testid="input-project-type-description"
                            />
                          </div>

                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="project-type-active"
                              checked={editingProjectType.active}
                              onChange={(e) => setEditingProjectType({
                                ...editingProjectType,
                                active: e.target.checked
                              })}
                              data-testid="checkbox-project-type-active"
                            />
                            <Label htmlFor="project-type-active">Active</Label>
                          </div>

                          <div className="flex space-x-2">
                            <Button
                              onClick={handleSaveProjectType}
                              size="sm"
                              disabled={updateProjectTypeMutation.isPending}
                              data-testid="button-save-project-type"
                            >
                              <Save className="w-4 h-4 mr-2" />
                              Save
                            </Button>
                            <Button
                              onClick={() => setEditingProjectType(null)}
                              variant="outline"
                              size="sm"
                              data-testid="button-cancel-project-type"
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
                              <span className="font-medium">{projectType.name}</span>
                              <Badge variant={projectType.active ? "default" : "secondary"} className="text-xs">
                                {projectType.active ? "Active" : "Inactive"}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Order: {projectType.order}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                onClick={() => handleEditProjectType(projectType)}
                                variant="ghost"
                                size="sm"
                                data-testid={`button-edit-project-type-${projectType.id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => deleteProjectTypeMutation.mutate(projectType.id)}
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-delete-project-type-${projectType.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => handleForceDelete(projectType)}
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-force-delete-project-type-${projectType.id}`}
                                title="Force delete with all dependencies"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="ml-1 text-xs">⚠️</span>
                              </Button>
                            </div>
                          </div>
                          {projectType.description && (
                            <p className="text-sm text-muted-foreground">
                              {projectType.description}
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}

              {/* Add new project type form */}
              {isAddingProjectType && editingProjectType && !editingProjectType.id && (
                <Card className="bg-background border-dashed">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="new-project-type-name">Project Type Name</Label>
                        <Input
                          id="new-project-type-name"
                          value={editingProjectType.name}
                          onChange={(e) => setEditingProjectType({
                            ...editingProjectType,
                            name: e.target.value
                          })}
                          placeholder="Enter project type name..."
                          data-testid="input-new-project-type-name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="new-project-type-description">Description</Label>
                        <Input
                          id="new-project-type-description"
                          value={editingProjectType.description}
                          onChange={(e) => setEditingProjectType({
                            ...editingProjectType,
                            description: e.target.value
                          })}
                          placeholder="Enter description..."
                          data-testid="input-new-project-type-description"
                        />
                      </div>

                      <div className="flex space-x-2">
                        <Button
                          onClick={handleSaveProjectType}
                          size="sm"
                          disabled={createProjectTypeMutation.isPending}
                          data-testid="button-create-project-type"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create
                        </Button>
                        <Button
                          onClick={() => {
                            setIsAddingProjectType(false);
                            setEditingProjectType(null);
                          }}
                          variant="outline"
                          size="sm"
                          data-testid="button-cancel-new-project-type"
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
          </div>

          <Separator className="my-8" />

          {/* Configuration for Selected Project Type */}
          {selectedProjectTypeId && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Configuration for: {projectTypes?.find(pt => pt.id === selectedProjectTypeId)?.name}
              </h3>
            </div>
          )}

          {selectedProjectTypeId ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                              <Label htmlFor="stage-role">
                                {selectedProjectType?.serviceId ? "Assigned Service Role" : "Assigned User"}
                              </Label>
                              {selectedProjectType?.serviceId ? (
                                // Service-linked project type: show service roles
                                <select
                                  id="stage-role"
                                  value={editingStage.assignedWorkRoleId || ""}
                                  onChange={(e) => setEditingStage({
                                    ...editingStage,
                                    assignedWorkRoleId: e.target.value || undefined,
                                    assignedUserId: undefined,
                                    assignedRole: undefined,
                                  })}
                                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                                  data-testid="select-stage-role"
                                >
                                  <option value="">Select a service role...</option>
                                  {serviceRoles?.map(role => (
                                    <option key={role.id} value={role.id}>
                                      {role.name}
                                    </option>
                                  )) || (
                                    <option disabled>Loading service roles...</option>
                                  )}
                                </select>
                              ) : (
                                // Non-service project type: show users
                                <select
                                  id="stage-role"
                                  value={editingStage.assignedUserId || ""}
                                  onChange={(e) => setEditingStage({
                                    ...editingStage,
                                    assignedUserId: e.target.value || undefined,
                                    assignedWorkRoleId: undefined,
                                    assignedRole: undefined,
                                  })}
                                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                                  data-testid="select-stage-user"
                                >
                                  <option value="">Select a user...</option>
                                  {users?.map(user => (
                                    <option key={user.id} value={user.id}>
                                      {user.firstName && user.lastName 
                                        ? `${user.firstName} ${user.lastName}` 
                                        : user.email
                                      }
                                    </option>
                                  )) || (
                                    <option disabled>Loading users...</option>
                                  )}
                                </select>
                              )}
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
        ) : (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              <h4 className="text-lg font-medium mb-2">No Project Type Selected</h4>
              <p>Please select or create a project type above to manage stages and change reasons.</p>
            </div>
          </div>
        )}
        </ScrollArea>
      </DialogContent>
    </Dialog>

    {/* Force Delete Confirmation Dialog */}
    <AlertDialog open={forceDeleteDialog.open} onOpenChange={(open) => 
      setForceDeleteDialog(prev => ({ ...prev, open }))
    }>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Force Delete Project Type</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the project type <strong>"{forceDeleteDialog.projectType?.name}"</strong> and ALL of its dependencies. This action cannot be undone.
            
            {forceDeleteDialog.dependencies && (
              <div className="mt-4 space-y-2">
                <div className="text-sm font-medium">The following will be deleted:</div>
                <div className="text-xs space-y-1 bg-muted p-3 rounded">
                  {forceDeleteDialog.dependencies.projects > 0 && (
                    <div>• {forceDeleteDialog.dependencies.projects} project{forceDeleteDialog.dependencies.projects !== 1 ? 's' : ''}</div>
                  )}
                  {forceDeleteDialog.dependencies.chronologyEntries > 0 && (
                    <div>• {forceDeleteDialog.dependencies.chronologyEntries} chronology entrie{forceDeleteDialog.dependencies.chronologyEntries !== 1 ? 's' : ''}</div>
                  )}
                  {forceDeleteDialog.dependencies.kanbanStages > 0 && (
                    <div>• {forceDeleteDialog.dependencies.kanbanStages} kanban stage{forceDeleteDialog.dependencies.kanbanStages !== 1 ? 's' : ''}</div>
                  )}
                  {forceDeleteDialog.dependencies.changeReasons > 0 && (
                    <div>• {forceDeleteDialog.dependencies.changeReasons} change reason{forceDeleteDialog.dependencies.changeReasons !== 1 ? 's' : ''}</div>
                  )}
                  {forceDeleteDialog.dependencies.stageReasonMaps > 0 && (
                    <div>• {forceDeleteDialog.dependencies.stageReasonMaps} stage-reason mapping{forceDeleteDialog.dependencies.stageReasonMaps !== 1 ? 's' : ''}</div>
                  )}
                  {forceDeleteDialog.dependencies.stageApprovals > 0 && (
                    <div>• {forceDeleteDialog.dependencies.stageApprovals} stage approval{forceDeleteDialog.dependencies.stageApprovals !== 1 ? 's' : ''}</div>
                  )}
                  {forceDeleteDialog.dependencies.stageApprovalFields > 0 && (
                    <div>• {forceDeleteDialog.dependencies.stageApprovalFields} approval field{forceDeleteDialog.dependencies.stageApprovalFields !== 1 ? 's' : ''}</div>
                  )}
                  {forceDeleteDialog.dependencies.reasonCustomFields > 0 && (
                    <div>• {forceDeleteDialog.dependencies.reasonCustomFields} custom field{forceDeleteDialog.dependencies.reasonCustomFields !== 1 ? 's' : ''}</div>
                  )}
                  {forceDeleteDialog.dependencies.reasonFieldResponses > 0 && (
                    <div>• {forceDeleteDialog.dependencies.reasonFieldResponses} field response{forceDeleteDialog.dependencies.reasonFieldResponses !== 1 ? 's' : ''}</div>
                  )}
                  {forceDeleteDialog.dependencies.stageApprovalResponses > 0 && (
                    <div>• {forceDeleteDialog.dependencies.stageApprovalResponses} approval response{forceDeleteDialog.dependencies.stageApprovalResponses !== 1 ? 's' : ''}</div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4">
              <Label htmlFor="confirm-name">Type the project type name to confirm:</Label>
              <Input
                id="confirm-name"
                value={forceDeleteDialog.confirmName}
                onChange={(e) => setForceDeleteDialog(prev => ({ ...prev, confirmName: e.target.value }))}
                placeholder={forceDeleteDialog.projectType?.name || ''}
                className="mt-1"
                data-testid="input-confirm-project-type-name"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-force-delete">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmForceDelete}
            disabled={
              forceDeleteProjectTypeMutation.isPending ||
              !forceDeleteDialog.confirmName ||
              forceDeleteDialog.confirmName !== forceDeleteDialog.projectType?.name
            }
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-force-delete"
          >
            {forceDeleteProjectTypeMutation.isPending ? "Deleting..." : "Force Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
