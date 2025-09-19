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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit2, Trash2, Save, X, Settings, Link, Unlink } from "lucide-react";
import type { 
  KanbanStage, 
  ChangeReason, 
  ProjectType,
  StageReasonMap,
  ReasonCustomField,
  StageApproval,
  StageApprovalField,
  InsertStageApproval,
  InsertStageApprovalField
} from "@shared/schema";

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

interface EditingDescription {
  id?: string;
  name: string;
  active: boolean;
  order: number;
}

interface EditingCustomField {
  id?: string;
  reasonId: string;
  fieldName: string;
  fieldType: 'number' | 'short_text' | 'long_text' | 'multi_select';
  isRequired: boolean;
  placeholder: string;
  options: string[];
  newOption?: string;
  order: number;
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
  maxInstanceTime: undefined,
  maxTotalTime: undefined,
};

const DEFAULT_REASON: EditingReason = {
  reason: "",
  description: "",
  showCountInProject: false,
  countLabel: "",
};

const DEFAULT_DESCRIPTION: EditingDescription = {
  name: "",
  active: true,
  order: 0,
};

const DEFAULT_CUSTOM_FIELD: EditingCustomField = {
  reasonId: "",
  fieldName: "",
  fieldType: "short_text",
  isRequired: false,
  placeholder: "",
  options: [],
  order: 0,
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

// Note: REASON_OPTIONS removed - now using custom text input like kanban stages

const STAGE_COLORS = [
  "#6b7280", "#ef4444", "#f97316", "#eab308", 
  "#22c55e", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"
];

const FIELD_TYPE_OPTIONS = [
  { value: "number", label: "Number" },
  { value: "short_text", label: "Short Text" },
  { value: "long_text", label: "Long Text" },
  { value: "multi_select", label: "Multi Select" },
];

export default function SettingsPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [editingStage, setEditingStage] = useState<EditingStage | null>(null);
  const [editingReason, setEditingReason] = useState<EditingReason | null>(null);
  const [editingDescription, setEditingDescription] = useState<EditingDescription | null>(null);
  const [editingCustomField, setEditingCustomField] = useState<EditingCustomField | null>(null);
  const [editingStageApproval, setEditingStageApproval] = useState<EditingStageApproval | null>(null);
  const [editingStageApprovalField, setEditingStageApprovalField] = useState<EditingStageApprovalField | null>(null);
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [isAddingReason, setIsAddingReason] = useState(false);
  const [isAddingDescription, setIsAddingDescription] = useState(false);
  const [isAddingCustomField, setIsAddingCustomField] = useState(false);
  const [isAddingStageApproval, setIsAddingStageApproval] = useState(false);
  const [isAddingStageApprovalField, setIsAddingStageApprovalField] = useState(false);
  const [selectedStageReasons, setSelectedStageReasons] = useState<string[]>([]);
  
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
  const { data: descriptions, isLoading: descriptionsLoading } = useQuery<ProjectType[]>({
    queryKey: ["/api/config/project-descriptions"],
  });

  // Fetch stage-reason mappings
  const { data: stageReasonMaps, isLoading: stageReasonMapsLoading } = useQuery<StageReasonMap[]>({
    queryKey: ["/api/config/stage-reason-maps"],
  });

  // Fetch custom fields
  const { data: customFields, isLoading: customFieldsLoading } = useQuery<ReasonCustomField[]>({
    queryKey: ["/api/config/custom-fields"],
  });

  // Fetch stage approvals
  const { data: stageApprovals, isLoading: stageApprovalsLoading } = useQuery<StageApproval[]>({
    queryKey: ["/api/config/stage-approvals"],
  });

  // Fetch stage approval fields
  const { data: stageApprovalFields, isLoading: stageApprovalFieldsLoading } = useQuery<StageApprovalField[]>({
    queryKey: ["/api/config/stage-approval-fields"],
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

  // Stage-Reason mapping mutations
  const createStageReasonMapMutation = useMutation({
    mutationFn: async ({ stageId, reasonId }: { stageId: string; reasonId: string }) => {
      return await apiRequest("POST", "/api/config/stage-reason-maps", { stageId, reasonId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage-reason mapping created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-reason-maps"] });
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
      toast({ title: "Success", description: "Stage-reason mapping deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-reason-maps"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete stage-reason mapping",
        variant: "destructive",
      });
    },
  });

  // Custom field mutations
  const createCustomFieldMutation = useMutation({
    mutationFn: async (field: Omit<EditingCustomField, 'id'>) => {
      return await apiRequest("POST", "/api/config/custom-fields", field);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Custom field created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/custom-fields"] });
      setIsAddingCustomField(false);
      setEditingCustomField(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create custom field",
        variant: "destructive",
      });
    },
  });

  const updateCustomFieldMutation = useMutation({
    mutationFn: async ({ id, ...field }: EditingCustomField) => {
      return await apiRequest("PATCH", `/api/config/custom-fields/${id}`, field);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Custom field updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/custom-fields"] });
      setEditingCustomField(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update custom field",
        variant: "destructive",
      });
    },
  });

  const deleteCustomFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/config/custom-fields/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Custom field deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/custom-fields"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete custom field",
        variant: "destructive",
      });
    },
  });

  // Stage approval mutations
  const createStageApprovalMutation = useMutation({
    mutationFn: async (stageApproval: Omit<EditingStageApproval, 'id'>) => {
      return await apiRequest("POST", "/api/config/stage-approvals", stageApproval);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage approval created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-approvals"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-approvals"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-approvals"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete stage approval",
        variant: "destructive",
      });
    },
  });

  // Stage approval mapping mutation
  const updateStageApprovalMappingMutation = useMutation({
    mutationFn: async ({ id, stageApprovalId }: { id: string; stageApprovalId: string | null }) => {
      return await apiRequest("PATCH", `/api/config/stages/${id}`, { stageApprovalId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage approval mapping updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/stages"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update stage approval mapping",
        variant: "destructive",
      });
    },
  });

  // Stage approval field mutations
  const createStageApprovalFieldMutation = useMutation({
    mutationFn: async (field: Omit<EditingStageApprovalField, 'id'>) => {
      return await apiRequest("POST", "/api/config/stage-approval-fields", field);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage approval field created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-approval-fields"] });
      setIsAddingStageApprovalField(false);
      setEditingStageApprovalField(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create stage approval field",
        variant: "destructive",
      });
    },
  });

  const updateStageApprovalFieldMutation = useMutation({
    mutationFn: async ({ id, ...field }: EditingStageApprovalField) => {
      return await apiRequest("PATCH", `/api/config/stage-approval-fields/${id}`, field);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage approval field updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-approval-fields"] });
      setEditingStageApprovalField(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update stage approval field",
        variant: "destructive",
      });
    },
  });

  const deleteStageApprovalFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/config/stage-approval-fields/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stage approval field deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-approval-fields"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete stage approval field",
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
      maxInstanceTime: stage.maxInstanceTime || undefined,
      maxTotalTime: stage.maxTotalTime || undefined,
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

    // Validate count label when showCountInProject is enabled
    if (editingReason.showCountInProject && !editingReason.countLabel.trim()) {
      toast({
        title: "Validation Error",
        description: "Count Label is required when 'Show Count in Project' is enabled",
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
      showCountInProject: reason.showCountInProject || false,
      countLabel: reason.countLabel || "",
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

  const handleEditDescription = (description: ProjectType) => {
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

  // Handle stage-reason mapping operations
  const handleToggleStageReasonMapping = (stageId: string, reasonId: string) => {
    const existingMapping = stageReasonMaps?.find(
      map => map.stageId === stageId && map.reasonId === reasonId
    );

    if (existingMapping) {
      deleteStageReasonMapMutation.mutate(existingMapping.id);
    } else {
      createStageReasonMapMutation.mutate({ stageId, reasonId });
    }
  };

  const getStageReasons = (stageId: string) => {
    return stageReasonMaps?.filter(map => map.stageId === stageId) || [];
  };

  // Handle custom field operations
  const handleSaveCustomField = () => {
    if (!editingCustomField) return;

    if (!editingCustomField.fieldName || !editingCustomField.reasonId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (editingCustomField.fieldType === 'multi_select' && (!editingCustomField.options || editingCustomField.options.length === 0)) {
      toast({
        title: "Validation Error",
        description: "Multi-select fields must have at least one option",
        variant: "destructive",
      });
      return;
    }

    // Destructure and send only whitelisted fields that match the API schema
    const { id, newOption, ...fieldData } = editingCustomField;
    
    if (editingCustomField.id) {
      updateCustomFieldMutation.mutate({ id: editingCustomField.id, ...fieldData });
    } else {
      createCustomFieldMutation.mutate(fieldData);
    }
  };

  const handleEditCustomField = (field: ReasonCustomField) => {
    setEditingCustomField({
      id: field.id,
      reasonId: field.reasonId,
      fieldName: field.fieldName,
      fieldType: field.fieldType,
      isRequired: field.isRequired || false,
      placeholder: field.placeholder || "",
      options: field.options || [],
      order: field.order,
    });
    setIsAddingCustomField(false);
  };

  const handleAddCustomField = (reasonId: string) => {
    const reasonFields = customFields?.filter(f => f.reasonId === reasonId) || [];
    const nextOrder = Math.max(0, ...reasonFields.map(f => f.order)) + 1;
    setEditingCustomField({ ...DEFAULT_CUSTOM_FIELD, reasonId, order: nextOrder });
    setIsAddingCustomField(true);
  };

  const getReasonCustomFields = (reasonId: string) => {
    return customFields?.filter(field => field.reasonId === reasonId)
      .sort((a, b) => a.order - b.order) || [];
  };

  // Helper function to check if a reason has numeric custom fields
  const reasonHasNumericFields = (reasonId: string) => {
    const reasonFields = getReasonCustomFields(reasonId);
    return reasonFields.some(field => field.fieldType === 'number');
  };

  // Handle stage approval operations
  const handleSaveStageApproval = () => {
    if (!editingStageApproval) return;

    if (!editingStageApproval.name) {
      toast({
        title: "Validation Error",
        description: "Please enter a stage approval name",
        variant: "destructive",
      });
      return;
    }

    if (editingStageApproval.id) {
      updateStageApprovalMutation.mutate(editingStageApproval);
    } else {
      const { id, ...stageApprovalData } = editingStageApproval;
      createStageApprovalMutation.mutate(stageApprovalData);
    }
  };

  const handleEditStageApproval = (stageApproval: StageApproval) => {
    setEditingStageApproval({
      id: stageApproval.id,
      name: stageApproval.name,
      description: stageApproval.description || "",
    });
    setIsAddingStageApproval(false);
  };

  const handleAddStageApproval = () => {
    setEditingStageApproval({ ...DEFAULT_STAGE_APPROVAL });
    setIsAddingStageApproval(true);
  };

  // Handle stage approval field operations
  const handleSaveStageApprovalField = () => {
    if (!editingStageApprovalField) return;

    // Validate required fields
    if (!editingStageApprovalField.fieldName || !editingStageApprovalField.stageApprovalId) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    // Field type specific validation
    if (editingStageApprovalField.fieldType === 'boolean' && editingStageApprovalField.expectedValueBoolean == null) {
      toast({ title: "Validation Error", description: "Boolean fields require an expected value", variant: "destructive" });
      return;
    }

    if (editingStageApprovalField.fieldType === 'number') {
      if (!editingStageApprovalField.comparisonType || editingStageApprovalField.expectedValueNumber == null) {
        toast({ title: "Validation Error", description: "Number fields require comparison type and expected value", variant: "destructive" });
        return;
      }
    }

    if (editingStageApprovalField.fieldType === 'long_text') {
      // Only isRequired, clear validation fields
      editingStageApprovalField.expectedValueBoolean = undefined;
      editingStageApprovalField.comparisonType = undefined;
      editingStageApprovalField.expectedValueNumber = undefined;
    }

    // Call appropriate mutation
    if (editingStageApprovalField.id) {
      updateStageApprovalFieldMutation.mutate({ id: editingStageApprovalField.id, ...editingStageApprovalField });
    } else {
      createStageApprovalFieldMutation.mutate(editingStageApprovalField);
    }
  };

  const handleEditStageApprovalField = (field: StageApprovalField) => {
    setEditingStageApprovalField({
      id: field.id,
      stageApprovalId: field.stageApprovalId,
      fieldName: field.fieldName,
      fieldType: field.fieldType,
      isRequired: field.isRequired || false,
      order: field.order,
      expectedValueBoolean: field.expectedValueBoolean || undefined,
      comparisonType: field.comparisonType || undefined,
      expectedValueNumber: field.expectedValueNumber || undefined,
    });
    setIsAddingStageApprovalField(false);
  };

  const handleAddStageApprovalField = (stageApprovalId: string) => {
    const approvalFields = stageApprovalFields?.filter(f => f.stageApprovalId === stageApprovalId) || [];
    const nextOrder = Math.max(0, ...approvalFields.map(f => f.order)) + 1;
    setEditingStageApprovalField({ ...DEFAULT_STAGE_APPROVAL_FIELD, stageApprovalId, order: nextOrder });
    setIsAddingStageApprovalField(true);
  };

  const getStageApprovalFields = (stageApprovalId: string) => {
    return stageApprovalFields?.filter(field => field.stageApprovalId === stageApprovalId)
      .sort((a, b) => a.order - b.order) || [];
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="stages">Kanban Stages</TabsTrigger>
              <TabsTrigger value="reasons">Change Reasons</TabsTrigger>
              <TabsTrigger value="descriptions">Project Descriptions</TabsTrigger>
              <TabsTrigger value="approvals">Stage Approvals</TabsTrigger>
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

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="stage-max-instance">Max Instance Time (hours)</Label>
                                <Input
                                  id="stage-max-instance"
                                  type="number"
                                  min="1"
                                  value={editingStage.maxInstanceTime || ''}
                                  onChange={(e) => setEditingStage({
                                    ...editingStage,
                                    maxInstanceTime: e.target.value ? parseInt(e.target.value) || undefined : undefined
                                  })}
                                  data-testid="input-stage-max-instance"
                                  placeholder="Optional"
                                />
                              </div>
                              
                              <div>
                                <Label htmlFor="stage-max-total">Max Total Time (hours)</Label>
                                <Input
                                  id="stage-max-total"
                                  type="number"
                                  min="1"
                                  value={editingStage.maxTotalTime || ''}
                                  onChange={(e) => setEditingStage({
                                    ...editingStage,
                                    maxTotalTime: e.target.value ? parseInt(e.target.value) || undefined : undefined
                                  })}
                                  data-testid="input-stage-max-total"
                                  placeholder="Optional"
                                />
                              </div>
                            </div>

                            {/* Mapped Reasons Section */}
                            <div>
                              <Label>Mapped Reasons</Label>
                              <p className="text-sm text-muted-foreground mb-3">
                                Select which change reasons are valid for this stage
                              </p>
                              {stageReasonMapsLoading ? (
                                <div className="text-center py-4">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto"></div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {reasons?.map((reason) => {
                                    const isChecked = stageReasonMaps?.some(
                                      map => map.stageId === stage.id && map.reasonId === reason.id
                                    );
                                    const reasonLabel = reason.reason;
                                    
                                    return (
                                      <div key={reason.id} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`stage-reason-${reason.id}`}
                                          checked={isChecked}
                                          onCheckedChange={() => handleToggleStageReasonMapping(stage.id, reason.id)}
                                          data-testid={`checkbox-stage-reason-${reason.id}`}
                                        />
                                        <Label
                                          htmlFor={`stage-reason-${reason.id}`}
                                          className="text-sm font-normal cursor-pointer"
                                        >
                                          {reasonLabel}
                                        </Label>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
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
                                {/* Display mapped reasons */}
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {getStageReasons(stage.id).map(mapping => {
                                    const reason = reasons?.find(r => r.id === mapping.reasonId);
                                    if (!reason) return null;
                                    const reasonLabel = reason.reason;
                                    return (
                                      <Badge key={mapping.id} variant="secondary" className="text-xs">
                                        <Link className="w-3 h-3 mr-1" />
                                        {reasonLabel}
                                      </Badge>
                                    );
                                  })}
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

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="new-stage-max-instance">Max Instance Time (hours)</Label>
                            <Input
                              id="new-stage-max-instance"
                              type="number"
                              min="1"
                              value={editingStage.maxInstanceTime || ''}
                              onChange={(e) => setEditingStage({
                                ...editingStage,
                                maxInstanceTime: e.target.value ? parseInt(e.target.value) || undefined : undefined
                              })}
                              data-testid="input-new-stage-max-instance"
                              placeholder="Optional"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="new-stage-max-total">Max Total Time (hours)</Label>
                            <Input
                              id="new-stage-max-total"
                              type="number"
                              min="1"
                              value={editingStage.maxTotalTime || ''}
                              onChange={(e) => setEditingStage({
                                ...editingStage,
                                maxTotalTime: e.target.value ? parseInt(e.target.value) || undefined : undefined
                              })}
                              data-testid="input-new-stage-max-total"
                              placeholder="Optional"
                            />
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
                                data-testid="input-reason-description"
                                placeholder="Enter description"
                              />
                            </div>

                            {/* Custom Fields Section */}
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <Label>Custom Fields</Label>
                                  <p className="text-sm text-muted-foreground">
                                    Add custom fields that will be required when using this reason
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAddCustomField(reason.id)}
                                  data-testid="button-add-custom-field"
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  Add Field
                                </Button>
                              </div>
                              
                              {customFieldsLoading ? (
                                <div className="text-center py-4">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto"></div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {getReasonCustomFields(reason.id).map((field) => (
                                    <div key={field.id} className="flex items-center justify-between p-3 border rounded-lg">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">{field.fieldName}</span>
                                          <Badge variant="outline" className="text-xs">
                                            {FIELD_TYPE_OPTIONS.find(t => t.value === field.fieldType)?.label}
                                          </Badge>
                                          {field.isRequired && (
                                            <Badge variant="destructive" className="text-xs">Required</Badge>
                                          )}
                                        </div>
                                        {field.placeholder && (
                                          <p className="text-sm text-muted-foreground mt-1">{field.placeholder}</p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditCustomField(field)}
                                          data-testid={`button-edit-custom-field-${field.id}`}
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => deleteCustomFieldMutation.mutate(field.id)}
                                          className="text-destructive hover:text-destructive"
                                          data-testid={`button-delete-custom-field-${field.id}`}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {getReasonCustomFields(reason.id).length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                      No custom fields defined for this reason
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Custom Field Editing Form */}
                            {(isAddingCustomField || editingCustomField) && editingCustomField && (
                              <Card className="bg-muted/50 border-dashed">
                                <CardContent className="p-4">
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-medium">
                                        {editingCustomField.id ? 'Edit Custom Field' : 'Add New Custom Field'}
                                      </h4>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label htmlFor="custom-field-name">Field Name</Label>
                                        <Input
                                          id="custom-field-name"
                                          value={editingCustomField.fieldName}
                                          onChange={(e) => setEditingCustomField({
                                            ...editingCustomField,
                                            fieldName: e.target.value
                                          })}
                                          placeholder="Enter field name"
                                          data-testid="input-custom-field-name"
                                        />
                                      </div>
                                      
                                      <div>
                                        <Label htmlFor="custom-field-type">Field Type</Label>
                                        <Select
                                          value={editingCustomField.fieldType}
                                          onValueChange={(value: 'number' | 'short_text' | 'long_text' | 'multi_select') => 
                                            setEditingCustomField({
                                              ...editingCustomField,
                                              fieldType: value,
                                              options: value === 'multi_select' ? editingCustomField.options : []
                                            })
                                          }
                                        >
                                          <SelectTrigger data-testid="select-custom-field-type">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {FIELD_TYPE_OPTIONS.map(option => (
                                              <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <Label htmlFor="custom-field-placeholder">Placeholder Text</Label>
                                      <Input
                                        id="custom-field-placeholder"
                                        value={editingCustomField.placeholder}
                                        onChange={(e) => setEditingCustomField({
                                          ...editingCustomField,
                                          placeholder: e.target.value
                                        })}
                                        placeholder="Enter placeholder text"
                                        data-testid="input-custom-field-placeholder"
                                      />
                                    </div>
                                    
                                    {/* Multi-select options management */}
                                    {editingCustomField.fieldType === 'multi_select' && (
                                      <div>
                                        <Label>Multi-select Options</Label>
                                        <p className="text-sm text-muted-foreground mb-3">
                                          Add the available options for this multi-select field
                                        </p>
                                        
                                        {/* Current options list */}
                                        <div className="space-y-2 mb-3">
                                          {editingCustomField.options.map((option, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                              <div className="flex-1 p-2 bg-muted rounded text-sm">
                                                {option}
                                              </div>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  const newOptions = [...editingCustomField.options];
                                                  newOptions.splice(index, 1);
                                                  setEditingCustomField({
                                                    ...editingCustomField,
                                                    options: newOptions
                                                  });
                                                }}
                                                className="text-destructive hover:text-destructive"
                                                data-testid={`button-delete-option-${index}`}
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </Button>
                                            </div>
                                          ))}
                                          
                                          {editingCustomField.options.length === 0 && (
                                            <p className="text-sm text-muted-foreground text-center py-2">
                                              No options added yet
                                            </p>
                                          )}
                                        </div>
                                        
                                        {/* Add new option */}
                                        <div className="flex gap-2">
                                          <Input
                                            placeholder="Enter new option"
                                            value={editingCustomField.newOption || ''}
                                            onChange={(e) => setEditingCustomField({
                                              ...editingCustomField,
                                              newOption: e.target.value
                                            })}
                                            onKeyPress={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const newOptionValue = (editingCustomField.newOption || '').trim();
                                                if (newOptionValue && !editingCustomField.options.includes(newOptionValue)) {
                                                  setEditingCustomField({
                                                    ...editingCustomField,
                                                    options: [...editingCustomField.options, newOptionValue],
                                                    newOption: ''
                                                  });
                                                }
                                              }
                                            }}
                                            data-testid="input-new-option"
                                          />
                                          <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                              const newOptionValue = (editingCustomField.newOption || '').trim();
                                              if (newOptionValue && !editingCustomField.options.includes(newOptionValue)) {
                                                setEditingCustomField({
                                                  ...editingCustomField,
                                                  options: [...editingCustomField.options, newOptionValue],
                                                  newOption: ''
                                                });
                                              }
                                            }}
                                            disabled={!(editingCustomField.newOption || '').trim() || editingCustomField.options.includes((editingCustomField.newOption || '').trim())}
                                            data-testid="button-add-option"
                                          >
                                            <Plus className="w-4 h-4 mr-1" />
                                            Add
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="flex items-center space-x-2">
                                        <Checkbox
                                          id="custom-field-required"
                                          checked={editingCustomField.isRequired}
                                          onCheckedChange={(checked) => setEditingCustomField({
                                            ...editingCustomField,
                                            isRequired: !!checked
                                          })}
                                          data-testid="checkbox-custom-field-required"
                                        />
                                        <Label htmlFor="custom-field-required">Required field</Label>
                                      </div>
                                      
                                      <div>
                                        <Label htmlFor="custom-field-order">Order</Label>
                                        <Input
                                          id="custom-field-order"
                                          type="number"
                                          value={editingCustomField.order}
                                          onChange={(e) => setEditingCustomField({
                                            ...editingCustomField,
                                            order: parseInt(e.target.value) || 0
                                          })}
                                          data-testid="input-custom-field-order"
                                        />
                                      </div>
                                    </div>
                                    
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={handleSaveCustomField}
                                        disabled={createCustomFieldMutation.isPending || updateCustomFieldMutation.isPending}
                                        data-testid="button-save-custom-field"
                                      >
                                        <Save className="w-4 h-4 mr-2" />
                                        {editingCustomField.id ? 'Save' : 'Create'} Field
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setEditingCustomField(null);
                                          setIsAddingCustomField(false);
                                        }}
                                        data-testid="button-cancel-custom-field"
                                      >
                                        <X className="w-4 h-4 mr-2" />
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )}

                            {/* Progress Tracking Section - Only show if reason has numeric fields */}
                            {reasonHasNumericFields(reason.id) && (
                              <div>
                                <Label>Progress Tracking</Label>
                                <p className="text-sm text-muted-foreground mb-3">
                                  Configure how numeric values from this reason should be displayed in projects
                                </p>
                                
                                <div className="space-y-4">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="show-count-in-project"
                                      checked={editingReason.showCountInProject}
                                      onCheckedChange={(checked) => setEditingReason({
                                        ...editingReason,
                                        showCountInProject: !!checked
                                      })}
                                      data-testid="checkbox-show-count-in-project"
                                    />
                                    <Label htmlFor="show-count-in-project" className="text-sm font-normal cursor-pointer">
                                      Show Count in Project
                                    </Label>
                                  </div>
                                  
                                  {editingReason.showCountInProject && (
                                    <div>
                                      <Label htmlFor="count-label">Count Label</Label>
                                      <Input
                                        id="count-label"
                                        value={editingReason.countLabel}
                                        onChange={(e) => setEditingReason({
                                          ...editingReason,
                                          countLabel: e.target.value
                                        })}
                                        placeholder="e.g., Items Processed, Hours Worked, Documents Reviewed"
                                        data-testid="input-count-label"
                                        className="w-full"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

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
                                {reason.reason}
                              </h3>
                              {reason.description && (
                                <p className="text-sm text-muted-foreground mt-1">{reason.description}</p>
                              )}
                              {/* Display custom fields count */}
                              <div className="flex flex-wrap gap-1 mt-2">
                                {getReasonCustomFields(reason.id).length > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {getReasonCustomFields(reason.id).length} custom field{getReasonCustomFields(reason.id).length !== 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>
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
                                  value={editingDescription?.name || ''}
                                  onChange={(e) => setEditingDescription(editingDescription ? {
                                    ...editingDescription,
                                    name: e.target.value
                                  } : null)}
                                  data-testid="input-description-name"
                                />
                              </div>
                              
                              <div>
                                <Label htmlFor="description-order">Order</Label>
                                <Input
                                  id="description-order"
                                  type="number"
                                  value={editingDescription?.order || 0}
                                  onChange={(e) => setEditingDescription(editingDescription ? {
                                    ...editingDescription,
                                    order: parseInt(e.target.value) || 0
                                  } : null)}
                                  data-testid="input-description-order"
                                />
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="description-active"
                                  checked={editingDescription?.active || false}
                                  onChange={(e) => setEditingDescription(editingDescription ? {
                                    ...editingDescription,
                                    active: e.target.checked
                                  } : null)}
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

            <TabsContent value="approvals" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Stage Approvals</h2>
                  <p className="text-muted-foreground">Manage approval forms that can be linked to workflow stages.</p>
                </div>
                <Button
                  onClick={handleAddStageApproval}
                  data-testid="button-add-stage-approval"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Stage Approval
                </Button>
              </div>

              <div className="grid gap-4">
                {stageApprovalsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : (
                  stageApprovals?.map((stageApproval) => (
                    <Card key={stageApproval.id} className="bg-background">
                      <CardContent className="p-6">
                        {editingStageApproval?.id === stageApproval.id ? (
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="stage-approval-name">Stage Approval Name</Label>
                              <Input
                                id="stage-approval-name"
                                value={editingStageApproval.name}
                                onChange={(e) => setEditingStageApproval({
                                  ...editingStageApproval,
                                  name: e.target.value
                                })}
                                data-testid="input-stage-approval-name"
                                placeholder="Enter stage approval name"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="stage-approval-description">Description (Optional)</Label>
                              <Textarea
                                id="stage-approval-description"
                                value={editingStageApproval.description}
                                onChange={(e) => setEditingStageApproval({
                                  ...editingStageApproval,
                                  description: e.target.value
                                })}
                                data-testid="textarea-stage-approval-description"
                                placeholder="Enter description"
                                rows={3}
                              />
                            </div>

                            {/* Stage Approval Fields Section */}
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <Label>Approval Fields</Label>
                                  <p className="text-sm text-muted-foreground">
                                    Add fields that users must complete for this approval
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAddStageApprovalField(stageApproval.id)}
                                  data-testid="button-add-stage-approval-field"
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  Add Field
                                </Button>
                              </div>
                              
                              {stageApprovalFieldsLoading ? (
                                <div className="text-center py-4">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto"></div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {getStageApprovalFields(stageApproval.id).map((field) => (
                                    <div key={field.id} className="flex items-center justify-between p-3 border rounded-lg">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">{field.fieldName}</span>
                                          <Badge variant="outline" className="text-xs">
                                            {field.fieldType === 'boolean' ? 'Boolean' : 
                                             field.fieldType === 'number' ? 'Number' : 'Long Text'}
                                          </Badge>
                                          {field.isRequired && (
                                            <Badge variant="destructive" className="text-xs">Required</Badge>
                                          )}
                                        </div>
                                        {field.fieldType === 'boolean' && field.expectedValueBoolean != null && (
                                          <p className="text-sm text-muted-foreground mt-1">
                                            Expected: {field.expectedValueBoolean ? 'True' : 'False'}
                                          </p>
                                        )}
                                        {field.fieldType === 'number' && field.comparisonType && field.expectedValueNumber != null && (
                                          <p className="text-sm text-muted-foreground mt-1">
                                            Expected: {field.comparisonType === 'equal_to' ? '=' : 
                                                     field.comparisonType === 'less_than' ? '<' : '>'} {field.expectedValueNumber}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditStageApprovalField(field)}
                                          data-testid={`button-edit-stage-approval-field-${field.id}`}
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => deleteStageApprovalFieldMutation.mutate(field.id)}
                                          className="text-destructive hover:text-destructive"
                                          data-testid={`button-delete-stage-approval-field-${field.id}`}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {getStageApprovalFields(stageApproval.id).length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                      No fields defined for this stage approval
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Stage Approval Field Editing Form */}
                            {(isAddingStageApprovalField || editingStageApprovalField) && editingStageApprovalField && (
                              <Card className="bg-muted/50 border-dashed">
                                <CardContent className="p-4">
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-medium">
                                        {editingStageApprovalField.id ? 'Edit Approval Field' : 'Add New Approval Field'}
                                      </h4>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label htmlFor="stage-approval-field-name">Field Name</Label>
                                        <Input
                                          id="stage-approval-field-name"
                                          value={editingStageApprovalField.fieldName}
                                          onChange={(e) => setEditingStageApprovalField({
                                            ...editingStageApprovalField,
                                            fieldName: e.target.value
                                          })}
                                          placeholder="Enter field name"
                                          data-testid="input-stage-approval-field-name"
                                        />
                                      </div>
                                      
                                      <div>
                                        <Label htmlFor="stage-approval-field-type">Field Type</Label>
                                        <Select
                                          value={editingStageApprovalField.fieldType}
                                          onValueChange={(value: 'boolean' | 'number' | 'long_text') => 
                                            setEditingStageApprovalField({
                                              ...editingStageApprovalField,
                                              fieldType: value,
                                              // Clear validation fields when changing type
                                              expectedValueBoolean: value === 'boolean' ? false : undefined,
                                              comparisonType: value === 'number' ? 'equal_to' : undefined,
                                              expectedValueNumber: value === 'number' ? 0 : undefined,
                                            })
                                          }
                                        >
                                          <SelectTrigger data-testid="select-stage-approval-field-type">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="boolean">Boolean</SelectItem>
                                            <SelectItem value="number">Number</SelectItem>
                                            <SelectItem value="long_text">Long Text</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>

                                    {/* Boolean Field Validation */}
                                    {editingStageApprovalField.fieldType === 'boolean' && (
                                      <div>
                                        <Label>Expected Value</Label>
                                        <div className="flex items-center gap-4 mt-2">
                                          <div className="flex items-center space-x-2">
                                            <input
                                              type="radio"
                                              id="expected-true"
                                              name="expectedValue"
                                              checked={editingStageApprovalField.expectedValueBoolean === true}
                                              onChange={() => setEditingStageApprovalField({
                                                ...editingStageApprovalField,
                                                expectedValueBoolean: true
                                              })}
                                              data-testid="radio-expected-true"
                                            />
                                            <Label htmlFor="expected-true">True</Label>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <input
                                              type="radio"
                                              id="expected-false"
                                              name="expectedValue"
                                              checked={editingStageApprovalField.expectedValueBoolean === false}
                                              onChange={() => setEditingStageApprovalField({
                                                ...editingStageApprovalField,
                                                expectedValueBoolean: false
                                              })}
                                              data-testid="radio-expected-false"
                                            />
                                            <Label htmlFor="expected-false">False</Label>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Number Field Validation */}
                                    {editingStageApprovalField.fieldType === 'number' && (
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <Label htmlFor="comparison-type">Comparison Type</Label>
                                          <Select
                                            value={editingStageApprovalField.comparisonType}
                                            onValueChange={(value: 'equal_to' | 'less_than' | 'greater_than') => 
                                              setEditingStageApprovalField({
                                                ...editingStageApprovalField,
                                                comparisonType: value
                                              })
                                            }
                                          >
                                            <SelectTrigger data-testid="select-comparison-type">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="equal_to">Equal to (=)</SelectItem>
                                              <SelectItem value="less_than">Less than (&lt;)</SelectItem>
                                              <SelectItem value="greater_than">Greater than (&gt;)</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        
                                        <div>
                                          <Label htmlFor="expected-number">Expected Value</Label>
                                          <Input
                                            id="expected-number"
                                            type="number"
                                            value={editingStageApprovalField.expectedValueNumber || ''}
                                            onChange={(e) => setEditingStageApprovalField({
                                              ...editingStageApprovalField,
                                              expectedValueNumber: e.target.value ? parseInt(e.target.value) : 0
                                            })}
                                            placeholder="Enter expected value"
                                            data-testid="input-expected-number"
                                          />
                                        </div>
                                      </div>
                                    )}
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="flex items-center space-x-2">
                                        <Checkbox
                                          id="stage-approval-field-required"
                                          checked={editingStageApprovalField.isRequired}
                                          onCheckedChange={(checked) => setEditingStageApprovalField({
                                            ...editingStageApprovalField,
                                            isRequired: !!checked
                                          })}
                                          data-testid="checkbox-stage-approval-field-required"
                                        />
                                        <Label htmlFor="stage-approval-field-required">Required field</Label>
                                      </div>
                                      
                                      <div>
                                        <Label htmlFor="stage-approval-field-order">Order</Label>
                                        <Input
                                          id="stage-approval-field-order"
                                          type="number"
                                          value={editingStageApprovalField.order}
                                          onChange={(e) => setEditingStageApprovalField({
                                            ...editingStageApprovalField,
                                            order: parseInt(e.target.value) || 0
                                          })}
                                          data-testid="input-stage-approval-field-order"
                                        />
                                      </div>
                                    </div>
                                    
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={handleSaveStageApprovalField}
                                        disabled={createStageApprovalFieldMutation.isPending || updateStageApprovalFieldMutation.isPending}
                                        data-testid="button-save-stage-approval-field"
                                      >
                                        <Save className="w-4 h-4 mr-2" />
                                        {editingStageApprovalField.id ? 'Update Field' : 'Create Field'}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setEditingStageApprovalField(null);
                                          setIsAddingStageApprovalField(false);
                                        }}
                                        data-testid="button-cancel-stage-approval-field"
                                      >
                                        <X className="w-4 h-4 mr-2" />
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )}

                            <div className="flex gap-2">
                              <Button
                                onClick={handleSaveStageApproval}
                                disabled={createStageApprovalMutation.isPending || updateStageApprovalMutation.isPending}
                                data-testid="button-save-stage-approval"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                Save
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditingStageApproval(null);
                                  setIsAddingStageApproval(false);
                                }}
                                data-testid="button-cancel-stage-approval"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium">{stageApproval.name}</h3>
                              {stageApproval.description && (
                                <p className="text-sm text-muted-foreground mt-1">{stageApproval.description}</p>
                              )}
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                                <Badge variant="outline">
                                  {getStageApprovalFields(stageApproval.id).length} field(s)
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditStageApproval(stageApproval)}
                                data-testid={`button-edit-stage-approval-${stageApproval.id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteStageApprovalMutation.mutate(stageApproval.id)}
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-delete-stage-approval-${stageApproval.id}`}
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

                {/* Add new stage approval form */}
                {isAddingStageApproval && editingStageApproval && !editingStageApproval.id && (
                  <Card className="bg-background border-dashed">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="new-stage-approval-name">Stage Approval Name</Label>
                          <Input
                            id="new-stage-approval-name"
                            value={editingStageApproval.name}
                            onChange={(e) => setEditingStageApproval({
                              ...editingStageApproval,
                              name: e.target.value
                            })}
                            data-testid="input-new-stage-approval-name"
                            placeholder="Enter stage approval name"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="new-stage-approval-description">Description (Optional)</Label>
                          <Textarea
                            id="new-stage-approval-description"
                            value={editingStageApproval.description}
                            onChange={(e) => setEditingStageApproval({
                              ...editingStageApproval,
                              description: e.target.value
                            })}
                            data-testid="textarea-new-stage-approval-description"
                            placeholder="Enter description"
                            rows={3}
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={handleSaveStageApproval}
                            disabled={createStageApprovalMutation.isPending}
                            data-testid="button-create-stage-approval"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Create Stage Approval
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingStageApproval(null);
                              setIsAddingStageApproval(false);
                            }}
                            data-testid="button-cancel-new-stage-approval"
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

              {/* Stage Approval Mappings Section */}
              <div className="mt-8 space-y-6">
                <div className="border-t pt-6">
                  <div>
                    <h3 className="text-lg font-semibold">Stage Approval Mappings</h3>
                    <p className="text-muted-foreground">Link kanban stages to approval forms that must be completed before stage transitions</p>
                  </div>
                </div>

                <div className="grid gap-4">
                  {stagesLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    </div>
                  ) : (
                    stages?.map((stage) => {
                      const currentApproval = stageApprovals?.find(approval => approval.id === stage.stageApprovalId);
                      const isSaving = updateStageApprovalMappingMutation.isPending && updateStageApprovalMappingMutation.variables?.id === stage.id;
                      
                      return (
                        <Card key={stage.id} className="bg-background">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div 
                                  className="w-4 h-4 rounded-full" 
                                  style={{ backgroundColor: stage.color || '#6b7280' }}
                                ></div>
                                <div>
                                  <h4 className="font-medium">{stage.name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {currentApproval ? `Mapped to: ${currentApproval.name}` : 'No approval required'}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-3">
                                <Select
                                  value={stage.stageApprovalId || "none"}
                                  onValueChange={(value) => {
                                    const stageApprovalId = value === "none" ? null : value;
                                    updateStageApprovalMappingMutation.mutate({ 
                                      id: stage.id, 
                                      stageApprovalId 
                                    });
                                  }}
                                  disabled={stageApprovalsLoading || isSaving}
                                >
                                  <SelectTrigger 
                                    className="w-[250px]" 
                                    data-testid={`select-stage-approval-${stage.id}`}
                                  >
                                    <SelectValue placeholder="Select approval form" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none" data-testid="select-item-none">None</SelectItem>
                                    {stageApprovals?.map((approval) => (
                                      <SelectItem key={approval.id} value={approval.id} data-testid={`select-item-approval-${approval.id}`}>
                                        {approval.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                
                                {isSaving && (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                  
                  {!stagesLoading && (!stages || stages.length === 0) && (
                    <Card className="bg-background">
                      <CardContent className="p-6 text-center">
                        <p className="text-muted-foreground">No kanban stages configured. Create stages first in the Kanban Stages tab.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}