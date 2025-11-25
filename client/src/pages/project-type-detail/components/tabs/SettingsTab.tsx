import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Edit2, Save, X } from "lucide-react";
import type { ProjectType, Service } from "@shared/schema";

interface SettingsTabProps {
  projectType: ProjectType | undefined;
  allServices: Service[] | undefined;
  isEditingServiceLinkage: boolean;
  setIsEditingServiceLinkage: (value: boolean) => void;
  selectedServiceId: string | null;
  setSelectedServiceId: (value: string | null) => void;
  updateProjectTypeServiceLinkageMutation: {
    mutate: (serviceId: string | null) => void;
    isPending: boolean;
  };
}

export function SettingsTab({
  projectType,
  allServices,
  isEditingServiceLinkage,
  setIsEditingServiceLinkage,
  selectedServiceId,
  setSelectedServiceId,
  updateProjectTypeServiceLinkageMutation,
}: SettingsTabProps) {
  return (
    <TabsContent value="settings" className="page-container py-6 md:py-8 space-y-8">
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
  );
}
