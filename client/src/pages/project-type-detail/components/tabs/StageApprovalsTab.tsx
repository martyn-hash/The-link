import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Edit2, Trash2, ShieldCheck, Eye, ClipboardCheck } from "lucide-react";
import type { StageApproval, StageApprovalField, ApprovalFieldLibrary, KanbanStage, ProjectType } from "@shared/schema";
import { ApprovalFieldBuilder, type ApprovalFormData, type EditingApprovalField } from "@/components/approval-builder/ApprovalFieldBuilder";

interface StageApprovalsTabProps {
  projectTypeId: string;
  projectType?: ProjectType;
  stages?: KanbanStage[];
}

type BuilderMode = null | { mode: "create" } | { mode: "edit"; approval: StageApproval } | { mode: "view"; approval: StageApproval };

export function StageApprovalsTab({ projectTypeId, projectType, stages = [] }: StageApprovalsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [builderState, setBuilderState] = useState<BuilderMode>(null);
  const [deleteApprovalId, setDeleteApprovalId] = useState<string | null>(null);

  const { data: stageApprovals, isLoading: approvalsLoading } = useQuery<StageApproval[]>({
    queryKey: ["/api/config/stage-approvals"],
  });

  const { data: allStageApprovalFields } = useQuery<StageApprovalField[]>({
    queryKey: ["/api/config/stage-approval-fields"],
  });

  const { data: libraryFields } = useQuery<ApprovalFieldLibrary[]>({
    queryKey: ["/api/project-types", projectTypeId, "approval-field-library"],
    enabled: !!projectTypeId,
  });

  const filteredApprovals = useMemo(() => {
    if (!stageApprovals) return [];
    return stageApprovals.filter(a => a.projectTypeId === projectTypeId);
  }, [stageApprovals, projectTypeId]);

  const projectTypeStages = useMemo(() => {
    return stages.filter(s => s.projectTypeId === projectTypeId);
  }, [stages, projectTypeId]);

  const activeApprovalId = builderState?.mode === "edit" || builderState?.mode === "view"
    ? builderState.approval.id
    : null;

  const { data: resolvedFields } = useQuery<StageApprovalField[]>({
    queryKey: ["/api/stage-approvals", activeApprovalId, "resolved-fields"],
    enabled: !!activeApprovalId,
  });

  const createApprovalMutation = useMutation({
    mutationFn: async (data: ApprovalFormData) => {
      const approvalRes = await apiRequest("POST", "/api/config/stage-approvals", {
        projectTypeId,
        name: data.name,
        description: data.description || null,
      });
      
      const approval = approvalRes as { id: string };
      
      for (let i = 0; i < data.fields.length; i++) {
        const field = data.fields[i];
        await apiRequest("POST", `/api/config/stage-approval-fields`, {
          stageApprovalId: approval.id,
          fieldName: field.fieldName,
          fieldType: field.fieldType,
          description: field.description || null,
          isRequired: field.isRequired,
          order: i,
          options: field.options.length > 0 ? field.options : null,
          libraryFieldId: field.libraryFieldId || null,
          expectedValueBoolean: field.expectedValueBoolean,
          expectedValueNumber: field.expectedValueNumber,
          comparisonType: field.comparisonType,
        });
      }
      
      return approval;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-approval-fields"] });
      setBuilderState(null);
      toast({ title: "Stage approval created", description: "The approval form is now available for use." });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const updateApprovalMutation = useMutation({
    mutationFn: async (data: { approvalId: string; formData: ApprovalFormData }) => {
      await apiRequest("PATCH", `/api/config/stage-approvals/${data.approvalId}`, {
        name: data.formData.name,
        description: data.formData.description || null,
      });
      
      const existingFields = allStageApprovalFields?.filter(f => f.stageApprovalId === data.approvalId) || [];
      const existingFieldIds = existingFields.map(f => f.id);
      const newFieldIds = data.formData.fields.filter(f => f.id).map(f => f.id!);
      
      for (const fieldId of existingFieldIds) {
        if (!newFieldIds.includes(fieldId)) {
          await apiRequest("DELETE", `/api/config/stage-approval-fields/${fieldId}`);
        }
      }
      
      for (let i = 0; i < data.formData.fields.length; i++) {
        const field = data.formData.fields[i];
        const fieldData = {
          stageApprovalId: data.approvalId,
          fieldName: field.fieldName,
          fieldType: field.fieldType,
          description: field.description || null,
          isRequired: field.isRequired,
          order: i,
          options: field.options.length > 0 ? field.options : null,
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
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-approval-fields"] });
      setBuilderState(null);
      toast({ title: "Approval updated", description: "Your changes have been saved." });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const deleteApprovalMutation = useMutation({
    mutationFn: async (approvalId: string) => {
      await apiRequest("DELETE", `/api/config/stage-approvals/${approvalId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-approval-fields"] });
      setDeleteApprovalId(null);
      toast({ title: "Approval deleted" });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const handleOpenCreate = () => {
    setBuilderState({ mode: "create" });
  };

  const handleOpenEdit = (approval: StageApproval) => {
    setBuilderState({ mode: "edit", approval });
  };

  const handleOpenView = (approval: StageApproval) => {
    setBuilderState({ mode: "view", approval });
  };

  const handleSaveApproval = (formData: ApprovalFormData) => {
    if (builderState?.mode === "create") {
      createApprovalMutation.mutate(formData);
    } else if (builderState?.mode === "edit") {
      updateApprovalMutation.mutate({
        approvalId: builderState.approval.id,
        formData,
      });
    }
  };

  const getBuilderFormData = (): ApprovalFormData => {
    if (builderState?.mode === "create") {
      return {
        name: "",
        description: "",
        projectTypeId,
        stageId: projectTypeStages[0]?.id || "",
        fields: [],
      };
    }
    
    if (builderState?.mode === "edit" || builderState?.mode === "view") {
      const approval = builderState.approval;
      const fields: EditingApprovalField[] = (resolvedFields || []).map((f, i) => ({
        id: f.id,
        fieldName: f.fieldName,
        fieldType: f.fieldType as any,
        description: f.description || "",
        isRequired: f.isRequired ?? false,
        order: i,
        options: f.options || [],
        libraryFieldId: f.libraryFieldId,
        expectedValueBoolean: f.expectedValueBoolean,
        expectedValueNumber: f.expectedValueNumber,
        comparisonType: f.comparisonType as any,
      }));
      
      return {
        id: approval.id,
        name: approval.name,
        description: approval.description || "",
        projectTypeId,
        stageId: "",
        fields,
      };
    }
    
    return { name: "", description: "", projectTypeId: "", stageId: "", fields: [] };
  };

  const getFieldCount = (approvalId: string) => {
    return allStageApprovalFields?.filter(f => f.stageApprovalId === approvalId).length || 0;
  };

  if (approvalsLoading) {
    return (
      <TabsContent value="approvals" className="page-container py-6 md:py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </TabsContent>
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
      <ApprovalFieldBuilder
        mode={builderState.mode}
        formData={getBuilderFormData()}
        projectTypes={projectType ? [projectType] : []}
        stages={projectTypeStages}
        libraryFields={libraryFields || []}
        onSave={handleSaveApproval}
        onCancel={() => setBuilderState(null)}
        isSaving={createApprovalMutation.isPending || updateApprovalMutation.isPending}
      />
    );
  }

  return (
    <TabsContent value="approvals" className="page-container py-6 md:py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Stage Approvals</h2>
          <p className="text-muted-foreground">Configure approval processes for stages in this project type</p>
        </div>
        <Button onClick={handleOpenCreate} data-testid="button-add-stage-approval">
          <Plus className="w-4 h-4 mr-2" />
          Add Approval
        </Button>
      </div>

      {filteredApprovals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No stage approvals configured</h3>
            <p className="text-muted-foreground mb-4">
              Add approval processes to validate stage transitions.
            </p>
            <Button onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Approval
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredApprovals.map((approval) => (
            <Card 
              key={approval.id} 
              className="group hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer"
              onClick={() => handleOpenView(approval)}
              data-testid={`card-approval-${approval.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ClipboardCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate" data-testid={`text-approval-name-${approval.id}`}>
                        {approval.name}
                      </CardTitle>
                      {approval.description && (
                        <CardDescription className="truncate">
                          {approval.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {getFieldCount(approval.id)} fields
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Click to view or edit
                  </p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenView(approval);
                      }}
                      data-testid={`button-view-approval-${approval.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(approval);
                      }}
                      data-testid={`button-edit-approval-${approval.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteApprovalId(approval.id);
                      }}
                      className="text-destructive"
                      data-testid={`button-delete-approval-${approval.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteApprovalId} onOpenChange={() => setDeleteApprovalId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stage Approval?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this approval form and all its fields. Any stages using this approval will no longer have an approval process.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteApprovalId && deleteApprovalMutation.mutate(deleteApprovalId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-approval"
            >
              {deleteApprovalMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TabsContent>
  );
}

export interface LegacyStageApprovalsTabProps {
  projectTypeId: string;
  stageApprovals: StageApproval[] | undefined;
  stageApprovalsLoading: boolean;
  allStageApprovalFields: StageApprovalField[] | undefined;
  editingStageApproval: any;
  setEditingStageApproval: (approval: any) => void;
  isAddingStageApproval: boolean;
  setIsAddingStageApproval: (adding: boolean) => void;
  editingStageApprovalField: any;
  setEditingStageApprovalField: (field: any) => void;
  isAddingApprovalField: boolean;
  setIsAddingApprovalField: (adding: boolean) => void;
  stageApprovalMutations: any;
  approvalFieldMutations: any;
  onStageApprovalSubmit: () => void;
}
