import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Plus,
  Trash2,
  ShieldCheck,
  Settings2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Library,
  Eye,
  Pencil,
} from "lucide-react";
import type {
  ProjectType,
  KanbanStage,
  StageApproval,
  ClientStageApprovalOverride,
  ApprovalFieldLibrary,
} from "@shared/schema";
import { ClientTaskOverridesSection } from "./ClientTaskOverridesSection";

interface ApprovalOverridesTabProps {
  clientId: string;
}

interface OverrideWithDetails extends ClientStageApprovalOverride {
  projectType?: ProjectType;
  stage?: KanbanStage;
  overrideApproval?: StageApproval;
}

const FIELD_TYPES = [
  { value: "boolean", label: "Yes/No Toggle" },
  { value: "number", label: "Number" },
  { value: "short_text", label: "Short Text" },
  { value: "long_text", label: "Long Text" },
  { value: "single_select", label: "Single Select" },
  { value: "multi_select", label: "Multi Select" },
  { value: "date", label: "Date" },
] as const;

type FieldType = typeof FIELD_TYPES[number]["value"];

interface EditingField {
  id?: string;
  fieldName: string;
  fieldType: FieldType;
  description: string;
  isRequired: boolean;
  order: number;
  options: string[];
  libraryFieldId?: string | null;
  expectedValueBoolean?: boolean | null;
  expectedValueNumber?: number | null;
  comparisonType?: "equal_to" | "less_than" | "greater_than" | null;
}

const DEFAULT_FIELD: EditingField = {
  fieldName: "",
  fieldType: "boolean",
  description: "",
  isRequired: true,
  order: 0,
  options: [],
  libraryFieldId: null,
  expectedValueBoolean: null,
  expectedValueNumber: null,
  comparisonType: null,
};

export function ApprovalOverridesTab({ clientId }: ApprovalOverridesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedProjectTypeId, setSelectedProjectTypeId] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [isCreatingOverride, setIsCreatingOverride] = useState(false);
  const [newApprovalName, setNewApprovalName] = useState("");
  const [newApprovalDescription, setNewApprovalDescription] = useState("");
  const [copyFromStandard, setCopyFromStandard] = useState(true);
  const [deleteOverrideId, setDeleteOverrideId] = useState<string | null>(null);
  
  const [expandedOverrideId, setExpandedOverrideId] = useState<string | null>(null);
  const [isAddingField, setIsAddingField] = useState(false);
  const [editingField, setEditingField] = useState<EditingField | null>(null);
  const [isEditingExistingField, setIsEditingExistingField] = useState(false);
  const [viewingField, setViewingField] = useState<any | null>(null);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);

  const { data: projectTypes, isLoading: projectTypesLoading } = useQuery<ProjectType[]>({
    queryKey: ["/api/config/project-types"],
  });

  const { data: allStages } = useQuery<KanbanStage[]>({
    queryKey: ["/api/config/stages"],
  });

  const stages = useMemo(() => {
    if (!allStages || !selectedProjectTypeId) return [];
    return allStages.filter(s => s.projectTypeId === selectedProjectTypeId);
  }, [allStages, selectedProjectTypeId]);

  const { data: overrides, isLoading: overridesLoading } = useQuery<ClientStageApprovalOverride[]>({
    queryKey: ["/api/clients", clientId, "approval-overrides"],
  });

  const { data: libraryFields } = useQuery<ApprovalFieldLibrary[]>({
    queryKey: ["/api/project-types", selectedProjectTypeId, "approval-field-library"],
    enabled: !!selectedProjectTypeId,
  });

  const { data: stageApprovals } = useQuery<StageApproval[]>({
    queryKey: ["/api/config/stage-approvals"],
  });

  const expandedOverride = useMemo(() => 
    overrides?.find(o => o.id === expandedOverrideId),
    [overrides, expandedOverrideId]
  );

  const { data: resolvedFields } = useQuery<any[]>({
    queryKey: ["/api/stage-approvals", expandedOverride?.overrideApprovalId, "resolved-fields"],
    enabled: !!expandedOverride?.overrideApprovalId,
  });

  const selectedStageHasStandardApproval = useMemo(() => {
    if (!selectedStageId || !stages) return false;
    const stage = stages.find(s => s.id === selectedStageId);
    return !!stage?.stageApprovalId;
  }, [selectedStageId, stages]);

  const existingOverrideForStage = useMemo(() => {
    if (!overrides || !selectedStageId || !selectedProjectTypeId) return null;
    return overrides.find(o => 
      o.stageId === selectedStageId && o.projectTypeId === selectedProjectTypeId
    );
  }, [overrides, selectedStageId, selectedProjectTypeId]);

  const createOverrideMutation = useMutation({
    mutationFn: async (data: { 
      projectTypeId: string;
      stageId: string;
      approvalName: string;
      approvalDescription?: string;
      copyFromStandard?: boolean;
    }) => {
      const res = await apiRequest("POST", `/api/clients/${clientId}/approval-overrides`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "approval-overrides"] });
      setIsCreatingOverride(false);
      setNewApprovalName("");
      setNewApprovalDescription("");
      setCopyFromStandard(true);
      setSelectedProjectTypeId("");
      setSelectedStageId("");
      const message = variables.copyFromStandard 
        ? "Custom approval created with fields copied from standard."
        : "Custom approval created. You can now add fields.";
      toast({ title: "Custom approval created", description: message });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const deleteOverrideMutation = useMutation({
    mutationFn: async (overrideId: string) => {
      await apiRequest("DELETE", `/api/clients/${clientId}/approval-overrides/${overrideId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "approval-overrides"] });
      setDeleteOverrideId(null);
      toast({ title: "Custom approval removed", description: "This stage now uses the standard approval form." });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const addFieldMutation = useMutation({
    mutationFn: async (data: { overrideId: string; field: EditingField }) => {
      const override = overrides?.find(o => o.id === data.overrideId);
      if (!override) throw new Error("Override not found");
      
      const res = await apiRequest("POST", `/api/config/stage-approval-fields`, {
        ...data.field,
        stageApprovalId: override.overrideApprovalId,
      });
      return res;
    },
    onSuccess: () => {
      if (expandedOverride?.overrideApprovalId) {
        queryClient.invalidateQueries({ queryKey: ["/api/stage-approvals", expandedOverride.overrideApprovalId, "resolved-fields"] });
      }
      setIsAddingField(false);
      setEditingField(null);
      toast({ title: "Field added" });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (fieldId: string) => {
      await apiRequest("DELETE", `/api/config/stage-approval-fields/${fieldId}`);
    },
    onSuccess: () => {
      if (expandedOverride?.overrideApprovalId) {
        queryClient.invalidateQueries({ queryKey: ["/api/stage-approvals", expandedOverride.overrideApprovalId, "resolved-fields"] });
      }
      toast({ title: "Field removed" });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: async (data: { fieldId: string; field: EditingField }) => {
      const payload: Record<string, any> = {
        fieldName: data.field.fieldName,
        description: data.field.description || null,
        isRequired: data.field.isRequired,
      };
      
      // Only include type-specific fields for the current field type
      if (data.field.fieldType === "boolean") {
        payload.expectedValueBoolean = data.field.expectedValueBoolean;
      } else if (data.field.fieldType === "number") {
        payload.comparisonType = data.field.comparisonType;
        payload.expectedValueNumber = data.field.expectedValueNumber;
      } else if (data.field.fieldType === "single_select" || data.field.fieldType === "multi_select") {
        payload.options = data.field.options;
      }
      
      const res = await apiRequest("PATCH", `/api/config/stage-approval-fields/${data.fieldId}`, payload);
      return res;
    },
    onSuccess: () => {
      if (expandedOverride?.overrideApprovalId) {
        queryClient.invalidateQueries({ queryKey: ["/api/stage-approvals", expandedOverride.overrideApprovalId, "resolved-fields"] });
      }
      setIsAddingField(false);
      setEditingField(null);
      setIsEditingExistingField(false);
      toast({ title: "Field updated" });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const handleCreateOverride = () => {
    if (!selectedProjectTypeId || !selectedStageId || !newApprovalName.trim()) {
      toast({ title: "Missing information", description: "Please select a project type, stage, and enter an approval name.", variant: "destructive" });
      return;
    }
    
    createOverrideMutation.mutate({
      projectTypeId: selectedProjectTypeId,
      stageId: selectedStageId,
      approvalName: newApprovalName.trim(),
      approvalDescription: newApprovalDescription.trim() || undefined,
      copyFromStandard,
    });
  };

  const handleAddFieldFromLibrary = (libraryField: ApprovalFieldLibrary) => {
    setEditingField({
      ...DEFAULT_FIELD,
      fieldName: libraryField.fieldName,
      fieldType: libraryField.fieldType as FieldType,
      description: libraryField.description || "",
      libraryFieldId: libraryField.id,
      options: libraryField.options || [],
    });
    setShowLibraryPicker(false);
    setIsAddingField(true);
  };

  const handleSaveField = () => {
    if (!editingField || !expandedOverrideId) return;
    
    if (isEditingExistingField && editingField.id) {
      updateFieldMutation.mutate({ fieldId: editingField.id, field: editingField });
    } else {
      addFieldMutation.mutate({ overrideId: expandedOverrideId, field: editingField });
    }
  };

  const handleEditField = (field: any) => {
    setEditingField({
      id: field.id,
      fieldName: field.fieldName,
      fieldType: field.fieldType as FieldType,
      description: field.description || "",
      isRequired: field.isRequired,
      order: field.order,
      options: field.options || [],
      libraryFieldId: field.libraryFieldId,
      expectedValueBoolean: field.expectedValueBoolean,
      expectedValueNumber: field.expectedValueNumber,
      comparisonType: field.comparisonType,
    });
    setIsEditingExistingField(true);
    setIsAddingField(true);
  };

  const enrichedOverrides: OverrideWithDetails[] = useMemo(() => {
    if (!overrides || !projectTypes || !allStages) return [];
    return overrides.map(override => {
      const projectType = projectTypes.find(pt => pt.id === override.projectTypeId);
      const stage = allStages.find(s => s.id === override.stageId);
      const overrideApproval = stageApprovals?.find(a => a.id === override.overrideApprovalId);
      return { ...override, projectType, stage, overrideApproval };
    });
  }, [overrides, projectTypes, allStages, stageApprovals]);

  if (overridesLoading || projectTypesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Custom Approval Forms</h2>
          <p className="text-muted-foreground text-sm">
            Configure custom approval requirements for specific stages. Overrides the standard approval form.
          </p>
        </div>
        <Button onClick={() => setIsCreatingOverride(true)} data-testid="button-create-override">
          <Plus className="w-4 h-4 mr-2" />
          Add Custom Approval
        </Button>
      </div>

      {enrichedOverrides.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No custom approvals configured</h3>
            <p className="text-muted-foreground mb-4">
              This client uses the standard approval forms for all stages.
            </p>
            <Button onClick={() => setIsCreatingOverride(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Custom Approval
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {enrichedOverrides.map((override) => (
            <Card key={override.id} data-testid={`card-override-${override.id}`}>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => setExpandedOverrideId(expandedOverrideId === override.id ? null : override.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Settings2 className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-base" data-testid={`text-override-name-${override.id}`}>
                        {override.overrideApproval?.name || "Custom Approval"}
                      </CardTitle>
                      <CardDescription>
                        {override.projectType?.name} → {override.stage?.name}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Custom</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteOverrideId(override.id);
                      }}
                      data-testid={`button-delete-override-${override.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    {expandedOverrideId === override.id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </CardHeader>
              
              {expandedOverrideId === override.id && (
                <CardContent className="pt-0 border-t">
                  <div className="pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Approval Fields</h4>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowLibraryPicker(true)}
                          data-testid="button-add-from-library"
                        >
                          <Library className="w-4 h-4 mr-2" />
                          From Library
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingField({ ...DEFAULT_FIELD, order: (resolvedFields?.length || 0) + 1 });
                            setIsAddingField(true);
                          }}
                          data-testid="button-add-custom-field"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Custom Field
                        </Button>
                      </div>
                    </div>
                    
                    {resolvedFields && resolvedFields.length > 0 ? (
                      <div className="border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Field Name</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Required</TableHead>
                              <TableHead>Source</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {resolvedFields.map((field: any) => (
                              <TableRow key={field.id} data-testid={`row-field-${field.id}`}>
                                <TableCell className="font-medium">
                                  <span data-testid={`text-field-name-${field.id}`}>
                                    {field.fieldName}
                                  </span>
                                  {field.description && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                      {field.description}
                                    </p>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {FIELD_TYPES.find(t => t.value === field.fieldType)?.label || field.fieldType}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {field.isRequired ? (
                                    <Badge variant="secondary" className="text-xs">Required</Badge>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {field.libraryFieldId ? (
                                    <Badge variant="outline" className="text-xs bg-blue-50">
                                      <Library className="w-3 h-3 mr-1" />
                                      Library
                                    </Badge>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">Custom</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={() => setViewingField(field)}
                                      data-testid={`button-view-field-${field.id}`}
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      View
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditField(field)}
                                      data-testid={`button-edit-field-${field.id}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteFieldMutation.mutate(field.id)}
                                      data-testid={`button-delete-field-${field.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No fields configured yet. Add fields to define the approval requirements.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isCreatingOverride} onOpenChange={setIsCreatingOverride}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Custom Approval</DialogTitle>
            <DialogDescription>
              Create a custom approval form for a specific stage. This will override the standard approval for this client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Project Type</Label>
              <Select value={selectedProjectTypeId} onValueChange={(v) => {
                setSelectedProjectTypeId(v);
                setSelectedStageId("");
              }}>
                <SelectTrigger data-testid="select-project-type">
                  <SelectValue placeholder="Select project type" />
                </SelectTrigger>
                <SelectContent>
                  {projectTypes?.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={selectedStageId} onValueChange={(v) => {
                setSelectedStageId(v);
                const stage = stages.find(s => s.id === v);
                setCopyFromStandard(!!stage?.stageApprovalId);
              }} disabled={!selectedProjectTypeId}>
                <SelectTrigger data-testid="select-stage">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No stages in this project type
                    </div>
                  ) : (
                    stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                        {stage.stageApprovalId && <span className="ml-2 text-muted-foreground">(has standard approval)</span>}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {existingOverrideForStage && (
                <p className="text-sm text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  This stage already has a custom approval
                </p>
              )}
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label>Approval Name</Label>
              <Input
                value={newApprovalName}
                onChange={(e) => setNewApprovalName(e.target.value)}
                placeholder="e.g., Enhanced Review Checklist"
                data-testid="input-approval-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={newApprovalDescription}
                onChange={(e) => setNewApprovalDescription(e.target.value)}
                placeholder="Describe the purpose of this custom approval"
                data-testid="textarea-approval-description"
              />
            </div>

            <Separator />

            <div className="flex items-center space-x-3">
              <Switch
                id="copy-from-standard"
                checked={copyFromStandard}
                onCheckedChange={setCopyFromStandard}
                disabled={!selectedStageHasStandardApproval}
                data-testid="switch-copy-from-standard"
              />
              <div className="space-y-0.5">
                <Label htmlFor="copy-from-standard" className={`font-medium cursor-pointer ${!selectedStageHasStandardApproval ? 'text-muted-foreground' : ''}`}>
                  Copy fields from standard approval
                </Label>
                <p className="text-xs text-muted-foreground">
                  {selectedStageHasStandardApproval 
                    ? "Start with the same fields as the standard approval, then customize as needed."
                    : "This stage has no standard approval to copy from. You'll start with a blank form."}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingOverride(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateOverride}
              disabled={createOverrideMutation.isPending || !selectedProjectTypeId || !selectedStageId || !newApprovalName.trim() || !!existingOverrideForStage}
              data-testid="button-confirm-create-override"
            >
              {createOverrideMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLibraryPicker} onOpenChange={setShowLibraryPicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Field from Library</DialogTitle>
            <DialogDescription>
              Select a field from the shared library. Using library fields enables cross-client analytics.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 max-h-96 overflow-y-auto">
            {libraryFields && libraryFields.length > 0 ? (
              libraryFields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleAddFieldFromLibrary(field)}
                  data-testid={`library-field-${field.id}`}
                >
                  <div>
                    <p className="font-medium text-sm">{field.fieldName}</p>
                    <p className="text-xs text-muted-foreground">{field.description}</p>
                  </div>
                  <Badge variant="outline">
                    {FIELD_TYPES.find(t => t.value === field.fieldType)?.label || field.fieldType}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Library className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No library fields available yet.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddingField} onOpenChange={(open) => {
        setIsAddingField(open);
        if (!open) {
          setEditingField(null);
          setIsEditingExistingField(false);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEditingExistingField 
                ? "Edit Field" 
                : editingField?.libraryFieldId 
                  ? "Configure Library Field" 
                  : "Add Custom Field"}
            </DialogTitle>
          </DialogHeader>
          {editingField && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Field Name</Label>
                <Input
                  value={editingField.fieldName}
                  onChange={(e) => setEditingField({ ...editingField, fieldName: e.target.value })}
                  placeholder="e.g., Bank Reconciliation Complete"
                  disabled={!!editingField.libraryFieldId}
                  data-testid="input-field-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Field Type</Label>
                <Select 
                  value={editingField.fieldType} 
                  onValueChange={(v) => setEditingField({ ...editingField, fieldType: v as FieldType })}
                  disabled={!!editingField.libraryFieldId}
                >
                  <SelectTrigger data-testid="select-field-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingField.description}
                  onChange={(e) => setEditingField({ ...editingField, description: e.target.value })}
                  placeholder="Explain what this field checks"
                  data-testid="textarea-field-description"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Required</Label>
                <Switch
                  checked={editingField.isRequired}
                  onCheckedChange={(checked) => setEditingField({ ...editingField, isRequired: checked })}
                  data-testid="switch-field-required"
                />
              </div>
              
              {editingField.fieldType === "boolean" && (
                <div className="space-y-2">
                  <Label>Expected Value</Label>
                  <Select 
                    value={editingField.expectedValueBoolean === true ? "true" : editingField.expectedValueBoolean === false ? "false" : "any"}
                    onValueChange={(v) => setEditingField({ 
                      ...editingField, 
                      expectedValueBoolean: v === "any" ? null : v === "true"
                    })}
                  >
                    <SelectTrigger data-testid="select-expected-boolean">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any value</SelectItem>
                      <SelectItem value="true">Must be Yes</SelectItem>
                      <SelectItem value="false">Must be No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {editingField.fieldType === "number" && (
                <div className="space-y-2">
                  <Label>Validation</Label>
                  <div className="flex gap-2">
                    <Select 
                      value={editingField.comparisonType || "none"}
                      onValueChange={(v) => setEditingField({ 
                        ...editingField, 
                        comparisonType: v === "none" ? null : v as "equal_to" | "less_than" | "greater_than"
                      })}
                    >
                      <SelectTrigger data-testid="select-comparison-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No validation</SelectItem>
                        <SelectItem value="equal_to">Equal to</SelectItem>
                        <SelectItem value="less_than">Less than</SelectItem>
                        <SelectItem value="greater_than">Greater than</SelectItem>
                      </SelectContent>
                    </Select>
                    {editingField.comparisonType && (
                      <Input
                        type="number"
                        value={editingField.expectedValueNumber ?? ""}
                        onChange={(e) => setEditingField({ 
                          ...editingField, 
                          expectedValueNumber: e.target.value ? Number(e.target.value) : null
                        })}
                        placeholder="Value"
                        className="w-24"
                        data-testid="input-expected-number"
                      />
                    )}
                  </div>
                </div>
              )}
              
              {(editingField.fieldType === "single_select" || editingField.fieldType === "multi_select") && (
                <div className="space-y-2">
                  <Label>Options (one per line)</Label>
                  <Textarea
                    value={editingField.options.join("\n")}
                    onChange={(e) => setEditingField({ 
                      ...editingField, 
                      options: e.target.value.split("\n").filter(o => o.trim())
                    })}
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                    rows={4}
                    data-testid="textarea-field-options"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { 
              setIsAddingField(false); 
              setEditingField(null); 
              setIsEditingExistingField(false);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveField}
              disabled={(isEditingExistingField ? updateFieldMutation.isPending : addFieldMutation.isPending) || !editingField?.fieldName.trim()}
              data-testid="button-save-field"
            >
              {(isEditingExistingField ? updateFieldMutation.isPending : addFieldMutation.isPending) 
                ? "Saving..." 
                : isEditingExistingField 
                  ? "Save Changes" 
                  : "Add Field"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingField} onOpenChange={(open) => !open && setViewingField(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Field Details</DialogTitle>
          </DialogHeader>
          {viewingField && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Field Name</Label>
                  <p className="font-medium" data-testid="view-field-name">{viewingField.fieldName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Type</Label>
                  <Badge variant="outline">
                    {FIELD_TYPES.find(t => t.value === viewingField.fieldType)?.label || viewingField.fieldType}
                  </Badge>
                </div>
              </div>
              
              {viewingField.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">Description</Label>
                  <p className="text-sm" data-testid="view-field-description">{viewingField.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Required</Label>
                  <p className="text-sm">{viewingField.isRequired ? "Yes" : "No"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Source</Label>
                  <p className="text-sm">{viewingField.libraryFieldId ? "From Library" : "Custom"}</p>
                </div>
              </div>
              
              {viewingField.fieldType === "boolean" && (
                <div>
                  <Label className="text-muted-foreground text-xs">Expected Value</Label>
                  <p className="text-sm">
                    {viewingField.expectedValueBoolean === null || viewingField.expectedValueBoolean === undefined
                      ? "Any value"
                      : viewingField.expectedValueBoolean 
                        ? "Must be Yes" 
                        : "Must be No"}
                  </p>
                </div>
              )}
              
              {viewingField.fieldType === "number" && viewingField.comparisonType && (
                <div>
                  <Label className="text-muted-foreground text-xs">Validation</Label>
                  <p className="text-sm">
                    {viewingField.comparisonType === "equal_to" && `Equal to ${viewingField.expectedValueNumber}`}
                    {viewingField.comparisonType === "less_than" && `Less than ${viewingField.expectedValueNumber}`}
                    {viewingField.comparisonType === "greater_than" && `Greater than ${viewingField.expectedValueNumber}`}
                  </p>
                </div>
              )}
              
              {(viewingField.fieldType === "single_select" || viewingField.fieldType === "multi_select") && 
               viewingField.options && viewingField.options.length > 0 && (
                <div>
                  <Label className="text-muted-foreground text-xs">Options</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {viewingField.options.map((opt: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">{opt}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => {
                handleEditField(viewingField);
                setViewingField(null);
              }}
              data-testid="button-edit-from-view"
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button onClick={() => setViewingField(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteOverrideId} onOpenChange={() => setDeleteOverrideId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Custom Approval?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the custom approval for this stage. The client will use the standard approval form instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteOverrideId && deleteOverrideMutation.mutate(deleteOverrideId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-override"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClientTaskOverridesSection clientId={clientId} />
    </div>
  );
}
