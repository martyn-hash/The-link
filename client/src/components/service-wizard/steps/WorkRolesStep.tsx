import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Briefcase } from "lucide-react";
import type { ServiceWizardFormData } from "../types";
import type { WorkRole } from "@shared/schema";

interface WorkRolesStepProps {
  formData: ServiceWizardFormData;
  updateFormData: (updates: Partial<ServiceWizardFormData>) => void;
  workRoles: WorkRole[];
  isLoading: boolean;
}

export function WorkRolesStep({ formData, updateFormData, workRoles, isLoading }: WorkRolesStepProps) {
  const handleRoleToggle = (roleId: string, checked: boolean) => {
    if (checked) {
      updateFormData({ roleIds: [...formData.roleIds, roleId] });
    } else {
      updateFormData({ roleIds: formData.roleIds.filter(id => id !== roleId) });
    }
  };

  const selectedCount = formData.roleIds.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Work Roles</h2>
        <p className="text-muted-foreground mt-1">
          Select which work roles are associated with this service
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Available Work Roles
              </CardTitle>
              <CardDescription>
                Users will be assigned to these roles when the service is added to a client
              </CardDescription>
            </div>
            {selectedCount > 0 && (
              <Badge variant="secondary" data-testid="badge-selected-roles">
                {selectedCount} selected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : workRoles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No work roles have been created yet.</p>
              <p className="text-sm">Create work roles in the "Work Roles" tab first.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {workRoles.map((role) => {
                const isChecked = formData.roleIds.includes(role.id);
                return (
                  <label
                    key={role.id}
                    className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                      isChecked
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    data-testid={`checkbox-role-${role.id}`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => handleRoleToggle(role.id, checked as boolean)}
                    />
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{role.name}</div>
                      {role.description && (
                        <div className="text-sm text-muted-foreground">
                          {role.description}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCount === 0 && workRoles.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          You can proceed without selecting any roles. Roles can be added later.
        </p>
      )}
    </div>
  );
}
