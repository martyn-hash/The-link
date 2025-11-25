import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Edit2, Trash2, Save, X, Layers } from "lucide-react";
import type { ProjectType, KanbanStage, ChangeReason, StageApproval } from "@shared/schema";
import type { EditingStage } from "../../utils/types";
import { DEFAULT_STAGE, STAGE_COLORS } from "../../utils/constants";
import type { useStageMutations, useStageReasonMapMutations } from "../../hooks";

interface KanbanStagesTabProps {
  projectType: ProjectType;
  stages: KanbanStage[] | undefined;
  stagesLoading: boolean;
  reasons: ChangeReason[] | undefined;
  reasonsLoading: boolean;
  stageApprovals: StageApproval[] | undefined;
  availableRoles: Array<{ value: string; label: string }>;
  rolesLoading: boolean;
  usersLoading: boolean;
  allStageReasonMaps: any[] | undefined;
  editingStage: EditingStage | null;
  setEditingStage: (stage: EditingStage | null) => void;
  isAddingStage: boolean;
  setIsAddingStage: (adding: boolean) => void;
  selectedStageReasons: string[];
  setSelectedStageReasons: (reasons: string[]) => void;
  selectedStageApprovalId: string | null;
  setSelectedStageApprovalId: (id: string | null) => void;
  stageMutations: ReturnType<typeof useStageMutations>;
  stageReasonMapMutations: ReturnType<typeof useStageReasonMapMutations>;
  onStageSubmit: () => void;
  getStageRoleLabel: (stage: any) => string;
}

export function KanbanStagesTab({
  projectType,
  stages,
  stagesLoading,
  reasons,
  reasonsLoading,
  stageApprovals,
  availableRoles,
  rolesLoading,
  usersLoading,
  allStageReasonMaps,
  editingStage,
  setEditingStage,
  isAddingStage,
  setIsAddingStage,
  selectedStageReasons,
  setSelectedStageReasons,
  selectedStageApprovalId,
  setSelectedStageApprovalId,
  stageMutations,
  onStageSubmit,
  getStageRoleLabel,
}: KanbanStagesTabProps) {
  const { createStageMutation, updateStageMutation, deleteStageMutation } = stageMutations;

  const handleAddStage = () => {
    setEditingStage({ ...DEFAULT_STAGE, order: (stages?.length || 0) });
    setIsAddingStage(true);
    setSelectedStageReasons([]);
    setSelectedStageApprovalId(null);
  };

  const handleEditStage = (stage: KanbanStage) => {
    setEditingStage({
      id: stage.id,
      name: stage.name,
      assignedRole: (stage as any).assignedRole || undefined,
      assignedWorkRoleId: (stage as any).assignedWorkRoleId || undefined,
      assignedUserId: (stage as any).assignedUserId || undefined,
      order: stage.order,
      color: stage.color || "#6b7280",
      maxInstanceTime: stage.maxInstanceTime || undefined,
      maxTotalTime: stage.maxTotalTime || undefined,
      canBeFinalStage: (stage as any).canBeFinalStage || false
    });
    
    if (allStageReasonMaps) {
      const stageMappings = allStageReasonMaps.filter((map: any) => map.stageId === stage.id);
      setSelectedStageReasons(stageMappings.map((m: any) => m.reasonId));
    }
    
    setSelectedStageApprovalId(stage.stageApprovalId || null);
  };

  const handleCancel = () => {
    setEditingStage(null);
    setIsAddingStage(false);
    setSelectedStageReasons([]);
    setSelectedStageApprovalId(null);
  };

  return (
    <TabsContent value="stages" className="page-container py-6 md:py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Kanban Stages</h2>
          <p className="text-muted-foreground">Configure the workflow stages for this project type</p>
        </div>
        <Button onClick={handleAddStage} data-testid="button-add-stage">
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
                    onClick={() => handleEditStage(stage)}
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
          <Button onClick={handleAddStage}>
            <Plus className="w-4 h-4 mr-2" />
            Add First Stage
          </Button>
        </div>
      )}

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
                  onChange={(e) => setEditingStage({ ...editingStage!, name: e.target.value })}
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
                      setEditingStage({ 
                        ...editingStage!, 
                        assignedWorkRoleId: value,
                        assignedUserId: undefined,
                        assignedRole: undefined
                      });
                    } else {
                      setEditingStage({ 
                        ...editingStage!, 
                        assignedUserId: value,
                        assignedWorkRoleId: undefined,
                        assignedRole: undefined
                      });
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
                  onChange={(e) => setEditingStage({ ...editingStage!, order: parseInt(e.target.value) || 0 })}
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
                        onClick={() => setEditingStage({ ...editingStage!, color })}
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
                  onChange={(e) => setEditingStage({ 
                    ...editingStage!, 
                    maxInstanceTime: e.target.value ? parseInt(e.target.value) : undefined 
                  })}
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
                  onChange={(e) => setEditingStage({ 
                    ...editingStage!, 
                    maxTotalTime: e.target.value ? parseInt(e.target.value) : undefined 
                  })}
                  placeholder="Optional"
                  data-testid="input-stage-max-total-time"
                />
              </div>
            </div>

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

            <div className="space-y-2 col-span-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="can-be-final-stage"
                  checked={editingStage?.canBeFinalStage || false}
                  onCheckedChange={(checked) => {
                    setEditingStage({ 
                      ...editingStage!, 
                      canBeFinalStage: checked === true 
                    });
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
                              setSelectedStageReasons([...selectedStageReasons, reason.id]);
                            } else {
                              setSelectedStageReasons(selectedStageReasons.filter(id => id !== reason.id));
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
              <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-stage">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={onStageSubmit}
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
  );
}
