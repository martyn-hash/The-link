import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  ShieldCheck,
  Edit2,
  Eye,
  ClipboardCheck,
  MoreVertical,
} from "lucide-react";
import type {
  ProjectType,
  KanbanStage,
  StageApproval,
  ClientStageApprovalOverride,
} from "@shared/schema";
import { ClientTaskOverridesSection } from "./ClientTaskOverridesSection";
import type { EnhancedClientService } from "../../utils/types";
import { ApprovalWizard, type ApprovalFormData, type EditingApprovalField } from "@/components/approval-builder/ApprovalWizard";

interface ApprovalOverridesTabProps {
  clientId: string;
}

interface OverrideWithDetails extends ClientStageApprovalOverride {
  projectType?: ProjectType;
  stage?: KanbanStage;
  overrideApproval?: StageApproval;
}

type BuilderMode = null | { mode: "create"; selectedProjectTypeId?: string } | { mode: "edit"; override: OverrideWithDetails } | { mode: "view"; override: OverrideWithDetails };

function OverrideRow({ 
  override, 
  onView, 
  onEdit, 
  onDelete 
}: { 
  override: OverrideWithDetails; 
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <TableRow data-testid={`row-override-${override.id}`}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-4 h-4 text-primary" />
          </div>
          <span data-testid={`text-name-${override.id}`}>
            {override.overrideApproval?.name || "Custom Approval"}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm" data-testid={`text-project-type-${override.id}`}>
          {override.projectType?.name || "-"}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-sm" data-testid={`text-stage-${override.id}`}>
          {override.stage?.name || "-"}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          Custom
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-actions-${override.id}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView} data-testid={`button-view-${override.id}`}>
              <Eye className="w-4 h-4 mr-2" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit} data-testid={`button-edit-${override.id}`}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={onDelete} 
              className="text-destructive focus:text-destructive"
              data-testid={`button-delete-${override.id}`}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export function ApprovalOverridesTab({ clientId }: ApprovalOverridesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [builderState, setBuilderState] = useState<BuilderMode>(null);
  const [deleteOverrideId, setDeleteOverrideId] = useState<string | null>(null);
  const [createModeProjectTypeId, setCreateModeProjectTypeId] = useState<string | null>(null);

  const { data: projectTypes, isLoading: projectTypesLoading } = useQuery<ProjectType[]>({
    queryKey: ["/api/config/project-types"],
  });

  const { data: allStages } = useQuery<KanbanStage[]>({
    queryKey: ["/api/config/stages"],
  });

  const { data: clientServices } = useQuery<EnhancedClientService[]>({
    queryKey: [`/api/client-services/client/${clientId}`],
    enabled: !!clientId,
  });

  const filteredProjectTypes = useMemo(() => {
    if (!projectTypes || !clientServices) return [];
    const clientServiceIds = new Set(clientServices.map(cs => cs.serviceId));
    return projectTypes.filter(pt => pt.serviceId && clientServiceIds.has(pt.serviceId));
  }, [projectTypes, clientServices]);

  const { data: overrides, isLoading: overridesLoading } = useQuery<ClientStageApprovalOverride[]>({
    queryKey: ["/api/clients", clientId, "approval-overrides"],
  });

  const { data: stageApprovals } = useQuery<StageApproval[]>({
    queryKey: ["/api/config/stage-approvals"],
  });

  const activeProjectTypeId = builderState?.mode === "edit" || builderState?.mode === "view" 
    ? builderState.override.projectTypeId 
    : builderState?.mode === "create" 
      ? createModeProjectTypeId
      : null;

  const handleProjectTypeChangeInBuilder = (projectTypeId: string) => {
    setCreateModeProjectTypeId(projectTypeId);
  };

  const activeOverrideApprovalId = builderState?.mode === "edit" || builderState?.mode === "view"
    ? builderState.override.overrideApprovalId
    : null;

  const { data: resolvedFields } = useQuery<any[]>({
    queryKey: ["/api/stage-approvals", activeOverrideApprovalId, "resolved-fields"],
    enabled: !!activeOverrideApprovalId,
  });

  const createOverrideMutation = useMutation({
    mutationFn: async (data: ApprovalFormData) => {
      const res = await apiRequest("POST", `/api/clients/${clientId}/approval-overrides`, {
        projectTypeId: data.projectTypeId,
        stageId: data.stageId,
        approvalName: data.name,
        approvalDescription: data.description || undefined,
        copyFromStandard: false,
      });
      
      const override = res as { id: string; overrideApprovalId: string };
      
      for (let i = 0; i < data.fields.length; i++) {
        const field = data.fields[i];
        const isSelectType = ["single_select", "multi_select"].includes(field.fieldType);
        
        if (isSelectType && (!field.options || field.options.length === 0)) {
          throw new Error(`Field "${field.fieldName || 'Untitled'}" is a select field and requires at least one option.`);
        }
        
        await apiRequest("POST", `/api/config/stage-approval-fields`, {
          stageApprovalId: override.overrideApprovalId,
          fieldName: field.fieldName,
          fieldType: field.fieldType,
          description: field.description || null,
          isRequired: field.isRequired,
          order: i,
          options: field.options && field.options.length > 0 ? field.options : null,
          libraryFieldId: field.libraryFieldId || null,
          expectedValueBoolean: field.expectedValueBoolean,
          expectedValueNumber: field.expectedValueNumber,
          comparisonType: field.comparisonType,
        });
      }
      
      return override;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "approval-overrides"] });
      setBuilderState(null);
      toast({ title: "Custom approval created", description: "Your custom approval form is now active." });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const updateOverrideMutation = useMutation({
    mutationFn: async (data: { overrideId: string; approvalId: string; formData: ApprovalFormData; existingFieldIds: string[] }) => {
      await apiRequest("PATCH", `/api/config/stage-approvals/${data.approvalId}`, {
        name: data.formData.name,
        description: data.formData.description || null,
      });
      
      const newFieldIds = data.formData.fields.filter(f => f.id).map(f => f.id!);
      
      for (const fieldId of data.existingFieldIds) {
        if (!newFieldIds.includes(fieldId)) {
          await apiRequest("DELETE", `/api/config/stage-approval-fields/${fieldId}`);
        }
      }
      
      for (let i = 0; i < data.formData.fields.length; i++) {
        const field = data.formData.fields[i];
        const isSelectType = ["single_select", "multi_select"].includes(field.fieldType);
        
        if (isSelectType && (!field.options || field.options.length === 0)) {
          throw new Error(`Field "${field.fieldName || 'Untitled'}" is a select field and requires at least one option.`);
        }
        
        const fieldData = {
          stageApprovalId: data.approvalId,
          fieldName: field.fieldName,
          fieldType: field.fieldType,
          description: field.description || null,
          isRequired: field.isRequired,
          order: i,
          options: field.options && field.options.length > 0 ? field.options : null,
          libraryFieldId: field.libraryFieldId || null,
          expectedValueBoolean: field.expectedValueBoolean,
          expectedValueNumber: field.expectedValueNumber,
          comparisonType: field.comparisonType,
        };
        
        if (field.id) {
          await apiRequest("PATCH", `/api/config/stage-approval-fields/${field.id}`, fieldData);
        } else {
          await apiRequest("POST", `/api/config/stage-approval-fields`, fieldData);
        }
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "approval-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stage-approvals"] });
      setBuilderState(null);
      toast({ title: "Approval updated", description: "Your changes have been saved." });
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

  const enrichedOverrides: OverrideWithDetails[] = useMemo(() => {
    if (!overrides || !projectTypes || !allStages) return [];
    return overrides.map(override => {
      const projectType = projectTypes.find(pt => pt.id === override.projectTypeId);
      const stage = allStages.find(s => s.id === override.stageId);
      const overrideApproval = stageApprovals?.find(a => a.id === override.overrideApprovalId);
      return { ...override, projectType, stage, overrideApproval };
    });
  }, [overrides, projectTypes, allStages, stageApprovals]);

  const handleOpenCreate = () => {
    const initialProjectTypeId = filteredProjectTypes[0]?.id || null;
    setCreateModeProjectTypeId(initialProjectTypeId);
    setBuilderState({ mode: "create" });
  };

  const handleOpenEdit = (override: OverrideWithDetails) => {
    setBuilderState({ mode: "edit", override });
  };

  const handleOpenView = (override: OverrideWithDetails) => {
    setBuilderState({ mode: "view", override });
  };

  const handleSaveApproval = (formData: ApprovalFormData) => {
    if (builderState?.mode === "create") {
      createOverrideMutation.mutate(formData);
    } else if (builderState?.mode === "edit") {
      const existingFieldIds = (resolvedFields || []).map((f: any) => f.id);
      updateOverrideMutation.mutate({
        overrideId: builderState.override.id,
        approvalId: builderState.override.overrideApprovalId,
        formData,
        existingFieldIds,
      });
    }
  };

  const getBuilderFormData = (): ApprovalFormData => {
    if (builderState?.mode === "create") {
      return {
        name: "",
        description: "",
        projectTypeId: filteredProjectTypes[0]?.id || "",
        stageId: "",
        fields: [],
      };
    }
    
    if (builderState?.mode === "edit" || builderState?.mode === "view") {
      const override = builderState.override;
      const fields: EditingApprovalField[] = (resolvedFields || []).map((f: any, i: number) => ({
        id: f.id,
        fieldName: f.fieldName,
        fieldType: f.fieldType,
        description: f.description || "",
        isRequired: f.isRequired,
        order: i,
        options: f.options || [],
        libraryFieldId: f.libraryFieldId,
        expectedValueBoolean: f.expectedValueBoolean,
        expectedValueNumber: f.expectedValueNumber,
        comparisonType: f.comparisonType,
      }));
      
      return {
        id: override.id,
        name: override.overrideApproval?.name || "",
        description: override.overrideApproval?.description || "",
        projectTypeId: override.projectTypeId,
        stageId: override.stageId,
        fields,
      };
    }
    
    return { name: "", description: "", projectTypeId: "", stageId: "", fields: [] };
  };

  if (overridesLoading || projectTypesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (builderState) {
    const isLoadingFields = (builderState.mode === "edit" || builderState.mode === "view") && !resolvedFields;
    
    if (isLoadingFields) {
      return (
        <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
          <div className="text-center">
            <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Loading approval form...</p>
          </div>
        </div>
      );
    }

    return (
      <ApprovalWizard
        mode={builderState.mode}
        formData={getBuilderFormData()}
        projectTypes={filteredProjectTypes}
        stages={allStages || []}
        onSave={handleSaveApproval}
        onCancel={() => setBuilderState(null)}
        isSaving={createOverrideMutation.isPending || updateOverrideMutation.isPending}
        onProjectTypeChange={handleProjectTypeChangeInBuilder}
      />
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
        <Button onClick={handleOpenCreate} data-testid="button-create-override">
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
            <Button onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Create Custom Approval
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Project Type</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrichedOverrides.map((override) => (
                <OverrideRow
                  key={override.id}
                  override={override}
                  onView={() => handleOpenView(override)}
                  onEdit={() => handleOpenEdit(override)}
                  onDelete={() => setDeleteOverrideId(override.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteOverrideId} onOpenChange={() => setDeleteOverrideId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Approval?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the custom approval form. The stage will revert to using the standard approval (if one exists).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteOverrideId && deleteOverrideMutation.mutate(deleteOverrideId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-override"
            >
              {deleteOverrideMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClientTaskOverridesSection clientId={clientId} />
    </div>
  );
}
