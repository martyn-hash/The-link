import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type ProjectView, type User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { 
  Filter, 
  Calendar as CalendarIcon, 
  Save, 
  Trash2, 
  Star,
  X,
  Users,
  Briefcase,
  UserCircle,
  Archive,
  Folder
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface FilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  
  // Filter states
  serviceFilter: string;
  setServiceFilter: (value: string) => void;
  taskAssigneeFilter: string;
  setTaskAssigneeFilter: (value: string) => void;
  serviceOwnerFilter: string;
  setServiceOwnerFilter: (value: string) => void;
  userFilter: string;
  setUserFilter: (value: string) => void;
  showArchived: boolean;
  setShowArchived: (value: boolean) => void;
  behindScheduleOnly: boolean;
  setBehindScheduleOnly: (value: boolean) => void;
  dynamicDateFilter: "all" | "overdue" | "today" | "next7days" | "next14days" | "next30days" | "custom";
  setDynamicDateFilter: (value: "all" | "overdue" | "today" | "next7days" | "next14days" | "next30days" | "custom") => void;
  customDateRange: { from: Date | undefined; to: Date | undefined };
  setCustomDateRange: (value: { from: Date | undefined; to: Date | undefined }) => void;
  serviceDueDateFilter: string;
  setServiceDueDateFilter: (value: string) => void;
  viewMode: "kanban" | "list" | "dashboard";
  setViewMode: (value: "kanban" | "list" | "dashboard") => void;
  
  // Data for dropdowns
  services: { id: string; name: string }[];
  users: User[];
  taskAssignees: User[];
  serviceOwners: User[];
  isManagerOrAdmin: boolean;
}

export default function FilterPanel({
  open,
  onOpenChange,
  serviceFilter,
  setServiceFilter,
  taskAssigneeFilter,
  setTaskAssigneeFilter,
  serviceOwnerFilter,
  setServiceOwnerFilter,
  userFilter,
  setUserFilter,
  showArchived,
  setShowArchived,
  behindScheduleOnly,
  setBehindScheduleOnly,
  dynamicDateFilter,
  setDynamicDateFilter,
  customDateRange,
  setCustomDateRange,
  serviceDueDateFilter,
  setServiceDueDateFilter,
  viewMode,
  setViewMode,
  services,
  users,
  taskAssignees,
  serviceOwners,
  isManagerOrAdmin,
}: FilterPanelProps) {
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");

  // Fetch saved views
  const { data: savedViews = [] } = useQuery<ProjectView[]>({
    queryKey: ["/api/project-views"],
  });

  // Fetch unique due dates for selected service
  const { data: serviceDueDates = [] } = useQuery<string[]>({
    queryKey: ['/api/services', serviceFilter, 'due-dates'],
    enabled: serviceFilter !== "all",
  });

  // Save view mutation
  const saveViewMutation = useMutation({
    mutationFn: async (name: string) => {
      const filters = {
        serviceFilter,
        taskAssigneeFilter,
        serviceOwnerFilter,
        userFilter,
        showArchived,
        behindScheduleOnly,
        dynamicDateFilter,
        customDateRange: customDateRange.from && customDateRange.to ? {
          from: customDateRange.from.toISOString(),
          to: customDateRange.to.toISOString(),
        } : null,
        serviceDueDateFilter,
      };

      return await apiRequest(
        "POST",
        "/api/project-views",
        { name, filters: JSON.stringify(filters), viewMode }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-views"] });
      setSaveViewDialogOpen(false);
      setViewName("");
    },
  });

  // Delete view mutation
  const deleteViewMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(
        "DELETE",
        `/api/project-views/${id}`
      );
      return id;
    },
    onSuccess: (deletedId) => {
      // Eagerly update the cache by removing the deleted view
      queryClient.setQueryData<ProjectView[]>(["/api/project-views"], (oldData) => {
        return oldData ? oldData.filter(view => view.id !== deletedId) : oldData;
      });
    },
  });

  const handleClearAll = () => {
    setServiceFilter("all");
    setTaskAssigneeFilter("all");
    setServiceOwnerFilter("all");
    setUserFilter("all");
    setShowArchived(false);
    setBehindScheduleOnly(false);
    setDynamicDateFilter("all");
    setCustomDateRange({ from: undefined, to: undefined });
    setServiceDueDateFilter("all");
  };

  const handleLoadView = (view: ProjectView) => {
    const filters = typeof view.filters === 'string' 
      ? JSON.parse(view.filters) 
      : view.filters as any;
    
    setServiceFilter(filters.serviceFilter || "all");
    setTaskAssigneeFilter(filters.taskAssigneeFilter || "all");
    setServiceOwnerFilter(filters.serviceOwnerFilter || "all");
    setUserFilter(filters.userFilter || "all");
    setShowArchived(filters.showArchived || false);
    setBehindScheduleOnly(filters.behindScheduleOnly || false);
    setDynamicDateFilter(filters.dynamicDateFilter || "all");
    setServiceDueDateFilter(filters.serviceDueDateFilter || "all");
    
    if (filters.customDateRange) {
      setCustomDateRange({
        from: new Date(filters.customDateRange.from),
        to: new Date(filters.customDateRange.to),
      });
    } else {
      setCustomDateRange({ from: undefined, to: undefined });
    }
    
    if (view.viewMode) {
      setViewMode(view.viewMode as "kanban" | "list");
    }
  };

  // Mutual exclusivity wrapper for dynamic date filter
  const handleDynamicDateChange = (value: "all" | "overdue" | "today" | "next7days" | "next14days" | "next30days" | "custom") => {
    setDynamicDateFilter(value);
    if (value !== "all") {
      setServiceDueDateFilter("all"); // Clear service due date when using dynamic filter
    }
  };

  // Mutual exclusivity wrapper for service due date filter
  const handleServiceDueDateChange = (value: string) => {
    setServiceDueDateFilter(value);
    if (value !== "all") {
      setDynamicDateFilter("all"); // Clear dynamic filter when using service due date
      setCustomDateRange({ from: undefined, to: undefined });
    }
  };

  // Reset service due date filter when service changes
  useEffect(() => {
    if (serviceFilter === "all" || !serviceFilter) {
      setServiceDueDateFilter("all");
    }
  }, [serviceFilter, setServiceDueDateFilter]);

  const activeFilterCount = () => {
    let count = 0;
    if (serviceFilter !== "all") count++;
    if (taskAssigneeFilter !== "all") count++;
    if (serviceOwnerFilter !== "all") count++;
    if (userFilter !== "all" && isManagerOrAdmin) count++;
    if (showArchived) count++;
    if (behindScheduleOnly) count++;
    // Count only the active date filter (mutual exclusivity)
    if (dynamicDateFilter !== "all" || serviceDueDateFilter !== "all") count++;
    return count;
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters & Views
            </SheetTitle>
            <SheetDescription>
              Apply filters to narrow down projects, or save your current view for quick access.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-6">
            {/* Active Filters Info */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {activeFilterCount()} active {activeFilterCount() === 1 ? 'filter' : 'filters'}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                disabled={activeFilterCount() === 0}
                data-testid="button-clear-all-filters"
              >
                <X className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>

            <Separator />

            {/* Date Filters */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                Due Date Filter
              </Label>
              <Select value={dynamicDateFilter} onValueChange={handleDynamicDateChange}>
                <SelectTrigger data-testid="select-date-filter">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Due Today</SelectItem>
                  <SelectItem value="next7days">Next 7 Days</SelectItem>
                  <SelectItem value="next14days">Next 14 Days</SelectItem>
                  <SelectItem value="next30days">Next 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {/* Custom Date Range */}
              {dynamicDateFilter === "custom" && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs">From Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !customDateRange.from && "text-muted-foreground"
                          )}
                          data-testid="button-select-from-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customDateRange.from ? (
                            format(customDateRange.from, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customDateRange.from}
                          onSelect={(date) =>
                            setCustomDateRange({ ...customDateRange, from: date })
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">To Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !customDateRange.to && "text-muted-foreground"
                          )}
                          data-testid="button-select-to-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customDateRange.to ? (
                            format(customDateRange.to, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customDateRange.to}
                          onSelect={(date) =>
                            setCustomDateRange({ ...customDateRange, to: date })
                          }
                          disabled={(date) =>
                            customDateRange.from ? date < customDateRange.from : false
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Service Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Service
              </Label>
              <Select 
                value={serviceFilter} 
                onValueChange={(value) => {
                  setServiceFilter(value);
                  // Auto-switch to list view when "All Services" is selected
                  if (value === "all" && viewMode === "kanban") {
                    setViewMode("list");
                  }
                }}
              >
                <SelectTrigger data-testid="select-service-filter">
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

            {/* Service-Specific Due Date Filter - Only show when a service is selected */}
            {serviceFilter !== "all" && serviceDueDates.length > 0 && (
              <div className="space-y-3 pt-2">
                <Label className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="w-4 h-4" />
                  Filter by Specific Due Date
                </Label>
                <Select value={serviceDueDateFilter} onValueChange={handleServiceDueDateChange}>
                  <SelectTrigger data-testid="select-service-due-date-filter">
                    <SelectValue placeholder="All due dates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All due dates</SelectItem>
                    {serviceDueDates.map((date) => (
                      <SelectItem key={date} value={date}>
                        {format(new Date(date), "PPP")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Showing due dates for selected service
                </p>
              </div>
            )}

            {/* Kanban View Toggle - Only show when a specific service is selected */}
            {serviceFilter !== "all" && (
              <div className="flex items-center justify-between pt-2">
                <Label htmlFor="kanban-view-toggle" className="flex items-center gap-2 cursor-pointer text-sm">
                  <Folder className="w-4 h-4" />
                  Show as Kanban Board
                </Label>
                <Switch
                  id="kanban-view-toggle"
                  checked={viewMode === "kanban"}
                  onCheckedChange={(checked) => setViewMode(checked ? "kanban" : "list")}
                  data-testid="switch-kanban-view"
                />
              </div>
            )}

            <Separator />

            {/* Task Assignee Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <UserCircle className="w-4 h-4" />
                Task Assignee
              </Label>
              <Select value={taskAssigneeFilter} onValueChange={setTaskAssigneeFilter}>
                <SelectTrigger data-testid="select-task-assignee-filter">
                  <SelectValue placeholder="All Assignees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  {taskAssignees.map((assignee) => (
                    <SelectItem key={assignee.id} value={assignee.id}>
                      {assignee.firstName} {assignee.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Service Owner Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Folder className="w-4 h-4" />
                Service Owner
              </Label>
              <Select value={serviceOwnerFilter} onValueChange={setServiceOwnerFilter}>
                <SelectTrigger data-testid="select-service-owner-filter">
                  <SelectValue placeholder="All Owners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {serviceOwners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.firstName} {owner.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* User Filter (Manager/Admin only) */}
            {isManagerOrAdmin && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    User Assignment
                  </Label>
                  <Select value={userFilter} onValueChange={setUserFilter}>
                    <SelectTrigger data-testid="select-user-filter">
                      <SelectValue placeholder="All Users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <Separator />

            {/* Archived Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="show-archived-filter" className="flex items-center gap-2 cursor-pointer">
                <Archive className="w-4 h-4" />
                Show Archived Projects
              </Label>
              <Switch
                id="show-archived-filter"
                checked={showArchived}
                onCheckedChange={setShowArchived}
                data-testid="switch-show-archived-filter"
              />
            </div>

            <Separator />

            {/* Behind Schedule Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="behind-schedule-filter" className="flex items-center gap-2 cursor-pointer">
                <CalendarIcon className="w-4 h-4" />
                Behind Schedule Only
              </Label>
              <Switch
                id="behind-schedule-filter"
                checked={behindScheduleOnly}
                onCheckedChange={setBehindScheduleOnly}
                data-testid="switch-behind-schedule-filter"
              />
            </div>

            <Separator />

            {/* Saved Views */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Saved Views
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSaveViewDialogOpen(true)}
                  data-testid="button-save-current-view"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Current
                </Button>
              </div>

              {savedViews.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No saved views yet. Save your current filters for quick access.
                </p>
              ) : (
                <div className="space-y-2">
                  {savedViews.map((view) => (
                    <div
                      key={view.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent group"
                    >
                      <button
                        onClick={() => handleLoadView(view)}
                        className="flex-1 text-left text-sm font-medium"
                        data-testid={`button-load-view-${view.id}`}
                      >
                        {view.name}
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteViewMutation.mutate(view.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-delete-view-${view.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Save View Dialog */}
      <Dialog open={saveViewDialogOpen} onOpenChange={setSaveViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Current View</DialogTitle>
            <DialogDescription>
              Give your current filter configuration a name for easy access later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">View Name</Label>
              <Input
                id="view-name"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="e.g., Overdue VAT Returns"
                data-testid="input-view-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveViewDialogOpen(false)}
              data-testid="button-cancel-save-view"
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveViewMutation.mutate(viewName)}
              disabled={!viewName.trim() || saveViewMutation.isPending}
              data-testid="button-confirm-save-view"
            >
              {saveViewMutation.isPending ? "Saving..." : "Save View"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
