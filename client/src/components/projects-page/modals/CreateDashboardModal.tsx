import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, BarChart3, X } from "lucide-react";
import type { Widget, DynamicDateFilter, Dashboard, User } from "@/types/projects-page";

interface ServiceOption {
  id: string;
  name: string;
}

interface ClientOption {
  id: string;
  name: string;
}

interface ProjectTypeOption {
  id: string;
  name: string;
}

interface CreateDashboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCreatingDashboard: boolean;
  newDashboardName: string;
  setNewDashboardName: (value: string) => void;
  newDashboardDescription: string;
  setNewDashboardDescription: (value: string) => void;
  newDashboardIsHomescreen: boolean;
  setNewDashboardIsHomescreen: (value: boolean) => void;
  newDashboardVisibility: "private" | "shared";
  setNewDashboardVisibility: (value: "private" | "shared") => void;
  newDashboardWidgets: Widget[];
  dashboardServiceFilter: string;
  setDashboardServiceFilter: (value: string) => void;
  dashboardTaskAssigneeFilter: string;
  setDashboardTaskAssigneeFilter: (value: string) => void;
  dashboardServiceOwnerFilter: string;
  setDashboardServiceOwnerFilter: (value: string) => void;
  dashboardUserFilter: string;
  setDashboardUserFilter: (value: string) => void;
  dashboardShowArchived: boolean;
  setDashboardShowArchived: (value: boolean) => void;
  dashboardDynamicDateFilter: DynamicDateFilter;
  setDashboardDynamicDateFilter: (value: DynamicDateFilter) => void;
  dashboardClientFilter: string;
  setDashboardClientFilter: (value: string) => void;
  dashboardProjectTypeFilter: string;
  setDashboardProjectTypeFilter: (value: string) => void;
  services: ServiceOption[];
  users: User[];
  taskAssignees: Array<{ id: string; firstName?: string | null; lastName?: string | null }>;
  serviceOwners: Array<{ id: string; firstName?: string | null; lastName?: string | null }>;
  allClients: ClientOption[];
  allProjectTypes: ProjectTypeOption[];
  dashboards: Dashboard[];
  isManagerOrAdmin: boolean;
  onSave: () => void;
  onOpenAddWidget: () => void;
  onRemoveWidget: (widgetId: string) => void;
  isSaving: boolean;
  onReset: () => void;
}

export function CreateDashboardModal({
  open,
  onOpenChange,
  isCreatingDashboard,
  newDashboardName,
  setNewDashboardName,
  newDashboardDescription,
  setNewDashboardDescription,
  newDashboardIsHomescreen,
  setNewDashboardIsHomescreen,
  newDashboardVisibility,
  setNewDashboardVisibility,
  newDashboardWidgets,
  dashboardServiceFilter,
  setDashboardServiceFilter,
  dashboardTaskAssigneeFilter,
  setDashboardTaskAssigneeFilter,
  dashboardServiceOwnerFilter,
  setDashboardServiceOwnerFilter,
  dashboardUserFilter,
  setDashboardUserFilter,
  dashboardShowArchived,
  setDashboardShowArchived,
  dashboardDynamicDateFilter,
  setDashboardDynamicDateFilter,
  dashboardClientFilter,
  setDashboardClientFilter,
  dashboardProjectTypeFilter,
  setDashboardProjectTypeFilter,
  services,
  users,
  taskAssignees,
  serviceOwners,
  allClients,
  allProjectTypes,
  dashboards,
  isManagerOrAdmin,
  onSave,
  onOpenAddWidget,
  onRemoveWidget,
  isSaving,
  onReset,
}: CreateDashboardModalProps) {
  const handleClose = (openState: boolean) => {
    if (!openState) {
      onReset();
    }
    onOpenChange(openState);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-dashboard">
        <DialogHeader>
          <DialogTitle>{isCreatingDashboard ? "Create New Dashboard" : "Edit Dashboard"}</DialogTitle>
          <DialogDescription>
            Configure filters, add widgets, and save your custom dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="dashboard-name">Dashboard Name</Label>
            <Input
              id="dashboard-name"
              placeholder="e.g., Project Overview"
              value={newDashboardName}
              onChange={(e) => setNewDashboardName(e.target.value)}
              data-testid="input-new-dashboard-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dashboard-description">Description (optional)</Label>
            <Textarea
              id="dashboard-description"
              placeholder="Briefly describe what this dashboard shows..."
              value={newDashboardDescription}
              onChange={(e) => setNewDashboardDescription(e.target.value)}
              data-testid="textarea-dashboard-description"
              rows={3}
            />
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-base">Dashboard Filters</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Configure filters that will be applied to this dashboard
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dashboard-service-filter">Service</Label>
                <Select value={dashboardServiceFilter} onValueChange={setDashboardServiceFilter}>
                  <SelectTrigger id="dashboard-service-filter" data-testid="select-dashboard-service">
                    <SelectValue placeholder="All Services" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dashboard-assignee-filter">Task Assignee</Label>
                <Select value={dashboardTaskAssigneeFilter} onValueChange={setDashboardTaskAssigneeFilter}>
                  <SelectTrigger id="dashboard-assignee-filter" data-testid="select-dashboard-assignee">
                    <SelectValue placeholder="All Assignees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Assignees</SelectItem>
                    {taskAssignees.map((assignee) => (
                      <SelectItem key={assignee.id} value={assignee.id}>
                        {`${assignee.firstName || ''} ${assignee.lastName || ''}`.trim()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dashboard-owner-filter">Service Owner</Label>
                <Select value={dashboardServiceOwnerFilter} onValueChange={setDashboardServiceOwnerFilter}>
                  <SelectTrigger id="dashboard-owner-filter" data-testid="select-dashboard-owner">
                    <SelectValue placeholder="All Owners" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Owners</SelectItem>
                    {serviceOwners.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>
                        {`${owner.firstName || ''} ${owner.lastName || ''}`.trim()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isManagerOrAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="dashboard-user-filter">User Assignment</Label>
                  <Select value={dashboardUserFilter} onValueChange={setDashboardUserFilter}>
                    <SelectTrigger id="dashboard-user-filter" data-testid="select-dashboard-user">
                      <SelectValue placeholder="All Users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {(users || []).map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {`${user.firstName || ''} ${user.lastName || ''}`.trim()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="dashboard-date-filter">Due Date</Label>
                <Select value={dashboardDynamicDateFilter} onValueChange={(v: any) => setDashboardDynamicDateFilter(v)}>
                  <SelectTrigger id="dashboard-date-filter" data-testid="select-dashboard-date">
                    <SelectValue placeholder="All Dates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dates</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="next7days">Next 7 Days</SelectItem>
                    <SelectItem value="next14days">Next 14 Days</SelectItem>
                    <SelectItem value="next30days">Next 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dashboard-client-filter">Client</Label>
                <Select value={dashboardClientFilter} onValueChange={setDashboardClientFilter}>
                  <SelectTrigger id="dashboard-client-filter" data-testid="select-dashboard-client">
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {allClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dashboard-project-type-filter">Project Type</Label>
                <Select value={dashboardProjectTypeFilter} onValueChange={setDashboardProjectTypeFilter}>
                  <SelectTrigger id="dashboard-project-type-filter" data-testid="select-dashboard-project-type">
                    <SelectValue placeholder="All Project Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Project Types</SelectItem>
                    {allProjectTypes.map((pt) => (
                      <SelectItem key={pt.id} value={pt.id}>
                        {pt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="dashboard-archived"
                  checked={dashboardShowArchived}
                  onChange={(e) => setDashboardShowArchived(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                  data-testid="checkbox-dashboard-archived"
                />
                <Label htmlFor="dashboard-archived" className="cursor-pointer">
                  Show Archived Projects
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="dashboard-homescreen"
                checked={newDashboardIsHomescreen}
                onCheckedChange={(checked) => setNewDashboardIsHomescreen(checked === true)}
                data-testid="checkbox-homescreen-dashboard"
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="dashboard-homescreen" className="cursor-pointer font-medium">
                  Set as homescreen dashboard
                </Label>
                <p className="text-xs text-muted-foreground">
                  This dashboard will appear on your home screen when you log in
                </p>
              </div>
            </div>
            {newDashboardIsHomescreen && dashboards.some(d => d.isHomescreenDashboard) && (
              <p className="text-xs text-amber-600 dark:text-amber-500 pl-7">
                Note: This will replace your current homescreen dashboard
              </p>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="dashboard-share"
                checked={newDashboardVisibility === "shared"}
                onCheckedChange={(checked) => setNewDashboardVisibility(checked === true ? "shared" : "private")}
                data-testid="checkbox-share-dashboard"
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="dashboard-share" className="cursor-pointer font-medium">
                  Share with all users
                </Label>
                <p className="text-xs text-muted-foreground">
                  Other users will be able to view this dashboard
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Dashboard Widgets</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenAddWidget}
                data-testid="button-add-widget-to-dashboard"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Widget
              </Button>
            </div>

            {newDashboardWidgets.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No widgets added yet</p>
                    <p className="text-xs text-muted-foreground">Click "Add Widget" to get started</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {newDashboardWidgets.map((widget) => (
                  <Card key={widget.id} data-testid={`new-widget-card-${widget.id}`}>
                    <CardHeader className="relative pb-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => onRemoveWidget(widget.id)}
                        data-testid={`button-remove-new-widget-${widget.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      <CardTitle className="text-sm">{widget.title}</CardTitle>
                      <CardDescription className="text-xs">
                        {widget.type === "bar" && "Bar Chart"}
                        {widget.type === "pie" && "Pie Chart"}
                        {widget.type === "line" && "Line Chart"}
                        {widget.type === "number" && "Number Card"}
                        {" • "}
                        {widget.groupBy === "projectType" && "By Project Type"}
                        {widget.groupBy === "status" && "By Status"}
                        {widget.groupBy === "assignee" && "By Assignee"}
                        {widget.groupBy === "serviceOwner" && "By Service Owner"}
                        {widget.groupBy === "daysOverdue" && "By Days Overdue"}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => handleClose(false)} 
            data-testid="button-cancel-create-dashboard"
          >
            Cancel
          </Button>
          <Button 
            onClick={onSave} 
            disabled={isSaving}
            data-testid="button-save-new-dashboard"
          >
            {isSaving ? "Saving..." : isCreatingDashboard ? "Create Dashboard" : "Save Dashboard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
