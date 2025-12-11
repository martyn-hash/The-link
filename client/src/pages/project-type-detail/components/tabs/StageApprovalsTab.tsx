import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Save, X, ShieldCheck, Library } from "lucide-react";
import type { StageApproval, StageApprovalField, ApprovalFieldLibrary } from "@shared/schema";
import type { EditingStageApproval, EditingStageApprovalField } from "../../utils/types";
import { DEFAULT_STAGE_APPROVAL } from "../../utils/constants";
import { ApprovalFieldForm } from "../fields";
import type { useStageApprovalMutations, useApprovalFieldMutations } from "../../hooks";

const FIELD_TYPE_LABELS: Record<string, string> = {
  boolean: "Yes/No",
  number: "Number",
  short_text: "Short Text",
  long_text: "Long Text",
  single_select: "Single Select",
  multi_select: "Multi Select",
  date: "Date",
};

interface StageApprovalsTabProps {
  projectTypeId: string;
  stageApprovals: StageApproval[] | undefined;
  stageApprovalsLoading: boolean;
  allStageApprovalFields: StageApprovalField[] | undefined;
  editingStageApproval: EditingStageApproval | null;
  setEditingStageApproval: (approval: EditingStageApproval | null) => void;
  isAddingStageApproval: boolean;
  setIsAddingStageApproval: (adding: boolean) => void;
  editingStageApprovalField: EditingStageApprovalField | null;
  setEditingStageApprovalField: (field: EditingStageApprovalField | null) => void;
  isAddingApprovalField: boolean;
  setIsAddingApprovalField: (adding: boolean) => void;
  stageApprovalMutations: ReturnType<typeof useStageApprovalMutations>;
  approvalFieldMutations: ReturnType<typeof useApprovalFieldMutations>;
  onStageApprovalSubmit: () => void;
}

export function StageApprovalsTab({
  projectTypeId,
  stageApprovals,
  stageApprovalsLoading,
  allStageApprovalFields,
  editingStageApproval,
  setEditingStageApproval,
  isAddingStageApproval,
  setIsAddingStageApproval,
  editingStageApprovalField,
  setEditingStageApprovalField,
  isAddingApprovalField,
  setIsAddingApprovalField,
  stageApprovalMutations,
  approvalFieldMutations,
  onStageApprovalSubmit,
}: StageApprovalsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  
  const { createStageApprovalMutation, updateStageApprovalMutation, deleteStageApprovalMutation } = stageApprovalMutations;
  const { createApprovalFieldMutation, updateApprovalFieldMutation, deleteApprovalFieldMutation } = approvalFieldMutations;

  const { data: libraryFields } = useQuery<ApprovalFieldLibrary[]>({
    queryKey: ["/api/project-types", projectTypeId, "approval-field-library"],
    enabled: !!projectTypeId,
  });

  const addFromLibraryMutation = useMutation({
    mutationFn: async (data: { stageApprovalId: string; libraryFieldId: string; order: number }) => {
      const res = await apiRequest("POST", `/api/stage-approvals/${data.stageApprovalId}/fields/from-library`, {
        libraryFieldId: data.libraryFieldId,
        order: data.order,
        isRequired: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/stage-approval-fields"] });
      setShowLibraryPicker(false);
      toast({ title: "Field added from library" });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const handleAddFromLibrary = (libraryField: ApprovalFieldLibrary) => {
    if (!editingStageApproval?.id) return;
    const existingFieldsCount = allStageApprovalFields?.filter(f => f.stageApprovalId === editingStageApproval.id).length || 0;
    addFromLibraryMutation.mutate({
      stageApprovalId: editingStageApproval.id,
      libraryFieldId: libraryField.id,
      order: existingFieldsCount,
    });
  };

  const handleAddApproval = () => {
    setEditingStageApproval(DEFAULT_STAGE_APPROVAL);
    setIsAddingStageApproval(true);
  };

  const handleEditApproval = (approval: StageApproval) => {
    setEditingStageApproval({
      ...approval,
      description: approval.description || ""
    });
  };

  const handleCancel = () => {
    setEditingStageApproval(null);
    setIsAddingStageApproval(false);
  };

  return (
    <TabsContent value="approvals" className="page-container py-6 md:py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Stage Approvals</h2>
          <p className="text-muted-foreground">Configure approval processes for stages in this project type</p>
        </div>
        <Button onClick={handleAddApproval} data-testid="button-add-stage-approval">
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
                    onClick={() => handleEditApproval(approval)}
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
          <Button onClick={handleAddApproval}>
            <Plus className="w-4 h-4 mr-2" />
            Add First Approval
          </Button>
        </div>
      )}

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
                  onChange={(e) => setEditingStageApproval({ ...editingStageApproval!, name: e.target.value })}
                  placeholder="Enter approval name"
                  data-testid="input-approval-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="approval-description">Description</Label>
                <Textarea
                  id="approval-description"
                  value={editingStageApproval?.description || ""}
                  onChange={(e) => setEditingStageApproval({ ...editingStageApproval!, description: e.target.value })}
                  placeholder="Optional description"
                  data-testid="textarea-approval-description"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Approval Fields</Label>
                  <div className="flex gap-2">
                    {libraryFields && libraryFields.length > 0 && editingStageApproval?.id && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowLibraryPicker(true)}
                        data-testid="button-add-from-library"
                      >
                        <Library className="w-4 h-4 mr-2" />
                        From Library
                      </Button>
                    )}
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
                      Add Custom Field
                    </Button>
                  </div>
                </div>
                
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                  {editingStageApproval?.id && allStageApprovalFields ? (
                    allStageApprovalFields?.filter(field => field.stageApprovalId === editingStageApproval.id).length > 0 ? (
                      <div className="space-y-2">
                        {allStageApprovalFields
                          ?.filter(field => field.stageApprovalId === editingStageApproval.id)
                          .sort((a, b) => a.order - b.order)
                          .map((field) => (
                            <div key={field.id} className="flex items-center justify-between p-2 border rounded">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{field.fieldName}</span>
                                  {field.libraryFieldId && (
                                    <Badge variant="outline" className="text-xs bg-blue-50">
                                      <Library className="w-3 h-3 mr-1" />
                                      Library
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {FIELD_TYPE_LABELS[field.fieldType] || field.fieldType} {field.isRequired && "• Required"}
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
                                    } as EditingStageApprovalField);
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
              <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-approval">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={onStageApprovalSubmit}
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
                  onClick={() => handleAddFromLibrary(field)}
                  data-testid={`library-field-${field.id}`}
                >
                  <div>
                    <p className="font-medium text-sm">{field.fieldName}</p>
                    <p className="text-xs text-muted-foreground">{field.description}</p>
                  </div>
                  <Badge variant="outline">
                    {FIELD_TYPE_LABELS[field.fieldType] || field.fieldType}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Library className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No library fields available yet.</p>
                <p className="text-xs mt-1">Add fields to the library in the Field Library tab.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}
