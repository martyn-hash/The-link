import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { apiRequest, queryClient } from "@/lib/queryClient";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  Filter, 
  Search, 
  X, 
  ChevronDown,
  ChevronRight,
  Briefcase,
  Users,
  UserCircle,
  Building2,
  User,
  Save,
  FolderOpen,
  Trash2,
  RefreshCw,
  UserCog,
  ArrowRightLeft,
  Calendar,
  CalendarClock,
  FolderKanban,
  Eye,
  EyeOff
} from "lucide-react";
import { format } from "date-fns";
import type { User as UserType, Service, WorkRole, Client } from "@shared/schema";

interface ServiceAssignmentView {
  id: string;
  userId: string;
  name: string;
  filters: any;
  createdAt: string;
}

interface ClientServiceWithDetails {
  id: string;
  clientId: string;
  serviceId: string;
  serviceOwnerId: string | null;
  frequency: string | null;
  nextStartDate: string | null;
  nextDueDate: string | null;
  isActive: boolean;
  client: {
    id: string;
    name: string;
    type: string;
  };
  service: {
    id: string;
    name: string;
    isPersonalService: boolean;
  };
  serviceOwner: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  roleAssignments: Array<{
    id: string;
    workRoleId: string;
    userId: string;
    isActive: boolean;
    workRole: {
      id: string;
      name: string;
    };
    user: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }>;
}

interface PeopleServiceWithDetails {
  id: string;
  personId: string;
  serviceId: string;
  serviceOwnerId: string | null;
  frequency: string | null;
  nextStartDate: string | null;
  nextDueDate: string | null;
  isActive: boolean;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    clientId: string | null;
  };
  service: {
    id: string;
    name: string;
    isPersonalService: boolean;
  };
  serviceOwner: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

type ServiceAssignment = (ClientServiceWithDetails | PeopleServiceWithDetails) & { type: 'client' | 'personal' };

export default function ServiceAssignments() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Filter panel state
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // Filter states
  const [serviceFilter, setServiceFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [serviceOwnerFilter, setServiceOwnerFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Column visibility toggle
  const [showRoleColumns, setShowRoleColumns] = useState(true);

  // Saved views state
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [deleteViewDialogOpen, setDeleteViewDialogOpen] = useState(false);
  const [viewToDelete, setViewToDelete] = useState<ServiceAssignmentView | null>(null);

  // Bulk reassignment state
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [reassignRoleId, setReassignRoleId] = useState("");
  const [reassignToUserId, setReassignToUserId] = useState("");
  const [reassignProgress, setReassignProgress] = useState<{
    isRunning: boolean;
    total: number;
    completed: number;
    roleChanges: number;
    projectUpdates: number;
    chronologyEntries: number;
  } | null>(null);
  const [reassignConfirmOpen, setReassignConfirmOpen] = useState(false);
  
  // Bulk date editing state
  const [dateEditDialogOpen, setDateEditDialogOpen] = useState(false);
  const [dateEditMode, setDateEditMode] = useState<'shift' | 'set'>('shift');
  const [dateEditTarget, setDateEditTarget] = useState<'start' | 'due' | 'both'>('both');
  const [shiftDays, setShiftDays] = useState<number>(0);
  const [setStartDate, setSetStartDate] = useState<string>('');
  const [setDueDate, setSetDueDate] = useState<string>('');

  // Default to "my assignments" for non-admins on first load
  useEffect(() => {
    if (user && !user.isAdmin && userFilter === "all") {
      setUserFilter(user.id);
    }
  }, [user]);

  // Fetch service assignments
  const { data: clientServices = [], isLoading: clientServicesLoading } = useQuery<ClientServiceWithDetails[]>({
    queryKey: ["/api/service-assignments/client", { 
      serviceId: serviceFilter !== "all" ? serviceFilter : undefined,
      roleId: roleFilter !== "all" ? roleFilter : undefined,
      userId: userFilter !== "all" ? userFilter : undefined,
      serviceOwnerId: serviceOwnerFilter !== "all" ? serviceOwnerFilter : undefined,
      showInactive
    }],
    enabled: isAuthenticated && !!user,
  });

  const { data: peopleServices = [], isLoading: peopleServicesLoading } = useQuery<PeopleServiceWithDetails[]>({
    queryKey: ["/api/service-assignments/personal", { 
      serviceId: serviceFilter !== "all" ? serviceFilter : undefined,
      serviceOwnerId: serviceOwnerFilter !== "all" ? serviceOwnerFilter : undefined,
      showInactive
    }],
    enabled: isAuthenticated && !!user,
  });

  // Fetch filter options
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["/api/services/active"],
    enabled: isAuthenticated && !!user,
  });

  const { data: workRoles = [] } = useQuery<WorkRole[]>({
    queryKey: ["/api/work-roles/active"],
    enabled: isAuthenticated && !!user,
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    enabled: isAuthenticated && !!user,
  });

  // Fetch saved views
  const { data: savedViews = [] } = useQuery<ServiceAssignmentView[]>({
    queryKey: ["/api/service-assignment-views"],
    enabled: isAuthenticated && !!user,
  });

  // Get roles for selected service (cascading filter)
  const availableRoles = useMemo(() => {
    if (serviceFilter === "all") {
      return workRoles;
    }
    const selectedService = services.find(s => s.id === serviceFilter);
    if (!selectedService) return [];
    
    // Get roles that are assigned to this service
    const serviceRoleAssignments = clientServices
      .filter(cs => cs.serviceId === serviceFilter)
      .flatMap(cs => cs.roleAssignments || []);
    
    const roleIds = new Set(serviceRoleAssignments.map(ra => ra.workRoleId));
    return workRoles.filter(r => roleIds.has(r.id));
  }, [serviceFilter, services, clientServices, workRoles]);

  // Combine and filter results
  const allAssignments: ServiceAssignment[] = useMemo(() => {
    const clientResults: ServiceAssignment[] = clientServices.map(cs => ({
      ...cs,
      type: 'client' as const
    }));
    
    const personalResults: ServiceAssignment[] = peopleServices.map(ps => ({
      ...ps,
      type: 'personal' as const
    }));

    let combined = [...clientResults, ...personalResults];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      combined = combined.filter(assignment => {
        if (assignment.type === 'client') {
          const cs = assignment as ClientServiceWithDetails & { type: 'client' };
          return cs.client.name.toLowerCase().includes(term) ||
                 cs.service.name.toLowerCase().includes(term);
        } else {
          const ps = assignment as PeopleServiceWithDetails & { type: 'personal' };
          const personName = `${ps.person.firstName} ${ps.person.lastName}`.toLowerCase();
          return personName.includes(term) ||
                 ps.service.name.toLowerCase().includes(term);
        }
      });
    }

    // Apply role filter for client services
    if (roleFilter !== "all") {
      combined = combined.filter(assignment => {
        if (assignment.type === 'personal') return false;
        const cs = assignment as ClientServiceWithDetails & { type: 'client' };
        return cs.roleAssignments?.some(ra => ra.workRoleId === roleFilter && ra.isActive);
      });
    }

    // Apply user filter (check role assignments)
    if (userFilter !== "all") {
      combined = combined.filter(assignment => {
        if (assignment.type === 'client') {
          const cs = assignment as ClientServiceWithDetails & { type: 'client' };
          return cs.serviceOwnerId === userFilter ||
                 cs.roleAssignments?.some(ra => ra.userId === userFilter && ra.isActive);
        } else {
          const ps = assignment as PeopleServiceWithDetails & { type: 'personal' };
          return ps.serviceOwnerId === userFilter;
        }
      });
    }

    return combined;
  }, [clientServices, peopleServices, searchTerm, roleFilter, userFilter]);

  // Active filter count
  const activeFilterCount = () => {
    let count = 0;
    if (serviceFilter !== "all") count++;
    if (roleFilter !== "all") count++;
    if (userFilter !== "all") count++;
    if (serviceOwnerFilter !== "all") count++;
    if (showInactive) count++;
    if (searchTerm) count++;
    return count;
  };

  const handleClearFilters = () => {
    setServiceFilter("all");
    setRoleFilter("all");
    setUserFilter("all");
    setServiceOwnerFilter("all");
    setShowInactive(false);
    setSearchTerm("");
    setSelectedIds(new Set());
  };

  // Toggle row expansion
  const toggleRowExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Toggle selection
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Select all visible client services
  const toggleSelectAll = () => {
    const clientAssignments = allAssignments.filter(a => a.type === 'client');
    if (selectedIds.size === clientAssignments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(clientAssignments.map(a => a.id)));
    }
  };

  // Save view mutation
  const saveViewMutation = useMutation({
    mutationFn: async (data: { name: string; filters: any }) => {
      return apiRequest("POST", "/api/service-assignment-views", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-assignment-views"] });
      setSaveViewDialogOpen(false);
      setNewViewName("");
      toast({
        title: "View saved",
        description: "Your filter configuration has been saved.",
      });
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  // Delete view mutation
  const deleteViewMutation = useMutation({
    mutationFn: async (viewId: string) => {
      return apiRequest("DELETE", `/api/service-assignment-views/${viewId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-assignment-views"] });
      setDeleteViewDialogOpen(false);
      setViewToDelete(null);
      toast({
        title: "View deleted",
        description: "The saved view has been removed.",
      });
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  // Bulk reassignment mutation
  const bulkReassignMutation = useMutation({
    mutationFn: async (data: { 
      clientServiceIds: string[];
      fromRoleId: string;
      toUserId: string;
    }) => {
      return apiRequest("POST", "/api/service-assignments/bulk-reassign", data);
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-assignments"] });
      setReassignDialogOpen(false);
      setReassignProgress(null);
      setSelectedIds(new Set());
      toast({
        title: "Reassignment complete",
        description: `Updated ${result.roleChanges} role assignments and ${result.projectUpdates} projects.`,
      });
    },
    onError: (error) => {
      showFriendlyError({ error });
      setReassignProgress(null);
    },
  });
  
  // Bulk date edit mutation
  const bulkDateEditMutation = useMutation({
    mutationFn: async (data: { 
      serviceIds: string[];
      serviceType: 'client' | 'personal';
      mode: 'shift' | 'set';
      shiftDays?: number;
      startDate?: string;
      dueDate?: string;
      target: 'start' | 'due' | 'both';
    }) => {
      return apiRequest("POST", "/api/service-assignments/bulk-update-dates", data);
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-assignments/client"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-assignments/personal"] });
      setDateEditDialogOpen(false);
      setSelectedIds(new Set());
      setShiftDays(0);
      setSetStartDate('');
      setSetDueDate('');
      toast({
        title: "Dates updated",
        description: `Updated ${result.updated} service${result.updated !== 1 ? 's' : ''}.`,
      });
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const handleSaveView = () => {
    if (!newViewName.trim()) {
      showFriendlyError({ error: "Please enter a view name" });
      return;
    }

    const filters = {
      serviceFilter,
      roleFilter,
      userFilter,
      serviceOwnerFilter,
      showInactive,
    };

    saveViewMutation.mutate({
      name: newViewName.trim(),
      filters: JSON.stringify(filters),
    });
  };

  const handleLoadView = (view: ServiceAssignmentView) => {
    try {
      const filters = typeof view.filters === 'string' ? JSON.parse(view.filters) : view.filters;
      setServiceFilter(filters.serviceFilter || "all");
      setRoleFilter(filters.roleFilter || "all");
      setUserFilter(filters.userFilter || "all");
      setServiceOwnerFilter(filters.serviceOwnerFilter || "all");
      setShowInactive(filters.showInactive || false);
      toast({
        title: "View loaded",
        description: `Applied filters from "${view.name}"`,
      });
    } catch (error) {
      showFriendlyError({ error });
    }
  };

  const handleStartReassignment = () => {
    if (!reassignRoleId || !reassignToUserId) {
      showFriendlyError({ error: "Please select a role and user for reassignment" });
      return;
    }
    setReassignConfirmOpen(true);
  };

  const handleConfirmReassignment = () => {
    setReassignConfirmOpen(false);
    setReassignProgress({
      isRunning: true,
      total: selectedIds.size,
      completed: 0,
      roleChanges: 0,
      projectUpdates: 0,
      chronologyEntries: 0,
    });

    bulkReassignMutation.mutate({
      clientServiceIds: Array.from(selectedIds),
      fromRoleId: reassignRoleId,
      toUserId: reassignToUserId,
    });
  };
  
  const handleBulkDateEdit = () => {
    const clientServiceIds = Array.from(selectedIds).filter(id => 
      allAssignments.find(a => a.id === id && a.type === 'client')
    );
    
    if (clientServiceIds.length === 0) {
      showFriendlyError({ error: "Please select at least one client service to update" });
      return;
    }
    
    if (dateEditMode === 'shift') {
      if (shiftDays === 0) {
        showFriendlyError({ error: "Please enter a number of days to shift (positive or negative)" });
        return;
      }
      bulkDateEditMutation.mutate({
        serviceIds: clientServiceIds,
        serviceType: 'client',
        mode: 'shift',
        shiftDays,
        target: dateEditTarget,
      });
    } else {
      if (dateEditTarget === 'start' && !setStartDate) {
        showFriendlyError({ error: "Please select a start date" });
        return;
      }
      if (dateEditTarget === 'due' && !setDueDate) {
        showFriendlyError({ error: "Please select a due date" });
        return;
      }
      if (dateEditTarget === 'both' && (!setStartDate || !setDueDate)) {
        showFriendlyError({ error: "Please select both start and due dates" });
        return;
      }
      bulkDateEditMutation.mutate({
        serviceIds: clientServiceIds,
        serviceType: 'client',
        mode: 'set',
        startDate: setStartDate || undefined,
        dueDate: setDueDate || undefined,
        target: dateEditTarget,
      });
    }
  };

  // Get available roles for the selected service assignments
  const selectedAssignmentRoles = useMemo(() => {
    const selectedAssignments = allAssignments.filter(a => selectedIds.has(a.id) && a.type === 'client');
    const roleIds = new Set<string>();
    
    for (const assignment of selectedAssignments) {
      const cs = assignment as ClientServiceWithDetails & { type: 'client' };
      for (const ra of cs.roleAssignments || []) {
        if (ra.isActive) {
          roleIds.add(ra.workRoleId);
        }
      }
    }
    
    return workRoles.filter(r => roleIds.has(r.id));
  }, [selectedIds, allAssignments, workRoles]);

  const isLoading = authLoading || clientServicesLoading || peopleServicesLoading;
  const isAdmin = user?.isAdmin || false;
  const clientAssignmentCount = allAssignments.filter(a => a.type === 'client').length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation />
        <div className="p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      
      <div className="flex">
        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Service Assignments</h1>
              <p className="text-muted-foreground">
                View and manage service assignments across clients and people
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Saved Views Dropdown */}
              {savedViews.length > 0 && (
                <Select onValueChange={(value) => {
                  const view = savedViews.find(v => v.id === value);
                  if (view) handleLoadView(view);
                }}>
                  <SelectTrigger className="w-[200px]" data-testid="select-saved-views">
                    <FolderOpen className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Load saved view" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedViews.map((view) => (
                      <SelectItem key={view.id} value={view.id}>
                        {view.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Save View Button */}
              <Button
                variant="outline"
                onClick={() => setSaveViewDialogOpen(true)}
                disabled={activeFilterCount() === 0}
                data-testid="button-save-view"
              >
                <Save className="w-4 h-4 mr-2" />
                Save View
              </Button>

              {/* Filter Button */}
              <Button
                variant={activeFilterCount() > 0 ? "default" : "outline"}
                onClick={() => setFilterPanelOpen(true)}
                data-testid="button-open-filters"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {activeFilterCount() > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFilterCount()}
                  </Badge>
                )}
              </Button>
            </div>
          </div>

          {/* Search and Bulk Actions Bar */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search clients, people, or services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            
            {/* Column Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRoleColumns(!showRoleColumns)}
              className="text-muted-foreground"
              data-testid="button-toggle-roles"
            >
              {showRoleColumns ? (
                <><EyeOff className="w-4 h-4 mr-2" /> Hide Roles</>
              ) : (
                <><Eye className="w-4 h-4 mr-2" /> Show Roles</>
              )}
            </Button>

            {/* Bulk Actions (Admin only) */}
            {isAdmin && selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" data-testid="text-selected-count">
                  {selectedIds.size} selected
                </Badge>
                <Button
                  variant="default"
                  onClick={() => setReassignDialogOpen(true)}
                  data-testid="button-bulk-reassign"
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Reassign Roles
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDateEditDialogOpen(true)}
                  data-testid="button-bulk-dates"
                >
                  <CalendarClock className="w-4 h-4 mr-2" />
                  Edit Dates
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  data-testid="button-clear-selection"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Results Summary */}
          <div className="flex items-center gap-4 mb-4">
            <p className="text-sm text-muted-foreground" data-testid="text-results-count">
              Showing {allAssignments.length} service assignment{allAssignments.length !== 1 ? 's' : ''}
              {activeFilterCount() > 0 && (
                <Button
                  variant="link"
                  className="ml-2 h-auto p-0 text-sm"
                  onClick={handleClearFilters}
                  data-testid="button-clear-all-filters"
                >
                  Clear all filters
                </Button>
              )}
            </p>
          </div>

          {/* Results Table */}
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : allAssignments.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No service assignments found</h3>
                <p className="text-muted-foreground mb-4">
                  {activeFilterCount() > 0
                    ? "Try adjusting your filters to see more results."
                    : "Use the filters to build your service assignment view."}
                </p>
                <Button onClick={() => setFilterPanelOpen(true)} data-testid="button-add-filters">
                  <Filter className="w-4 h-4 mr-2" />
                  Add Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && (
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedIds.size === clientAssignmentCount && clientAssignmentCount > 0}
                          onCheckedChange={toggleSelectAll}
                          disabled={clientAssignmentCount === 0}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                    )}
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Client / Person</TableHead>
                    <TableHead>Service</TableHead>
                    {showRoleColumns && <TableHead>Roles</TableHead>}
                    <TableHead>Service Owner</TableHead>
                    <TableHead>Next Start</TableHead>
                    <TableHead>Next Due</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allAssignments.map((assignment) => {
                    const isClientService = assignment.type === 'client';
                    const cs = isClientService ? assignment as ClientServiceWithDetails & { type: 'client' } : null;
                    const ps = !isClientService ? assignment as PeopleServiceWithDetails & { type: 'personal' } : null;
                    const isExpanded = expandedRows.has(assignment.id);

                    return (
                      <React.Fragment key={assignment.id}>
                        <TableRow
                          className={selectedIds.has(assignment.id) ? "bg-muted/50" : ""}
                          data-testid={`row-assignment-${assignment.id}`}
                        >
                          {isAdmin && (
                            <TableCell>
                              {isClientService && (
                                <Checkbox
                                  checked={selectedIds.has(assignment.id)}
                                  onCheckedChange={() => toggleSelect(assignment.id)}
                                  data-testid={`checkbox-select-${assignment.id}`}
                                />
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            {isClientService && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleRowExpand(assignment.id)}
                                data-testid={`button-expand-${assignment.id}`}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isClientService ? "default" : "secondary"}>
                              {isClientService ? (
                                <><Building2 className="w-3 h-3 mr-1" /> Client</>
                              ) : (
                                <><User className="w-3 h-3 mr-1" /> Personal</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {isClientService ? cs?.client.name : `${ps?.person.firstName} ${ps?.person.lastName}`}
                          </TableCell>
                          <TableCell>{isClientService ? cs?.service.name : ps?.service.name}</TableCell>
                          {showRoleColumns && (
                            <TableCell>
                              {isClientService && cs?.roleAssignments && cs.roleAssignments.filter(ra => ra.isActive).length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {cs.roleAssignments.filter(ra => ra.isActive).map((ra) => (
                                    <Badge 
                                      key={ra.id} 
                                      variant="outline" 
                                      className="text-xs whitespace-nowrap"
                                      title={`${ra.user.firstName} ${ra.user.lastName}`}
                                    >
                                      {ra.workRole.name}: {ra.user.firstName} {ra.user.lastName?.charAt(0)}.
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            {(isClientService ? cs?.serviceOwner : ps?.serviceOwner) ? (
                              <span className="flex items-center gap-1">
                                <UserCircle className="w-4 h-4 text-muted-foreground" />
                                {isClientService
                                  ? `${cs?.serviceOwner?.firstName} ${cs?.serviceOwner?.lastName}`
                                  : `${ps?.serviceOwner?.firstName} ${ps?.serviceOwner?.lastName}`}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {assignment.nextStartDate ? (
                              <span className="text-sm">
                                {format(new Date(assignment.nextStartDate), 'dd MMM yyyy')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {assignment.nextDueDate ? (
                              <span className="text-sm">
                                {format(new Date(assignment.nextDueDate), 'dd MMM yyyy')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {(isClientService ? cs?.frequency : ps?.frequency) || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={assignment.isActive ? "default" : "secondary"}>
                              {assignment.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>

                        {/* Expanded - Active Projects (placeholder for now) */}
                        {isExpanded && isClientService && (
                          <TableRow className="bg-muted/30" key={`expanded-${assignment.id}`}>
                            <TableCell colSpan={isAdmin ? (showRoleColumns ? 11 : 10) : (showRoleColumns ? 10 : 9)} className="py-3">
                              <div className="pl-12">
                                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                  <FolderKanban className="w-4 h-4" />
                                  Active Projects
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Loading active projects... (coming soon)
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>

      {/* Filter Panel (Sheet) */}
      <Sheet open={filterPanelOpen} onOpenChange={setFilterPanelOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </SheetTitle>
            <SheetDescription>
              Build your service assignment view using filters.
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
                onClick={handleClearFilters}
                disabled={activeFilterCount() === 0}
                data-testid="button-clear-filters-panel"
              >
                <X className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>

            <Separator />

            {/* Service Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Service
              </Label>
              <Select value={serviceFilter} onValueChange={(value) => {
                setServiceFilter(value);
                if (value !== serviceFilter) {
                  setRoleFilter("all"); // Reset role filter when service changes
                }
              }}>
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

            <Separator />

            {/* Role Filter (cascading) */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <UserCog className="w-4 h-4" />
                Role
              </Label>
              <Select 
                value={roleFilter} 
                onValueChange={setRoleFilter}
                disabled={availableRoles.length === 0}
              >
                <SelectTrigger data-testid="select-role-filter">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {availableRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {serviceFilter === "all" && workRoles.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Select a service first to filter by role
                </p>
              )}
            </div>

            <Separator />

            {/* User Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Assigned User
              </Label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger data-testid="select-user-filter">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                      {u.id === user?.id && " (You)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Service Owner Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <UserCircle className="w-4 h-4" />
                Service Owner
              </Label>
              <Select value={serviceOwnerFilter} onValueChange={setServiceOwnerFilter}>
                <SelectTrigger data-testid="select-service-owner-filter">
                  <SelectValue placeholder="All Service Owners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Service Owners</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                      {u.id === user?.id && " (You)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Show Inactive */}
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                Include inactive services
              </Label>
              <Checkbox
                checked={showInactive}
                onCheckedChange={(checked) => setShowInactive(checked as boolean)}
                data-testid="checkbox-show-inactive"
              />
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
              Save your current filter configuration for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">View Name</Label>
              <Input
                id="view-name"
                placeholder="e.g., My Weekly Payroll Clients"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                data-testid="input-view-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveViewDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveView} 
              disabled={saveViewMutation.isPending}
              data-testid="button-confirm-save-view"
            >
              {saveViewMutation.isPending ? "Saving..." : "Save View"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Reassignment Dialog */}
      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" />
              Bulk Role Reassignment
            </DialogTitle>
            <DialogDescription>
              Reassign roles for {selectedIds.size} selected service assignment{selectedIds.size !== 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>

          {reassignProgress ? (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 mx-auto animate-spin text-primary mb-4" />
                <h3 className="font-medium mb-2">Processing Reassignments</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Role assignments updated</span>
                  <span className="font-medium">{reassignProgress.roleChanges}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Projects updated</span>
                  <span className="font-medium">{reassignProgress.projectUpdates}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Chronology entries created</span>
                  <span className="font-medium">{reassignProgress.chronologyEntries}</span>
                </div>
                <Progress 
                  value={(reassignProgress.completed / reassignProgress.total) * 100} 
                  className="h-2"
                />
                <p className="text-xs text-center text-muted-foreground">
                  {reassignProgress.completed} of {reassignProgress.total} processed
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Role to Reassign</Label>
                <Select value={reassignRoleId} onValueChange={setReassignRoleId}>
                  <SelectTrigger data-testid="select-reassign-role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedAssignmentRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAssignmentRoles.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No common roles found in selected assignments
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Reassign To</Label>
                <Select value={reassignToUserId} onValueChange={setReassignToUserId}>
                  <SelectTrigger data-testid="select-reassign-user">
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setReassignDialogOpen(false)}
              disabled={bulkReassignMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleStartReassignment}
              disabled={!reassignRoleId || !reassignToUserId || bulkReassignMutation.isPending}
              data-testid="button-start-reassignment"
            >
              Start Reassignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassignment Confirmation Dialog */}
      <AlertDialog open={reassignConfirmOpen} onOpenChange={setReassignConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Reassignment</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to reassign the <strong>{workRoles.find(r => r.id === reassignRoleId)?.name}</strong> role 
              to <strong>{users.find(u => u.id === reassignToUserId)?.firstName} {users.find(u => u.id === reassignToUserId)?.lastName}</strong> for {selectedIds.size} service assignment{selectedIds.size !== 1 ? 's' : ''}.
              <br /><br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Update role assignments on each selected service</li>
                <li>Update any active projects using this role to the new assignee</li>
                <li>Log the change in project chronologies</li>
              </ul>
              <br />
              This action cannot be undone. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReassignment} data-testid="button-confirm-reassignment">
              Confirm Reassignment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Date Edit Dialog */}
      <Dialog open={dateEditDialogOpen} onOpenChange={setDateEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5" />
              Bulk Date Edit
            </DialogTitle>
            <DialogDescription>
              Update dates for {selectedIds.size} selected service{selectedIds.size !== 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Mode Selection */}
            <div className="space-y-2">
              <Label>Edit Mode</Label>
              <Select 
                value={dateEditMode} 
                onValueChange={(value: 'shift' | 'set') => setDateEditMode(value)}
              >
                <SelectTrigger data-testid="select-date-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shift">Shift dates by days</SelectItem>
                  <SelectItem value="set">Set specific dates</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Target Selection */}
            <div className="space-y-2">
              <Label>Which dates to update</Label>
              <Select 
                value={dateEditTarget} 
                onValueChange={(value: 'start' | 'due' | 'both') => setDateEditTarget(value)}
              >
                <SelectTrigger data-testid="select-date-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both start and due dates</SelectItem>
                  <SelectItem value="start">Start date only</SelectItem>
                  <SelectItem value="due">Due date only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Shift Mode Options */}
            {dateEditMode === 'shift' && (
              <div className="space-y-2">
                <Label htmlFor="shift-days">Number of days to shift</Label>
                <Input
                  id="shift-days"
                  type="number"
                  value={shiftDays}
                  onChange={(e) => setShiftDays(parseInt(e.target.value) || 0)}
                  placeholder="Enter days (positive or negative)"
                  data-testid="input-shift-days"
                />
                <p className="text-xs text-muted-foreground">
                  Use positive numbers to move dates forward, negative to move back. 
                  For example, -1 moves all dates back by one day.
                </p>
              </div>
            )}
            
            {/* Set Mode Options */}
            {dateEditMode === 'set' && (
              <>
                {(dateEditTarget === 'start' || dateEditTarget === 'both') && (
                  <div className="space-y-2">
                    <Label htmlFor="set-start-date">New Start Date</Label>
                    <Input
                      id="set-start-date"
                      type="date"
                      value={setStartDate}
                      onChange={(e) => setSetStartDate(e.target.value)}
                      data-testid="input-set-start-date"
                    />
                  </div>
                )}
                {(dateEditTarget === 'due' || dateEditTarget === 'both') && (
                  <div className="space-y-2">
                    <Label htmlFor="set-due-date">New Due Date</Label>
                    <Input
                      id="set-due-date"
                      type="date"
                      value={setDueDate}
                      onChange={(e) => setSetDueDate(e.target.value)}
                      data-testid="input-set-due-date"
                    />
                  </div>
                )}
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDateEditDialogOpen(false)}
              disabled={bulkDateEditMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleBulkDateEdit}
              disabled={bulkDateEditMutation.isPending}
              data-testid="button-apply-dates"
            >
              {bulkDateEditMutation.isPending ? "Updating..." : "Apply Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete View Confirmation */}
      <AlertDialog open={deleteViewDialogOpen} onOpenChange={setDeleteViewDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Saved View</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{viewToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => viewToDelete && deleteViewMutation.mutate(viewToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
