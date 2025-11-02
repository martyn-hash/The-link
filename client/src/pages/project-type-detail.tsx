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
  StageApprovalField,
  WorkRole,
  Service,
  User
} from "@shared/schema";
import TopNavigation from "@/components/top-navigation";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Edit2, Trash2, Save, X, ArrowLeft, Settings, Layers, List, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface EditingStage {
  id?: string;
  name: string;
  assignedRole?: string;
  assignedWorkRoleId?: string;
  assignedUserId?: string;
  order: number;
  color: string;
  maxInstanceTime?: number;
  maxTotalTime?: number;
  stageApprovalId?: string;
  canBeFinalStage?: boolean;
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
  fieldType: 'boolean' | 'number' | 'long_text' | 'multi_select';
  isRequired: boolean;
  order: number;
  // For all field types
  placeholder?: string;
  // Boolean validation
  expectedValueBoolean?: boolean;
  // Number validation  
  comparisonType?: 'equal_to' | 'less_than' | 'greater_than';
  expectedValueNumber?: number;
  // Multi-select options
  options?: string[];
}

const DEFAULT_STAGE: EditingStage = {
  name: "",
  assignedRole: "client_manager",
  order: 0,
  color: "#6b7280",
  canBeFinalStage: false,
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

// System roles fallback for backward compatibility
const SYSTEM_ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "client_manager", label: "Client Manager" },
  { value: "bookkeeper", label: "Bookkeeper" },
];

const STAGE_COLORS = [
  "#6b7280", "#ef4444", "#f97316", "#eab308", 
  "#22c55e", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"
];

// Custom field form component
function CustomFieldForm({ 
  reasonId, 
  onSuccess, 
  onCancel, 
  createMutation,
  existingFields 
}: {
  reasonId: string;
  onSuccess: () => void;
  onCancel: () => void;
  createMutation: any;
  existingFields: any[];
}) {
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState<"number" | "short_text" | "long_text" | "multi_select">("short_text");
  const [isRequired, setIsRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState("");
  const [options, setOptions] = useState<string[]>([""]);

  const handleSubmit = () => {
    if (!fieldName.trim()) {
      return;
    }

    const fieldData = {
      reasonId,
      fieldName: fieldName.trim(),
      fieldType,
      isRequired,
      placeholder: placeholder.trim() || undefined,
      options: fieldType === "multi_select" ? options.filter(o => o.trim()) : undefined,
      order: existingFields.length
    };

    createMutation.mutate(fieldData, {
      onSuccess: () => {
        onSuccess();
      }
    });
  };

  const addOption = () => {
    setOptions([...options, ""]);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="field-name">Field Name</Label>
          <Input
            id="field-name"
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            placeholder="Enter field name"
            data-testid="input-custom-field-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="field-type">Field Type</Label>
          <Select
            value={fieldType}
            onValueChange={(value: any) => setFieldType(value)}
          >
            <SelectTrigger data-testid="select-custom-field-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="short_text">Short Text</SelectItem>
              <SelectItem value="long_text">Long Text</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="multi_select">Multi Select</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="field-placeholder">Placeholder (Optional)</Label>
        <Input
          id="field-placeholder"
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          placeholder="Enter placeholder text"
          data-testid="input-custom-field-placeholder"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="field-required"
          checked={isRequired}
          onCheckedChange={(checked) => setIsRequired(!!checked)}
          data-testid="checkbox-custom-field-required"
        />
        <Label htmlFor="field-required">Required field</Label>
      </div>

      {fieldType === "multi_select" && (
        <div className="space-y-2">
          <Label>Options</Label>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  data-testid={`input-custom-field-option-${index}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= 1}
                  data-testid={`button-remove-option-${index}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addOption}
            data-testid="button-add-option"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Option
          </Button>
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          data-testid="button-cancel-custom-field"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!fieldName.trim() || (fieldType === "multi_select" && options.filter(o => o.trim()).length === 0)}
          data-testid="button-save-custom-field"
        >
          Add Field
        </Button>
      </div>
    </div>
  );
}

// Approval field form component (similar to CustomFieldForm but for stage approvals)
function ApprovalFieldForm({ 
  stageApprovalId, 
  onSuccess, 
  onCancel, 
  createMutation,
  updateMutation,
  existingFields,
  editingField 
}: {
  stageApprovalId: string;
  onSuccess: () => void;
  onCancel: () => void;
  createMutation: any;
  updateMutation?: any;
  existingFields: any[];
  editingField?: any;
}) {
  const [fieldName, setFieldName] = useState(editingField?.fieldName || "");
  const [fieldType, setFieldType] = useState<"boolean" | "number" | "long_text" | "multi_select">(editingField?.fieldType || "boolean");
  const [isRequired, setIsRequired] = useState(editingField?.isRequired || false);
  const [placeholder, setPlaceholder] = useState(editingField?.placeholder || "");
  const [options, setOptions] = useState<string[]>(editingField?.options || [""]);
  
  // Boolean validation fields
  const [expectedValueBoolean, setExpectedValueBoolean] = useState<boolean>(editingField?.expectedValueBoolean !== undefined ? editingField.expectedValueBoolean : true);
  
  // Number validation fields
  const [comparisonType, setComparisonType] = useState<"equal_to" | "less_than" | "greater_than">(editingField?.comparisonType || "equal_to");
  const [expectedValueNumber, setExpectedValueNumber] = useState<number>(editingField?.expectedValueNumber || 0);

  const handleSubmit = () => {
    if (!fieldName.trim()) {
      return;
    }

    // Validation for required fields based on field type
    if (fieldType === "boolean" && expectedValueBoolean === undefined) {
      return;
    }
    if (fieldType === "number" && (!comparisonType || expectedValueNumber === undefined)) {
      return;
    }
    if (fieldType === "multi_select" && options.filter(o => o.trim()).length === 0) {
      return;
    }

    const fieldData = {
      stageApprovalId,
      fieldName: fieldName.trim(),
      fieldType,
      isRequired,
      placeholder: placeholder.trim() || undefined,
      // Boolean validation
      expectedValueBoolean: fieldType === "boolean" ? expectedValueBoolean : undefined,
      // Number validation
      comparisonType: fieldType === "number" ? comparisonType : undefined,
      expectedValueNumber: fieldType === "number" ? expectedValueNumber : undefined,
      // Multi-select options
      options: fieldType === "multi_select" ? options.filter(o => o.trim()) : undefined,
      order: editingField ? editingField.order : existingFields.length
    };

    if (editingField) {
      // Update existing field
      updateMutation.mutate({ id: editingField.id, field: fieldData }, {
        onSuccess: () => {
          onSuccess();
        }
      });
    } else {
      // Create new field
      createMutation.mutate(fieldData, {
        onSuccess: () => {
          onSuccess();
        }
      });
    }
  };

  const addOption = () => {
    setOptions([...options, ""]);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="approval-field-name">Field Name</Label>
          <Input
            id="approval-field-name"
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            placeholder="Enter field name"
            data-testid="input-approval-field-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="approval-field-type">Field Type</Label>
          <Select
            value={fieldType}
            onValueChange={(value: any) => setFieldType(value)}
          >
            <SelectTrigger data-testid="select-approval-field-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="boolean">Boolean</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="long_text">Long Text</SelectItem>
              <SelectItem value="multi_select">Multi Select</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="approval-field-placeholder">Placeholder (Optional)</Label>
        <Input
          id="approval-field-placeholder"
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          placeholder="Enter placeholder text"
          data-testid="input-approval-field-placeholder"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="approval-field-required"
          checked={isRequired}
          onCheckedChange={(checked) => setIsRequired(!!checked)}
          data-testid="checkbox-approval-field-required"
        />
        <Label htmlFor="approval-field-required">Required field</Label>
      </div>

      {/* Boolean field validation */}
      {fieldType === "boolean" && (
        <div className="space-y-2">
          <Label>Expected Value for Approval</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="expected-value-boolean"
              checked={expectedValueBoolean}
              onCheckedChange={setExpectedValueBoolean}
              data-testid="switch-expected-value-boolean"
            />
            <Label htmlFor="expected-value-boolean">
              Field must be {expectedValueBoolean ? "true" : "false"} for approval
            </Label>
          </div>
        </div>
      )}

      {/* Number field validation */}
      {fieldType === "number" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comparison-type">Comparison Type</Label>
            <Select
              value={comparisonType}
              onValueChange={(value: any) => setComparisonType(value)}
            >
              <SelectTrigger data-testid="select-comparison-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal_to">Equal to</SelectItem>
                <SelectItem value="less_than">Less than</SelectItem>
                <SelectItem value="greater_than">Greater than</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expected-value-number">Expected Value</Label>
            <Input
              id="expected-value-number"
              type="number"
              value={expectedValueNumber}
              onChange={(e) => setExpectedValueNumber(parseInt(e.target.value) || 0)}
              placeholder="Enter expected value"
              data-testid="input-expected-value-number"
            />
          </div>
        </div>
      )}

      {/* Multi-select options */}
      {fieldType === "multi_select" && (
        <div className="space-y-2">
          <Label>Options</Label>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  data-testid={`input-approval-field-option-${index}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= 1}
                  data-testid={`button-remove-approval-option-${index}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addOption}
            data-testid="button-add-approval-option"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Option
          </Button>
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          data-testid="button-cancel-approval-field"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={
            !fieldName.trim() || 
            (fieldType === "boolean" && expectedValueBoolean === undefined) ||
            (fieldType === "number" && (!comparisonType || expectedValueNumber === undefined)) ||
            (fieldType === "multi_select" && options.filter(o => o.trim()).length === 0)
          }
          data-testid="button-save-approval-field"
        >
          {editingField ? "Update Field" : "Add Field"}
        </Button>
      </div>
    </div>
  );
}

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
  
  // State for stage-reason mappings
  const [selectedStageReasons, setSelectedStageReasons] = useState<string[]>([]);
  const [selectedStageApprovalId, setSelectedStageApprovalId] = useState<string | null>(null);
  
  // State for custom fields management
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [isAddingCustomField, setIsAddingCustomField] = useState(false);
  const [isAddingApprovalField, setIsAddingApprovalField] = useState(false);
  
  // State for settings (service linkage)
  const [isEditingServiceLinkage, setIsEditingServiceLinkage] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

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
      const response = await fetch(`/api/config/project-types?inactive=true`);
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

  // Fetch roles for this project type (service-specific roles if mapped, empty array if not)
  const { data: projectTypeRoles, isLoading: rolesLoading } = useQuery<WorkRole[]>({
    queryKey: ["/api/config/project-types", projectTypeId, "roles"],
    enabled: !!projectTypeId && isAuthenticated && !!user,
  });

  // Fetch all users for non-service project types
  const { data: allUsers, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!projectType && !projectType.serviceId && isAuthenticated && !!user,
  });

  // Use service-specific roles for service-linked project types, or users for non-service types
  const availableRoles = projectType?.serviceId
    ? (projectTypeRoles && projectTypeRoles.length > 0 
        ? projectTypeRoles.map(role => ({ value: role.id, label: role.name }))
        : SYSTEM_ROLE_OPTIONS)
    : (allUsers
        ? allUsers.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))
        : []);

  // Helper function to get role label for a stage
  const getStageRoleLabel = (stage: any) => {
    // For service-linked project types, check assignedWorkRoleId first
    if (projectType?.serviceId && stage.assignedWorkRoleId) {
      const serviceRole = availableRoles.find(r => r.value === stage.assignedWorkRoleId);
      return serviceRole ? serviceRole.label : "Unknown Service Role";
    }
    
    // For non-service project types, check assignedUserId
    if (!projectType?.serviceId && stage.assignedUserId) {
      const assignedUser = allUsers?.find(u => u.id === stage.assignedUserId);
      return assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : "Assigned User";
    }
    
    // Legacy support: check assignedRole for existing stages
    if (stage.assignedRole) {
      const role = availableRoles.find(r => r.value === stage.assignedRole);
      return role ? role.label : stage.assignedRole;
    }
    
    return "Unknown";
  };

  // Fetch all stage approval fields (needed for managing approval fields)
  const { data: allStageApprovalFields, isLoading: stageApprovalFieldsLoading } = useQuery<StageApprovalField[]>({
    queryKey: ["/api/config/stage-approval-fields"],
    enabled: isAuthenticated && !!user,
  });
  
  // Fetch all stage-reason mappings
  const { data: allStageReasonMaps } = useQuery<any[]>({
    queryKey: ["/api/config/stage-reason-maps"],
    enabled: isAuthenticated && !!user,
  });
  
  // Fetch all custom fields for reasons
  const { data: allCustomFields } = useQuery<any[]>({
    queryKey: ["/api/config/custom-fields"],
    enabled: isAuthenticated && !!user,
    staleTime: 0, // Always consider data stale so it refetches
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Fetch all services for settings tab (service linkage)
  const { data: allServices } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    enabled: isAuthenticated && !!user,
  });

  // Handle unauthorized errors only - project not found is handled inline
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
  }, [projectTypeError, toast]);

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
  
  // Stage-Reason mapping mutations
  const createStageReasonMapMutation = useMutation({
    mutationFn: async ({ stageId, reasonId }: { stageId: string; reasonId: string }) => {
      return await apiRequest("POST", "/api/config/stage-reason-maps", { stageId, reasonId });
    },
    onSuccess: () => {
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

  // Project type settings mutations
  const updateProjectTypeServiceLinkageMutation = useMutation({
    mutationFn: async (serviceId: string | null) => {
      if (!projectTypeId) throw new Error("No project type selected");
      // Explicitly pass null when removing service linkage, not undefined
      return await apiRequest("PATCH", `/api/config/project-types/${projectTypeId}`, { 
        serviceId: serviceId 
      });
    },
    onSuccess: () => {
      toast({ 
        title: "Success", 
        description: "Service linkage updated successfully. Please review your stage assignments." 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId, "roles"] });
      setIsEditingServiceLinkage(false);
      setSelectedServiceId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update service linkage",
        variant: "destructive",
      });
    },
  });
  
  // Custom field mutations
  const createCustomFieldMutation = useMutation({
    mutationFn: async (field: any) => {
      return await apiRequest("POST", "/api/config/custom-fields", field);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/config/custom-fields"] });
      toast({
        title: "Success",
        description: "Custom field added successfully",
      });
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
    mutationFn: async ({ id, ...field }: any) => {
      return await apiRequest("PATCH", `/api/config/custom-fields/${id}`, field);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/custom-fields"] });
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/config/custom-fields"] });
      toast({
        title: "Success",
        description: "Custom field deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete custom field",
        variant: "destructive",
      });
    },
  });
  
  // Project Type Active Status Mutation
  const updateProjectTypeActiveMutation = useMutation({
    mutationFn: async (active: boolean) => {
      if (!projectTypeId) throw new Error("No project type ID");
      return await apiRequest("PATCH", `/api/config/project-types/${projectTypeId}`, {
        active
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Project type status updated successfully",
      });
      // Invalidate queries to refresh the project type data
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId] });
    },
    onError: (error: any) => {
      // Handle specific error cases
      if (error.status === 409 && error.code === "PROJECTS_USING_TYPE") {
        toast({
          title: "Cannot Deactivate Project Type",
          description: error.message,
          variant: "destructive",
        });
      } else if (error.status === 400 && error.code === "NO_FINAL_STAGE") {
        toast({
          title: "Cannot Activate Project Type",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to update project type status",
          variant: "destructive",
        });
      }
    },
  });

  const handleActiveToggle = (checked: boolean) => {
    // If trying to activate, check if there's at least one final stage
    if (checked && stages) {
      const hasFinalStage = stages.some((stage: any) => stage.canBeFinalStage === true);
      if (!hasFinalStage) {
        toast({
          title: "Cannot Activate Project Type",
          description: "At least one stage must be marked as 'Can be final Stage' before activating this project type.",
          variant: "destructive",
        });
        return;
      }
    }
    updateProjectTypeActiveMutation.mutate(checked);
  };

  // Project Type Single Project Per Client Mutation
  const updateProjectTypeSingleProjectMutation = useMutation({
    mutationFn: async (singleProjectPerClient: boolean) => {
      if (!projectTypeId) throw new Error("No project type ID");
      return await apiRequest("PATCH", `/api/config/project-types/${projectTypeId}`, {
        singleProjectPerClient
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Project type setting updated successfully",
      });
      // Invalidate queries to refresh the project type data
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config/project-types", projectTypeId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update project type setting",
        variant: "destructive",
      });
    },
  });

  const handleSingleProjectToggle = (checked: boolean) => {
    updateProjectTypeSingleProjectMutation.mutate(checked);
  };
  
  // Stage approval field mutations
  const createApprovalFieldMutation = useMutation({
    mutationFn: async (field: any) => {
      return await apiRequest("POST", "/api/config/stage-approval-fields", field);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-approval-fields"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create approval field",
        variant: "destructive",
      });
    },
  });
  
  const updateApprovalFieldMutation = useMutation({
    mutationFn: async ({ id, field }: { id: string; field: any }) => {
      return await apiRequest("PATCH", `/api/config/stage-approval-fields/${id}`, field);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-approval-fields"] });
      toast({
        title: "Success",
        description: "Approval field updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update approval field",
        variant: "destructive",
      });
    },
  });
  
  const deleteApprovalFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/config/stage-approval-fields/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-approval-fields"] });
      toast({
        title: "Success",
        description: "Approval field deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete approval field",
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
      <div className="min-h-screen bg-background flex flex-col">
        <TopNavigation user={user} />
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
      <div className="min-h-screen bg-background flex flex-col">
        <TopNavigation user={user} />
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

  const handleStageSubmit = async () => {
    if (!editingStage) return;
    
    try {
      // Prepare stage data with correct assignment fields
      let stageData = { ...editingStage };
      
      // Clean up assignment fields based on project type
      if (projectType?.serviceId) {
        // Service-linked: ensure only assignedWorkRoleId is set
        stageData.assignedRole = undefined;
        stageData.assignedUserId = undefined;
        
        // Client-side validation: require service role selection
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
        
        // Client-side validation: require user selection
        if (!stageData.assignedUserId) {
          toast({
            title: "Validation Error",
            description: "Please select a user",
            variant: "destructive",
          });
          return;
        }
      }

      console.log("Project type detail - submitting stage data:", stageData);
      
      // Save the stage first
      if (editingStage.id) {
        await updateStageMutation.mutateAsync(stageData);
      } else {
        // Strip id field for creation to avoid validation errors
        const { id, ...createData } = stageData;
        const createdStage = await createStageMutation.mutateAsync(createData);
        if (createdStage && typeof createdStage === 'object' && 'id' in createdStage) {
          editingStage.id = (createdStage as any).id;
        }
      }
      
      // Handle stage-reason mappings if editing an existing stage
      if (editingStage.id && allStageReasonMaps) {
        const existingMappings = allStageReasonMaps.filter((map: any) => map.stageId === editingStage.id);
        
        // Remove mappings that are no longer selected
        for (const mapping of existingMappings) {
          if (!selectedStageReasons.includes(mapping.reasonId)) {
            await deleteStageReasonMapMutation.mutateAsync(mapping.id);
          }
        }
        
        // Add new mappings
        for (const reasonId of selectedStageReasons) {
          const existingMapping = existingMappings.find((m: any) => m.reasonId === reasonId);
          if (!existingMapping) {
            await createStageReasonMapMutation.mutateAsync({ stageId: editingStage.id, reasonId });
          }
        }
      }
      
      // Handle stage approval mapping
      if (editingStage.id && selectedStageApprovalId !== editingStage.stageApprovalId) {
        editingStage.stageApprovalId = selectedStageApprovalId || undefined;
        const updateData = { ...editingStage, stageApprovalId: selectedStageApprovalId || undefined };
        await updateStageMutation.mutateAsync(updateData);
      }
      
    } catch (error) {
      console.error("Error saving stage:", error);
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
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
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
                <div className="flex items-center space-x-4">
                  <h1 className="text-2xl font-semibold text-foreground flex items-center" data-testid="text-project-type-name">
                    <Settings className="w-6 h-6 mr-3 text-primary" />
                    {projectType.name}
                  </h1>
                  <div className="flex items-center space-x-6">
                    {/* Active/Inactive Toggle */}
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="active-toggle"
                        checked={projectType.active !== false}
                        onCheckedChange={handleActiveToggle}
                        disabled={updateProjectTypeActiveMutation.isPending}
                        data-testid="switch-active-project-type"
                      />
                      <Label 
                        htmlFor="active-toggle" 
                        className="text-sm font-medium cursor-pointer"
                        data-testid="label-active-project-type"
                      >
                        {projectType.active !== false ? "Active" : "Inactive"}
                      </Label>
                    </div>
                    
                    {/* Single Project Per Client Toggle */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center space-x-2" data-testid="tooltip-trigger-single-project">
                            <Switch
                              id="single-project-toggle"
                              checked={projectType.singleProjectPerClient === true}
                              onCheckedChange={handleSingleProjectToggle}
                              disabled={updateProjectTypeSingleProjectMutation.isPending}
                              data-testid="switch-single-project-per-client"
                            />
                            <Label 
                              htmlFor="single-project-toggle" 
                              className="text-sm font-medium cursor-pointer"
                              data-testid="label-single-project-per-client"
                            >
                              Single Project Per Client
                            </Label>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent data-testid="tooltip-content-single-project">
                          <p className="max-w-xs">
                            When enabled, scheduling a new project will automatically archive any active projects of this type for the same client as unsuccessfully completed.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
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
              <TabsList className="grid w-full max-w-2xl grid-cols-4">
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
                <TabsTrigger value="settings" className="flex items-center" data-testid="tab-settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
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
                    setSelectedStageReasons([]);
                    setSelectedStageApprovalId(null);
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
                            {getStageRoleLabel(stage)}
                          </Badge>
                          {(stage as any).canBeFinalStage && (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700" data-testid={`badge-final-stage-${stage.id}`}>
                              Final Stage
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingStage({
                                id: stage.id,
                                name: stage.name,
                                assignedRole: stage.assignedRole || undefined,
                                assignedWorkRoleId: (stage as any).assignedWorkRoleId || undefined,
                                assignedUserId: (stage as any).assignedUserId || undefined,
                                order: stage.order,
                                color: stage.color || "#6b7280",
                                maxInstanceTime: stage.maxInstanceTime || undefined,
                                maxTotalTime: stage.maxTotalTime || undefined,
                                canBeFinalStage: (stage as any).canBeFinalStage || false
                              });
                              
                              // Load existing mappings for this stage
                              if (allStageReasonMaps) {
                                const stageMappings = allStageReasonMaps.filter((map: any) => map.stageId === stage.id);
                                setSelectedStageReasons(stageMappings.map((m: any) => m.reasonId));
                              }
                              
                              // Set stage approval
                              setSelectedStageApprovalId(stage.stageApprovalId || null);
                            }}
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
                      setSelectedStageReasons([]);
                      setSelectedStageApprovalId(null);
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
                        <Label htmlFor="stage-role">
                          {projectType?.serviceId ? "Assigned Service Role" : "Assigned User"}
                        </Label>
                        <Select
                          value={projectType?.serviceId 
                            ? (editingStage?.assignedWorkRoleId || "") 
                            : (editingStage?.assignedUserId || "")
                          }
                          onValueChange={(value) => {
                            if (projectType?.serviceId) {
                              setEditingStage(prev => ({ 
                                ...prev!, 
                                assignedWorkRoleId: value,
                                assignedUserId: undefined,
                                assignedRole: undefined
                              }));
                            } else {
                              setEditingStage(prev => ({ 
                                ...prev!, 
                                assignedUserId: value,
                                assignedWorkRoleId: undefined,
                                assignedRole: undefined
                              }));
                            }
                          }}
                          disabled={rolesLoading || usersLoading}
                        >
                          <SelectTrigger data-testid="select-stage-role">
                            <SelectValue placeholder={rolesLoading ? "Loading..." : 
                              projectType?.serviceId ? "Select service role" : "Select user"} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRoles.map(role => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {projectType?.serviceId && (
                          <p className="text-xs text-muted-foreground">
                            Using service-specific roles
                          </p>
                        )}
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

                    {/* Stage Approval Selection */}
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="stage-approval">Stage Approval (Optional)</Label>
                      <Select
                        value={selectedStageApprovalId || "none"}
                        onValueChange={(value) => setSelectedStageApprovalId(value === "none" ? null : value)}
                      >
                        <SelectTrigger data-testid="select-stage-approval">
                          <SelectValue placeholder="Select stage approval" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No approval required</SelectItem>
                          {stageApprovals?.map(approval => (
                            <SelectItem key={approval.id} value={approval.id}>
                              {approval.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Can be final Stage */}
                    <div className="space-y-2 col-span-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="can-be-final-stage"
                          checked={editingStage?.canBeFinalStage || false}
                          onCheckedChange={(checked) => {
                            setEditingStage(prev => ({ 
                              ...prev!, 
                              canBeFinalStage: checked === true 
                            }));
                          }}
                          data-testid="checkbox-can-be-final-stage"
                        />
                        <Label htmlFor="can-be-final-stage" className="text-sm font-normal">
                          Can be final Stage
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Allow projects to be marked as complete when in this stage
                      </p>
                    </div>

                    {/* Change Reasons Selection */}
                    <div className="space-y-2 col-span-2">
                      <Label>Change Reasons for this Stage</Label>
                      <p className="text-sm text-muted-foreground">
                        Select which change reasons can be used when transitioning from this stage
                      </p>
                      <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                        {reasonsLoading ? (
                          <p className="text-sm text-muted-foreground">Loading change reasons...</p>
                        ) : reasons && reasons.length > 0 ? (
                          <div className="space-y-2">
                            {reasons.map(reason => (
                              <div key={reason.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`reason-${reason.id}`}
                                  checked={selectedStageReasons.includes(reason.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedStageReasons(prev => [...prev, reason.id]);
                                    } else {
                                      setSelectedStageReasons(prev => prev.filter(id => id !== reason.id));
                                    }
                                  }}
                                  data-testid={`checkbox-stage-reason-${reason.id}`}
                                />
                                <Label htmlFor={`reason-${reason.id}`} className="text-sm flex-1">
                                  {reason.reason}
                                  {reason.description && (
                                    <span className="text-muted-foreground ml-1">
                                      - {reason.description}
                                    </span>
                                  )}
                                </Label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No change reasons configured. Add change reasons first.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 mt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingStage(null);
                          setIsAddingStage(false);
                          setSelectedStageReasons([]);
                          setSelectedStageApprovalId(null);
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

                      {/* Custom Fields Section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Custom Fields</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsAddingCustomField(true)}
                            data-testid="button-add-custom-field"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Custom Field
                          </Button>
                        </div>
                        
                        <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                          {editingReason?.id && allCustomFields ? (
                            allCustomFields.filter(field => field.reasonId === editingReason.id).length > 0 ? (
                              <div className="space-y-2">
                                {allCustomFields
                                  .filter(field => field.reasonId === editingReason.id)
                                  .sort((a, b) => a.order - b.order)
                                  .map((field, index) => (
                                    <div key={field.id} className="flex items-center justify-between p-2 border rounded">
                                      <div className="flex-1">
                                        <div className="text-sm font-medium">{field.fieldName}</div>
                                        <div className="text-xs text-muted-foreground">
                                          Type: {field.fieldType} {field.isRequired && "(Required)"}
                                        </div>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => deleteCustomFieldMutation.mutate(field.id)}
                                        data-testid={`button-delete-custom-field-${field.id}`}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No custom fields configured for this reason
                              </p>
                            )
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Save the reason first to add custom fields
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Add Custom Field Form */}
                      {isAddingCustomField && editingReason?.id && (
                        <Card className="mt-4">
                          <CardHeader>
                            <CardTitle className="text-base">Add Custom Field</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <CustomFieldForm 
                              reasonId={editingReason.id}
                              onSuccess={() => setIsAddingCustomField(false)}
                              onCancel={() => setIsAddingCustomField(false)}
                              createMutation={createCustomFieldMutation}
                              existingFields={allCustomFields?.filter(f => f.reasonId === editingReason.id) || []}
                            />
                          </CardContent>
                        </Card>
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
                          {allStageApprovalFields?.filter(f => f.stageApprovalId === approval.id).length || 0} fields configured
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

                      {/* Stage Approval Fields Section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Approval Fields</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsAddingApprovalField(true);
                              setEditingStageApprovalField(null);
                            }}
                            data-testid="button-add-approval-field"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Approval Field
                          </Button>
                        </div>
                        
                        <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                          {editingStageApproval?.id && allStageApprovalFields ? (
                            allStageApprovalFields?.filter(field => field.stageApprovalId === editingStageApproval.id).length > 0 ? (
                              <div className="space-y-2">
                                {allStageApprovalFields
                                  ?.filter(field => field.stageApprovalId === editingStageApproval.id)
                                  .sort((a, b) => a.order - b.order)
                                  .map((field, index) => (
                                    <div key={field.id} className="flex items-center justify-between p-2 border rounded">
                                      <div className="flex-1">
                                        <div className="text-sm font-medium">{field.fieldName}</div>
                                        <div className="text-xs text-muted-foreground">
                                          Type: {field.fieldType} {field.isRequired && "(Required)"}
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-1">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setEditingStageApprovalField({
                                              ...field,
                                              isRequired: field.isRequired ?? false,
                                            });
                                            setIsAddingApprovalField(false);
                                          }}
                                          data-testid={`button-edit-approval-field-${field.id}`}
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => deleteApprovalFieldMutation.mutate(field.id)}
                                          data-testid={`button-delete-approval-field-${field.id}`}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No approval fields configured for this stage approval
                              </p>
                            )
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Save the stage approval first to add approval fields
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Add/Edit Approval Field Form */}
                      {(isAddingApprovalField || editingStageApprovalField) && editingStageApproval?.id && (
                        <Card className="mt-4">
                          <CardHeader>
                            <CardTitle className="text-base">
                              {editingStageApprovalField ? "Edit Approval Field" : "Add Approval Field"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ApprovalFieldForm 
                              key={editingStageApprovalField?.id || 'new'}
                              stageApprovalId={editingStageApproval.id}
                              onSuccess={() => {
                                setIsAddingApprovalField(false);
                                setEditingStageApprovalField(null);
                              }}
                              onCancel={() => {
                                setIsAddingApprovalField(false);
                                setEditingStageApprovalField(null);
                              }}
                              createMutation={createApprovalFieldMutation}
                              updateMutation={updateApprovalFieldMutation}
                              existingFields={allStageApprovalFields?.filter(f => f.stageApprovalId === editingStageApproval.id) || []}
                              editingField={editingStageApprovalField}
                            />
                          </CardContent>
                        </Card>
                      )}
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

            {/* Settings Tab */}
            <TabsContent value="settings" className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Project Type Settings</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Configure the assignment system for this project type
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    Service Linkage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Current Status */}
                  <div className="space-y-2">
                    <Label>Current Assignment System</Label>
                    <div className="p-4 bg-muted rounded-lg">
                      {projectType?.serviceId ? (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Badge variant="default">Roles-Based</Badge>
                            <span className="text-sm text-muted-foreground">
                              Linked to service: <strong>{allServices?.find(s => s.id === projectType.serviceId)?.name || "Unknown Service"}</strong>
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Stage assignments use work roles from the linked service. Users are assigned based on their role mappings in each client service.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary">User-Based</Badge>
                            <span className="text-sm text-muted-foreground">Not linked to any service</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Stage assignments use direct user selection. Each stage must be assigned to a specific user.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Edit Mode */}
                  {isEditingServiceLinkage ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                          ⚠️ Important: Changing the Assignment System
                        </h4>
                        <ul className="text-xs text-yellow-800 dark:text-yellow-200 space-y-1 list-disc list-inside">
                          <li>All existing stage assignments will need to be reviewed and updated</li>
                          <li>Switching to roles-based requires configuring role assignments for each client service</li>
                          <li>Switching to user-based requires assigning specific users to each stage</li>
                          <li>Active projects using this project type may be affected</li>
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="service-select">Link to Service (Optional)</Label>
                        <Select
                          value={selectedServiceId || "none"}
                          onValueChange={(value) => setSelectedServiceId(value === "none" ? null : value)}
                        >
                          <SelectTrigger data-testid="select-service-linkage">
                            <SelectValue placeholder="Select a service or choose none" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Service (User-Based Assignments)</SelectItem>
                            {allServices
                              ?.filter(s => !s.isStaticService && !s.isPersonalService)
                              .map((service) => (
                                <SelectItem key={service.id} value={service.id}>
                                  {service.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {selectedServiceId ? (
                            <>Switching to <strong>roles-based</strong> assignment system using service roles</>
                          ) : (
                            <>Switching to <strong>user-based</strong> assignment system with direct user selection</>
                          )}
                        </p>
                      </div>

                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditingServiceLinkage(false);
                            setSelectedServiceId(null);
                          }}
                          data-testid="button-cancel-service-linkage"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                        <Button
                          onClick={() => {
                            updateProjectTypeServiceLinkageMutation.mutate(selectedServiceId);
                          }}
                          disabled={updateProjectTypeServiceLinkageMutation.isPending}
                          data-testid="button-save-service-linkage"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditingServiceLinkage(true);
                          setSelectedServiceId(projectType?.serviceId || null);
                        }}
                        data-testid="button-edit-service-linkage"
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Change Assignment System
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Information Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Assignment System Guide</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Roles-Based Assignments</h4>
                    <p className="text-xs text-muted-foreground">
                      When a project type is linked to a service, stage assignments use work roles. For each client service:
                    </p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside mt-1 space-y-1 ml-2">
                      <li>Configure which users fill each work role</li>
                      <li>Projects automatically assign users based on role mappings</li>
                      <li>Changes to role assignments affect all projects using that client service</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-2">User-Based Assignments</h4>
                    <p className="text-xs text-muted-foreground">
                      When a project type is not linked to a service, stage assignments use direct user selection:
                    </p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside mt-1 space-y-1 ml-2">
                      <li>Each stage template must specify a user directly</li>
                      <li>All projects inherit the same user assignments from the template</li>
                      <li>Simpler setup but less flexible for different client needs</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}