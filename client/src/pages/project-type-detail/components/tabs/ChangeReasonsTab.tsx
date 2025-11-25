import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Edit2, Trash2, Save, X, List, ShieldCheck } from "lucide-react";
import type { ChangeReason, StageApproval } from "@shared/schema";
import type { EditingReason } from "../../utils/types";
import { DEFAULT_REASON } from "../../utils/constants";
import { CustomFieldForm } from "../fields";
import type { useReasonMutations, useCustomFieldMutations } from "../../hooks";

interface ChangeReasonsTabProps {
  reasons: ChangeReason[] | undefined;
  reasonsLoading: boolean;
  stageApprovals: StageApproval[] | undefined;
  stageApprovalsLoading: boolean;
  allCustomFields: any[] | undefined;
  editingReason: EditingReason | null;
  setEditingReason: (reason: EditingReason | null) => void;
  isAddingReason: boolean;
  setIsAddingReason: (adding: boolean) => void;
  isAddingCustomField: boolean;
  setIsAddingCustomField: (adding: boolean) => void;
  reasonMutations: ReturnType<typeof useReasonMutations>;
  customFieldMutations: ReturnType<typeof useCustomFieldMutations>;
  onReasonSubmit: () => void;
}

export function ChangeReasonsTab({
  reasons,
  reasonsLoading,
  stageApprovals,
  stageApprovalsLoading,
  allCustomFields,
  editingReason,
  setEditingReason,
  isAddingReason,
  setIsAddingReason,
  isAddingCustomField,
  setIsAddingCustomField,
  reasonMutations,
  customFieldMutations,
  onReasonSubmit,
}: ChangeReasonsTabProps) {
  const { createReasonMutation, updateReasonMutation, deleteReasonMutation } = reasonMutations;
  const { createCustomFieldMutation, deleteCustomFieldMutation } = customFieldMutations;

  const handleAddReason = () => {
    setEditingReason(DEFAULT_REASON);
    setIsAddingReason(true);
  };

  const handleEditReason = (reason: ChangeReason) => {
    setEditingReason({
      ...reason,
      description: reason.description || "",
      showCountInProject: reason.showCountInProject || false,
      countLabel: reason.countLabel || "",
      stageApprovalId: reason.stageApprovalId || undefined
    });
  };

  const handleCancel = () => {
    setEditingReason(null);
    setIsAddingReason(false);
  };

  return (
    <TabsContent value="reasons" className="page-container py-6 md:py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Change Reasons</h2>
          <p className="text-muted-foreground">Configure reasons for status changes in this project type</p>
        </div>
        <Button onClick={handleAddReason} data-testid="button-add-reason">
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
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base" data-testid={`text-reason-name-${reason.id}`}>
                      {reason.reason}
                    </CardTitle>
                    {reason.stageApprovalId && (
                      <Badge variant="secondary" className="text-xs">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Has Approval
                      </Badge>
                    )}
                  </div>
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
                    onClick={() => handleEditReason(reason)}
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
          <Button onClick={handleAddReason}>
            <Plus className="w-4 h-4 mr-2" />
            Add First Reason
          </Button>
        </div>
      )}

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
                  onChange={(e) => setEditingReason({ ...editingReason!, reason: e.target.value })}
                  placeholder="Enter reason name"
                  data-testid="input-reason-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reason-description">Description</Label>
                <Textarea
                  id="reason-description"
                  value={editingReason?.description || ""}
                  onChange={(e) => setEditingReason({ ...editingReason!, description: e.target.value })}
                  placeholder="Optional description"
                  data-testid="textarea-reason-description"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="reason-show-count"
                  checked={editingReason?.showCountInProject || false}
                  onCheckedChange={(checked) => setEditingReason({ 
                    ...editingReason!, 
                    showCountInProject: !!checked 
                  })}
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
                    onChange={(e) => setEditingReason({ ...editingReason!, countLabel: e.target.value })}
                    placeholder="Enter count label"
                    data-testid="input-reason-count-label"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reason-stage-approval">Stage Approval (Optional)</Label>
                <p className="text-sm text-muted-foreground">
                  Assign a specific approval questionnaire to this reason. If set, this takes precedence over the stage's approval.
                </p>
                <Select
                  value={editingReason?.stageApprovalId || "none"}
                  onValueChange={(value) => setEditingReason({ 
                    ...editingReason!, 
                    stageApprovalId: value === "none" ? undefined : value 
                  })}
                >
                  <SelectTrigger data-testid="select-reason-stage-approval">
                    <SelectValue placeholder="No approval" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No approval</SelectItem>
                    {stageApprovalsLoading ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : stageApprovals && stageApprovals.length > 0 ? (
                      stageApprovals.map(approval => (
                        <SelectItem key={approval.id} value={approval.id}>
                          {approval.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-approvals" disabled>No approvals configured</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {editingReason?.stageApprovalId && (
                  <Badge variant="secondary" className="mt-2">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    This reason has its own approval (overrides stage-level approval)
                  </Badge>
                )}
              </div>

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
                          .map((field) => (
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
              <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-reason">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={onReasonSubmit}
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
  );
}
