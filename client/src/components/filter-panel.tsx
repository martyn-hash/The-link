import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { type User } from "@shared/schema";
import { Button } from "@/components/ui/button";
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
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { 
  Filter, 
  Calendar as CalendarIcon, 
  X,
  Users,
  Briefcase,
  UserCircle,
  Archive,
  Folder,
  AlertTriangle
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
  showCompletedRegardless: boolean;
  setShowCompletedRegardless: (value: boolean) => void;
  scheduleStatusFilter: "all" | "behind" | "overdue" | "both";
  setScheduleStatusFilter: (value: "all" | "behind" | "overdue" | "both") => void;
  dynamicDateFilter: "all" | "overdue" | "today" | "next7days" | "next14days" | "next30days" | "custom";
  setDynamicDateFilter: (value: "all" | "overdue" | "today" | "next7days" | "next14days" | "next30days" | "custom") => void;
  customDateRange: { from: Date | undefined; to: Date | undefined };
  setCustomDateRange: (value: { from: Date | undefined; to: Date | undefined }) => void;
  serviceDueDateFilter: string;
  setServiceDueDateFilter: (value: string) => void;
  viewMode: "kanban" | "list" | "dashboard" | "calendar";
  setViewMode: (value: "kanban" | "list" | "dashboard" | "calendar") => void;
  
  // Optional new filters for dashboards
  clientFilter?: string;
  setClientFilter?: (value: string) => void;
  projectTypeFilter?: string;
  setProjectTypeFilter?: (value: string) => void;
  
  // Data for dropdowns
  services: { id: string; name: string }[];
  users: User[];
  taskAssignees: User[];
  serviceOwners: User[];
  isManagerOrAdmin: boolean;
  
  // Optional data for new filters
  clients?: { id: string; name: string }[];
  projectTypes?: { id: string; name: string }[];
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
  showCompletedRegardless,
  setShowCompletedRegardless,
  scheduleStatusFilter,
  setScheduleStatusFilter,
  dynamicDateFilter,
  setDynamicDateFilter,
  customDateRange,
  setCustomDateRange,
  serviceDueDateFilter,
  setServiceDueDateFilter,
  viewMode,
  setViewMode,
  clientFilter,
  setClientFilter,
  projectTypeFilter,
  setProjectTypeFilter,
  services,
  users,
  taskAssignees,
  serviceOwners,
  isManagerOrAdmin,
  clients,
  projectTypes,
}: FilterPanelProps) {
  // Fetch unique due dates for selected service
  const { data: serviceDueDates = [] } = useQuery<string[]>({
    queryKey: ['/api/services', serviceFilter, 'due-dates'],
    enabled: serviceFilter !== "all",
  });

  const handleClearAll = () => {
    setServiceFilter("all");
    setTaskAssigneeFilter("all");
    setServiceOwnerFilter("all");
    setUserFilter("all");
    setShowArchived(false);
    setShowCompletedRegardless(true);
    setScheduleStatusFilter("all");
    setDynamicDateFilter("all");
    setCustomDateRange({ from: undefined, to: undefined });
    setServiceDueDateFilter("all");
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
    if (!showCompletedRegardless) count++;
    if (scheduleStatusFilter !== "all") count++;
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
              Filters
            </SheetTitle>
            <SheetDescription>
              Apply filters to narrow down the projects displayed.
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

            {/* Client Filter - Only show in dashboard mode with clients available */}
            {viewMode === "dashboard" && clients && clients.length > 0 && setClientFilter && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Client
                  </Label>
                  <Select 
                    value={clientFilter || "all"} 
                    onValueChange={setClientFilter}
                  >
                    <SelectTrigger data-testid="select-client-filter">
                      <SelectValue placeholder="All Clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Project Type Filter - Only show in dashboard mode with project types available */}
            {viewMode === "dashboard" && projectTypes && projectTypes.length > 0 && setProjectTypeFilter && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Folder className="w-4 h-4" />
                    Project Type
                  </Label>
                  <Select 
                    value={projectTypeFilter || "all"} 
                    onValueChange={setProjectTypeFilter}
                  >
                    <SelectTrigger data-testid="select-project-type-filter">
                      <SelectValue placeholder="All Project Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Project Types</SelectItem>
                      {projectTypes.map((projectType) => (
                        <SelectItem key={projectType.id} value={projectType.id}>
                          {projectType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
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

            {/* Project Status Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Project Status Filter
              </Label>
              <Select value={scheduleStatusFilter} onValueChange={setScheduleStatusFilter}>
                <SelectTrigger data-testid="select-schedule-status-filter">
                  <SelectValue placeholder="All Active" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Active</SelectItem>
                  <SelectItem value="behind">Behind Schedule</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="both">Behind Schedule & Overdue</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Behind Schedule = in stage too long. Overdue = past due date.
              </p>
            </div>

            <Separator />

            {/* Show Completed Projects Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <Label htmlFor="show-completed-filter" className="flex items-center gap-2 cursor-pointer">
                  <Archive className="w-4 h-4" />
                  Include Completed Projects
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  When on, completed projects appear regardless of archived/inactive status
                </p>
              </div>
              <Switch
                id="show-completed-filter"
                checked={showCompletedRegardless}
                onCheckedChange={setShowCompletedRegardless}
                data-testid="switch-show-completed-filter"
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
