import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { 
  ProjectType,
  KanbanStage, 
  ChangeReason, 
  StageApproval,
  StageApprovalField
} from "@shared/schema";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Edit2, Trash2, Save, X, ArrowLeft, Settings, Layers, List, ShieldCheck } from "lucide-react";

interface EditingStage {
  id?: string;
  name: string;
  assignedRole: string;
  order: number;
  color: string;
  maxInstanceTime?: number;
  maxTotalTime?: number;
}

interface EditingReason {
  id?: string;
  reason: string;
  description: string;
  showCountInProject: boolean;
  countLabel: string;
}

interface EditingStageApproval {
  id?: string;
  name: string;
  description: string;
}

interface EditingStageApprovalField {
  id?: string;
  stageApprovalId: string;
  fieldName: string;
  fieldType: 'boolean' | 'number' | 'long_text';
  isRequired: boolean;
  order: number;
  // Boolean validation
  expectedValueBoolean?: boolean;
  // Number validation  
  comparisonType?: 'equal_to' | 'less_than' | 'greater_than';
  expectedValueNumber?: number;
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
  showCountInProject: false,
  countLabel: "",
};

const DEFAULT_STAGE_APPROVAL: EditingStageApproval = { name: "", description: "" };
const DEFAULT_STAGE_APPROVAL_FIELD: EditingStageApprovalField = { 
  stageApprovalId: "", fieldName: "", fieldType: "boolean", isRequired: false, order: 0 
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "client_manager", label: "Client Manager" },
  { value: "bookkeeper", label: "Bookkeeper" },
];

const STAGE_COLORS = [
  "#6b7280", "#ef4444", "#f97316", "#eab308", 
  "#22c55e", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"
];

export default function ProjectTypeDetail() {
  const { id: projectTypeId } = useParams();
  const [location, navigate] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for editing forms
  const [editingStage, setEditingStage] = useState<EditingStage | null>(null);
  const [editingReason, setEditingReason] = useState<EditingReason | null>(null);
  const [editingStageApproval, setEditingStageApproval] = useState<EditingStageApproval | null>(null);
  const [editingStageApprovalField, setEditingStageApprovalField] = useState<EditingStageApprovalField | null>(null);
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [isAddingReason, setIsAddingReason] = useState(false);
  const [isAddingStageApproval, setIsAddingStageApproval] = useState(false);
  const [isAddingStageApprovalField, setIsAddingStageApprovalField] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Fetch project type details
  const { data: projectType, isLoading: projectTypeLoading, error: projectTypeError } = useQuery<ProjectType>({
    queryKey: ["/api/config/project-types", projectTypeId],
    queryFn: async () => {
      const response = await fetch(`/api/config/project-types`);
      if (!response.ok) throw new Error("Failed to fetch project types");
      const allTypes = await response.json();
      const type = allTypes.find((pt: ProjectType) => pt.id === projectTypeId);
      if (!type) throw new Error("Project type not found");
      return type;
    },
    enabled: !!projectTypeId && isAuthenticated && !!user,
    retry: false,
  });

  // Fetch stages for this project type
  const { data: stages, isLoading: stagesLoading } = useQuery<KanbanStage[]>({
    queryKey: ["/api/config/project-types", projectTypeId, "stages"],
    enabled: !!projectTypeId && isAuthenticated && !!user,
  });

  // Fetch change reasons for this project type
  const { data: reasons, isLoading: reasonsLoading } = useQuery<ChangeReason[]>({
    queryKey: ["/api/config/project-types", projectTypeId, "reasons"],
    enabled: !!projectTypeId && isAuthenticated && !!user,
  });

  // Fetch stage approvals for this project type
  const { data: stageApprovals, isLoading: stageApprovalsLoading } = useQuery<StageApproval[]>({
    queryKey: ["/api/config/project-types", projectTypeId, "stage-approvals"],
    enabled: !!projectTypeId && isAuthenticated && !!user,
  });

  // Fetch stage approval fields (needed for managing approval fields)
  const { data: stageApprovalFields, isLoading: stageApprovalFieldsLoading } = useQuery<StageApprovalField[]>({
    queryKey: ["/api/config/stage-approval-fields"],
    enabled: isAuthenticated && !!user,
  });

  // Handle errors
  useEffect(() => {
    if (projectTypeError && isUnauthorizedError(projectTypeError)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
    
    if (projectTypeError) {
      toast({
        title: "Error",
        description: "Project type not found",
        variant: "destructive",
      });
      navigate("/settings");
    }
  }, [projectTypeError, toast, navigate]);

  // Stage mutations - create stages for this project type
  const createStageMutation = useMutation({
    mutationFn: async (stage: Omit<EditingStage, 'id'>) => {
      if (!projectTypeId) throw new Error("No project type selected");
      return await apiRequest("POST", "/api/config/stages", { ...stage, projectTypeId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "stages"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "stages"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "stages"] });
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
      if (!projectTypeId) throw new Error("No project type selected");
      return await apiRequest("POST", "/api/config/reasons", { ...reason, projectTypeId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Reason created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "reasons"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "reasons"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "reasons"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete reason",
        variant: "destructive",
      });
    },
  });

  // Stage Approval mutations
  const createStageApprovalMutation = useMutation({
    mutationFn: async (stageApproval: Omit<EditingStageApproval, 'id'>) => {
      if (!projectTypeId) throw new Error("No project type selected");
      return await apiRequest("POST", "/api/config/stage-approvals", { ...stageApproval, projectTypeId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage approval created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "stage-approvals"] });
      setIsAddingStageApproval(false);
      setEditingStageApproval(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create stage approval",
        variant: "destructive",
      });
    },
  });

  const updateStageApprovalMutation = useMutation({
    mutationFn: async ({ id, ...stageApproval }: EditingStageApproval) => {
      return await apiRequest("PATCH", `/api/config/stage-approvals/${id}`, stageApproval);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage approval updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "stage-approvals"] });
      setEditingStageApproval(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update stage approval",
        variant: "destructive",
      });
    },
  });

  const deleteStageApprovalMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/config/stage-approvals/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage approval deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "stage-approvals"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete stage approval",
        variant: "destructive",
      });
    },
  });

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (projectTypeLoading) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-border bg-card p-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-10 w-full max-w-md" />
            </div>
          </div>
          <div className="flex-1 p-6">
            <div className="space-y-6">
              <Skeleton className="h-12 w-full" />
              <div className="grid gap-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!projectType) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Settings className="w-12 h-12 text-muted-foreground mb-4 mx-auto" />
              <h3 className="text-lg font-medium text-foreground mb-2">Project type not found</h3>
              <p className="text-muted-foreground mb-4">The requested project type could not be found.</p>
              <Link href="/settings">
                <Button>Back to Project Types</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleStageSubmit = () => {
    if (!editingStage) return;
    
    if (editingStage.id) {
      updateStageMutation.mutate(editingStage);
    } else {
      createStageMutation.mutate(editingStage);
    }
  };

  const handleReasonSubmit = () => {
    if (!editingReason) return;
    
    if (editingReason.id) {
      updateReasonMutation.mutate(editingReason);
    } else {
      createReasonMutation.mutate(editingReason);
    }
  };

  const handleStageApprovalSubmit = () => {
    if (!editingStageApproval) return;
    
    if (editingStageApproval.id) {
      updateStageApprovalMutation.mutate(editingStageApproval);
    } else {
      createStageApprovalMutation.mutate(editingStageApproval);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with breadcrumbs */}
        <div className="border-b border-border bg-card">
          <div className="p-6">
            {/* Breadcrumb */}
            <Breadcrumb className="mb-4">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/settings" data-testid="breadcrumb-settings">
                      Settings
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage data-testid="breadcrumb-project-type">
                    {projectType.name}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-foreground flex items-center" data-testid="text-project-type-name">
                  <Settings className="w-6 h-6 mr-3 text-primary" />
                  {projectType.name}
                </h1>
                {projectType.description && (
                  <p className="text-muted-foreground mt-1" data-testid="text-project-type-description">
                    {projectType.description}
                  </p>
                )}
              </div>
              <Link href="/settings">
                <Button variant="outline" data-testid="button-back-to-project-types">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Project Types
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Content with tabs */}
        <div className="flex-1 overflow-auto">
          <Tabs defaultValue="stages" className="h-full">
            <div className="border-b border-border bg-card px-6">
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="stages" className="flex items-center" data-testid="tab-stages">
                  <Layers className="w-4 h-4 mr-2" />
                  Kanban Stages
                </TabsTrigger>
                <TabsTrigger value="reasons" className="flex items-center" data-testid="tab-reasons">
                  <List className="w-4 h-4 mr-2" />
                  Change Reasons
                </TabsTrigger>
                <TabsTrigger value="approvals" className="flex items-center" data-testid="tab-approvals">
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Stage Approvals
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Kanban Stages Tab */}
            <TabsContent value="stages" className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Kanban Stages</h2>
                  <p className="text-muted-foreground">Configure the workflow stages for this project type</p>
                </div>
                <Button 
                  onClick={() => {
                    setEditingStage({ ...DEFAULT_STAGE, order: (stages?.length || 0) });
                    setIsAddingStage(true);
                  }}
                  data-testid="button-add-stage"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Stage
                </Button>
              </div>

              {stagesLoading ? (
                <div className="grid gap-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-4 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : stages && stages.length > 0 ? (
                <div className="grid gap-4">
                  {stages.map((stage) => (
                    <Card key={stage.id} data-testid={`card-stage-${stage.id}`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: stage.color || '#6b7280' }}
                          />
                          <CardTitle className="text-base" data-testid={`text-stage-name-${stage.id}`}>
                            {stage.name}
                          </CardTitle>
                          <Badge variant="secondary" data-testid={`badge-stage-role-${stage.id}`}>
                            {ROLE_OPTIONS.find(r => r.value === stage.assignedRole)?.label || stage.assignedRole}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingStage({
                              id: stage.id,
                              name: stage.name,
                              assignedRole: stage.assignedRole || "client_manager",
                              order: stage.order,
                              color: stage.color || "#6b7280",
                              maxInstanceTime: stage.maxInstanceTime || undefined,
                              maxTotalTime: stage.maxTotalTime || undefined
                            })}
                            data-testid={`button-edit-stage-${stage.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteStageMutation.mutate(stage.id)}
                            data-testid={`button-delete-stage-${stage.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>Order: {stage.order}</span>
                          {stage.maxInstanceTime && <span>Max time: {stage.maxInstanceTime}h</span>}
                          {stage.maxTotalTime && <span>Total time: {stage.maxTotalTime}h</span>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Layers className="w-12 h-12 text-muted-foreground mb-4 mx-auto" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No stages configured</h3>
                  <p className="text-muted-foreground mb-4">Add your first kanban stage to start configuring the workflow.</p>
                  <Button 
                    onClick={() => {
                      setEditingStage({ ...DEFAULT_STAGE, order: 0 });
                      setIsAddingStage(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Stage
                  </Button>
                </div>
              )}

              {/* Stage Editing Form */}
              {(editingStage || isAddingStage) && (
                <Card>
                  <CardHeader>
                    <CardTitle>{editingStage?.id ? "Edit Stage" : "Add New Stage"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="stage-name">Stage Name</Label>
                        <Input
                          id="stage-name"
                          value={editingStage?.name || ""}
                          onChange={(e) => setEditingStage(prev => ({ ...prev!, name: e.target.value }))}
                          placeholder="Enter stage name"
                          data-testid="input-stage-name"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="stage-role">Assigned Role</Label>
                        <Select
                          value={editingStage?.assignedRole || "client_manager"}
                          onValueChange={(value) => setEditingStage(prev => ({ ...prev!, assignedRole: value }))}
                        >
                          <SelectTrigger data-testid="select-stage-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map(role => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="stage-order">Order</Label>
                        <Input
                          id="stage-order"
                          type="number"
                          value={editingStage?.order || 0}
                          onChange={(e) => setEditingStage(prev => ({ ...prev!, order: parseInt(e.target.value) || 0 }))}
                          data-testid="input-stage-order"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="stage-color">Color</Label>
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            {STAGE_COLORS.map(color => (
                              <button
                                key={color}
                                type="button"
                                className={`w-6 h-6 rounded-full border-2 ${editingStage?.color === color ? 'border-foreground' : 'border-transparent'}`}
                                style={{ backgroundColor: color }}
                                onClick={() => setEditingStage(prev => ({ ...prev!, color }))}
                                data-testid={`button-stage-color-${color.replace('#', '')}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="stage-max-instance">Max Instance Time (hours)</Label>
                        <Input
                          id="stage-max-instance"
                          type="number"
                          value={editingStage?.maxInstanceTime || ""}
                          onChange={(e) => setEditingStage(prev => ({ 
                            ...prev!, 
                            maxInstanceTime: e.target.value ? parseInt(e.target.value) : undefined 
                          }))}
                          placeholder="Optional"
                          data-testid="input-stage-max-instance-time"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="stage-max-total">Max Total Time (hours)</Label>
                        <Input
                          id="stage-max-total"
                          type="number"
                          value={editingStage?.maxTotalTime || ""}
                          onChange={(e) => setEditingStage(prev => ({ 
                            ...prev!, 
                            maxTotalTime: e.target.value ? parseInt(e.target.value) : undefined 
                          }))}
                          placeholder="Optional"
                          data-testid="input-stage-max-total-time"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 mt-4">
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
                      <Button
                        onClick={handleStageSubmit}
                        disabled={!editingStage?.name || createStageMutation.isPending || updateStageMutation.isPending}
                        data-testid="button-save-stage"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {editingStage?.id ? "Update" : "Create"} Stage
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Change Reasons Tab */}
            <TabsContent value="reasons" className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Change Reasons</h2>
                  <p className="text-muted-foreground">Configure reasons for status changes in this project type</p>
                </div>
                <Button 
                  onClick={() => {
                    setEditingReason(DEFAULT_REASON);
                    setIsAddingReason(true);
                  }}
                  data-testid="button-add-reason"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Reason
                </Button>
              </div>

              {reasonsLoading ? (
                <div className="grid gap-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-4 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : reasons && reasons.length > 0 ? (
                <div className="grid gap-4">
                  {reasons.map((reason) => (
                    <Card key={reason.id} data-testid={`card-reason-${reason.id}`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div>
                          <CardTitle className="text-base" data-testid={`text-reason-name-${reason.id}`}>
                            {reason.reason}
                          </CardTitle>
                          {reason.description && (
                            <p className="text-sm text-muted-foreground mt-1" data-testid={`text-reason-description-${reason.id}`}>
                              {reason.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingReason({
                              ...reason,
                              description: reason.description || "",
                              showCountInProject: reason.showCountInProject || false,
                              countLabel: reason.countLabel || ""
                            })}
                            data-testid={`button-edit-reason-${reason.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteReasonMutation.mutate(reason.id)}
                            data-testid={`button-delete-reason-${reason.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      {reason.showCountInProject && reason.countLabel && (
                        <CardContent>
                          <Badge variant="secondary" data-testid={`badge-reason-count-${reason.id}`}>
                            Count: {reason.countLabel}
                          </Badge>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <List className="w-12 h-12 text-muted-foreground mb-4 mx-auto" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No change reasons configured</h3>
                  <p className="text-muted-foreground mb-4">Add change reasons to track why projects move between stages.</p>
                  <Button 
                    onClick={() => {
                      setEditingReason(DEFAULT_REASON);
                      setIsAddingReason(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Reason
                  </Button>
                </div>
              )}

              {/* Reason Editing Form */}
              {(editingReason || isAddingReason) && (
                <Card>
                  <CardHeader>
                    <CardTitle>{editingReason?.id ? "Edit Change Reason" : "Add New Change Reason"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="reason-name">Reason</Label>
                        <Input
                          id="reason-name"
                          value={editingReason?.reason || ""}
                          onChange={(e) => setEditingReason(prev => ({ ...prev!, reason: e.target.value }))}
                          placeholder="Enter reason name"
                          data-testid="input-reason-name"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="reason-description">Description</Label>
                        <Textarea
                          id="reason-description"
                          value={editingReason?.description || ""}
                          onChange={(e) => setEditingReason(prev => ({ ...prev!, description: e.target.value }))}
                          placeholder="Optional description"
                          data-testid="textarea-reason-description"
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="reason-show-count"
                          checked={editingReason?.showCountInProject || false}
                          onCheckedChange={(checked) => setEditingReason(prev => ({ 
                            ...prev!, 
                            showCountInProject: !!checked 
                          }))}
                          data-testid="checkbox-reason-show-count"
                        />
                        <Label htmlFor="reason-show-count">Show count in project</Label>
                      </div>

                      {editingReason?.showCountInProject && (
                        <div className="space-y-2">
                          <Label htmlFor="reason-count-label">Count Label</Label>
                          <Input
                            id="reason-count-label"
                            value={editingReason?.countLabel || ""}
                            onChange={(e) => setEditingReason(prev => ({ ...prev!, countLabel: e.target.value }))}
                            placeholder="Enter count label"
                            data-testid="input-reason-count-label"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end space-x-2 mt-4">
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
                      <Button
                        onClick={handleReasonSubmit}
                        disabled={!editingReason?.reason || createReasonMutation.isPending || updateReasonMutation.isPending}
                        data-testid="button-save-reason"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {editingReason?.id ? "Update" : "Create"} Reason
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Stage Approvals Tab */}
            <TabsContent value="approvals" className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Stage Approvals</h2>
                  <p className="text-muted-foreground">Configure approval processes for stages in this project type</p>
                </div>
                <Button 
                  onClick={() => {
                    setEditingStageApproval(DEFAULT_STAGE_APPROVAL);
                    setIsAddingStageApproval(true);
                  }}
                  data-testid="button-add-stage-approval"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Approval
                </Button>
              </div>

              {stageApprovalsLoading ? (
                <div className="grid gap-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-4 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : stageApprovals && stageApprovals.length > 0 ? (
                <div className="grid gap-4">
                  {stageApprovals.map((approval) => (
                    <Card key={approval.id} data-testid={`card-approval-${approval.id}`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div>
                          <CardTitle className="text-base flex items-center" data-testid={`text-approval-name-${approval.id}`}>
                            <ShieldCheck className="w-4 h-4 mr-2 text-primary" />
                            {approval.name}
                          </CardTitle>
                          {approval.description && (
                            <p className="text-sm text-muted-foreground mt-1" data-testid={`text-approval-description-${approval.id}`}>
                              {approval.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingStageApproval({
                              ...approval,
                              description: approval.description || ""
                            })}
                            data-testid={`button-edit-approval-${approval.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteStageApprovalMutation.mutate(approval.id)}
                            data-testid={`button-delete-approval-${approval.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground">
                          {stageApprovalFields?.filter(f => f.stageApprovalId === approval.id).length || 0} fields configured
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ShieldCheck className="w-12 h-12 text-muted-foreground mb-4 mx-auto" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No stage approvals configured</h3>
                  <p className="text-muted-foreground mb-4">Add approval processes to validate stage transitions.</p>
                  <Button 
                    onClick={() => {
                      setEditingStageApproval(DEFAULT_STAGE_APPROVAL);
                      setIsAddingStageApproval(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Approval
                  </Button>
                </div>
              )}

              {/* Stage Approval Editing Form */}
              {(editingStageApproval || isAddingStageApproval) && (
                <Card>
                  <CardHeader>
                    <CardTitle>{editingStageApproval?.id ? "Edit Stage Approval" : "Add New Stage Approval"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="approval-name">Approval Name</Label>
                        <Input
                          id="approval-name"
                          value={editingStageApproval?.name || ""}
                          onChange={(e) => setEditingStageApproval(prev => ({ ...prev!, name: e.target.value }))}
                          placeholder="Enter approval name"
                          data-testid="input-approval-name"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="approval-description">Description</Label>
                        <Textarea
                          id="approval-description"
                          value={editingStageApproval?.description || ""}
                          onChange={(e) => setEditingStageApproval(prev => ({ ...prev!, description: e.target.value }))}
                          placeholder="Optional description"
                          data-testid="textarea-approval-description"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 mt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingStageApproval(null);
                          setIsAddingStageApproval(false);
                        }}
                        data-testid="button-cancel-approval"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        onClick={handleStageApprovalSubmit}
                        disabled={!editingStageApproval?.name || createStageApprovalMutation.isPending || updateStageApprovalMutation.isPending}
                        data-testid="button-save-approval"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {editingStageApproval?.id ? "Update" : "Create"} Approval
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}